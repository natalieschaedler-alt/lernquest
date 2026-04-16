/**
 * LavaBridge.tsx – Platformer-feel bridge room
 *
 * Player starts left, must cross a lava chasm by answering questions.
 * Correct → stone falls from above (spring bounce), bridge_land sfx, player walks right.
 * Wrong → stone crumbles, player wobbles at edge, HP −1.
 * After all stones placed: player sprints to goal, fanfare, room complete.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'
import { pointsForDifficulty } from '../../lib/gameConfig'

// ── Types ──────────────────────────────────────────────────────

export interface LavaBridgeProps {
  questions: Question[]   // up to 4
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

// ── Constants ──────────────────────────────────────────────────

const NUM_STONES = 4
const STONE_X    = [0.22, 0.40, 0.58, 0.76]  // normalized x in game field
const START_X    = 0.05
const GOAL_X     = 0.93

type StoneState = 'pending' | 'falling' | 'placed' | 'crumbling'
type Phase      = 'question' | 'animating' | 'complete'

// World-aware environment config
function envConfig(worldId: string) {
  switch (worldId) {
    case 'water':  return { floorColor: '#0e7fa0', bubbleEmoji: '💧', groundEmoji: '❄️', label: 'Eisspalt' }
    case 'cyber':  return { floorColor: '#0a5040', bubbleEmoji: '⚡', groundEmoji: '🔌', label: 'Datenabyss' }
    case 'forest': return { floorColor: '#2d4a1e', bubbleEmoji: '🌿', groundEmoji: '🌳', label: 'Moorgraben' }
    case 'cosmos': return { floorColor: '#1a0a3a', bubbleEmoji: '⭐', groundEmoji: '🌌', label: 'Void' }
    default:       return { floorColor: '#8b1a00', bubbleEmoji: '🔥', groundEmoji: '🌋', label: 'Lavaspalt' }
  }
}

// ── Component ─────────────────────────────────────────────────

export default function LavaBridge({ questions, worldTheme, onComplete, onHit }: LavaBridgeProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const env    = useMemo(() => envConfig(worldTheme.id), [worldTheme])

  const qs   = useMemo(() => questions.slice(0, NUM_STONES), [questions])
  const cont = useRef<HTMLDivElement>(null)

  const [stones,     setStones]     = useState<StoneState[]>(qs.map(() => 'pending'))
  const [playerAt,   setPlayerAt]   = useState(-1)   // -1=start, 0..3=stone, 4=goal
  const [isWalking,  setIsWalking]  = useState(false)
  const [walkFrame,  setWalkFrame]  = useState(0)
  const [wobble,     setWobble]     = useState(false)
  const [phase,      setPhase]      = useState<Phase>('question')
  const [qIdx,       setQIdx]       = useState(0)
  const scoreRef   = useRef(0)
  const doneRef    = useRef(false)

  const currentQ = qs[qIdx]

  // 2-frame walk cycle
  useEffect(() => {
    if (!isWalking || prm) return
    const id = setInterval(() => setWalkFrame(f => (f + 1) % 2), 170)
    return () => clearInterval(id)
  }, [isWalking, prm])

  // Player X in game field (%)
  const playerXPct =
    playerAt < 0              ? START_X * 100
    : playerAt >= NUM_STONES  ? GOAL_X * 100
    : STONE_X[playerAt] * 100

  // ── Answer handler ────────────────────────────────────────────
  const handleAnswer = useCallback((answerIdx: number) => {
    if (phase !== 'question' || !currentQ || doneRef.current) return
    const correct = answerIdx === currentQ.correctIndex
    const pts     = correct ? pointsForDifficulty(currentQ.difficulty) : 0

    if (correct) {
      scoreRef.current += pts
      setPhase('animating')
      setStones(prev => { const n = [...prev]; n[qIdx] = 'falling'; return n })

      // Stone lands (600 ms fall)
      setTimeout(() => {
        setStones(prev => { const n = [...prev]; n[qIdx] = 'placed'; return n })
        sfx.play('bridge_land')
        if (!prm) {
          feel.shake('soft')
          const r = cont.current?.getBoundingClientRect()
          if (r) {
            const cx = r.left + STONE_X[qIdx] * r.width
            const cy = r.top  + r.height * 0.63
            feel.particles({ x: cx, y: cy }, 'lava', 5)
          }
        }

        // Player walks (200 ms after landing)
        setTimeout(() => {
          setIsWalking(true)
          setTimeout(() => {
            setIsWalking(false)
            setPlayerAt(qIdx)

            if (qIdx >= qs.length - 1) {
              // Dash to goal
              setTimeout(() => {
                setIsWalking(true)
                setTimeout(() => {
                  setIsWalking(false)
                  setPlayerAt(NUM_STONES)
                  doneRef.current = true
                  setPhase('complete')
                  if (!prm) {
                    const r = cont.current?.getBoundingClientRect()
                    if (r) {
                      feel.particles({ x: r.left + GOAL_X * r.width, y: r.top + r.height * 0.45 }, 'sparkle', 14)
                      feel.particles({ x: r.left + GOAL_X * r.width, y: r.top + r.height * 0.45 }, 'golden', 7)
                    }
                    feel.haptic('success')
                  }
                  bus.emit('roomComplete', { roomIndex: 0, score: scoreRef.current, allCorrect: true })
                  setTimeout(() => onComplete(scoreRef.current), 1100)
                }, 550)
              }, 250)
            } else {
              setQIdx(prev => prev + 1)
              setPhase('question')
            }
          }, 480)
        }, 180)
      }, 560)

      bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: false, combo: 0 })
    } else {
      // Wrong – crumble + wobble
      setStones(prev => { const n = [...prev]; n[qIdx] = 'crumbling'; return n })
      setWobble(true)
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
      onHit?.()
      bus.emit('answerWrong', {
        questionIndex:  qIdx,
        correctAnswer:  currentQ.answers[currentQ.correctIndex],
        givenAnswer:    currentQ.answers[answerIdx],
      })
      setTimeout(() => {
        setWobble(false)
        setStones(prev => { const n = [...prev]; n[qIdx] = 'pending'; return n })
        setPhase('question')
      }, 1400)
    }
  }, [phase, currentQ, qIdx, prm, feel, qs.length, onHit, onComplete])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={cont}
      className="relative w-full min-h-[480px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050005 100%)` }}
    >
      {/* Progress pips */}
      <div className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none">
        {qs.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{ background: i <= playerAt ? worldTheme.primaryColor : 'rgba(255,255,255,0.18)' }}
          />
        ))}
      </div>

      {/* Question */}
      <div className="relative z-10 px-4 pt-8 pb-2 min-h-[70px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentQ && phase === 'question' && (
            <motion.p
              key={qIdx}
              className="font-body font-semibold text-white text-center text-[14px] leading-snug"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {currentQ.question}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Game field ─────────────────────────────────────────── */}
      <div className="relative mx-2 h-[230px]">
        {/* Sky/backdrop */}
        <div
          className="absolute inset-x-0 top-0 bottom-[26%] rounded-t-xl"
          style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom}80 0%, transparent 100%)` }}
        />

        {/* Goal platform */}
        <div
          className="absolute text-2xl"
          style={{ right: '2%', bottom: '27%', transform: 'translateX(0)' }}
        >
          🚪
        </div>

        {/* Bridge stones */}
        {STONE_X.map((x, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: `${x * 100}%`, bottom: '26%', transform: 'translate(-50%, 0)' }}
          >
            <AnimatePresence>
              {stones[i] === 'falling' && (
                <motion.div
                  key="falling"
                  className="text-2xl"
                  initial={{ y: -130, rotate: -25, opacity: 0.8 }}
                  animate={{ y: 0, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 7, stiffness: 150, bounce: 0.55 }}
                >
                  🪨
                </motion.div>
              )}
              {stones[i] === 'placed' && (
                <motion.div key="placed" className="text-2xl">🪨</motion.div>
              )}
              {stones[i] === 'crumbling' && (
                <motion.div
                  key="crumble"
                  className="text-2xl"
                  initial={{ scale: 1, opacity: 1, rotate: 0 }}
                  animate={{ scale: 0.1, opacity: 0, rotate: 45, y: 16 }}
                  transition={{ duration: 0.7, ease: 'easeIn' }}
                >
                  💢
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Player sprite */}
        <motion.div
          className="absolute text-2xl"
          style={{ bottom: '36%', transform: 'translateX(-50%)' }}
          animate={{
            left:    `${playerXPct}%`,
            x:       wobble ? [-6, 6, -6, 6, 0] : 0,
          }}
          transition={{
            left:    { duration: 0.48, ease: 'easeOut' },
            x:       { duration: 0.4 },
          }}
        >
          <motion.span
            animate={!prm && isWalking ? { y: [0, -5, 0] } : { y: 0 }}
            transition={{ duration: 0.32, repeat: !prm && isWalking ? Infinity : 0 }}
            style={{ display: 'inline-block' }}
          >
            {walkFrame === 0 ? '🧙' : '🧙‍♂️'}
          </motion.span>
        </motion.div>

        {/* Lava / environment floor */}
        <div className="absolute bottom-0 inset-x-0 h-[26%] overflow-hidden rounded-b-xl">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${worldTheme.primaryColor}50 0%, ${env.floorColor} 100%)`,
            }}
            animate={!prm ? { backgroundPositionX: ['0%', '200%'] } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          {/* Bubbles */}
          {!prm && Array.from({ length: 5 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute text-xs"
              style={{ left: `${10 + i * 18}%`, bottom: 2 }}
              animate={{ y: [-1, -9, -1], opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.4 + i * 0.35, repeat: Infinity, delay: i * 0.55, ease: 'easeInOut' }}
            >
              {env.bubbleEmoji}
            </motion.span>
          ))}
        </div>

        {/* Environment label */}
        <div className="absolute bottom-1 right-2 font-body text-[8px] text-white/20 pointer-events-none">
          {env.label}
        </div>
      </div>

      {/* Answer buttons */}
      <AnimatePresence>
        {currentQ && phase === 'question' && (
          <motion.div
            key={qIdx}
            className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2 relative z-10"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.08 }}
          >
            {currentQ.answers.map((ans, ai) => (
              <button
                key={ai}
                className="py-2.5 px-2 rounded-xl border font-body text-[12px] text-white text-center"
                style={{
                  background:  `${worldTheme.primaryColor}18`,
                  borderColor: `${worldTheme.primaryColor}45`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}35` }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}18` }}
                onClick={() => handleAnswer(ai)}
              >
                {ans}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete overlay */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.p
              className="font-display text-2xl"
              style={{ color: worldTheme.primaryColor }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              {t('rooms.bridge_complete', '🌉 Überquert!')}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
