import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question } from '../../types'
import { soundManager } from '../../utils/soundManager'
import { shuffleArray } from '../../utils/shuffleArray'

interface MemoryKartenProps {
  questions:    Question[]
  primaryColor: string
  onComplete:   (score: number, timeSeconds: number) => void
}

interface Pair {
  term:       string
  definition: string
}

interface Card {
  id:        string
  pairId:    number
  text:      string
  type:      'term' | 'definition'
  isFlipped: boolean
  isMatched: boolean
}

const MAX_PAIRS = 8
const MIN_PAIRS = 3
const MATCH_CONFIRM_DELAY = 300
const MISMATCH_HIDE_DELAY = 900
const POINTS_PER_PAIR = 20

function extractPairs(questions: Question[]): Pair[] {
  const memoryPairs: Pair[] = []
  for (const q of questions) {
    if (q.question_type === 'memory') {
      const term = q.memory_term ?? q.question
      const definition = q.memory_definition ?? q.answers[0]
      if (term && definition) memoryPairs.push({ term, definition })
    }
    if (memoryPairs.length >= MAX_PAIRS) break
  }

  if (memoryPairs.length < MIN_PAIRS) {
    for (const q of questions) {
      if (q.question_type === 'memory') continue
      const term = q.question
      const definition = q.answers[q.correctIndex]
      if (term && definition) memoryPairs.push({ term, definition })
      if (memoryPairs.length >= MIN_PAIRS) break
    }
  }

  return memoryPairs.slice(0, MAX_PAIRS)
}

function buildCards(pairs: Pair[]): Card[] {
  const cards: Card[] = []
  pairs.forEach((p, pairId) => {
    cards.push({ id: `${pairId}-t`, pairId, text: p.term,       type: 'term',       isFlipped: false, isMatched: false })
    cards.push({ id: `${pairId}-d`, pairId, text: p.definition, type: 'definition', isFlipped: false, isMatched: false })
  })
  return shuffleArray(cards)
}

export default function MemoryKarten({ questions, primaryColor, onComplete }: MemoryKartenProps) {
  const { t } = useTranslation()
  const pairs = useMemo(() => extractPairs(questions), [questions])
  const [cards, setCards] = useState<Card[]>(() => buildCards(pairs))
  const [flippedIds, setFlippedIds] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [lockInput, setLockInput] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const completedRef = useRef(false)

  // Timer läuft hoch, stoppt bei Completion
  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isComplete])

  // Completion-Check: alle gematcht?
  // queueMicrotask defers setState out of the synchronous effect body (react-hooks/immutability)
  useEffect(() => {
    if (cards.length === 0 || completedRef.current) return
    if (cards.every((c) => c.isMatched)) {
      completedRef.current = true
      queueMicrotask(() => setIsComplete(true))
    }
  }, [cards])

  const handleCardClick = useCallback(
    (card: Card) => {
      if (lockInput || card.isMatched || card.isFlipped) return
      if (flippedIds.length >= 2) return

      const newFlippedIds = [...flippedIds, card.id]
      setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, isFlipped: true } : c)))
      setFlippedIds(newFlippedIds)

      if (newFlippedIds.length === 2) {
        setLockInput(true)
        const [firstId, secondId] = newFlippedIds
        const first  = cards.find((c) => c.id === firstId)
        const second = card.id === secondId ? card : cards.find((c) => c.id === secondId)

        if (first && second && first.pairId === second.pairId) {
          soundManager.playCorrect()
          setTimeout(() => {
            setCards((cs) =>
              cs.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isMatched: true }
                  : c,
              ),
            )
            setScore((s) => s + POINTS_PER_PAIR)
            setFlippedIds([])
            setLockInput(false)
          }, MATCH_CONFIRM_DELAY)
        } else {
          soundManager.playWrong()
          setTimeout(() => {
            setCards((cs) =>
              cs.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isFlipped: false }
                  : c,
              ),
            )
            setFlippedIds([])
            setLockInput(false)
          }, MISMATCH_HIDE_DELAY)
        }
      }
    },
    [cards, flippedIds, lockInput],
  )

  const gridCols = pairs.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'

  if (pairs.length < MIN_PAIRS) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white font-body">
        <p className="text-center px-6 text-gray-400">
          {t('game.no_memory_pairs', { min: MIN_PAIRS })}
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full min-h-[400px] bg-dark-deep rounded-2xl p-4 overflow-hidden">
      {/* Header: Timer + Score */}
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2 text-white font-body font-semibold">
          <span className="text-xl">⏱</span>
          <span className="text-lg tabular-nums">{seconds}s</span>
        </div>
        <div className="flex items-center gap-2 text-white font-body font-semibold">
          <span className="text-xl">⭐</span>
          <span className="text-lg tabular-nums">{score}</span>
        </div>
      </div>

      {/* Grid */}
      <div className={`grid ${gridCols} gap-2 md:gap-3`}>
        {cards.map((card) => {
          const showFront = card.isFlipped || card.isMatched
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(card)}
              disabled={lockInput || card.isMatched}
              className="relative aspect-square rounded-lg border-none bg-transparent p-0 cursor-pointer"
              style={{ perspective: 800 }}
            >
              <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: showFront ? 180 : 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              >
                {/* Rückseite */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-lg"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    backgroundColor: primaryColor,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  }}
                >
                  <span className="text-white font-display text-3xl font-bold">?</span>
                </div>
                {/* Vorderseite */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-lg p-2"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    backgroundColor: '#1A1A2E', // = dark
                    border: card.isMatched ? '2px solid #00C896' : '1px solid #2A2A3E', // secondary / dark-elevated
                    boxShadow: card.isMatched ? '0 0 15px rgba(0,200,150,0.5)' : '0 4px 15px rgba(0,0,0,0.3)',
                  }}
                >
                  <span className="text-white font-body text-center leading-tight" style={{ fontSize: '11px' }}>
                    {card.text}
                  </span>
                </div>
              </motion.div>
            </button>
          )
        })}
      </div>

      {/* Ergebnis-Screen */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-20 bg-dark-deep/90 backdrop-blur-sm rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-dark"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              style={{ border: `2px solid ${primaryColor}` }}
            >
              <span className="text-5xl">🎉</span>
              <h2 className="font-display text-2xl text-white text-center">
                {t('game.memory_complete', { pairs: pairs.length, seconds })}
              </h2>
              <div className="flex items-center gap-2 text-white font-body text-lg">
                <span>⭐</span>
                <span className="tabular-nums font-bold">{t('game.points', { score })}</span>
              </div>
              <button
                type="button"
                onClick={() => onComplete(score, seconds)}
                className="mt-2 px-6 py-3 rounded-xl text-white font-body font-bold cursor-pointer border-none"
                style={{ backgroundColor: primaryColor, boxShadow: `0 4px 20px ${primaryColor}66` }}
              >
                {t('game.continue')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
