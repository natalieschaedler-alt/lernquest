/**
 * TutorialTooltip – non-blocking in-dungeon tutorial overlay.
 *
 * - The full-screen backdrop is pointer-events-none so the game stays playable.
 * - Only the card itself is pointer-events-auto (for the X dismiss button).
 * - A shrinking progress bar visualises the 5-second auto-dismiss timer.
 * - Arrow indicator bounces toward the area being explained.
 *
 * Positions:
 *   top    – just below the fixed header; arrow bounces UP toward the header
 *   bottom – above thumb area at bottom; arrow bounces UP toward game content
 *   center – vertically centred; no arrow (informational tips)
 */
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { TutorialStepId } from '../../hooks/useTutorial'
import { TUTORIAL_AUTO_CLOSE_MS } from '../../hooks/useTutorial'

// ── Step configuration ─────────────────────────────────────────────────────────

interface StepConfig {
  icon: string
  position: 'top' | 'bottom' | 'center'
  /** Whether to show a bouncing ▲ above the card. */
  showArrow: boolean
  accent: string
}

const STEP_CONFIG: Record<TutorialStepId, StepConfig> = {
  dungeon_q1:    { icon: '👆', position: 'bottom', showArrow: true,  accent: '#6C3CE1' },
  dungeon_xp:    { icon: '⭐', position: 'top',    showArrow: true,  accent: '#00C896' },
  dungeon_room2: { icon: '🗺️', position: 'bottom', showArrow: false, accent: '#3B82F6' },
  boss_fight:    { icon: '⚔️', position: 'center', showArrow: false, accent: '#EF4444' },
  victory_loot:  { icon: '🎁', position: 'bottom', showArrow: true,  accent: '#FFD700' },
}

// ── Framer Motion variants (keyed by position) ────────────────────────────────

const CARD_VARIANTS = {
  top: {
    initial: { y: -24, opacity: 0 },
    animate: { y: 0,   opacity: 1 },
    exit:    { y: -16, opacity: 0 },
  },
  bottom: {
    initial: { y: 24,  opacity: 0 },
    animate: { y: 0,   opacity: 1 },
    exit:    { y: 16,  opacity: 0 },
  },
  center: {
    initial: { scale: 0.85, opacity: 0 },
    animate: { scale: 1,    opacity: 1 },
    exit:    { scale: 0.9,  opacity: 0 },
  },
} as const

// ── Component ─────────────────────────────────────────────────────────────────

interface TutorialTooltipProps {
  visible: boolean
  stepId: TutorialStepId | null
  onDismiss: () => void
}

export default function TutorialTooltip({ visible, stepId, onDismiss }: TutorialTooltipProps) {
  const { t } = useTranslation()
  const config = stepId ? STEP_CONFIG[stepId] : null
  const show   = visible && config !== null && stepId !== null

  // Positioned wrapper style
  const wrapperStyle = (() => {
    if (!config) return {}
    const base = { position: 'absolute' as const, left: 12, right: 12 }
    if (config.position === 'top')    return { ...base, top: 80 }
    if (config.position === 'bottom') return { ...base, bottom: 24 }
    // center
    return { ...base, top: '50%', transform: 'translateY(-50%)' }
  })()

  const variants = config ? CARD_VARIANTS[config.position] : CARD_VARIANTS.bottom

  return (
    <AnimatePresence>
      {show && config && stepId && (
        // Full-screen container — pointer-events-none so game remains interactive
        <div
          className="fixed inset-0 z-[70] pointer-events-none"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Subtle dark vignette */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.22)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Card wrapper */}
          <motion.div
            key={stepId}
            className="pointer-events-auto flex flex-col"
            style={wrapperStyle}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            {/* Bouncing arrow (above card, points up toward relevant element) */}
            {config.showArrow && (
              <motion.div
                className="flex justify-start pl-5 mb-1"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <span style={{ color: config.accent, fontSize: 18, lineHeight: 1 }}>▲</span>
              </motion.div>
            )}

            {/* Card */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background:  'rgba(13, 8, 28, 0.97)',
                border:      `1.5px solid ${config.accent}55`,
                boxShadow:   `0 8px 32px rgba(0,0,0,0.55), 0 0 24px ${config.accent}18`,
              }}
            >
              {/* Content row */}
              <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                <span className="text-xl mt-0.5 shrink-0 select-none">{config.icon}</span>
                <p
                  className="font-body text-white flex-1 leading-snug"
                  style={{ fontSize: 14 }}
                >
                  {t(`tutorial.${stepId}`)}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label={t('tutorial.dismiss')}
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-colors cursor-pointer border-none bg-transparent text-sm leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Auto-dismiss shrinking progress bar */}
              <motion.div
                key={`bar-${stepId}`}
                className="absolute bottom-0 left-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, ${config.accent}, ${config.accent}66)` }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: TUTORIAL_AUTO_CLOSE_MS / 1000, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
