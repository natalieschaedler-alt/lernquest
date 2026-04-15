import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { soundManager } from '../../utils/soundManager'
import { TIMER } from '../../lib/gameConfig'

// ── Constants ──
const TOTAL_QUESTIONS = 10
const SCORE_SCREEN_DURATION = 2000
const SWIPE_THRESHOLD = 50
const CRYSTAL_SIZE = 120
const CRYSTAL_EMOJI_SIZE = 72
const SHAKE_KEYFRAMES = [0, -10, 10, -10, 0]

interface OrakelKristallProps {
  questions: Question[]
  onComplete: (score: number, mistakes: number[]) => void
}

interface Statement {
  text: string
  isTrue: boolean
  questionIndex: number
}

function generateStatement(question: Question): Statement {
  const showCorrect = Math.random() > 0.5

  if (showCorrect) {
    return {
      text: question.answers[question.correctIndex],
      isTrue: true,
      questionIndex: 0,
    }
  }

  // Pick a random wrong answer
  const wrongIndices = question.answers
    .map((_, i) => i)
    .filter((i) => i !== question.correctIndex)
  const wrongIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)]

  return {
    text: question.answers[wrongIndex],
    isTrue: false,
    questionIndex: 0,
  }
}

export default function OrakelKristall({ questions, onComplete }: OrakelKristallProps) {
  const { t } = useTranslation()

  const limitedQuestions = useMemo(
    () => questions.slice(0, TOTAL_QUESTIONS),
    [questions],
  )

  const statements = useMemo<Statement[]>(
    () =>
      limitedQuestions.map((q, i) => {
        const stmt = generateStatement(q)
        return { ...stmt, questionIndex: i }
      }),
    [limitedQuestions],
  )

  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [dragX, setDragX] = useState(0)
  const [, setIsDragging] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const [mistakes, setMistakes] = useState<number[]>([])
  const [timerKey, setTimerKey] = useState(0)

  const answeredRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const currentStatement = statements[currentIdx]

  // Declare handleAnswer before the timer effect that references it
  const handleAnswer = useCallback(
    (userSaysTrue: boolean | null) => {
      if (answeredRef.current || showScore) return
      answeredRef.current = true
      setAnswered(true)

      // null = timeout → always wrong
      const correct =
        userSaysTrue !== null && userSaysTrue === currentStatement.isTrue

      setIsCorrect(correct)

      if (correct) {
        soundManager.playCorrect()
        const newCombo = comboCount + 1
        setComboCount(newCombo)
        setScore((prev) => prev + 1)

        if (newCombo >= 3) {
          setShowCombo(true)
          setTimeout(() => setShowCombo(false), 1200)
        }
      } else {
        soundManager.playWrong()
        setComboCount(0)
        setMistakes((prev) => [...prev, currentIdx])
      }

      // Advance after feedback
      setTimeout(() => {
        if (currentIdx >= limitedQuestions.length - 1) {
          const finalScore = correct ? score + 1 : score
          const finalMistakes = correct ? mistakes : [...mistakes, currentIdx]
          // Skip score screen when used as single-question mode (e.g. from DungeonPage)
          if (limitedQuestions.length === 1) {
            onComplete(finalScore, finalMistakes)
            return
          }
          setShowScore(true)
          setTimeout(() => {
            onComplete(finalScore, finalMistakes)
          }, SCORE_SCREEN_DURATION)
        } else {
          setCurrentIdx((prev) => prev + 1)
          setAnswered(false)
          setIsCorrect(null)
          setDragX(0)
          setTimerKey((prev) => prev + 1)
          answeredRef.current = false
        }
      }, 800)
    },
    [currentStatement, comboCount, currentIdx, limitedQuestions.length, score, mistakes, onComplete, showScore],
  )

  // Timer: auto-fail when time runs out
  useEffect(() => {
    if (answered || showScore) return

    answeredRef.current = false
    const timeout = setTimeout(() => {
      if (!answeredRef.current) {
        handleAnswer(null)
      }
    }, TIMER.ORAKEL * 1000)

    return () => clearTimeout(timeout)
  }, [currentIdx, answered, showScore, handleAnswer])

  // Keyboard shortcuts: Y/J/ArrowRight → true, N/ArrowLeft → false
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (answered || showScore) return
      const key = e.key.toLowerCase()
      if (key === 'y' || key === 'j' || key === 'arrowright') {
        e.preventDefault()
        handleAnswer(true)
      } else if (key === 'n' || key === 'arrowleft') {
        e.preventDefault()
        handleAnswer(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [answered, showScore, handleAnswer])

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (answeredRef.current) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || answeredRef.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    setDragX(dx)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || answeredRef.current) return
    setIsDragging(false)

    if (dragX < -SWIPE_THRESHOLD) {
      handleAnswer(false)
    } else if (dragX > SWIPE_THRESHOLD) {
      handleAnswer(true)
    }

    setDragX(0)
    touchStartRef.current = null
  }, [dragX, handleAnswer])

  // Crystal background color based on answer state
  const crystalBg =
    isCorrect === true
      ? 'radial-gradient(circle, rgba(0,200,150,0.4) 0%, transparent 70%)'
      : isCorrect === false
        ? 'radial-gradient(circle, rgba(255,107,53,0.4) 0%, transparent 70%)'
        : 'radial-gradient(circle, rgba(108,60,225,0.4) 0%, transparent 70%)'

  const crystalGlow =
    isCorrect === true
      ? '0 0 40px rgba(0,200,150,0.6), 0 0 80px rgba(0,200,150,0.3)'
      : isCorrect === false
        ? '0 0 30px rgba(255,107,53,0.5)'
        : '0 0 20px rgba(108,60,225,0.4)'

  // Guard: no questions to display
  if (limitedQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white font-body">
        <p className="text-center px-6 text-gray-400">{t('game.no_tf_questions')}</p>
      </div>
    )
  }

  if (showScore) {
    const finalScore = score
    return (
      <motion.div
        className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl bg-dark-deep flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <motion.div
            className="text-6xl mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            💎
          </motion.div>
          <motion.p
            className="font-display text-2xl text-white mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {t('game.result', { score: finalScore, total: limitedQuestions.length })}
          </motion.p>
          <motion.p
            className="font-body text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {finalScore >= 8 ? '🌟' : finalScore >= 5 ? '👍' : '💪'}
          </motion.p>
        </div>
      </motion.div>
    )
  }

  return (
    <div
      className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl bg-dark-deep select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Particle background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/20"
            style={{
              left: `${(i * 8 + 5) % 95}%`,
              top: `${(i * 13 + 10) % 90}%`,
            }}
            animate={{
              opacity: [0.1, 0.5, 0.1],
              scale: [0.8, 1.3, 0.8],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      {/* Progress */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <p className="text-center text-xs text-gray-400 mb-2 font-body">
          {currentIdx + 1} / {limitedQuestions.length}
        </p>
      </div>

      {/* Timer bar */}
      <div className="absolute top-12 left-4 right-4 z-10">
        <div className="w-full h-1.5 bg-dark-card rounded-full overflow-hidden">
          <motion.div
            key={timerKey}
            className="h-full bg-primary rounded-full"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: TIMER.ORAKEL, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Question context */}
      <div className="relative z-10 pt-20 px-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIdx}
            className="text-center text-gray-400 text-xs font-body mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            🔮 {limitedQuestions[currentIdx]?.question}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Crystal */}
      <div className="relative z-10 flex flex-col items-center justify-center mt-4">
        <motion.div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: CRYSTAL_SIZE,
            height: CRYSTAL_SIZE,
            background: crystalBg,
            boxShadow: crystalGlow,
          }}
          animate={
            isCorrect === false
              ? { x: SHAKE_KEYFRAMES }
              : isCorrect === true
                ? { scale: [1, 1.2, 1] }
                : { y: [0, -12, 0] }
          }
          transition={
            isCorrect !== null
              ? { duration: 0.4, ease: 'easeInOut' }
              : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          }
          drag={!answered ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDrag={(_, info) => {
            if (!answeredRef.current) setDragX(info.offset.x)
          }}
          onDragEnd={(_, info) => {
            if (answeredRef.current) return
            if (info.offset.x < -SWIPE_THRESHOLD) {
              handleAnswer(false)
            } else if (info.offset.x > SWIPE_THRESHOLD) {
              handleAnswer(true)
            }
            setDragX(0)
          }}
        >
          <span style={{ fontSize: CRYSTAL_EMOJI_SIZE }}>💎</span>
        </motion.div>

        {/* Swipe hint indicators */}
        <div className="flex justify-between w-full max-w-xs mt-2 px-4">
          <motion.span
            className="text-xs text-accent/50 font-body"
            animate={{ opacity: dragX < -20 ? 1 : 0.3 }}
          >
            ← {t('game.false', 'Falsch')}
          </motion.span>
          <motion.span
            className="text-xs text-secondary/50 font-body"
            animate={{ opacity: dragX > 20 ? 1 : 0.3 }}
          >
            {t('game.true', 'Wahr')} →
          </motion.span>
        </div>
      </div>

      {/* Statement */}
      <div className="relative z-10 px-6 mt-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIdx}
            className="text-center text-white font-body font-bold text-lg leading-relaxed max-w-[300px] mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStatement?.text}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Answer buttons */}
      <div className="relative z-10 flex justify-center gap-6 mt-8 px-6">
        <motion.button
          className="flex flex-col items-center justify-center bg-accent/80 text-white font-body font-bold rounded-xl"
          style={{ width: 120, height: 56 }}
          whileTap={!answered ? { scale: 0.92 } : undefined}
          whileHover={!answered ? { scale: 1.05 } : undefined}
          onClick={() => handleAnswer(false)}
          disabled={answered}
        >
          <span>❌ {t('game.false', 'Falsch')}</span>
          <span className="text-[9px] opacity-50 mt-0.5">[N / ←]</span>
        </motion.button>

        <motion.button
          className="flex flex-col items-center justify-center bg-secondary/80 text-white font-body font-bold rounded-xl"
          style={{ width: 120, height: 56 }}
          whileTap={!answered ? { scale: 0.92 } : undefined}
          whileHover={!answered ? { scale: 1.05 } : undefined}
          onClick={() => handleAnswer(true)}
          disabled={answered}
        >
          <span>✅ {t('game.true', 'Wahr')}</span>
          <span className="text-[9px] opacity-50 mt-0.5">[Y / →]</span>
        </motion.button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {answered && isCorrect !== null && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span
              className={`font-display text-lg ${isCorrect ? 'text-secondary' : 'text-accent'}`}
            >
              {isCorrect ? t('game.correct_simple') : t('game.wrong_simple')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explanation panel – shown after answering */}
      <AnimatePresence>
        {answered && limitedQuestions[currentIdx]?.explanation && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-20 bg-dark-card/95 backdrop-blur-sm rounded-b-2xl px-4 py-3 border-t border-dark-border"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <p className="text-[11px] text-gray-300 font-body leading-snug">
              <span className="text-secondary mr-1">💡</span>
              {limitedQuestions[currentIdx].explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo overlay */}
      <AnimatePresence>
        {showCombo && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
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
    </div>
  )
}
