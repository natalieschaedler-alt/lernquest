/**
 * OrakelStatue.tsx – Atmosphäre-Feel dungeon room
 *
 * A stone statue breathes (scale 1 ↔ 1.02). Eyes glow when a question
 * is ready. Question text appears via typewriter (40 ms/char) with a
 * whispy sfx per word. Four stone tablets surround the statue.
 * Correct → golden flash + floatText "WISE CHOICE" + sparkle rain.
 * Wrong   → crack overlay + tablet crumbles.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'

// ── Types ──────────────────────────────────────────────────────

export interface OrakelStatueProps {
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

type TabletState = 'idle' | 'glow' | 'chosen' | 'correct' | 'wrong' | 'crumble'

interface Tablet {
  idx:   number
  label: string
  state: TabletState
}

// ── Constants ─────────────────────────────────────────────────

const TYPEWRITER_MS  = 38
const WORD_SFX_EVERY = 3   // play rune_glow every N words typed
const GLOW_DELAY_MS  = 200

// Tablet positions (relative to statue box)
const TABLET_POS = [
  { top: '18%', left:  '2%'  },   // top-left
  { top: '18%', right: '2%'  },   // top-right
  { top: '62%', left:  '2%'  },   // bottom-left
  { top: '62%', right: '2%'  },   // bottom-right
]

// ── Helpers ───────────────────────────────────────────────────

function getAnswerOptions(q: Question): string[] {
  if (q.question_type === 'tf') return ['Wahr', 'Falsch']
  return q.answers.slice(0, 4)
}

function checkAnswer(q: Question, choice: string): boolean {
  return choice === q.answers[q.correctIndex]
}

// ── Component ─────────────────────────────────────────────────

export default function OrakelStatue({ questions, worldTheme, onComplete, onHit }: OrakelStatueProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [qIdx,       setQIdx]       = useState(0)
  const [typed,      setTyped]      = useState('')
  const [eyesGlow,   setEyesGlow]   = useState(false)
  const [tablets,    setTablets]    = useState<Tablet[]>([])
  const [crackIdx,   setCrackIdx]   = useState<number | null>(null)
  const [goldenFlash, setGoldenFlash] = useState(false)
  const [answered,   setAnswered]   = useState(false)

  const scoreRef    = useRef(0)
  const doneRef     = useRef(false)
  const typeTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordCount   = useRef(0)

  const currentQ = questions[qIdx] as Question | undefined

  // ── Build tablets when question changes ────────────────────
  useEffect(() => {
    if (!currentQ) return
    setTyped('')
    setAnswered(false)
    setEyesGlow(false)
    setCrackIdx(null)
    setGoldenFlash(false)
    wordCount.current = 0

    const opts = getAnswerOptions(currentQ)
    setTablets(opts.map((label, idx) => ({ idx, label, state: 'idle' })))

    // Start typewriter after brief pause
    const startDelay = setTimeout(() => {
      const fullText = currentQ.question
      let charIdx    = 0
      let lastWordI  = 0

      typeTimer.current = setInterval(() => {
        charIdx++
        const slice = fullText.slice(0, charIdx)
        setTyped(slice)

        // Count words typed for sfx trigger
        const spaces = (slice.match(/ /g) ?? []).length
        if (spaces > lastWordI) {
          lastWordI = spaces
          wordCount.current += 1
          if (wordCount.current % WORD_SFX_EVERY === 0 && !prm) {
            sfx.play('rune_glow', 0.4)
          }
        }

        if (charIdx >= fullText.length) {
          clearInterval(typeTimer.current!)
          // Eyes glow, tablets light up
          setTimeout(() => {
            setEyesGlow(true)
            setTablets(prev => prev.map(t => ({ ...t, state: 'glow' })))
          }, GLOW_DELAY_MS)
        }
      }, TYPEWRITER_MS)
    }, 400)

    return () => {
      clearTimeout(startDelay)
      if (typeTimer.current) clearInterval(typeTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx])

  // ── Handle tablet tap ──────────────────────────────────────
  const handleTablet = useCallback((tabletIdx: number) => {
    if (answered || !currentQ || doneRef.current) return
    const tablet = tablets[tabletIdx]
    if (!tablet || tablet.state === 'idle') return  // not yet glowing

    setAnswered(true)
    const choice  = tablet.label
    const correct = checkAnswer(currentQ, choice)
    const pts     = correct ? 20 : 0

    if (correct) {
      scoreRef.current += pts
      setGoldenFlash(true)
      sfx.play('golden_chime')
      feel.haptic('success')

      if (!prm) {
        feel.particles(
          { x: window.innerWidth / 2, y: window.innerHeight * 0.38 },
          'sparkle', 14
        )
        feel.particles(
          { x: window.innerWidth / 2, y: window.innerHeight * 0.38 },
          'golden',  7
        )
        feel.floatText('WISE CHOICE', { x: window.innerWidth / 2, y: window.innerHeight * 0.28 }, '#FFD700', 1.3)
      }

      setTablets(prev => prev.map(t => ({ ...t, state: t.idx === tabletIdx ? 'correct' : 'chosen' })))
      bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: false, combo: 0 })

      setTimeout(() => {
        setGoldenFlash(false)
        advance()
      }, 1800)
    } else {
      sfx.play('wrong_thud')
      feel.haptic('fail')
      onHit?.()
      if (!prm) feel.shake('soft')
      setCrackIdx(tabletIdx)
      setTablets(prev => prev.map(t => ({ ...t, state: t.idx === tabletIdx ? 'crumble' : 'chosen' })))

      bus.emit('answerWrong', {
        questionIndex: qIdx,
        correctAnswer: currentQ.answers[currentQ.correctIndex],
        givenAnswer:   choice,
      })

      setTimeout(() => {
        setCrackIdx(null)
        advance()
      }, 900)
    }
  }, [answered, currentQ, tablets, qIdx, prm, feel, onHit])

  const advance = useCallback(() => {
    if (doneRef.current) return
    const next = qIdx + 1
    if (next >= questions.length) {
      doneRef.current = true
      bus.emit('roomComplete', { roomIndex: 8, score: scoreRef.current, allCorrect: false })
      onComplete(scoreRef.current)
    } else {
      setQIdx(next)
    }
  }, [qIdx, questions.length, onComplete])

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      className="relative w-full min-h-[500px] rounded-2xl overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
    >
      {/* Golden flash overlay */}
      <AnimatePresence>
        {goldenFlash && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-30 rounded-2xl"
            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, transparent 70%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.9 }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="font-body text-white/35 text-[11px]">
          {qIdx + 1} / {questions.length}
        </p>
        <span className="font-display text-sm font-bold" style={{ color: worldTheme.primaryColor }}>
          {scoreRef.current} XP
        </span>
      </div>

      {/* Statue + Tablets area */}
      <div className="relative mx-auto" style={{ width: 300, height: 300 }}>

        {/* Tablets — positioned around statue */}
        {tablets.map((tablet, i) => {
          const pos   = TABLET_POS[i] ?? {}
          const color =
            tablet.state === 'correct' ? '#FFD700' :
            tablet.state === 'crumble' ? '#FF4444' :
            tablet.state === 'glow'    ? worldTheme.primaryColor :
            `${worldTheme.primaryColor}40`

          return (
            <motion.button
              key={`${qIdx}-tab-${i}`}
              className="absolute w-[80px] h-[72px] rounded-xl border flex items-center justify-center px-1"
              style={{
                ...pos,
                borderColor: color,
                background: tablet.state === 'correct'
                  ? 'rgba(255,215,0,0.12)'
                  : tablet.state === 'crumble'
                  ? 'rgba(255,68,68,0.12)'
                  : tablet.state === 'glow'
                  ? `${worldTheme.primaryColor}18`
                  : 'rgba(255,255,255,0.04)',
                boxShadow: tablet.state === 'glow'
                  ? `0 0 10px ${worldTheme.primaryColor}55`
                  : tablet.state === 'correct'
                  ? '0 0 16px rgba(255,215,0,0.6)'
                  : 'none',
                cursor: tablet.state === 'glow' ? 'pointer' : 'default',
              }}
              animate={
                tablet.state === 'crumble' && !prm
                  ? { x: [-3, 3, -3, 3, 0], y: [0, 2, -2, 2, 0], opacity: [1, 0.6, 1, 0.4, 0] }
                  : tablet.state === 'glow' && !prm
                  ? { y: [0, -2, 0] }
                  : {}
              }
              transition={
                tablet.state === 'crumble'
                  ? { duration: 0.5 }
                  : { duration: 2 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }
              }
              onClick={() => handleTablet(i)}
            >
              <span className="font-body text-white text-[10px] text-center leading-tight">
                {tablet.label}
              </span>
              {/* Stone texture lines */}
              {(tablet.state === 'idle' || tablet.state === 'glow') && (
                <div className="absolute inset-0 rounded-xl opacity-10 pointer-events-none overflow-hidden">
                  {[...Array(4)].map((_, li) => (
                    <div
                      key={li}
                      className="absolute w-full h-px bg-white/40"
                      style={{ top: `${20 + li * 18}%` }}
                    />
                  ))}
                </div>
              )}
              {/* Crack overlay */}
              {tablet.state === 'crumble' && crackIdx === i && (
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  {[...Array(3)].map((_, ci) => (
                    <div
                      key={ci}
                      className="absolute bg-red-400/40 h-px"
                      style={{
                        width: `${40 + ci * 20}%`,
                        top:   `${25 + ci * 22}%`,
                        left:  `${ci * 10}%`,
                        transform: `rotate(${-15 + ci * 20}deg)`,
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          )
        })}

        {/* Statue body */}
        <motion.div
          className="absolute left-1/2 top-[8%] -translate-x-1/2 flex flex-col items-center"
          animate={!prm ? { scaleY: [1, 1.015, 1], scaleX: [1, 0.992, 1] } : {}}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: 'bottom center' }}
        >
          {/* Head */}
          <div
            className="relative w-16 h-16 rounded-t-full flex items-end justify-center pb-1 overflow-visible"
            style={{
              background: 'linear-gradient(180deg, #3a3550 0%, #1a1525 100%)',
              border:     `1.5px solid ${worldTheme.primaryColor}30`,
            }}
          >
            {/* Eyes */}
            <div className="absolute top-[35%] left-0 right-0 flex justify-center gap-4">
              {[0, 1].map(ei => (
                <motion.div
                  key={ei}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: eyesGlow ? worldTheme.primaryColor : '#2a2035',
                    boxShadow:  eyesGlow ? `0 0 8px ${worldTheme.primaryColor}, 0 0 16px ${worldTheme.primaryColor}88` : 'none',
                  }}
                  animate={eyesGlow && !prm ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              ))}
            </div>
            {/* Nose */}
            <div className="w-1.5 h-2 rounded-sm" style={{ background: '#2a2035' }} />
          </div>

          {/* Neck */}
          <div className="w-7 h-3" style={{ background: '#2a2035' }} />

          {/* Body */}
          <div
            className="w-20 h-24 rounded-b-lg flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #2a2035 0%, #120d1a 100%)',
              border:     `1.5px solid ${worldTheme.primaryColor}22`,
            }}
          >
            {/* Rune on chest */}
            <span
              className="font-display text-3xl select-none"
              style={{ color: eyesGlow ? worldTheme.primaryColor : `${worldTheme.primaryColor}40` }}
            >
              ᚠ
            </span>
            {/* Particle shimmer */}
            {eyesGlow && !prm && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${worldTheme.primaryColor}18 0%, transparent 65%)`,
                }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>

          {/* Base */}
          <div
            className="w-24 h-4 rounded-b-lg"
            style={{ background: '#0d0912', border: `1px solid ${worldTheme.primaryColor}20` }}
          />
        </motion.div>
      </div>

      {/* Typewriter question text */}
      <div className="mx-4 min-h-[64px] flex items-start justify-center px-2 mb-3">
        <p
          className="font-body text-white/75 text-center text-[13px] leading-relaxed"
          style={{
            textShadow: eyesGlow ? `0 0 8px ${worldTheme.primaryColor}55` : 'none',
          }}
        >
          {typed}
          {typed.length < (currentQ?.question.length ?? 0) && (
            <motion.span
              className="inline-block w-0.5 h-3.5 ml-0.5 align-middle"
              style={{ background: worldTheme.primaryColor }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </p>
      </div>

      {/* Instruction */}
      {eyesGlow && !answered && (
        <motion.p
          className="text-center font-body text-white/30 text-[10px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t('rooms.orakel_choose', 'Wähle eine Tafel')}
        </motion.p>
      )}
    </div>
  )
}
