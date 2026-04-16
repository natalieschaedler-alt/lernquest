/**
 * RunenCasting.tsx – Motor-skill drag-to-spell room
 *
 * Letters of the correct answer float in the lower third.
 * Player drags them (pointer events, touch + mouse) into the slot row.
 * Snap → tick sfx + sparkle. Wrong slot → bounce back + red flicker.
 * All correct → rune flash, rune_glow sfx, slowmo(0.5, 800).
 * Timer: lava rises from the bottom — height represents time remaining.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'
import { pointsForDifficulty } from '../../lib/gameConfig'
import { shuffleArray } from '../../utils/shuffleArray'

// ── Types ──────────────────────────────────────────────────────

export interface RunenCastingProps {
  questions: Question[]    // MC questions; uses correctAnswer as word to spell
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

interface LetterTile {
  id:        number
  char:      string
  /** Whether this tile belongs to the answer (vs. distractor) */
  isAnswer:  boolean
  /** Index in the answer string (0-based) */
  answerIdx: number | null
  /** Current position in the pool (% of container) */
  baseX:     number
  baseY:     number
  /** If placed in a slot, which slot index */
  slotIdx:   number | null
  /** Distractor tiles go back when slotted */
  rejected:  boolean
}

interface TrailPoint { x: number; y: number; opacity: number }

const TIMER_SEC     = 25
const DISTRACTOR_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ── Helpers ───────────────────────────────────────────────────

function getWordToSpell(q: Question): string {
  const raw = q.answers[q.correctIndex] ?? ''
  // Take first word, trim, cap at 9 chars
  return raw.split(/\s+/)[0].toUpperCase().slice(0, 9)
}

function makeDistractors(word: string, count: number): string[] {
  const pool = DISTRACTOR_CHARS.split('').filter(c => !word.includes(c))
  return shuffleArray(pool).slice(0, count)
}

// ── Component ─────────────────────────────────────────────────

