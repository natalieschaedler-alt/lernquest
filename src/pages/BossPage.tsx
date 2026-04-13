import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import HueterBoss from '../components/HueterBoss'

export default function BossPage() {
  const navigate = useNavigate()
  const questions = useGameStore((s) => s.questions)
  const addXP = useGameStore((s) => s.addXP)

  return (
    <div className="min-h-screen bg-dark text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <HueterBoss
          questions={questions}
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
