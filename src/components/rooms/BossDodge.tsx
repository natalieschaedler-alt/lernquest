/**
 * BossDodge.tsx – Reflex-dodge room
 *
 * Player is in one of 3 lanes (left / center / right).
 * Boss throws 3 attacks per round → warned 700 ms before impact.
 * Dodge = move to a different lane before impact.
 * After 3 consecutive dodges → slowmo counter-question.
 * Correct answer → boss takes 1 HP damage; FloatText "−1 HP" over boss.
 * 3 rounds total (or until player takes 3 hits).
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

export interface BossDodgeProps {
  questions: Question[]    // 3 questions (one counter per round)
  worldTheme: WorldTheme
  onComplete: (score: number) => void
  onHit?: () => void
}

type Lane    = 0 | 1 | 2   // left | center | right
type Phase   =
  | 'idle'
  | 'warning'       // attack warning visible, player can move
  | 'impact'        // impact frame (200 ms)
  | 'dodge-ok'      // successful dodge reaction
  | 'got-hit'       // player was hit
  | 'counter-slow'  // 3 dodges → slowmo transition
  | 'counter-q'     // counter question visible
  | 'counter-done'  // brief result pause
  | 'done'

const LANES_X     = [20, 50, 80]  // % of container
const WARNING_MS  = 700
const IMPACT_MS   = 200
const INTER_MS    = 900   // pause between attacks
const ROUNDS      = 3
const ATTACKS_PER_ROUND = 3

// ── Component ─────────────────────────────────────────────────

export default function BossDodge({ questions, worldTheme, onComplete, onHit }: BossDodgeProps) {
  const { t }  = useTranslation()
  const feel   = useFeel()
  const prm    = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Game state
  const [playerLane, setPlayerLane] = useState<Lane>(1)
  const [phase,      setPhase]      = useState<Phase>('idle')
  const [attackLane, setAttackLane] = useState<Lane>(0)
  const [round,      setRound]      = useState(0)        // 0-2
  const [attack,     setAttack]     = useState(0)        // 0-2 within round
  const [dodgeStreak, setDodgeStreak] = useState(0)
  const [bossHP,     setBossHP]     = useState(3)
  const [playerHP,   setPlayerHP]   = useState(3)
  const [counterResult, setCounterResult] = useState<boolean | null>(null)

  const scoreRef   = useRef(0)
  const contRef    = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const doneRef    = useRef(false)

  const currentQ = questions[round] ?? questions[questions.length - 1]

  // ── Advance through attack sequence ──────────────────────────
  const runNextAttack = useCallback(() => {
    if (doneRef.current) return

    // Pick a random attack lane (prefer not the same as last)
    const lane = (() => {
      const choices: Lane[] = [0, 1, 2]
      if (choices.length > 1) {
        return choices[Math.floor(Math.random() * choices.length)]
      }
      return 1 as Lane
    })()

    setAttackLane(lane)
    setPhase('warning')

    const warnTimeout = setTimeout(() => {
      setPhase('impact')

      const impactTimeout = setTimeout(() => {
        setPlayerLane(cur => {
          if (cur === lane) {
            // Hit!
            if (!prm) { feel.shake('hard'); feel.chromatic(0.4, 280) }
            feel.haptic('fail')
            onHit?.()
            setPlayerHP(prev => {
              const next = Math.max(0, prev - 1)
              if (next === 0) {
                doneRef.current = true
                setPhase('done')
                setTimeout(() => onComplete(scoreRef.current), 600)
              }
              return next
            })
            setDodgeStreak(0)
            setPhase('got-hit')
            setTimeout(() => advanceAttack(false), INTER_MS)
          } else {
            // Dodge!
            if (!prm) {
              sfx.play('correct_soft')
              feel.haptic('tick')
            }
            setDodgeStreak(prev => {
              const next = prev + 1
              if (next >= ATTACKS_PER_ROUND) {
                // Counter phase!
                setPhase('counter-slow')
                if (!prm) feel.slowmo(0.3, 2000)
                setTimeout(() => setPhase('counter-q'), 500)
              } else {
                setPhase('dodge-ok')
                setTimeout(() => advanceAttack(true), INTER_MS)
              }
              return next
            })
          }
          return cur
        })
      }, IMPACT_MS)

      return () => clearTimeout(impactTimeout)
    }, WARNING_MS)

    return () => clearTimeout(warnTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prm, feel, onHit, onComplete])

  const advanceAttack = useCallback((dodged: boolean) => {
    if (doneRef.current) return
    setAttack(prev => {
      const next = prev + 1
      if (next >= ATTACKS_PER_ROUND) {
        // End of round
        const nextRound = round + 1
        if (nextRound >= ROUNDS) {
          doneRef.current = true
          setPhase('done')
          bus.emit('roomComplete', { roomIndex: 2, score: scoreRef.current, allCorrect: false })
          setTimeout(() => onComplete(scoreRef.current), 800)
        } else {
          setRound(nextRound)
          setAttack(0)
          setDodgeStreak(0)
          setPhase('idle')
          setTimeout(() => runNextAttack(), INTER_MS)
        }
        return 0
      }
      setTimeout(() => runNextAttack(), INTER_MS)
      return next
    })
  }, [round, runNextAttack, onComplete])

  // Start first attack after mount
  useEffect(() => {
    const id = setTimeout(() => runNextAttack(), 800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Counter question ──────────────────────────────────────────
  const handleCounter = useCallback((answerIdx: number) => {
    if (phase !== 'counter-q' || !currentQ) return
    const correct = answerIdx === currentQ.correctIndex
    const pts     = correct ? pointsForDifficulty(currentQ.difficulty) + 10 : 0

    setCounterResult(correct)
    setPhase('counter-done')

    if (correct) {
      scoreRef.current += pts
      setBossHP(prev => Math.max(0, prev - 1))

      if (!prm) {
        feel.shake('medium')
        feel.chromatic(0.35, 250)
        const cx = window.innerWidth / 2
        feel.floatText('−1 HP', { x: cx, y: window.innerHeight * 0.25 }, '#FF4444', 1.3)
        feel.particles({ x: cx, y: window.innerHeight * 0.25 }, 'crash', 8)
      }
      sfx.play('crit_sharp')
      feel.haptic('success')
      bus.emit('critHit', { multiplier: 1, questionIndex: round })
    } else {
      if (!prm) feel.shake('soft')
      feel.haptic('fail')
    }

    bus.emit(correct ? 'answerCorrect' : 'answerWrong', correct
      ? { questionIndex: round, points: pts, fast: true, combo: 0 }
      : { questionIndex: round, correctAnswer: currentQ.answers[currentQ.correctIndex], givenAnswer: currentQ.answers[answerIdx] }
    )

    setTimeout(() => {
      setCounterResult(null)
      setDodgeStreak(0)
      setPhase('idle')
      advanceAttack(true)
    }, 1200)
  }, [phase, currentQ, prm, feel, round, advanceAttack])

  // ── Keyboard / swipe controls ─────────────────────────────────
  const movePlayer = useCallback((dir: -1 | 1) => {
    if (phase !== 'warning' && phase !== 'idle' && phase !== 'dodge-ok') return
    setPlayerLane(cur => Math.max(0, Math.min(2, cur + dir)) as Lane)
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  movePlayer(-1)
      if (e.key === 'ArrowRight') movePlayer(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [movePlayer])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) movePlayer(delta > 0 ? 1 : -1)
    touchStartX.current = null
  }, [movePlayer])

  // ── Render ────────────────────────────────────────────────────
  const warnX = LANES_X[attackLane]

  return (
    <div
      ref={contRef}
      className="relative w-full min-h-[520px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #080010 100%)` }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Boss ─────────────────────────────────────────────── */}
      <div className="absolute top-[5%] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <motion.div
          className="text-5xl"
          animate={
            !prm
              ? phase === 'got-hit'
                ? { x: [-4, 4, -4, 4, 0], scale: [1, 1.15, 1] }
                : counterResult === true
                  ? { scale: [1, 0.85, 1], rotate: [-5, 5, 0] }
                  : { y: [0, -6, 0] }
              : {}
          }
          transition={{ duration: phase === 'got-hit' ? 0.4 : counterResult === true ? 0.5 : 3, repeat: phase === 'got-hit' || counterResult !== null ? 0 : Infinity }}
        >
          {worldTheme.bossEmoji}
        </motion.div>

        {/* Boss HP bar */}
        <div className="flex gap-1 mt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full border transition-colors"
              style={{
                background:  i < bossHP ? worldTheme.primaryColor : 'transparent',
                borderColor: worldTheme.primaryColor + '80',
              }}
            />
          ))}
        </div>
        <p className="font-body text-[9px] text-white/30 mt-0.5">{worldTheme.bossName}</p>
      </div>

      {/* ── Lane warning zones ────────────────────────────────── */}
      {(phase === 'warning' || phase === 'impact') && (
        <motion.div
          className="absolute bottom-[14%] w-12 pointer-events-none"
          style={{ left: `${warnX}%`, transform: 'translateX(-50%)' }}
        >
          <motion.div
            className="rounded-full"
            style={{ height: 6, background: '#FF4444' }}
            animate={{ opacity: [0.4, 1, 0.4], scaleX: [0.6, 1.3, 0.6] }}
            transition={{ duration: 0.35, repeat: Infinity }}
          />
        </motion.div>
      )}

      {/* ── Falling attack ────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'warning' || phase === 'impact') && (
          <motion.div
            key={`atk-${round}-${attack}`}
            className="absolute text-3xl pointer-events-none"
            style={{ left: `${warnX}%`, transform: 'translateX(-50%)' }}
            initial={{ top: '16%', opacity: 0.9 }}
            animate={{ top: '82%', opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ top: { duration: (WARNING_MS + IMPACT_MS) / 1000, ease: 'linear' }, opacity: { duration: 0.15 } }}
          >
            {['💀', '⚡', '🔥', '☠️', '💣'][Math.floor(Math.random() * 5)]}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Player ───────────────────────────────────────────── */}
      <motion.div
        className="absolute text-4xl"
        style={{ bottom: '12%', transform: 'translateX(-50%)' }}
        animate={{ left: `${LANES_X[playerLane]}%` }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <motion.span
          animate={
            !prm
              ? phase === 'dodge-ok'
                ? { rotate: [-15, 15, 0], y: [0, -10, 0] }
                : phase === 'got-hit'
                  ? { x: [-6, 6, -6, 6, 0] }
                  : {}
              : {}
          }
          transition={{ duration: 0.4 }}
          style={{ display: 'inline-block' }}
        >
          🧙‍♂️
        </motion.span>
      </motion.div>

      {/* Player HP */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="text-base">{i < playerHP ? '❤️' : '🖤'}</span>
        ))}
      </div>

      {/* Dodge / left-right buttons (mobile) */}
      {(phase === 'warning' || phase === 'idle') && (
        <div className="absolute bottom-[22%] inset-x-0 flex justify-between px-4 pointer-events-auto">
          <button
            className="w-12 h-10 rounded-xl font-display text-xl text-white/60 border border-white/20"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => movePlayer(-1)}
          >
            ←
          </button>
          <button
            className="w-12 h-10 rounded-xl font-display text-xl text-white/60 border border-white/20"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => movePlayer(1)}
          >
            →
          </button>
        </div>
      )}

      {/* Round / attack indicator */}
      <div className="absolute top-3 inset-x-0 flex justify-center gap-2 pointer-events-none">
        {Array.from({ length: ATTACKS_PER_ROUND }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              background: i < dodgeStreak
                ? '#00C896'
                : i === dodgeStreak && (phase === 'warning' || phase === 'impact')
                  ? worldTheme.primaryColor
                  : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
      <div className="absolute top-7 inset-x-0 text-center pointer-events-none">
        <span className="font-body text-[9px] text-white/30">
          {t('rooms.round', 'Runde')} {round + 1} / {ROUNDS}
        </span>
      </div>

      {/* ── Counter question overlay ──────────────────────────── */}
      <AnimatePresence>
        {(phase === 'counter-q' || phase === 'counter-done') && (
          <motion.div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-5"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.p
              className="font-body text-[10px] text-white/40 mb-3 tracking-widest uppercase"
              animate={!prm ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ⚡ {t('rooms.counter_window', 'KONTER-FENSTER')} ⚡
            </motion.p>

            {currentQ && (
              <p className="font-body font-semibold text-white text-center text-[15px] leading-snug mb-5 max-w-xs">
                {currentQ.question}
              </p>
            )}

            {phase === 'counter-q' && currentQ && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {currentQ.answers.slice(0, 2).map((ans, ai) => (
                  <motion.button
                    key={ai}
                    className="py-3 px-3 rounded-xl border font-body text-[13px] text-white text-center"
                    style={{
                      background:  `${worldTheme.primaryColor}20`,
                      borderColor: `${worldTheme.primaryColor}60`,
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: ai * 0.06 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCounter(ai)}
                  >
                    {ans}
                  </motion.button>
                ))}
              </div>
            )}

            {phase === 'counter-done' && (
              <motion.p
                className="font-display text-2xl"
                style={{ color: counterResult ? '#00C896' : '#FF6B35' }}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
              >
                {counterResult ? `⚔️ ${t('rooms.hit', 'Treffer!')}` : `🛡️ ${t('rooms.blocked', 'Geblockt!')}`}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Done ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="font-display text-2xl" style={{ color: worldTheme.primaryColor }}>
              {bossHP <= 0
                ? t('rooms.boss_staggered', '🏆 Boss angeschlagen!')
                : t('rooms.survived', '✅ Überlebt!')}
            </p>
            <p className="font-body text-white/50 text-sm">
              Boss HP: {bossHP} / 3
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
