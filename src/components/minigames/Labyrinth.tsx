/**
 * Labyrinth – "Wissens-Labyrinth"
 *
 * Top-Down-Grid (6x6). Spieler startet oben-links, Ziel = Schatz unten-rechts.
 * An 5 Kreuzungen stehen Fragen. Richtige Antwort = Pfad öffnet, falsch =
 * Sackgasse, -3 Sekunden Zeitstrafe.
 *
 * 90 Sekunden Zeit. Erreicht der Spieler das Ziel in der Zeit → gewonnen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import MinigameIntro from './_MinigameIntro'
import { type MinigameResult } from './_MinigameResult'

const TOTAL_QUESTIONS = 5
const START_TIME_S    = 90
const PENALTY_S       = 3

interface Props {
  questions:  Question[]
  worldTheme: WorldTheme
  onComplete: (result: MinigameResult) => void
}

/**
 * A node on the path: position in 0-1 range (relative to viewport) +
 * whether it's a junction that requires answering a question to pass.
 */
interface PathNode {
  x:        number   // 0-1, relative to container width
  y:        number   // 0-1, relative to container height
  junction: boolean  // is this a junction (question here)
}

// Hand-crafted winding path from (0.1, 0.1) → (0.9, 0.9), 5 junctions
const PATH: PathNode[] = [
  { x: 0.10, y: 0.10, junction: false }, // start
  { x: 0.30, y: 0.10, junction: true  }, // J1
  { x: 0.30, y: 0.35, junction: false },
  { x: 0.55, y: 0.35, junction: true  }, // J2
  { x: 0.55, y: 0.55, junction: false },
  { x: 0.30, y: 0.55, junction: true  }, // J3
  { x: 0.30, y: 0.75, junction: false },
  { x: 0.55, y: 0.75, junction: true  }, // J4
  { x: 0.75, y: 0.75, junction: false },
  { x: 0.75, y: 0.55, junction: true  }, // J5
  { x: 0.90, y: 0.55, junction: false },
  { x: 0.90, y: 0.90, junction: false }, // goal
]

