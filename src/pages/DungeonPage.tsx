import { useState, useEffect, useMemo, useRef } from 'react'
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

type GameType = 'wortwirbel' | 'orakel' | 'memory' | 'lueckentext'

function pickGameType(question: Question): GameType {
  if (question.question_type === 'memory')    return 'memory'
  if (question.question_type === 'fillblank') return 'lueckentext'
  if (question.question_type === 'tf')        return 'orakel'
  return 'wortwirbel'
}

function pointsForDifficulty(difficulty: 1 | 2 | 3): number {
  return difficulty === 3 ? 30 : difficulty === 2 ? 20 : 10
}

export default function DungeonPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const questions = useGameStore((s) => s.questions)
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex)
  const playerHP = useGameStore((s) => s.playerHP)
  const score = useGameStore((s) => s.score)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const totalSessions = useGameStore((s) => s.totalSessions)
  const answerQuestion = useGameStore((s) => s.answerQuestion)
  const nextQuestion = useGameStore((s) => s.nextQuestion)
  const addXP = useGameStore((s) => s.addXP)

  const worldTheme = getWorldById(selectedWorldId)

  // Staircase-Difficulty: easy → medium → hard
  const orderedQuestions = useMemo(() => {
    const easy   = questions.filter((q) => q.difficulty === 1)
    const medium = questions.filter((q) => q.difficulty === 2)
    const hard   = questions.filter((q) => q.difficulty === 3)
    return [...easy, ...medium, ...hard]
  }, [questions])

  const memoryQuestions = useMemo(
    () => orderedQuestions.filter((q) => q.question_type === 'memory'),
    [orderedQuestions],
  )
  const fillblankQuestions = useMemo(
    () => orderedQuestions.filter((q) => q.question_type === 'fillblank'),
    [orderedQuestions],
  )

  // Adaptiver Einstieg: erfahrene Spieler überspringen die ersten zwei Fragen
  const startIndex =
    totalSessions >= 20 && orderedQuestions.length > 0
      ? Math.min(2, orderedQuestions.length - 1)
      : 0
  const initialSyncRef = useRef(false)

  const [showReward, setShowReward] = useState(false)
  const [rewardText, setRewardText] = useState('')
  const [combo, setCombo] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [, setSelectedAnswer] = useState<number | null>(null)

  // Guard: no questions → onboarding
  useEffect(() => {
    if (questions.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [questions.length, navigate])

  // Einmaliger Sync des Einstiegsindex
  useEffect(() => {
    if (initialSyncRef.current) return
    if (orderedQuestions.length === 0) return
    initialSyncRef.current = true
    if (currentQuestionIndex === 0 && startIndex > 0) {
      useGameStore.setState({ currentQuestionIndex: startIndex })
    }
  }, [orderedQuestions.length, currentQuestionIndex, startIndex])

  const currentQuestion = orderedQuestions[currentQuestionIndex]
  const totalQuestions = Math.min(orderedQuestions.length, 10)
  const progress = (currentQuestionIndex / totalQuestions) * 100

  const currentGameType: GameType = currentQuestion
    ? pickGameType(currentQuestion)
    : 'wortwirbel'

  function triggerReward(text: string) {
    setRewardText(text)
    setShowReward(true)
    setTimeout(() => setShowReward(false), 1000)
  }

  function advanceSingle() {
    const state = useGameStore.getState()
    if (state.playerHP === 0) {
      navigate('/gameover', { replace: true })
      return
    }
    if (currentQuestionIndex >= 9 || currentQuestionIndex >= orderedQuestions.length - 1) {
      navigate('/boss', { replace: true })
      return
    }
    nextQuestion()
    setAnswered(false)
    setSelectedAnswer(null)
  }

  function advanceAfterBulk(skipType: 'memory' | 'fillblank') {
    const remainingNonSkip = orderedQuestions
      .slice(currentQuestionIndex + 1)
      .filter((q) => q.question_type !== skipType).length

    if (remainingNonSkip < 3) {
      navigate('/boss', { replace: true })
      return
    }

    let nextIdx = currentQuestionIndex + 1
    while (
      nextIdx < orderedQuestions.length &&
      orderedQuestions[nextIdx].question_type === skipType
    ) {
      nextIdx++
    }

    useGameStore.setState({ currentQuestionIndex: nextIdx })
    setAnswered(false)
    setSelectedAnswer(null)
  }

  if (questions.length === 0) return null

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
            <p className="text-center text-xs text-gray-400 mb-1">
              {t('game.room', { current: currentQuestionIndex + 1, total: totalQuestions })}
            </p>
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
            key={currentQuestionIndex}
            className="w-full max-w-lg"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {currentQuestion && (
              <>
                {currentGameType === 'memory' ? (
                  <MemoryKarten
                    questions={memoryQuestions}
                    primaryColor={worldTheme.primaryColor}
                    onComplete={(memScore) => {
                      if (answered) return
                      setAnswered(true)
                      addXP(memScore)
                      triggerReward(`+${memScore} XP`)
                      setTimeout(() => advanceAfterBulk('memory'), 1200)
                    }}
                  />
                ) : currentGameType === 'lueckentext' ? (
                  <LueckentextSpiel
                    questions={fillblankQuestions}
                    primaryColor={worldTheme.primaryColor}
                    onComplete={(lueckScore) => {
                      if (answered) return
                      setAnswered(true)
                      addXP(lueckScore)
                      triggerReward(`+${lueckScore} XP`)
                      setTimeout(() => advanceAfterBulk('fillblank'), 1200)
                    }}
                  />
                ) : currentGameType === 'wortwirbel' ? (
                  <Wortwirbel
                    question={currentQuestion}
                    onAnswer={(correct, points) => {
                      if (answered) return
                      setAnswered(true)

                      answerQuestion(correct, points)

                      if (correct) {
                        const newCombo = combo + 1
                        setCombo(newCombo)
                        const text =
                          newCombo >= 2
                            ? `+${points} XP (${t('game.combo', { count: newCombo })})`
                            : `+${points} XP`
                        setRewardText(text)
                        setShowReward(true)
                        addXP(points)
                        setTimeout(() => setShowReward(false), 1000)
                      } else {
                        setCombo(0)
                      }

                      setTimeout(advanceSingle, 1200)
                    }}
                  />
                ) : (
                  <OrakelKristall
                    questions={[currentQuestion]}
                    onComplete={(orakelScore, _orakelMistakes) => {
                      if (answered) return
                      setAnswered(true)

                      const correct = orakelScore > 0
                      const points = correct ? pointsForDifficulty(currentQuestion.difficulty) : 0

                      answerQuestion(correct, points)

                      if (correct) {
                        const newCombo = combo + 1
                        setCombo(newCombo)
                        const text =
                          newCombo >= 2
                            ? `+${points} XP (${t('game.combo', { count: newCombo })})`
                            : `+${points} XP`
                        setRewardText(text)
                        setShowReward(true)
                        addXP(points)
                        setTimeout(() => setShowReward(false), 1000)
                      } else {
                        setCombo(0)
                      }

                      setTimeout(advanceSingle, 1200)
                    }}
                  />
                )}
              </>
            )}
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
