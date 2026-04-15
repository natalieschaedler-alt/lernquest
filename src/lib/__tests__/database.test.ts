import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  saveMistake,
  markMistakeReviewed,
  saveSession,
  getWorldByHash,
  testConnection,
  getWeeklyLeaderboard,
  updateXP,
} from '../database'

// ── Supabase mock ─────────────────────────────────────────────────────────────
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

// Mock gameStore so syncProfileToStore doesn't blow up in tests
vi.mock('../../stores/gameStore', () => ({
  useGameStore: {
    getState: vi.fn().mockReturnValue({ streak: 0, totalSessions: 0, selectedWorldId: null }),
    setState: vi.fn(),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a chain where `maybeSingle` is the terminal call: select().eq().maybeSingle(). */
function chainMaybySingle(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

/** Builds a chain where `single` is the terminal call (insert → select → single). */
function chainSingle(result: unknown) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

/** Builds a chain for `select().order().limit()`. */
function chainOrderLimit(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  }
}

/** Builds a chain for `select().limit()` (testConnection). */
function chainSelectLimit(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(result),
    }),
  }
}

// ── saveMistake ───────────────────────────────────────────────────────────────

describe('saveMistake', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fügt Fehler in Datenbank ein', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: insertMock })

    await saveMistake('user-1', 'world-1', 3)

    expect(mockFrom).toHaveBeenCalledWith('mistakes')
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      world_id: 'world-1',
      question_index: 3,
    })
  })

  it('wirft nicht wenn Datenbankfehler auftritt (stille Fehlerbehandlung)', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: new Error('DB down') })
    mockFrom.mockReturnValue({ insert: insertMock })

    await expect(saveMistake('user-1', 'world-1', 0)).resolves.toBeUndefined()
  })
})

// ── markMistakeReviewed ────────────────────────────────────────────────────────

describe('markMistakeReviewed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('erhöht review_count bei richtiger Antwort', async () => {
    // First call: fetch current mistake
    mockFrom.mockReturnValueOnce(
      chainMaybySingle({ data: { review_count: 1 }, error: null }),
    )
    // Second call: update
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
    mockFrom.mockReturnValueOnce({ update: updateMock })

    await markMistakeReviewed('mistake-1', true)

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ review_count: 2 }),
    )
  })

  it('setzt review_count auf 0 bei falscher Antwort', async () => {
    mockFrom.mockReturnValueOnce(
      chainMaybySingle({ data: { review_count: 3 }, error: null }),
    )
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
    mockFrom.mockReturnValueOnce({ update: updateMock })

    await markMistakeReviewed('mistake-1', false)

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ review_count: 0 }),
    )
  })

  it('bricht ab wenn Fehler nicht gefunden', async () => {
    mockFrom.mockReturnValueOnce(
      chainMaybySingle({ data: null, error: null }),
    )

    await expect(markMistakeReviewed('nonexistent', true)).resolves.toBeUndefined()
    // Should have called from() only once (the select), not again for update
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('plant nächste Wiederholung in SM-2-Intervallen (korrekt → Intervall 3d nach 1. Review)', async () => {
    mockFrom.mockReturnValueOnce(
      chainMaybySingle({ data: { review_count: 0 }, error: null }),
    )
    const updateEqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })
    mockFrom.mockReturnValueOnce({ update: updateMock })

    const before = Date.now()
    await markMistakeReviewed('mistake-1', true)
    const after = Date.now()

    const call = updateMock.mock.calls[0][0] as { next_review_at: string; review_count: number }
    const reviewDate = new Date(call.next_review_at).getTime()

    // review_count 0→1 → interval should be 3 days (INTERVALS_DAYS[1])
    expect(call.review_count).toBe(1)
    const threeDaysMs = 3 * 86400000
    expect(reviewDate).toBeGreaterThanOrEqual(before + threeDaysMs - 1000)
    expect(reviewDate).toBeLessThanOrEqual(after + threeDaysMs + 1000)
  })
})

