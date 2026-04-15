import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, ACHIEVEMENT_DEFS } from '../gameStore'

// Reset store before each test
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
    unlockedAchievements: [],
    dailyChallenge: null,
  })
})

// ── setQuestions ──────────────────────────────────────────────────────────────

describe('gameStore – setQuestions', () => {
  const mockQuestions = [
    {
      question: 'Was ist 1+1?',
      answers: ['2', '3', '4', '5'],
      correctIndex: 0,
      difficulty: 1 as const,
      question_type: 'mc' as const,
    },
  ]

  it('setzt Fragen und Welt-ID', () => {
    useGameStore.getState().setQuestions(mockQuestions, 'world-abc')
    const state = useGameStore.getState()
    expect(state.questions).toEqual(mockQuestions)
    expect(state.currentWorldId).toBe('world-abc')
  })

  it('setzt questionIndex auf 0 zurück', () => {
    useGameStore.setState({ currentQuestionIndex: 5 })
    useGameStore.getState().setQuestions(mockQuestions, 'world-abc')
    expect(useGameStore.getState().currentQuestionIndex).toBe(0)
  })

  it('setzt HP auf 3 zurück', () => {
    useGameStore.setState({ playerHP: 1 })
    useGameStore.getState().setQuestions(mockQuestions, 'world-abc')
    expect(useGameStore.getState().playerHP).toBe(3)
  })

  it('setzt Score auf 0 zurück', () => {
    useGameStore.setState({ score: 999 })
    useGameStore.getState().setQuestions(mockQuestions, 'world-abc')
    expect(useGameStore.getState().score).toBe(0)
  })
})

// ── nextQuestion ──────────────────────────────────────────────────────────────

describe('gameStore – nextQuestion', () => {
  it('erhöht currentQuestionIndex um 1', () => {
    expect(useGameStore.getState().currentQuestionIndex).toBe(0)
    useGameStore.getState().nextQuestion()
    expect(useGameStore.getState().currentQuestionIndex).toBe(1)
    useGameStore.getState().nextQuestion()
    expect(useGameStore.getState().currentQuestionIndex).toBe(2)
  })
})

// ── checkNewAchievements ──────────────────────────────────────────────────────

describe('gameStore – checkNewAchievements', () => {
  it('gibt IDs neu freigeschalteter Achievements zurück', () => {
    // level >= 1 unlocks 'first_win'
    useGameStore.setState({ level: 1 })
    const newIds = useGameStore.getState().checkNewAchievements()
    expect(newIds).toContain('first_win')
  })

  it('gibt leeres Array wenn kein neues Achievement', () => {
    // Mark all level-1 achievements as already unlocked
    useGameStore.setState({ level: 1, unlockedAchievements: ['first_win'] })
    const newIds = useGameStore.getState().checkNewAchievements()
    expect(newIds).not.toContain('first_win')
  })

  it('speichert neue Achievements in unlockedAchievements', () => {
    useGameStore.setState({ level: 5 })
    useGameStore.getState().checkNewAchievements()
    const { unlockedAchievements } = useGameStore.getState()
    expect(unlockedAchievements).toContain('first_win')
    expect(unlockedAchievements).toContain('level5')
  })

  it('gibt mehrere neue Achievements auf einmal zurück', () => {
    // Streak achievements
    useGameStore.setState({ streak: 7 })
    const newIds = useGameStore.getState().checkNewAchievements()
    expect(newIds).toContain('streak3')
    expect(newIds).toContain('streak7')
  })

  it('gibt bereits freigeschaltete Achievements NICHT nochmals zurück', () => {
    useGameStore.setState({ level: 5, unlockedAchievements: ['first_win', 'level5'] })
    const newIds = useGameStore.getState().checkNewAchievements()
    expect(newIds).not.toContain('first_win')
    expect(newIds).not.toContain('level5')
  })

  it('sessions10 wird bei 10 Sessions freigeschaltet', () => {
    useGameStore.setState({ totalSessions: 10 })
    const newIds = useGameStore.getState().checkNewAchievements()
    expect(newIds).toContain('sessions10')
  })
})

// ── initDailyChallenge ────────────────────────────────────────────────────────

