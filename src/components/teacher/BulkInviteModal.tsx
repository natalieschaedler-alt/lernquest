/**
 * BulkInviteModal – Lehrer lädt CSV hoch oder fügt Namen ein.
 * Generiert eine druckbare Klassenliste mit Invite-Code für jeden Schüler.
 *
 * Kein Backend-Write – reine Client-Side-Aufbereitung. Der Invite-Code
 * gehört zur Klasse (nicht zum einzelnen Schüler), alle bekommen denselben.
 */
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import type { TeacherClass } from '../../lib/teacherDb'

interface Props {
  cls:   TeacherClass
  open:  boolean
  onClose: () => void
}

interface Row {
  name:  string
  email: string
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // Detect header (first line with "name" or "email")
  const header = lines[0].toLowerCase()
  const hasHeader = header.includes('name') || header.includes('email') || header.includes('e-mail')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const parts = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ''))
    // try to detect which column is name vs email
    const [a, b] = parts
    const isEmail = (s: string) => /@/.test(s)
    if (a && b) {
      return isEmail(a) ? { name: b, email: a } : { name: a, email: isEmail(b) ? b : '' }
    }
    return { name: a ?? '', email: '' }
  }).filter((r) => r.name)
}

function parseText(text: string): Row[] {
  // Either CSV/TSV style or one-name-per-line
  if (/[,;\t]/.test(text)) return parseCsv(text)
  return text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((name) => ({ name, email: '' }))
}

export default function BulkInviteModal({ cls, open, onClose }: Props) {
  const [rows, setRows]   = useState<Row[]>([])
  const [raw, setRaw]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      toast.error('CSV konnte nicht geparst werden – erste Spalte = Name, zweite = Email')
      return
    }
    setRows(parsed)
    setRaw(text)
    toast.success(`${parsed.length} Schüler eingelesen`)
  }

  const handlePasted = () => {
    if (!raw.trim()) return
    const parsed = parseText(raw)
    if (parsed.length === 0) {
      toast.error('Keine Namen erkannt')
      return
    }
    setRows(parsed)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyList = async () => {
    const txt = rows.map((r) => `${r.name}${r.email ? ' <' + r.email + '>' : ''}`).join('\n')
    await navigator.clipboard.writeText(txt)
    toast.success('Liste in Zwischenablage')
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 print:bg-white print:static"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-card w-full max-w-2xl rounded-2xl p-6 border border-dark-border max-h-[90vh] overflow-y-auto print:border-none print:bg-white print:text-black print:max-w-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 print:hidden">
              <div>
                <h2 className="font-display text-xl text-white">
                  📋 Massenupload Schüler
                </h2>
                <p className="font-body text-xs text-white/50 mt-1">
                  Klasse: <strong className="text-white">{cls.name}</strong>
                  &nbsp;·&nbsp;Invite-Code: <strong style={{ color: '#FFD700' }}>{cls.invite_code}</strong>
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/80 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="space-y-4 print:hidden">
                <div>
                  <p className="font-body text-sm text-white/70 mb-2">
                    <strong>1. CSV-Datei hochladen</strong> (Spalten: Name, Email)
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleFile(f)
                    }}
                    className="block w-full text-sm text-white file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary/80"
                    style={{ background: '#1A1A2E', padding: '8px', borderRadius: 12, border: '1px solid #0F3460' }}
                  />
                </div>

                <div className="text-center text-white/30 font-body text-xs">ODER</div>

                <div>
                  <p className="font-body text-sm text-white/70 mb-2">
                    <strong>2. Namen einfügen</strong> (ein Name pro Zeile, oder CSV-Paste)
                  </p>
                  <textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    rows={6}
                    placeholder="Anna Müller&#10;Ben Schmidt&#10;Clara Weber&#10;..."
                    className="w-full font-body text-white rounded-xl p-3 outline-none"
                    style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}
                  />
                  <button
                    onClick={handlePasted}
                    disabled={!raw.trim()}
                    className="mt-2 w-full font-body font-semibold text-white rounded-xl py-2.5 cursor-pointer border-none disabled:opacity-40"
                    style={{ background: '#6C3CE1' }}
                  >
                    Liste einlesen
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Print-friendly roster */}
                <div className="print:block">
                  <div className="print:hidden flex items-center justify-between mb-3">
                    <p className="font-body text-sm text-white">
                      {rows.length} Schüler · alle bekommen denselben Code
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRows([])}
                        className="font-body text-xs px-3 py-1.5 rounded-lg border border-white/20 bg-white/5"
                      >
                        ↻ Zurück
                      </button>
                      <button
                        onClick={handleCopyList}
                        className="font-body text-xs px-3 py-1.5 rounded-lg border border-white/20 bg-white/5"
                      >
                        📋 Kopieren
                      </button>
                      <button
                        onClick={handlePrint}
                        className="font-body text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: '#6C3CE1', color: 'white', border: 'none' }}
                      >
                        🖨️ Drucken
                      </button>
                    </div>
                  </div>

                  {/* Print header (only visible in print) */}
                  <div className="hidden print:block mb-4">
                    <h1 className="text-2xl font-bold">LearnQuest – Klassenzugang</h1>
                    <p className="mt-1">
                      Klasse: <strong>{cls.name}</strong> ({cls.subject}, {cls.grade})
                    </p>
                    <p className="mt-1 text-lg">
                      Invite-Code: <strong style={{ letterSpacing: 2 }}>{cls.invite_code}</strong>
                    </p>
                    <p className="mt-1 text-sm">
                      So geht's: 1) learn-quest-cyan.vercel.app öffnen · 2) Gast fortsetzen oder Account erstellen
                      · 3) Im Dashboard "Klasse beitreten" → Code eingeben
                    </p>
                    <hr style={{ margin: '12px 0' }} />
                  </div>

                  {/* Roster table */}
                  <table className="w-full font-body text-sm print:text-black">
                    <thead className="text-white/50 text-xs uppercase print:text-black">
                      <tr className="text-left">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3 print:hidden">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-white/10 print:border-black/20">
                          <td className="py-2 pr-3 text-white/40 print:text-black">{i + 1}</td>
                          <td className="py-2 pr-3 text-white print:text-black">{r.name}</td>
                          <td className="py-2 pr-3 text-white/60 print:text-black">{r.email || '—'}</td>
                          <td className="py-2 pr-3 print:hidden" style={{ color: '#FFD700' }}>
                            {cls.invite_code}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
