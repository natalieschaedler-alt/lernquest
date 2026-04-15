/**
 * soundManager.test.ts
 *
 * The SoundManager is a singleton instantiated at module load time.
 * We use vi.resetModules() + dynamic import in beforeEach so each test
 * gets a fresh instance with full control over global.localStorage.
 *
 * AudioContext is NOT mocked — its absence causes a caught exception inside
 * playTone(), which verifies that play functions are resilient without the API.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── localStorage mock ─────────────────────────────────────────────────────────

let localStorageStore: Record<string, string> = {}

const mockLocalStorage = {
  getItem: (key: string): string | null => localStorageStore[key] ?? null,
  setItem: (key: string, value: string): void => { localStorageStore[key] = value },
  removeItem: (key: string): void => { delete localStorageStore[key] },
  clear: (): void => { localStorageStore = {} },
}

// ── Re-import helper ──────────────────────────────────────────────────────────

type SoundManagerModule = typeof import('../soundManager')

async function freshSoundManager(): Promise<SoundManagerModule['soundManager']> {
  vi.resetModules()
  const mod = await import('../soundManager') as SoundManagerModule
  return mod.soundManager
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SoundManager – Zustand', () => {
  beforeEach(() => {
    localStorageStore = {}
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ist standardmäßig aktiviert wenn kein localStorage-Wert vorhanden', async () => {
    const sm = await freshSoundManager()
    expect(sm.isEnabled()).toBe(true)
  })

  it('liest disabled=false aus localStorage beim Start', async () => {
    localStorageStore['learnquest-sound'] = 'false'
    const sm = await freshSoundManager()
    expect(sm.isEnabled()).toBe(false)
  })

  it('liest enabled=true aus localStorage beim Start', async () => {
    localStorageStore['learnquest-sound'] = 'true'
    const sm = await freshSoundManager()
    expect(sm.isEnabled()).toBe(true)
  })
})

describe('SoundManager – toggle()', () => {
  beforeEach(() => {
    localStorageStore = {}
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('toggle() deaktiviert Sound wenn aktiv', async () => {
    const sm = await freshSoundManager()
    expect(sm.isEnabled()).toBe(true)
    const newState = sm.toggle()
    expect(newState).toBe(false)
    expect(sm.isEnabled()).toBe(false)
  })

  it('toggle() aktiviert Sound wenn deaktiviert', async () => {
    localStorageStore['learnquest-sound'] = 'false'
    const sm = await freshSoundManager()
    const newState = sm.toggle()
    expect(newState).toBe(true)
    expect(sm.isEnabled()).toBe(true)
  })

  it('toggle() speichert neuen Zustand in localStorage', async () => {
    const sm = await freshSoundManager()
    sm.toggle() // true → false
    expect(localStorageStore['learnquest-sound']).toBe('false')
    sm.toggle() // false → true
    expect(localStorageStore['learnquest-sound']).toBe('true')
  })

  it('toggle() gibt den neuen Zustand als boolean zurück', async () => {
    const sm = await freshSoundManager()
    const r1 = sm.toggle()
    const r2 = sm.toggle()
    expect(typeof r1).toBe('boolean')
    expect(r1).toBe(false)
    expect(r2).toBe(true)
  })
})

describe('SoundManager – Play-Funktionen (kein Crash)', () => {
  // These tests verify that all play methods are resilient:
  // they should never throw even when AudioContext is unavailable (node env).
  beforeEach(() => {
    localStorageStore = {}
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('playCorrect() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playCorrect()).not.toThrow()
  })

  it('playWrong() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playWrong()).not.toThrow()
  })

  it('playLevelUp() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playLevelUp()).not.toThrow()
  })

  it('playVictory() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playVictory()).not.toThrow()
  })

  it('playBossBattle() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playBossBattle()).not.toThrow()
  })

  it('playAchievement() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playAchievement()).not.toThrow()
  })

  it('playStreak() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playStreak()).not.toThrow()
  })

  it('playCombo() wirft keinen Fehler', async () => {
    const sm = await freshSoundManager()
    expect(() => sm.playCombo()).not.toThrow()
  })

  it('Play-Funktionen schweigen wenn Sound deaktiviert ist', async () => {
    localStorageStore['learnquest-sound'] = 'false'
    const sm = await freshSoundManager()
    // All play calls are no-ops when disabled — they return immediately.
    // Verify they still don't throw.
    expect(() => {
      sm.playCorrect()
      sm.playWrong()
      sm.playLevelUp()
      sm.playVictory()
    }).not.toThrow()
  })
})
