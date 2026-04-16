/**
 * StreakMilestoneModal – Feier-Popup wenn ein Streak-Meilenstein erreicht wird.
 *
 * Meilensteine: 7 · 14 · 30 · 50 · 100 · 365 Tage
 * Wird global in App.tsx gemountet und liest pendingMilestone aus dem Store.
 */
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useStreak, MILESTONE_XP } from '../../hooks/useStreak'
import type { StreakMilestone } from '../../stores/gameStore'

// ── Milestone config ──────────────────────────────────────────────────────────

interface MilestoneConfig {
  emoji: string
  titleKey: string
  descKey: string
  color: string
}

const MILESTONE_CONFIG: Record<StreakMilestone, MilestoneConfig> = {
  7: {
    emoji: '🔥',
    titleKey: 'streak.milestone_7_title',
    descKey:  'streak.milestone_7_desc',
    color:    '#FF6B35',
  },
  14: {
    emoji: '⭐',
    titleKey: 'streak.milestone_14_title',
    descKey:  'streak.milestone_14_desc',
    color:    '#F59E0B',
  },
  30: {
    emoji: '🌟',
    titleKey: 'streak.milestone_30_title',
    descKey:  'streak.milestone_30_desc',
    color:    '#6C3CE1',
  },
  50: {
    emoji: '💫',
    titleKey: 'streak.milestone_50_title',
    descKey:  'streak.milestone_50_desc',
    color:    '#00C896',
  },
  100: {
    emoji: '👑',
    titleKey: 'streak.milestone_100_title',
    descKey:  'streak.milestone_100_desc',
    color:    '#FFD700',
  },
  365: {
    emoji: '🎉',
    titleKey: 'streak.milestone_365_title',
    descKey:  'streak.milestone_365_desc',
    color:    '#EC4899',
  },
}

// ── Particle burst ────────────────────────────────────────────────────────────

const PARTICLE_COLORS = ['#FF6B35', '#FFD700', '#6C3CE1', '#00C896', '#EC4899', '#3B82F6']

function Particles({ color }: { color: string }) {
  return (
    <>
      {Array.from({ length: 20 }, (_, i) => {
        const angle  = (i / 20) * 360
        const radius = 90 + Math.random() * 60
        const dx = Math.cos((angle * Math.PI) / 180) * radius
        const dy = Math.sin((angle * Math.PI) / 180) * radius
        const particleColor = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
        return (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width:  6 + Math.random() * 6,
              height: 6 + Math.random() * 6,
              background: particleColor,
              top: '50%',
              left: '50%',
              originX: '50%',
              originY: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.8 + Math.random() * 0.4, ease: 'easeOut', delay: 0.1 + i * 0.02 }}
          />
        )
      })}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StreakMilestoneModal() {
  const { t } = useTranslation()
  const { pendingMilestone, clearPendingMilestone } = useStreak()
  const hasShown = useRef<number | null>(null)

  // Auto-dismiss after 6 s
  useEffect(() => {
    if (!pendingMilestone || hasShown.current === pendingMilestone) return
    hasShown.current = pendingMilestone
    const id = setTimeout(clearPendingMilestone, 6000)
    return () => clearTimeout(id)
  }, [pendingMilestone, clearPendingMilestone])

  const config = pendingMilestone ? MILESTONE_CONFIG[pendingMilestone] : null
  const xpBonus = pendingMilestone ? (MILESTONE_XP[pendingMilestone] ?? 0) : 0

  return (
    <AnimatePresence>
      {pendingMilestone && config && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={clearPendingMilestone}
          />

          {/* Card */}
          <motion.div
            className="relative flex flex-col items-center gap-4 rounded-3xl p-8 text-center overflow-hidden"
            style={{
              background:   'linear-gradient(160deg, #0F0F2E, #1A1A3F)',
              border:       `2px solid ${config.color}`,
              boxShadow:    `0 0 60px ${config.color}44`,
              maxWidth:     360,
              width:        '100%',
            }}
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1,   y: 0,  opacity: 1 }}
            exit={{    scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 220 }}
          >
            {/* Particle burst */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <Particles color={config.color} />
            </div>

            {/* Big emoji */}
            <motion.div
              style={{ fontSize: 72, lineHeight: 1 }}
              animate={{ scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.7, delay: 0.25 }}
            >
              {config.emoji}
            </motion.div>

            {/* Streak badge */}
            <motion.div
              className="font-display"
              style={{
                fontSize:   '52px',
                color:      config.color,
                textShadow: `0 0 32px ${config.color}`,
                lineHeight: 1,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {pendingMilestone}
            </motion.div>

            <p className="font-body text-sm" style={{ color: config.color }}>
              {t('streak.milestone_days', { count: pendingMilestone })}
            </p>

            <motion.h2
              className="font-display text-white"
              style={{ fontSize: '22px' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              {t(config.titleKey)}
            </motion.h2>

            <p className="font-body text-sm text-gray-400">
              {t(config.descKey)}
            </p>

            {/* XP bonus */}
            <motion.div
              className="font-display rounded-2xl px-5 py-2.5"
              style={{
                background: `${config.color}20`,
                border:     `1px solid ${config.color}50`,
                color:      config.color,
                fontSize:   '20px',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              +{xpBonus} XP {t('streak.milestone_bonus_label')}
            </motion.div>

            {/* Dismiss */}
            <motion.button
              type="button"
              onClick={clearPendingMilestone}
              className="w-full font-body font-bold text-white rounded-2xl py-3.5 cursor-pointer border-none"
              style={{ background: config.color, fontSize: '16px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('streak.milestone_dismiss')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
