/**
 * ResetPasswordPage – Doppelte Aufgabe:
 *
 * 1. Ohne `access_token` in URL: Zeigt Email-Input,
 *    schickt Reset-Link via supabase.auth.resetPasswordForEmail.
 *
 * 2. Mit `access_token` (User klickt Link aus Email): Zeigt Passwort-Input,
 *    aktualisiert das Passwort via supabase.auth.updateUser.
 *
 * Supabase legt nach Klick auf den Reset-Link eine Session mit
 * "recovery" event an, über die wir das neue Passwort setzen können.
 */
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'request' | 'set'>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  // If Supabase fires a PASSWORD_RECOVERY event, we're in the "set new password" flow.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('set')
    })
    // Also check URL for access_token (some flows deep-link directly)
    if (window.location.hash.includes('type=recovery')) setMode('set')
    return () => subscription.unsubscribe()
  }, [])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setLoading(false)
    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      setSent(true)
    }
  }

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Mindestens 8 Zeichen.')
      return
    }
    if (password !== password2) {
      toast.error('Passwörter stimmen nicht überein.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error('Fehler: ' + error.message)
    } else {
      toast.success('Passwort aktualisiert!')
      void navigate('/dashboard', { replace: true })
    }
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 120 }}
        className="w-full max-w-sm bg-dark-card rounded-2xl p-8 border border-dark-border"
      >
        <h1 className="font-display text-white text-xl leading-tight">
          {mode === 'request' ? '🔑 Passwort zurücksetzen' : '🔒 Neues Passwort setzen'}
        </h1>
        <p className="font-body text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {mode === 'request'
            ? 'Gib deine E-Mail ein – wir schicken dir einen Link.'
            : 'Wähle ein starkes neues Passwort.'}
        </p>

        <div style={{ height: 24 }} />

        {mode === 'request' && !sent && (
          <form onSubmit={(e) => void handleRequest(e)} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
              className="w-full font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#6C3CE1', fontSize: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sende…' : 'Link senden'}
            </button>
            <button
              type="button"
              onClick={() => void navigate('/auth')}
              className="w-full font-body text-sm cursor-pointer border-none bg-transparent"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              ← Zurück
            </button>
          </form>
        )}

        {mode === 'request' && sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="font-body text-white" style={{ fontSize: 15 }}>
              📬 Email geschickt an <strong>{email}</strong>. Prüfe deinen Posteingang
              und klicke den Reset-Link.
            </p>
          </motion.div>
        )}

        {mode === 'set' && (
          <form onSubmit={(e) => void handleSet(e)} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Neues Passwort (min. 8 Zeichen)"
              required
              minLength={8}
              className="w-full font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Wiederholen"
              required
              minLength={8}
              className="w-full font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#6C3CE1', fontSize: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Speichere…' : 'Passwort speichern'}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  )
}
