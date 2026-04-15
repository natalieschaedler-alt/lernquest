import { useState } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { soundManager } from '../../utils/soundManager'

export default function SoundToggle() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(() => soundManager.isEnabled())

  return (
    <motion.button
      className="fixed top-4 right-4 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-dark-card border border-dark-border cursor-pointer"
      onClick={() => {
        const newState = soundManager.toggle()
        setEnabled(newState)
      }}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      aria-label={enabled ? t('common.sound_mute') : t('common.sound_unmute')}
    >
      <span style={{ fontSize: '18px' }}>{enabled ? '🔊' : '🔇'}</span>
    </motion.button>
  )
}
