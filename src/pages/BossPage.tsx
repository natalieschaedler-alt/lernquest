import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { getWorldById } from '../data/worlds'
import HueterBoss from '../components/HueterBoss'
import { XP } from '../lib/gameConfig'
import { useTutorial } from '../hooks/useTutorial'
import TutorialTooltip from '../components/ui/TutorialTooltip'

export default function BossPage() {
  const navigate = useNavigate()
  const questions = useGameStore((s) => s.questions)
  const addXP = useGameStore((s) => s.addXP)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const worldTheme = getWorldById(selectedWorldId)
  const { isDone: tutorialDone, activeTip, showTip, dismissTip } = useTutorial()

  // Guard: keine Fragen (z.B. direkter Aufruf von /boss) → zurück zum Onboarding
  useEffect(() => {
    if (questions.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [questions.length, navigate])

  // Tutorial: boss_fight tip
  useEffect(() => {
    if (tutorialDone || questions.length === 0) return
    const id = setTimeout(() => showTip('boss_fight'), 800)
    return () => clearTimeout(id)
  }, [tutorialDone, showTip, questions.length])

  if (questions.length === 0) return null

  return (
    <motion.div
      className="min-h-screen bg-dark text-white flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-full max-w-lg">
        <HueterBoss
          questions={questions}
          worldTheme={worldTheme}
          onVictory={() => {
            addXP(XP.BOSS_DEFEAT)
            navigate('/victory', { replace: true })
          }}
          onDefeat={() => {
            navigate('/gameover', { replace: true })
          }}
        />
      </div>

      {/* Tutorial: boss_fight tip */}
      <TutorialTooltip
        visible={activeTip === 'boss_fight'}
        stepId={activeTip}
        onDismiss={dismissTip}
      />
    </motion.div>
  )
}
