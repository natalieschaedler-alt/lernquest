import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Question } from '../types'

interface GameState {
  playerName: string
  questions: Question[]
  currentWorldId: string | null
  currentQuestionIndex: number
  playerHP: number
  score: number
  level: number
  xp: number
  streak: number
  lastPlayedDate: string | null
  selectedWorldId: string
  totalSessions: number
  setPlayerName: (name: string) => void
  setQuestions: (questions: Question[], worldId: string) => void
  answerQuestion: (correct: boolean, points?: number) => void
  nextQuestion: () => void
  resetGame: () => void
  addXP: (amount: number) => { leveledUp: boolean; newLevel: number }
  updateStreak: () => void
  setSelectedWorldId: (id: string) => void
  incrementSessions: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      playerName: '',
      questions: [],
      currentWorldId: null,
      currentQuestionIndex: 0,
      playerHP: 3,
      score: 0,
      level: 1,
      xp: 0,
      streak: 0,
      lastPlayedDate: null,
      selectedWorldId: 'fire',
      totalSessions: 0,

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
        const xpThresholds = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]
        const newXP = state.xp + amount
        const newLevel = xpThresholds.findIndex((t) => t > newXP) - 1
        const actualLevel = newLevel === -1 ? 10 : Math.max(1, newLevel + 1)
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
      }),
    }
  )
)
