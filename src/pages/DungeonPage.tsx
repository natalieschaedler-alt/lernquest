import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import Wortwirbel from '../components/games/Wortwirbel'
import OrakelKristall from '../components/games/OrakelKristall'

type GameType = 'wortwirbel' | 'orakel'

function pickGameType(index: number): GameType {
  if (index >= 8) return 'wortwirbel'
  return Math.random() > 0.5 ? 'wortwirbel' : 'orakel'
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
  const answerQuestion = useGameStore((s) => s.answerQuestion)
  const nextQuestion = useGameStore((s) => s.nextQuestion)
  const addXP = useGameStore((s) => s.addXP)

  const [currentGameType, setCurrentGameType] = useState<GameType>(() => pickGameType(0))
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

  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = Math.min(questions.length, 10)
  const progress = (currentQuestionIndex / totalQuestions) * 100


  if (questions.length === 0) return null

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col">
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
                className="h-full bg-primary rounded-full"
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
                {currentGameType === 'wortwirbel' ? (
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

                      setTimeout(() => {
                        const state = useGameStore.getState()
                        if (state.playerHP === 0) {
                          navigate('/gameover', { replace: true })
                          return
                        }
                        if (currentQuestionIndex >= 9 || currentQuestionIndex >= questions.length - 1) {
                          navigate('/boss', { replace: true })
                          return
                        }
                        nextQuestion()
                        setCurrentGameType(pickGameType(currentQuestionIndex + 1))
                        setAnswered(false)
                        setSelectedAnswer(null)
                      }, 1200)
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

                      setTimeout(() => {
                        const state = useGameStore.getState()
                        if (state.playerHP === 0) {
                          navigate('/gameover', { replace: true })
                          return
                        }
                        if (currentQuestionIndex >= 9 || currentQuestionIndex >= questions.length - 1) {
                          navigate('/boss', { replace: true })
                          return
                        }
                        nextQuestion()
                        setCurrentGameType(pickGameType(currentQuestionIndex + 1))
                        setAnswered(false)
                        setSelectedAnswer(null)
                      }, 1200)
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
