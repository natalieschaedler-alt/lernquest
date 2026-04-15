import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

const Confetti = lazy(() => import('react-confetti'))
import { useGameStore, ACHIEVEMENT_DEFS } from '../stores/gameStore'
import { getWorldById } from '../data/worlds'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { soundManager } from '../utils/soundManager'
import type { RewardResult, RewardTier, WorldTheme } from '../types'

function getRewardResult(worldTheme: WorldTheme): RewardResult {
  const roll = Math.random()
  const tier: RewardTier =
    roll < 0.02 ? 'legendary' : roll < 0.10 ? 'epic' : roll < 0.35 ? 'rare' : 'common'
  const xpMap: Record<RewardTier, number> = {
    common: 50, rare: 150, epic: 300, legendary: 500,
  }
  const colorMap: Record<RewardTier, string> = {
    common: '#00C896', rare: '#3B82F6', epic: '#A855F7', legendary: '#FFD700',
  }
  return { tier, itemName: worldTheme.loot[tier], color: colorMap[tier], xpBonus: xpMap[tier] }
}

export default function VictoryPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  const score = useGameStore((s) => s.score)
  const level = useGameStore((s) => s.level)
  const streak = useGameStore((s) => s.streak)
  const questions = useGameStore((s) => s.questions)
  const currentWorldId = useGameStore((s) => s.currentWorldId)
  const addXP = useGameStore((s) => s.addXP)
  const updateStreak = useGameStore((s) => s.updateStreak)
  const resetGame = useGameStore((s) => s.resetGame)
  const incrementSessions = useGameStore((s) => s.incrementSessions)
  const checkNewAchievements = useGameStore((s) => s.checkNewAchievements)
  const initDailyChallenge = useGameStore((s) => s.initDailyChallenge)
  const completeDailyChallenge = useGameStore((s) => s.completeDailyChallenge)
  const dailyChallenge = useGameStore((s) => s.dailyChallenge)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const worldTheme = getWorldById(selectedWorldId)

  const [showConfetti, setShowConfetti] = useState(true)
  const [boxOpened, setBoxOpened] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [leveledUp, setLeveledUp] = useState(false)
  const [newLevel, setNewLevel] = useState(level)

  const [rewardResult] = useState<RewardResult>(() => getRewardResult(worldTheme))
  const xpGain = useMemo(() => 50 + Math.floor(score / 10), [score])
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    soundManager.playVictory()
    updateStreak()
    incrementSessions()
    initDailyChallenge()

    const totalXP = xpGain + rewardResult.xpBonus
    const result = addXP(totalXP)
    if (result.leveledUp) {
      queueMicrotask(() => {
        setLeveledUp(true)
        setNewLevel(result.newLevel)
        setTimeout(() => soundManager.playLevelUp(), 600)
      })
    }

    // Check streak milestone and play sound
    const currentStreak = useGameStore.getState().streak
    if (currentStreak === 3 || currentStreak === 7 || currentStreak === 30) {
      setTimeout(() => soundManager.playStreak(), 1200)
    }

    // Notify newly unlocked achievements (check after XP/level update settles)
    queueMicrotask(() => {
      const newIds = checkNewAchievements()
      if (newIds.length > 0) {
        setTimeout(() => soundManager.playAchievement(), 800)
        newIds.forEach((id, idx) => {
          const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
          if (!def) return
          setTimeout(() => {
            toast(`${def.icon} ${t(def.labelKey)} – ${t(def.descKey)}`, {
              duration: 4000,
              style: {
                background: '#1E1E3F',
                color: '#fff',
                border: '1px solid #6C3CE1',
                fontSize: '14px',
              },
              icon: '🏆',
            })
          }, idx * 500)
        })
      }
    })

    // Mark win_session / no_gameover daily challenge complete
    const dc = dailyChallenge
    if (dc && !dc.completed && (dc.type === 'win_session' || dc.type === 'no_gameover')) {
      completeDailyChallenge()
      // Award bonus XP
      addXP(50)
      toast(t('challenge.bonus_xp'), {
        icon: '🎯',
        duration: 3000,
        style: { background: '#1E1E3F', color: '#FFD700', border: '1px solid #FFD700' },
      })
    }

    if (user) {
      void supabase.rpc('add_weekly_xp', { p_user_id: user.id, p_xp: totalXP })
      void supabase.rpc('update_streak', { p_user_id: user.id })
      const nonMemoryCount = questions.filter((q) => q.question_type !== 'memory').length
      void supabase.from('sessions').insert({
        user_id: user.id,
        world_id: currentWorldId?.startsWith('local-') ? null : currentWorldId,
        score,
        world_theme: selectedWorldId,
        boss_defeated: true,
        questions_correct: Math.round(score / 10),
        questions_total: Math.max(nonMemoryCount, 1),
      })
    } else {
      setTimeout(() => {
        toast(t('victory.guest_save_prompt'), { icon: '💾', duration: 5000 })
      }, 2000)
    }

    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [updateStreak, addXP, incrementSessions, xpGain, rewardResult.xpBonus, user, score, selectedWorldId, currentWorldId, questions, t, checkNewAchievements, initDailyChallenge, completeDailyChallenge, dailyChallenge])

  function handleOpenBox() {
    if (isOpening || boxOpened) return
    setIsOpening(true)
    setTimeout(() => setBoxOpened(true), 800)
  }

  const stagger = 0.15

  return (
    <main className="min-h-screen bg-dark text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {showConfetti && (
        <div aria-hidden="true">
          <Suspense fallback={null}><Confetti recycle={false} numberOfPieces={300} /></Suspense>
        </div>
      )}

      {/* Title */}
      <motion.h1
        className="font-display text-center"
        style={{ fontSize: '48px', color: '#FFD700' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, delay: stagger * 0 }}
      >
        {t('victory.title')}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-white text-center mt-2"
        style={{ fontSize: '20px' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 1 }}
      >
        {t('victory.subtitle')}
      </motion.p>

      {/* Score Card */}
      <motion.div
        className="bg-dark-card rounded-2xl p-6 mt-6 w-full text-center"
        style={{ maxWidth: '400px' }}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 2 }}
      >
        <p className="font-display text-white" style={{ fontSize: '24px' }}>
          {t('victory.score', { score })}
        </p>

        {/* XP Gain */}
        <motion.p
          className="mt-3"
          style={{ fontSize: '18px', color: '#00C896' }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: stagger * 3 }}
        >
          +{xpGain} XP
        </motion.p>

        {/* Streak display */}
        {streak > 1 && (
          <motion.p
            className="mt-2 text-sm font-body"
            style={{ color: '#FF9500' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: stagger * 3.5 }}
          >
            🔥 {t('victory_extra.streak_badge', { count: streak })}
          </motion.p>
        )}
      </motion.div>

      {/* Level Up */}
      {leveledUp && (
        <motion.div
          className="mt-4 font-display text-center"
          style={{ fontSize: '22px', color: '#FFD700' }}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ delay: stagger * 4, duration: 0.6 }}
        >
          {t('victory.level_up', { level: newLevel })}
        </motion.div>
      )}

      {/* Reward Chest */}
      <motion.div
        className="mt-6 flex flex-col items-center relative"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 5 }}
      >
        {!isOpening && !boxOpened && (
          <>
            <motion.button
              onClick={handleOpenBox}
              aria-label={t('victory.tap_to_open')}
              className="cursor-pointer border-none bg-transparent"
              style={{ fontSize: '64px', lineHeight: 1 }}
              animate={{ rotate: [-8, 8, -8] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
              whileTap={{ scale: 0.9 }}
            >
              📦
            </motion.button>
            <p className="text-gray-500 text-sm mt-2" aria-hidden="true">{t('victory.tap_to_open')}</p>
          </>
        )}

        {isOpening && !boxOpened && (
          <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${rewardResult.color} 0%, transparent 70%)`,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.span
              style={{ fontSize: '64px', lineHeight: 1 }}
              animate={{ scale: [1, 1.4, 0.9, 1] }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              📦
            </motion.span>
          </div>
        )}

        {boxOpened && (
          <motion.div
            className="text-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 8, stiffness: 150 }}
          >
            <p
              className="font-display"
              style={{ fontSize: '22px', color: rewardResult.color }}
            >
              {rewardResult.itemName}
            </p>
            <p
              className="font-body mt-2"
              style={{ fontSize: '16px', color: rewardResult.color }}
            >
              +{rewardResult.xpBonus} XP
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Buttons */}
      <motion.div
        className="flex flex-wrap justify-center gap-4 mt-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 6 }}
      >
        <motion.button
          onClick={() => {
            resetGame()
            navigate('/dungeon', { replace: true })
          }}
          className="font-body font-bold text-white cursor-pointer border-none whitespace-nowrap"
          style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 28px', borderRadius: '50px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('victory.play_again')}
        </motion.button>

        <motion.button
          onClick={() => {
            resetGame()
            navigate('/onboarding', { replace: true })
          }}
          className="font-body font-bold text-white cursor-pointer border border-dark-border whitespace-nowrap"
          style={{ fontSize: '16px', background: 'transparent', padding: '14px 28px', borderRadius: '50px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('victory.new_world')}
        </motion.button>
      </motion.div>

      {/* Quick navigation */}
      <motion.div
        className="flex gap-6 mt-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: stagger * 7 }}
      >
        <motion.button
          onClick={() => navigate('/profile')}
          className="font-body text-sm text-gray-400 cursor-pointer border-none bg-transparent hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          👤 {t('profile.title')}
        </motion.button>
        <motion.button
          onClick={() => navigate('/league')}
          className="font-body text-sm text-gray-400 cursor-pointer border-none bg-transparent hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🏆 {t('league.title')}
        </motion.button>
      </motion.div>
    </main>
  )
}
