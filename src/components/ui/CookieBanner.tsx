import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'cookie-consent'

export default function CookieBanner() {
  const { t } = useTranslation()
  // Lazy initializer reads localStorage once on mount — avoids synchronous setState in effect
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'accepted')

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50 bg-dark-card border-t border-dark-border px-6 py-4"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <p className="font-body text-white/70 text-sm">
                {t('cookie.text')}
              </p>
              <Link
                to="/datenschutz"
                className="font-body text-primary/70 hover:text-primary text-xs mt-1 inline-block"
              >
                {t('cookie.more')}
              </Link>
            </div>
            <button
              type="button"
              onClick={handleAccept}
              className="bg-primary hover:bg-primary/80 text-white font-body font-semibold text-sm px-5 py-2 rounded-full transition-colors whitespace-nowrap"
            >
              {t('cookie.accept')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
