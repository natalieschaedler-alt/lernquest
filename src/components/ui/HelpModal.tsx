/**
 * HelpModal – scrollable quick-reference for game mechanics.
 *
 * Triggered by the "?" button in DungeonPage's header.
 * Slides up from the bottom over a dark backdrop.
 */
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

interface HelpItem {
  icon: string
  titleKey: string
  descKey: string
}

const HELP_ITEMS: HelpItem[] = [
  { icon: '👆', titleKey: 'tutorial.help_answer_title',   descKey: 'tutorial.help_answer_desc'   },
  { icon: '⚡', titleKey: 'tutorial.help_fast_title',     descKey: 'tutorial.help_fast_desc'     },
  { icon: '❤️', titleKey: 'tutorial.help_hp_title',       descKey: 'tutorial.help_hp_desc'       },
  { icon: '💥', titleKey: 'tutorial.help_crit_title',     descKey: 'tutorial.help_crit_desc'     },
  { icon: '✨', titleKey: 'tutorial.help_golden_title',   descKey: 'tutorial.help_golden_desc'   },
  { icon: '🔥', titleKey: 'tutorial.help_streak_title',   descKey: 'tutorial.help_streak_desc'   },
  { icon: '👾', titleKey: 'tutorial.help_boss_title',     descKey: 'tutorial.help_boss_desc'     },
  { icon: '🎁', titleKey: 'tutorial.help_loot_title',     descKey: 'tutorial.help_loot_desc'     },
]

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="relative w-full flex flex-col"
            style={{
              maxWidth:      480,
              maxHeight:     '80vh',
              background:    '#0D0820',
              borderRadius:  '20px 20px 0 0',
              border:        '1px solid rgba(108,60,225,0.35)',
              borderBottom:  'none',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <h2 className="font-display text-white text-lg">{t('tutorial.help_title')}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('tutorial.help_close')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer border border-dark-border bg-dark text-sm"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 pb-8" style={{ overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-3">
                {HELP_ITEMS.map((item) => (
                  <div
                    key={item.titleKey}
                    className="flex items-start gap-3 rounded-xl px-4 py-3 border border-dark-border"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <span className="text-xl mt-0.5 shrink-0 select-none">{item.icon}</span>
                    <div>
                      <p className="font-body font-semibold text-white text-sm">{t(item.titleKey)}</p>
                      <p className="font-body text-gray-400 text-xs mt-0.5 leading-snug">{t(item.descKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
