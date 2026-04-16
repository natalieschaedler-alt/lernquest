/**
 * SchildBlock.tsx – Projectile-dodge room
 *
 * The boss hurls 5 projectiles (falling divs). Each carries a question.
 * Block it by answering correctly before impact (default 4 s, –10 % per throw).
 * Correct → projectile explodes mid-air (sparkle + flash).
 * Wrong / timeout → projectile hits, shake('hard') + chromatic + HP −1.
 * 3× perfect combo → "PERFECT BLOCK!" floatText + crit bonus.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { bus } from '../../lib/events'
import { pointsForDifficulty } from '../../lib/gameConfig'

// ── Types ──────────────────────────────────────────────────────

export interface SchildBlockProps {
  /** 5 projectile questions */
  questions: Question[]
  worldTheme: WorldTheme
  /** Called when all 5 projectiles are resolved (pass or fail) */
  onComplete: (score: number) => void
  /** Callback for each projectile hit (HP loss) */
  onHit?: () => void
}

// ── Constants ─────────────────────────────────────────────────

const BASE_FALL_MS    = 4000   // ms for first projectile to fall
const SPEED_INCREASE  = 0.10   // 10 % faster each throw
const COMBO_THRESHOLD = 3
const WARNING_MS      = 600    // ms before impact when floor warning fires
const EXPLODE_HEIGHT  = 0.20   // fraction from bottom where block explosion fires

// ── Component ─────────────────────────────────────────────────

