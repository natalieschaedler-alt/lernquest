/**
 * Central Zustand store for LearnQuest game state.
 *
 * Persisted fields (saved to localStorage via `learnquest-game`):
 *   playerName, level, xp, streak, lastPlayedDate,
 *   selectedWorldId, totalSessions, unlockedAchievements, dailyChallenge
 *
 * Runtime fields (reset on page refresh):
 *   questions, currentWorldId, currentQuestionIndex, playerHP, score
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Question } from '../types'

// ── Achievement definitions ──────────────────────────────────────────────────
// Kept here so both the store and ProfilePage reference the same source of truth.
export interface AchievementDef {
  id: string
  icon: string
  labelKey: string
  descKey: string
  /** Returns true when the achievement is earned for the given stats. */
  unlocked: (level: number, streak: number, totalSessions: number) => boolean
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'first_win',
    icon: '⚔️',
    labelKey: 'profile.ach_first_win_label',
    descKey: 'profile.ach_first_win_desc',
    unlocked: (level) => level >= 1,
  },
  {
    id: 'level5',
    icon: '⭐',
    labelKey: 'profile.ach_level5_label',
    descKey: 'profile.ach_level5_desc',
    unlocked: (level) => level >= 5,
  },
  {
    id: 'level10',
    icon: '👑',
    labelKey: 'profile.ach_level10_label',
    descKey: 'profile.ach_level10_desc',
    unlocked: (level) => level >= 10,
  },
  {
    id: 'streak3',
    icon: '🔥',
    labelKey: 'profile.ach_streak3_label',
    descKey: 'profile.ach_streak3_desc',
    unlocked: (_l, streak) => streak >= 3,
  },
  {
    id: 'streak7',
    icon: '💫',
    labelKey: 'profile.ach_streak7_label',
    descKey: 'profile.ach_streak7_desc',
    unlocked: (_l, streak) => streak >= 7,
  },
  {
    id: 'streak30',
    icon: '🌟',
    labelKey: 'profile.ach_streak30_label',
    descKey: 'profile.ach_streak30_desc',
    unlocked: (_l, streak) => streak >= 30,
  },
  {
    id: 'sessions10',
    icon: '🎮',
    labelKey: 'profile.ach_sessions10_label',
    descKey: 'profile.ach_sessions10_desc',
    unlocked: (_l, _s, totalSessions) => totalSessions >= 10,
  },
  {
    id: 'sessions50',
    icon: '🏅',
    labelKey: 'profile.ach_sessions50_label',
    descKey: 'profile.ach_sessions50_desc',
    unlocked: (_l, _s, totalSessions) => totalSessions >= 50,
  },
  {
    id: 'sessions100',
    icon: '🎖️',
    labelKey: 'profile.ach_sessions100_label',
    descKey: 'profile.ach_sessions100_desc',
    unlocked: (_l, _s, totalSessions) => totalSessions >= 100,
  },
  {
    id: 'level25',
    icon: '💎',
    labelKey: 'profile.ach_level25_label',
    descKey: 'profile.ach_level25_desc',
    unlocked: (level) => level >= 25,
  },
  {
    id: 'level50',
    icon: '🔱',
    labelKey: 'profile.ach_level50_label',
    descKey: 'profile.ach_level50_desc',
    unlocked: (level) => level >= 50,
  },
  {
    id: 'streak14',
    icon: '⚡',
    labelKey: 'profile.ach_streak14_label',
    descKey: 'profile.ach_streak14_desc',
    unlocked: (_l, streak) => streak >= 14,
  },
  {
    id: 'streak100',
    icon: '🏆',
    labelKey: 'profile.ach_streak100_label',
    descKey: 'profile.ach_streak100_desc',
    unlocked: (_l, streak) => streak >= 100,
  },
  {
    id: 'streak365',
    icon: '🌞',
    labelKey: 'profile.ach_streak365_label',
    descKey: 'profile.ach_streak365_desc',
    unlocked: (_l, streak) => streak >= 365,
  },
  {
    id: 'scholar',
    icon: '📚',
    labelKey: 'profile.ach_scholar_label',
    descKey: 'profile.ach_scholar_desc',
    // A "scholar" has both depth (level) and dedication (streak)
    unlocked: (level, streak) => level >= 10 && streak >= 7,
  },
]

// ── Daily challenge ───────────────────────────────────────────────────────────

