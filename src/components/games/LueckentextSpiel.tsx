import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Question } from '../../types'
import { soundManager } from '../../utils/soundManager'

interface LueckentextSpielProps {
  questions:    Question[]
  primaryColor: string
  onComplete:   (score: number, mistakes: number) => void
}

interface FillItem {
  sentence: string
  answer:   string
  hint:     string
}

type Mode = 'choose' | 'type'
type FeedbackState = 'idle' | 'correct' | 'wrong'

const MAX_QUESTIONS      = 8
const POINTS_CORRECT     = 30
const POINTS_HINT_PENALTY = 5
const WRONG_REVEAL_DELAY = 1500
const CORRECT_ADVANCE_DELAY = 900
const BLANK_TOKEN = '___'

function extractItems(questions: Question[]): FillItem[] {
  const items: FillItem[] = []
  for (const q of questions) {
    if (q.question_type !== 'fillblank') continue
    const sentence = q.question
    const answer   = q.fillblank_answer ?? q.answers[0]
    const hint     = q.fillblank_hint ?? ''
    if (!sentence || !answer) continue
    items.push({ sentence, answer, hint })
    if (items.length >= MAX_QUESTIONS) break
  }
  return items
}

function shuffleArray<T>(arr: T[]): T[] {
  const s = [...arr]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

function buildChoices(correct: string, allAnswers: string[]): string[] {
  const pool = allAnswers.filter((a) => a.toLowerCase().trim() !== correct.toLowerCase().trim())
  const distractors = shuffleArray(pool).slice(0, 3)
  while (distractors.length < 3) {
    distractors.push('—')
  }
  return shuffleArray([correct, ...distractors])
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function splitSentence(sentence: string): [string, string] {
  const idx = sentence.indexOf(BLANK_TOKEN)
  if (idx === -1) return [sentence, '']
  return [sentence.slice(0, idx), sentence.slice(idx + BLANK_TOKEN.length)]
}

export default function LueckentextSpiel({ questions, primaryColor, onComplete }: LueckentextSpielProps) {
  const items = useMemo(() => extractItems(questions), [questions])
  const allAnswers = useMemo(() => items.map((it) => it.answer), [items])

  const [mode, setMode] = useState<Mode>('choose')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [typedAnswer, setTypedAnswer] = useState('')
  const [hintUsed, setHintUsed] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const lockRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = items[currentIdx]
  const choices = useMemo(
    () => (current ? buildChoices(current.answer, allAnswers) : []),
    [current, allAnswers],
  )
  const [beforeBlank, afterBlank] = useMemo(
    () => (current ? splitSentence(current.sentence) : ['', '']),
    [current],
  )

  useEffect(() => {
    if (mode === 'type' && feedback === 'idle' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode, currentIdx, feedback])

  const advance = useCallback(() => {
    setTypedAnswer('')
    setHintUsed(false)
    setShowHint(false)
    setRevealedAnswer(null)
    setFeedback('idle')
    lockRef.current = false

    if (currentIdx >= items.length - 1) {
      setIsComplete(true)
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }, [currentIdx, items.length])

  const submitAnswer = useCallback(
    (given: string) => {
      if (lockRef.current || !current) return
      lockRef.current = true

      const isCorrect = normalize(given) === normalize(current.answer)

      if (isCorrect) {
        soundManager.playCorrect()
        const points = hintUsed ? POINTS_CORRECT - POINTS_HINT_PENALTY : POINTS_CORRECT
        setScore((s) => s + points)
        setFeedback('correct')
        setTimeout(advance, CORRECT_ADVANCE_DELAY)
      } else {
        soundManager.playWrong()
        setMistakes((m) => m + 1)
        setFeedback('wrong')
        setRevealedAnswer(current.answer)
        setTimeout(advance, WRONG_REVEAL_DELAY)
      }
    },
    [current, hintUsed, advance],
  )

  const handleTypeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!typedAnswer.trim()) return
      submitAnswer(typedAnswer)
    },
    [typedAnswer, submitAnswer],
  )

  const handleChoiceClick = useCallback(
    (choice: string) => {
      submitAnswer(choice)
    },
    [submitAnswer],
  )

  const handleHintClick = useCallback(() => {
    if (hintUsed || !current?.hint) return
    setHintUsed(true)
    setShowHint(true)
  }, [hintUsed, current],
  )

  const toggleMode = useCallback(() => {
    if (feedback !== 'idle') return
    setMode((m) => (m === 'choose' ? 'type' : 'choose'))
    setTypedAnswer('')
  }, [feedback])

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white font-body">
        <p className="text-center px-6">
          Keine Lückentext-Fragen verfügbar.
        </p>
      </div>
    )
  }

  if (isComplete) {
    const correctCount = items.length - mistakes
    const accuracy = Math.round((correctCount / items.length) * 100)
    return (
      <motion.div
        className="relative w-full min-h-[400px] bg-[#0D0A1A] rounded-2xl p-6 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl max-w-sm"
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          style={{ backgroundColor: '#1A1A2E', border: `2px solid ${primaryColor}` }}
        >
          <span className="text-5xl">📝</span>
          <h2 className="font-display text-2xl text-white text-center">
            Lückentext geschafft!
          </h2>
          <div className="flex flex-col items-center gap-1 text-white font-body">
            <div className="flex items-center gap-2 text-lg">
              <span>⭐</span>
              <span className="tabular-nums font-bold">{score} Punkte</span>
            </div>
            <div className="text-sm text-gray-300 tabular-nums">
              {correctCount} / {items.length} richtig ({accuracy}%)
            </div>
            {mistakes > 0 && (
              <div className="text-sm text-gray-400 tabular-nums">
                {mistakes} {mistakes === 1 ? 'Fehler' : 'Fehler'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onComplete(score, mistakes)}
            className="mt-2 px-6 py-3 rounded-xl text-white font-body font-bold cursor-pointer border-none"
            style={{ backgroundColor: primaryColor, boxShadow: `0 4px 20px ${primaryColor}66` }}
          >
            Weiter →
          </button>
        </motion.div>
      </motion.div>
    )
  }

  const blankStyle: React.CSSProperties =
    feedback === 'correct'
      ? {
          backgroundColor: 'rgba(0, 200, 150, 0.25)',
          border: '2px solid #00C896',
          color: '#00C896',
        }
      : feedback === 'wrong'
        ? {
            backgroundColor: 'rgba(255, 80, 80, 0.25)',
            border: '2px dashed #FF5050',
            color: '#FF9090',
          }
        : {
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: `2px dashed ${primaryColor}`,
            color: '#FFFFFF',
          }

  return (
    <div className="relative w-full min-h-[400px] bg-[#0D0A1A] rounded-2xl p-4 overflow-hidden">
      {/* Header: Progress + Score + Mode Toggle */}
      <div className="flex justify-between items-center mb-6 px-2 gap-2">
        <div className="flex items-center gap-3 text-white font-body font-semibold">
          <span className="text-sm text-gray-400 tabular-nums">
            {currentIdx + 1} / {items.length}
          </span>
          <div className="flex items-center gap-1">
            <span>⭐</span>
            <span className="tabular-nums">{score}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          disabled={feedback !== 'idle'}
          className="px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-white border-none cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: mode === 'choose' ? '#2A2A3E' : primaryColor,
          }}
        >
          {mode === 'choose' ? '⌨️ Tippen' : '✅ Wählen'}
        </button>
      </div>

      {/* Sentence with blank */}
      <div className="px-4 mb-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIdx}
            className="font-body text-white text-lg leading-relaxed text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <span>{beforeBlank}</span>
            {mode === 'type' ? (
              <form onSubmit={handleTypeSubmit} className="inline-block align-middle mx-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={feedback === 'wrong' && revealedAnswer ? revealedAnswer : typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  disabled={feedback !== 'idle'}
                  className="inline-block font-body font-bold text-center rounded-md px-2 py-1 outline-none"
                  style={{
                    ...blankStyle,
                    minWidth: '120px',
                    fontSize: '18px',
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </form>
            ) : (
              <motion.span
                key={feedback}
                className="inline-block align-middle mx-1 font-body font-bold rounded-md px-3 py-1 tabular-nums"
                style={{ ...blankStyle, minWidth: '120px' }}
                animate={
                  feedback === 'wrong'
                    ? { x: [0, -8, 8, -8, 0] }
                    : feedback === 'correct'
                      ? { scale: [1, 1.08, 1] }
                      : undefined
                }
                transition={{ duration: 0.4 }}
              >
                {feedback === 'correct' || feedback === 'wrong'
                  ? revealedAnswer ?? current.answer
                  : '______'}
              </motion.span>
            )}
            <span>{afterBlank}</span>
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Hint section */}
      {current.hint && (
        <div className="flex flex-col items-center gap-2 mb-4 px-4">
          {!showHint ? (
            <button
              type="button"
              onClick={handleHintClick}
              disabled={hintUsed || feedback !== 'idle'}
              className="text-xs font-body text-gray-400 hover:text-white underline cursor-pointer bg-transparent border-none disabled:opacity-50 disabled:no-underline"
            >
              💡 Hinweis zeigen (-{POINTS_HINT_PENALTY} Punkte)
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-body text-yellow-300 text-center px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(255, 220, 100, 0.1)' }}
            >
              💡 {current.hint}
            </motion.div>
          )}
        </div>
      )}

      {/* Answer input area */}
      {mode === 'choose' ? (
        <div className="grid grid-cols-2 gap-3 px-2 mt-2">
          {choices.map((choice, i) => {
            const isCorrectChoice = feedback !== 'idle' && normalize(choice) === normalize(current.answer)
            const isWrongChoice =
              feedback === 'wrong' &&
              normalize(choice) !== normalize(current.answer)
            return (
              <motion.button
                key={`${currentIdx}-${i}-${choice}`}
                type="button"
                onClick={() => handleChoiceClick(choice)}
                disabled={feedback !== 'idle'}
                whileTap={feedback === 'idle' ? { scale: 0.96 } : undefined}
                whileHover={feedback === 'idle' ? { scale: 1.02 } : undefined}
                className="px-3 py-3 rounded-xl text-white font-body font-semibold cursor-pointer border-none text-sm leading-tight disabled:cursor-default"
                style={{
                  backgroundColor:
                    feedback !== 'idle' && isCorrectChoice
                      ? 'rgba(0, 200, 150, 0.3)'
                      : isWrongChoice
                        ? 'rgba(255, 80, 80, 0.15)'
                        : '#1A1A2E',
                  border:
                    feedback !== 'idle' && isCorrectChoice
                      ? '2px solid #00C896'
                      : '1px solid #2A2A3E',
                  opacity: feedback !== 'idle' && !isCorrectChoice ? 0.5 : 1,
                }}
              >
                {choice}
              </motion.button>
            )
          })}
        </div>
      ) : (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={() => submitAnswer(typedAnswer)}
            disabled={feedback !== 'idle' || !typedAnswer.trim()}
            className="px-6 py-3 rounded-xl text-white font-body font-bold cursor-pointer border-none disabled:opacity-40"
            style={{ backgroundColor: primaryColor, boxShadow: `0 4px 15px ${primaryColor}55` }}
          >
            Bestätigen
          </button>
        </div>
      )}

      {/* Feedback message */}
      <AnimatePresence>
        {feedback !== 'idle' && (
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span
              className="font-display text-base"
              style={{ color: feedback === 'correct' ? '#00C896' : '#FF6B6B' }}
            >
              {feedback === 'correct' ? '✨ Richtig!' : `Richtig wäre: ${current.answer}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
