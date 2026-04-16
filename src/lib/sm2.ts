/**
 * SM-2 Spaced Repetition Algorithm
 *
 * References the original SuperMemo SM-2 algorithm by Piotr Wozniak.
 * Quality scale: 0 = blackout / wrong, 3 = correct but hesitant, 5 = correct and easy.
 */

export interface SM2Input {
  /** 0–5: 0=wrong, 3=correct but hesitant, 5=correct and easy */
  quality: 0 | 1 | 2 | 3 | 4 | 5
  /** Current ease factor (default 2.5, min 1.3) */
  easeFactor: number
  /** Current interval in days */
  interval: number
  /** Successful repetition count */
  repetitions: number
}

export interface SM2Result {
  easeFactor: number
  interval: number
  repetitions: number
  /** ISO timestamp for the next review */
  nextReviewAt: string
}

/**
 * Apply one SM-2 step and return the new scheduling values.
 */
export function sm2Calculate({ quality, easeFactor, interval, repetitions }: SM2Input): SM2Result {
  let newInterval: number
  let newRepetitions: number

  if (quality >= 3) {
    // Correct answer → advance repetitions and extend interval
    if (repetitions === 0) newInterval = 1
    else if (repetitions === 1) newInterval = 6
    else newInterval = Math.round(interval * easeFactor)
    newRepetitions = repetitions + 1
  } else {
    // Wrong answer → reset
    newRepetitions = 0
    newInterval = 1
  }

  // EF' = EF + 0.1 − (5−q)(0.08 + (5−q)×0.02)
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  )

  const nextReviewAt = new Date(Date.now() + newInterval * 86_400_000).toISOString()

  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    interval:   newInterval,
    repetitions: newRepetitions,
    nextReviewAt,
  }
}

/**
 * Maps a dungeon answer to an SM-2 quality score.
 * Correct + fast answer  → 5 (easy)
 * Correct + slow answer  → 3 (hesitant)
 * Wrong answer           → 0 (blackout)
 */
export function qualityFromResult(correct: boolean, fast: boolean): 0 | 3 | 5 {
  if (!correct) return 0
  return fast ? 5 : 3
}

export type EaseStrength = 'green' | 'yellow' | 'red'

/**
 * Converts an ease factor value to a visual strength indicator.
 * green  = ease_factor > 2.5   → gut gelernt
 * yellow = ease_factor 1.8–2.5 → okay
 * red    = ease_factor < 1.8   → braucht Wiederholung
 */
export function easeToStrength(easeFactor: number): EaseStrength {
  if (easeFactor > 2.5) return 'green'
  if (easeFactor >= 1.8) return 'yellow'
  return 'red'
}
