import { describe, expect, it } from 'vitest'
import { contains } from '../../silence/geometry'
import { createFireflies, fireflyAlpha, fireflyPosition, REWARD } from './reward'

describe('fireflies [SPEC-9.5] [SPEC-8.5]', () => {
  const fireflies = createFireflies()

  it('drift slowly inside their area', () => {
    expect(fireflies).toHaveLength(REWARD.fireflies)
    for (const f of fireflies) {
      for (let t = 0; t < 60; t += 0.25) {
        const { x, y } = fireflyPosition(f, t)
        expect(contains(REWARD.area, { x, y, width: 0, height: 0 }), `${x}, ${y}`).toBe(true)
      }
      // Fastest speed of the drift, world units per second: a slow float.
      const speed = Math.hypot((2 * Math.PI * f.ax) / f.px, (2 * Math.PI * f.ay) / f.py)
      expect(speed).toBeLessThan(80)
    }
  })

  it('glow over several seconds without going dark: no flicker', () => {
    for (const f of fireflies) {
      expect(f.glowPeriod).toBeGreaterThanOrEqual(3)
      for (let t = 0; t < 20; t += 0.1) {
        const alpha = fireflyAlpha(f, t, 1)
        expect(alpha).toBeGreaterThanOrEqual(REWARD.glow.min - 1e-9)
        expect(alpha).toBeLessThanOrEqual(1)
      }
    }
  })

  it('are invisible without reward and all shown at full reward', () => {
    for (const f of fireflies) {
      expect(fireflyAlpha(f, 3, 0)).toBe(0)
      expect(fireflyAlpha(f, 3, 1)).toBeGreaterThan(0)
    }
  })
})
