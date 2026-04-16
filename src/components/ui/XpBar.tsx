/**
 * XpBar – Wiederverwendbare XP-Fortschrittsleiste.
 *
 * Zeigt Level, Titel, XP-Zahl und einen smooth animierten Balken.
 * Wird in DashboardPage-Header und ProfilePage verwendet.
 *
 * Props:
 *   compact  – schmale Variante für Headers (kein Text unter dem Balken)
 *   animate  – Balken animiert von 0 auf aktuellen Wert (Default: true)
 */
import { motion } from 'motion/react'
import { useGameStore, getLevelTitle, getLevelProgress, MAX_LEVEL } from '../../stores/gameStore'

interface XpBarProps {
  compact?: boolean
}

export default function XpBar({ compact = false }: XpBarProps) {
  const xp    = useGameStore((s) => s.xp)
  const level = useGameStore((s) => s.level)

  const title  = getLevelTitle(level)
  const { current, needed, percent } = getLevelProgress(xp, level)
  const isMax = level >= MAX_LEVEL

  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1.5'} w-full`}>
      {/* Level + title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="font-display font-bold"
            style={{ fontSize: compact ? 11 : 13, color: '#9B5DE5' }}
          >
            Lv.{level}
          </span>
          {!compact && (
            <span className="font-body text-xs text-gray-400">{title}</span>
          )}
        </div>
        {!compact && !isMax && (
          <span className="font-body text-xs text-gray-500">
            {current}/{needed} XP
          </span>
        )}
        {isMax && !compact && (
          <span className="font-body text-xs" style={{ color: '#FFD700' }}>MAX</span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{
          height:     compact ? 4 : 7,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #6C3CE1, #9B5DE5, #00C896)' }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

/**
 * Flying XP text — shows "+N XP" floating upward from a given position.
 * Rendered at fixed position; parent must be relative.
 */
interface XpFloatProps {
  amount: number
  isGolden?: boolean
  isCrit?: boolean
  onDone?: () => void
}

export function XpFloat({ amount, isGolden, isCrit, onDone }: XpFloatProps) {
  const color = isGolden ? '#FFD700' : isCrit ? '#FF6B35' : '#00C896'
  const prefix = isGolden ? '✨' : isCrit ? '💥' : ''
  return (
    <motion.div
      className="fixed pointer-events-none font-display font-bold z-50 select-none"
      style={{
        left: 0, right: 0, bottom: '35%',
        textAlign: 'center',
        fontSize: isGolden ? 28 : isCrit ? 24 : 20,
        color,
        textShadow: `0 0 16px ${color}88`,
      }}
      initial={{ opacity: 0, y: 0, scale: 0.7 }}
      animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.7, 1.2, 1.1, 0.9] }}
      transition={{ duration: 1.4, times: [0, 0.1, 0.6, 1] }}
      onAnimationComplete={onDone}
    >
      {prefix} +{amount} XP
    </motion.div>
  )
}
