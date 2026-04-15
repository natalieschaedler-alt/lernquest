import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateQuestions } from '../generateQuestions'

// ── Supabase mock ─────────────────────────────────────────────────────────────
// vi.hoisted ensures these references exist before any import is evaluated.
const { mockFrom, mockGetSession } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: mockGetSession },
  },
}))

// ── Fetch mock ────────────────────────────────────────────────────────────────
// Use vi.stubGlobal so TypeScript doesn't need Node's `global` type.
const mockFetch = vi.fn<typeof fetch>()

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A learning text that passes the content filter (≥80 chars, no blocked words). */
const VALID_TEXT =
  'Die Photosynthese ist ein biochemischer Prozess durch den grüne Pflanzen Lichtenergie in chemische Energie umwandeln und dabei Sauerstoff freisetzen.'

/** A minimal GeneratedData response returned by the mock API. */
const MOCK_API_DATA = {
  summary: 'Photosynthese',
  key_concepts: ['Chlorophyll', 'CO2'],
  difficulty_overall: 2,
  multiple_choice: [
    {
      question: 'Was macht Photosynthese?',
      correct: 'Energie umwandeln',
      wrong: ['Wasser trinken', 'Luft atmen', 'Wachsen'],
      difficulty: 2,
      explanation: 'Licht → Energie',
      variants: [],
    },
  ],
  true_false: [],
  memory_pairs: [],
  fill_blanks: [],
}

/** Sets up the chain for a cache lookup that returns `result`. */
function mockCacheLookup(result: { data: unknown; error?: unknown }) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(result),
      }),
    }),
  })
}

/** Sets up the chain for an insert that returns `result`. */
function mockInsertSave(result: { data: unknown; error?: unknown }) {
  mockFrom.mockReturnValueOnce({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  })
}

/** Returns a mock Response-like object for fetch. */
function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateQuestions – content filter', () => {
  it('wirft bei Text kürzer als 80 Zeichen', async () => {
    await expect(generateQuestions('Zu kurz')).rejects.toThrow('80')
  })

  it('wirft bei geblockte Inhalte (Gewalt-Keyword)', async () => {
    const blockedText =
      'Dieser Text handelt vom Töten und anderen sehr gefährlichen Dingen die Schüler nicht lernen sollten.'
    await expect(generateQuestions(blockedText)).rejects.toThrow('Schüler')
  })
})

