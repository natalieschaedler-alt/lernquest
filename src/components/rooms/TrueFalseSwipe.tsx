/**
 * TrueFalseSwipe.tsx – Haptik-Feel dungeon room
 *
 * Tinder-style card stack (3 visible, scale + translateY stagger).
 * Drag with pointer-events: right = Wahr (green), left = Falsch (red).
 * Correct  → sparkle + fly off.
 * Wrong    → clip-path tear animation + HP −1.
 * Combo 3+ → fire emoji + flame particles.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'

// ── Types ──────────────────────────────────────────────────────

export interface TrueFalseSwipeProps {
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

// ── Constants ─────────────────────────────────────────────────

const COMBO_FIRE   = 3
const SWIPE_THRESH = 60   // px to count as a swipe

// ── Helpers ───────────────────────────────────────────────────

function isQuestionTrue(q: Question): boolean {
  // answers: ['Wahr', 'Falsch'], correctIndex 0 = Wahr (true)
  return q.correctIndex === 0
}

// ── Top card draggable ────────────────────────────────────────

interface TopCardProps {
  question: Question
  cardKey:  number
  worldTheme: WorldTheme
  combo:    number
  onSwipe:  (isRight: boolean) => void
  prm:      boolean
}

function TopCard({ question, cardKey, worldTheme, combo, onSwipe, prm }: TopCardProps) {
  const x    = useMotionValue(0)
  const rot  = useTransform(x, [-160, 160], [-18, 18])
  const opacity = useTransform(x, [-140, 0, 140], [0.6, 1, 0.6])

  // Label overlays
  const wahrOpacity  = useTransform(x, [20, 80],  [0, 1])
  const falschOpacity = useTransform(x, [-80, -20], [1, 0])

  const isDragging = useRef(false)
  const startX     = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (prm) return
    isDragging.current = true
    startX.current = e.clientX
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [prm])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    x.set(e.clientX - startX.current)
  }, [x])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const val = x.get()
    if (Math.abs(val) >= SWIPE_THRESH) {
      onSwipe(val > 0)
    } else {
      // snap back
      x.set(0)
    }
  }, [x, onSwipe])

  // Keyboard / button tap fallback
  const handleButton = useCallback((isRight: boolean) => {
    onSwipe(isRight)
  }, [onSwipe])

  return (
    <motion.div
      key={cardKey}
      className="absolute inset-0 rounded-2xl border flex flex-col justify-between p-4 cursor-grab active:cursor-grabbing"
      style={{
        x, rotate: rot, opacity,
        borderColor: `${worldTheme.primaryColor}50`,
        background:  `linear-gradient(160deg, ${worldTheme.primaryColor}14 0%, rgba(5,0,8,0.95) 100%)`,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Wahr label */}
      <motion.div
        className="absolute top-4 left-4 px-3 py-1 rounded-full border-2 border-green-400"
        style={{ opacity: wahrOpacity }}
      >
        <span className="font-display text-green-400 text-sm font-bold">WAHR ✓</span>
      </motion.div>

      {/* Falsch label */}
      <motion.div
        className="absolute top-4 right-4 px-3 py-1 rounded-full border-2 border-red-400"
        style={{ opacity: falschOpacity }}
      >
        <span className="font-display text-red-400 text-sm font-bold">✗ FALSCH</span>
      </motion.div>

      {/* Combo badge */}
      {combo >= COMBO_FIRE && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <span className="text-lg">🔥</span>
          <span className="font-body text-orange-400 text-[11px] font-semibold">{combo}× COMBO</span>
        </div>
      )}

      {/* Question */}
      <div className="flex-1 flex items-center justify-center px-2 py-8">
        <p className="font-body text-white text-center text-[14px] leading-snug">
          {question.question}
        </p>
      </div>

      {/* Tap buttons (non-drag fallback) */}
      <div className="flex gap-3">
        <motion.button
          className="flex-1 py-2.5 rounded-xl border font-body text-[12px] font-bold text-red-400"
          style={{ borderColor: 'rgba(255,68,68,0.45)', background: 'rgba(255,68,68,0.1)' }}
          whileTap={{ scale: 0.93 }}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => handleButton(false)}
        >
          ✗ Falsch
        </motion.button>
        <motion.button
          className="flex-1 py-2.5 rounded-xl border font-body text-[12px] font-bold text-green-400"
          style={{ borderColor: 'rgba(74,222,128,0.45)', background: 'rgba(74,222,128,0.1)' }}
          whileTap={{ scale: 0.93 }}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => handleButton(true)}
        >
          ✓ Wahr
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function TrueFalseSwipe({ questions, worldTheme, onComplete, onHit }: TrueFalseSwipeProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [qIdx,    setQIdx]    = useState(0)
  const [combo,   setCombo]   = useState(0)
  const [score,   setScore]   = useState(0)
  const [flyDir,  setFlyDir]  = useState<'left' | 'right' | null>(null)
  const [tearing, setTearing] = useState(false)
  const [cardKey, setCardKey] = useState(0)

  const scoreRef  = useRef(0)
  const comboRef  = useRef(0)
  const doneRef   = useRef(false)
  const busyRef   = useRef(false)

  const currentQ = questions[qIdx] as Question | undefined

  const handleSwipe = useCallback((isRight: boolean) => {
    if (!currentQ || busyRef.current || doneRef.current) return
    busyRef.current = true

    const correct = isRight === isQuestionTrue(currentQ)
    const pts     = correct ? 15 + comboRef.current * 3 : 0

    if (correct) {
      comboRef.current += 1
      scoreRef.current += pts
      setCombo(comboRef.current)
      setScore(scoreRef.current)
      setFlyDir(isRight ? 'right' : 'left')

      sfx.play('correct_soft')
      feel.haptic('tick')
      if (!prm) {
        feel.particles(
          { x: window.innerWidth / 2, y: window.innerHeight * 0.4 },
          'sparkle', 7
        )
        feel.floatText(`+${pts}`, { x: window.innerWidth / 2, y: window.innerHeight * 0.33 }, '#FFD700', 1.1)
        if (comboRef.current >= COMBO_FIRE) {
          feel.particles(
            { x: window.innerWidth / 2, y: window.innerHeight * 0.45 },
            'lava', 4
          )
          sfx.play('streak_fire')
        }
      }
      bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: false, combo: comboRef.current })

      setTimeout(() => {
        setFlyDir(null)
        advance()
      }, 320)
    } else {
      comboRef.current = 0
      setCombo(0)
      setTearing(true)
      sfx.play('wrong_thud')
      feel.haptic('fail')
      if (!prm) feel.shake('soft')
      onHit?.()

      bus.emit('answerWrong', {
        questionIndex: qIdx,
        correctAnswer: isQuestionTrue(currentQ) ? 'Wahr' : 'Falsch',
        givenAnswer:   isRight ? 'Wahr' : 'Falsch',
      })

      setTimeout(() => {
        setTearing(false)
        advance()
      }, 480)
    }
  }, [currentQ, qIdx, prm, feel, onHit])

  const advance = useCallback(() => {
    busyRef.current = false
    const next = qIdx + 1
    if (next >= questions.length) {
      if (doneRef.current) return
      doneRef.current = true
      bus.emit('roomComplete', { roomIndex: 7, score: scoreRef.current, allCorrect: false })
      onComplete(scoreRef.current)
    } else {
      setQIdx(next)
      setCardKey(k => k + 1)
    }
  }, [qIdx, questions.length, onComplete])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleSwipe(true)
      if (e.key === 'ArrowLeft')  handleSwipe(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSwipe])

  const progress = questions.length > 0 ? qIdx / questions.length : 0

  return (
    <div
      className="relative w-full min-h-[500px] rounded-2xl overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-t-2xl overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: worldTheme.primaryColor }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="font-body text-white/35 text-[11px]">
          {qIdx + 1} / {questions.length}
        </p>
        <span className="font-display text-sm font-bold" style={{ color: worldTheme.primaryColor }}>
          {score} XP
        </span>
      </div>

      {/* Combo */}
      <div className="flex justify-center h-7 mb-1">
        <AnimatePresence>
          {combo >= COMBO_FIRE && (
            <motion.div
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full"
              style={{ background: '#FF440022', border: '1px solid #FF440055' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0 }}
            >
              <span className="text-sm">🔥</span>
              <span className="font-body text-orange-400 text-[11px] font-semibold">{combo}×</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hint */}
      <p className="text-center font-body text-white/25 text-[10px] mb-3">
        {t('rooms.swipe_hint', '← Falsch  |  Wahr →')}
      </p>

      {/* Card stack */}
      <div className="relative mx-4 h-[280px]">
        {/* Background cards (stack illusion) */}
        {[2, 1].map(offset => {
          const idx = qIdx + offset
          const q   = questions[idx]
          if (!q) return null
          return (
            <div
              key={idx}
              className="absolute inset-0 rounded-2xl border"
              style={{
                borderColor: `${worldTheme.primaryColor}25`,
                background:  `${worldTheme.primaryColor}08`,
                transform:   `translateY(${offset * 6}px) scale(${1 - offset * 0.03})`,
                zIndex:      10 - offset,
              }}
            />
          )
        })}

        {/* Top card */}
        <AnimatePresence mode="popLayout">
          {currentQ && !tearing && (
            <motion.div
              key={`card-wrap-${cardKey}`}
              className="absolute inset-0"
              style={{ zIndex: 20 }}
              animate={flyDir
                ? { x: flyDir === 'right' ? 300 : -300, rotate: flyDir === 'right' ? 20 : -20, opacity: 0 }
                : {}}
              transition={{ duration: 0.28, ease: 'easeIn' }}
            >
              <TopCard
                question={currentQ}
                cardKey={cardKey}
                worldTheme={worldTheme}
                combo={combo}
                onSwipe={handleSwipe}
                prm={prm}
              />
            </motion.div>
          )}

          {/* Tear animation */}
          {tearing && currentQ && (
            <motion.div
              key={`tear-${cardKey}`}
              className="absolute inset-0 rounded-2xl border overflow-hidden"
              style={{
                borderColor: 'rgba(255,68,68,0.5)',
                background:  'rgba(255,68,68,0.08)',
                zIndex:      20,
              }}
              initial={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
              animate={{
                clipPath: [
                  'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                  'polygon(0 0, 48% 0, 52% 50%, 50% 100%, 0 100%)',
                  'polygon(0 0, 48% 0, 52% 50%, 50% 100%, 0 100%)',
                ],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.45, times: [0, 0.5, 1] }}
            >
              <div className="h-full flex items-center justify-center">
                <p className="font-body text-red-400 text-[13px] text-center px-4">
                  {currentQ.question}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard hint */}
      <p className="text-center font-body text-white/15 text-[9px] mt-3">
        ← → {t('rooms.swipe_keyboard', 'Pfeiltasten')}
      </p>
    </div>
  )
}
