import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { soundManager } from '../../utils/soundManager'

interface LevelUpOverlayProps {
  level: number
  onComplete: () => void
}

export default function LevelUpOverlay({ level, onComplete }: LevelUpOverlayProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: (i / 10) * 360,
        distance: 80 + Math.random() * 60,
        size: 8 + Math.random() * 12,
        delay: Math.random() * 0.3,
      })),
    [],
  )

  useEffect(() => {
    soundManager.playLevelUp()
    const timer = setTimeout(onComplete, 2500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Star explosion */}
      {stars.map((star) => {
        const rad = (star.angle * Math.PI) / 180
        const tx = Math.cos(rad) * star.distance
        const ty = Math.sin(rad) * star.distance
        return (
          <motion.span
            key={star.id}
            className="absolute text-yellow-300"
            style={{ fontSize: star.size }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{ x: tx, y: ty, opacity: 0, scale: 1.5 }}
            transition={{ duration: 1, delay: star.delay, ease: 'easeOut' }}
          >
            ✦
          </motion.span>
        )
      })}

      {/* Main content */}
      <motion.div
        className="text-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.1, 1], opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.p
          className="font-display"
          style={{ fontSize: '52px', color: '#FFD700' }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          ⭐ LEVEL UP!
        </motion.p>
        <motion.p
          className="font-display text-white mt-2"
          style={{ fontSize: '36px' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Level {level}
        </motion.p>
        <motion.p
          className="mt-4"
          style={{ fontSize: '20px', color: '#00C896' }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: -30, opacity: 0 }}
          transition={{ delay: 0.5, duration: 1.5, ease: 'easeOut' }}
        >
          +XP
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
