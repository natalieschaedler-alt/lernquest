import { describe, it, expect } from 'vitest'
import { WORLDS, getWorldById, getAvailableWorlds, getLockedWorlds } from '../worlds'

describe('WORLDS – Datendefinitionen', () => {
  it('enthält genau 5 Welten', () => {
    expect(WORLDS).toHaveLength(5)
  })

  it('jede Welt hat alle Pflichtfelder', () => {
    for (const world of WORLDS) {
      expect(world.id).toBeTruthy()
      expect(world.name).toBeTruthy()
      expect(world.emoji).toBeTruthy()
      expect(world.primaryColor).toMatch(/^#/)
      expect(world.bossName).toBeTruthy()
      expect(world.bossEmoji).toBeTruthy()
      expect(world.loot).toBeDefined()
    }
  })

  it('Feuer-Welt ist von Anfang an freigeschaltet (0 Sessions)', () => {
    const fire = WORLDS.find((w) => w.id === 'fire')!
    expect(fire.unlockedAtSessions).toBe(0)
  })

  it('Sessions-Schwellenwerte sind aufsteigend sortiert', () => {
    const thresholds = WORLDS.map((w) => w.unlockedAtSessions)
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThanOrEqual(thresholds[i - 1])
    }
  })
})

describe('getWorldById', () => {
  it('gibt die korrekte Welt zurück', () => {
    const fire = getWorldById('fire')
    expect(fire.id).toBe('fire')
    expect(fire.name).toBe('Feuer-Vulkan')
  })

  it('gibt die Feuer-Welt als Fallback zurück wenn ID nicht existiert', () => {
    const fallback = getWorldById('nonexistent')
    expect(fallback.id).toBe('fire')
  })

  it('gibt die Feuer-Welt zurück für null', () => {
    const fallback = getWorldById(null)
    expect(fallback.id).toBe('fire')
  })

  it('gibt alle 5 Welten korrekt zurück', () => {
    const ids = ['fire', 'water', 'cyber', 'forest', 'cosmos']
    for (const id of ids) {
      expect(getWorldById(id).id).toBe(id)
    }
  })
})

describe('getAvailableWorlds', () => {
  it('gibt nur Feuer-Welt bei 0 Sessions zurück', () => {
    const available = getAvailableWorlds(0)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('fire')
  })

  it('gibt Feuer + Wasser bei 5 Sessions zurück', () => {
    const available = getAvailableWorlds(5)
    const ids = available.map((w) => w.id)
    expect(ids).toContain('fire')
    expect(ids).toContain('water')
  })

  it('gibt alle 5 Welten bei 100 Sessions zurück', () => {
    const available = getAvailableWorlds(100)
    expect(available).toHaveLength(5)
  })

  it('gibt 3 Welten bei 15 Sessions zurück (fire, water, cyber)', () => {
    const available = getAvailableWorlds(15)
    expect(available).toHaveLength(3)
  })
})

describe('getLockedWorlds', () => {
  it('gibt 4 gesperrte Welten bei 0 Sessions zurück', () => {
    const locked = getLockedWorlds(0)
    expect(locked).toHaveLength(4)
  })

  it('gibt 0 gesperrte Welten bei 100 Sessions zurück', () => {
    const locked = getLockedWorlds(100)
    expect(locked).toHaveLength(0)
  })

  it('available + locked = 5 Welten (keine Lücken)', () => {
    for (const sessions of [0, 5, 15, 30, 100]) {
      const available = getAvailableWorlds(sessions)
      const locked = getLockedWorlds(sessions)
      expect(available.length + locked.length).toBe(5)
    }
  })

  it('Feuer-Welt ist nie gesperrt', () => {
    const locked = getLockedWorlds(0)
    expect(locked.some((w) => w.id === 'fire')).toBe(false)
  })
})
