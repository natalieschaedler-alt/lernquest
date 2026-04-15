import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useAuth } from '../hooks/useAuth'
import { getWorldById } from '../data/worlds'
import type { Question } from '../types'
import Wortwirbel from '../components/games/Wortwirbel'
import OrakelKristall from '../components/games/OrakelKristall'
import MemoryKarten from '../components/games/MemoryKarten'
import LueckentextSpiel from '../components/games/LueckentextSpiel'
import WorldBackground from '../components/WorldBackground'
import { pointsForDifficulty } from '../lib/gameConfig'
import { saveMistake } from '../lib/database'

type GameType = 'wortwirbel' | 'orakel' | 'lueckentext'

function getGameForQuestion(q: Question | undefined): GameType | null {
  if (!q) return null
  const type = q.question_type
  if (type === 'tf') return 'orakel'
  if (type === 'fillblank') return 'lueckentext'
  return 'wortwirbel'
}

export default function DungeonPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  const questions = useGameStore((s) => s.questions)
  const playerHP = useGameStore((s) => s.playerHP)
  const score = useGameStore((s) => s.score)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const currentWorldId = useGameStore((s) => s.currentWorldId)
  const answerQuestion = useGameStore((s) => s.answerQuestion)
  const addXP = useGameStore((s) => s.addXP)
  const resetGame = useGameStore((s) => s.resetGame)
  const initDailyChallenge = useGameStore((s) => s.initDailyChallenge)
  const completeDailyChallenge = useGameStore((s) => s.completeDailyChallenge)
  const dailyChallenge = useGameStore((s) => s.dailyChallenge)

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
  const [tabHidden, setTabHidden] = useState(false)

  // Guard: keine Fragen → Onboarding
  useEffect(() => {
    if (questions.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [questions.length, navigate])

  // Ensure daily challenge exists when entering the dungeon
  useEffect(() => {
    initDailyChallenge()
  }, [initDailyChallenge])

  // Pause-Banner when user switches tabs (timer games are still running in HueterBoss,
  // but we can at least warn the user in the dungeon phase)
  useEffect(() => {
    const handleVisibility = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const currentStep = !memoryDone && hasMemory ? 0 : (hasMemory ? 1 : 0) + nonMemoryIndex
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  const currentQuestion: Question | undefined = nonMemoryQuestions[nonMemoryIndex]

  const handleNext = useCallback((correct: boolean, points: number) => {
    if (answered) return
    setAnswered(true)
    answerQuestion(correct, points)

    // Spaced repetition: persist wrong answers for logged-in users
    if (!correct && user && currentWorldId && !currentWorldId.startsWith('local-')) {
      void saveMistake(user.id, currentWorldId, nonMemoryIndex)
    }

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

      // Mark combo_3 daily challenge complete when 3x combo is reached
      if (newCombo >= 3) {
        const dc = useGameStore.getState().dailyChallenge
        if (dc && !dc.completed && dc.type === 'combo_3') {
          completeDailyChallenge()
        }
      }
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
  }, [answered, answerQuestion, user, currentWorldId, nonMemoryIndex, combo, t, addXP, completeDailyChallenge, navigate, nonMemoryQuestions.length])

  const handleMemoryComplete = useCallback((memScore: number) => {
    addXP(memScore)
    setRewardText(`+${memScore} XP`)
    setShowReward(true)
    setTimeout(() => setShowReward(false), 1000)
    setMemoryDone(true)
    setAnswered(false)
  }, [addXP])

  const handleOrakelComplete = useCallback((orakelScore: number) => {
    if (!currentQuestion) return
    const correct = orakelScore > 0
    const points = correct ? pointsForDifficulty(currentQuestion.difficulty) : 0
    handleNext(correct, points)
  }, [currentQuestion, handleNext])

  const handleLueckentextComplete = useCallback((lueckScore: number) => {
    handleNext(lueckScore > 0, lueckScore)
  }, [handleNext])

  const handleWortwirbel = useCallback((correct: boolean, points?: number) => {
    handleNext(correct, points ?? 10)
  }, [handleNext])

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

          {/* Score + Quit */}
          <div className="flex items-center gap-3">
            <motion.div
              key={score}
              className="font-display text-lg text-secondary"
              initial={{ scale: 1.4, y: -4 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              aria-live="polite"
              aria-atomic="true"
            >
              {t('game.score', { score })}
            </motion.div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('dungeon.quit_confirm'))) {
                  resetGame()
                  navigate('/onboarding', { replace: true })
                }
              }}
              aria-label={t('dungeon.quit')}
              className="font-body text-xs text-gray-500 hover:text-white transition-colors cursor-pointer border border-dark-border rounded-lg px-2 py-1 bg-transparent"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Daily challenge strip */}
        {dailyChallenge && !dailyChallenge.completed && (
          <div className="max-w-2xl mx-auto mt-1 flex items-center gap-2 px-1">
            <span className="text-xs text-yellow-400/70 font-body whitespace-nowrap">
              🎯 {t(dailyChallenge.descKey)}
            </span>
          </div>
        )}
        {dailyChallenge?.completed && (
          <div className="max-w-2xl mx-auto mt-1 flex items-center gap-2 px-1">
            <span className="text-xs text-secondary font-body">
              ✓ {t('profile.challenge_done')}
            </span>
          </div>
        )}
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
                onComplete={handleMemoryComplete}
              />
            ) : currentQuestion && gameType === 'orakel' ? (
              <OrakelKristall
                questions={[currentQuestion]}
                onComplete={handleOrakelComplete}
              />
            ) : currentQuestion && gameType === 'lueckentext' ? (
              <LueckentextSpiel
                questions={[currentQuestion]}
                primaryColor={worldTheme.primaryColor}
                onComplete={handleLueckentextComplete}
              />
            ) : currentQuestion ? (
              <Wortwirbel
                question={currentQuestion}
                onAnswer={handleWortwirbel}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Tab-hidden pause overlay ── */}
      <AnimatePresence>
        {tabHidden && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-dark/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <div className="text-5xl mb-4">⏸️</div>
              <p className="font-display text-white text-2xl">{t('game.paused')}</p>
              <p className="font-body text-white/60 mt-2">{t('game.tab_return')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reward overlay ── */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            role="status"
            aria-live="assertive"
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
