import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { getWorldById } from '../data/worlds'

interface Particle {
  left: number
  top: number
  duration: number
  delay: number
  fontSize: number
}

export default function WorldBackground() {
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const totalSessions = useGameStore((s) => s.totalSessions)
  void totalSessions

  const worldTheme = getWorldById(selectedWorldId)

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 10 }, () => ({
        left:     5 + Math.random() * 85,
        top:      5 + Math.random() * 85,
        duration: 3 + Math.random() * 4,
        delay:    Math.random() * 4,
        fontSize: 12 + Math.random() * 8,
      })),
    [selectedWorldId]
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        background: `linear-gradient(180deg, ${worldTheme.bgFrom}, ${worldTheme.bgTo})`,
      }}
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: `${p.fontSize}px`,
          }}
          animate={{ y: [-15, 15, -15], opacity: [0.15, 0.5, 0.15] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {worldTheme.particleEmoji}
        </motion.div>
      ))}
    </div>
  )
}
