import { describe, expect, it } from 'vitest'
import { BULBS } from './layout'
import { bulbLevel, REWARD } from './reward-art'

describe('reward of winter [SPEC-16.4] [SPEC-8.5]', () => {
  it('lights the bulbs one by one, all of them at full reward', () => {
    const n = BULBS.length
    expect(n).toBeGreaterThan(10)
    for (let i = 0; i < n; i++) {
      expect(bulbLevel(i, n, 0)).toBe(0)
      expect(bulbLevel(i, n, 1)).toBe(1)
    }
    // Halfway through the fade-in, the first bulbs are lit before the last ones.
    expect(bulbLevel(0, n, 0.5)).toBeGreaterThan(bulbLevel(n - 1, n, 0.5))
    expect(bulbLevel(n - 1, n, REWARD.bulbSpread)).toBe(0)
  })

  it('lights each bulb steadily: its light only grows with the reward level, never blinks', () => {
    const n = BULBS.length
    for (let i = 0; i < n; i++) {
      let previous = 0
      for (let level = 0; level <= 1.0001; level += 0.01) {
        const now = bulbLevel(i, n, level)
        expect(now).toBeGreaterThanOrEqual(previous)
        expect(now - previous).toBeLessThan(0.03)
        previous = now
      }
    }
  })
})
