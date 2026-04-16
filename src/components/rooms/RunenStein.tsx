/**
 * RunenStein.tsx – Rune-stone room
 *
 * 4 glowing stones in a semicircle. Tap a stone to answer its question.
 * Correct → stone activates (gold aura). Wrong → stone cracks, 2 s cooldown, shake.
 * All 4 active → door tears open with crash particles + chromatic flash.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { bus } from '../../lib/events'
import { pointsForDifficulty } from '../../lib/gameConfig'

// ── Types ──────────────────────────────────────────────────────

export interface RunenSteinProps {
  /** Exactly 4 questions; extras ignored, fewer stones stay dormant */
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
}

// ── Constants ──────────────────────────────────────────────────

/** Semicircle positions (% of container), 4 stones spread across lower half */
const STONE_POS = [
  { x: 14, y: 64 },
  { x: 33, y: 46 },
  { x: 67, y: 46 },
  { x: 86, y: 64 },
]

const STONE_RUNE  = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ']
const STONE_COLOR = ['#8B5CF6', '#A855F7', '#7C3AED', '#9333EA']
const GLOW_DELAY  = [0, 0.5, 1.0, 1.5]

// ── Component ─────────────────────────────────────────────────

export default function RunenStein({ questions, worldTheme, onComplete }: RunenSteinProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const stones = useMemo(() => questions.slice(0, 4), [questions])

  const [activated,  setActivated]  = useState([false, false, false, false])
  const [cracked,    setCracked]    = useState([false, false, false, false])
  const [locked,     setLocked]     = useState([false, false, false, false]) // cooldown
  const [modalIndex, setModalIndex] = useState<number | null>(null)
  const [doorOpen,   setDoorOpen]   = useState(false)
  const scoreRef   = useRef(0)
  const stoneRefs  = useRef<(HTMLButtonElement | null)[]>([null, null, null, null])
  const completeRef = useRef(false)

  // ── Door open when all 4 activated ───────────────────────────
  useEffect(() => {
    if (!activated.every(Boolean) || completeRef.current) return
    completeRef.current = true
    setDoorOpen(true)

    if (!prm) {
      feel.chromatic(0.5, 300)
      feel.flash(`${worldTheme.primaryColor}88`, 400)
      feel.haptic('success')
      feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, 'crash',  20)
      feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, 'golden', 15)
    }
    bus.emit('roomComplete', { roomIndex: 0, score: scoreRef.current, allCorrect: true })

    setTimeout(() => onComplete(scoreRef.current), 1600)
  }, [activated, prm, feel, worldTheme.primaryColor, onComplete])

  // ── Stone tap ─────────────────────────────────────────────────
  const handleStoneTap = useCallback((i: number) => {
    if (activated[i] || locked[i] || doorOpen) return
    const el = stoneRefs.current[i]
    if (el && !prm) feel.zoom(el.getBoundingClientRect(), 350)
    setModalIndex(i)
  }, [activated, locked, doorOpen, prm, feel])

  // ── Answer in modal ───────────────────────────────────────────
  const handleAnswer = useCallback((stoneIdx: number, answerIdx: number) => {
    const q = stones[stoneIdx]
    if (!q) return
    setModalIndex(null)

    const correct = answerIdx === q.correctIndex
    const pts     = correct ? pointsForDifficulty(q.difficulty) : 0

    if (correct) {
      scoreRef.current += pts
      setActivated(prev => { const n = [...prev]; n[stoneIdx] = true; return n })

      const el = stoneRefs.current[stoneIdx]
      if (el && !prm) {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top  + r.height / 2
        feel.particles({ x: cx, y: cy }, 'sparkle', 12)
        feel.particles({ x: cx, y: cy }, 'golden',   6)
        feel.floatText(`+${pts} XP`, { x: cx, y: cy - 20 }, '#A78BFA', 1.1)
      }
      feel.haptic('tick')
      bus.emit('answerCorrect', { questionIndex: stoneIdx, points: pts, fast: false, combo: 0 })
    } else {
      // Crack + 2 s cooldown
      setCracked(prev => { const n = [...prev]; n[stoneIdx] = true;  return n })
      setLocked (prev => { const n = [...prev]; n[stoneIdx] = true;  return n })
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
      bus.emit('answerWrong', {
        questionIndex: stoneIdx,
        correctAnswer: q.answers[q.correctIndex],
        givenAnswer:   q.answers[answerIdx],
      })
      setTimeout(() => {
        setCracked(prev => { const n = [...prev]; n[stoneIdx] = false; return n })
        setLocked (prev => { const n = [...prev]; n[stoneIdx] = false; return n })
      }, 2000)
    }
  }, [stones, feel, prm])

  const activeQ = modalIndex !== null ? stones[modalIndex] : null

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="relative w-full min-h-[480px] overflow-hidden rounded-2xl bg-dark-deep select-none"
         style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #0a0015 100%)` }}>

      {/* Ambient rune glyphs floating in background */}
      {!prm && Array.from({ length: 6 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute font-bold text-xl pointer-events-none"
          style={{
            left:    `${8 + i * 15}%`,
            top:     `${12 + (i % 3) * 18}%`,
            color:   STONE_COLOR[i % 4] + '30',
            userSelect: 'none',
          }}
          animate={{ y: [0, -10, 0], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 3.5 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          {STONE_RUNE[i % 4]}
        </motion.span>
      ))}

      {/* Header */}
      <div className="absolute top-3 inset-x-0 text-center pointer-events-none">
        <p className="font-display text-purple-300/70 text-xs tracking-widest uppercase">
          {t('rooms.runestone_title', 'Runen-Altar')}
        </p>
        <p className="font-body text-white/35 text-[10px] mt-0.5">
          {activated.filter(Boolean).length} / {stones.length}&nbsp;{t('rooms.activated', 'aktiviert')}
        </p>
      </div>

      {/* Door – upper center */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[8%] pointer-events-none">
        <div
          className="relative w-[72px] h-[108px] rounded-t-[36px] border-2 overflow-hidden"
          style={{ borderColor: worldTheme.primaryColor + '50', background: '#030010' }}
        >
          {/* Left panel */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2"
            style={{ background: `linear-gradient(135deg, ${worldTheme.primaryColor}25, #10003a)` }}
            animate={doorOpen ? { x: '-101%' } : { x: 0 }}
            transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* Right panel */}
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: `linear-gradient(225deg, ${worldTheme.primaryColor}25, #10003a)` }}
            animate={doorOpen ? { x: '101%' } : { x: 0 }}
            transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* Door glow when open */}
          <motion.div
            className="absolute inset-0"
            style={{ background: worldTheme.primaryColor }}
            animate={doorOpen ? { opacity: [0, 0.7, 0.3] } : { opacity: 0 }}
            transition={{ duration: 1.2 }}
          />
        </div>
        {/* Arch glow */}
        <motion.div
          className="absolute -inset-3 rounded-t-[44px] blur-xl"
          style={{ background: worldTheme.primaryColor + '40' }}
          animate={{ opacity: activated.filter(Boolean).length * 0.18 + (doorOpen ? 1 : 0) }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* ── 4 Rune Stones ──────────────────────────────────────── */}
      {STONE_POS.map((pos, i) => {
        const stone     = stones[i]
        const isOn      = activated[i]
        const isCracked = cracked[i]
        const isLocked  = locked[i]

        const borderCol = isOn ? '#FFD700' : isCracked ? '#FF4444' : STONE_COLOR[i]
        const bgGrad    = isOn
          ? 'linear-gradient(135deg, #7a5c00, #c9a200)'
          : isCracked
            ? 'linear-gradient(135deg, #2a0000, #1a0a0a)'
            : `linear-gradient(135deg, ${STONE_COLOR[i]}50, #0d0020)`

        return (
          <div
            key={i}
            className="absolute"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Glow pulse (different phase per stone) */}
            {!prm && (
              <motion.div
                className="absolute rounded-xl blur-lg pointer-events-none"
                style={{
                  inset:      -10,
                  background: isOn ? '#FFD700' : isCracked ? '#FF4444' : STONE_COLOR[i],
                }}
                animate={{
                  opacity: isOn
                    ? [0.55, 0.9, 0.55]
                    : isCracked
                      ? [0.7, 0.15, 0.7]
                      : [0.2, 0.45, 0.2],
                  scale: isOn ? [1, 1.12, 1] : [1, 1.06, 1],
                }}
                transition={{
                  duration:  isOn ? 1.4 : 2.6,
                  repeat:    Infinity,
                  ease:      'easeInOut',
                  delay:     GLOW_DELAY[i],
                }}
              />
            )}

            {/* Stone button */}
            <motion.button
              ref={el => { stoneRefs.current[i] = el }}
              className="relative flex flex-col items-center justify-center rounded-xl border-2 cursor-pointer disabled:cursor-default"
              style={{
                width:    68,
                height:   78,
                background: bgGrad,
                borderColor: borderCol + (isOn ? 'ff' : '80'),
                boxShadow:   isOn
                  ? `0 0 18px ${borderCol}70, inset 0 0 8px ${borderCol}25`
                  : isCracked
                    ? `0 0 10px ${borderCol}40`
                    : 'none',
                // Crack shape when wrong
                clipPath: isCracked
                  ? 'polygon(0 0, 100% 0, 100% 85%, 72% 92%, 55% 100%, 40% 88%, 0 100%)'
                  : undefined,
              }}
              animate={!prm && !isLocked && !isOn ? { y: [0, -7, 0] } : { y: 0 }}
              transition={{
                duration: 2.4 + i * 0.35,
                repeat:   !prm && !isLocked && !isOn ? Infinity : 0,
                ease:     'easeInOut',
                delay:    i * 0.45,
              }}
              whileTap={!isLocked && !isOn && stone ? { scale: 0.92 } : undefined}
              onClick={() => handleStoneTap(i)}
              disabled={!stone || isLocked || doorOpen}
              aria-label={`${t('rooms.stone', 'Stein')} ${i + 1}${isOn ? ' ✓' : ''}`}
            >
              <span className="text-2xl leading-none" style={{ filter: isOn ? 'brightness(1.8) drop-shadow(0 0 4px #FFD700)' : 'none' }}>
                {isOn ? '💎' : isCracked ? '🪨' : STONE_RUNE[i]}
              </span>
              <span className="text-[9px] font-body mt-1 text-white/50">{i + 1}</span>
            </motion.button>
          </div>
        )
      })}

      {/* ── Question Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {modalIndex !== null && activeQ && (
          <motion.div
            className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-5 px-4"
            style={{ background: 'linear-gradient(to top, rgba(2,0,18,0.97) 55%, rgba(2,0,18,0.75))' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Stone icon */}
            <div
              className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center text-2xl border-2"
              style={{
                background:  `${STONE_COLOR[modalIndex]}30`,
                borderColor: STONE_COLOR[modalIndex],
                boxShadow:   `0 0 20px ${STONE_COLOR[modalIndex]}50`,
              }}
            >
              {STONE_RUNE[modalIndex]}
            </div>

            {/* Question */}
            <motion.p
              className="font-body font-semibold text-white text-center text-[15px] leading-relaxed mb-5 max-w-xs"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
            >
              {activeQ.question}
            </motion.p>

            {/* Answers */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {activeQ.answers.map((ans, ai) => (
                <motion.button
                  key={ai}
                  className="py-3 px-2 rounded-xl border font-body text-[13px] text-white text-center leading-snug"
                  style={{
                    background:  `${STONE_COLOR[modalIndex]}18`,
                    borderColor: `${STONE_COLOR[modalIndex]}55`,
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + ai * 0.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleAnswer(modalIndex, ai)}
                >
                  {ans}
                </motion.button>
              ))}
            </div>

            <button
              className="mt-4 text-white/25 text-xs font-body"
              onClick={() => setModalIndex(null)}
            >
              {t('common.cancel', 'Abbrechen')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Door-open flash */}
      <AnimatePresence>
        {doorOpen && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none rounded-2xl"
            style={{ background: worldTheme.primaryColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.4, times: [0, 0.25, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Instruction hint (until first stone tapped) */}
      {activated.every(v => !v) && modalIndex === null && (
        <motion.p
          className="absolute bottom-4 inset-x-0 text-center font-body text-white/30 text-xs pointer-events-none"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          {t('rooms.tap_stone', 'Berühre einen Stein')}
        </motion.p>
      )}
    </div>
  )
}
