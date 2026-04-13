import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Confetti from 'react-confetti'
import { useGameStore } from '../stores/gameStore'
import { soundManager } from '../utils/soundManager'

type RewardTier = 'legendary' | 'epic' | 'rare' | 'common'

function getReward(): RewardTier {
  const roll = Math.random()
  if (roll < 0.02) return 'legendary'
  if (roll < 0.10) return 'epic'
  if (roll < 0.35) return 'rare'
  return 'common'
}

const REWARD_CONFIG: Record<RewardTier, { key: string; color: string }> = {
  legendary: { key: 'victory.reward_legendary', color: '#FFD700' },
  epic: { key: 'victory.reward_epic', color: '#A855F7' },
  rare: { key: 'victory.reward_rare', color: '#3B82F6' },
  common: { key: 'victory.reward_normal', color: '#00C896' },
}

export default function VictoryPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const score = useGameStore((s) => s.score)
  const level = useGameStore((s) => s.level)
  const addXP = useGameStore((s) => s.addXP)
  const updateStreak = useGameStore((s) => s.updateStreak)
  const resetGame = useGameStore((s) => s.resetGame)

  const [showConfetti, setShowConfetti] = useState(true)
  const [boxOpened, setBoxOpened] = useState(false)
  const [leveledUp, setLeveledUp] = useState(false)
  const [newLevel, setNewLevel] = useState(level)

  const reward = useMemo(() => getReward(), [])
  const xpGain = useMemo(() => 50 + Math.floor(score / 10), [score])
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    soundManager.playVictory()
    updateStreak()
    const result = addXP(xpGain)
    if (result.leveledUp) {
      setLeveledUp(true)
      setNewLevel(result.newLevel)
    }

    const timer = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(timer)
  }, [updateStreak, addXP, xpGain])

  const stagger = 0.15

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {showConfetti && <Confetti recycle={false} numberOfPieces={300} />}

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

      {/* Reward Box */}
      <motion.div
        className="mt-6 flex flex-col items-center"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 5 }}
      >
        {!boxOpened ? (
          <motion.button
            onClick={() => setBoxOpened(true)}
            className="cursor-pointer border-none bg-transparent"
            style={{ fontSize: '64px', lineHeight: 1 }}
            animate={{ rotate: [-10, 10, -10] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
            whileTap={{ scale: 0.9 }}
          >
            📦
          </motion.button>
        ) : (
          <motion.div
            className="text-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 8, stiffness: 150 }}
          >
            <p
              className="font-display"
              style={{ fontSize: '20px', color: REWARD_CONFIG[reward].color }}
            >
              {t(REWARD_CONFIG[reward].key)}
            </p>
          </motion.div>
        )}
        {!boxOpened && (
          <p className="text-gray-500 text-sm mt-2">{t('victory.tap_to_open')}</p>
        )}
      </motion.div>

      {/* Buttons */}
      <motion.div
        className="flex gap-4 mt-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 6 }}
      >
        <motion.button
          onClick={() => {
            resetGame()
            navigate('/dungeon', { replace: true })
          }}
          className="font-body font-bold text-white cursor-pointer border-none"
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
          className="font-body font-bold text-white cursor-pointer border border-dark-border"
          style={{ fontSize: '16px', background: 'transparent', padding: '14px 28px', borderRadius: '50px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('victory.new_world')}
        </motion.button>
      </motion.div>
    </div>
  )
}
