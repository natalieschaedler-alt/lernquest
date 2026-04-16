/**
 * DashboardPage – Lern-Dashboard für eingeloggte User (/dashboard)
 *
 * Sektionen:
 *  1. Begrüßungs-Header mit Streak-Chip und Nav-Icons
 *  2. Quick-Play-Card (aktive Session oder neues Abenteuer)
 *  3. Wiederholungsvorschläge (Themen > 2 Tage alt)
 *  4. Meine-Themen-Grid (2-spaltig) + Leerer Zustand
 *  5. Wochenfortschritt (Balkendiagramm + Zielbalken)
 *  6. Aktivitätsfeed (letzte 5 Sessions)
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useProgress } from '../hooks/useProgress'
import { useGameStore } from '../stores/gameStore'
import { useLeague } from '../hooks/useLeague'
import { useSpacedRepetition } from '../hooks/useSpacedRepetition'
import { supabase } from '../lib/supabase'
import { easeToStrength } from '../lib/sm2'
import type { EaseStrength } from '../lib/sm2'
import { getStudentAssignments, joinClassByCode } from '../lib/teacherDb'
import type { StudentAssignment } from '../lib/teacherDb'
import { WORLDS } from '../data/worlds'
import type { Question } from '../types'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Footer from '../components/ui/Footer'
import { StreakChip } from '../components/ui/StreakCounter'
import XpBar from '../components/ui/XpBar'
import { useStreak } from '../hooks/useStreak'

// ── Konstanten ─────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6C3CE1', '#00C896', '#FF6B35', '#3B82F6',
  '#A855F7', '#F59E0B', '#EF4444', '#14B8A6',
]
const WEEKLY_GOAL = 5
const DAY_LABELS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const DAY_LABELS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Typen ──────────────────────────────────────────────────────

interface UserTopic {
  id: string
  topic_name: string
  mastery_percent: number
  last_studied_at: string
}

interface SessionRow {
  id: string
  world_theme: string | null
  boss_defeated: boolean | null
  questions_correct: number | null
  questions_total: number | null
  score: number
  completed_at: string
}

interface WorldRow {
  id: string
  title: string
  questions: unknown
}

interface WorldTitleRow {
  id: string
  title: string
}

// ── Hilfsfunktionen ────────────────────────────────────────────

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

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function getGreetingKey(hour: number): string {
  if (hour < 12) return 'dashboard.greeting_morning'
  if (hour < 18) return 'dashboard.greeting_afternoon'
  return 'dashboard.greeting_evening'
}

function getWorldEmoji(themeId: string | null): string {
  if (!themeId) return '🗺️'
  return WORLDS.find((w) => w.id === themeId)?.emoji ?? '🗺️'
}

function getWorldName(themeId: string | null): string {
  if (!themeId) return '—'
  return WORLDS.find((w) => w.id === themeId)?.name ?? themeId
}

/** Returns a count of sessions per day for the last 7 days (index 0 = 6 days ago, 6 = today). */
function sessionCountsByDay(sessions: SessionRow[]): number[] {
  const counts = new Array<number>(7).fill(0)
  const now = Date.now()
  for (const s of sessions) {
    const dAgo = Math.floor((now - new Date(s.completed_at).getTime()) / 86400000)
    if (dAgo < 7) counts[6 - dAgo]++
  }
  return counts
}

/** Last-7-day labels in current locale order. */
function last7DayLabels(lang: string): string[] {
  const labels = lang.startsWith('de') ? DAY_LABELS_DE : DAY_LABELS_EN
  const result: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    result.push(labels[d.getDay()])
  }
  return result
}

// ── Haupt-Komponente ──────────────────────────────────────────

