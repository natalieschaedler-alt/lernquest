/**
 * CreateStudentModal – Lehrer legt einen einzelnen Schüler an:
 *   Name + Username (auto oder manuell) + Passwort (auto oder manuell).
 *
 * Nach Erstellung: Druckbare "Zugangskarte" mit Username + Passwort +
 * URL und 1-Klick-Kopieren. Schüler muss nur noch Username eintippen.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { TeacherClass } from '../../lib/teacherDb'

interface Props {
  cls:   TeacherClass
  open:  boolean
  onClose: () => void
  onCreated?: () => void
}

interface CreatedCreds {
  username:    string
  password:    string
  displayName: string
}

function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')        // non-alnum → hyphen
    .replace(/^-|-$/g, '')              // trim hyphens
    .slice(0, 18)
    + '-' + Math.floor(Math.random() * 900 + 100) // suffix for uniqueness
}

export default function CreateStudentModal({ cls, open, onClose, onCreated }: Props) {
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [created, setCreated]   = useState<CreatedCreds | null>(null)
  const [autoUser, setAutoUser] = useState(true)
  const [autoPass, setAutoPass] = useState(true)

  const handleNameChange = (v: string) => {
    setName(v)
    if (autoUser) setUsername(suggestUsername(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) {
      toast.error('Du bist nicht eingeloggt.')
      setLoading(false)
      return
    }

    const body = {
      username:    autoUser ? suggestUsername(name) : username.trim().toLowerCase(),
      password:    autoPass ? 'auto' : password,
      displayName: name.trim(),
      classId:     cls.id,
    }

    try {
      const res = await fetch('/api/create-student', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { error: string | null; credentials?: CreatedCreds }
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Fehler beim Anlegen')
        setLoading(false)
        return
      }
      if (json.credentials) {
        setCreated(json.credentials)
        onCreated?.()
      }
    } catch {
      toast.error('Netzwerk-Fehler')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseAll = () => {
    setName('')
    setUsername('')
    setPassword('')
    setAutoUser(true)
    setAutoPass(true)
    setCreated(null)
    onClose()
  }

  const handleCreateAnother = () => {
    setName('')
    setUsername('')
    setPassword('')
    setAutoUser(true)
    setAutoPass(true)
    setCreated(null)
  }

  const handleCopyAll = async () => {
    if (!created) return
    const txt = `LearnQuest – Zugangsdaten für ${created.displayName}
Website:  https://learn-quest-cyan.vercel.app
Username: ${created.username}
Passwort: ${created.password}`
    await navigator.clipboard.writeText(txt)
    toast.success('In Zwischenablage kopiert')
  }

  const handlePrint = () => window.print()

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseAll}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 print:bg-white print:static"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-card w-full max-w-md rounded-2xl p-6 border border-dark-border max-h-[90vh] overflow-y-auto print:border-none print:bg-white print:text-black"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 print:hidden">
              <div>
                <h2 className="font-display text-xl text-white">
                  👤 Schüler anlegen
                </h2>
                <p className="font-body text-xs text-white/50 mt-1">
                  Klasse: <strong className="text-white">{cls.name}</strong>
                </p>
              </div>
              <button onClick={handleCloseAll} className="text-white/40 text-2xl leading-none">×</button>
            </div>

            {/* ── Create form ── */}
            {!created && (
              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 print:hidden">
                <div>
                  <label className="font-body text-xs text-white/60 uppercase tracking-wide block mb-1">
                    Name des Schülers
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="z.B. Anna Müller"
                    required
                    autoFocus
                    className="w-full font-body text-white rounded-xl px-4 py-2.5 outline-none"
                    style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label className="font-body text-xs text-white/60 uppercase tracking-wide flex items-center justify-between mb-1">
                    Username
                    <label className="flex items-center gap-1 text-white/40 text-[10px] font-normal normal-case cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoUser}
                        onChange={(e) => setAutoUser(e.target.checked)}
                      />
                      Automatisch
                    </label>
                  </label>
                  <input
                    type="text"
                    value={autoUser ? suggestUsername(name) : username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    disabled={autoUser}
                    placeholder="a-z, 0-9, _ -, 3-20 Zeichen"
                    className="w-full font-mono text-white rounded-xl px-4 py-2.5 outline-none disabled:opacity-60"
                    style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}
                  />
                </div>

                <div>
                  <label className="font-body text-xs text-white/60 uppercase tracking-wide flex items-center justify-between mb-1">
                    Passwort
                    <label className="flex items-center gap-1 text-white/40 text-[10px] font-normal normal-case cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoPass}
                        onChange={(e) => setAutoPass(e.target.checked)}
                      />
                      Generieren
                    </label>
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={autoPass}
                    placeholder={autoPass ? '(wird nach Erstellung angezeigt)' : 'min. 8 Zeichen'}
                    className="w-full font-mono text-white rounded-xl px-4 py-2.5 outline-none disabled:opacity-60"
                    style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="mt-2 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border-none disabled:opacity-40"
                  style={{ background: '#00C896' }}
                >
                  {loading ? 'Lege an…' : '+ Schüler erstellen'}
                </button>
              </form>
            )}

            {/* ── Created credentials card ── */}
            {created && (
              <div>
                <div className="print:hidden mb-4">
                  <p className="font-body text-sm text-green-400 mb-1">✓ Account erstellt</p>
                  <p className="font-body text-xs text-white/50">
                    Gib diese Zugangsdaten dem Schüler weiter. **Du siehst sie nur jetzt** —
                    danach musst du ggf. neu erstellen oder das Passwort zurücksetzen.
                  </p>
                </div>

                {/* Printable credential card */}
                <div
                  className="rounded-2xl p-5 print:p-0 print:m-0 print:shadow-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(108,60,225,0.15), rgba(59,130,246,0.08))',
                    border: '1px solid rgba(108,60,225,0.35)',
                  }}
                >
                  <h3 className="font-display text-lg text-white print:text-black mb-3">
                    🎮 LearnQuest – Dein Zugang
                  </h3>
                  <div className="font-body text-sm space-y-2">
                    <div>
                      <p className="text-white/50 print:text-black text-xs uppercase">Name</p>
                      <p className="text-white print:text-black font-semibold">{created.displayName}</p>
                    </div>
                    <div>
                      <p className="text-white/50 print:text-black text-xs uppercase">Website</p>
                      <p className="text-white print:text-black font-mono">learn-quest-cyan.vercel.app</p>
                    </div>
                    <div>
                      <p className="text-white/50 print:text-black text-xs uppercase">Username</p>
                      <p className="text-white print:text-black font-mono font-bold text-lg tracking-wider">{created.username}</p>
                    </div>
                    <div>
                      <p className="text-white/50 print:text-black text-xs uppercase">Passwort</p>
                      <p className="font-mono font-bold text-lg tracking-wider" style={{ color: '#FFD700' }}>
                        {created.password}
                      </p>
                    </div>
                    <p className="text-white/40 print:text-black text-[11px] mt-3 pt-3 border-t border-white/10 print:border-black/30">
                      Login-Seite: learn-quest-cyan.vercel.app/auth → <strong>"Schüler-Login"</strong>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 print:hidden">
                  <button
                    onClick={handleCopyAll}
                    className="flex-1 font-body text-sm py-2.5 rounded-xl border border-white/20 bg-white/5 cursor-pointer text-white"
                  >
                    📋 Kopieren
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex-1 font-body text-sm py-2.5 rounded-xl cursor-pointer text-white"
                    style={{ background: '#6C3CE1', border: 'none' }}
                  >
                    🖨️ Drucken
                  </button>
                </div>

                <div className="flex gap-2 mt-2 print:hidden">
                  <button
                    onClick={handleCreateAnother}
                    className="flex-1 font-body text-sm py-2.5 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-white/80"
                  >
                    + Weiteren Schüler
                  </button>
                  <button
                    onClick={handleCloseAll}
                    className="flex-1 font-body text-sm py-2.5 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-white/80"
                  >
                    Fertig
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
