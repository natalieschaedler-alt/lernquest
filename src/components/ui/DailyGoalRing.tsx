/**
 * DailyGoalRing – Apple-Health-style zirkulärer Tagesziel-Ring.
 *
 * Tagesziel = Nutzer macht heute ≥1 Dungeon ODER ≥30 XP (je nach Modus).
 * Ring füllt sich während des Tages, wird golden beim Erreichen,
 * Konfetti-Animation bei 100 %.
 */
import { useMemo, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useGameStore, toLocalISODate } from '../../stores/gameStore'

const SIZE       = 120
const STROKE     = 10
const RADIUS     = (SIZE - STROKE) / 2
const CIRC       = 2 * Math.PI * RADIUS

interface Props {
  /** "dungeons" = 1 Dungeon pro Tag als Ziel, "xp" = 30 XP pro Tag. */
  mode?: 'dungeons' | 'xp'
  dailyXpGoal?: number
  dailyDungeonGoal?: number
  onGoalHit?: () => void
}

export default function DailyGoalRing({
  mode = 'dungeons',
  dailyXpGoal = 30,
  dailyDungeonGoal = 1,
  onGoalHit,
}: Props) {
  const { t } = useTranslation()
  const activityDays = useGameStore((s) => s.activityDays)
  const todayStr = toLocalISODate()
  const today    = activityDays[todayStr] ?? { d: 0, q: 0 }
  const [celebratedFor, setCelebratedFor] = useState<string | null>(null)

  const { progress, label, current, goal } = useMemo(() => {
    if (mode === 'xp') {
      // Approximation: each correct question ≈ 3-5 XP. Use questions*4 as XP proxy.
      const xpProxy = today.q * 4
      return {
        progress: Math.min(1, xpProxy / dailyXpGoal),
        current:  xpProxy,
        goal:     dailyXpGoal,
        label:    t('daily.xp_label', 'XP heute'),
      }
    }
    return {
      progress: Math.min(1, today.d / dailyDungeonGoal),
      current:  today.d,
      goal:     dailyDungeonGoal,
      label:    t('daily.dungeons_label', 'Dungeons heute'),
    }
  }, [mode, today.d, today.q, dailyXpGoal, dailyDungeonGoal, t])

  const isComplete = progress >= 1
  const color = isComplete ? '#FFD700' : '#6C3CE1'

  // Trigger onGoalHit once per day
  useEffect(() => {
    if (isComplete && celebratedFor !== todayStr) {
      setCelebratedFor(todayStr)
      onGoalHit?.()
    }
  }, [isComplete, todayStr, celebratedFor, onGoalHit])

  const dashOffset = CIRC * (1 - progress)

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
          />
          {/* Progress ring */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
            style={{
              transformOrigin: 'center',
              transform: 'rotate(-90deg)',
              filter: isComplete ? `drop-shadow(0 0 12px ${color})` : undefined,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            animate={{ scale: isComplete ? [1, 1.2, 1] : 1 }}
            transition={{ duration: 0.6, repeat: isComplete ? Infinity : 0, repeatDelay: 2 }}
            style={{ fontSize: 30, lineHeight: 1 }}
          >
            {isComplete ? '✨' : mode === 'xp' ? '⚡' : '🏰'}
          </motion.span>
          <p className="font-display text-white text-sm mt-1" style={{ color: isComplete ? color : undefined }}>
            {current}/{goal}
          </p>
        </div>
      </div>

      <div className="flex-1">
        <p className="font-body text-xs text-white/40 uppercase tracking-wider">{t('daily.title', 'Tagesziel')}</p>
        <p className="font-body text-white font-semibold mt-1">{label}</p>
        <p className="font-body text-xs mt-1" style={{ color: isComplete ? color : 'rgba(255,255,255,0.5)' }}>
          {isComplete
            ? t('daily.complete', '✓ Geschafft! Weiter so!')
            : t('daily.keep_going', 'Noch {{n}} bis zum Ziel', { n: goal - current })}
        </p>
      </div>
    </div>
  )
}
