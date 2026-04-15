import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-6">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="text-8xl mb-6 select-none"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
        >
          🗺️
        </motion.div>
        <h1 className="font-display text-white text-4xl mb-3">
          {t('notfound.title')}
        </h1>
        <p className="font-body text-white/60 text-lg mb-8">
          {t('notfound.desc')}
        </p>
        <motion.button
          type="button"
          onClick={() => navigate('/')}
          className="font-body font-bold text-white cursor-pointer border-none bg-primary px-8 py-3 rounded-full text-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('notfound.home')}
        </motion.button>
      </motion.div>
    </div>
  )
}