describe('generateQuestions – Cache-Hit', () => {
  const cachedQuestions = [
    { question: 'Was ist Photosynthese?', answers: ['A', 'B', 'C', 'D'], correctIndex: 0, difficulty: 2 as const },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockCacheLookup({ data: { id: 'cached-world-id', questions: cachedQuestions } })
  })

  it('gibt gecachte Fragen zurück ohne API-Call', async () => {
    const result = await generateQuestions(VALID_TEXT)
    expect(result.fromCache).toBe(true)
    expect(result.worldId).toBe('cached-world-id')
    expect(result.questions).toEqual(cachedQuestions)
  })

  it('ruft fetch nicht auf wenn Cache-Hit vorliegt', async () => {
    await generateQuestions(VALID_TEXT)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('generateQuestions – API-Aufruf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    // No cache
    mockCacheLookup({ data: null })
  })

  it('wirft bei nicht-ok HTTP-Antwort', async () => {
    mockFetch.mockResolvedValue(mockResponse(false, { error: 'Rate limit exceeded' }))

    await expect(generateQuestions(VALID_TEXT)).rejects.toThrow('Rate limit exceeded')
  })

  it('wirft bei API-Fehler im Response-Body', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, { error: 'KI überlastet', data: null }))

    await expect(generateQuestions(VALID_TEXT)).rejects.toThrow('KI überlastet')
  })

  it('wirft wenn keine Fragen generiert wurden (leere MC-Liste)', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(true, { error: null, data: { ...MOCK_API_DATA, multiple_choice: [] } }),
    )

    await expect(generateQuestions(VALID_TEXT)).rejects.toThrow('keine Fragen generiert')
  })

  it('Happy Path: gibt generierte Fragen zurück und speichert Welt', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: MOCK_API_DATA }))
    mockInsertSave({ data: { id: 'new-world-id' }, error: null })

    const result = await generateQuestions(VALID_TEXT)

    expect(result.fromCache).toBe(false)
    expect(result.worldId).toBe('new-world-id')
    expect(result.questions.length).toBeGreaterThan(0)
    expect(result.questions[0].question_type).toBe('mc')
  })

  it('fällt auf lokale ID zurück wenn Supabase-Speichern fehlschlägt', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: MOCK_API_DATA }))
    mockInsertSave({ data: null, error: new Error('DB error') })

    const result = await generateQuestions(VALID_TEXT)

    expect(result.fromCache).toBe(false)
    expect(result.worldId).toMatch(/^local-/)
    expect(result.questions.length).toBeGreaterThan(0)
  })

  it('hängt Authorization-Header an wenn User eingeloggt ist', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token-abc', user: { id: 'user-1' } } },
    })
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: MOCK_API_DATA }))
    mockInsertSave({ data: { id: 'world-auth' }, error: null })

    await generateQuestions(VALID_TEXT)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/generate',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token-abc' }),
      }),
    )
  })

  it('sendet KEINEN Authorization-Header wenn kein User eingeloggt ist', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: MOCK_API_DATA }))
    mockInsertSave({ data: { id: 'world-anon' }, error: null })

    await generateQuestions(VALID_TEXT)

    const callArgs = mockFetch.mock.calls[0]?.[1] as RequestInit
    expect((callArgs.headers as Record<string, string>)?.['Authorization']).toBeUndefined()
  })
})

describe('generateQuestions – Fragen-Konvertierung', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockCacheLookup({ data: null })
  })

  it('konvertiert True/False Fragen korrekt', async () => {
    const dataWithTF = {
      ...MOCK_API_DATA,
      true_false: [{ statement: 'Pflanzen machen Photosynthese.', is_true: true, explanation: 'Ja.' }],
    }
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: dataWithTF }))
    mockInsertSave({ data: { id: 'w' }, error: null })

    const result = await generateQuestions(VALID_TEXT)
    const tfQ = result.questions.find((q) => q.question_type === 'tf')
    expect(tfQ).toBeDefined()
    expect(tfQ?.correctIndex).toBe(0) // is_true → index 0 = 'Wahr'
    expect(tfQ?.answers).toContain('Wahr')
  })

  it('konvertiert Memory Pairs korrekt', async () => {
    const dataWithMemory = {
      ...MOCK_API_DATA,
      memory_pairs: [{ term: 'Chlorophyll', definition: 'Grüner Farbstoff' }],
    }
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: dataWithMemory }))
    mockInsertSave({ data: { id: 'w' }, error: null })

    const result = await generateQuestions(VALID_TEXT)
    const memQ = result.questions.find((q) => q.question_type === 'memory')
    expect(memQ).toBeDefined()
    expect(memQ?.memory_term).toBe('Chlorophyll')
    expect(memQ?.memory_definition).toBe('Grüner Farbstoff')
  })

  it('konvertiert Lückentexte korrekt', async () => {
    const dataWithFill = {
      ...MOCK_API_DATA,
      fill_blanks: [{ sentence: 'Pflanzen machen _____.', answer: 'Photosynthese', hint: 'P...' }],
    }
    mockFetch.mockResolvedValue(mockResponse(true, { error: null, data: dataWithFill }))
    mockInsertSave({ data: { id: 'w' }, error: null })

    const result = await generateQuestions(VALID_TEXT)
    const fbQ = result.questions.find((q) => q.question_type === 'fillblank')
    expect(fbQ).toBeDefined()
    expect(fbQ?.fillblank_answer).toBe('Photosynthese')
    expect(fbQ?.fillblank_hint).toBe('P...')
  })
})
