/**
 * StreakCounter – Feuer-Icon + Streak-Zahl für den Dashboard-Header.
 *
 * Zustände:
 *  normal   – 🔥 + Zahl in Orange
 *  danger   – gelb blinkend (nach 18 Uhr ohne heutiges Play)
 *  freeze   – ❄️ Eis-Overlay über dem Feuer (Freeze wurde auto-genutzt)
 *  zero     – gedimmtes Icon (noch kein Streak)
 */
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useStreak } from '../../hooks/useStreak'

export default function StreakCounter() {
  const { t } = useTranslation()
  const { streak, freezeCount, isDangerHour, freezeJustUsed, clearFreezeJustUsed } = useStreak()

  // Clear the "freeze just used" flag once we've shown the animation
  useEffect(() => {
    if (freezeJustUsed) {
      const id = setTimeout(clearFreezeJustUsed, 3000)
      return () => clearTimeout(id)
    }
  }, [freezeJustUsed, clearFreezeJustUsed])

  const isEmpty  = streak === 0
  const showIce  = freezeJustUsed

  return (
    <motion.div
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body font-bold text-sm select-none"
      style={{
        background: isDangerHour
          ? 'rgba(234,179,8,0.15)'
          : isEmpty
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(255,107,53,0.15)',
        border: isDangerHour
          ? '1px solid rgba(234,179,8,0.5)'
          : isEmpty
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(255,107,53,0.4)',
        color: isDangerHour ? '#EAB308' : isEmpty ? '#6b7280' : '#FF6B35',
      }}
      animate={isDangerHour ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
      transition={isDangerHour ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
      title={
        isDangerHour
          ? t('streak.danger_tooltip')
          : freezeCount > 0
          ? t('streak.freeze_available', { count: freezeCount })
          : undefined
      }
    >
      {/* Fire + optional ice overlay */}
      <span className="relative" style={{ fontSize: '16px', lineHeight: 1 }}>
        🔥
        <AnimatePresence>
          {showIce && (
            <motion.span
              className="absolute inset-0 flex items-center justify-center"
              style={{ fontSize: '14px' }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              ❄️
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {/* Animated count */}
      <AnimatePresence mode="wait">
        <motion.span
          key={streak}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y:  8, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {streak}
        </motion.span>
      </AnimatePresence>

      {/* Freeze badge */}
      {freezeCount > 0 && streak > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold"
          style={{
            background: '#1E3A5F',
            border: '1px solid #3B82F6',
            fontSize: '9px',
            color: '#60A5FA',
          }}
        >
          {freezeCount}
        </span>
      )}
    </motion.div>
  )
}

/** Minimal inline version used inside the Dashboard nav. */
export function StreakChip() {
  const { streak, isDangerHour, freezeJustUsed } = useStreak()
  const showIce = freezeJustUsed

  if (streak === 0) return null

  return (
    <motion.div
      className="flex items-center gap-1 px-3 py-1.5 rounded-full font-body font-bold text-sm"
      style={{
        background: isDangerHour ? 'rgba(234,179,8,0.15)' : 'rgba(255,107,53,0.15)',
        border: `1px solid ${isDangerHour ? 'rgba(234,179,8,0.5)' : 'rgba(255,107,53,0.4)'}`,
        color: isDangerHour ? '#EAB308' : '#FF6B35',
      }}
      animate={isDangerHour ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
      transition={isDangerHour ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <span className="relative" style={{ lineHeight: 1 }}>
        🔥
        {showIce && <span className="absolute inset-0 text-xs">❄️</span>}
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={streak}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y:  6, opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {streak}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}

