/**
 * LevelUpOverlay – globaler Feier-Screen bei Level-Up.
 *
 * Zeigt 3 Sekunden lang: goldenen Pulsring, "LEVEL X!", neuen Titel,
 * Konfetti-Partikel. Danach automatisches Ausblenden.
 * Montiert in App.tsx; liest pendingLevelUp aus dem Store.
 */
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useGameStore, getLevelTitle } from '../../stores/gameStore'

const DISPLAY_MS = 3000

// ── Confetti particles ────────────────────────────────────────────────────────

const COLORS = ['#FFD700', '#FF6B35', '#6C3CE1', '#00C896', '#EC4899', '#3B82F6', '#F59E0B']

function Confetti() {
  return (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const angle  = (i / 24) * 360
        const r      = 120 + Math.random() * 80
        const dx     = Math.cos((angle * Math.PI) / 180) * r
        const dy     = Math.sin((angle * Math.PI) / 180) * r - 40
        const size   = 8 + Math.random() * 8
        const color  = COLORS[i % COLORS.length]
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm pointer-events-none"
            style={{
              width: size, height: size * 0.6,
              background: color,
              top: '40%', left: '50%',
              originX: '50%', originY: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: dx, y: dy, opacity: 0, rotate: angle * 2, scale: 0.3 }}
            transition={{ duration: 1.0 + Math.random() * 0.5, ease: 'easeOut', delay: 0.1 + i * 0.025 }}
          />
        )
      })}
    </>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export default function LevelUpOverlay() {
  const { t } = useTranslation()
  const pendingLevelUp  = useGameStore((s) => s.pendingLevelUp)
  const clearPending    = useGameStore((s) => s.clearPendingLevelUp)

  // Auto-dismiss after DISPLAY_MS
  useEffect(() => {
    if (!pendingLevelUp) return
    const id = setTimeout(clearPending, DISPLAY_MS)
    return () => clearTimeout(id)
  }, [pendingLevelUp, clearPending])

  const title = pendingLevelUp ? getLevelTitle(pendingLevelUp) : ''

  return (
    <AnimatePresence>
      {pendingLevelUp && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          {/* Dark vignette behind content */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Particle burst */}
          <div className="absolute inset-0 pointer-events-none">
            <Confetti />
          </div>

          {/* Pulsing golden ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 280, height: 280,
              border: '4px solid #FFD700',
              boxShadow: '0 0 80px #FFD70066, inset 0 0 40px #FFD70022',
            }}
            animate={{ scale: [0.6, 1.15, 1], opacity: [0, 1, 0.7] }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />

          {/* Content card */}
          <motion.div
            className="relative flex flex-col items-center gap-3 px-10 py-8 rounded-3xl text-center"
            style={{
              background:  'linear-gradient(160deg, #0a0a1e, #1a1a3f)',
              border:      '2px solid #FFD700',
              boxShadow:   '0 0 60px #FFD70055',
            }}
            initial={{ scale: 0.4, y: 40 }}
            animate={{ scale: 1,   y: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.1 }}
          >
            <motion.div
              style={{ fontSize: 56, lineHeight: 1 }}
              animate={{ rotate: [-10, 10, -5, 5, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              ⬆️
            </motion.div>

            <p className="font-body text-sm uppercase tracking-widest" style={{ color: '#FFD700' }}>
              {t('xp.level_up_label')}
            </p>

            <motion.p
              className="font-display"
              style={{ fontSize: 72, color: '#FFD700', lineHeight: 1, textShadow: '0 0 40px #FFD70099' }}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 0.25, duration: 0.5, type: 'spring', damping: 12 }}
            >
              {pendingLevelUp}
            </motion.p>

            <motion.p
              className="font-display text-white"
              style={{ fontSize: 24 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {title}
            </motion.p>

            <motion.p
              className="font-body text-sm text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {t('xp.level_up_hint')}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
