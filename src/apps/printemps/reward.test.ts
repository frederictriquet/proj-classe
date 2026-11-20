import { describe, expect, it } from 'vitest'
import { BLOSSOMS } from './layout'
import { blossomLevel, REWARD } from './reward-art'

describe('reward of spring [SPEC-17.4] [SPEC-8.5]', () => {
  it('opens the blossoms one by one, all of them at full reward', () => {
    const n = BLOSSOMS.length
    expect(n).toBeGreaterThan(20)
    for (let i = 0; i < n; i++) {
      expect(blossomLevel(i, n, 0)).toBe(0)
      expect(blossomLevel(i, n, 1)).toBe(1)
    }
    expect(blossomLevel(0, n, 0.5)).toBeGreaterThan(blossomLevel(n - 1, n, 0.5))
    expect(blossomLevel(n - 1, n, REWARD.blossomSpread)).toBe(0)
  })

  it('opens each blossom steadily: it only grows with the reward level', () => {
    const n = BLOSSOMS.length
    for (let i = 0; i < n; i++) {
      let previous = 0
      for (let level = 0; level <= 1.0001; level += 0.01) {
        const now = blossomLevel(i, n, level)
        expect(now).toBeGreaterThanOrEqual(previous)
        expect(now - previous).toBeLessThan(0.03)
        previous = now
      }
    }
  })
})
