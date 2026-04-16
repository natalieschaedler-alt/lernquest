/**
 * ProfilePage – vollständige Profilseite
 *
 * Eingeloggte User:  Avatar · Name · Rang · XP-Balken · Statistiken ·
 *                    Lernziel · Themen · Errungenschaften · Liga ·
 *                    Welten · Einstellungen · Gefahrenzone
 * Gast-User:         Banner + vereinfachte Ansicht (kein Lernziel, keine
 *                    Themen, keine Gefahrenzone)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ACHIEVEMENT_DEFS, getLevelTitle } from '../stores/gameStore'
import { useLeague } from '../hooks/useLeague'
import { useMistakesReview } from '../hooks/useMistakesReview'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { soundManager } from '../utils/soundManager'
import { getUserWorlds, deleteWorld } from '../lib/database'
import { supabase } from '../lib/supabase'
import LanguageToggle from '../components/ui/LanguageToggle'
import Footer from '../components/ui/Footer'
import StreakHeatmap from '../components/ui/StreakHeatmap'
import XpBar from '../components/ui/XpBar'

// ── Konstanten ─────────────────────────────────────────────────

const MAX_WORLDS_FREE = 10
const NOTIFICATION_KEY = 'learnquest-notifications'

const AVATAR_COLORS = [
  '#6C3CE1', '#00C896', '#FF6B35', '#3B82F6',
  '#A855F7', '#F59E0B', '#EF4444', '#14B8A6',
]

type LearningIntention = 'exam' | 'grades' | 'fun' | null

// ── Hilfsfunktionen ───────────────────────────────────────────

function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ── Sub-Komponenten ───────────────────────────────────────────

/** Zählt animiert von 0 auf den Zielwert hoch. */
function AnimatedStat({
  value, suffix = '', delay = 0,
}: { value: number; suffix?: string; delay?: number }) {
  const [displayed, setDisplayed] = useState(0)
  const ran = useRef(false)
  const elemRef = useCallback((node: HTMLSpanElement | null) => {
    if (!node || ran.current) return
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      ran.current = true
      obs.disconnect()
      const startAt = Date.now() + delay
      const dur = 900
      const tick = () => {
        const now = Date.now()
        if (now < startAt) { requestAnimationFrame(tick); return }
        const p = Math.min((now - startAt) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setDisplayed(Math.round(value * ease))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    obs.observe(node)
  }, [value, delay])

  return <span ref={elemRef}>{displayed}{suffix}</span>
}

/** Farbiger Kreis mit Initialen als Avatar. */
function AvatarCircle({ name, color, size = 72 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-display font-bold text-white select-none"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        boxShadow: `0 0 24px ${color}55`,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {getInitials(name) || '?'}
    </div>
  )
}

/** Toggle-Switch mit Framer-Spring. */
function ToggleSwitch({
  checked, onChange, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative cursor-pointer border-none bg-transparent p-0 disabled:opacity-40"
    >
      <div
        className="w-12 h-6 rounded-full transition-colors duration-300"
        style={{ background: checked ? '#00C896' : '#1A1A2E', border: '1px solid #2A2A4E' }}
      >
        <motion.div
          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
          animate={{ left: checked ? '26px' : '2px' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        />
      </div>
    </button>
  )
}

// ── Typen ─────────────────────────────────────────────────────

interface SavedWorld { id: string; title: string; created_at: string; questions: unknown[] }

interface UserTopic {
  id: string
  topic_name: string
  source_type: string
  mastery_percent: number
  last_studied_at: string
}

// ── Haupt-Komponente ──────────────────────────────────────────

export default function ProfilePage() {
  const navigate   = useNavigate()
  const { t, i18n } = useTranslation()
  const { user }   = useAuth()
  const { userTier, userWeeklyXP } = useLeague()
  const { pendingCount } = useMistakesReview()

  const {
    xp, level, streak, totalSessions,
    playerName, dailyChallenge,
    setPlayerName, initDailyChallenge,
  } = useProgress()

  const avatarColor = getAvatarColor(playerName)
  const levelTitle  = getLevelTitle(level)

  // ── State ──────────────────────────────────────────────────
  const [editingName, setEditingName]       = useState(false)
  const [nameInput, setNameInput]           = useState(playerName)
  const [longestStreak, setLongestStreak]   = useState(0)
  const [qAnswered, setQAnswered]           = useState(0)
  const [qCorrect, setQCorrect]             = useState(0)
  const [favTopic, setFavTopic]             = useState<string | null>(null)
  const [intention, setIntention]           = useState<LearningIntention>(null)
  const [topics, setTopics]                 = useState<UserTopic[]>([])
  const [topicsLoading, setTopicsLoading]   = useState(false)
  const [deletingTopic, setDeletingTopic]   = useState<string | null>(null)
  const [savedWorlds, setSavedWorlds]       = useState<SavedWorld[]>([])
  const [worldsLoading, setWorldsLoading]   = useState(false)
  const [deleteWorldId, setDeleteWorldId]   = useState<string | null>(null)
  const [deletingWorld, setDeletingWorld]   = useState(false)
  const [notifications, setNotifications]   = useState(
    () => localStorage.getItem(NOTIFICATION_KEY) === 'true',
  )
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteWord, setDeleteWord]         = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Sync nameInput wenn playerName von außen gesetzt wird
  useEffect(() => { setNameInput(playerName) }, [playerName])

  // Daily challenge initialisieren
  useEffect(() => { initDailyChallenge() }, [initDailyChallenge])

  // ── Server-Daten laden (nur für eingeloggte User) ──────────

  useEffect(() => {
    if (!user) return
    void (async () => {
      const [profileRes, sessionsRes] = await Promise.all([
        supabase.from('profiles')
          .select('longest_streak, learning_intention')
          .eq('id', user.id).maybeSingle(),
        supabase.from('sessions')
          .select('questions_correct, questions_total, world_theme')
          .eq('user_id', user.id),
      ])

      if (profileRes.data) {
        setLongestStreak(profileRes.data.longest_streak ?? 0)
        setIntention((profileRes.data.learning_intention as LearningIntention) ?? null)
      }

      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const answered = sessionsRes.data.reduce((s, r) => s + (r.questions_total ?? 0), 0)
        const correct  = sessionsRes.data.reduce((s, r) => s + (r.questions_correct ?? 0), 0)
        setQAnswered(answered)
        setQCorrect(correct)
        // Lieblingsfach = häufigstes world_theme
        const counts: Record<string, number> = {}
        for (const r of sessionsRes.data) {
          if (r.world_theme) counts[r.world_theme] = (counts[r.world_theme] ?? 0) + 1
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
        if (top) setFavTopic(top[0])
      }
    })()
  }, [user])

  // Gelernte Themen laden
  const loadTopics = useCallback(async () => {
    if (!user) return
    setTopicsLoading(true)
    const { data } = await supabase.from('user_topics')
      .select('id, topic_name, source_type, mastery_percent, last_studied_at')
      .eq('user_id', user.id)
      .order('last_studied_at', { ascending: false })
    setTopics((data ?? []) as UserTopic[])
    setTopicsLoading(false)
  }, [user])

  useEffect(() => { void loadTopics() }, [loadTopics])

  // Gespeicherte Welten laden
  const loadWorlds = useCallback(async () => {
    if (!user) return
    setWorldsLoading(true)
    const worlds = await getUserWorlds(user.id)
    setSavedWorlds(worlds as SavedWorld[])
    setWorldsLoading(false)
  }, [user])

  useEffect(() => { void loadWorlds() }, [loadWorlds])

  // ── Handler ────────────────────────────────────────────────

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setPlayerName(trimmed)
    setEditingName(false)
  }

  const handleSetIntention = async (val: LearningIntention) => {
    setIntention(val)
    if (user) {
      await supabase.from('profiles').update({ learning_intention: val }).eq('id', user.id)
    }
  }

  const handleDeleteTopic = async (id: string) => {
    setDeletingTopic(null)
    await supabase.from('user_topics').delete().eq('id', id)
    setTopics((prev) => prev.filter((t) => t.id !== id))
  }

  const handleDeleteWorld = async () => {
    if (!deleteWorldId) return
    setDeletingWorld(true)
    try {
      await deleteWorld(deleteWorldId)
      setSavedWorlds((prev) => prev.filter((w) => w.id !== deleteWorldId))
      setDeleteWorldId(null)
    } catch {
      toast.error(t('worlds.delete_error'))
    } finally {
      setDeletingWorld(false)
    }
  }

  const handleNotifications = (val: boolean) => {
    setNotifications(val)
    localStorage.setItem(NOTIFICATION_KEY, String(val))
    if (val && 'Notification' in window) {
      void Notification.requestPermission()
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteWord !== t('profile.delete_confirm_word')) return
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('delete failed')
      toast.success(t('profile.delete_success'))
      await supabase.auth.signOut()
      navigate('/', { replace: true })
    } catch {
      toast.error(t('profile.delete_error'))
    } finally {
      setDeletingAccount(false)
    }
  }

  // ── Animations-Delays für Sektionen ────────────────────────
  const sd = (i: number) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.06 } })

  // ── Render ─────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-8" style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-dark-card border border-dark-border rounded-xl px-4 py-3 min-h-[44px] text-white text-sm font-body cursor-pointer"
        >
          ← {t('profile.back')}
        </button>
        <h1 className="font-display text-lg text-white">{t('profile.title')}</h1>
        <div style={{ width: 80 }} />
      </div>

      {/* ── Gast-Banner ── */}
      {!user && (
        <motion.div
          className="mb-4 rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'linear-gradient(135deg, #6C3CE122, #00C89622)', border: '1px solid #6C3CE155' }}
          {...sd(0)}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">💾</span>
            <div>
              <p className="font-display text-white text-base">{t('profile.guest_banner_title')}</p>
              <p className="font-body text-sm text-gray-400 mt-0.5">{t('profile.guest_banner_desc')}</p>
            </div>
          </div>
          <motion.button
            onClick={() => navigate('/auth')}
            className="w-full font-body font-bold text-white rounded-xl py-3 cursor-pointer border-none text-sm"
            style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)' }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          >
            {t('profile.guest_banner_cta')}
          </motion.button>
        </motion.div>
      )}

      {/* ── Profil-Header-Card ── */}
      <motion.div
        className="bg-dark-card rounded-2xl p-6 border border-dark-border"
        {...sd(1)}
      >
        <div className="flex items-center gap-4">
          <AvatarCircle name={playerName || t('profile.adventurer')} color={avatarColor} />

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                  maxLength={30}
                  autoFocus
                  className="font-display text-white bg-dark border border-primary rounded-lg px-3 py-1.5 text-base flex-1 outline-none min-w-0"
                  style={{ fontSize: '18px' }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="font-body text-xs font-semibold text-white bg-primary rounded-lg px-3 py-1.5 cursor-pointer border-none whitespace-nowrap"
                  style={{ background: '#6C3CE1' }}
                >
                  {t('profile.save_name')}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setNameInput(playerName) }}
                  className="font-body text-xs text-gray-400 cursor-pointer border-none bg-transparent"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl text-white truncate">
                  {playerName || t('profile.adventurer')}
                </h2>
                <button
                  type="button"
                  aria-label={t('profile.edit_name')}
                  onClick={() => setEditingName(true)}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer border-none bg-transparent text-sm"
                >
                  ✏️
                </button>
              </div>
            )}

            {/* Rang + Level */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="font-body text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: '#6C3CE130', color: '#9B5DE5' }}
              >
                {levelTitle}
              </span>
              <span className="font-body text-xs text-gray-400">Level {level}</span>
            </div>
          </div>
        </div>

        {/* XP-Balken */}
        <div className="mt-5">
          <p className="font-body text-xs text-gray-400 mb-2">{xp.toLocaleString()} XP total</p>
          <XpBar />
        </div>
      </motion.div>

      {/* ── Statistiken ── */}
      <motion.div className="mt-4" {...sd(2)}>
        <h3 className="font-display text-sm text-gray-400 mb-3 uppercase tracking-wider">Statistiken</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: '🔥', label: t('profile.streak_label'),        value: streak,       suffix: 'd',  delay: 0   },
            { icon: '💪', label: t('profile.longest_streak'),      value: longestStreak, suffix: 'd', delay: 80  },
            { icon: '⚔️', label: t('profile.dungeons'),            value: totalSessions, suffix: '',  delay: 160 },
            { icon: '❓', label: t('profile.questions_answered'),  value: qAnswered,    suffix: '',   delay: 240 },
            {
              icon: '🎯',
              label: t('profile.accuracy'),
              value: qAnswered > 0 ? Math.round((qCorrect / qAnswered) * 100) : 0,
              suffix: '%',
              delay: 320,
            },
            { icon: '🏆', label: t('profile.level_label'),          value: level,        suffix: '',  delay: 400 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-dark-card rounded-2xl p-3.5 border border-dark-border flex flex-col items-center gap-0.5"
            >
              <span className="text-xl">{stat.icon}</span>
              <span className="font-display text-lg text-white leading-tight">
                <AnimatedStat value={stat.value} suffix={stat.suffix} delay={stat.delay} />
              </span>
              <span className="font-body text-xs text-gray-500 text-center leading-tight">{stat.label}</span>
            </div>
          ))}
        </div>
        {/* Lieblingsfach */}
        {favTopic && (
          <div className="mt-2.5 bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3">
            <span className="text-xl">🎓</span>
            <div>
              <p className="font-body text-xs text-gray-400">{t('profile.favorite_topic')}</p>
              <p className="font-body text-sm font-semibold text-white capitalize">{favTopic}</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Tägliche Aufgabe ── */}
      {dailyChallenge && (
        <motion.div
          className="mt-4 flex items-center gap-3 rounded-2xl px-5 py-4 border border-dark-border bg-dark-card"
          {...sd(3)}
        >
          <span className="text-2xl">{dailyChallenge.completed ? '✅' : '🎯'}</span>
          <div className="flex-1">
            <p className="font-body font-bold text-white text-sm">
              {t('profile.daily_challenge')}
              {dailyChallenge.completed && (
                <span className="ml-2 text-xs" style={{ color: '#00C896' }}>{t('profile.challenge_done')}</span>
              )}
            </p>
            <p className="font-body text-xs text-gray-400">{t(dailyChallenge.descKey)}</p>
          </div>
          {!dailyChallenge.completed && (
            <span className="text-xs font-body px-2 py-1 rounded-full" style={{ background: '#6C3CE120', color: '#9B5DE5' }}>
              {t('challenge.bonus_xp')}
            </span>
          )}
        </motion.div>
      )}

      {/* ── Spaced-Repetition-Badge ── */}
      {pendingCount > 0 && (
        <motion.button
          onClick={() => navigate('/onboarding')}
          className="mt-3 w-full flex items-center gap-3 rounded-2xl px-5 py-4 border-none cursor-pointer"
          style={{ background: '#FF950015', border: '2px solid #FF9500' }}
          {...sd(4)}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
        >
          <span className="text-2xl">🔁</span>
          <div className="flex-1 text-left">
            <p className="font-body font-bold text-white text-sm">
              {t(pendingCount === 1 ? 'profile.review_badge_title_one' : 'profile.review_badge_title_other', { count: pendingCount })}
            </p>
            <p className="font-body text-xs text-yellow-300/80">{t('profile.review_badge_sub')}</p>
          </div>
          <span className="font-display text-lg font-bold" style={{ color: '#FF9500' }}>{pendingCount}</span>
        </motion.button>
      )}

      {/* ── Lernziel (nur eingeloggt) ── */}
      {user && (
        <motion.div className="mt-5" {...sd(5)}>
          <h3 className="font-display text-sm text-gray-400 mb-3 uppercase tracking-wider">
            {t('profile.intention_title')}
          </h3>
          <div className="flex gap-2.5">
            {([
              { val: 'exam'   as const, icon: '📝', labelKey: 'profile.intention_exam'   },
              { val: 'grades' as const, icon: '🎓', labelKey: 'profile.intention_grades' },
              { val: 'fun'    as const, icon: '🎮', labelKey: 'profile.intention_fun'    },
            ]).map(({ val, icon, labelKey }) => (
              <motion.button
                key={val}
                type="button"
                onClick={() => void handleSetIntention(val)}
                className="flex-1 font-body font-semibold text-sm rounded-xl py-3 cursor-pointer border transition-colors"
                style={{
                  background:  intention === val ? '#6C3CE1' : '#1A1A2E',
                  borderColor: intention === val ? '#6C3CE1' : '#2A2A4E',
                  color:       intention === val ? '#fff'    : '#9CA3AF',
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                {icon} {t(labelKey)}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Streak-Heatmap ── */}
      <motion.div className="mt-5" {...sd(6)}>
        <StreakHeatmap />
      </motion.div>

      {/* ── Errungenschaften ── */}
      <motion.div className="mt-5" {...sd(7)}>
        <h3 className="font-display text-sm text-gray-400 mb-3 uppercase tracking-wider">{t('profile.achievements')}</h3>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENT_DEFS.map((ach) => {
            const unlocked = ach.unlocked(level, streak, totalSessions)
            return (
              <div
                key={ach.id}
                className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3"
                style={{ opacity: unlocked ? 1 : 0.38 }}
              >
                <span className="text-2xl">{ach.icon}</span>
                <div className="flex-1">
                  <p className="font-body font-semibold text-white text-sm">{t(ach.labelKey)}</p>
                  <p className="font-body text-xs text-gray-400">{t(ach.descKey)}</p>
                </div>
                {unlocked && (
                  <span className="text-xs font-body px-2 py-0.5 rounded-full" style={{ background: '#00C89620', color: '#00C896' }}>✓</span>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Liga-Card ── */}
      <motion.div
        className="mt-5 bg-dark-card rounded-2xl p-4 flex items-center gap-3"
        style={{ border: `2px solid ${userTier.color}` }}
        {...sd(7)}
      >
        <span className="text-4xl" style={{ filter: `drop-shadow(0 0 12px ${userTier.color})` }}>
          {userTier.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg" style={{ color: userTier.color }}>{userTier.label}</p>
          <p className="font-body text-xs text-gray-400">{t('profile.xp_this_week', { xp: userWeeklyXP })}</p>
        </div>
        <motion.button
          onClick={() => navigate('/league')}
          className="font-body font-semibold text-white rounded-xl px-4 py-3 min-h-[44px] cursor-pointer border-none text-sm"
          style={{ background: userTier.color + '33', color: userTier.color }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        >
          {t('profile.to_league')}
        </motion.button>
      </motion.div>

      {/* ── Gelernte Themen (nur eingeloggt) ── */}
      {user && (
        <motion.div className="mt-5" {...sd(8)}>
          <h3 className="font-display text-sm text-gray-400 mb-3 uppercase tracking-wider">
            {t('profile.topics_title')}
          </h3>

          {topicsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="bg-dark-card rounded-xl h-16 border border-dark-border animate-pulse" />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="font-body text-sm text-gray-500 text-center py-5">{t('profile.topics_empty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-body font-semibold text-white text-sm truncate">{topic.topic_name}</p>
                      <p className="font-body text-xs text-gray-500 mt-0.5">
                        {t('profile.topics_last', {
                          date: new Date(topic.last_studied_at).toLocaleDateString(),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm" style={{ color: '#00C896' }}>
                        {topic.mastery_percent}%
                      </span>
                      <button
                        type="button"
                        aria-label={t('profile.topics_delete_confirm')}
                        onClick={() => setDeletingTopic(topic.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent text-sm px-1"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  {/* Fortschrittsbalken */}
                  <div className="w-full rounded-full h-1.5 bg-dark">
                    <motion.div
                      className="h-1.5 rounded-full"
                      style={{ background: 'linear-gradient(90deg, #6C3CE1, #00C896)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.mastery_percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Meine Welten ── */}
      <motion.div className="mt-5" {...sd(9)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm text-gray-400 uppercase tracking-wider">{t('worlds.my_worlds')}</h3>
          {user && savedWorlds.length > 0 && (
            <span className="font-body text-xs text-gray-400">
              {savedWorlds.length >= MAX_WORLDS_FREE
                ? t('worlds.count', { count: savedWorlds.length, max: MAX_WORLDS_FREE })
                : t('worlds.count_unlimited', { count: savedWorlds.length })}
            </span>
          )}
        </div>

        {!user ? (
          <p className="font-body text-sm text-gray-500 text-center py-4">{t('worlds.login_hint')}</p>
        ) : worldsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="bg-dark-card rounded-xl h-14 border border-dark-border animate-pulse" />
            ))}
          </div>
        ) : savedWorlds.length === 0 ? (
          <p className="font-body text-sm text-gray-500 text-center py-4">{t('worlds.empty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {savedWorlds.length >= MAX_WORLDS_FREE && (
              <p className="font-body text-xs text-yellow-400/80 mb-1">
                ⚠ {t('worlds.limit_warning', { count: savedWorlds.length })}
              </p>
            )}
            {savedWorlds.map((world) => (
              <div
                key={world.id}
                className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-white text-sm truncate">{world.title}</p>
                  <p className="font-body text-xs text-gray-400 mt-0.5">
                    {t('worlds.questions', { count: Array.isArray(world.questions) ? world.questions.length : 0 })}
                    {' · '}
                    {t('worlds.created_at', { date: new Date(world.created_at).toLocaleDateString() })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteWorldId(world.id)}
                  className="font-body text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent px-2 py-1 rounded"
                  aria-label={t('worlds.delete')}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Einstellungen ── */}
      <motion.div className="mt-5" {...sd(10)}>
        <h3 className="font-display text-sm text-gray-400 mb-3 uppercase tracking-wider">{t('profile.settings')}</h3>

        <div className="flex flex-col gap-2">
          {/* Sound */}
          <div className="bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-white text-sm">{t('profile.sound')}</p>
              <p className="font-body text-xs text-gray-400 mt-0.5">{t('profile.sound_desc')}</p>
            </div>
            <SoundToggleSwitch />
          </div>

          {/* Sprache */}
          <div className="bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-white text-sm">
                {t('lang.de')} / {t('lang.en')}
              </p>
              <p className="font-body text-xs text-gray-400 mt-0.5">
                {i18n.language === 'de' ? t('lang.switch_to_en') : t('lang.switch_to_de')}
              </p>
            </div>
            <LanguageToggle />
          </div>

          {/* Dark Mode (immer an) */}
          <div className="bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-white text-sm">{t('profile.dark_mode')}</p>
              <p className="font-body text-xs text-gray-400 mt-0.5">{t('profile.dark_mode_desc')}</p>
            </div>
            <ToggleSwitch checked={true} onChange={() => {}} disabled />
          </div>

          {/* Benachrichtigungen */}
          {user && (
            <div className="bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-body font-semibold text-white text-sm">{t('profile.notifications')}</p>
                <p className="font-body text-xs text-gray-400 mt-0.5">{t('profile.notifications_desc')}</p>
              </div>
              <ToggleSwitch checked={notifications} onChange={handleNotifications} />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Neues Abenteuer ── */}
      <motion.button
        onClick={() => navigate('/onboarding')}
        className="mt-5 w-full font-body font-bold text-white rounded-2xl py-4 cursor-pointer border-none"
        style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '16px' }}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        {...sd(11)}
      >
        ✨ {t('profile.new_adventure')}
      </motion.button>

      {/* ── Gefahrenzone (nur eingeloggt) ── */}
      {user && (
        <motion.div className="mt-8" {...sd(12)}>
          <h3 className="font-display text-sm mb-3 uppercase tracking-wider" style={{ color: '#EF4444' }}>
            ⚠ {t('profile.danger_zone')}
          </h3>
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: '#EF444410', border: '1px solid #EF444430' }}
          >
            {/* Ausloggen */}
            <motion.button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                navigate('/', { replace: true })
              }}
              className="w-full font-body font-semibold text-sm rounded-xl py-3 cursor-pointer border transition-colors"
              style={{ background: 'transparent', borderColor: '#EF444450', color: '#EF4444' }}
              whileHover={{ background: '#EF444415' }} whileTap={{ scale: 0.97 }}
            >
              🚪 {t('profile.sign_out')}
            </motion.button>

            {/* Account löschen */}
            <motion.button
              type="button"
              onClick={() => setShowDeleteAccount(true)}
              className="w-full font-body font-semibold text-sm rounded-xl py-3 cursor-pointer border-none"
              style={{ background: '#EF4444', color: '#fff' }}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
            >
              🗑 {t('profile.delete_account')}
            </motion.button>
            <p className="font-body text-xs text-gray-500 text-center">{t('profile.delete_account_desc')}</p>
          </div>
        </motion.div>
      )}

      <Footer />

      {/* ── Dialoge ─────────────────────────────────────────────── */}

      {/* Thema löschen */}
      <AnimatePresence>
        {deletingTopic && (
          <ConfirmDialog
            title={t('profile.topics_delete_confirm')}
            onConfirm={() => void handleDeleteTopic(deletingTopic)}
            onCancel={() => setDeletingTopic(null)}
            confirmLabel="🗑 Löschen"
            danger
          />
        )}
      </AnimatePresence>

      {/* Welt löschen */}
      <AnimatePresence>
        {deleteWorldId && (
          <ConfirmDialog
            title={t('worlds.delete_title')}
            description={t('worlds.delete_desc')}
            onConfirm={() => void handleDeleteWorld()}
            onCancel={() => setDeleteWorldId(null)}
            confirmLabel={t('worlds.delete_confirm')}
            loading={deletingWorld}
            danger
          />
        )}
      </AnimatePresence>

      {/* Account löschen */}
      <AnimatePresence>
        {showDeleteAccount && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => !deletingAccount && setShowDeleteAccount(false)} />
            <motion.div
              className="relative bg-dark-card border rounded-2xl p-6 w-full flex flex-col gap-4"
              style={{ maxWidth: 400, borderColor: '#EF4444' }}
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            >
              <h3 className="font-display text-lg text-white">{t('profile.delete_confirm_title')}</h3>
              <p className="font-body text-sm text-gray-400">{t('profile.delete_confirm_desc')}</p>
              <div>
                <p className="font-body text-xs text-gray-500 mb-1.5">{t('profile.delete_confirm_hint')}</p>
                <input
                  type="text"
                  value={deleteWord}
                  onChange={(e) => setDeleteWord(e.target.value.toUpperCase())}
                  placeholder={t('profile.delete_confirm_word')}
                  className="w-full bg-dark border border-dark-border rounded-xl px-4 py-3 font-body text-white text-sm outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteAccount(false); setDeleteWord('') }}
                  disabled={deletingAccount}
                  className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border border-dark-border bg-transparent transition-colors disabled:opacity-40"
                >
                  {t('profile.cancel')}
                </button>
                <motion.button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteWord !== t('profile.delete_confirm_word') || deletingAccount}
                  className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#EF4444' }}
                  whileTap={!deletingAccount ? { scale: 0.97 } : {}}
                >
                  {deletingAccount && (
                    <motion.span
                      className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  {t('profile.delete_confirm_btn')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ── Wiederverwendbarer Bestätigungs-Dialog ────────────────────

function ConfirmDialog({
  title, description, onConfirm, onCancel, confirmLabel, loading = false, danger = false,
}: {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  loading?: boolean
  danger?: boolean
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onCancel()} />
      <motion.div
        className="relative bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 260 }}
      >
        <h3 className="font-display text-lg text-white">{title}</h3>
        {description && <p className="font-body text-sm text-gray-400">{description}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border border-dark-border bg-transparent disabled:opacity-40"
          >
            Abbrechen
          </button>
          <motion.button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: danger ? '#EF4444' : '#6C3CE1' }}
            whileTap={!loading ? { scale: 0.97 } : {}}
          >
            {loading && (
              <motion.span
                className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Sound-Toggle (lokale Komponente) ──────────────────────────

function SoundToggleSwitch() {
  const { t } = useTranslation()
  const [isEnabled, setIsEnabled] = React.useState(soundManager.isEnabled())
  const toggle = () => setIsEnabled(soundManager.toggle())
  return (
    <button
      type="button"
      role="switch"
      onClick={toggle}
      aria-checked={isEnabled}
      aria-label={t('profile.sound')}
      className="relative cursor-pointer border-none bg-transparent p-0"
    >
      <div
        className="w-12 h-6 rounded-full transition-colors duration-300"
        style={{ background: isEnabled ? '#00C896' : '#1A1A2E', border: '1px solid #2A2A4E' }}
      >
        <motion.div
          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
          animate={{ left: isEnabled ? '26px' : '2px' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        />
      </div>
    </button>
  )
}