export default function SchildBlock({ questions, worldTheme, onComplete, onHit }: SchildBlockProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const qs = useMemo(() => questions.slice(0, 5), [questions])

  const [projIndex,    setProjIndex]    = useState(0)
  const [phase,        setPhase]        = useState<'warning' | 'falling' | 'exploded' | 'hit' | 'done'>('warning')
  const [answered,     setAnswered]     = useState(false)
  const [combo,        setCombo]        = useState(0)
  const [floorWarn,    setFloorWarn]    = useState(false)
  const [projX]        = useState(() => 30 + Math.random() * 40) // random horizontal lane (%)

  const scoreRef       = useRef(0)
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const impactRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answeredRef    = useRef(false)
  const containerRef   = useRef<HTMLDivElement>(null)
  const completeRef    = useRef(false)

  const currentQ     = qs[projIndex]
  const fallDuration = Math.round(BASE_FALL_MS * Math.pow(1 - SPEED_INCREASE, projIndex))

  // ── Clear all timers ──────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (timerRef.current)  clearTimeout(timerRef.current)
    if (impactRef.current) clearTimeout(impactRef.current)
    if (warnRef.current)   clearTimeout(warnRef.current)
  }, [])

  // ── Advance to next projectile ────────────────────────────────
  const advance = useCallback(() => {
    const nextIdx = projIndex + 1
    if (nextIdx >= qs.length) {
      completeRef.current = true
      setPhase('done')
      bus.emit('roomComplete', { roomIndex: 2, score: scoreRef.current, allCorrect: false })
      setTimeout(() => onComplete(scoreRef.current), 800)
      return
    }
    answeredRef.current = false
    setAnswered(false)
    setPhase('warning')
    setFloorWarn(false)
    setProjIndex(nextIdx)
  }, [projIndex, qs.length, onComplete])

  // ── Launch sequence when phase/projIndex changes ─────────────
  useEffect(() => {
    if (phase !== 'warning') return
    clearTimers()

    // Brief warning pause before fall starts
    timerRef.current = setTimeout(() => {
      setPhase('falling')

      // Floor warning fires WARNING_MS before impact
      warnRef.current = setTimeout(() => setFloorWarn(true), fallDuration - WARNING_MS)

      // Impact if not blocked in time
      impactRef.current = setTimeout(() => {
        if (answeredRef.current) return
        answeredRef.current = true
        setAnswered(true)
        setPhase('hit')
        setCombo(0)
        setFloorWarn(false)

        if (!prm) {
          feel.shake('hard')
          feel.chromatic(0.45, 280)
        }
        feel.haptic('fail')
        onHit?.()
        bus.emit('answerWrong', {
          questionIndex: projIndex,
          correctAnswer: currentQ?.answers[currentQ.correctIndex] ?? '',
          givenAnswer: '(time out)',
        })

        setTimeout(advance, 1000)
      }, fallDuration)
    }, 500)

    return clearTimers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projIndex, phase])

  // ── Block: correct answer ─────────────────────────────────────
  const handleBlock = useCallback((answerIdx: number) => {
    if (answered || answeredRef.current || !currentQ) return
    answeredRef.current = true
    setAnswered(true)
    clearTimers()
    setFloorWarn(false)

    const correct = answerIdx === currentQ.correctIndex
    const pts     = correct ? pointsForDifficulty(currentQ.difficulty) : 0

    if (correct) {
      const newCombo = combo + 1
      setCombo(newCombo)
      scoreRef.current += pts

      const isPerfect = newCombo >= COMBO_THRESHOLD
      if (isPerfect) {
        scoreRef.current += 15 // crit bonus
        const cx = window.innerWidth * 0.5
        const cy = window.innerHeight * 0.6
        if (!prm) {
          feel.floatText('PERFECT BLOCK!', { x: cx, y: cy }, '#FFD700', 1.35)
          feel.particles({ x: cx, y: cy }, 'sparkle', 18)
          feel.particles({ x: cx, y: cy }, 'golden',   8)
        }
        bus.emit('critHit', { multiplier: 2, questionIndex: projIndex })
      }

      setPhase('exploded')

      if (!prm) {
        const cont = containerRef.current
        if (cont) {
          const rect = cont.getBoundingClientRect()
          const cx2  = rect.left + (projX / 100) * rect.width
          const cy2  = rect.top  + (1 - EXPLODE_HEIGHT) * rect.height
          feel.particles({ x: cx2, y: cy2 }, 'sparkle', 14)
          feel.flash(`${worldTheme.primaryColor}55`, 250)
        }
      }
      feel.haptic('tick')
      bus.emit('answerCorrect', { questionIndex: projIndex, points: pts + (isPerfect ? 15 : 0), fast: true, combo: newCombo })

      setTimeout(advance, 700)
    } else {
      // Wrong answer
      setCombo(0)
      setPhase('hit')

      if (!prm) {
        feel.shake('medium')
        feel.chromatic(0.3, 200)
      }
      feel.haptic('fail')
      onHit?.()
      bus.emit('answerWrong', {
        questionIndex: projIndex,
        correctAnswer: currentQ.answers[currentQ.correctIndex],
        givenAnswer:   currentQ.answers[answerIdx],
      })
      setTimeout(advance, 900)
    }
  }, [answered, currentQ, combo, prm, feel, projIndex, projX, worldTheme.primaryColor, onHit, advance, clearTimers])

  // ── Timer bar progress ────────────────────────────────────────
  const [timerPct, setTimerPct] = useState(100)
  useEffect(() => {
    if (phase !== 'falling') { setTimerPct(100); return }
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      setTimerPct(Math.max(0, 100 - (elapsed / fallDuration) * 100))
    }, 50)
    return () => clearInterval(interval)
  }, [phase, fallDuration])

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[520px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #080010 100%)` }}
    >
      {/* Header status */}
      <div className="absolute top-3 inset-x-0 flex items-center justify-between px-4 pointer-events-none">
        <span className="font-body text-[10px] text-white/40">
          {projIndex + 1} / {qs.length}
        </span>
        {combo > 0 && (
          <motion.span
            key={combo}
            className="font-display text-xs"
            style={{ color: combo >= COMBO_THRESHOLD ? '#FFD700' : worldTheme.primaryColor }}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {combo}× {t('rooms.combo', 'BLOCK')}
          </motion.span>
        )}
        <span className="font-body text-[10px] text-white/40">
          {Math.round(fallDuration / 100) / 10}s
        </span>
      </div>

      {/* Boss at top */}
      <div className="absolute top-[6%] left-1/2 -translate-x-1/2 pointer-events-none">
        <motion.div
          className="text-4xl"
          animate={!prm ? { y: [0, -6, 0], scale: phase === 'hit' ? [1, 1.2, 1] : 1 } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {worldTheme.bossEmoji}
        </motion.div>
        {/* Boss name */}
        <p className="text-center font-body text-[9px] text-white/30 mt-1">
          {worldTheme.bossName}
        </p>
      </div>

      {/* ── Projectile ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {(phase === 'falling' || phase === 'warning') && currentQ && (
          <motion.div
            key={`proj-${projIndex}`}
            className="absolute z-10 rounded-2xl border px-3 py-2 text-center max-w-[200px]"
            style={{
              left:         `${projX}%`,
              transform:    'translateX(-50%)',
              background:   `linear-gradient(135deg, ${worldTheme.primaryColor}25, rgba(0,0,0,0.85))`,
              borderColor:  worldTheme.primaryColor + '70',
              boxShadow:    `0 0 16px ${worldTheme.primaryColor}40`,
            }}
            initial={{ top: '14%', opacity: 0.9 }}
            animate={{ top: `${(1 - EXPLODE_HEIGHT - 0.02) * 100}%`, opacity: 1 }}
            exit={{ scale: [1, 1.8, 0], opacity: 0 }}
            transition={{
              top:     { duration: fallDuration / 1000, ease: 'linear' },
              opacity: { duration: 0.2 },
            }}
          >
            <p className="font-body text-white text-[11px] leading-snug">
              {currentQ.question}
            </p>
          </motion.div>
        )}

        {/* Explode burst */}
        {phase === 'exploded' && (
          <motion.div
            key={`burst-${projIndex}`}
            className="absolute z-10 text-3xl pointer-events-none"
            style={{ left: `${projX}%`, top: `${(1 - EXPLODE_HEIGHT) * 100}%`, transform: 'translate(-50%, -50%)' }}
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            ✨
          </motion.div>
        )}

        {/* Hit impact */}
        {phase === 'hit' && (
          <motion.div
            key={`impact-${projIndex}`}
            className="absolute z-10 text-3xl pointer-events-none"
            style={{ left: `${projX}%`, bottom: '12%', transform: 'translateX(-50%)' }}
            initial={{ scale: 0.6, opacity: 1 }}
            animate={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            💥
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floor warning flash ─────────────────────────────────── */}
      <AnimatePresence>
        {floorWarn && (
          <motion.div
            className="absolute bottom-[10%] pointer-events-none rounded-full"
            style={{
              left:       `${projX}%`,
              transform:  'translateX(-50%)',
              width:       60,
              height:       8,
              background: '#FF4444',
              filter:     'blur(4px)',
            }}
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: [0, 0.9, 0.3, 0.9], scaleX: [0.5, 1.2, 0.8, 1.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: WARNING_MS / 1000, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* ── Timer bar ───────────────────────────────────────────── */}
      {phase === 'falling' && (
        <div className="absolute bottom-[22%] inset-x-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width:      `${timerPct}%`,
              background: timerPct < 30 ? '#FF4444' : worldTheme.primaryColor,
              transition: 'background 0.3s',
            }}
          />
        </div>
      )}

      {/* ── Shield icon (player) ─────────────────────────────────── */}
      <div className="absolute bottom-[23%] right-4 pointer-events-none">
        <motion.div
          className="text-3xl"
          animate={phase === 'exploded' && !prm
            ? { scale: [1, 1.4, 1], filter: ['brightness(1)', `brightness(3)`, 'brightness(1)'] }
            : { scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          🛡️
        </motion.div>
      </div>

      {/* ── Answer buttons ───────────────────────────────────────── */}
      {currentQ && !completeRef.current && (
        <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {currentQ.answers.map((ans, ai) => (
              <motion.button
                key={`${projIndex}-${ai}`}
                className="py-3 px-2 rounded-xl border font-body text-[12px] text-white text-center"
                style={{
                  background:  `${worldTheme.primaryColor}18`,
                  borderColor: `${worldTheme.primaryColor}45`,
                  opacity:     answered ? 0.4 : 1,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: answered ? 0.4 : 1, y: 0 }}
                transition={{ delay: ai * 0.04 }}
                whileTap={!answered ? { scale: 0.95 } : undefined}
                onClick={() => handleBlock(ai)}
                disabled={answered}
              >
                {ans}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── All done ────────────────────────────────────────────── */}
      {phase === 'done' && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="font-display text-xl" style={{ color: worldTheme.primaryColor }}>
            {t('rooms.shield_complete', '🛡️ Angriff abgewehrt!')}
          </p>
        </motion.div>
      )}

      {/* Screen-wide hit flash */}
      <AnimatePresence>
        {phase === 'hit' && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ background: 'rgba(255,50,50,0.25)' }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
