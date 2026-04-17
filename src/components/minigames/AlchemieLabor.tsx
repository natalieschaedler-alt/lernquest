/**
 * AlchemieLabor – "Wissens-Kessel"
 *
 * Ein zentraler Kessel. 4 Zutaten (= Antworten) schweben drumherum.
 * Tippe die RICHTIGE Zutat, um sie in den Kessel zu werfen:
 *   - Richtig → Zutat fliegt rein, Kessel leuchtet grün, Flüssigkeit füllt.
 *   - Falsch  → Kessel flackert rot, Zutat bounct zurück (-1 Lebensleuchten).
 * 5 Rezepte = 5 Fragen pro Runde.
 */
import { useCallback, useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Question, WorldTheme } from '../../types'
import { useFeel } from '../../lib/feel'
import { sfx } from '../../lib/sfx'
import MinigameIntro from './_MinigameIntro'
import { type MinigameResult } from './_MinigameResult'

const TOTAL_RECIPES = 5

interface Props {
  questions:  Question[]
  worldTheme: WorldTheme
  onComplete: (result: MinigameResult) => void
}

interface Ingredient {
  key:       string
  text:      string
  correct:   boolean
  angle:     number  // position around cauldron (deg)
  used:      boolean  // was placed in cauldron
  wrongAt:   number | null  // timestamp of last wrong attempt
}

