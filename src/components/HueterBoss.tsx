import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../types'
import { TIMER, BOSS as BOSS_CONFIG } from '../lib/gameConfig'

// ── Constants ──
const INTRO_DURATION = 2500
const VICTORY_DELAY = 2000
const DEFEAT_DELAY = 1500
const FOG_DURATION = 3000
const SPECIAL_OVERLAY_DURATION = 1500
const SHUFFLE_ANIM_DURATION = 600
const SHAKE_KEYFRAMES = [0, -8, 8, -8, 8, 0]

type SpecialAttack = 'time' | 'fog' | 'shuffle' | null

interface HueterBossProps {
  questions: Question[]
  onVictory: (score: number) => void
  onDefeat: () => void
  worldTheme?: WorldTheme
}

export default function HueterBoss(props: HueterBossProps) {
  const { questions, onVictory, onDefeat } = props
  const { t } = useTranslation()

  const bossEmoji = props.worldTheme?.bossEmoji ?? '🧙‍♂️'
  const bossName  = props.worldTheme?.bossName  ?? 'Der Weise Hüter'
  const bossColor = props.worldTheme?.primaryColor ?? '#6C3CE1'
  const availableAttacks = useMemo(
    () => props.worldTheme?.specialAttacks ?? [],
    [props.worldTheme?.specialAttacks]
  )

  const [phase, setPhase] = useState<'intro' | 'fight' | 'victory' | 'defeat'>('intro')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [bossHP, setBossHP] = useState<number>(BOSS_CONFIG.HP)
  const [shields, setShields] = useState<number>(BOSS_CONFIG.SHIELDS)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(TIMER.BOSS)
  const [specialAttack, setSpecialAttack] = useState<SpecialAttack>(null)
  const [showSpecialOverlay, setShowSpecialOverlay] = useState(false)
  const [fogActive, setFogActive] = useState(false)
  const [shuffleActive, setShuffleActive] = useState(false)
  const [correctStreak, setCorrectStreak] = useState(0)
  const [shakePlayer, setShakePlayer] = useState(false)
  const [shakeHueter, setShakeHueter] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef = useRef(false)
  const specialTriggeredRef = useRef(false)

  const currentQuestion = questions.length > 0
    ? questions[questionIdx % questions.length]
    : null

  // ── Intro ──
  useEffect(() => {
    const timeout = setTimeout(() => setPhase('fight'), INTRO_DURATION)
    return () => clearTimeout(timeout)
  }, [])

  // Declare callbacks before effects that reference them

  const triggerSpecialAttack = useCallback(() => {
    if (availableAttacks.length === 0) return
    const attack = availableAttacks[
      Math.floor(Math.random() * availableAttacks.length)
    ] as SpecialAttack
    setSpecialAttack(attack)
    setShowSpecialOverlay(true)

    if (attack === 'fog') setFogActive(true)
    if (attack === 'shuffle') {
      setShuffleActive(true)
      setTimeout(() => setShuffleActive(false), SHUFFLE_ANIM_DURATION)
    }

    setTimeout(() => setShowSpecialOverlay(false), SPECIAL_OVERLAY_DURATION)
  }, [availableAttacks])

  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (answeredRef.current && answerIndex !== -1) return
      if (!currentQuestion) return
      answeredRef.current = true
      setAnswered(true)
      setSelectedAnswer(answerIndex)

      if (timerRef.current) clearInterval(timerRef.current)

      const correct = answerIndex === currentQuestion.correctIndex

      setIsCorrect(correct)

      if (correct) {
        const newStreak = correctStreak + 1
        setCorrectStreak(newStreak)
        const newBossHP = bossHP - 1
        setBossHP(newBossHP)
        setScore((prev) => prev + 10)

        // Shake hueter
        setShakeHueter(true)
        setTimeout(() => setShakeHueter(false), 500)

        // Trigger special after 2nd correct answer (once per fight)
        if (
          newStreak === 2 &&
          !specialTriggeredRef.current &&
          availableAttacks.length > 0
        ) {
          specialTriggeredRef.current = true
          setTimeout(() => triggerSpecialAttack(), 800)
        }

        // Victory check
        if (newBossHP <= 0) {
          setTimeout(() => setPhase('victory'), 800)
          return
        }
      } else {
        setCorrectStreak(0)
        const newShields = shields - 1
        setShields(newShields)

        // Shake player
        setShakePlayer(true)
        setTimeout(() => setShakePlayer(false), 600)

        // Defeat check
        if (newShields <= 0) {
          setTimeout(() => setPhase('defeat'), 800)
          return
        }
      }

      // Next question
      setTimeout(() => {
        setQuestionIdx((prev) => prev + 1)
        setAnswered(false)
        setSelectedAnswer(null)
        setIsCorrect(null)
        setSpecialAttack(null)
      }, 1200)
    },
    [currentQuestion, correctStreak, bossHP, shields, triggerSpecialAttack, availableAttacks.length],
  )

  // ── Timer ──
  useEffect(() => {
    if (phase !== 'fight' || answered) return

    answeredRef.current = false
    const duration = specialAttack === 'time' ? TIMER.BOSS_FAST : TIMER.BOSS
    setTimeLeft(duration)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (!answeredRef.current) {
            answeredRef.current = true
            handleAnswer(-1)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIdx, answered, specialAttack])

  // ── Fog timer ──
  useEffect(() => {
    if (!fogActive) return
    const timeout = setTimeout(() => setFogActive(false), FOG_DURATION)
    return () => clearTimeout(timeout)
  }, [fogActive])

  // ── Victory/Defeat callbacks ──
  useEffect(() => {
    if (phase === 'victory') {
      const timeout = setTimeout(() => onVictory(score), VICTORY_DELAY)
      return () => clearTimeout(timeout)
    }
    if (phase === 'defeat') {
      const timeout = setTimeout(() => onDefeat(), DEFEAT_DELAY)
      return () => clearTimeout(timeout)
    }
  }, [phase, score, onVictory, onDefeat])

  // Timer SVG values
  const timerRadius = 24
  const timerCircumference = 2 * Math.PI * timerRadius
  const maxTime = specialAttack === 'time' ? TIMER.BOSS_FAST : TIMER.BOSS
  const timerOffset = timerCircumference * (1 - timeLeft / maxTime)
  const timerColor = timeLeft <= 5 ? '#FF6B35' : '#00C896'

  // Guard: no questions – BossPage already redirects, but be safe here without breaking hooks
  if (!questions || questions.length === 0) return null

  // ── Intro phase ──
  if (phase === 'intro') {
    return (
      <motion.div
        className="min-h-[500px] bg-dark-deep rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Dramatic shake */}
        <motion.div
          className="flex flex-col items-center"
          animate={{ x: [-5, 5, -5, 5, 0] }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <motion.span
            className="text-7xl"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {bossEmoji}
          </motion.span>

          <motion.p
            className="font-display text-xl text-white mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {t('boss.appears')}
          </motion.p>

          <motion.p
            className="font-body text-sm mt-2"
            style={{ color: bossColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {bossName}
          </motion.p>
        </motion.div>
      </motion.div>
    )
  }

  // ── Victory phase ──
  if (phase === 'victory') {
    return (
      <motion.div
        className="min-h-[500px] bg-dark-deep rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Confetti */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl pointer-events-none"
            style={{ left: `${(i * 5) % 100}%` }}
            initial={{ y: -20, opacity: 1 }}
            animate={{ y: 500, opacity: 0, rotate: 360 }}
            transition={{ duration: 2, delay: i * 0.1, ease: 'easeIn' }}
          >
            {['✨', '🎉', '⭐', '💎'][i % 4]}
          </motion.div>
        ))}

        <motion.span
          className="text-7xl"
          initial={{ scale: 1 }}
          animate={{ scale: 0, rotate: 720 }}
          transition={{ duration: 1, ease: 'easeIn' }}
        >
          {bossEmoji}
        </motion.span>

        <motion.p
          className="font-display text-2xl text-secondary mt-6"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          {t('boss.defeated')}
        </motion.p>
      </motion.div>
    )
  }

  // ── Defeat phase ──
  if (phase === 'defeat') {
    return (
      <motion.div
        className="min-h-[500px] bg-dark-deep rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <motion.p
          className="relative z-10 font-display text-xl text-white text-center px-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {t('boss.defeat_message')}
        </motion.p>
      </motion.div>
    )
  }

  const specialOverlayText =
    specialAttack === 'time'
      ? t('boss.special_time')
      : specialAttack === 'fog'
        ? t('boss.special_fog')
        : specialAttack === 'shuffle'
          ? t('boss.special_shuffle')
          : ''

  // Fight-Phase braucht eine Frage – defensiv absichern
  if (!currentQuestion) return null

  // ── Fight phase ──
  return (
    <div className="min-h-[500px] bg-dark-deep rounded-2xl relative overflow-hidden flex flex-col">
      {/* ── Boss HP ── */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-center text-xs text-gray-400 font-body mb-2">
          {t('boss.hp')}
        </p>
        <div className="flex justify-center gap-2">
          {Array.from({ length: BOSS_CONFIG.HP }).map((_, i) => (
            <motion.span
              key={i}
              className="text-xl"
              animate={
                i >= bossHP
                  ? { scale: [1, 0.7], opacity: 0.4 }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ type: 'spring', damping: 12 }}
            >
              {i < bossHP ? '❤️' : '🖤'}
            </motion.span>
          ))}
        </div>
      </div>

      {/* ── Hueter ── */}
      <div className="flex flex-col items-center py-2">
        <motion.span
          className="text-6xl"
          animate={
            shakeHueter
              ? { x: SHAKE_KEYFRAMES, filter: ['brightness(1)', 'brightness(2)', 'brightness(1)'] }
              : { y: [0, -6, 0] }
          }
          transition={
            shakeHueter
              ? { duration: 0.4 }
              : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ filter: `drop-shadow(0 0 20px ${bossColor})` }}
        >
          {bossEmoji}
        </motion.span>
        <p className="font-display text-sm mt-1" style={{ color: bossColor }}>
          {bossName}
        </p>
      </div>

      {/* ── Timer ── */}
      <div className="absolute top-4 right-4 z-10">
        <svg width="58" height="58" viewBox="0 0 58 58">
          <circle
            cx="29"
            cy="29"
            r={timerRadius}
            fill="none"
            stroke="#1A1A2E"
            strokeWidth="3"
          />
          <motion.circle
            cx="29"
            cy="29"
            r={timerRadius}
            fill="none"
            stroke={timerColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={timerCircumference}
            strokeDashoffset={timerOffset}
            transform="rotate(-90 29 29)"
            animate={{ stroke: timerColor }}
            transition={{ duration: 0.5 }}
          />
          <text
            x="29"
            y="29"
            textAnchor="middle"
            dominantBaseline="central"
            fill={timerColor}
            fontSize="14"
            fontWeight="700"
          >
            {timeLeft}
          </text>
        </svg>
      </div>

      {/* ── Question ── */}
      <div className="px-6 mt-2">
        <AnimatePresence mode="wait">
          <motion.h2
            key={questionIdx}
            className="text-center text-white font-body font-bold text-lg leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {currentQuestion.question}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* ── Answer buttons (2×2 grid) ── */}
      <div className="px-6 mt-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.answers.map((answer, i) => {
            const isSelected = selectedAnswer === i
            const isCorrectAnswer = i === currentQuestion.correctIndex
            let borderColor = '#0F3460'
            if (answered && isSelected && isCorrect) borderColor = '#00C896'
            if (answered && isSelected && !isCorrect) borderColor = '#FF6B35'
            if (answered && !isSelected && isCorrectAnswer) borderColor = '#00C896'

            return (
              <motion.button
                key={i}
                className="bg-dark-card border-2 rounded-xl p-4 text-white font-body text-sm text-left transition-colors"
                style={{ borderColor }}
                whileHover={!answered ? { scale: 1.03, borderColor: '#6C3CE1' } : undefined}
                whileTap={!answered ? { scale: 0.97 } : undefined}
                animate={
                  shuffleActive
                    ? { x: [0, 4, -4, 4, 0], rotate: [0, 2, -2, 0] }
                    : undefined
                }
                transition={shuffleActive ? { duration: 0.4 } : undefined}
                onClick={() => handleAnswer(i)}
                disabled={answered}
              >
                <span
                  style={{
                    opacity: fogActive && !answered ? 0 : 1,
                    transition: 'opacity 0.3s',
                  }}
                >
                  {answer}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── Player shields ── */}
      <motion.div
        className="px-6 pb-6 pt-4 flex justify-center gap-2"
        animate={shakePlayer ? { x: SHAKE_KEYFRAMES } : { x: 0 }}
        transition={shakePlayer ? { duration: 0.4 } : undefined}
      >
        {Array.from({ length: BOSS_CONFIG.SHIELDS }).map((_, i) => (
          <motion.span
            key={i}
            className="text-2xl"
            animate={
              i >= shields
                ? { scale: [1, 0.7], opacity: 0.3 }
                : { scale: 1, opacity: 1 }
            }
            transition={{ type: 'spring', damping: 12 }}
          >
            {i < shields ? '🛡️' : '💔'}
          </motion.span>
        ))}
      </motion.div>

      {/* ── Special attack overlay ── */}
      <AnimatePresence>
        {showSpecialOverlay && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <motion.div
              className="relative z-10 text-center"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <p className="font-display text-2xl text-white drop-shadow-lg">
                {specialOverlayText}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feedback overlay ── */}
      <AnimatePresence>
        {answered && isCorrect !== null && (
          <motion.div
            className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span
              className={`font-display text-lg ${isCorrect ? 'text-secondary' : 'text-accent'}`}
            >
              {isCorrect ? t('boss.hit') : t('boss.miss')}
            </span>
            {!isCorrect && currentQuestion.explanation && (
              <motion.p
                className="font-body text-xs text-center text-gray-300 bg-dark-card/80 rounded-lg px-3 py-1.5 max-w-xs"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
              >
                💡 {currentQuestion.explanation}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