export default function Labyrinth({ questions, worldTheme, onComplete }: Props) {
  const { t } = useTranslation()
  const feel  = useFeel()
  const prm   = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const usedQ = useMemo(() => questions.slice(0, TOTAL_QUESTIONS), [questions])

  const [phase, setPhase]       = useState<'intro' | 'playing' | 'done'>('intro')
  const [nodeIdx, setNodeIdx]   = useState(0)
  const [junctionIdx, setJunctionIdx] = useState(0) // how many junctions passed
  const [timeLeft, setTimeLeft] = useState(START_TIME_S)
  const [wrongCount, setWrongCount] = useState(0)
  const [showingQ, setShowingQ] = useState(false)
  const [deadEnd, setDeadEnd]   = useState(false)
  const [startedAt]             = useState(Date.now())

  const currentNode = PATH[nodeIdx]
  const currentQ    = currentNode?.junction ? usedQ[junctionIdx] : null

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase('done')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // Auto-advance to junction or goal
  useEffect(() => {
    if (phase !== 'playing') return
    if (!currentNode) return

    // Reached goal
    if (nodeIdx >= PATH.length - 1) {
      setTimeout(() => setPhase('done'), 500)
      return
    }

    // At junction: show question
    if (currentNode.junction) {
      setShowingQ(true)
    } else {
      // Non-junction: advance automatically after short delay
      const id = setTimeout(() => {
        setNodeIdx((i) => i + 1)
      }, 400)
      return () => clearTimeout(id)
    }
  }, [nodeIdx, currentNode, phase])

  const handleAnswer = useCallback((answerIdx: number) => {
    if (!currentQ || !showingQ) return
    const correct = answerIdx === currentQ.correctIndex
    setShowingQ(false)

    if (correct) {
      sfx.play('correct_soft')
      if (!prm) feel.haptic('tick')
      setNodeIdx((i) => i + 1)
      setJunctionIdx((j) => j + 1)
    } else {
      sfx.play('wrong_thud')
      if (!prm) { feel.haptic('fail'); feel.shake('soft') }
      setWrongCount((w) => w + 1)
      setTimeLeft((t) => Math.max(0, t - PENALTY_S))
      setDeadEnd(true)
      setTimeout(() => {
        setDeadEnd(false)
        setNodeIdx((i) => i + 1)  // still progress; penalty is the time loss
        setJunctionIdx((j) => j + 1)
      }, 1400)
    }
  }, [currentQ, showingQ, prm, feel])

  // Result
  useEffect(() => {
    if (phase !== 'done') return
    const timeSpent = Math.round((Date.now() - startedAt) / 1000)
    const reachedGoal = nodeIdx >= PATH.length - 1 && timeLeft > 0
    const stars: 1 | 2 | 3 = reachedGoal && wrongCount === 0 ? 3
                            : reachedGoal                     ? 2
                            : nodeIdx > PATH.length / 2       ? 2
                            : 1
    const score = reachedGoal
      ? timeLeft * 20 + (TOTAL_QUESTIONS - wrongCount) * 100 + 300
      : (TOTAL_QUESTIONS - wrongCount) * 50
    const extra = reachedGoal
      ? `Ziel erreicht in ${timeSpent}s · ${wrongCount} Sackgassen`
      : timeLeft <= 0
        ? 'Zeit abgelaufen'
        : 'Im Labyrinth verirrt'
    const id = setTimeout(() => onComplete({
      score,
      correctAnswers: TOTAL_QUESTIONS - wrongCount,
      totalQuestions: TOTAL_QUESTIONS,
      timeSpent,
      stars,
      extra,
    }), 1200)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Render ─────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="relative w-full min-h-[540px] overflow-hidden rounded-2xl bg-dark select-none">
        <MinigameIntro
          emoji="🗝️"
          title={t('minigame.maze.title', 'Wissens-Labyrinth')}
          hint={t('minigame.maze.hint', 'Wähle an Kreuzungen den richtigen Weg. 90 Sekunden zum Schatz!')}
          color={worldTheme.primaryColor}
          onDismiss={() => setPhase('playing')}
        />
      </div>
    )
  }

  if (phase === 'done') {
    const reached = nodeIdx >= PATH.length - 1 && timeLeft > 0
    return (
      <div
        className="relative w-full min-h-[540px] rounded-2xl flex items-center justify-center"
        style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #000 100%)` }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p style={{ fontSize: 72 }}>{reached ? '💰' : '⏰'}</p>
          <p className="font-display text-2xl mt-2" style={{ color: reached ? '#FFD700' : '#888' }}>
            {reached ? t('minigame.maze.victory', 'Schatz gefunden!') : t('minigame.maze.timeup', 'Zeit abgelaufen')}
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="relative w-full min-h-[540px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050015 100%)` }}
    >
      {/* Header */}
      <div className="absolute top-3 inset-x-0 flex justify-between px-4 z-10">
        <p className="font-body text-sm" style={{ color: timeLeft < 20 ? '#EF4444' : worldTheme.primaryColor }}>
          ⏱️ {timeLeft}s
        </p>
        <p className="font-body text-xs text-white/60">
          {t('minigame.maze.junction', 'Kreuzung')} {junctionIdx}/{TOTAL_QUESTIONS}
        </p>
      </div>

      {/* Maze map (SVG) */}
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {/* Path lines between visited nodes (lit up) */}
        {PATH.slice(0, nodeIdx).map((n, i) => {
          const next = PATH[i + 1]
          if (!next) return null
          const lit = i + 1 <= nodeIdx
          return (
            <line
              key={i}
              x1={n.x} y1={n.y}
              x2={next.x} y2={next.y}
              stroke={lit ? worldTheme.primaryColor : '#444'}
              strokeWidth={0.015}
              strokeLinecap="round"
              opacity={lit ? 0.9 : 0.2}
            />
          )
        })}

        {/* Upcoming path (faded) */}
        {PATH.slice(nodeIdx, PATH.length - 1).map((n, i) => {
          const next = PATH[nodeIdx + i + 1]
          if (!next) return null
          return (
            <line
              key={`u${i}`}
              x1={n.x} y1={n.y}
              x2={next.x} y2={next.y}
              stroke="#fff"
              strokeWidth={0.008}
              strokeLinecap="round"
              opacity={0.08}
              strokeDasharray="0.02"
            />
          )
        })}

        {/* Junction markers */}
        {PATH.map((n, i) => n.junction && i > nodeIdx && (
          <circle
            key={`j${i}`}
            cx={n.x} cy={n.y} r={0.02}
            fill="none"
            stroke={worldTheme.primaryColor}
            strokeWidth={0.004}
            opacity={0.5}
          />
        ))}

        {/* Goal */}
        <circle
          cx={PATH[PATH.length - 1].x}
          cy={PATH[PATH.length - 1].y}
          r={0.035}
          fill="#FFD70055"
          stroke="#FFD700"
          strokeWidth={0.005}
        />
      </svg>

      {/* Goal emoji */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${PATH[PATH.length - 1].x * 100}%`,
          top:  `${PATH[PATH.length - 1].y * 100}%`,
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
        }}
      >
        💰
      </div>

      {/* Player */}
      <motion.div
        className="absolute pointer-events-none"
        animate={{
          left: `${(currentNode?.x ?? 0) * 100}%`,
          top:  `${(currentNode?.y ?? 0) * 100}%`,
        }}
        transition={{ type: 'spring', damping: 18, stiffness: 100 }}
        style={{
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          filter: `drop-shadow(0 0 12px ${worldTheme.primaryColor})`,
          zIndex: 5,
        }}
      >
        {deadEnd ? '💥' : '🔮'}
      </motion.div>

      {/* Question modal */}
      <AnimatePresence>
        {showingQ && currentQ && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-end z-20"
            style={{ background: 'linear-gradient(to top, rgba(2,0,18,0.95) 50%, transparent)' }}
          >
            <div className="w-full px-4 pb-4">
              <motion.div
                initial={{ y: 30 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 18 }}
                className="rounded-2xl border p-4"
                style={{
                  background: 'rgba(5,0,20,0.9)',
                  borderColor: worldTheme.primaryColor + '60',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <p className="font-body text-[10px] text-white/40 uppercase tracking-widest text-center mb-2">
                  🔀 {t('minigame.maze.which_way', 'Welcher Weg?')}
                </p>
                <p className="font-body font-semibold text-white text-[14px] leading-snug text-center mb-3">
                  {currentQ.question}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {currentQ.answers.map((ans, ai) => (
                    <button
                      key={ai}
                      className="py-2.5 px-2 rounded-xl border font-body text-[12px] text-white text-center cursor-pointer"
                      style={{
                        background: `${worldTheme.primaryColor}1a`,
                        borderColor: `${worldTheme.primaryColor}55`,
                      }}
                      onClick={() => handleAnswer(ai)}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dead-end flash */}
      <AnimatePresence>
        {deadEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(255,0,0,0.25)' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
