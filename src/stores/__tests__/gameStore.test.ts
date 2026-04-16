import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../gameStore'

// Reset store state before each test
beforeEach(() => {
  useGameStore.setState({
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
    activityDays: {},
    freezeCount: 0,
    lastFreezeRefillDate: null,
    longestStreak: 0,
    previousStreak: 0,
    pendingMilestone: null,
    streakLostPending: false,
    freezeJustUsed: false,
  })
})

describe('gameStore – answerQuestion', () => {
  it('increases score on correct answer', () => {
    useGameStore.getState().answerQuestion(true, 20)
    expect(useGameStore.getState().score).toBe(20)
  })

  it('uses default 10 points when no points given', () => {
    useGameStore.getState().answerQuestion(true)
    expect(useGameStore.getState().score).toBe(10)
  })

  it('does not change score on wrong answer', () => {
    useGameStore.getState().answerQuestion(false, 20)
    expect(useGameStore.getState().score).toBe(0)
  })

  it('decreases HP on wrong answer', () => {
    useGameStore.getState().answerQuestion(false)
    expect(useGameStore.getState().playerHP).toBe(2)
  })

  it('does not let HP go below 0', () => {
    useGameStore.getState().answerQuestion(false)
    useGameStore.getState().answerQuestion(false)
    useGameStore.getState().answerQuestion(false)
    useGameStore.getState().answerQuestion(false)
    expect(useGameStore.getState().playerHP).toBe(0)
  })

  it('does not change HP on correct answer', () => {
    useGameStore.getState().answerQuestion(true)
    expect(useGameStore.getState().playerHP).toBe(3)
  })
})

describe('gameStore – addXP and leveling', () => {
  it('adds XP correctly', () => {
    useGameStore.getState().addXP(50)
    expect(useGameStore.getState().xp).toBe(50)
  })

  it('does not level up below threshold', () => {
    useGameStore.getState().addXP(50)
    expect(useGameStore.getState().level).toBe(1)
    expect(useGameStore.getState().addXP(0).leveledUp).toBe(false)
  })

  it('levels up when XP crosses threshold', () => {
    const result = useGameStore.getState().addXP(150)
    expect(result.leveledUp).toBe(true)
    expect(useGameStore.getState().level).toBe(2)
  })

  it('returns correct newLevel on level-up', () => {
    const result = useGameStore.getState().addXP(500)
    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBe(useGameStore.getState().level)
  })

  it('caps at MAX_LEVEL (100)', () => {
    useGameStore.getState().addXP(1_000_000)
    expect(useGameStore.getState().level).toBe(100)
  })

  it('accumulates XP across multiple addXP calls', () => {
    useGameStore.getState().addXP(50)
    useGameStore.getState().addXP(60)
    expect(useGameStore.getState().xp).toBe(110)
  })
})

describe('gameStore – updateStreak', () => {
  // updateStreak() is a thin shim over recordActivity('dungeon').
  // lastPlayedDate uses toLocalISODate() (YYYY-MM-DD), not Date#toDateString().
  const toISO = (d: Date) => d.toLocaleDateString('en-CA')

  it('sets streak to 1 on first play', () => {
    useGameStore.getState().updateStreak()
    expect(useGameStore.getState().streak).toBe(1)
  })

  it('does not increment streak if already played today', () => {
    useGameStore.getState().updateStreak()
    const firstStreak = useGameStore.getState().streak
    useGameStore.getState().updateStreak()
    // Second call on same day must not increment (already active).
    expect(useGameStore.getState().streak).toBe(firstStreak)
  })

  it('increments streak when played on consecutive day', () => {
    const yesterday = toISO(new Date(Date.now() - 86400000))
    useGameStore.setState({ streak: 3, lastPlayedDate: yesterday })
    useGameStore.getState().updateStreak()
    expect(useGameStore.getState().streak).toBe(4)
  })

  it('resets streak to 1 when day was skipped (no freeze)', () => {
    const twoDaysAgo = toISO(new Date(Date.now() - 2 * 86400000))
    // Disable weekly freeze auto-refill by pretending refill already happened.
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1))
    const mondayStr = toISO(monday)
    useGameStore.setState({
      streak: 5,
      lastPlayedDate: twoDaysAgo,
      freezeCount: 0,
      lastFreezeRefillDate: mondayStr,
    })
    useGameStore.getState().updateStreak()
    expect(useGameStore.getState().streak).toBe(1)
  })
})

describe('gameStore – resetGame', () => {
  it('resets score, HP and question index', () => {
    useGameStore.setState({ score: 300, playerHP: 1, currentQuestionIndex: 5 })
    useGameStore.getState().resetGame()
    const state = useGameStore.getState()
    expect(state.score).toBe(0)
    expect(state.playerHP).toBe(3)
    expect(state.currentQuestionIndex).toBe(0)
  })

  it('does not reset level, XP or streak', () => {
    useGameStore.setState({ level: 5, xp: 900, streak: 7 })
    useGameStore.getState().resetGame()
    const state = useGameStore.getState()
    expect(state.level).toBe(5)
    expect(state.xp).toBe(900)
    expect(state.streak).toBe(7)
  })
})

describe('gameStore – incrementSessions', () => {
  it('increments totalSessions by 1', () => {
    useGameStore.getState().incrementSessions()
    useGameStore.getState().incrementSessions()
    expect(useGameStore.getState().totalSessions).toBe(2)
  })
})