export default function DashboardPage() {
  const navigate   = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { playerName, xp: _xp, level: _level, selectedWorldId } = useProgress()
  const { streak } = useStreak()
  const questions     = useGameStore((s) => s.questions)
  const setQuestions  = useGameStore((s) => s.setQuestions)
  const { userWeeklyXP } = useLeague()
  const { dueCount, worldSRSummary, startReviewSession } = useSpacedRepetition()

  const avatarColor = getAvatarColor(playerName)
  const hour = new Date().getHours()

  // ── State ──────────────────────────────────────────────────
  const [topics, setTopics]               = useState<UserTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [sessions, setSessions]           = useState<SessionRow[]>([])
  const [sessionsLoading, setSessLoading] = useState(false)
  const [loadingTopicId, setLoadingTopicId] = useState<string | null>(null)
  /** topic_name → EaseStrength, derived from SR summary + world titles */
  const [topicStrengths, setTopicStrengths] = useState<Record<string, EaseStrength>>({})
  const [reviewStarting, setReviewStarting] = useState(false)
  const [assignments, setAssignments]           = useState<StudentAssignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [joinCode, setJoinCode]                 = useState('')
  const [joining, setJoining]                   = useState(false)

  // ── Daten laden ────────────────────────────────────────────

  const loadTopics = useCallback(async () => {
    if (!user) return
    setTopicsLoading(true)
    const { data } = await supabase
      .from('user_topics')
      .select('id, topic_name, mastery_percent, last_studied_at')
      .eq('user_id', user.id)
      .order('last_studied_at', { ascending: false })
    setTopics((data ?? []) as UserTopic[])
    setTopicsLoading(false)
  }, [user])

  // Compute topic-level SR strength by matching world titles → topic names
  const loadTopicStrengths = useCallback(async () => {
    if (!user || Object.keys(worldSRSummary).length === 0) return
    const worldIds = Object.keys(worldSRSummary)
    const { data: worlds } = await supabase
      .from('worlds')
      .select('id, title')
      .in('id', worldIds)
    if (!worlds) return
    const map: Record<string, EaseStrength> = {}
    for (const w of worlds as WorldTitleRow[]) {
      const entry = worldSRSummary[w.id]
      if (entry) map[w.title] = easeToStrength(entry.avgEaseFactor)
    }
    setTopicStrengths(map)
  }, [user, worldSRSummary])

  const loadSessions = useCallback(async () => {
    if (!user) return
    setSessLoading(true)
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await supabase
      .from('sessions')
      .select('id, world_theme, boss_defeated, questions_correct, questions_total, score, completed_at')
      .eq('user_id', user.id)
      .gte('completed_at', since)
      .order('completed_at', { ascending: false })
      .limit(20)
    setSessions((data ?? []) as SessionRow[])
    setSessLoading(false)
  }, [user])

  const loadAssignments = useCallback(async () => {
    if (!user) return
    setAssignmentsLoading(true)
    const data = await getStudentAssignments(user.id)
    setAssignments(data)
    setAssignmentsLoading(false)
  }, [user])

  useEffect(() => {
    void loadTopics()
    void loadSessions()
    void loadAssignments()
  }, [loadTopics, loadSessions, loadAssignments])

  useEffect(() => {
    void loadTopicStrengths()
  }, [loadTopicStrengths])

  // Nicht-eingeloggte User → Login
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true })
  }, [authLoading, user, navigate])

  // ── Derived ────────────────────────────────────────────────

  // Wiederholungen: ≥ 2 Tage alt, nach Dringlichkeit sortiert
  const reviews = [...topics]
    .filter((tp) => daysSince(tp.last_studied_at) >= 2)
    .sort((a, b) => new Date(a.last_studied_at).getTime() - new Date(b.last_studied_at).getTime())
    .slice(0, 3)

  const weeklyDungeons   = sessions.length
  const dayCounts        = sessionCountsByDay(sessions)
  const maxDayCount      = Math.max(...dayCounts, 1)
  const dayLabels        = last7DayLabels(i18n.language)
  const recentActivity   = sessions.slice(0, 5)
  const hasActiveSession = questions.length > 0
  const goalProgress     = Math.min(weeklyDungeons / WEEKLY_GOAL, 1)

  // Returns SR strength for a topic via fuzzy title match
  function getTopicStrength(topicName: string): EaseStrength | null {
    const needle = topicName.toLowerCase()
    const key = Object.keys(topicStrengths).find(
      (k) => k.toLowerCase().includes(needle) || needle.includes(k.toLowerCase()),
    )
    return key ? topicStrengths[key] : null
  }

  // ── Topic-Tap: lade passendes Dungeon oder → Onboarding ────
  const handleTopicClick = useCallback(
    async (topic: UserTopic) => {
      if (!user) { navigate('/onboarding?new=1'); return }
      setLoadingTopicId(topic.id)

      // Suche gespeicherte Welt, deren Titel zum Thema passt
      const { data: worlds } = await supabase
        .from('worlds')
        .select('id, title, questions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      const needle = topic.topic_name.toLowerCase()
      const match = (worlds ?? []).find((w: WorldRow) =>
        w.title.toLowerCase().includes(needle) || needle.includes(w.title.toLowerCase())
      )

      setLoadingTopicId(null)

      if (match && Array.isArray(match.questions) && (match.questions as unknown[]).length > 0) {
        setQuestions(match.questions as Question[], selectedWorldId)
        navigate('/dungeon')
      } else {
        navigate('/onboarding?new=1')
      }
    },
    [user, navigate, selectedWorldId, setQuestions],
  )

  // ── Klasse beitreten ──────────────────────────────────────
  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    const result = await joinClassByCode(joinCode.trim())
    setJoining(false)
    if (result.ok) {
      toast.success(t('dashboard.join_class_success', { name: result.class_name ?? '' }))
      setJoinCode('')
      void loadAssignments()
    } else {
      const key = result.error === 'code_not_found'
        ? 'dashboard.join_class_not_found'
        : 'dashboard.join_class_error'
      toast.error(t(key))
    }
  }

  // ── Animations ────────────────────────────────────────────
  const sd = (i: number) => ({
    initial:    { opacity: 0, y: 20 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.07 },
  })

  // ── Loading / Redirect ────────────────────────────────────
  if (authLoading) return <LoadingSpinner />

  // ── Render ─────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-10"
      style={{ maxWidth: '480px', margin: '0 auto' }}
    >
      {/* ── Nav-Leiste ── */}
      <div className="flex items-center justify-between pt-6 pb-5">
        {/* Avatar + Name */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 border-none bg-transparent cursor-pointer p-0"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-white text-sm select-none"
            style={{
              background:  `linear-gradient(135deg, ${avatarColor}, ${avatarColor}bb)`,
              boxShadow:   `0 0 16px ${avatarColor}44`,
              flexShrink:  0,
            }}
          >
            {getInitials(playerName) || '?'}
          </div>
          <div className="text-left">
            <p className="font-body text-xs text-gray-400 leading-none">LearnQuest</p>
            <p className="font-display text-sm text-white leading-tight truncate max-w-[120px]">
              {playerName || t('profile.adventurer')}
            </p>
          </div>
        </button>

        {/* Streak-Chip + Liga-Button */}
        <div className="flex items-center gap-2">
          <StreakChip />
          <motion.button
            type="button"
            onClick={() => navigate('/league')}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-dark-border bg-dark-card cursor-pointer text-base"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            🏆
          </motion.button>
        </div>
      </div>

      {/* ── XP-Leiste ── */}
      <div className="pb-4">
        <XpBar compact />
      </div>

      {/* ── Begrüßung ── */}
      <motion.div {...sd(0)}>
        <h1 className="font-display text-2xl text-white leading-tight">
          {t(getGreetingKey(hour), { name: playerName || t('profile.adventurer') })}
        </h1>
        {streak > 0 && (
          <p className="font-body text-sm mt-1" style={{ color: '#FF9500' }}>
            {t('dashboard.streak_label', { count: streak })}
          </p>
        )}
      </motion.div>

      {/* ── Quick-Play ── */}
      <motion.button
        type="button"
        onClick={() => navigate(hasActiveSession ? '/dungeon' : '/onboarding?new=1')}
        className="mt-5 w-full rounded-2xl p-5 text-left cursor-pointer border-none flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, #6C3CE1cc, #3B82F6aa)',
          border:     '1px solid #6C3CE155',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        {...sd(1)}
      >
        <span className="text-4xl select-none">{hasActiveSession ? '⚔️' : '✨'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg text-white">
            {hasActiveSession ? t('dashboard.quickplay') : t('dashboard.quickplay_start')}
          </p>
          <p className="font-body text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {hasActiveSession ? t('dashboard.quickplay_subtitle') : t('dashboard.quickplay_start_subtitle')}
          </p>
        </div>
        <span className="text-white/50 text-xl select-none">→</span>
      </motion.button>

      {/* ── Wiederholungs-Quest (SM-2 due cards) ── */}
      {dueCount > 0 && (
        <motion.button
          type="button"
          onClick={async () => {
            setReviewStarting(true)
            await startReviewSession(navigate, setQuestions)
            setReviewStarting(false)
          }}
          disabled={reviewStarting}
          className="mt-5 w-full rounded-2xl p-5 text-left cursor-pointer border-none flex items-center gap-4 disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #1E1E3F, #2D1A4E)',
            border:     '1px solid #6C3CE155',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          {...sd(1.5)}
        >
          {reviewStarting ? (
            <motion.span
              className="text-3xl select-none inline-block"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            >
              🔄
            </motion.span>
          ) : (
            <span className="text-3xl select-none">🔄</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display text-base text-white">
              {t('sr.review_quest_title')}
            </p>
            <p className="font-body text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('sr.due_count', { count: dueCount })}
            </p>
          </div>
          <span className="text-white/50 text-xl select-none">→</span>
        </motion.button>
      )}

      {/* ── Lehrer-Aufgaben ── */}
      {!assignmentsLoading && assignments.length > 0 && (
        <motion.div className="mt-5" {...sd(2)}>
          <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.teacher_assignments_title')}
          </h2>
          <div className="flex flex-col gap-2">
            {assignments.map((a, idx) => {
              const isOverdue = a.deadline && new Date(a.deadline) < new Date()
              const deadlineLabel = a.deadline
                ? new Date(a.deadline).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
                : null
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  onClick={() => navigate('/onboarding?new=1')}
                  className="bg-dark-card border rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer text-left w-full"
                  style={{ borderColor: isOverdue ? '#FF6B3555' : '#6C3CE144' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.06 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-xl select-none">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-white text-sm truncate">{a.title}</p>
                    <p className="font-body text-xs text-gray-400 mt-0.5">
                      {a.class_name}
                      {deadlineLabel && (
                        <span style={{ color: isOverdue ? '#FF6B35' : '#9CA3AF' }}>
                          {' · '}{t('dashboard.assignment_due', { date: deadlineLabel })}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className="font-body text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: '#6C3CE130', color: '#9B5DE5' }}
                  >
                    {t('dashboard.assignment_start')}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Wiederholungen ── */}
      {reviews.length > 0 && (
        <motion.div className="mt-7" {...sd(2)}>
          <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.reviews_title')}
          </h2>
          <div className="flex flex-col gap-2">
            {reviews.map((tp, idx) => {
              const dAgo = daysSince(tp.last_studied_at)
              const urgent = dAgo >= 7
              return (
                <motion.button
                  key={tp.id}
                  type="button"
                  onClick={() => void handleTopicClick(tp)}
                  disabled={loadingTopicId === tp.id}
                  className="bg-dark-card border rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer text-left w-full disabled:opacity-60"
                  style={{ borderColor: urgent ? '#FF6B3555' : '#F59E0B44' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + idx * 0.06 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-xl select-none">{urgent ? '🔴' : '🟡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-white text-sm truncate">{tp.topic_name}</p>
                    <p className="font-body text-xs text-gray-400 mt-0.5">
                      {t(dAgo === 1 ? 'dashboard.review_days_ago_one' : 'dashboard.review_days_ago_other', { count: dAgo })}
                      {' · '}
                      {tp.mastery_percent}% {t('dashboard.mastery_short')}
                    </p>
                  </div>
                  {loadingTopicId === tp.id ? (
                    <motion.span
                      className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <span
                      className="font-body text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: '#6C3CE130', color: '#9B5DE5' }}
                    >
                      {t('dashboard.review_cta')}
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Meine Themen ── */}
      <motion.div className="mt-7" {...sd(3)}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider">
            {t('dashboard.topics_title')}
          </h2>
          <motion.button
            type="button"
            onClick={() => navigate('/onboarding?new=1')}
            className="font-body text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer border-none"
            style={{ background: '#6C3CE130', color: '#9B5DE5' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t('dashboard.topics_new')}
          </motion.button>
        </div>

        {topicsLoading ? (
          /* Skeleton */
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-dark-card rounded-2xl h-28 border border-dark-border animate-pulse" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          /* Leerer Zustand */
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="text-6xl select-none">🗺️</span>
            <div>
              <p className="font-display text-white text-xl">{t('dashboard.topics_empty_title')}</p>
              <p className="font-body text-sm text-gray-400 mt-1.5" style={{ maxWidth: 260, margin: '6px auto 0' }}>
                {t('dashboard.topics_empty_desc')}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={() => navigate('/onboarding?new=1')}
              className="font-body font-bold text-white rounded-2xl px-7 py-3.5 cursor-pointer border-none text-sm"
              style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)' }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('dashboard.topics_empty_cta')}
            </motion.button>
          </div>
        ) : (
          /* Themen-Grid */
          <div className="grid grid-cols-2 gap-2.5">
            {topics.map((tp, idx) => {
              const dAgo = daysSince(tp.last_studied_at)
              const timeLabel =
                dAgo === 0
                  ? t('dashboard.activity_today')
                  : dAgo === 1
                  ? t('dashboard.activity_yesterday')
                  : t('dashboard.review_days_ago_other', { count: dAgo })

              return (
                <motion.button
                  key={tp.id}
                  type="button"
                  onClick={() => void handleTopicClick(tp)}
                  disabled={loadingTopicId === tp.id}
                  className="bg-dark-card rounded-2xl p-4 border border-dark-border cursor-pointer text-left flex flex-col gap-2 disabled:opacity-60"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  whileHover={{ scale: 1.03, borderColor: '#6C3CE188' }}
                  whileTap={{ scale: 0.97 }}
                >
                  {loadingTopicId === tp.id ? (
                    <div className="flex items-center justify-center h-10">
                      <motion.span
                        className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-body font-semibold text-white text-sm leading-snug overflow-hidden flex-1"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {tp.topic_name}
                        </p>
                        {(() => {
                          const strength = getTopicStrength(tp.topic_name)
                          if (!strength) return null
                          const dot = strength === 'green' ? '🟢' : strength === 'yellow' ? '🟡' : '🔴'
                          return <span className="text-sm shrink-0 mt-0.5" title={t(`sr.strength_${strength}`)}>{dot}</span>
                        })()}
                      </div>

                      {/* Fortschrittsbalken */}
                      <div className="mt-auto w-full rounded-full h-1.5 bg-dark">
                        <motion.div
                          className="h-1.5 rounded-full"
                          style={{ background: 'linear-gradient(90deg, #6C3CE1, #00C896)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${tp.mastery_percent}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 + idx * 0.05 }}
                        />
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="font-body text-xs font-semibold" style={{ color: '#00C896' }}>
                          {tp.mastery_percent}%
                        </span>
                        <span className="font-body text-xs text-gray-500">{timeLabel}</span>
                      </div>
                    </>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* ── Wochenfortschritt ── */}
      {!sessionsLoading && (
        <motion.div className="mt-7" {...sd(4)}>
          <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.progress_title')}
          </h2>

          <div className="bg-dark-card rounded-2xl border border-dark-border p-5">
            {/* Zahlen-Row */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="font-display text-2xl text-white">{userWeeklyXP.toLocaleString()}</p>
                <p className="font-body text-xs text-gray-400 mt-0.5">{t('dashboard.progress_xp_label')}</p>
              </div>
              <div>
                <p className="font-display text-2xl text-white">{weeklyDungeons}</p>
                <p className="font-body text-xs text-gray-400 mt-0.5">{t('dashboard.progress_dungeons_label')}</p>
              </div>
            </div>

            {/* Balkendiagramm: Dungeons pro Tag */}
            <div className="flex items-end gap-1.5 h-14">
              {dayCounts.map((count, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className="w-full rounded-t-sm min-h-[3px]"
                    style={{
                      background: count > 0
                        ? 'linear-gradient(180deg, #6C3CE1, #9B5DE5)'
                        : '#1A1A2E',
                    }}
                    initial={{ height: 3 }}
                    animate={{ height: `${Math.max(3, (count / maxDayCount) * 44)}px` }}
                    transition={{ duration: 0.5, delay: idx * 0.05, ease: 'easeOut' }}
                  />
                  <span className="font-body text-gray-600 leading-none select-none" style={{ fontSize: '9px' }}>
                    {dayLabels[idx]}
                  </span>
                </div>
              ))}
            </div>

            {/* Wochenziel-Balken */}
            <div className="mt-4">
              <div className="flex justify-between font-body text-xs mb-1.5">
                <span style={{ color: goalProgress >= 1 ? '#00C896' : '#9CA3AF' }}>
                  {goalProgress >= 1
                    ? t('dashboard.progress_goal_reached')
                    : t('dashboard.progress_goal', { count: WEEKLY_GOAL })}
                </span>
                <span className="text-gray-400">
                  {Math.min(weeklyDungeons, WEEKLY_GOAL)}/{WEEKLY_GOAL}
                </span>
              </div>
              <div className="w-full rounded-full h-2 bg-dark">
                <motion.div
                  className="h-2 rounded-full"
                  style={{
                    background: goalProgress >= 1
                      ? '#00C896'
                      : 'linear-gradient(90deg, #6C3CE1, #9B5DE5)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalProgress * 100}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Aktivitätsfeed ── */}
      {!sessionsLoading && recentActivity.length > 0 && (
        <motion.div className="mt-7" {...sd(5)}>
          <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider mb-3">
            {t('dashboard.activity_title')}
          </h2>
          <div className="flex flex-col gap-2">
            {recentActivity.map((s) => {
              const dAgo = daysSince(s.completed_at)
              const timeLabel =
                dAgo === 0
                  ? t('dashboard.activity_today')
                  : dAgo === 1
                  ? t('dashboard.activity_yesterday')
                  : t('dashboard.activity_days_ago', { count: dAgo })

              const accuracy =
                s.questions_total && s.questions_total > 0
                  ? Math.round(((s.questions_correct ?? 0) / s.questions_total) * 100)
                  : null

              return (
                <div
                  key={s.id}
                  className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3"
                >
                  <span className="text-2xl select-none">{getWorldEmoji(s.world_theme)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-body font-semibold text-white text-sm truncate">
                        {getWorldName(s.world_theme)}
                      </p>
                      {s.boss_defeated && (
                        <span
                          className="font-body text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: '#00C89620', color: '#00C896' }}
                        >
                          ⚔️ Boss
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-gray-400 mt-0.5">
                      {timeLabel}
                      {accuracy !== null && ` · ${accuracy}% ${t('profile.accuracy').toLowerCase()}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-sm" style={{ color: '#F59E0B' }}>
                      {s.score.toLocaleString()}
                    </p>
                    <p className="font-body text-xs text-gray-500">Pts</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Leerer Aktivitäts-State (wenn Themen vorhanden, aber noch keine Sessions diese Woche) */}
      {!sessionsLoading && recentActivity.length === 0 && topics.length > 0 && (
        <motion.p
          className="mt-7 text-center font-body text-sm text-gray-500 py-4"
          {...sd(5)}
        >
          {t('dashboard.activity_empty')}
        </motion.p>
      )}

      {/* ── Klasse beitreten ── */}
      <motion.div className="mt-7" {...sd(6)}>
        <h2 className="font-display text-sm text-gray-400 uppercase tracking-wider mb-3">
          {t('dashboard.join_class_title')}
        </h2>
        <form
          onSubmit={(e) => void handleJoinClass(e)}
          className="bg-dark-card rounded-2xl border border-dark-border p-4 flex gap-2"
        >
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t('dashboard.join_class_placeholder')}
            maxLength={8}
            className="flex-1 font-body text-white rounded-xl px-3 py-2.5 outline-none bg-dark border border-dark-border focus:border-[#6C3CE1] text-sm transition-colors"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="font-body font-semibold text-white rounded-xl px-4 py-2.5 cursor-pointer border-none text-sm disabled:opacity-50 transition-opacity"
            style={{ background: '#6C3CE1' }}
          >
            {joining ? '…' : t('dashboard.join_class_btn')}
          </button>
        </form>
      </motion.div>

      <Footer />
    </main>
  )
}
