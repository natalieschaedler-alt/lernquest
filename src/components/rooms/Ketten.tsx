/**
 * Ketten.tsx – Chain-break room
 *
 * The boss is shackled by 5 chains. Answer questions to snap them one by one.
 * Correct → chosen chain breaks (snap animation + crash particles + chain_break sfx).
 * 3/5 chains gone → boss snarls. 5/5 → boss roars (zoom + slowmo), room complete.
 */
import { useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import { bus } from '../../lib/events'
import { pointsForDifficulty } from '../../lib/gameConfig'

// ── Types ──────────────────────────────────────────────────────

export interface KettenProps {
  /** 5 questions — one per chain */
  questions: Question[]
  worldTheme: WorldTheme
  onComplete: (score: number) => void
}

// ── Chain layout ───────────────────────────────────────────────
// Boss SVG center (normalised 0-1): (0.5, 0.35)
// 5 anchor points — walls + floor

const BOSS_CX = 0.5
const BOSS_CY = 0.33

// Anchor points as fractions of container size
const ANCHORS = [
  { x: 0.06, y: 0.12, label: 'top-left'    },
  { x: 0.94, y: 0.12, label: 'top-right'   },
  { x: 0.03, y: 0.62, label: 'mid-left'    },
  { x: 0.97, y: 0.62, label: 'mid-right'   },
  { x: 0.50, y: 0.95, label: 'bottom'      },
]

// ── Component ─────────────────────────────────────────────────

export default function Ketten({ questions, worldTheme, onComplete }: KettenProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const qs = useMemo(() => questions.slice(0, 5), [questions])

  // Which chains are still intact (true = intact)
  const [intact,    setIntact]    = useState([true, true, true, true, true])
  // Index of chain currently "snapping" (brief animation state)
  const [snapping,  setSnapping]  = useState<number | null>(null)
  // Which chain the current question targets (cycles through intact ones)
  const [targetChain, setTargetChain] = useState(0)
  const [qIndex,    setQIndex]    = useState(0)
  const [answered,  setAnswered]  = useState(false)
  const [bossState, setBossState] = useState<'calm' | 'snarl' | 'roar'>('calm')
  const scoreRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const completeRef  = useRef(false)

  const brokenCount = intact.filter(v => !v).length
  const currentQ    = qs[qIndex]

  // ── Find next intact chain (round-robin) ──────────────────────
  const nextIntactChain = useCallback((broken: boolean[]) => {
    for (let i = 0; i < 5; i++) {
      const idx = (targetChain + 1 + i) % 5
      if (!broken[idx]) return idx
    }
    return -1
  }, [targetChain])

  // ── Answer handler ────────────────────────────────────────────
  const handleAnswer = useCallback((answerIdx: number) => {
    if (answered || !currentQ || completeRef.current) return
    setAnswered(true)

    const correct = answerIdx === currentQ.correctIndex
    const pts     = correct ? pointsForDifficulty(currentQ.difficulty) : 0

    if (correct) {
      scoreRef.current += pts

      // Snap the targeted chain
      setSnapping(targetChain)
      const newIntact = intact.map((v, i) => i === targetChain ? false : v)

      // Chain break effects
      sfx.play('chain_break')
      if (!prm) {
        feel.shake('medium')
        // Crash particles at anchor position
        const cont = containerRef.current
        if (cont) {
          const rect = cont.getBoundingClientRect()
          const a    = ANCHORS[targetChain]
          feel.particles(
            { x: rect.left + a.x * rect.width, y: rect.top + a.y * rect.height },
            'crash', 10,
          )
        }
        feel.floatText(`+${pts} XP`, { x: window.innerWidth / 2, y: window.innerHeight * 0.6 }, '#00C896', 1.05)
      }
      feel.haptic('tick')
      bus.emit('answerCorrect', { questionIndex: qIndex, points: pts, fast: false, combo: 0 })

      setTimeout(() => {
        setIntact(newIntact)
        setSnapping(null)
        const remaining = newIntact.filter(Boolean).length

        if (remaining === 0 && !completeRef.current) {
          // ── All 5 chains broken ───────────────────────────────
          completeRef.current = true
          setBossState('roar')

          if (!prm) {
            const cont = containerRef.current
            if (cont) feel.zoom(cont.getBoundingClientRect(), 600)
            feel.slowmo(0.25, 1600)
            feel.chromatic(0.45, 300)
            feel.flash('rgba(255,255,255,0.6)', 400)
            feel.haptic('success')
            feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, 'crash',  25)
            feel.particles({ x: window.innerWidth / 2, y: window.innerHeight * 0.35 }, 'golden', 12)
          }
          bus.emit('bossDefeated', { worldId: worldTheme.id, score: scoreRef.current, duration_sec: 0 })
          setTimeout(() => onComplete(scoreRef.current), 2000)
        } else {
          // Snarl at 3/5 broken
          if (remaining === 2 && bossState === 'calm') {
            setBossState('snarl')
            sfx.play('boss_roar')
          }
          // Find first intact chain after current
          const nc = (() => {
            for (let i = 0; i < 5; i++) {
              const idx = (targetChain + 1 + i) % 5
              if (newIntact[idx]) return idx
            }
            return -1
          })()
          if (nc >= 0) setTargetChain(nc)
          setQIndex(prev => Math.min(prev + 1, qs.length - 1))
          setAnswered(false)
        }
      }, 600)
    } else {
      // Wrong answer – no chain breaks, brief shake
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
      bus.emit('answerWrong', {
        questionIndex: qIndex,
        correctAnswer: currentQ.answers[currentQ.correctIndex],
        givenAnswer:   currentQ.answers[answerIdx],
      })
      setTimeout(() => setAnswered(false), 800)
    }
  }, [answered, currentQ, qIndex, targetChain, intact, prm, feel, qs.length, bossState, nextIntactChain, worldTheme.id, onComplete])

  // ── SVG dimensions (normalised 0-1, rendered via viewBox) ────
  const W = 400
  const H = 500
  const bx = BOSS_CX * W
  const by = BOSS_CY * H

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[520px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #0a000a 100%)` }}
    >
      {/* ── SVG chains layer ────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {ANCHORS.map((a, i) => {
          const ax = a.x * W
          const ay = a.y * H
          const isSnapping = snapping === i
          const isBroken   = !intact[i]
          const isTarget   = !isBroken && i === targetChain && !answered

          // Chain path: straight line boss→anchor with slight curve
          const mx = (bx + ax) / 2 + (i < 2 ? 0 : (i === 4 ? 0 : (i === 2 ? -15 : 15)))
          const my = (by + ay) / 2

          const dashArray  = `8 5`

          return (
            <g key={i}>
              {/* Anchor bolt */}
              {!isBroken && (
                <circle
                  cx={ax} cy={ay} r={6}
                  fill="#555" stroke="#888" strokeWidth="1.5"
                />
              )}

              {/* Chain line */}
              {!isBroken && (
                <motion.path
                  d={`M ${bx} ${by} Q ${mx} ${my} ${ax} ${ay}`}
                  fill="none"
                  stroke={isTarget ? worldTheme.primaryColor : '#666'}
                  strokeWidth={isTarget ? 3 : 2}
                  strokeDasharray={dashArray}
                  strokeLinecap="round"
                  animate={
                    !prm
                      ? isSnapping
                        ? { pathLength: [1, 0.6, 0], opacity: [1, 1, 0] }
                        : isTarget
                          ? { strokeOpacity: [0.6, 1, 0.6] }
                          : { strokeOpacity: 0.55 }
                      : {}
                  }
                  transition={
                    isSnapping
                      ? { duration: 0.5, ease: 'easeIn' }
                      : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                  }
                  style={isSnapping ? { filter: 'drop-shadow(0 0 8px #FF9500)' } : undefined}
                />
              )}

              {/* Break spark at anchor */}
              {isSnapping && !prm && (
                <motion.circle
                  cx={ax} cy={ay} r={12}
                  fill="none"
                  stroke="#FF9500"
                  strokeWidth="2"
                  initial={{ scale: 0.5, opacity: 1 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </g>
          )
        })}

        {/* Boss binding point */}
        <motion.circle
          cx={bx} cy={by} r={22}
          fill="none"
          stroke={worldTheme.primaryColor + '60'}
          strokeWidth="2"
          animate={!prm ? { scale: [1, 1.08, 1], opacity: [0.5, 0.8, 0.5] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>

      {/* ── Boss ────────────────────────────────────────────────── */}
      <div
        className="absolute text-5xl"
        style={{
          left:      `${BOSS_CX * 100}%`,
          top:       `${BOSS_CY * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <motion.span
          animate={
            !prm
              ? bossState === 'roar'
                ? { scale: [1, 1.6, 1.3], rotate: [-5, 5, -5, 5, 0] }
                : bossState === 'snarl'
                  ? { scale: [1, 1.15, 1], x: [-3, 3, -3, 3, 0] }
                  : { y: [0, -5, 0] }
              : {}
          }
          transition={
            bossState === 'roar'
              ? { duration: 0.7 }
              : bossState === 'snarl'
                ? { duration: 0.5 }
                : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{ display: 'inline-block', filter: bossState === 'roar' ? `drop-shadow(0 0 24px ${worldTheme.primaryColor})` : undefined }}
        >
          {bossState === 'roar' ? '😤' : bossState === 'snarl' ? '😠' : worldTheme.bossEmoji}
        </motion.span>

        {/* Roar text */}
        <AnimatePresence>
          {bossState === 'roar' && (
            <motion.div
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-xs"
              style={{ color: worldTheme.primaryColor }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {t('rooms.boss_roar', 'NEEEIN!')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Broken count badge ──────────────────────────────────── */}
      <div className="absolute top-3 inset-x-0 text-center pointer-events-none">
        <span className="font-body text-[10px] text-white/40">
          {brokenCount} / 5 {t('rooms.chains_broken', 'Ketten gesprengt')}
        </span>
      </div>

      {/* ── Question area ───────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
        {currentQ && !completeRef.current && (
          <motion.div
            key={qIndex}
            className="rounded-2xl border p-4"
            style={{
              background:   'rgba(0,0,0,0.75)',
              borderColor:  worldTheme.primaryColor + '40',
              backdropFilter: 'blur(8px)',
            }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Target chain indicator */}
            <p className="font-body text-[10px] text-white/35 mb-2 text-center">
              {t('rooms.break_chain', 'Kette')} {targetChain + 1}
            </p>

            <p className="font-body font-semibold text-white text-[14px] leading-snug text-center mb-3">
              {currentQ.question}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {currentQ.answers.map((ans, ai) => (
                <button
                  key={ai}
                  className="py-2.5 px-2 rounded-xl border font-body text-[12px] text-white text-center transition-colors"
                  style={{
                    background:   `${worldTheme.primaryColor}18`,
                    borderColor:  `${worldTheme.primaryColor}45`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}35` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}18` }}
                  onClick={() => handleAnswer(ai)}
                  disabled={answered}
                >
                  {ans}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* "All chains broken" transition msg */}
        {completeRef.current && (
          <motion.p
            className="text-center font-display text-lg pb-2"
            style={{ color: worldTheme.primaryColor }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {t('rooms.chains_all_broken', '⛓️ Alle Ketten gesprengt!')}
          </motion.p>
        )}
      </div>
    </div>
  )
}
