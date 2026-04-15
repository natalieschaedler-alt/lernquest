import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useGameStore, ACHIEVEMENT_DEFS } from '../stores/gameStore'
import { useLeague } from '../hooks/useLeague'
import { useMistakesReview } from '../hooks/useMistakesReview'
import { useAuth } from '../hooks/useAuth'
import { getWorldById } from '../data/worlds'
import { soundManager } from '../utils/soundManager'
import { getUserWorlds, deleteWorld } from '../lib/database'
import LanguageToggle from '../components/ui/LanguageToggle'
import Footer from '../components/ui/Footer'

const MAX_WORLDS_FREE = 10

interface SavedWorld {
  id: string
  title: string
  created_at: string
  questions: unknown[]
}

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

function getLevelProgress(xp: number, level: number): { current: number; needed: number; percent: number } {
  const currentLevelXP = XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)] ?? 0
  const nextLevelXP = XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] ?? 6000
  const current = xp - currentLevelXP
  const needed = nextLevelXP - currentLevelXP
  const percent = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100
  return { current, needed, percent }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const playerName = useGameStore((s) => s.playerName)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const level = useGameStore((s) => s.level)
  const xp = useGameStore((s) => s.xp)
  const streak = useGameStore((s) => s.streak)
  const totalSessions = useGameStore((s) => s.totalSessions)
  const dailyChallenge = useGameStore((s) => s.dailyChallenge)
  const initDailyChallenge = useGameStore((s) => s.initDailyChallenge)

  const { userTier, userWeeklyXP } = useLeague()
  const { pendingCount } = useMistakesReview()
  const { user } = useAuth()

  const worldTheme = getWorldById(selectedWorldId)
  const { current, needed, percent } = getLevelProgress(xp, level)

  // Saved worlds state
  const [savedWorlds, setSavedWorlds] = useState<SavedWorld[]>([])
  const [worldsLoading, setWorldsLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Ensure daily challenge exists
  React.useEffect(() => {
    initDailyChallenge()
  }, [initDailyChallenge])

  // Load user's saved worlds
  const loadWorlds = useCallback(async () => {
    if (!user) return
    setWorldsLoading(true)
    try {
      const worlds = await getUserWorlds(user.id)
      setSavedWorlds(worlds as SavedWorld[])
    } finally {
      setWorldsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadWorlds()
  }, [loadWorlds])

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await deleteWorld(deleteConfirmId)
      setSavedWorlds((prev) => prev.filter((w) => w.id !== deleteConfirmId))
      setDeleteConfirmId(null)
    } catch {
      toast.error(t('worlds.delete_error'), { duration: 4000 })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-8" style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-dark-card border border-dark-border rounded-xl px-4 py-3 min-h-[44px] text-white text-sm font-body cursor-pointer"
        >
          ← {t('profile.back')}
        </button>
        <h1 className="font-display text-lg text-white">{t('profile.title')}</h1>
        <div style={{ width: '80px' }} />
      </div>

      {/* Character Card */}
      <motion.div
        className="bg-dark-card rounded-2xl p-6 border border-dark-border flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="text-7xl mb-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: `drop-shadow(0 0 20px ${worldTheme.primaryColor})` }}
        >
          {worldTheme.emoji}
        </motion.div>

        <h2 className="font-display text-2xl text-white">
          {playerName || t('profile.adventurer')}
        </h2>

        <div className="flex items-center gap-2 mt-1">
          <span
            className="font-body text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: worldTheme.primaryColor + '30', color: worldTheme.primaryColor }}
          >
            {worldTheme.name}
          </span>
          <span className="font-body text-xs text-gray-400">
            {t('profile.level', { level })}
          </span>
        </div>

        {/* XP Bar */}
        <div className="w-full mt-5">
          <div className="flex justify-between text-xs text-gray-400 font-body mb-1">
            <span>{xp} XP</span>
            <span>{level < 10 ? `${t('profile.next_level')}: ${current}/${needed} XP` : t('profile.max_level')}</span>
          </div>
          <div className="w-full rounded-full h-3 bg-dark">
            <motion.div
              className="h-3 rounded-full"
              style={{ background: `linear-gradient(90deg, ${worldTheme.primaryColor}, ${worldTheme.primaryColor}cc)` }}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-3 gap-3 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { icon: '🏆', label: t('profile.level_label'), value: String(level) },
          { icon: '🔥', label: t('profile.streak_label'), value: `${streak}d` },
          { icon: '🎮', label: t('profile.sessions'), value: String(totalSessions) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-dark-card rounded-2xl p-4 border border-dark-border flex flex-col items-center"
          >
            <span className="text-2xl">{stat.icon}</span>
            <span className="font-display text-xl text-white mt-1">{stat.value}</span>
            <span className="font-body text-xs text-gray-400 mt-0.5">{stat.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Daily Challenge */}
      {dailyChallenge && (
        <motion.div
          className="mt-4 w-full flex items-center gap-3 rounded-2xl px-5 py-4 border border-dark-border bg-dark-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.13 }}
        >
          <span className="text-2xl">{dailyChallenge.completed ? '✅' : '🎯'}</span>
          <div className="flex-1">
            <p className="font-body font-bold text-white text-sm">
              {t('profile.daily_challenge')}
              {dailyChallenge.completed && (
                <span className="ml-2 text-xs text-secondary">{t('profile.challenge_done')}</span>
              )}
            </p>
            <p className="font-body text-xs text-gray-400">{t(dailyChallenge.descKey)}</p>
          </div>
          {!dailyChallenge.completed && (
            <span className="text-xs font-body px-2 py-1 rounded-full bg-primary/10 text-primary/80 whitespace-nowrap">
              {t('challenge.bonus_xp')}
            </span>
          )}
        </motion.div>
      )}

      {/* Spaced Repetition Review Badge */}
      {pendingCount > 0 && (
        <motion.button
          onClick={() => navigate('/onboarding')}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl px-5 py-4 border-none cursor-pointer bg-streak/10 border-2 border-streak"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-2xl">🔁</span>
          <div className="flex-1 text-left">
            <p className="font-body font-bold text-white text-sm">
              {t(pendingCount === 1 ? 'profile.review_badge_title_one' : 'profile.review_badge_title_other', { count: pendingCount })}
            </p>
            <p className="font-body text-xs text-yellow-300/80">{t('profile.review_badge_sub')}</p>
          </div>
          <span className="font-display text-lg font-bold text-streak">
            {pendingCount}
          </span>
        </motion.button>
      )}

      {/* Achievements */}
      <motion.div
        className="mt-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h3 className="font-display text-base text-white mb-3">{t('profile.achievements')}</h3>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENT_DEFS.map((ach) => {
            const isUnlocked = ach.unlocked(level, streak, totalSessions)
            return (
              <div
                key={ach.id}
                className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3"
                style={{ opacity: isUnlocked ? 1 : 0.4 }}
              >
                <span className="text-2xl">{ach.icon}</span>
                <div className="flex-1">
                  <p className="font-body font-semibold text-white text-sm">{t(ach.labelKey)}</p>
                  <p className="font-body text-xs text-gray-400">{t(ach.descKey)}</p>
                </div>
                {isUnlocked && (
                  <span className="text-xs font-body px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Sound Toggle */}
      <motion.div
        className="mt-5 bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div>
          <p className="font-body font-semibold text-white text-sm">{t('profile.sound')}</p>
          <p className="font-body text-xs text-gray-400 mt-0.5">{t('profile.sound_desc')}</p>
        </div>
        <SoundToggleSwitch />
      </motion.div>

      {/* Language Toggle */}
      <motion.div
        className="mt-3 bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
      >
        <div>
          <p className="font-body font-semibold text-white text-sm">{t('lang.de')} / {t('lang.en')}</p>
          <p className="font-body text-xs text-gray-400 mt-0.5">
            {i18n.language === 'de' ? t('lang.switch_to_en') : t('lang.switch_to_de')}
          </p>
        </div>
        <LanguageToggle />
      </motion.div>

      {/* Liga Card */}
      <motion.div
        className="mt-5 bg-dark-card rounded-2xl p-4 flex items-center gap-3"
        style={{ border: `2px solid ${userTier.color}` }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <span className="text-4xl" style={{ filter: `drop-shadow(0 0 12px ${userTier.color})` }}>
          {userTier.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg" style={{ color: userTier.color }}>
            {userTier.label}
          </p>
          <p className="font-body text-xs text-gray-400">
            {t('profile.xp_this_week', { xp: userWeeklyXP })}
          </p>
        </div>
        <motion.button
          onClick={() => navigate('/league')}
          className="font-body font-semibold text-white rounded-xl px-4 py-3 min-h-[44px] cursor-pointer border-none text-sm"
          style={{ background: userTier.color + '33', color: userTier.color }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('profile.to_league')}
        </motion.button>
      </motion.div>

      {/* My Worlds Section */}
      <motion.div
        className="mt-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.38 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base text-white">{t('worlds.my_worlds')}</h3>
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
              <div key={i} className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 rounded-full bg-dark-border animate-pulse w-2/3" />
                  <div className="h-2.5 rounded-full bg-dark-border animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : savedWorlds.length === 0 ? (
          <p className="font-body text-sm text-gray-500 text-center py-4">{t('worlds.empty')}</p>
        ) : (
          <>
            {savedWorlds.length >= MAX_WORLDS_FREE && (
              <p className="font-body text-xs text-yellow-400/80 mb-2">
                ⚠ {t('worlds.limit_warning', { count: savedWorlds.length })}
              </p>
            )}
            <div className="flex flex-col gap-2">
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
                    onClick={() => setDeleteConfirmId(world.id)}
                    className="font-body text-xs text-red-400/70 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent px-2 py-1 rounded"
                    aria-label={t('worlds.delete')}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => !deleting && setDeleteConfirmId(null)}
            />
            <motion.div
              className="relative bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            >
              <h3 className="font-display text-lg text-white">{t('worlds.delete_title')}</h3>
              <p className="font-body text-sm text-gray-400">{t('worlds.delete_desc')}</p>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleting}
                  className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border border-dark-border bg-transparent hover:bg-dark transition-colors disabled:opacity-40"
                >
                  {t('worlds.delete_cancel')}
                </button>
                <motion.button
                  type="button"
                  onClick={() => void handleDeleteConfirm()}
                  disabled={deleting}
                  className="flex-1 font-body font-semibold text-white rounded-xl py-3 cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#EF4444' }}
                  whileHover={!deleting ? { scale: 1.02 } : {}}
                  whileTap={!deleting ? { scale: 0.97 } : {}}
                >
                  {deleting && (
                    <motion.span
                      className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  {t('worlds.delete_confirm')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Adventure Button */}
      <motion.button
        onClick={() => navigate('/onboarding')}
        className="mt-5 w-full font-body font-bold text-white rounded-2xl py-4 cursor-pointer border-none"
        style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '16px' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        ✨ {t('profile.new_adventure')}
      </motion.button>

      <Footer />
    </main>
  )
}

function SoundToggleSwitch() {
  const { t } = useTranslation()
  const [isEnabled, setIsEnabled] = React.useState(soundManager.isEnabled())

  const toggle = () => {
    const newState = soundManager.toggle()
    setIsEnabled(newState)
  }

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
        className="w-12 h-6 rounded-full transition-all duration-300"
        style={{ background: isEnabled ? '#00C896' : '#1A1A2E' }}
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
