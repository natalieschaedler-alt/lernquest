import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

export default function OfflinePage() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-6">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-6xl mb-6">📡</div>
        <h1 className="font-display text-white text-3xl mb-4">{t('offline.title')}</h1>
        <p className="font-body text-white/60 text-lg mb-8">
          {t('offline.desc')}
        </p>
        <motion.button
          type="button"
          onClick={() => window.location.reload()}
          className="font-body font-bold text-white cursor-pointer border-none bg-primary px-8 py-3 rounded-full text-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('offline.retry')}
        </motion.button>
      </motion.div>
    </main>
  )
}
