/**
 * MemoryTrail.tsx – Gedächtnis-Feel dungeon room
 *
 * 3×3 rune grid. Sequence is shown tile-by-tile with rising pitch.
 * Player then repeats the sequence. Each tile requires a mini TF
 * question to "unlock" it (1.5 s timer). Correct → green glow +
 * trail line. Wrong / timeout → tile breaks + −1 HP.
 * 4 rounds: 3 → 4 → 5 → 6 tiles.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'

// ── Types ──────────────────────────────────────────────────────

export interface MemoryTrailProps {
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

type Phase =
  | 'showing'     // sequence display
  | 'question'    // mini TF for current tile
  | 'waiting'     // brief pause between tiles
  | 'done'

interface TileState {
  idx:       number   // 0–8
  glowing:   boolean
  broken:    boolean
  active:    boolean  // currently highlighted in sequence
  trail:     boolean  // part of confirmed trail
}

// ── Constants ─────────────────────────────────────────────────

const GRID_SIZE     = 3
const TILE_COUNT    = GRID_SIZE * GRID_SIZE
const ROUNDS        = [3, 4, 5, 6]
const SHOW_MS       = 600    // per tile in sequence
const MINI_TIMER_S  = 2

// Rune symbols for tiles
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ']

// Ascending pitch steps for sequence display
const PITCH_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0]

// ── Component ─────────────────────────────────────────────────

export default function MemoryTrail({ questions, worldTheme, onComplete, onHit }: MemoryTrailProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [round,      setRound]      = useState(0)
  const [phase,      setPhase]      = useState<Phase>('showing')
  const [tiles,      setTiles]      = useState<TileState[]>(
    Array.from({ length: TILE_COUNT }, (_, i) => ({
      idx: i, glowing: false, broken: false, active: false, trail: false,
    }))
  )
  const [sequence,   setSequence]   = useState<number[]>([])
  const [playerStep, setPlayerStep] = useState(0)
  const [miniQ,      setMiniQ]      = useState<Question | null>(null)
  const [miniTimer,  setMiniTimer]  = useState(MINI_TIMER_S)
  const [pendingTile, setPendingTile] = useState<number>(-1)
  const [trailPairs, setTrailPairs] = useState<[number, number][]>([])

  const scoreRef   = useRef(0)
  const doneRef    = useRef(false)
  const qIdxRef    = useRef(0)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Build sequence for current round ──────────────────────
  const buildSequence = useCallback((roundIdx: number) => {
    const len = ROUNDS[roundIdx]
    const seq: number[] = []
    while (seq.length < len) {
      const n = Math.floor(Math.random() * TILE_COUNT)
      if (seq[seq.length - 1] !== n) seq.push(n)
    }
    return seq
  }, [])

  // ── Show sequence ─────────────────────────────────────────
  const showSequence = useCallback((seq: number[]) => {
    setPhase('showing')
    setPlayerStep(0)
    setTrailPairs([])
    setTiles(prev => prev.map(t => ({ ...t, active: false, broken: false, trail: false })))

    seq.forEach((tileIdx, i) => {
      setTimeout(() => {
        sfx.setPitch(PITCH_STEPS[i] ?? 1.5)
        sfx.play('rune_glow')
        setTiles(prev => prev.map(t => ({
          ...t, active: t.idx === tileIdx,
        })))
        setTimeout(() => {
          setTiles(prev => prev.map(t => ({ ...t, active: false })))
        }, SHOW_MS - 80)
      }, i * SHOW_MS)
    })

    setTimeout(() => {
      sfx.resetPitch()
      setPhase('waiting')
      setTimeout(() => setPhase('question'), 400)
    }, seq.length * SHOW_MS + 200)
  }, [])

  // ── Init each round ────────────────────────────────────────
  useEffect(() => {
    if (doneRef.current) return
    const seq = buildSequence(round)
    setSequence(seq)
    showSequence(seq)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  // ── Mini timer ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'question') { if (timerRef.current) clearInterval(timerRef.current); return }
    setMiniTimer(MINI_TIMER_S)

    timerRef.current = setInterval(() => {
      setMiniTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleMiniAnswer(null)  // timeout = wrong
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerStep])

  // ── Pick mini question for current player step ─────────────
  useEffect(() => {
    if (phase !== 'question') return
    const q = questions[qIdxRef.current % questions.length]
    setMiniQ(q)
    setPendingTile(sequence[playerStep] ?? -1)
  }, [phase, playerStep, questions, sequence])

  // ── Handle mini answer ─────────────────────────────────────
  const handleMiniAnswer = useCallback((choice: boolean | null) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (phase !== 'question' || doneRef.current) return

    const q        = miniQ
    const tileIdx  = sequence[playerStep]
    if (tileIdx === undefined) return

    const isCorrect = choice !== null && (() => {
      if (!q) return false
      const correct = q.correctAnswer === true || q.correctAnswer === 'true' || q.correctAnswer === 'Wahr'
      return choice === correct
    })()

    qIdxRef.current += 1

    if (isCorrect) {
      sfx.play('correct_soft')
      feel.haptic('tick')
      if (!prm) {
        const el = document.getElementById(`mtile-${tileIdx}`)
        if (el) {
          const r = el.getBoundingClientRect()
          feel.particles({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 'sparkle', 4)
        }
      }

      setTiles(prev => prev.map(t =>
        t.idx === tileIdx ? { ...t, glowing: true, trail: true } : t
      ))

      // Add trail pair
      if (playerStep > 0) {
        const prevTile = sequence[playerStep - 1]
        setTrailPairs(prev => [...prev, [prevTile, tileIdx]])
      }

      const next = playerStep + 1
      if (next >= sequence.length) {
        // Round complete
        const pts = 25 + ROUNDS[round] * 5
        scoreRef.current += pts
        bus.emit('answerCorrect', { questionIndex: playerStep, points: pts, fast: false, combo: 0 })
        if (!prm) {
          feel.haptic('success')
          feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.4 }, 'golden', 10)
          feel.floatText(`+${pts} XP`, { x: window.innerWidth / 2, y: window.innerHeight * 0.32 }, '#FFD700', 1.2)
        }

        setTimeout(() => {
          setTiles(prev => prev.map(t => ({ ...t, glowing: false, trail: false, broken: false })))
          const nextRound = round + 1
          if (nextRound >= ROUNDS.length || doneRef.current) {
            doneRef.current = true
            bus.emit('roomComplete', { roomIndex: 6, score: scoreRef.current, allCorrect: true })
            onComplete(scoreRef.current)
          } else {
            setRound(nextRound)
          }
        }, 900)
      } else {
        setPlayerStep(next)
        setPhase('question')
      }
    } else {
      // Wrong or timeout
      sfx.play('wrong_thud')
      feel.haptic('fail')
      onHit?.()
      if (!prm) feel.shake('soft')

      setTiles(prev => prev.map(t =>
        t.idx === tileIdx ? { ...t, broken: true } : t
      ))
      bus.emit('answerWrong', {
        questionIndex: playerStep,
        correctAnswer: String(miniQ?.correctAnswer),
        givenAnswer:   String(choice),
      })

      setTimeout(() => {
        // Restart same round
        const seq = buildSequence(round)
        setSequence(seq)
        setTrailPairs([])
        setPlayerStep(0)
        setTiles(prev => prev.map(t => ({ ...t, broken: false, trail: false, glowing: false })))
        showSequence(seq)
      }, 700)
    }
  }, [phase, miniQ, sequence, playerStep, round, prm, feel, onHit, buildSequence, showSequence, onComplete])

  // ── Grid cell positions ────────────────────────────────────
  const CELL_SIZE = 76
  const GAP       = 8
  const tilePos   = (idx: number) => ({
    x: (idx % GRID_SIZE) * (CELL_SIZE + GAP),
    y: Math.floor(idx / GRID_SIZE) * (CELL_SIZE + GAP),
  })
  const gridW = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * GAP
  const gridH = gridW

  return (
    <div
      className="relative w-full min-h-[500px] rounded-2xl overflow-hidden select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="font-body text-white/40 text-[11px]">
          {t('rooms.memory_round', 'Runde')} {round + 1}/{ROUNDS.length}
          {' · '}
          {ROUNDS[round]} {t('rooms.memory_tiles', 'Symbole')}
        </p>
        <span className="font-display text-sm font-bold" style={{ color: worldTheme.primaryColor }}>
          {scoreRef.current} XP
        </span>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={phase}
          className="text-center font-body text-white/50 text-[11px] mb-3"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {phase === 'showing'
            ? t('rooms.memory_watch', 'Merke dir die Reihenfolge …')
            : phase === 'question'
            ? t('rooms.memory_tap', 'Beantworte die Frage, um das Feld zu aktivieren')
            : '\u00A0'}
        </motion.p>
      </AnimatePresence>

      {/* Grid */}
      <div className="flex justify-center mb-4">
        <div className="relative" style={{ width: gridW, height: gridH }}>
          {/* Trail SVG */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={gridW}
            height={gridH}
          >
            {trailPairs.map(([from, to], i) => {
              const pf = tilePos(from)
              const pt = tilePos(to)
              const half = CELL_SIZE / 2
              return (
                <motion.line
                  key={i}
                  x1={pf.x + half} y1={pf.y + half}
                  x2={pt.x + half} y2={pt.y + half}
                  stroke={worldTheme.primaryColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={0.55}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.55 }}
                  transition={{ duration: 0.2 }}
                />
              )
            })}
          </svg>

          {tiles.map(tile => {
            const { x, y } = tilePos(tile.idx)
            const isPending = tile.idx === pendingTile && phase === 'question'
            return (
              <motion.div
                key={tile.idx}
                id={`mtile-${tile.idx}`}
                className="absolute flex items-center justify-center rounded-xl border font-display text-2xl select-none"
                style={{
                  left:        x,
                  top:         y,
                  width:       CELL_SIZE,
                  height:      CELL_SIZE,
                  borderColor: tile.broken
                    ? '#FF4444'
                    : tile.glowing || tile.trail
                    ? worldTheme.primaryColor
                    : `${worldTheme.primaryColor}35`,
                  background: tile.broken
                    ? 'rgba(255,68,68,0.12)'
                    : tile.active
                    ? `${worldTheme.primaryColor}40`
                    : tile.glowing || tile.trail
                    ? `${worldTheme.primaryColor}22`
                    : 'rgba(255,255,255,0.04)',
                  boxShadow: tile.active
                    ? `0 0 20px ${worldTheme.primaryColor}80`
                    : tile.glowing
                    ? `0 0 12px ${worldTheme.primaryColor}55`
                    : 'none',
                  color: tile.broken ? '#FF4444' : 'rgba(255,255,255,0.7)',
                  cursor: isPending ? 'default' : 'default',
                }}
                animate={
                  tile.active && !prm
                    ? { scale: [1, 1.12, 1] }
                    : tile.broken && !prm
                    ? { x: [-4, 4, -4, 4, 0] }
                    : {}
                }
                transition={{ duration: tile.active ? 0.25 : 0.3 }}
              >
                {RUNES[tile.idx]}
                {isPending && (
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2"
                    style={{ borderColor: worldTheme.primaryColor }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Mini question panel */}
      <AnimatePresence>
        {phase === 'question' && miniQ && (
          <motion.div
            key={`mq-${playerStep}`}
            className="mx-4 rounded-xl border p-3"
            style={{
              borderColor: `${worldTheme.primaryColor}35`,
              background:  `${worldTheme.primaryColor}10`,
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {/* Mini timer */}
            <div className="flex items-center justify-between mb-2">
              <p className="font-body text-white/60 text-[11px] leading-snug flex-1 pr-2">
                {miniQ.question}
              </p>
              <span
                className="font-display text-lg font-bold tabular-nums"
                style={{ color: miniTimer <= 1 ? '#FF4444' : worldTheme.primaryColor }}
              >
                {miniTimer}
              </span>
            </div>

            <div className="flex gap-2">
              {(['Wahr', 'Falsch'] as const).map(opt => (
                <motion.button
                  key={opt}
                  className="flex-1 py-2 rounded-lg border font-body text-[12px] font-semibold text-white"
                  style={{
                    borderColor: `${worldTheme.primaryColor}50`,
                    background:  `${worldTheme.primaryColor}18`,
                  }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleMiniAnswer(opt === 'Wahr')}
                >
                  {opt}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'showing' && (
        <div className="flex justify-center mt-2">
          <p className="font-body text-white/20 text-[10px]">
            {t('rooms.memory_sequence', 'Sequenz')} {sequence.length}
          </p>
        </div>
      )}
    </div>
  )
}
