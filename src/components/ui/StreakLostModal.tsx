/**
 * StreakLostModal – Ermutigender Screen wenn ein Streak unterbrochen wurde.
 *
 * Zeigt den alten Rekord und einen motivierenden CTA.
 * Wird global in App.tsx gemountet und liest streakLostPending aus dem Store.
 */
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useStreak } from '../../hooks/useStreak'

export default function StreakLostModal() {
  const { t } = useTranslation()
  const { streakLostPending, previousStreak, clearStreakLostPending } = useStreak()

  return (
    <AnimatePresence>
      {streakLostPending && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/75" onClick={clearStreakLostPending} />

          {/* Card */}
          <motion.div
            className="relative flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
            style={{
              background: 'linear-gradient(160deg, #0F0F2E, #1A1A3F)',
              border:     '2px solid #374151',
              maxWidth:   360,
              width:      '100%',
            }}
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1,   y: 0,  opacity: 1 }}
            exit={{    scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 240 }}
          >
            {/* Broken fire emoji */}
            <motion.div
              style={{ fontSize: 64, lineHeight: 1 }}
              animate={{ rotate: [0, -10, 10, -5, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              🫧
            </motion.div>

            <motion.h2
              className="font-display text-white"
              style={{ fontSize: '22px' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {t('streak.lost_title')}
            </motion.h2>

            <p className="font-body text-gray-300" style={{ fontSize: '15px' }}>
              {t('streak.lost_message')}
            </p>

            {/* Record badge */}
            {previousStreak > 1 && (
              <motion.div
                className="flex items-center gap-2 rounded-2xl px-5 py-3"
                style={{
                  background: 'rgba(255,107,53,0.1)',
                  border:     '1px solid rgba(255,107,53,0.3)',
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.45, type: 'spring', damping: 14 }}
              >
                <span style={{ fontSize: 24 }}>🏆</span>
                <div className="text-left">
                  <p className="font-body text-xs text-gray-400">{t('streak.lost_record_label')}</p>
                  <p className="font-display text-lg" style={{ color: '#FF6B35' }}>
                    {t('streak.lost_record', { days: previousStreak })}
                  </p>
                </div>
              </motion.div>
            )}

            <p className="font-body text-sm text-gray-500">
              {t('streak.lost_hint')}
            </p>

            {/* CTA */}
            <motion.button
              type="button"
              onClick={clearStreakLostPending}
              className="w-full font-body font-bold text-white rounded-2xl py-3.5 cursor-pointer border-none"
              style={{
                background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)',
                fontSize:   '16px',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              🔥 {t('streak.lost_cta')}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