export default function AlchemieLabor({ questions, worldTheme, onComplete }: Props) {
  const { t } = useTranslation()
  const feel  = useFeel()
  const prm   = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const usedQ = useMemo(() => questions.slice(0, TOTAL_RECIPES), [questions])

  const [phase, setPhase]         = useState<'intro' | 'playing' | 'done'>('intro')
  const [qIdx, setQIdx]           = useState(0)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [score, setScore]         = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [mistakes, setMistakes]   = useState(0)
  const [fill, setFill]           = useState(0)  // 0..1
  const [brewing, setBrewing]     = useState(false)  // end-of-recipe animation
  const [startedAt]               = useState(Date.now())

  const currentQ = usedQ[qIdx] ?? null

  const buildIngredients = useCallback((q: Question): Ingredient[] => {
    const shuffled = q.answers.map((text, i) => ({ text, correct: i === q.correctIndex }))
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 4).map((s, i) => ({
      key:     `${q.question}-${i}`,
      text:    s.text,
      correct: s.correct,
      angle:   (i / 4) * 360 + 22.5, // spread evenly, slight tilt
      used:    false,
      wrongAt: null,
    }))
  }, [])

  useEffect(() => {
    if (phase !== 'playing' || !currentQ) return
    setIngredients(buildIngredients(currentQ))
  }, [currentQ, phase, buildIngredients])

  const handleTap = (idx: number) => {
    if (brewing || phase !== 'playing') return
    const ing = ingredients[idx]
    if (!ing || ing.used) return

    if (ing.correct) {
      // Correct: ingredient flies to cauldron
      setIngredients((prev) => prev.map((p, i) => i === idx ? { ...p, used: true } : p))
      setScore((s) => s + 50 + Math.max(0, 30 - mistakes * 10))
      setCorrectCount((c) => c + 1)
      sfx.play('correct_soft')
      if (!prm) feel.haptic('success')
      setFill((f) => Math.min(1, f + 0.2))

      // After 650ms: recipe complete, move to next
      setBrewing(true)
      setTimeout(() => {
        setBrewing(false)
        setFill(0)
        if (qIdx + 1 >= usedQ.length) {
          setPhase('done')
        } else {
          setQIdx((i) => i + 1)
        }
      }, 900)
    } else {
      // Wrong: flash red + shake
      const now = Date.now()
      setIngredients((prev) => prev.map((p, i) => i === idx ? { ...p, wrongAt: now } : p))
      setMistakes((m) => m + 1)
      sfx.play('wrong_thud')
      if (!prm) { feel.haptic('fail'); feel.shake('soft') }
      setTimeout(() => {
        setIngredients((prev) => prev.map((p, i) => i === idx ? { ...p, wrongAt: null } : p))
      }, 450)
    }
  }

  useEffect(() => {
    if (phase !== 'done') return
    const timeSpent = Math.round((Date.now() - startedAt) / 1000)
    const stars: 1 | 2 | 3 = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1
    const finalScore = score + (mistakes === 0 ? 300 : 0)
    const extra = mistakes === 0
      ? 'Perfekter Gebräu! 🎉'
      : `${correctCount}/${TOTAL_RECIPES} Tränke · ${mistakes} Fehlversuche`
    const id = setTimeout(() => onComplete({
      score:          finalScore,
      correctAnswers: correctCount,
      totalQuestions: TOTAL_RECIPES,
      timeSpent,
      stars,
      extra,
    }), 900)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Render ─────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="relative w-full min-h-[540px] overflow-hidden rounded-2xl bg-dark select-none">
        <MinigameIntro
          emoji="⚗️"
          title={t('minigame.alchemy.title', 'Wissens-Kessel')}
          hint={t('minigame.alchemy.hint', 'Tippe die richtige Zutat, um das Rezept zu brauen. Falsch = Explosion!')}
          color={worldTheme.primaryColor}
          onDismiss={() => setPhase('playing')}
        />
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="relative w-full min-h-[540px] rounded-2xl flex items-center justify-center bg-dark">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p style={{ fontSize: 72 }}>🧪</p>
          <p className="font-display text-2xl mt-2" style={{ color: '#FFD700' }}>
            {t('minigame.alchemy.done', 'Alle Tränke gebraut!')}
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="relative w-full min-h-[540px] overflow-hidden rounded-2xl select-none"
      style={{ background: `radial-gradient(ellipse at 50% 60%, ${worldTheme.primaryColor}25 0%, #0a0015 55%, #02000d 100%)` }}
    >
      {/* Header */}
      <div className="absolute top-3 inset-x-0 text-center pointer-events-none">
        <p className="font-display text-white/80 text-sm tracking-wide">
          ⚗️ {t('minigame.alchemy.recipe', 'Rezept')} {qIdx + 1}/{TOTAL_RECIPES}
        </p>
      </div>

      {/* Recipe = question */}
      <div className="absolute top-12 inset-x-0 px-6">
        <motion.div
          key={qIdx}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-2xl border p-3 mx-auto max-w-md"
          style={{
            background: 'rgba(0,0,0,0.6)',
            borderColor: worldTheme.primaryColor + '50',
            backdropFilter: 'blur(6px)',
          }}
        >
          <p className="font-body font-semibold text-white text-[13px] leading-snug text-center">
            {currentQ?.question ?? ''}
          </p>
        </motion.div>
      </div>

      {/* Cauldron (centered, lower half) */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ bottom: '22%' }}
        animate={brewing ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Steam (animated) */}
        {!prm && fill > 0 && (
          <div className="relative w-20 h-10 mb-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute block rounded-full"
                style={{
                  left: 20 + i * 18,
                  bottom: 0,
                  width: 8,
                  height: 8,
                  background: worldTheme.primaryColor + '55',
                }}
                animate={{ y: [0, -26], opacity: [0.5, 0], scale: [1, 1.8] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}

        {/* Cauldron body */}
        <div
          className="relative rounded-b-[60px] rounded-t-xl overflow-hidden"
          style={{
            width: 140,
            height: 110,
            background: 'linear-gradient(180deg, #2a1a05 0%, #060000 100%)',
            border: '3px solid #4a3010',
            boxShadow: brewing
              ? `0 0 40px ${worldTheme.primaryColor}, inset 0 0 30px ${worldTheme.primaryColor}55`
              : `0 8px 30px rgba(0,0,0,0.6), inset 0 -20px 30px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Liquid */}
          <motion.div
            className="absolute inset-x-1"
            style={{
              bottom: 2,
              background: `linear-gradient(180deg, ${worldTheme.primaryColor}cc 0%, ${worldTheme.primaryColor}55 100%)`,
              borderRadius: '0 0 56px 56px',
            }}
            animate={{ height: `${20 + fill * 80}%` }}
            transition={{ duration: 0.4 }}
          >
            {/* Surface bubbles */}
            {!prm && Array.from({ length: 3 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute block rounded-full bg-white"
                style={{ left: `${20 + i * 30}%`, top: 2, width: 4, height: 4 }}
                animate={{ y: [0, -4, 0], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.2 + i * 0.2, repeat: Infinity }}
              />
            ))}
          </motion.div>
        </div>

        {/* Rim label */}
        <p className="font-body text-[10px] text-white/40 mt-1 uppercase tracking-widest">
          {brewing
            ? t('minigame.alchemy.brewing', 'Brau läuft…')
            : t('minigame.alchemy.cauldron', 'Kessel')}
        </p>
      </motion.div>

      {/* Ingredients placed around cauldron */}
      <div className="absolute inset-0 pointer-events-none">
        {ingredients.map((ing, i) => {
          // Arrange in a 2x2 grid near cauldron
          const row = Math.floor(i / 2)
          const col = i % 2
          return (
            <motion.button
              key={ing.key}
              className="absolute pointer-events-auto py-3 px-4 rounded-full border-2 font-body font-semibold text-white text-[13px] text-center cursor-pointer"
              style={{
                left:  col === 0 ? '6%' : 'auto',
                right: col === 1 ? '6%' : 'auto',
                bottom: row === 0 ? '50%' : '30%',
                background: ing.wrongAt
                  ? 'rgba(180,0,0,0.7)'
                  : ing.used
                    ? 'transparent'
                    : `${worldTheme.primaryColor}35`,
                borderColor: ing.wrongAt
                  ? '#f44'
                  : `${worldTheme.primaryColor}99`,
                maxWidth: 150,
                opacity: ing.used ? 0 : 1,
                transition: 'opacity 0.4s, background 0.2s, border-color 0.2s',
              }}
              disabled={ing.used || brewing}
              onClick={() => handleTap(i)}
              animate={
                ing.used
                  ? { x: '46%', y: '-40%', scale: 0, rotate: 120, opacity: 0 }
                  : ing.wrongAt
                    ? { x: [0, -6, 6, -4, 4, 0] }
                    : { y: [0, -4, 0] }
              }
              transition={
                ing.used
                  ? { duration: 0.55, ease: 'easeIn' }
                  : ing.wrongAt
                    ? { duration: 0.3 }
                    : { duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }
              }
              whileTap={{ scale: 0.92 }}
            >
              {ing.text}
            </motion.button>
          )
        })}
      </div>

      {/* Brewing flash */}
      <AnimatePresence>
        {brewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 70%, ${worldTheme.primaryColor}55, transparent 60%)` }}
          />
        )}
      </AnimatePresence>

      {/* Footer: mistakes */}
      <div className="absolute bottom-3 inset-x-0 text-center">
        <p className="font-body text-xs text-white/50">
          {t('minigame.alchemy.mistakes', 'Fehler')}: <strong style={{ color: '#EF4444' }}>{mistakes}</strong>
          <span className="mx-2 text-white/20">·</span>
          {t('minigame.alchemy.score', 'Punkte')}: <strong style={{ color: '#FFD700' }}>{score}</strong>
        </p>
      </div>
    </div>
  )
}
