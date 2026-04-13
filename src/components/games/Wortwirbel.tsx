import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { soundManager } from '../../utils/soundManager'

// ── Constants ──
const TIMER_DURATION = 30
const TIMER_WARN_THRESHOLD = 10
const BUBBLE_MIN_SIZE = 85
const BUBBLE_COLORS = ['#2D1B69', '#1B3A2D', '#3A1B2D', '#1B2D3A', '#2D2A1B', '#1B1B3A']
const FAKE_LABELS = ['🌟 Wähle weise...', '❓ Nicht sicher?']
const FLOAT_DURATION_MIN = 3
const FLOAT_DURATION_MAX = 6
const SHAKE_KEYFRAMES = [0, -10, 10, -10, 0]
const COMBO_BONUS_X2 = 5
const COMBO_BONUS_X3 = 10

interface WortswirbelProps {
  question: Question
  onAnswer: (correct: boolean, points: number) => void
}

interface Bubble {
  id: number
  text: string
  type: 'answer' | 'fake'
  answerIndex: number | null
  color: string
  x: number
  y: number
  floatDuration: number
  floatOffsetX: number
  floatOffsetY: number
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function pointsForDifficulty(difficulty: 1 | 2 | 3): number {
  return difficulty === 3 ? 30 : difficulty === 2 ? 20 : 10
}

export default function Wortwirbel({ question, onAnswer }: WortswirbelProps) {
  const { t } = useTranslation()

  const [answered, setAnswered] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [comboCount, setComboCount] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [showTrap, setShowTrap] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef = useRef(false)

  // Generate bubbles from question with grid-based positioning to avoid clumping
  const bubbles = useMemo<Bubble[]>(() => {
    // 6 slots in a 3×2 grid with jitter for organic feel
    const gridPositions = [
      { x: 5, y: 5 },   { x: 35, y: 5 },   { x: 65, y: 5 },
      { x: 5, y: 45 },  { x: 35, y: 45 },  { x: 65, y: 45 },
    ]
    const shuffledPositions = shuffleArray(gridPositions)

    const answerBubbles: Bubble[] = question.answers.map((text, i) => ({
      id: i,
      text,
      type: 'answer' as const,
      answerIndex: i,
      color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      x: shuffledPositions[i].x + randomBetween(-5, 5),
      y: shuffledPositions[i].y + randomBetween(-5, 5),
      floatDuration: randomBetween(FLOAT_DURATION_MIN, FLOAT_DURATION_MAX),
      floatOffsetX: randomBetween(-20, 20),
      floatOffsetY: randomBetween(-15, 15),
    }))

    const fakeBubbles: Bubble[] = FAKE_LABELS.map((text, i) => ({
      id: question.answers.length + i,
      text,
      type: 'fake' as const,
      answerIndex: null,
      color: BUBBLE_COLORS[(question.answers.length + i) % BUBBLE_COLORS.length],
      x: shuffledPositions[question.answers.length + i].x + randomBetween(-5, 5),
      y: shuffledPositions[question.answers.length + i].y + randomBetween(-5, 5),
      floatDuration: randomBetween(FLOAT_DURATION_MIN, FLOAT_DURATION_MAX),
      floatOffsetX: randomBetween(-20, 20),
      floatOffsetY: randomBetween(-15, 15),
    }))

    return shuffleArray([...answerBubbles, ...fakeBubbles])
  }, [question])

  // Timer
  useEffect(() => {
    answeredRef.current = false
    setTimeLeft(TIMER_DURATION)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (!answeredRef.current) {
            answeredRef.current = true
            setAnswered(true)
            setIsCorrect(false)
            onAnswer(false, 0)
          }
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [question, onAnswer])

  const handleBubbleClick = useCallback(
    (bubble: Bubble) => {
      if (answered) return
      answeredRef.current = true
      setAnswered(true)
      setSelectedId(bubble.id)

      if (timerRef.current) clearInterval(timerRef.current)

      if (bubble.type === 'fake') {
        setIsCorrect(false)
        setShowTrap(true)
        setComboCount(0)
        setTimeout(() => setShowTrap(false), 1500)
        onAnswer(false, 0)
        return
      }

      const correct = bubble.answerIndex === question.correctIndex
      setIsCorrect(correct)

      if (correct) {
        soundManager.playCorrect()
        const newCombo = comboCount + 1
        setComboCount(newCombo)

        const basePoints = pointsForDifficulty(question.difficulty)
        const bonus =
          newCombo >= 3 ? COMBO_BONUS_X3 : newCombo >= 2 ? COMBO_BONUS_X2 : 0
        const totalPoints = basePoints + bonus

        if (newCombo >= 3) {
          setShowCombo(true)
          setTimeout(() => setShowCombo(false), 1200)
        }

        onAnswer(true, totalPoints)
      } else {
        soundManager.playWrong()
        setComboCount(0)
        onAnswer(false, 0)
      }
    },
    [answered, question, comboCount, onAnswer],
  )

  // Timer SVG values
  const timerRadius = 20
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerOffset = timerCircumference * (1 - timeLeft / TIMER_DURATION)
  const timerColor = timeLeft <= TIMER_WARN_THRESHOLD ? '#FF6B35' : '#00C896'

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl bg-[#0D0A1A]">
      {/* Subtle particle background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/30"
            style={{
              left: `${randomBetween(5, 95)}%`,
              top: `${randomBetween(5, 95)}%`,
            }}
            animate={{
              opacity: [0.2, 0.6, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: randomBetween(2, 5),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: randomBetween(0, 3),
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="absolute top-4 right-4 z-10">
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle
            cx="25"
            cy="25"
            r={timerRadius}
            fill="none"
            stroke="#1A1A2E"
            strokeWidth="3"
          />
          <motion.circle
            cx="25"
            cy="25"
            r={timerRadius}
            fill="none"
            stroke={timerColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={timerCircumference}
            strokeDashoffset={timerOffset}
            transform="rotate(-90 25 25)"
            animate={{ stroke: timerColor }}
            transition={{ duration: 0.5 }}
          />
          <text
            x="25"
            y="25"
            textAnchor="middle"
            dominantBaseline="central"
            fill={timerColor}
            fontSize="12"
            fontWeight="700"
          >
            {timeLeft}
          </text>
        </svg>
      </div>

      {/* Question */}
      <motion.h2
        className="relative z-10 text-center text-white font-body font-bold text-xl px-6 pt-6 pb-2 leading-relaxed line-clamp-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {question.question}
      </motion.h2>

      {/* Bubbles */}
      <div className="relative w-full h-[300px] mt-2">
        {bubbles.map((bubble) => {
          const isSelected = selectedId === bubble.id
          // Determine animation state after answer
          let animateProps: Record<string, unknown> = {
            x: [0, bubble.floatOffsetX, 0],
            y: [0, bubble.floatOffsetY, 0],
            rotate: [-5, 5, -5],
          }
          let transitionProps: Record<string, unknown> = {
            duration: bubble.floatDuration,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }

          if (answered) {
            if (isSelected && isCorrect) {
              // Correct: burst and vanish
              animateProps = { scale: [1, 1.5, 0], opacity: [1, 1, 0] }
              transitionProps = { duration: 0.5, ease: 'easeOut' }
            } else if (isSelected && !isCorrect) {
              // Wrong: shake red
              animateProps = { x: SHAKE_KEYFRAMES }
              transitionProps = { duration: 0.4, ease: 'easeInOut' }
            } else {
              // Other bubbles fade out
              animateProps = { opacity: 0 }
              transitionProps = { duration: 0.4 }
            }
          }

          return (
            <motion.button
              key={bubble.id}
              className="absolute flex items-center justify-center rounded-full border-none cursor-pointer"
              style={{
                width: BUBBLE_MIN_SIZE,
                height: BUBBLE_MIN_SIZE,
                left: `${bubble.x}%`,
                top: `${bubble.y}%`,
                backgroundColor: bubble.color,
                boxShadow:
                  answered && isSelected && isCorrect
                    ? '0 0 30px #00C896, 0 0 60px #00C896'
                    : answered && isSelected && !isCorrect
                      ? '0 0 20px #FF6B35'
                      : '0 4px 15px rgba(0,0,0,0.3)',
              }}
              animate={animateProps as import('motion/react').TargetAndTransition}
              transition={transitionProps}
              whileHover={!answered ? { scale: 1.1 } : undefined}
              whileTap={!answered ? { scale: 0.95 } : undefined}
              onClick={() => handleBubbleClick(bubble)}
              disabled={answered}
            >
              <span className="text-white text-[11px] font-body font-semibold text-center px-2 leading-tight">
                {bubble.text}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Combo overlay */}
      <AnimatePresence>
        {showCombo && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: [0.5, 1.2, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span className="font-display text-3xl text-secondary drop-shadow-lg">
              {t('game.combo', { count: comboCount })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trap feedback */}
      <AnimatePresence>
        {showTrap && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="font-body text-accent text-sm font-bold bg-dark-card/90 px-4 py-2 rounded-full">
              Das war eine Falle! 😄
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time's up feedback */}
      <AnimatePresence>
        {timeLeft === 0 && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="font-display text-lg text-accent">
              {t('game.time_up')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
