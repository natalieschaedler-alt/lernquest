import { describe, it, expect } from 'vitest'
import { pointsForDifficulty, TIMER, COMBO, BOSS } from '../gameConfig'

describe('pointsForDifficulty', () => {
  it('gibt 10 Punkte für Schwierigkeit 1 zurück', () => {
    expect(pointsForDifficulty(1)).toBe(10)
  })

  it('gibt 20 Punkte für Schwierigkeit 2 zurück', () => {
    expect(pointsForDifficulty(2)).toBe(20)
  })

  it('gibt 30 Punkte für Schwierigkeit 3 zurück', () => {
    expect(pointsForDifficulty(3)).toBe(30)
  })
})

describe('TIMER-Konstanten', () => {
  it('WORTWIRBEL ist 30 Sekunden', () => {
    expect(TIMER.WORTWIRBEL).toBe(30)
  })

  it('WORTWIRBEL_WARN ist kleiner als WORTWIRBEL', () => {
    expect(TIMER.WORTWIRBEL_WARN).toBeLessThan(TIMER.WORTWIRBEL)
  })

  it('ORAKEL ist 5 Sekunden', () => {
    expect(TIMER.ORAKEL).toBe(5)
  })

  it('BOSS_FAST ist kleiner als BOSS (verkürzte Zeit)', () => {
    expect(TIMER.BOSS_FAST).toBeLessThan(TIMER.BOSS)
  })
})

describe('COMBO-Konstanten', () => {
  it('THRESHOLD_LOW ist kleiner als THRESHOLD_HIGH', () => {
    expect(COMBO.THRESHOLD_LOW).toBeLessThan(COMBO.THRESHOLD_HIGH)
  })

  it('BONUS_LOW ist kleiner als BONUS_HIGH', () => {
    expect(COMBO.BONUS_LOW).toBeLessThan(COMBO.BONUS_HIGH)
  })

  it('THRESHOLD_LOW ist mindestens 2', () => {
    expect(COMBO.THRESHOLD_LOW).toBeGreaterThanOrEqual(2)
  })
})

describe('BOSS-Konstanten', () => {
  it('HP ist positiv', () => {
    expect(BOSS.HP).toBeGreaterThan(0)
  })

  it('SHIELDS ist positiv', () => {
    expect(BOSS.SHIELDS).toBeGreaterThan(0)
  })
})
