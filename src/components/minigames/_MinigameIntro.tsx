/**
 * Shared intro screen for all minigames. Fades in, shows name + hint,
 * auto-dismisses after `durationMs` OR on button click.
 */
import { useEffect } from 'react'
import { motion } from 'motion/react'

interface Props {
  emoji: string
  title: string
  hint: string
  color: string
  durationMs?: number
  onDismiss: () => void
}

export default function MinigameIntro({ emoji, title, hint, color, durationMs = 2400, onDismiss }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(id)
  }, [onDismiss, durationMs])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-dark"
    >
      <motion.div
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1,   rotate: 0,   opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 140 }}
        style={{ fontSize: 72 }}
      >
        {emoji}
      </motion.div>

      <motion.h2
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="font-display mt-4 text-center px-6"
        style={{ fontSize: 28, color, textShadow: `0 0 24px ${color}55` }}
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="font-body text-white/60 text-sm mt-3 text-center px-8 max-w-md"
      >
        {hint}
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={onDismiss}
        className="font-body font-semibold text-white rounded-full px-8 py-3 mt-8 cursor-pointer border-none"
        style={{ background: color, fontSize: 15 }}
      >
        Los! →
      </motion.button>
    </motion.div>
  )
}
