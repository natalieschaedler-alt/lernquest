/**
 * Central configuration for all game constants.
 * Import from here instead of defining locally in each component.
 */

/** Points awarded per question difficulty level */
export function pointsForDifficulty(difficulty: 1 | 2 | 3): number {
  return difficulty === 3 ? 30 : difficulty === 2 ? 20 : 10
}

/** Timer durations in seconds */
export const TIMER = {
  /** Wortwirbel (word bubble) game – time per question */
  WORTWIRBEL: 30,
  /** Wortwirbel warning threshold – show red at/below this value */
  WORTWIRBEL_WARN: 10,
  /** Orakel Kristall (true/false) – time per statement */
  ORAKEL: 5,
  /** Boss fight – default time per question */
  BOSS: 20,
  /** Boss fight – reduced time when "time" special attack is active */
  BOSS_FAST: 10,
} as const

/** Combo bonus thresholds and values for Wortwirbel */
export const COMBO = {
  /** Minimum combo count to earn BONUS_LOW points */
  THRESHOLD_LOW: 2,
  /** Minimum combo count to earn BONUS_HIGH points */
  THRESHOLD_HIGH: 3,
  /** Bonus points at 2-combo */
  BONUS_LOW: 5,
  /** Bonus points at 3+-combo */
  BONUS_HIGH: 10,
} as const

/** Boss fight constants */
export const BOSS = {
  /** Total boss HP */
  HP: 5,
  /** Player starting shields */
  SHIELDS: 3,
} as const
