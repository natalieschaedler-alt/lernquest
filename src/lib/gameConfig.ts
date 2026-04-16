/**
 * Central configuration for all game constants.
 * Import from here instead of defining locally in each component.
 */

/** Points awarded per question difficulty level (game score, not XP) */
export function pointsForDifficulty(difficulty: 1 | 2 | 3): number {
  return difficulty === 3 ? 30 : difficulty === 2 ? 20 : 10
}

// ── XP values ─────────────────────────────────────────────────────────────────

export const XP = {
  /** Base XP for a correct answer. */
  QUESTION_BASE: 25,
  /** XP for a correct answer under FAST_THRESHOLD_MS. */
  QUESTION_FAST: 35,
  /** Flat bonus when completing any dungeon. */
  DUNGEON_COMPLETE: 100,
  /** Additional bonus for a perfect (3-star) dungeon run. */
  DUNGEON_3STARS: 200,
  /** Flat bonus awarded on boss defeat. */
  BOSS_DEFEAT: 150,
  /** Bonus for maintaining a daily streak (awarded when a new active day is registered). */
  DAILY_STREAK_BONUS: 50,
} as const

/** Chance (0–1) that a correct answer triggers a critical hit → 2× XP. */
export const CRIT_CHANCE = 0.15

/** Chance (0–1) that a question is pre-designated as "golden" → 5× XP. */
export const GOLDEN_CHANCE = 0.05

/** Multiplier applied on a golden question. */
export const GOLDEN_MULTIPLIER = 5

/** Multiplier applied when a critical hit occurs. */
export const CRIT_MULTIPLIER = 2

/** Answer time in ms below which the fast bonus applies. */
export const FAST_THRESHOLD_MS = 5000

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