export type DailyChallengeType = 'win_session' | 'no_gameover' | 'combo_3'

export interface DailyChallenge {
  /** The calendar date this challenge was generated for (toDateString()). */
  date: string
  type: DailyChallengeType
  /** i18n key for challenge label */
  labelKey: string
  /** i18n key for challenge description */
  descKey: string
  completed: boolean
}

const CHALLENGE_POOL: Array<Pick<DailyChallenge, 'type' | 'labelKey' | 'descKey'>> = [
  { type: 'win_session',  labelKey: 'challenge.win_session_label',  descKey: 'challenge.win_session_desc' },
  { type: 'no_gameover',  labelKey: 'challenge.no_gameover_label',  descKey: 'challenge.no_gameover_desc' },
  { type: 'combo_3',      labelKey: 'challenge.combo_3_label',      descKey: 'challenge.combo_3_desc' },
]

function pickDailyChallenge(dateString: string): DailyChallenge {
  // Deterministic pick based on the date so all devices show the same challenge.
  const seed = dateString.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const def = CHALLENGE_POOL[seed % CHALLENGE_POOL.length]
  return { ...def, date: dateString, completed: false }
}

// ── Streak helpers ────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in local time. */
export function toLocalISODate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA')
}

/** Returns this week's Monday as "YYYY-MM-DD". Used for weekly freeze refills. */
function getMondayStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return toLocalISODate(new Date(d.setDate(diff)))
}

/** Activity for a single day (stored in activityDays). */
export interface DayActivity {
  /** Number of dungeons completed. */
  d: number
  /** Number of questions answered correctly. */
  q: number
}

/** A day is "active" if ≥1 dungeon was completed OR ≥5 questions were answered. */
function isActiveDay(a: DayActivity): boolean {
  return a.d >= 1 || a.q >= 5
}

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365] as const
export type StreakMilestone = (typeof STREAK_MILESTONES)[number]

// ── Store interface ───────────────────────────────────────────────────────────

interface GameState {
  // Persisted
  playerName: string
  level: number
  xp: number
  streak: number
  lastPlayedDate: string | null
  selectedWorldId: string
  totalSessions: number
  /** IDs of achievements that have already been announced to the player. */
  unlockedAchievements: string[]
  /** Today's daily challenge (null until first play). */
  dailyChallenge: DailyChallenge | null

  // ── Extended streak state (persisted) ──
  /** All-time longest streak. */
  longestStreak: number
  /** Number of freeze tokens available (max 3, +1 every Monday). */
  freezeCount: number
  /** Monday date string of last weekly freeze refill. */
  lastFreezeRefillDate: string | null
  /** Per-day activity counts, keyed by "YYYY-MM-DD". Kept 35 days rolling. */
  activityDays: Record<string, DayActivity>
  /** Set when a streak milestone is reached; cleared by StreakMilestoneModal. */
  pendingMilestone: StreakMilestone | null
  /** Set when a streak is lost; cleared by StreakLostModal. */
  streakLostPending: boolean
  /** The streak value just before it was lost (shown in StreakLostModal). */
  previousStreak: number
  /** Set when a freeze was auto-used this session (for ice animation). */
  freezeJustUsed: boolean

  // ── Level-up & mystery box (persisted) ──
  /** New level number when a level-up just happened; cleared by LevelUpOverlay. */
  pendingLevelUp: number | null
  /** Date string of the last time the daily mystery box was shown. */
  lastMysteryBoxDate: string | null
  /** XP amount for the pending mystery box; null = already claimed today. */
  pendingMysteryBoxXP: number | null

  // Runtime (not persisted)
  questions: Question[]
  currentWorldId: string | null
  currentQuestionIndex: number
  playerHP: number
  score: number
  /** Per-question results for the current session (used by SM-2 update on victory/gameover). */
  questionResults: Array<{ questionIndex: number; correct: boolean; fast: boolean }>