// ── saveSession ───────────────────────────────────────────────────────────────

describe('saveSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('speichert Session erfolgreich', async () => {
    const sessionData = {
      user_id: 'u1',
      world_id: 'w1',
      score: 300,
      duration: 120,
      completed_at: new Date().toISOString(),
    }
    const savedSession = { id: 'session-id', ...sessionData }
    mockFrom.mockReturnValue(chainSingle({ data: savedSession, error: null }))

    const result = await saveSession(sessionData as Parameters<typeof saveSession>[0])
    expect(result).toEqual(savedSession)
  })

  it('wirft bei Datenbankfehler', async () => {
    mockFrom.mockReturnValue(chainSingle({ data: null, error: new Error('Constraint violation') }))

    await expect(
      saveSession({
        user_id: 'u1',
        world_id: 'w1',
        score: 0,
        duration: 0,
        completed_at: '',
      } as Parameters<typeof saveSession>[0]),
    ).rejects.toThrow('Constraint violation')
  })
})

// ── getWorldByHash ─────────────────────────────────────────────────────────────

describe('getWorldByHash', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt Welt zurück wenn Hash gefunden', async () => {
    const world = { id: 'world-1', content_hash: 'abc123', questions: [] }
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: world, error: null }),
        }),
      }),
    })

    const result = await getWorldByHash('abc123')
    expect(result).toEqual(world)
  })

  it('gibt null zurück bei Fehler', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
      }),
    })

    const result = await getWorldByHash('abc123')
    expect(result).toBeNull()
  })

  it('gibt null zurück wenn kein Eintrag gefunden', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const result = await getWorldByHash('nonexistent')
    expect(result).toBeNull()
  })
})

// ── testConnection ─────────────────────────────────────────────────────────────

describe('testConnection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt true zurück bei erfolgreicher Verbindung', async () => {
    mockFrom.mockReturnValue(chainSelectLimit({ data: [], error: null }))

    const result = await testConnection()
    expect(result).toBe(true)
  })

  it('gibt false zurück bei Datenbankfehler', async () => {
    mockFrom.mockReturnValue(chainSelectLimit({ data: null, error: { message: 'Connection refused' } }))

    const result = await testConnection()
    expect(result).toBe(false)
  })

  it('gibt false zurück bei Network-Exception', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Network down')),
      }),
    })

    const result = await testConnection()
    expect(result).toBe(false)
  })
})

// ── getWeeklyLeaderboard ───────────────────────────────────────────────────────

describe('getWeeklyLeaderboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt sortierte Leaderboard-Daten zurück', async () => {
    const entries = [
      { id: 'u1', name: 'Alice', weekly_xp: 500, selected_world_id: 'fire' },
      { id: 'u2', name: 'Bob', weekly_xp: 300, selected_world_id: 'water' },
    ]
    mockFrom.mockReturnValue(chainOrderLimit({ data: entries, error: null }))

    const result = await getWeeklyLeaderboard(50)
    expect(result).toEqual(entries)
    expect(result).toHaveLength(2)
  })

  it('gibt leeres Array bei Fehler zurück', async () => {
    mockFrom.mockReturnValue(chainOrderLimit({ data: null, error: new Error('Query failed') }))

    const result = await getWeeklyLeaderboard()
    expect(result).toEqual([])
  })
})

// ── updateXP ──────────────────────────────────────────────────────────────────

describe('updateXP', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ruft increment_xp RPC korrekt auf', async () => {
    mockRpc.mockResolvedValue({ error: null })

    await updateXP('user-1', 50)

    expect(mockRpc).toHaveBeenCalledWith('increment_xp', {
      p_user_id: 'user-1',
      p_delta: 50,
    })
  })

  it('wirft nicht bei RPC-Fehler (stille Fehlerbehandlung)', async () => {
    mockRpc.mockResolvedValue({ error: new Error('RPC failed') })

    await expect(updateXP('user-1', 50)).resolves.toBeUndefined()
  })
})

