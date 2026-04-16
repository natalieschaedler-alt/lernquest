import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useAuth } from '../hooks/useAuth'
import { useStreak } from '../hooks/useStreak'
import { useTutorial } from '../hooks/useTutorial'
import { getWorldById } from '../data/worlds'
import type { Question } from '../types'
import Wortwirbel from '../components/games/Wortwirbel'
import OrakelKristall from '../components/games/OrakelKristall'
import MemoryKarten from '../components/games/MemoryKarten'
import LueckentextSpiel from '../components/games/LueckentextSpiel'
import WorldBackground from '../components/WorldBackground'
import {
  pointsForDifficulty,
  XP, CRIT_CHANCE, GOLDEN_CHANCE, GOLDEN_MULTIPLIER, CRIT_MULTIPLIER, FAST_THRESHOLD_MS,
} from '../lib/gameConfig'
import { XpFloat } from '../components/ui/XpBar'
import { saveMistake } from '../lib/database'
import TutorialTooltip from '../components/ui/TutorialTooltip'
import HelpModal from '../components/ui/HelpModal'

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
  const recordQuestionResult = useGameStore((s) => s.recordQuestionResult)

  const worldTheme = getWorldById(selectedWorldId)
  const { trackActivity } = useStreak()
  const { isDone: tutorialDone, activeTip, showTip, dismissTip } = useTutorial()
  const [showHelp, setShowHelp] = useState(false)

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

  // ── Variable rewards ─────────────────────────────────────────
  const [isGoldenQuestion, setIsGoldenQuestion] = useState(false)
  const [xpFloatInfo, setXpFloatInfo] = useState<{ amount: number; isGolden: boolean; isCrit: boolean } | null>(null)
  const [critFlash, setCritFlash] = useState(false)
  const questionStartRef = useRef<number>(Date.now())

  // Guard: keine Fragen → Onboarding
  useEffect(() => {
    if (questions.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [questions.length, navigate])

  // Reset golden flag + start timer for each new question
  useEffect(() => {
    setIsGoldenQuestion(Math.random() < GOLDEN_CHANCE)
    questionStartRef.current = Date.now()
  }, [nonMemoryIndex])

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

  // ── Tutorial triggers ─────────────────────────────────────────────────────
  // Tip 1: First question — fires once when memory phase is done
  useEffect(() => {
    if (tutorialDone || !memoryDone) return
    const id = setTimeout(() => showTip('dungeon_q1'), 700)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryDone]) // intentionally narrow — fires once when memory clears

  // Tip 3: Room 2 — fires when the second non-memory question is reached
  useEffect(() => {
    if (tutorialDone || nonMemoryIndex !== 1) return
    const id = setTimeout(() => showTip('dungeon_room2'), 400)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonMemoryIndex]) // intentionally narrow

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

    // ── SM-2 tracking (before correct/wrong split) ─────────────
    const elapsed = Date.now() - questionStartRef.current
    const fast    = elapsed < FAST_THRESHOLD_MS
    const originalIndex = questions.findIndex((q) => q === currentQuestion)
    if (originalIndex >= 0) {
      recordQuestionResult(originalIndex, correct, fast)
    }

    if (correct) {
      void trackActivity('question')
      const newCombo = combo + 1
      setCombo(newCombo)

      // ── XP calculation ──────────────────────────────────────
      const isCrit  = Math.random() < CRIT_CHANCE
      const baseXP  = fast ? XP.QUESTION_FAST : XP.QUESTION_BASE
      const mult    = (isGoldenQuestion ? GOLDEN_MULTIPLIER : 1) * (isCrit ? CRIT_MULTIPLIER : 1)
      const finalXP = Math.round(baseXP * mult)

      addXP(finalXP)

      const comboSuffix = newCombo >= 2 ? ` (${t('game.combo', { count: newCombo })})` : ''
      setRewardText(`+${finalXP} XP${comboSuffix}`)
      setShowReward(true)
      setTimeout(() => setShowReward(false), 1200)

      // Flying XP text
      setXpFloatInfo({ amount: finalXP, isGolden: isGoldenQuestion, isCrit })

      // Critical flash
      if (isCrit) setCritFlash(true)

      // Tutorial tip 2: explain XP after the first correct answer
      if (!tutorialDone) setTimeout(() => showTip('dungeon_xp'), 1500)

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
  }, [answered, answerQuestion, user, currentWorldId, nonMemoryIndex, combo, t, addXP, completeDailyChallenge, navigate, nonMemoryQuestions.length, trackActivity, isGoldenQuestion, tutorialDone, showTip, questions, currentQuestion, recordQuestionResult])

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

          {/* Score + Help + Quit */}
          <div className="flex items-center gap-2">
            <motion.div
              key={score}
              className="font-display text-lg text-secondary"
              style={activeTip === 'dungeon_xp' ? {
                filter: 'drop-shadow(0 0 10px #00C896)',
                color:  '#00C896',
              } : {}}
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
              onClick={() => setShowHelp(true)}
              aria-label={t('tutorial.help_title')}
              className="font-body text-xs text-gray-500 hover:text-white transition-colors cursor-pointer border border-dark-border rounded-lg px-2 py-1 bg-transparent"
            >
              ?
            </button>
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
            {/* Golden question banner */}
            {isGoldenQuestion && !memoryDone && (
              <motion.div
                className="flex items-center justify-center gap-1.5 mb-2 py-1 rounded-xl font-body font-bold text-xs"
                style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.35)' }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                ✨ {t('xp.golden_question')}
              </motion.div>
            )}
            <div
              style={isGoldenQuestion && !memoryDone ? {
                boxShadow: '0 0 28px rgba(255,215,0,0.35)',
                borderRadius: 16,
                outline: '1.5px solid rgba(255,215,0,0.45)',
              } : {}}
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
            </div>
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

      {/* ── Critical hit flash ── */}
      <AnimatePresence>
        {critFlash && (
          <motion.div
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            onAnimationComplete={() => setCritFlash(false)}
            style={{ background: 'rgba(255,107,53,0.25)' }}
          >
            <motion.p
              className="font-display"
              style={{ fontSize: 52, color: '#FF6B35', textShadow: '0 0 40px #FF6B3599' }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.55 }}
            >
              {t('xp.crit_hit')}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flying XP float ── */}
      {xpFloatInfo && (
        <XpFloat
          amount={xpFloatInfo.amount}
          isGolden={xpFloatInfo.isGolden}
          isCrit={xpFloatInfo.isCrit}
          onDone={() => setXpFloatInfo(null)}
        />
      )}

      {/* ── Reward overlay (combo text) ── */}
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

      {/* ── Tutorial tooltips ── */}
      <TutorialTooltip
        visible={activeTip !== null && ['dungeon_q1', 'dungeon_xp', 'dungeon_room2'].includes(activeTip ?? '')}
        stepId={activeTip}
        onDismiss={dismissTip}
      />

      {/* ── Quick-help modal ── */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
