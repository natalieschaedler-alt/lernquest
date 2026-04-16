/**
 * MysteryBoxModal – tägliche Mystery-Box nach erstem App-Start des Tages.
 *
 * Liest pendingMysteryBoxXP aus dem Store. Klick auf Box öffnet sie,
 * zeigt den XP-Gewinn und vergibt die XP.
 * Montiert in App.tsx.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../stores/gameStore'

export default function MysteryBoxModal() {
  const { t } = useTranslation()
  const pendingMysteryBoxXP = useGameStore((s) => s.pendingMysteryBoxXP)
  const addXP               = useGameStore((s) => s.addXP)
  const [opened, setOpened] = useState(false)
  const [opening, setOpening] = useState(false)

  function handleOpen() {
    if (opening || opened || !pendingMysteryBoxXP) return
    setOpening(true)
    setTimeout(() => {
      setOpened(true)
      addXP(pendingMysteryBoxXP)
    }, 700)
  }

  function handleClose() {
    useGameStore.setState({ pendingMysteryBoxXP: null })
    setOpened(false)
    setOpening(false)
  }

  return (
    <AnimatePresence>
      {pendingMysteryBoxXP !== null && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center pb-12 px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/65" onClick={opened ? handleClose : undefined} />

          {/* Card */}
          <motion.div
            className="relative flex flex-col items-center gap-4 rounded-3xl p-7 text-center w-full"
            style={{
              background: 'linear-gradient(160deg, #0F0F2E, #1A1A3F)',
              border:     '2px solid #6C3CE1',
              maxWidth:   360,
            }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{    y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
          >
            <p className="font-body text-xs uppercase tracking-wider text-gray-400">
              {t('xp.mystery_box_label')}
            </p>

            {/* Box */}
            {!opened ? (
              <motion.button
                type="button"
                onClick={handleOpen}
                className="cursor-pointer border-none bg-transparent"
                style={{ fontSize: 72, lineHeight: 1 }}
                animate={opening ? {} : { rotate: [-6, 6, -6], y: [0, -4, 0] }}
                transition={opening ? {} : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                whileTap={!opening ? { scale: 0.9 } : {}}
              >
                🎁
              </motion.button>
            ) : (
              <motion.div
                style={{ fontSize: 72, lineHeight: 1 }}
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.4, 1] }}
                transition={{ type: 'spring', damping: 10 }}
              >
                ✨
              </motion.div>
            )}

            {!opened ? (
              <>
                <p className="font-display text-white" style={{ fontSize: 20 }}>
                  {t('xp.mystery_box_title')}
                </p>
                <p className="font-body text-sm text-gray-400">{t('xp.mystery_box_hint')}</p>
                <motion.button
                  type="button"
                  onClick={handleOpen}
                  disabled={opening}
                  className="w-full font-body font-bold text-white rounded-2xl py-3.5 cursor-pointer border-none disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: 16 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {t('xp.mystery_box_open')}
                </motion.button>
              </>
            ) : (
              <>
                <motion.p
                  className="font-display"
                  style={{ fontSize: 48, color: '#FFD700', textShadow: '0 0 24px #FFD70099' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ type: 'spring', damping: 12 }}
                >
                  +{pendingMysteryBoxXP} XP
                </motion.p>
                <p className="font-body text-sm text-gray-400">{t('xp.mystery_box_earned')}</p>
                <motion.button
                  type="button"
                  onClick={handleClose}
                  className="w-full font-body font-bold text-white rounded-2xl py-3.5 cursor-pointer border-none"
                  style={{ background: '#00C896', fontSize: 16 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {t('xp.mystery_box_claim')}
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
