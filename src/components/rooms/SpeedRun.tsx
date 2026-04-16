/**
 * SpeedRun.tsx – Adrenalin-Feel dungeon room
 *
 * 30s countdown. Questions fly in from the right with speed-lines.
 * Correct → +2s + sparkle + combo counter.
 * Wrong   → −3s + shard break.
 * Combo 5+ → flame border + rising sfx pitch.
 * End screen: star rating (1–3) with stagger + score count-up.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'

// ── Types ──────────────────────────────────────────────────────

export interface SpeedRunProps {
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

interface CardState {
  question: Question
  key: number
}

// ── Constants ─────────────────────────────────────────────────

const TIMER_START   = 30
const TIME_BONUS    = 2
const TIME_PENALTY  = 3
const COMBO_FLAME   = 5
const PITCH_STEP    = 0.06   // pitch increment per correct answer

// ── Helpers ───────────────────────────────────────────────────

function getOptions(q: Question): [string, string] {
  if (q.type === 'tf') return ['Wahr', 'Falsch']
  // MC: use first two options
  const opts = q.options ?? []
  return [opts[0] ?? 'A', opts[1] ?? 'B']
}

function isCorrect(q: Question, choice: string): boolean {
  if (q.type === 'tf') {
    const correct = q.correctAnswer === true || q.correctAnswer === 'true' || q.correctAnswer === 'Wahr'
    return correct ? choice === 'Wahr' : choice === 'Falsch'
  }
  return choice === q.correctAnswer
}

function starCount(score: number, total: number): number {
  const pct = total > 0 ? score / total : 0
  if (pct >= 0.8) return 3
  if (pct >= 0.5) return 2
  return 1
}

// ── Component ─────────────────────────────────────────────────

export default function SpeedRun({ questions, worldTheme, onComplete, onHit }: SpeedRunProps) {
  const { t }   = useTranslation()
  const feel    = useFeel()
  const prm     = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [timeLeft,  setTimeLeft]  = useState(TIMER_START)
  const [qIdx,      setQIdx]      = useState(0)
  const [combo,     setCombo]     = useState(0)
  const [score,     setScore]     = useState(0)
  const [cardKey,   setCardKey]   = useState(0)
  const [done,      setDone]      = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [countUp,   setCountUp]   = useState(0)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef    = useRef(0)
  const comboRef    = useRef(0)
  const pitchRef    = useRef(1)
  const doneRef     = useRef(false)
  const answeredRef = useRef(false)

  const currentQ = questions[qIdx] as Question | undefined

  // ── Timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (done) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const handleTimeout = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    sfx.resetPitch()
    const fs = scoreRef.current
    setFinalScore(fs)
    setDone(true)
    // count-up animation
    let n = 0
    const step = Math.max(1, Math.floor(fs / 30))
    const id = setInterval(() => {
      n = Math.min(n + step, fs)
      setCountUp(n)
      if (n >= fs) clearInterval(id)
    }, 40)
    bus.emit('roomComplete', { roomIndex: 5, score: fs, allCorrect: false })
    onComplete(fs)
  }, [onComplete])

  // ── Answer ─────────────────────────────────────────────────
  const handleAnswer = useCallback((choice: string) => {
    if (!currentQ || answeredRef.current || doneRef.current) return
    answeredRef.current = true

    const correct = isCorrect(currentQ, choice)
    const pts     = correct ? 10 + comboRef.current * 2 : 0

    if (correct) {
      comboRef.current += 1
      scoreRef.current += pts
      setCombo(comboRef.current)
      setScore(scoreRef.current)

      // pitch rises with combo
      if (comboRef.current >= COMBO_FLAME) {
        pitchRef.current = Math.min(2.0, 1 + (comboRef.current - COMBO_FLAME + 1) * PITCH_STEP)
        sfx.setPitch(pitchRef.current)
      }

      sfx.play('correct_soft')
      feel.haptic('tick')
      if (!prm) {
        feel.particles(
          { x: window.innerWidth / 2, y: window.innerHeight * 0.42 },
          'sparkle', 6
        )
        feel.floatText(`+${pts}`, { x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, '#FFD700', 1.1)
        if (comboRef.current >= COMBO_FLAME) {
          feel.particles(
            { x: window.innerWidth / 2, y: window.innerHeight * 0.45 },
            'fire', 5
          )
        }
      }
      setTimeLeft(prev => Math.min(TIMER_START + 10, prev + TIME_BONUS))

      bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: true, combo: comboRef.current })
    } else {
      comboRef.current = 0
      pitchRef.current = 1
      sfx.resetPitch()
      setCombo(0)
      sfx.play('wrong_thud')
      feel.haptic('fail')
      if (!prm) feel.shake('soft')
      onHit?.()
      setTimeLeft(prev => Math.max(1, prev - TIME_PENALTY))

      bus.emit('answerWrong', {
        questionIndex: qIdx,
        correctAnswer: String(currentQ.correctAnswer),
        givenAnswer:   choice,
      })
    }

    // Advance card
    setTimeout(() => {
      answeredRef.current = false
      setQIdx(prev => {
        const next = (prev + 1) % questions.length
        return next
      })
      setCardKey(k => k + 1)
    }, 250)
  }, [currentQ, qIdx, questions.length, prm, feel, onHit])

  // ── End on time ────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && !doneRef.current) handleTimeout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  // ── Timer color ────────────────────────────────────────────
  const timerColor = timeLeft <= 10 ? '#FF4444' : timeLeft <= 20 ? '#FFAA00' : worldTheme.primaryColor
  const timerPct   = Math.min(1, timeLeft / TIMER_START)

  // ── Stars ──────────────────────────────────────────────────
  const stars = done ? starCount(finalScore, questions.length * 14) : 0

  // ── Done screen ────────────────────────────────────────────
  if (done) {
    return (
      <div
        className="relative w-full min-h-[500px] flex flex-col items-center justify-center rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
      >
        <motion.p
          className="font-body text-white/50 text-sm mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t('rooms.speedrun_done', 'Zeit abgelaufen!')}
        </motion.p>

        {/* Stars */}
        <div className="flex gap-3 mb-6">
          {[1, 2, 3].map(n => (
            <motion.span
              key={n}
              className="text-4xl"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: n <= stars ? 1 : 0.5, rotate: 0, opacity: n <= stars ? 1 : 0.25 }}
              transition={{ delay: n * 0.22, type: 'spring', damping: 8 }}
            >
              ⭐
            </motion.span>
          ))}
        </div>

        {/* Score count-up */}
        <motion.div
          className="font-display text-5xl font-bold"
          style={{ color: worldTheme.primaryColor }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
        >
          {countUp}
        </motion.div>
        <p className="font-body text-white/30 text-xs mt-1">XP</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      className="relative w-full min-h-[500px] rounded-2xl overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
    >
      {/* Flame border at combo 5+ */}
      {combo >= COMBO_FLAME && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none z-10"
          style={{ boxShadow: `inset 0 0 24px 4px #FF6600aa, 0 0 32px 8px #FF440066` }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Timer bar */}
      <div className="relative h-2 mx-0 mb-0 rounded-t-2xl overflow-hidden bg-white/10">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: timerColor }}
          animate={{ width: `${timerPct * 100}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* Timer shake at ≤10s */}
      <motion.div
        className="flex items-center justify-center pt-2 pb-1"
        animate={timeLeft <= 10 && !prm ? { x: [-1, 1, -1, 1, 0] } : {}}
        transition={{ duration: 0.3, repeat: timeLeft <= 10 ? Infinity : 0, repeatDelay: 0.8 }}
      >
        <span className="font-display text-2xl font-bold tabular-nums" style={{ color: timerColor }}>
          {timeLeft}
        </span>
        <span className="font-body text-white/30 text-xs ml-1">s</span>
      </motion.div>

      {/* Combo bar */}
      <div className="flex items-center justify-center gap-1 mb-3 h-6">
        <AnimatePresence>
          {combo > 0 && (
            <motion.div
              key="combo"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: combo >= COMBO_FLAME ? '#FF4400aa' : `${worldTheme.primaryColor}30` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              {combo >= COMBO_FLAME && <span className="text-sm">🔥</span>}
              <span className="font-body text-white text-[11px] font-semibold">
                {combo}× COMBO
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Question card area */}
      <div className="relative h-[210px] mx-4 mb-4 overflow-hidden">
        {/* Speed lines */}
        {!prm && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`line-${cardKey}-${i}`}
                className="absolute h-px opacity-20"
                style={{
                  top: `${15 + i * 14}%`,
                  background: worldTheme.primaryColor,
                  width: `${30 + i * 10}%`,
                  right: 0,
                }}
                initial={{ scaleX: 0, transformOrigin: 'right' }}
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {currentQ && (
            <motion.div
              key={cardKey}
              className="absolute inset-0 rounded-xl border flex flex-col justify-center px-4"
              style={{
                borderColor: `${worldTheme.primaryColor}40`,
                background:  `${worldTheme.primaryColor}0d`,
              }}
              initial={{ x: 120, opacity: 0, rotate: 4 }}
              animate={{ x: 0,   opacity: 1, rotate: 0 }}
              exit={{    x: -120, opacity: 0, rotate: -4 }}
              transition={{ type: 'spring', damping: 16, stiffness: 200 }}
            >
              <p className="font-body text-white text-center text-[13px] leading-snug mb-6 px-2">
                {currentQ.question}
              </p>

              {/* Answer buttons */}
              <div className="flex gap-3 justify-center">
                {getOptions(currentQ).map((opt, i) => (
                  <motion.button
                    key={`${cardKey}-${i}`}
                    className="flex-1 max-w-[140px] py-2.5 rounded-xl border font-body text-[12px] font-semibold text-white"
                    style={{
                      borderColor: `${worldTheme.primaryColor}55`,
                      background:  `${worldTheme.primaryColor}18`,
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleAnswer(opt)}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Score */}
      <div className="flex justify-center">
        <span className="font-display text-xl font-bold" style={{ color: worldTheme.primaryColor }}>
          {score}
        </span>
        <span className="font-body text-white/30 text-xs self-end ml-1 mb-0.5">XP</span>
      </div>
    </div>
  )
}
