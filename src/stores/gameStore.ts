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

  // Runtime (not persisted)
  questions: Question[]
  currentWorldId: string | null
  currentQuestionIndex: number
  playerHP: number
  score: number

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
}

// ── XP thresholds ─────────────────────────────────────────────────────────────
// Index i = XP needed to reach level (i+1).
// findIndex returns the first index whose value exceeds newXP → that IS the new level.
// -1 means the player is beyond the last threshold → level 10 (max).
const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

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

      // Runtime defaults
      questions: [],
      currentWorldId: null,
      currentQuestionIndex: 0,
      playerHP: 3,
      score: 0,

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

      resetGame: () => set({ currentQuestionIndex: 0, playerHP: 3, score: 0 }),

      addXP: (amount) => {
        const state = get()
        const newXP = state.xp + amount
        const rawIdx = XP_THRESHOLDS.findIndex((t) => t > newXP)
        const actualLevel = rawIdx === -1 ? 10 : rawIdx
        const leveledUp = actualLevel > state.level
        set({ xp: newXP, level: actualLevel })
        return { leveledUp, newLevel: actualLevel }
      },

      updateStreak: () => {
        const today = new Date().toDateString()
        const state = get()
        if (state.lastPlayedDate === today) return
        const yesterday = new Date(Date.now() - 86400000).toDateString()
        const newStreak = state.lastPlayedDate === yesterday ? state.streak + 1 : 1
        set({ streak: newStreak, lastPlayedDate: today })
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
        playerName: state.playerName,
        level: state.level,
        xp: state.xp,
        streak: state.streak,
        lastPlayedDate: state.lastPlayedDate,
        selectedWorldId: state.selectedWorldId,
        totalSessions: state.totalSessions,
        unlockedAchievements: state.unlockedAchievements,
        dailyChallenge: state.dailyChallenge,
      }),
    },
  ),
)
