import { useState } from 'react'
import { motion } from 'motion/react'
import { soundManager } from '../../utils/soundManager'

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(() => soundManager.isEnabled())

  return (
    <motion.button
      className="fixed top-4 right-4 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-dark-card border border-dark-border cursor-pointer"
      onClick={() => {
        const newState = soundManager.toggle()
        setEnabled(newState)
      }}
      whileTap={{ scale: 0.9 }}
      aria-label={enabled ? 'Mute sound' : 'Unmute sound'}
    >
      <span style={{ fontSize: '18px' }}>{enabled ? '🔊' : '🔇'}</span>
    </motion.button>
  )
}