export default function RunenCasting({ questions, worldTheme, onComplete, onHit }: RunenCastingProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [qIdx,    setQIdx]    = useState(0)
  const [done,    setDone]    = useState(false)
  const [timeLeft, setTimerL] = useState(TIMER_SEC)
  const scoreRef   = useRef(0)
  const contRef    = useRef<HTMLDivElement>(null)
  const slotRefs   = useRef<(HTMLDivElement | null)[]>([])

  const currentQ = questions[qIdx]
  const word     = useMemo(() => currentQ ? getWordToSpell(currentQ) : '', [currentQ])

  // Build tile pool for current word
  const [tiles, setTiles] = useState<LetterTile[]>([])
  useEffect(() => {
    if (!word) return
    const distractors = makeDistractors(word, Math.max(0, 7 - word.length))
    const chars: Array<{ char: string; isAnswer: boolean; answerIdx: number | null }> = [
      ...word.split('').map((c, i) => ({ char: c, isAnswer: true, answerIdx: i })),
      ...distractors.map(c => ({ char: c, isAnswer: false, answerIdx: null })),
    ]
    const shuffled = shuffleArray(chars)
    const newTiles: LetterTile[] = shuffled.map((c, i) => ({
      id:        i,
      char:      c.char,
      isAnswer:  c.isAnswer,
      answerIdx: c.answerIdx,
      baseX:     10 + (i % 8) * 11,
      baseY:     62 + (i > 7 ? 12 : 0),
      slotIdx:   null,
      rejected:  false,
    }))
    setTiles(newTiles)
    slotRefs.current = Array(word.length).fill(null)
  }, [word])

  // ── Drag state (refs to avoid re-render lag) ──────────────────
  const draggingId   = useRef<number | null>(null)
  const dragPos      = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const trailPoints  = useRef<TrailPoint[]>([])
  const [flyPos, setFlyPos] = useState<{ x: number; y: number } | null>(null)
  const [trail,  setTrail]  = useState<TrailPoint[]>([])

  // ── Timer ─────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (done) return
    setTimerL(TIMER_SEC)
    timerRef.current = setInterval(() => {
      setTimerL(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          // Time out: count as wrong, advance
          feel.haptic('fail')
          onHit?.()
          bus.emit('answerWrong', {
            questionIndex: qIdx,
            correctAnswer: word,
            givenAnswer: '(timeout)',
          })
          if (!prm) feel.shake('soft')
          setTimeout(() => {
            if (qIdx >= questions.length - 1) {
              setDone(true)
              onComplete(scoreRef.current)
            } else {
              setQIdx(prev => prev + 1)
            }
          }, 600)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, done])

  // Check win condition after each tile placement
  const checkWin = useCallback((updatedTiles: LetterTile[]) => {
    const filled = updatedTiles.filter(t => t.slotIdx !== null && t.isAnswer)
    if (filled.length < word.length) return

    // All answer letters placed
    clearInterval(timerRef.current!)
    const pts = currentQ ? pointsForDifficulty(currentQ.difficulty) + 15 : 15
    scoreRef.current += pts

    if (!prm) {
      sfx.play('rune_glow')
      feel.slowmo(0.5, 800)
      const cx = window.innerWidth / 2
      const cy = window.innerHeight * 0.4
      feel.particles({ x: cx, y: cy }, 'golden', 20)
      feel.floatText(`✨ +${pts} XP`, { x: cx, y: cy - 30 }, '#A78BFA', 1.3)
    }
    feel.haptic('success')
    bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: false, combo: 0 })

    setTimeout(() => {
      if (qIdx >= questions.length - 1) {
        setDone(true)
        bus.emit('roomComplete', { roomIndex: 0, score: scoreRef.current, allCorrect: true })
        onComplete(scoreRef.current)
      } else {
        setQIdx(prev => prev + 1)
      }
    }, 900)
  }, [word, currentQ, prm, feel, qIdx, questions.length, onComplete])

  // ── Pointer down on tile ──────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent, tileId: number) => {
    const tile = tiles.find(t => t.id === tileId)
    if (!tile || tile.slotIdx !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingId.current = tileId
    dragPos.current    = { x: e.clientX, y: e.clientY }
    trailPoints.current = []
    setFlyPos({ x: e.clientX, y: e.clientY })
  }, [tiles])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingId.current === null) return
    dragPos.current = { x: e.clientX, y: e.clientY }
    setFlyPos({ x: e.clientX, y: e.clientY })
    // Trail: keep last 5 positions
    trailPoints.current = [
      { x: e.clientX, y: e.clientY, opacity: 1 },
      ...trailPoints.current.slice(0, 4).map((p, i) => ({ ...p, opacity: 0.7 - i * 0.15 })),
    ]
    setTrail([...trailPoints.current])
  }, [])

  const handlePointerUp = useCallback(() => {
    const id = draggingId.current
    draggingId.current = null
    setFlyPos(null)
    setTrail([])

    if (id === null) return
    const tile = tiles.find(t => t.id === id)
    if (!tile) return

    const dropX = dragPos.current.x
    const dropY = dragPos.current.y

    // Find nearest empty slot within 48px
    let nearestSlot: number | null = null
    let nearestDist  = 48

    slotRefs.current.forEach((el, si) => {
      if (!el) return
      const slotFilled = tiles.some(t => t.slotIdx === si)
      if (slotFilled) return
      const rect  = el.getBoundingClientRect()
      const cx    = rect.left + rect.width / 2
      const cy    = rect.top  + rect.height / 2
      const dist  = Math.hypot(dropX - cx, dropY - cy)
      if (dist < nearestDist) { nearestDist = dist; nearestSlot = si }
    })

    if (nearestSlot === null) {
      // Snap back
      return
    }

    // Check if this tile belongs in this slot
    const correctSlot = tile.isAnswer && tile.answerIdx === nearestSlot

    if (tile.isAnswer && correctSlot) {
      // Place it!
      sfx.play('correct_soft')
      if (!prm) {
        const slotEl = slotRefs.current[nearestSlot]
        if (slotEl) {
          const r = slotEl.getBoundingClientRect()
          feel.particles({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 'sparkle', 5)
        }
      }
      feel.haptic('tick')
      const updated = tiles.map(t => t.id === id ? { ...t, slotIdx: nearestSlot } : t)
      setTiles(updated)
      checkWin(updated)
    } else {
      // Wrong slot or distractor → bounce back (rejected flag)
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
      setTiles(prev => prev.map(t => t.id === id ? { ...t, rejected: true } : t))
      setTimeout(() => setTiles(prev => prev.map(t => t.id === id ? { ...t, rejected: false } : t)), 500)
    }
  }, [tiles, prm, feel, checkWin])

  // Lava height (%) = fraction of time elapsed
  const lavaH = (1 - timeLeft / TIMER_SEC) * 30 + 4  // 4% min, 34% max

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={contRef}
      className="relative w-full min-h-[480px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #060008 100%)` }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Question */}
      <div className="relative z-10 px-4 pt-4 pb-2 min-h-[64px] flex items-center justify-center">
        {currentQ && (
          <motion.p
            key={qIdx}
            className="font-body font-semibold text-white text-center text-[14px] leading-snug"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentQ.question}
          </motion.p>
        )}
      </div>

      {/* ── Slot row ─────────────────────────────────────────── */}
      <div className="flex justify-center gap-1.5 mt-2 mb-4 px-4">
        {word.split('').map((_, si) => {
          const placedTile = tiles.find(t => t.slotIdx === si)
          return (
            <div
              key={si}
              ref={el => { slotRefs.current[si] = el }}
              className="w-9 h-10 rounded-lg border-2 flex items-center justify-center font-display text-lg transition-colors"
              style={{
                borderColor: placedTile
                  ? worldTheme.primaryColor
                  : `${worldTheme.primaryColor}45`,
                background:  placedTile
                  ? `${worldTheme.primaryColor}25`
                  : 'rgba(255,255,255,0.05)',
                boxShadow: placedTile
                  ? `0 0 10px ${worldTheme.primaryColor}40`
                  : 'none',
              }}
            >
              {placedTile ? (
                <motion.span
                  className="text-white font-bold text-base"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 8 }}
                >
                  {placedTile.char}
                </motion.span>
              ) : (
                <span className="text-white/15 text-xs">_</span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Letter tiles pool ────────────────────────────────── */}
      <div className="relative h-[160px] mx-3">
        {tiles
          .filter(t => t.slotIdx === null)
          .map(tile => (
            <motion.div
              key={`${qIdx}-${tile.id}`}
              className="absolute w-9 h-10 rounded-lg border-2 flex items-center justify-center font-display text-base cursor-grab active:cursor-grabbing"
              style={{
                left:          `${tile.baseX}%`,
                top:           `${tile.baseY - 60}%`,
                borderColor:   tile.rejected
                  ? '#FF4444'
                  : `${worldTheme.primaryColor}60`,
                background:    tile.rejected
                  ? 'rgba(255,68,68,0.15)'
                  : `${worldTheme.primaryColor}18`,
                touchAction:   'none',
                userSelect:    'none',
                zIndex:        draggingId.current === tile.id ? 30 : 10,
                opacity:       draggingId.current === tile.id ? 0.4 : 1,
              }}
              animate={
                !prm
                  ? tile.rejected
                    ? { x: [-8, 8, -8, 8, 0] }
                    : { y: [0, -4, 0], rotate: [-3, 3, -3] }
                  : {}
              }
              transition={
                tile.rejected
                  ? { duration: 0.35 }
                  : { duration: 2.5 + tile.id * 0.2, repeat: Infinity, ease: 'easeInOut', delay: tile.id * 0.3 }
              }
              onPointerDown={e => handlePointerDown(e, tile.id)}
            >
              <span className="text-white font-bold text-[15px]">{tile.char}</span>
            </motion.div>
          ))}
      </div>

      {/* ── Drag ghost + trail ────────────────────────────────── */}
      {flyPos && draggingId.current !== null && (() => {
        const tile = tiles.find(t => t.id === draggingId.current)
        if (!tile) return null
        return (
          <>
            {/* Trail */}
            {trail.map((pt, i) => (
              <div
                key={i}
                className="fixed w-9 h-10 rounded-lg border-2 flex items-center justify-center pointer-events-none"
                style={{
                  left:        pt.x - 18,
                  top:         pt.y - 20,
                  borderColor: `${worldTheme.primaryColor}${Math.round(pt.opacity * 80).toString(16).padStart(2,'0')}`,
                  background:  `${worldTheme.primaryColor}${Math.round(pt.opacity * 25).toString(16).padStart(2,'0')}`,
                  opacity:     pt.opacity * 0.6,
                  zIndex:      9999,
                }}
              >
                <span className="text-white font-bold text-[15px]">{tile.char}</span>
              </div>
            ))}
            {/* Flying ghost */}
            <div
              className="fixed w-9 h-10 rounded-lg border-2 flex items-center justify-center pointer-events-none"
              style={{
                left:        flyPos.x - 18,
                top:         flyPos.y - 20,
                borderColor: worldTheme.primaryColor,
                background:  `${worldTheme.primaryColor}35`,
                boxShadow:   `0 0 14px ${worldTheme.primaryColor}60`,
                zIndex:      10000,
              }}
            >
              <span className="text-white font-bold text-[15px]">{tile.char}</span>
            </div>
          </>
        )
      })()}

      {/* ── Rising lava timer ────────────────────────────────── */}
      <motion.div
        className="absolute bottom-0 inset-x-0 pointer-events-none"
        style={{ height: `${lavaH}%` }}
        transition={{ duration: 0.9, ease: 'linear' }}
      >
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(180deg, ${worldTheme.primaryColor}20 0%, ${worldTheme.primaryColor}60 100%)`,
          }}
        />
        {/* Lava surface wave */}
        <motion.div
          className="absolute top-0 inset-x-0 h-3"
          style={{ background: `${worldTheme.primaryColor}80`, filter: 'blur(3px)' }}
          animate={!prm ? { scaleX: [1, 1.03, 0.97, 1], y: [-1, 1, -1] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Timer label */}
      <div className="absolute bottom-2 left-3 font-body text-[10px] text-white/35 pointer-events-none z-10">
        ⏱ {timeLeft}s
      </div>
    </div>
  )
}
