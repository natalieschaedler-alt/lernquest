/**
 * TowerDefense – "Wissens-Wächter"
 *
 * Gegner laufen rechts → links auf das Tor zu. Richtig beantwortete Fragen
 * bauen einen Turm auf dem nächsten freien Platz. Türme zerstören Gegner,
 * die sie passieren. 3 HP am Tor. 10 Fragen = 10 Gegner = 10 mögliche Türme.
 *
 * Props spec matches the other minigames: { questions, worldTheme, onComplete }.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import MinigameIntro from './_MinigameIntro'
import { type MinigameResult } from './_MinigameResult'

const MAX_HP        = 3
const WALK_MS       = 11_000     // enemy takes 11s from spawn to gate
const SPAWN_AT_START_MS = 400    // first enemy spawns right after intro
const SPAWN_AFTER_ANSWER_MS = 600 // next enemy spawns 600ms after each answer
const SLOTS         = 5
const SLOT_XS_PCT   = [18, 32, 46, 60, 74] // left to right, slot 0 = closest to gate

const TICK_MS       = 100        // game loop tick
const TOWER_RANGE_PCT = 6        // enemy must be within ±6% of tower.x to be hit
const TOWER_COOLDOWN_MS = 1_600  // between shots per tower

// ── Types ─────────────────────────────────────────────────────

interface Enemy {
  id:        number
  spawnedAt: number     // Date.now()
  dead:      boolean
  deadAt:    number | null
  hitAt:     number | null  // timestamp of hit (for animation)
}

interface Tower {
  slot:      number     // 0..4, lower = closer to gate
  builtAt:   number
  lastFire:  number     // Date.now() of last shot
  shots:     number     // total shots fired
  targetId:  number | null // current visible shot target (for beam animation)
}

interface Shot {
  id:      number
  fromX:   number  // %
  toX:     number  // %
  startedAt: number
}

interface Props {
  questions:  Question[]
  worldTheme: WorldTheme
  onComplete: (result: MinigameResult) => void
}

// ── Helpers ───────────────────────────────────────────────────

function enemyX(e: Enemy, now: number): number {
  const t = Math.min(1, (now - e.spawnedAt) / WALK_MS)
  return 100 - t * 100 // 100% at spawn, 0% at gate
}

function computeStars(hp: number, kills: number): 1 | 2 | 3 {
  // Survived but heavy damage → 1 star
  if (hp <= 0) return 1 // caller checks win/lose separately via hp<=0
  if (hp === MAX_HP && kills >= 8) return 3
  if (hp >= 2) return 2
  return 1
}

// ── Component ─────────────────────────────────────────────────

export default function TowerDefense({ questions, worldTheme, onComplete }: Props) {
  const { t } = useTranslation()
  const feel  = useFeel()
  const prm   = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [phase, setPhase]       = useState<'intro' | 'playing' | 'done'>('intro')
  const [hp, setHp]             = useState(MAX_HP)
  const [towers, setTowers]     = useState<Tower[]>([])
  const [enemies, setEnemies]   = useState<Enemy[]>([])
  const [shots, setShots]       = useState<Shot[]>([])
  const [qIdx, setQIdx]         = useState(0)
  const [score, setScore]       = useState(0)
  const [kills, setKills]       = useState(0)
  const [answered, setAnswered] = useState(false)
  const [answerFlash, setAnswerFlash] = useState<'none' | 'correct' | 'wrong'>('none')

  // refs for loop
  const enemiesRef = useRef<Enemy[]>([])
  const towersRef  = useRef<Tower[]>([])
  const hpRef      = useRef(MAX_HP)
  const killsRef   = useRef(0)
  const shotIdRef  = useRef(0)
  const enemyIdRef = useRef(0)
  const startedAt  = useRef<number>(Date.now())
  const doneRef    = useRef(false)

  useEffect(() => { enemiesRef.current = enemies }, [enemies])
  useEffect(() => { towersRef.current  = towers },  [towers])
  useEffect(() => { hpRef.current      = hp },      [hp])
  useEffect(() => { killsRef.current   = kills },   [kills])

  const currentQ = questions[qIdx] ?? null

  // ── Enemy spawn ────────────────────────────────────────────
  const spawnEnemy = useCallback(() => {
    const id = ++enemyIdRef.current
    const e: Enemy = { id, spawnedAt: Date.now(), dead: false, deadAt: null, hitAt: null }
    setEnemies((prev) => [...prev, e])
  }, [])

  // First spawn after intro
  useEffect(() => {
    if (phase !== 'playing') return
    startedAt.current = Date.now()
    const id = setTimeout(spawnEnemy, SPAWN_AT_START_MS)
    return () => clearTimeout(id)
  }, [phase, spawnEnemy])

  // ── Game loop ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    const interval = setInterval(() => {
      const now = Date.now()

      // 1. Advance enemies; any that reached gate → HP loss
      let gateHits = 0
      const updatedEnemies = enemiesRef.current.map((e) => {
        if (e.dead) return e
        const x = enemyX(e, now)
        if (x <= 0) {
          gateHits++
          return { ...e, dead: true, deadAt: now }
        }
        return e
      })
      if (gateHits > 0) {
        setHp((prev) => {
          const next = Math.max(0, prev - gateHits)
          hpRef.current = next
          return next
        })
        if (!prm) feel.shake('medium')
        sfx.play('wrong_thud')
      }

      // 2. Towers fire at enemies in range (leftmost first to maximize defense)
      const livingEnemies = updatedEnemies.filter((e) => !e.dead)
      const newShots: Shot[] = []
      const updatedTowers = towersRef.current.map((tower) => {
        if (now - tower.lastFire < TOWER_COOLDOWN_MS) return tower
        const tx = SLOT_XS_PCT[tower.slot]
        // Find enemy in range (nearest to gate first)
        const target = livingEnemies
          .filter((e) => {
            const x = enemyX(e, now)
            return x >= tx - TOWER_RANGE_PCT && x <= tx + TOWER_RANGE_PCT
          })
          .sort((a, b) => enemyX(a, now) - enemyX(b, now))[0]
        if (!target) return tower

        // Fire!
        const enemyXVal = enemyX(target, now)
        newShots.push({
          id:        ++shotIdRef.current,
          fromX:     tx,
          toX:       enemyXVal,
          startedAt: now,
        })
        // Mark target as hit (will die in ~200ms after beam)
        const idx = updatedEnemies.findIndex((e) => e.id === target.id)
        if (idx >= 0) updatedEnemies[idx] = { ...updatedEnemies[idx], hitAt: now }
        livingEnemies.splice(livingEnemies.indexOf(target), 1)

        return { ...tower, lastFire: now, shots: tower.shots + 1 }
      })

      // 3. Enemies hit more than 280ms ago → dead
      for (let i = 0; i < updatedEnemies.length; i++) {
        const e = updatedEnemies[i]
        if (!e.dead && e.hitAt && now - e.hitAt > 280) {
          updatedEnemies[i] = { ...e, dead: true, deadAt: now }
          killsRef.current += 1
          setKills((k) => k + 1)
          setScore((s) => s + 50)
          if (!prm) feel.haptic('tick')
          sfx.play('correct_soft')
        }
      }

      // 4. Prune fully-dead enemies older than 900ms (animation complete)
      const pruned = updatedEnemies.filter((e) => !e.dead || (e.deadAt && now - e.deadAt < 900))

      if (newShots.length) setShots((prev) => [...prev, ...newShots])
      setEnemies(pruned)
      setTowers(updatedTowers)
      setShots((prev) => prev.filter((s) => now - s.startedAt < 400)) // cleanup shots

      // 5. Check end conditions
      if (!doneRef.current) {
        if (hpRef.current <= 0) {
          doneRef.current = true
          setPhase('done')
        } else if (qIdx >= questions.length && pruned.every((e) => e.dead)) {
          doneRef.current = true
          setPhase('done')
        }
      }
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [phase, qIdx, questions.length, prm, feel])

  // ── Answer handler ─────────────────────────────────────────
  const handleAnswer = (answerIdx: number) => {
    if (!currentQ || answered || phase !== 'playing') return
    setAnswered(true)
    const correct = answerIdx === currentQ.correctIndex

    if (correct) {
      setAnswerFlash('correct')
      // Build tower on leftmost free slot (slot 0 first to protect gate)
      const usedSlots = new Set(towers.map((tw) => tw.slot))
      let freeSlot = -1
      for (let s = 0; s < SLOTS; s++) {
        if (!usedSlots.has(s)) { freeSlot = s; break }
      }
      if (freeSlot >= 0) {
        setTowers((prev) => [...prev, {
          slot:     freeSlot,
          builtAt:  Date.now(),
          lastFire: 0,
          shots:    0,
          targetId: null,
        }])
      }
      setScore((s) => s + 25)
      if (!prm) feel.haptic('success')
      sfx.play('correct_soft')
    } else {
      setAnswerFlash('wrong')
      if (!prm) feel.haptic('fail')
      sfx.play('wrong_thud')
    }

    // Proceed: spawn next enemy + advance question
    setTimeout(() => {
      setAnswerFlash('none')
      setAnswered(false)
      if (qIdx + 1 < questions.length) {
        setQIdx((i) => i + 1)
        setTimeout(spawnEnemy, SPAWN_AFTER_ANSWER_MS)
      }
    }, 600)
  }

  // ── Done → compute result ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') return
    const timeSpent = Math.round((Date.now() - startedAt.current) / 1000)
    const finalHp   = hpRef.current
    const finalKills = killsRef.current
    const totalScore = finalHp * 100 + finalKills * 50 + score
    const stars = finalHp <= 0 ? 1 : computeStars(finalHp, finalKills)
    const result: MinigameResult = {
      score:          totalScore,
      correctAnswers: towers.length,
      totalQuestions: questions.length,
      timeSpent,
      stars: finalHp <= 0 ? 1 : stars,
      extra: finalHp > 0
        ? `${finalKills} Gegner vernichtet · ${finalHp} HP übrig`
        : 'Das Tor wurde überrannt.',
    }
    // Slight delay so user sees the final state
    const id = setTimeout(() => onComplete(result), 800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Render ─────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="relative w-full min-h-[540px] overflow-hidden rounded-2xl bg-dark select-none">
        <MinigameIntro
          emoji="🏰"
          title={t('minigame.td.title', 'Wissens-Wächter')}
          hint={t('minigame.td.hint', 'Beantworte Fragen, um Türme zu bauen. Halte die Gegner auf!')}
          color={worldTheme.primaryColor}
          onDismiss={() => setPhase('playing')}
        />
      </div>
    )
  }

  if (phase === 'done') {
    return null // result shown via onComplete callback
  }

  const now = Date.now()

  return (
    <div
      className="relative w-full min-h-[540px] overflow-hidden rounded-2xl select-none"
      style={{
        background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #05000d 100%)`,
      }}
    >
      {/* ── HP bar + kill counter ─────────────────────────── */}
      <div className="absolute top-3 inset-x-0 flex justify-between px-4 z-10">
        <div className="flex gap-1" aria-label={`${hp} von 3 HP`}>
          {Array.from({ length: MAX_HP }).map((_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i === hp ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.4 }}
              style={{ fontSize: 18, opacity: i < hp ? 1 : 0.15 }}
            >
              ❤️
            </motion.span>
          ))}
        </div>
        <div className="font-body text-xs text-white/70">
          {t('minigame.td.kills', 'Gegner')}: <strong style={{ color: worldTheme.primaryColor }}>{kills}</strong>
          <span className="mx-2 text-white/20">·</span>
          {t('minigame.td.score', 'Punkte')}: <strong style={{ color: '#FFD700' }}>{score}</strong>
        </div>
      </div>

      {/* ── Battlefield (tower row + enemy row) ────────────── */}
      <div className="absolute left-0 right-0" style={{ top: '30%' }}>
        {/* Gate at left */}
        <motion.div
          animate={hp < MAX_HP ? { x: [0, -4, 4, -2, 0] } : {}}
          transition={{ duration: 0.3 }}
          className="absolute"
          style={{ left: '2%', top: -10, bottom: -40, width: 24 }}
        >
          <div
            className="w-full h-full rounded-sm"
            style={{
              background: `linear-gradient(180deg, ${worldTheme.primaryColor}, #1a0028)`,
              border: `2px solid ${worldTheme.primaryColor}aa`,
              boxShadow: `0 0 20px ${worldTheme.primaryColor}55`,
            }}
          />
          <p className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white/50 uppercase whitespace-nowrap">
            Tor
          </p>
        </motion.div>

        {/* Tower slots (illustrative outlines) */}
        {SLOT_XS_PCT.map((xPct, slot) => {
          const tower = towers.find((tw) => tw.slot === slot)
          return (
            <div
              key={slot}
              className="absolute flex flex-col items-center"
              style={{ left: `${xPct}%`, top: -50, width: 44, marginLeft: -22 }}
            >
              {tower ? (
                <motion.div
                  initial={{ y: -30, opacity: 0, scale: 0.4 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  style={{
                    fontSize: 30,
                    filter: `drop-shadow(0 0 8px ${worldTheme.primaryColor})`,
                  }}
                >
                  🗼
                </motion.div>
              ) : (
                <div
                  className="w-8 h-10 rounded-t-lg border border-dashed opacity-20"
                  style={{ borderColor: '#fff' }}
                />
              )}
            </div>
          )
        })}

        {/* Path line (decorative) */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: 0,
            height: 3,
            background: `repeating-linear-gradient(90deg, ${worldTheme.primaryColor}30 0 12px, transparent 12px 20px)`,
          }}
        />

        {/* Enemies */}
        <AnimatePresence>
          {enemies.map((e) => {
            const x = enemyX(e, now)
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: e.dead ? 0 : 1,
                  scale:   e.dead ? 1.5 : (e.hitAt ? 1.25 : 1),
                  rotate:  e.dead ? 30 : 0,
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: e.dead ? 0.6 : 0.2 }}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: 8,
                  fontSize: 26,
                  marginLeft: -13,
                  filter: e.hitAt ? 'brightness(3) hue-rotate(330deg)' : undefined,
                }}
              >
                👹
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Shots (beams) */}
        {shots.map((s) => {
          const age = (now - s.startedAt) / 400
          const fromPx = s.fromX
          const toPx = s.toX
          return (
            <div
              key={s.id}
              className="absolute pointer-events-none"
              style={{
                left: `${Math.min(fromPx, toPx)}%`,
                right: `${100 - Math.max(fromPx, toPx)}%`,
                top: -20,
                height: 3,
                background: `linear-gradient(90deg, transparent, ${worldTheme.primaryColor}, transparent)`,
                opacity: 1 - age,
                transform: 'rotate(-8deg)',
                boxShadow: `0 0 8px ${worldTheme.primaryColor}`,
              }}
            />
          )
        })}
      </div>

      {/* ── Question panel ─────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-6">
        <motion.div
          key={qIdx}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border p-4"
          style={{
            background:   'rgba(0,0,0,0.75)',
            borderColor:
              answerFlash === 'correct' ? '#00C896' :
              answerFlash === 'wrong'   ? '#EF4444' :
              worldTheme.primaryColor + '50',
            backdropFilter: 'blur(8px)',
            transition:   'border-color 0.2s',
          }}
        >
          <p className="font-body text-[10px] text-white/40 text-center mb-2 tracking-widest uppercase">
            {t('minigame.td.wave', 'Welle')} {qIdx + 1} / {questions.length}
          </p>

          <p className="font-body font-semibold text-white text-[14px] leading-snug text-center mb-3">
            {currentQ?.question ?? ''}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {currentQ?.answers.map((ans, ai) => (
              <button
                key={ai}
                className="py-2.5 px-2 rounded-xl border font-body text-[12px] text-white text-center transition-colors cursor-pointer disabled:cursor-default"
                style={{
                  background:   `${worldTheme.primaryColor}18`,
                  borderColor:  `${worldTheme.primaryColor}45`,
                  opacity:      answered ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!answered) (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}35` }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${worldTheme.primaryColor}18` }}
                onClick={() => handleAnswer(ai)}
                disabled={answered}
              >
                {ans}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Re-export the result shape so callers can type their onComplete.
export type { MinigameResult }
