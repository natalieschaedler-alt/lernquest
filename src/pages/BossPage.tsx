import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { getWorldById } from '../data/worlds'
import HueterBoss from '../components/HueterBoss'

export default function BossPage() {
  const navigate = useNavigate()
  const questions = useGameStore((s) => s.questions)
  const addXP = useGameStore((s) => s.addXP)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const worldTheme = getWorldById(selectedWorldId)

  return (
    <div className="min-h-screen bg-dark text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <HueterBoss
          questions={questions}
          worldTheme={worldTheme}
          onVictory={(score) => {
            addXP(score)
            navigate('/victory', { replace: true })
          }}
          onDefeat={() => {
            navigate('/gameover', { replace: true })
          }}
        />
      </div>
    </div>
  )
}
