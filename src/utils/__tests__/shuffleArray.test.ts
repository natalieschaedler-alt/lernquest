import { describe, it, expect } from 'vitest'
import { shuffleArray } from '../shuffleArray'

describe('shuffleArray', () => {
  it('returns a new array (does not mutate input)', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect(result).not.toBe(input)
    expect(input).toEqual([1, 2, 3, 4, 5])
  })

  it('preserves all elements', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const result = shuffleArray(input)
    expect(result).toHaveLength(input.length)
    expect(result.sort()).toEqual([...input].sort())
  })

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('handles single-element array', () => {
    expect(shuffleArray([42])).toEqual([42])
  })

  it('preserves element types', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = shuffleArray(input)
    expect(result).toHaveLength(3)
    const ids = result.map((o) => o.id).sort()
    expect(ids).toEqual([1, 2, 3])
  })

  it('produces a different ordering on consecutive calls (probabilistic)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    // Run 20 shuffles – statistically near-impossible for all to match the original order
    const allSame = Array.from({ length: 20 }, () => shuffleArray(input)).every(
      (r) => r.join(',') === input.join(','),
    )
    expect(allSame).toBe(false)
  })
})
