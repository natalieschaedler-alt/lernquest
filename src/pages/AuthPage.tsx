import { useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
  </svg>
)

type Mode = 'choose' | 'magic' | 'password' | 'student'

const STUDENT_EMAIL_DOMAIN = 'students.learnquest.local'

export default function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode]       = useState<Mode>('choose')
  const [email, setEmail]     = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  const handleGoogle = () => {
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    })
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/dashboard' },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (error) {
      toast.error(t('auth.login_failed', 'Login fehlgeschlagen: ') + error.message)
    } else {
      toast.success(t('auth.login_success', 'Eingeloggt!'))
      void navigate('/dashboard')
    }
  }

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Transform username → fake email (internal format only)
    const normalised = username.trim().toLowerCase()
    if (!/^[a-z0-9_-]{3,20}$/.test(normalised)) {
      toast.error('Username: 3-20 Zeichen (a-z, 0-9, _, -)')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email:    `${normalised}@${STUDENT_EMAIL_DOMAIN}`,
      password,
    })
    setLoading(false)
    if (error) {
      toast.error('Login fehlgeschlagen – Username oder Passwort falsch.')
    } else {
      toast.success('Willkommen!')
      void navigate('/dashboard')
    }
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm bg-dark-card rounded-2xl p-8 border border-dark-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 120 }}
      >
        <h1 className="font-display text-white text-2xl leading-tight">
          {t('auth.save_progress')}
        </h1>
        <p className="font-body text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {t('auth.account_desc')}
        </p>

        <div style={{ height: '32px' }} />

        {/* ─── Choose mode ─── */}
        {mode === 'choose' && !sent && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setMode('student')}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FF9500)', fontSize: '15px', color: '#1A1A2E' }}
            >
              🎓 Schüler-Login (Username + Passwort)
            </button>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs font-body">oder</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="flex items-center justify-center gap-3 w-full font-body font-semibold rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#ffffff', color: '#1A1A2E', fontSize: '15px' }}
            >
              <GoogleIcon />
              {t('auth.sign_in_google')}
            </button>

            <button
              type="button"
              onClick={() => setMode('magic')}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#6C3CE1', fontSize: '15px' }}
            >
              ✨ {t('auth.sign_in_email', 'Magic-Link per Email')}
            </button>

            <button
              type="button"
              onClick={() => setMode('password')}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            >
              🔐 Email + Passwort (für Lehrer/Admin)
            </button>

            <button
              type="button"
              onClick={() => {
                toast(t('auth.guest_toast'), { icon: '👤', duration: 4000 })
                void navigate(-1)
              }}
              className="w-full font-body text-sm cursor-pointer border-none bg-transparent mt-1"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}
            >
              {t('auth.continue_guest')}
            </button>
          </div>
        )}

        {/* ─── Student login ─── */}
        {mode === 'student' && (
          <form onSubmit={(e) => void handleStudentLogin(e)} className="flex flex-col gap-3">
            <p className="font-body text-xs text-white/60 mb-1">
              🎓 Login für Schüler — dein Lehrer hat dir Username + Passwort gegeben.
            </p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (z.B. anna-456)"
              required
              autoComplete="username"
              autoFocus
              className="w-full font-mono text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              autoComplete="current-password"
              className="w-full font-mono text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full font-body font-bold rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FF9500)', color: '#1A1A2E', fontSize: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Login…' : '🎮 Einloggen'}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full font-body text-sm cursor-pointer border-none bg-transparent"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}
            >
              {t('auth.back')}
            </button>
          </form>
        )}

        {/* ─── Magic link ─── */}
        {mode === 'magic' && !sent && (
          <form onSubmit={(e) => void handleMagicLink(e)} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
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
              {loading ? t('auth.sending') : t('auth.send_magic_link')}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full font-body text-sm cursor-pointer border-none bg-transparent"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}
            >
              {t('auth.back')}
            </button>
          </form>
        )}

        {/* ─── Password login ─── */}
        {mode === 'password' && (
          <form onSubmit={(e) => void handlePasswordLogin(e)} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder', 'E-Mail')}
              required
              autoComplete="email"
              className="w-full font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password_placeholder', 'Passwort')}
              required
              autoComplete="current-password"
              minLength={6}
              className="w-full font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '15px' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#6C3CE1', fontSize: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t('auth.sending', 'Sende…') : t('auth.sign_in_now', 'Einloggen')}
            </button>
            <button
              type="button"
              onClick={() => void navigate('/auth/reset')}
              className="w-full font-body text-xs cursor-pointer border-none bg-transparent"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {t('auth.forgot_password', 'Passwort vergessen?')}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full font-body text-sm cursor-pointer border-none bg-transparent"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}
            >
              {t('auth.back')}
            </button>
          </form>
        )}

        {sent && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-body text-center text-white"
            style={{ fontSize: '16px' }}
          >
            {t('auth.email_sent')} 📬
          </motion.p>
        )}
      </motion.div>
    </main>
  )
}
