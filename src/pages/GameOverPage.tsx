import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../stores/gameStore'

export default function GameOverPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const score = useGameStore((s) => s.score)
  const questions = useGameStore((s) => s.questions)
  const resetGame = useGameStore((s) => s.resetGame)

  // useState lazy init: Math.random only called once, satisfies react-hooks/purity
  const [quoteIndex] = useState(() => Math.floor(Math.random() * 3))
  const quote = useMemo(() => t(`gameover.quote_${quoteIndex}`), [t, quoteIndex])

  // Show the first 3 non-memory questions the player faced in this run.
  // currentQuestionIndex is not reliably updated mid-game, so we show from the start.
  const learnedQuestions = useMemo(() => {
    return questions
      .filter((q) => q.question_type !== 'memory')
      .slice(0, 3)
  }, [questions])

  const stagger = 0.2

  return (
    <main
      className="min-h-screen text-white flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #2D1117 0%, #1A1A2E 50%, #1A1A2E 100%)',
      }}
    >
      {/* Title */}
      <motion.h1
        className="font-display text-white text-center"
        style={{ fontSize: '36px' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, delay: stagger * 0 }}
      >
        {t('gameover.title')}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-gray-400 text-center mt-2"
        style={{ fontSize: '16px' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 1 }}
      >
        {t('gameover.subtitle')}
      </motion.p>

      {/* Score */}
      <motion.p
        className="font-display mt-4"
        style={{ fontSize: '22px', color: '#6C3CE1' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 2 }}
      >
        {t('game.score', { score })}
      </motion.p>

      {/* Learned Summary */}
      {learnedQuestions.length > 0 && (
        <motion.div
          className="bg-dark-card rounded-xl p-4 mt-6 w-full"
          style={{ maxWidth: '400px' }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: stagger * 3 }}
        >
          <p className="font-display text-white mb-3" style={{ fontSize: '16px' }}>
            {t('gameover.learned')}
          </p>
          <ul className="space-y-2">
            {learnedQuestions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="shrink-0 mt-0.5">✅</span>
                <span>{q.question}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Motivation Quote */}
      <motion.p
        className="text-center mt-6 italic"
        style={{ fontSize: '16px', color: '#A78BFA', maxWidth: '350px' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 4 }}
      >
        {quote}
      </motion.p>

      {/* Buttons */}
      <motion.div
        className="flex flex-wrap justify-center gap-4 mt-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: stagger * 5 }}
      >
        <motion.button
          onClick={() => {
            resetGame()
            navigate('/dungeon', { replace: true })
          }}
          className="font-body font-bold text-white cursor-pointer border-none whitespace-nowrap"
          style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 28px', borderRadius: '50px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('gameover.retry')}
        </motion.button>

        <motion.button
          onClick={() => {
            resetGame()
            navigate('/onboarding', { replace: true })
          }}
          className="font-body font-bold text-white cursor-pointer border border-dark-border whitespace-nowrap"
          style={{ fontSize: '16px', background: 'transparent', padding: '14px 28px', borderRadius: '50px' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('gameover.new_world')}
        </motion.button>
      </motion.div>
    </main>
  )
}