  // Actions
  setPlayerName: (name: string) => void
  setQuestions: (questions: Question[], worldId: string) => void
  answerQuestion: (correct: boolean, points?: number) => void
  nextQuestion: () => void
  resetGame: () => void
  /**
   * Adds XP and recalculates level.
   * @returns Whether the player levelled up and the new level number.
   */
  addXP: (amount: number) => { leveledUp: boolean; newLevel: number }
  /** @deprecated Use recordActivity('dungeon') instead. Kept for compatibility. */
  updateStreak: () => void
  setSelectedWorldId: (id: string) => void
  incrementSessions: () => void
  /**
   * Compares current level/streak/sessions against ACHIEVEMENT_DEFS and
   * returns the IDs of any achievements that are newly unlocked.
   * Marks them as seen so they are not returned again.
   */
  checkNewAchievements: () => string[]
  /**
   * Creates (or refreshes) the daily challenge for today.
   * Safe to call multiple times — only resets when the date changes.
   */
  initDailyChallenge: () => void
  /** Marks today's daily challenge as completed. */
  completeDailyChallenge: () => void
  /** Records the result of a single question answer for the SM-2 update after session. */
  recordQuestionResult: (questionIndex: number, correct: boolean, fast: boolean) => void
  /** Clears per-session question results (called by resetGame and after SR update). */
  clearQuestionResults: () => void
  /**
   * Records a learning activity (dungeon completion or a correct question answer).
   * Handles streak calculation, freeze auto-use, milestone detection, and weekly refill.
   * Safe to call multiple times per day — idempotent for streak purposes.
   * @returns milestone reached (if any) and whether the streak was just lost.
   */
  recordActivity: (type: 'dungeon' | 'question') => { milestoneReached: StreakMilestone | null; streakLost: boolean }
  /** Clears the pending milestone after the popup has been shown. */
  clearPendingMilestone: () => void
  /** Clears the streak-lost flag after the modal has been shown. */
  clearStreakLostPending: () => void
  /** Clears the freeze-just-used flag after the animation has played. */
  clearFreezeJustUsed: () => void
  /** Clears the pending level-up after the overlay has been shown. */
  clearPendingLevelUp: () => void
  /**
   * Awards the daily mystery-box XP. Call once per day on first render.
   * Returns the XP awarded (0 if already claimed today).
   */
  claimMysteryBox: () => number

  // ── Tutorial ──
  /** True after the player has completed the first-dungeon tutorial. */
  firstDungeonDone: boolean
  /** Marks the first-dungeon tutorial as permanently complete. */
  markFirstDungeonDone: () => void
}

// ── XP thresholds (1–100 Levels) ──────────────────────────────────────────────
// XP to go from level N–1 to level N = N × 100.
// Cumulative XP to reach level N  = 100 × N×(N+1)/2
// XP_THRESHOLDS[i] = minimum cumulative XP to enter level i+1
// findIndex((t) => t > xp) returns the current level index directly.
export const XP_THRESHOLDS: number[] = Array.from({ length: 101 }, (_, i) =>
  i === 0 ? 0 : Math.round(100 * i * (i + 1) / 2),
)
// XP_THRESHOLDS[0]=0, [1]=100, [2]=300, [3]=600, [10]=5500, [50]=127500, [100]=505000

export const MAX_LEVEL = 100

/** Cumulative XP required to reach level N. */
export function xpForLevel(n: number): number {
  const clamped = Math.min(Math.max(n, 0), MAX_LEVEL)
  return XP_THRESHOLDS[clamped] ?? XP_THRESHOLDS[MAX_LEVEL]
}

/** Title for a given level (used in ProfilePage & LevelUpOverlay). */
export function getLevelTitle(level: number): string {
  if (level >= 91) return 'Unsterblich'
  if (level >= 81) return 'Mythisch'
  if (level >= 71) return 'Legende'
  if (level >= 61) return 'Großmeister'
  if (level >= 51) return 'Meister'
  if (level >= 41) return 'Experte'
  if (level >= 31) return 'Forscher'
  if (level >= 21) return 'Gelehrter'
  if (level >= 11) return 'Schüler'
  return 'Lehrling'
}

