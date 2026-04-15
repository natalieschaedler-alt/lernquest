import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { getWorldById } from '../data/worlds'
import type { Question } from '../types'
import Wortwirbel from '../components/games/Wortwirbel'
import OrakelKristall from '../components/games/OrakelKristall'
import MemoryKarten from '../components/games/MemoryKarten'
import LueckentextSpiel from '../components/games/LueckentextSpiel'
import WorldBackground from '../components/WorldBackground'

type GameType = 'wortwirbel' | 'orakel' | 'lueckentext'

function getGameForQuestion(q: Question | undefined): GameType | null {
  if (!q) return null
  const type = q.question_type
  if (type === 'tf') return 'orakel'
  if (type === 'fillblank') return 'lueckentext'
  return 'wortwirbel'
}

function pointsForDifficulty(difficulty: 1 | 2 | 3): number {
  return difficulty === 3 ? 30 : difficulty === 2 ? 20 : 10
}

export default function DungeonPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const questions = useGameStore((s) => s.questions)
  const playerHP = useGameStore((s) => s.playerHP)
  const score = useGameStore((s) => s.score)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const answerQuestion = useGameStore((s) => s.answerQuestion)
  const addXP = useGameStore((s) => s.addXP)

  const worldTheme = getWorldById(selectedWorldId)

  // Sortierung: Memory zuerst (als Block), dann MC-easy, MC-mittel, TF, Fill, MC-hard, Rest
  const orderedQuestions = useMemo<Question[]>(() => {
    const memory   = questions.filter((q) => q.question_type === 'memory')
    const easyMC   = questions.filter((q) => q.question_type === 'mc' && q.difficulty === 1)
    const mediumMC = questions.filter((q) => q.question_type === 'mc' && q.difficulty === 2)
    const tf       = questions.filter((q) => q.question_type === 'tf')
    const fill     = questions.filter((q) => q.question_type === 'fillblank')
    const hardMC   = questions.filter((q) => q.question_type === 'mc' && q.difficulty === 3)
    const noType   = questions.filter((q) => !q.question_type)
    return [...memory, ...easyMC, ...mediumMC, ...tf, ...fill, ...hardMC, ...noType]
  }, [questions])

  const memoryQuestions = useMemo(
    () => orderedQuestions.filter((q) => q.question_type === 'memory'),
    [orderedQuestions],
  )
  const nonMemoryQuestions = useMemo(
    () => orderedQuestions.filter((q) => q.question_type !== 'memory'),
    [orderedQuestions],
  )

  const hasMemory = memoryQuestions.length > 0
  const totalSteps = (hasMemory ? 1 : 0) + nonMemoryQuestions.length

  const [memoryDone, setMemoryDone] = useState(!hasMemory)
  const [nonMemoryIndex, setNonMemoryIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [combo, setCombo] = useState(0)
  const [showReward, setShowReward] = useState(false)
  const [rewardText, setRewardText] = useState('')

  // Guard: keine Fragen → Onboarding
  useEffect(() => {
    if (questions.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [questions.length, navigate])

  const currentStep = !memoryDone && hasMemory ? 0 : (hasMemory ? 1 : 0) + nonMemoryIndex
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  const currentQuestion: Question | undefined = nonMemoryQuestions[nonMemoryIndex]

  function handleNext(correct: boolean, points: number) {
    if (answered) return
    setAnswered(true)
    answerQuestion(correct, points)

    if (correct) {
      const newCombo = combo + 1
      setCombo(newCombo)
      const txt =
        newCombo >= 2
          ? `+${points} XP (${t('game.combo', { count: newCombo })})`
          : `+${points} XP`
      setRewardText(txt)
      setShowReward(true)
      addXP(points)
      setTimeout(() => setShowReward(false), 1000)
    } else {
      setCombo(0)
    }

    setTimeout(() => {
      const state = useGameStore.getState()
      if (state.playerHP === 0) {
        navigate('/gameover', { replace: true })
        return
      }
      if (nonMemoryIndex >= nonMemoryQuestions.length - 1) {
        navigate('/boss', { replace: true })
        return
      }
      setNonMemoryIndex((prev) => prev + 1)
      setAnswered(false)
    }, 1200)
  }

  if (questions.length === 0) return null

  // Keine Non-Memory-Fragen übrig → Boss
  if (memoryDone && !currentQuestion) {
    navigate('/boss', { replace: true })
    return null
  }

  const gameType = getGameForQuestion(currentQuestion)
  const roomLabel = t('game.room', { current: currentStep + 1, total: totalSteps })

  return (
    <div className="min-h-screen text-white flex flex-col">
      <WorldBackground />

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark/90 backdrop-blur-sm border-b border-dark-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* HP */}
          <div className="flex gap-1" aria-label={t('game.hp')}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="text-xl"
                animate={
                  i >= playerHP
                    ? { scale: [1, 0.7], opacity: 0.4 }
                    : { scale: 1, opacity: 1 }
                }
                transition={{ type: 'spring', damping: 12 }}
              >
                {i < playerHP ? '❤️' : '🖤'}
              </motion.span>
            ))}
          </div>

          {/* Progress */}
          <div className="flex-1 mx-4">
            <p className="text-center text-xs text-gray-400 mb-1">{roomLabel}</p>
            <div className="h-2 bg-dark-card rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: worldTheme.primaryColor }}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              />
            </div>
          </div>

          {/* Score */}
          <motion.div
            key={score}
            className="font-display text-lg text-secondary"
            initial={{ scale: 1.4, y: -4 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 12 }}
          >
            {t('game.score', { score })}
          </motion.div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex items-center justify-center pt-20 pb-8 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={!memoryDone ? 'memory' : `nm-${nonMemoryIndex}`}
            className="w-full max-w-lg"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {!memoryDone && hasMemory ? (
              <MemoryKarten
                questions={memoryQuestions}
                primaryColor={worldTheme.primaryColor}
                onComplete={(memScore) => {
                  addXP(memScore)
                  setRewardText(`+${memScore} XP`)
                  setShowReward(true)
                  setTimeout(() => setShowReward(false), 1000)
                  setMemoryDone(true)
                  setAnswered(false)
                }}
              />
            ) : currentQuestion && gameType === 'orakel' ? (
              <OrakelKristall
                questions={[currentQuestion]}
                onComplete={(orakelScore) => {
                  const correct = orakelScore > 0
                  const points = correct ? pointsForDifficulty(currentQuestion.difficulty) : 0
                  handleNext(correct, points)
                }}
              />
            ) : currentQuestion && gameType === 'lueckentext' ? (
              <LueckentextSpiel
                questions={[currentQuestion]}
                primaryColor={worldTheme.primaryColor}
                onComplete={(lueckScore) => {
                  handleNext(lueckScore > 0, lueckScore)
                }}
              />
            ) : currentQuestion ? (
              <Wortwirbel
                question={currentQuestion}
                onAnswer={(correct, points) => handleNext(correct, points ?? 10)}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Reward overlay ── */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50"
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -60, opacity: 0, scale: 1.3 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <span className="font-display text-2xl text-secondary drop-shadow-lg whitespace-nowrap">
              {rewardText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
