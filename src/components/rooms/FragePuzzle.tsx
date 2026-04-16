/**
 * FragePuzzle.tsx – Word-order puzzle room
 *
 * A TF-statement sentence is shredded into 5–7 tilted word tiles.
 * Player taps tiles in the correct order; each tapped tile arcs up
 * into the next empty slot.
 * Correct order → highlight sweep + golden_chime sfx + sparkle.
 * Wrong tile → bounce back + red flash.
 * Timer as SVG sandglass draining in the corner.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'
import { shuffleArray } from '../../utils/shuffleArray'

// ── Types ──────────────────────────────────────────────────────

export interface FragePuzzleProps {
  /** TF or MC questions — uses the question.question field as the sentence to order */
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

interface WordTile {
  id:         number
  word:       string
  /** Correct position in the sentence (0-based) */
  correctPos: number
  /** Current position in slots (null = still in pool) */
  slotPos:    number | null
  /** Tile's visual layout angle */
  tiltDeg:    number
  baseX:      number   // % of pool area
  baseY:      number
  rejected:   boolean
  flying:     boolean
}

const TIMER_SEC  = 30
const MAX_WORDS  = 7

// ── Helpers ───────────────────────────────────────────────────

function getSentence(q: Question): string {
  // Use question text as the sentence (trim ? if present)
  return q.question.replace(/\?$/, '').trim()
}

function buildTiles(sentence: string): WordTile[] {
  const words   = sentence.split(/\s+/).slice(0, MAX_WORDS)
  const indices = shuffleArray(words.map((_, i) => i))

  return indices.map((origIdx, poolIdx) => ({
    id:         poolIdx,
    word:       words[origIdx],
    correctPos: origIdx,
    slotPos:    null,
    tiltDeg:    (Math.random() - 0.5) * 14,
    baseX:      8 + (poolIdx % 4) * 23,
    baseY:      poolIdx > 3 ? 55 : 10,
    rejected:   false,
    flying:     false,
  }))
}

// ── Component ─────────────────────────────────────────────────