describe('gameStore – initDailyChallenge', () => {
  it('erstellt eine Daily Challenge für heute', () => {
    expect(useGameStore.getState().dailyChallenge).toBeNull()
    useGameStore.getState().initDailyChallenge()
    const challenge = useGameStore.getState().dailyChallenge
    expect(challenge).not.toBeNull()
    expect(challenge?.date).toBe(new Date().toDateString())
    expect(challenge?.completed).toBe(false)
  })

  it('setzt Challenge NICHT zurück wenn bereits für heute vorhanden', () => {
    useGameStore.getState().initDailyChallenge()
    const firstChallenge = useGameStore.getState().dailyChallenge

    useGameStore.getState().initDailyChallenge() // call again
    const secondChallenge = useGameStore.getState().dailyChallenge

    expect(secondChallenge).toEqual(firstChallenge)
  })

  it('erstellt neue Challenge wenn bestehende für anderen Tag ist', () => {
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    useGameStore.setState({
      dailyChallenge: {
        date: yesterday,
        type: 'win_session',
        labelKey: 'challenge.win_session_label',
        descKey: 'challenge.win_session_desc',
        completed: true,
      },
    })

    useGameStore.getState().initDailyChallenge()
    const challenge = useGameStore.getState().dailyChallenge

    expect(challenge?.date).toBe(new Date().toDateString())
    expect(challenge?.completed).toBe(false)
  })

  it('Challenge-Typ ist deterministisch für dasselbe Datum', () => {
    useGameStore.getState().initDailyChallenge()
    const type1 = useGameStore.getState().dailyChallenge?.type

    // Reset and call again on same date
    useGameStore.setState({ dailyChallenge: null })
    useGameStore.getState().initDailyChallenge()
    const type2 = useGameStore.getState().dailyChallenge?.type

    expect(type1).toBe(type2)
  })
})

// ── completeDailyChallenge ────────────────────────────────────────────────────

describe('gameStore – completeDailyChallenge', () => {
  beforeEach(() => {
    useGameStore.getState().initDailyChallenge()
  })

  it('markiert Challenge als abgeschlossen', () => {
    expect(useGameStore.getState().dailyChallenge?.completed).toBe(false)
    useGameStore.getState().completeDailyChallenge()
    expect(useGameStore.getState().dailyChallenge?.completed).toBe(true)
  })

  it('kann nicht erneut abgeschlossen werden', () => {
    useGameStore.getState().completeDailyChallenge()
    // A second call should be a no-op (already completed guard)
    useGameStore.getState().completeDailyChallenge()
    expect(useGameStore.getState().dailyChallenge?.completed).toBe(true)
  })

  it('macht nichts wenn keine Challenge existiert', () => {
    useGameStore.setState({ dailyChallenge: null })
    expect(() => useGameStore.getState().completeDailyChallenge()).not.toThrow()
    expect(useGameStore.getState().dailyChallenge).toBeNull()
  })
})

// ── ACHIEVEMENT_DEFS ──────────────────────────────────────────────────────────

describe('ACHIEVEMENT_DEFS – Unlock-Logik', () => {
  it('first_win: freigeschaltet ab Level 1', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'first_win')!
    expect(def.unlocked(1, 0, 0)).toBe(true)
    expect(def.unlocked(0, 0, 0)).toBe(false)
  })

  it('level5: freigeschaltet ab Level 5', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'level5')!
    expect(def.unlocked(4, 0, 0)).toBe(false)
    expect(def.unlocked(5, 0, 0)).toBe(true)
  })

  it('level10: freigeschaltet ab Level 10', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'level10')!
    expect(def.unlocked(9, 0, 0)).toBe(false)
    expect(def.unlocked(10, 0, 0)).toBe(true)
  })

  it('streak3: freigeschaltet ab Streak 3', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'streak3')!
    expect(def.unlocked(1, 2, 0)).toBe(false)
    expect(def.unlocked(1, 3, 0)).toBe(true)
  })

  it('streak7: freigeschaltet ab Streak 7', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'streak7')!
    expect(def.unlocked(1, 6, 0)).toBe(false)
    expect(def.unlocked(1, 7, 0)).toBe(true)
  })

  it('sessions10: freigeschaltet ab 10 Sessions', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'sessions10')!
    expect(def.unlocked(1, 0, 9)).toBe(false)
    expect(def.unlocked(1, 0, 10)).toBe(true)
  })

  it('sessions50: freigeschaltet ab 50 Sessions', () => {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === 'sessions50')!
    expect(def.unlocked(1, 0, 49)).toBe(false)
    expect(def.unlocked(1, 0, 50)).toBe(true)
  })

  it('alle Achievements haben Pflichtfelder', () => {
    for (const def of ACHIEVEMENT_DEFS) {
      expect(def.id).toBeTruthy()
      expect(def.icon).toBeTruthy()
      expect(def.labelKey).toBeTruthy()
      expect(def.descKey).toBeTruthy()
      expect(typeof def.unlocked).toBe('function')
    }
  })
})
