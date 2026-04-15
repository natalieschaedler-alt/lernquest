import { useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../stores/gameStore'
import InstallButton from '../components/ui/InstallButton'

interface StarData {
  id: number
  top: string
  left: string
  size: number
  duration: number
  delay: number
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: -50 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 18, stiffness: 120 } },
}

export default function StartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const streak = useGameStore((s) => s.streak)

  // useState lazy init: Math.random only called once, satisfies react-hooks/purity
  const [stars] = useState<StarData[]>(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 4 + 2,
      delay: Math.random() * 4,
    }))
  )

  return (
    <main className="relative min-h-screen bg-dark overflow-hidden flex items-center justify-center">
      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Nebula */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '10%',
            left: '15%',
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(108,60,225,0.15) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '40%',
            right: '10%',
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(30,100,255,0.12) 0%, transparent 70%)',
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: '15%',
            left: '30%',
            width: 350,
            height: 350,
            background: 'radial-gradient(circle, rgba(0,200,150,0.10) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} style={{ fontSize: '60px', lineHeight: 1 }}>
          🎮
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-display text-primary mt-2"
          style={{ fontSize: '52px', lineHeight: 1.1 }}
        >
          {t('app.name')}
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="font-body text-white mt-2"
          style={{ fontSize: '18px', opacity: 0.7 }}
        >
          {t('app.tagline')}
        </motion.p>

        <motion.div variants={itemVariants} style={{ height: '32px' }} />

        {streak > 0 && (
          <motion.div
            variants={itemVariants}
            className="mb-4 px-4 py-2 rounded-full bg-dark-card border border-dark-border font-body font-semibold text-white text-sm"
          >
            {t('start.streak', { days: streak })}
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <motion.button
            onClick={() => void navigate('/onboarding')}
            className="font-body font-bold text-white cursor-pointer border-none"
            style={{ fontSize: '18px', background: '#6C3CE1', padding: '16px 48px', borderRadius: '50px' }}
            animate={{
              boxShadow: [
                '0 0 30px rgba(108,60,225,0.5)',
                '0 0 50px rgba(108,60,225,0.8)',
                '0 0 30px rgba(108,60,225,0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.05, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
          >
            {t('start.begin')} →
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Install button */}
      <div className="absolute bottom-16 left-0 right-0 flex justify-center z-10">
        <InstallButton />
      </div>

      {/* Bottom text */}
      <p
        className="absolute bottom-6 left-0 right-0 text-center font-body text-sm"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        {t('start.footer')}
      </p>
    </main>
  )
}
