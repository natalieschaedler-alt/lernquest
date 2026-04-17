/**
 * PlatformClimber – "Wissens-Turm"
 *
 * Vertical platformer. Character stands on the current level's platform.
 * 4 platforms above show answer choices. Tap the right one → character jumps
 * up. Tap wrong → platform crumbles, character falls 1 level. Reach the top
 * (8 correct) to open the treasure chest.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import MinigameIntro from './_MinigameIntro'
import { type MinigameResult } from './_MinigameResult'

const TOTAL_LEVELS = 8

interface Props {
  questions:  Question[]
  worldTheme: WorldTheme
  onComplete: (result: MinigameResult) => void
}

interface PlatformSlot {
  idx:       number  // 0..3
  answer:    string
  isCorrect: boolean
  crumbled:  boolean
}

export default function PlatformClimber({ questions, worldTheme, onComplete }: Props) {
  const { t } = useTranslation()
  const feel  = useFeel()
  const prm   = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [phase, setPhase]         = useState<'intro' | 'playing' | 'done'>('intro')
  const [level, setLevel]         = useState(0)          // current altitude (0..TOTAL_LEVELS)
  const [qIdx, setQIdx]           = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [anim, setAnim]           = useState<'idle' | 'jumping' | 'falling'>('idle')
  const [platforms, setPlatforms] = useState<PlatformSlot[]>([])
  const [startedAt]               = useState(Date.now())

  const usedQuestions = useMemo(() => questions.slice(0, TOTAL_LEVELS), [questions])
  const currentQ      = usedQuestions[qIdx] ?? null

  // Build 4 shuffled platform slots for current question
  const buildPlatforms = useCallback((q: Question): PlatformSlot[] => {
    const entries = q.answers.map((answer, i) => ({ answer, isCorrect: i === q.correctIndex }))
    // fisher-yates shuffle
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[entries[i], entries[j]] = [entries[j], entries[i]]
    }
    return entries.slice(0, 4).map((e, idx) => ({ idx, answer: e.answer, isCorrect: e.isCorrect, crumbled: false }))
  }, [])

  useEffect(() => {
    if (!currentQ || phase !== 'playing') return
    setPlatforms(buildPlatforms(currentQ))
  }, [currentQ, phase, buildPlatforms])

  // Handle tap
  const handleTap = (slotIdx: number) => {
    if (anim !== 'idle' || phase !== 'playing') return
    const slot = platforms[slotIdx]
    if (!slot || slot.crumbled) return

    if (slot.isCorrect) {
      setAnim('jumping')
      sfx.play('correct_soft')
      if (!prm) feel.haptic('tick')
      setTimeout(() => {
        setLevel((lv) => lv + 1)
        setAnim('idle')
        setQIdx((i) => i + 1)
      }, 450)
    } else {
      // Wrong: crumble platform + show correct briefly + fall
      const newP = platforms.map((p, i) => i === slotIdx ? { ...p, crumbled: true } : p)
      setPlatforms(newP)
      setWrongCount((w) => w + 1)
      sfx.play('wrong_thud')
      if (!prm) { feel.haptic('fail'); feel.shake('soft') }
      setTimeout(() => {
        setAnim('falling')
        setTimeout(() => {
          setLevel((lv) => Math.max(0, lv - 1))
          setAnim('idle')
          setQIdx((i) => i + 1)
        }, 420)
      }, 400)
    }
  }

  // End condition
  useEffect(() => {
    if (phase !== 'playing') return
    if (level >= TOTAL_LEVELS || qIdx >= usedQuestions.length) {
      setPhase('done')
    }
  }, [level, qIdx, usedQuestions.length, phase])

  // Emit result
  useEffect(() => {
    if (phase !== 'done') return
    const timeSpent = Math.round((Date.now() - startedAt) / 1000)
    const reachedTop = level >= TOTAL_LEVELS
    const correctCount = level // each reached level = 1 correct net gain
    const totalAttempts = qIdx
    const stars: 1 | 2 | 3 = reachedTop && wrongCount === 0 ? 3
                           : reachedTop                     ? 2
                           : level >= TOTAL_LEVELS / 2      ? 2
                           : 1
    const score = level * 100 + (wrongCount === 0 && reachedTop ? 300 : 0) + (reachedTop ? 200 : 0)
    const extra = reachedTop
      ? `Gipfel erreicht · ${wrongCount === 0 ? 'fehlerfrei!' : `${wrongCount} Fehler`}`
      : `Höhe: ${level}/${TOTAL_LEVELS}`
    const id = setTimeout(() => onComplete({
      score,
      correctAnswers: correctCount,
      totalQuestions: totalAttempts || TOTAL_LEVELS,
      timeSpent,
      stars,
      extra,
    }), 1100)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Render ─────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="relative w-full min-h-[540px] overflow-hidden rounded-2xl bg-dark select-none">
        <MinigameIntro
          emoji="🗼"
          title={t('minigame.climb.title', 'Wissens-Turm')}
          hint={t('minigame.climb.hint', 'Tippe die richtige Plattform an, um hochzuspringen. Falsch = Absturz!')}
          color={worldTheme.primaryColor}
          onDismiss={() => setPhase('playing')}
        />
      </div>
    )
  }

  if (phase === 'done') {
    // Brief celebration before result
    const reachedTop = level >= TOTAL_LEVELS
    return (
      <div
        className="relative w-full min-h-[540px] rounded-2xl flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${worldTheme.bgFrom} 0%, #000 100%)` }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p style={{ fontSize: 72 }}>{reachedTop ? '🏆' : '💔'}</p>
          <p className="font-display text-2xl mt-2" style={{ color: reachedTop ? '#FFD700' : '#888' }}>
            {reachedTop ? t('minigame.climb.victory', 'Gipfel erreicht!') : t('minigame.climb.defeat', 'Zu früh aufgegeben')}
          </p>
        </motion.div>
      </div>
    )
  }

  // Altitude-based gradient: higher = lighter/more heavenly
  const progressRatio = level / TOTAL_LEVELS
  const skyFrom = `hsla(${240 + progressRatio * 40}, 50%, ${12 + progressRatio * 10}%, 1)`
  const skyTo   = `hsla(${260 - progressRatio * 10}, 55%, ${30 + progressRatio * 20}%, 1)`

  return (
    <div
      className="relative w-full min-h-[540px] overflow-hidden rounded-2xl select-none"
      style={{ background: `linear-gradient(180deg, ${skyTo} 0%, ${skyFrom} 100%)` }}
    >
      {/* Parallax stars (decorative) */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width:  1 + (i % 3),
              height: 1 + (i % 3),
              top:    `${(i * 37) % 100}%`,
              left:   `${(i * 23) % 100}%`,
              opacity: 0.3 + ((i * 7) % 7) / 20,
            }}
          />
        ))}
      </div>

      {/* Altitude label */}
      <div className="absolute top-3 inset-x-0 text-center pointer-events-none">
        <p className="font-display text-white/80 text-sm">
          🏔️ {t('minigame.climb.level', 'Ebene')} {level}/{TOTAL_LEVELS}
        </p>
        <p className="font-body text-xs text-white/40 mt-0.5">
          {t('minigame.climb.wrong', 'Fehler')}: {wrongCount}
        </p>
      </div>

      {/* Question panel at top */}
      <div className="absolute top-14 inset-x-0 px-4">
        <motion.div
          key={qIdx}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-2xl border p-3"
          style={{
            background: 'rgba(0,0,0,0.6)',
            borderColor: worldTheme.primaryColor + '45',
            backdropFilter: 'blur(6px)',
          }}
        >
          <p className="font-body font-semibold text-white text-[13px] leading-snug text-center">
            {currentQ?.question ?? ''}
          </p>
        </motion.div>
      </div>

      {/* Treasure chest at top (peeks at level > 5) */}
      {level > TOTAL_LEVELS - 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{ y: { duration: 2, repeat: Infinity } }}
          className="absolute inset-x-0 text-center"
          style={{ top: '22%', fontSize: 44 }}
        >
          💎
        </motion.div>
      )}

      {/* ── 4 answer platforms (centered row, above character) ── */}
      <div className="absolute inset-x-0" style={{ bottom: '40%' }}>
        <div className="grid grid-cols-2 gap-2 px-6 max-w-md mx-auto">
          <AnimatePresence>
            {platforms.map((p) => (
              <motion.button
                key={`${qIdx}-${p.idx}`}
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: p.crumbled ? 0 : 1, rotate: p.crumbled ? 15 : 0 }}
                exit={{ opacity: 0, y: 40, rotate: 30 }}
                transition={{ type: 'spring', damping: 14 }}
                onClick={() => handleTap(p.idx)}
                disabled={p.crumbled || anim !== 'idle'}
                className="relative py-3 px-3 rounded-xl border-2 font-body text-[13px] text-white text-center cursor-pointer"
                style={{
                  background: p.crumbled ? 'rgba(100,40,40,0.6)' : `${worldTheme.primaryColor}30`,
                  borderColor: p.crumbled ? '#a00' : `${worldTheme.primaryColor}80`,
                  boxShadow:  p.crumbled ? 'none' : `0 4px 0 ${worldTheme.primaryColor}50`,
                  minHeight: 52,
                }}
                whileTap={{ scale: 0.95 }}
              >
                {p.answer}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Character on current platform ── */}
      <motion.div
        className="absolute inset-x-0 flex justify-center pointer-events-none"
        style={{ bottom: '15%' }}
        animate={{
          y:     anim === 'jumping' ? [-0, -80, 0] : anim === 'falling' ? [0, 30] : 0,
          scale: anim === 'jumping' ? [1, 1.1, 1] : 1,
          rotate: anim === 'falling' ? 180 : 0,
        }}
        transition={{ duration: anim === 'jumping' ? 0.45 : 0.4, ease: anim === 'jumping' ? 'easeOut' : 'easeIn' }}
      >
        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.45)',
            border: `2px solid ${worldTheme.primaryColor}`,
            fontSize: 28,
            filter: `drop-shadow(0 4px 12px ${worldTheme.primaryColor}99)`,
          }}
        >
          🧗
        </div>
      </motion.div>

      {/* Dust at feet when idle/fallen */}
      {anim !== 'jumping' && (
        <div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ bottom: '12%' }}
        >
          <div
            className="rounded-full opacity-30"
            style={{ width: 40, height: 6, background: worldTheme.primaryColor }}
          />
        </div>
      )}
    </div>
  )
}