/** Returns progress within the current level as { current, needed, percent }. */
export function getLevelProgress(xp: number, level: number) {
  const lo   = XP_THRESHOLDS[Math.min(level - 1, MAX_LEVEL - 1)] ?? 0
  const hi   = XP_THRESHOLDS[Math.min(level,     MAX_LEVEL)]     ?? xpForLevel(MAX_LEVEL)
  const cur  = xp - lo
  const need = hi - lo
  return {
    current: cur,
    needed:  need,
    percent: need > 0 ? Math.min(100, Math.round((cur / need) * 100)) : 100,
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Persisted defaults
      playerName: '',
      level: 1,
      xp: 0,
      streak: 0,
      lastPlayedDate: null,
      selectedWorldId: 'fire',
      totalSessions: 0,
      unlockedAchievements: [],
      dailyChallenge: null,

      // Level-up & mystery box defaults
      pendingLevelUp:      null,
      lastMysteryBoxDate:  null,
      pendingMysteryBoxXP: null,

      // Tutorial
      firstDungeonDone: false,

      // Extended streak defaults
      longestStreak: 0,
      freezeCount: 1,
      lastFreezeRefillDate: null,
      activityDays: {},
      pendingMilestone: null,
      streakLostPending: false,
      previousStreak: 0,
      freezeJustUsed: false,

      // Runtime defaults
      questions: [],
      currentWorldId: null,
      currentQuestionIndex: 0,
      playerHP: 3,
      score: 0,
      questionResults: [],

      setPlayerName: (name) => set({ playerName: name }),

      setQuestions: (questions, worldId) =>
        set({ questions, currentWorldId: worldId, currentQuestionIndex: 0, playerHP: 3, score: 0 }),

      answerQuestion: (correct, points = 10) =>
        set((state) => ({
          score: correct ? state.score + points : state.score,
          playerHP: correct ? state.playerHP : Math.max(0, state.playerHP - 1),
        })),

      nextQuestion: () =>
        set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),

      resetGame: () => set({ currentQuestionIndex: 0, playerHP: 3, score: 0, questionResults: [] }),

      recordQuestionResult: (questionIndex, correct, fast) =>
        set((state) => ({
          questionResults: [...state.questionResults, { questionIndex, correct, fast }],
        })),

      clearQuestionResults: () => set({ questionResults: [] }),

      addXP: (amount) => {
        const state = get()
        const newXP = state.xp + amount
        const rawIdx = XP_THRESHOLDS.findIndex((t) => t > newXP)
        const actualLevel = rawIdx === -1 ? MAX_LEVEL : rawIdx
        const leveledUp = actualLevel > state.level
        set({
          xp:           newXP,
          level:        actualLevel,
          pendingLevelUp: leveledUp ? actualLevel : state.pendingLevelUp,
        })
        return { leveledUp, newLevel: actualLevel }
      },

      updateStreak: () => {
        // Compatibility shim — delegates to recordActivity.
        get().recordActivity('dungeon')
      },

      recordActivity: (type) => {
        const todayStr = toLocalISODate()
        const state = get()

        // ── 1. Update activityDays ──────────────────────────────────────────
        const prevDay: DayActivity = state.activityDays[todayStr] ?? { d: 0, q: 0 }
        const newDayData: DayActivity = {
          d: prevDay.d + (type === 'dungeon' ? 1 : 0),
          q: prevDay.q + (type === 'question' ? 1 : 0),
        }

        // Prune to last 35 days
        const cutoff = toLocalISODate(new Date(Date.now() - 35 * 86400000))
        const newActivityDays = Object.fromEntries(
          Object.entries({ ...state.activityDays, [todayStr]: newDayData })
            .filter(([date]) => date >= cutoff)
        )
        set({ activityDays: newActivityDays })

        const wasActive = isActiveDay(prevDay)
        const isNowActive = isActiveDay(newDayData)

        // Only update streak when today JUST became active
        if (wasActive || !isNowActive) {
          return { milestoneReached: null, streakLost: false }
        }

        // ── 2. Weekly freeze refill ─────────────────────────────────────────
        const thisMonday = getMondayStr()
        let newFreezeCount = state.freezeCount
        let lastFreezeRefillDate = state.lastFreezeRefillDate
        if (lastFreezeRefillDate !== thisMonday) {
          newFreezeCount = Math.min(newFreezeCount + 1, 3)
          lastFreezeRefillDate = thisMonday
        }

        // ── 3. Streak calculation ───────────────────────────────────────────
        const yesterdayStr    = toLocalISODate(new Date(Date.now() - 86400000))
        const dayBeforeStr    = toLocalISODate(new Date(Date.now() - 2 * 86400000))
        const { lastPlayedDate, streak: prevStreak, longestStreak } = state

        let newStreak: number
        let usedFreeze = false
        let streakLost = false
        let previousStreak = state.previousStreak

        if (!lastPlayedDate || lastPlayedDate === todayStr) {
          // First ever activity or already counted today
          newStreak = Math.max(prevStreak, 1)
        } else if (lastPlayedDate === yesterdayStr) {
          // Consecutive day
          newStreak = prevStreak + 1
        } else if (lastPlayedDate === dayBeforeStr && newFreezeCount > 0) {
          // 1-day gap → auto-use a freeze
          newStreak = prevStreak + 1
          newFreezeCount--
          usedFreeze = true
        } else {
          // Gap too large — streak is lost
          previousStreak = prevStreak
          newStreak = 1
          if (prevStreak > 1) streakLost = true
        }

        const newLongestStreak = Math.max(newStreak, longestStreak)

        // ── 4. Milestone detection ──────────────────────────────────────────
        const milestoneReached = (STREAK_MILESTONES as readonly number[]).includes(newStreak)
          ? (newStreak as StreakMilestone)
          : null

        set({
          streak:              newStreak,
          lastPlayedDate:      todayStr,
          longestStreak:       newLongestStreak,
          freezeCount:         newFreezeCount,
          lastFreezeRefillDate,
          pendingMilestone:    milestoneReached ?? state.pendingMilestone,
          streakLostPending:   streakLost,
          previousStreak,
          freezeJustUsed:      usedFreeze,
        })

        return { milestoneReached, streakLost }
      },

      clearPendingMilestone:  () => set({ pendingMilestone: null }),
      clearStreakLostPending: () => set({ streakLostPending: false, previousStreak: 0 }),
      clearFreezeJustUsed:    () => set({ freezeJustUsed: false }),
      clearPendingLevelUp:    () => set({ pendingLevelUp: null }),

      markFirstDungeonDone: () => set({ firstDungeonDone: true }),

      claimMysteryBox: () => {
        const today = toLocalISODate()
        const state = get()
        if (state.lastMysteryBoxDate === today) return 0
        // Random XP 10–200 in multiples of 10
        const xp = (Math.floor(Math.random() * 20) + 1) * 10
        set({ lastMysteryBoxDate: today, pendingMysteryBoxXP: xp })
        return xp
      },

      setSelectedWorldId: (id) => set({ selectedWorldId: id }),

      incrementSessions: () => set((state) => ({ totalSessions: state.totalSessions + 1 })),

      checkNewAchievements: () => {
        const state = get()
        const { level, streak, totalSessions, unlockedAchievements } = state
        const newIds: string[] = []

        for (const def of ACHIEVEMENT_DEFS) {
          if (!unlockedAchievements.includes(def.id) && def.unlocked(level, streak, totalSessions)) {
            newIds.push(def.id)
          }
        }

        if (newIds.length > 0) {
          set({ unlockedAchievements: [...unlockedAchievements, ...newIds] })
        }

        return newIds
      },

      initDailyChallenge: () => {
        const today = new Date().toDateString()
        const state = get()
        if (state.dailyChallenge?.date === today) return
        set({ dailyChallenge: pickDailyChallenge(today) })
      },

      completeDailyChallenge: () => {
        const state = get()
        if (!state.dailyChallenge || state.dailyChallenge.completed) return
        set({ dailyChallenge: { ...state.dailyChallenge, completed: true } })
      },
    }),
    {
      name: 'learnquest-game',
      partialize: (state) => ({
        playerName:           state.playerName,
        level:                state.level,
        xp:                   state.xp,
        streak:               state.streak,
        lastPlayedDate:       state.lastPlayedDate,
        selectedWorldId:      state.selectedWorldId,
        totalSessions:        state.totalSessions,
        unlockedAchievements: state.unlockedAchievements,
        dailyChallenge:       state.dailyChallenge,
        // Level-up & mystery box
        pendingLevelUp:       state.pendingLevelUp,
        lastMysteryBoxDate:   state.lastMysteryBoxDate,
        pendingMysteryBoxXP:  state.pendingMysteryBoxXP,
        // Extended streak fields
        longestStreak:        state.longestStreak,
        freezeCount:          state.freezeCount,
        lastFreezeRefillDate: state.lastFreezeRefillDate,
        activityDays:         state.activityDays,
        pendingMilestone:     state.pendingMilestone,
        streakLostPending:    state.streakLostPending,
        previousStreak:       state.previousStreak,
        // Tutorial
        firstDungeonDone:     state.firstDungeonDone,
      }),
    },
  ),
)
