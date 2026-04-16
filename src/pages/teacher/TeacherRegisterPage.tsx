/**
 * TeacherRegisterPage (/lehrer/registrieren)
 *
 * Kombiniert Registrierung (E-Mail + Passwort) und Login für Lehrer.
 * Nach Registrierung: role = 'teacher_pending' → Wartescreen bis Freischaltung.
 */
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { updateTeacherProfile } from '../../lib/teacherDb'
import { useTeacher } from '../../hooks/useTeacher'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

type Mode = 'register' | 'login'

const inputClass = [
  'w-full font-body text-white rounded-xl px-4 py-3 outline-none',
  'bg-[#1A1A2E] border border-[#0F3460] focus:border-[#6C3CE1]',
  'text-[15px] transition-colors',
].join(' ')

export default function TeacherRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading, isTeacher, isPending } = useTeacher()

  const [mode, setMode]           = useState<Mode>('register')
  const [submitting, setSubmitting] = useState(false)

  // Register fields
  const [name, setName]         = useState('')
  const [school, setSchool]     = useState('')
  const [subjects, setSubjects] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Auto-redirect once role is resolved
  useEffect(() => {
    if (loading) return
    if (isTeacher || isPending) navigate('/lehrer/dashboard', { replace: true })
  }, [loading, isTeacher, isPending, navigate])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !school.trim() || !email.trim() || !password.trim()) {
      toast.error(t('teacher.error_fields_required'))
      return
    }
    if (password.length < 8) {
      toast.error(t('teacher.error_password_short'))
      return
    }
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), role: 'teacher_pending' },
        },
      })
      if (error) throw error

      const uid = data.user?.id
      if (uid) {
        await updateTeacherProfile(uid, name.trim(), school.trim(), subjects.trim())
      }

      toast.success(t('teacher.register_success'))
      // If session is already set (auto-confirm), redirect is handled by useEffect above.
      // If email confirmation is required, show a hint.
      if (!data.session) {
        toast(t('teacher.confirm_email_hint'), { icon: '📬', duration: 8000 })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })
      if (error) throw error
      // Redirect handled by useEffect once profile loads
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  // Already logged in but role is not teacher — show wrong account info
  if (user && !isTeacher && !isPending) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-dark-card rounded-2xl p-8 border border-dark-border text-center">
          <p className="font-display text-white text-xl mb-2">⚠️</p>
          <p className="font-body text-white text-base mb-4">{t('teacher.wrong_account')}</p>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="font-body font-semibold text-white rounded-xl py-3 px-6 cursor-pointer border-none bg-[#6C3CE1]"
          >
            {t('teacher.sign_out')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4 py-10">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 120 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-4xl select-none mb-3">👩‍🏫</p>
          <h1 className="font-display text-white text-2xl leading-tight">
            {t('teacher.area_title')}
          </h1>
          <p className="font-body text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {t('teacher.area_subtitle')}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl overflow-hidden border border-dark-border mb-6">
          {(['register', 'login'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex-1 font-body font-semibold py-2.5 cursor-pointer border-none text-sm transition-colors"
              style={{
                background: mode === m ? '#6C3CE1' : 'transparent',
                color: mode === m ? '#fff' : 'rgba(255,255,255,0.45)',
              }}
            >
              {m === 'register' ? t('teacher.tab_register') : t('teacher.tab_login')}
            </button>
          ))}
        </div>

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('teacher.field_name')}
              required
              className={inputClass}
            />
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder={t('teacher.field_school')}
              required
              className={inputClass}
            />
            <input
              type="text"
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
              placeholder={t('teacher.field_subjects')}
              className={inputClass}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('teacher.field_email')}
              required
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('teacher.field_password')}
              required
              minLength={8}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none transition-opacity"
              style={{ background: '#6C3CE1', fontSize: '15px', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? '…' : t('teacher.register_btn')}
            </button>

            {/* Note about manual verification */}
            <p className="font-body text-center text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t('teacher.register_verify_note')}
            </p>
          </form>
        )}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={(e) => void handleLogin(e)} className="flex flex-col gap-3">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder={t('teacher.field_email')}
              required
              className={inputClass}
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder={t('teacher.field_password')}
              required
              className={inputClass}
            />
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 w-full font-body font-semibold text-white rounded-xl py-3 px-4 cursor-pointer border-none"
              style={{ background: '#6C3CE1', fontSize: '15px', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? '…' : t('teacher.login_btn')}
            </button>
          </form>
        )}

        {/* Back to student app */}
        <p className="font-body text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="border-none bg-transparent cursor-pointer underline text-inherit"
          >
            {t('teacher.back_to_app')}
          </button>
        </p>
      </motion.div>
    </main>
  )
}
