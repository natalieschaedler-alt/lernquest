/**
 * Shared result screen for all minigames: stars (1–3), score, stats,
 * "Weiter" button. Parent calls onContinue with the final score to
 * add to total.
 */
import { motion } from 'motion/react'

export interface MinigameResult {
  score:          number
  correctAnswers: number
  totalQuestions: number
  timeSpent:      number  // seconds
  stars:          1 | 2 | 3
  extra?:         string  // optional custom line (e.g. "5 Gegner vernichtet")
}

interface Props {
  emoji: string
  title: string
  result: MinigameResult
  color: string
  onContinue: () => void
}

const STAR_ON  = '#FFD700'
const STAR_OFF = '#333'

export default function MinigameResultScreen({ emoji, title, result, color, onContinue }: Props) {
  const stars = result.stars
  const won   = stars >= 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-dark px-6"
    >
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: [0.5, 1.15, 1] }}
        transition={{ duration: 0.6 }}
        style={{ fontSize: 64 }}
      >
        {won ? emoji : '💀'}
      </motion.div>

      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="font-display mt-3 text-center"
        style={{ fontSize: 26, color: won ? color : '#888' }}
      >
        {won ? title : 'Überrannt!'}
      </motion.h2>

      {/* Stars */}
      <div className="flex gap-2 mt-6" aria-label={`${stars} von 3 Sternen`}>
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: stars >= i ? 1 : 0.8, rotate: 0 }}
            transition={{ delay: 0.4 + i * 0.18, type: 'spring', damping: 10 }}
            style={{ fontSize: 44, color: stars >= i ? STAR_ON : STAR_OFF, filter: stars >= i ? `drop-shadow(0 0 10px ${STAR_ON}cc)` : 'none' }}
          >
            ★
          </motion.div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mt-8 font-body text-white/80 text-center">
        <div>
          <p className="text-2xl font-display" style={{ color: STAR_ON }}>{result.score}</p>
          <p className="text-xs text-white/40 uppercase mt-1">Punkte</p>
        </div>
        <div>
          <p className="text-2xl font-display text-white">
            {result.correctAnswers}/{result.totalQuestions}
          </p>
          <p className="text-xs text-white/40 uppercase mt-1">Richtig</p>
        </div>
        <div>
          <p className="text-2xl font-display text-white">{result.timeSpent}s</p>
          <p className="text-xs text-white/40 uppercase mt-1">Dauer</p>
        </div>
      </div>

      {result.extra && (
        <p className="font-body text-sm text-white/60 mt-4 text-center">{result.extra}</p>
      )}

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={onContinue}
        className="font-body font-bold text-white rounded-full px-10 py-3 mt-10 cursor-pointer border-none"
        style={{ background: color, fontSize: 16 }}
      >
        Weiter →
      </motion.button>
    </motion.div>
  )
}