export default function FragePuzzle({ questions, worldTheme, onComplete, onHit }: FragePuzzleProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [qIdx,    setQIdx]    = useState(0)
  const [tiles,   setTiles]   = useState<WordTile[]>([])
  const [timeLeft, setTimer]  = useState(TIMER_SEC)
  const [sweep,   setSweep]   = useState(false)
  const scoreRef  = useRef(0)
  const doneRef   = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const slotRefs  = useRef<(HTMLDivElement | null)[]>([])

  const currentQ  = questions[qIdx]
  const sentence  = useMemo(() => currentQ ? getSentence(currentQ) : '', [currentQ])
  const wordCount = useMemo(() => sentence.split(/\s+/).slice(0, MAX_WORDS).length, [sentence])

  // Init tiles when question changes
  useEffect(() => {
    if (!sentence) return
    setTiles(buildTiles(sentence))
    slotRefs.current = Array(wordCount).fill(null)
    setTimer(TIMER_SEC)
    setSweep(false)
  }, [sentence, wordCount])

  // Timer
  useEffect(() => {
    if (doneRef.current) return
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          feel.haptic('fail')
          onHit?.()
          if (!prm) feel.shake('soft')
          bus.emit('answerWrong', {
            questionIndex: qIdx,
            correctAnswer: sentence,
            givenAnswer: '(timeout)',
          })
          setTimeout(() => advanceQuestion(), 600)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, doneRef.current])

  const advanceQuestion = useCallback(() => {
    if (doneRef.current) return
    const next = qIdx + 1
    if (next >= questions.length) {
      doneRef.current = true
      bus.emit('roomComplete', { roomIndex: 3, score: scoreRef.current, allCorrect: false })
      onComplete(scoreRef.current)
    } else {
      setQIdx(next)
    }
  }, [qIdx, questions.length, onComplete])

  // ── Check win ─────────────────────────────────────────────────
  const checkWin = useCallback((updated: WordTile[]) => {
    const placed = updated.filter(t => t.slotPos !== null).length
    if (placed < wordCount) return

    // All placed — verify order
    const inOrder = updated
      .filter(t => t.slotPos !== null)
      .every(t => t.slotPos === t.correctPos)

    if (!inOrder) return  // some were already rejected and retried

    clearInterval(timerRef.current!)
    const pts = 20 + timeLeft  // bonus for speed

    scoreRef.current += pts
    setSweep(true)

    sfx.play('golden_chime')
    if (!prm) {
      feel.haptic('success')
      feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 'sparkle', 18)
      feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 'golden',  8)
      feel.floatText(`+${pts} XP`, { x: window.innerWidth / 2, y: window.innerHeight * 0.3 }, '#FFD700', 1.2)
    }
    bus.emit('answerCorrect', { questionIndex: qIdx, points: pts, fast: timeLeft > 20, combo: 0 })

    setTimeout(() => {
      setSweep(false)
      advanceQuestion()
    }, 1600)
  }, [wordCount, timeLeft, prm, feel, qIdx, advanceQuestion])

  // ── Tile tap ──────────────────────────────────────────────────
  const handleTileTap = useCallback((tileId: number) => {
    const tile = tiles.find(t => t.id === tileId)
    if (!tile || tile.slotPos !== null || tile.flying || sweep) return

    // Find the next empty slot
    const nextSlot = (() => {
      for (let i = 0; i < wordCount; i++) {
        if (!tiles.some(t => t.slotPos === i)) return i
      }
      return -1
    })()

    if (nextSlot < 0) return

    // Check if this tile belongs in this slot
    const correct = tile.correctPos === nextSlot

    if (correct) {
      // Place it
      setTiles(prev => {
        const updated = prev.map(t =>
          t.id === tileId ? { ...t, slotPos: nextSlot, flying: false } : t
        )
        sfx.play('correct_soft')
        feel.haptic('tick')
        const slotEl = slotRefs.current[nextSlot]
        if (slotEl && !prm) {
          const r = slotEl.getBoundingClientRect()
          feel.particles({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 'sparkle', 4)
        }
        checkWin(updated)
        return updated
      })
    } else {
      // Wrong position — reject
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
      setTiles(prev => prev.map(t =>
        t.id === tileId ? { ...t, rejected: true } : t
      ))
      setTimeout(() => setTiles(prev => prev.map(t =>
        t.id === tileId ? { ...t, rejected: false } : t
      )), 500)
    }
  }, [tiles, wordCount, sweep, prm, feel, checkWin])

  // Sandglass SVG: fill fraction
  const sandFrac = timeLeft / TIMER_SEC   // 1 = full (start), 0 = empty

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full min-h-[500px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #050008 100%)` }}
    >
      {/* Question / instruction */}
      <div className="px-4 pt-4 pb-1 min-h-[52px] flex items-center justify-center">
        {currentQ && (
          <motion.p
            key={qIdx}
            className="font-body text-white/55 text-center text-[11px] leading-snug max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {t('rooms.puzzle_instruction', 'Bringe die Wörter in die richtige Reihenfolge')}
          </motion.p>
        )}
      </div>

      {/* ── Slot row ─────────────────────────────────────────── */}
      <div className="px-3 mb-2">
        <div className="flex flex-wrap gap-1.5 justify-center min-h-[40px] items-center">
          {Array.from({ length: wordCount }).map((_, si) => {
            const placed = tiles.find(t => t.slotPos === si)
            return (
              <div
                key={si}
                ref={el => { slotRefs.current[si] = el }}
                className="relative rounded-lg border min-w-[36px] h-9 px-2 flex items-center justify-center"
                style={{
                  borderColor:  placed ? worldTheme.primaryColor : `${worldTheme.primaryColor}35`,
                  background:   placed ? `${worldTheme.primaryColor}20` : 'rgba(255,255,255,0.04)',
                  boxShadow:    placed && sweep ? `0 0 12px ${worldTheme.primaryColor}60` : 'none',
                  transition:   'box-shadow 0.3s',
                }}
              >
                {placed && (
                  <motion.span
                    className="font-body font-semibold text-white text-[12px] whitespace-nowrap"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                    style={sweep ? { color: worldTheme.primaryColor } : {}}
                  >
                    {placed.word}
                  </motion.span>
                )}
                {/* Sweep highlight */}
                {sweep && placed && (
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: worldTheme.primaryColor + '30' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.5, delay: si * 0.12 }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div
        className="mx-4 h-px mb-2"
        style={{ background: `${worldTheme.primaryColor}25` }}
      />

      {/* ── Tile pool ────────────────────────────────────────── */}
      <div className="relative h-[180px] mx-3">
        {tiles
          .filter(t => t.slotPos === null)
          .map(tile => (
            <motion.button
              key={`${qIdx}-${tile.id}`}
              className="absolute rounded-lg border px-2 py-1.5 font-body text-[12px] text-white cursor-pointer"
              style={{
                left:        `${tile.baseX}%`,
                top:         `${tile.baseY}%`,
                borderColor: tile.rejected ? '#FF4444' : `${worldTheme.primaryColor}60`,
                background:  tile.rejected
                  ? 'rgba(255,68,68,0.15)'
                  : `${worldTheme.primaryColor}15`,
                rotate:      `${tile.tiltDeg}deg`,
              }}
              animate={
                !prm
                  ? tile.rejected
                    ? { x: [-8, 8, -8, 8, 0], rotate: tile.tiltDeg }
                    : { y: [0, -3, 0] }
                  : {}
              }
              transition={
                tile.rejected
                  ? { duration: 0.35 }
                  : { duration: 2 + tile.id * 0.3, repeat: Infinity, ease: 'easeInOut', delay: tile.id * 0.4 }
              }
              whileTap={{ scale: 0.92 }}
              onClick={() => handleTileTap(tile.id)}
            >
              {tile.word}
            </motion.button>
          ))}
      </div>

      {/* ── Sandglass timer ──────────────────────────────────── */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
          {/* Frame */}
          <path d="M4,2 L24,2 L24,8 L14,18 L24,28 L24,34 L4,34 L4,28 L14,18 L4,8 Z"
            fill="none" stroke={worldTheme.primaryColor + '50'} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Top sand */}
          <clipPath id="topSand">
            <rect x="4" y="2" width="20" height={`${8 * sandFrac}`} />
          </clipPath>
          <path d="M4,2 L24,2 L24,8 L14,18 Z"
            fill={worldTheme.primaryColor + '70'} clipPath="url(#topSand)" />
          {/* Bottom sand */}
          <clipPath id="botSand">
            <rect x="4" y={`${28 - 10 * (1 - sandFrac)}`} width="20" height="10" />
          </clipPath>
          <path d="M4,28 L14,18 L24,28 L24,34 L4,34 Z"
            fill={worldTheme.primaryColor + '70'} clipPath="url(#botSand)" />
        </svg>
        <p className="font-body text-[8px] text-white/30 text-center -mt-1">{timeLeft}</p>
      </div>
    </div>
  )
}
