import { describe, expect, it } from 'vitest'
import { FpsMeter } from './fps-meter'

function run(meter: FpsMeter, fps: number, durationMs: number, start: number): number {
  const step = 1000 / fps
  let t = start
  for (; t < start + durationMs; t += step) meter.frame(t)
  return t
}

describe('FpsMeter', () => {
  it('reports nothing before the first complete window', () => {
    const meter = new FpsMeter()
    run(meter, 60, 500, 0)
    expect(meter.value).toEqual({ current: undefined, min: undefined, windows: 0 })
  })

  it('measures a steady frame rate', () => {
    const meter = new FpsMeter()
    run(meter, 60, 3100, 0)
    expect(meter.value.current).toBeCloseTo(60, 0)
    expect(meter.value.windows).toBe(3)
  })

  it('excludes the warm-up window from the minimum and keeps the lowest later window', () => {
    const meter = new FpsMeter()
    let t = run(meter, 20, 1050, 0) // slow start-up window
    t = run(meter, 60, 2000, t)
    t = run(meter, 40, 1000, t)
    run(meter, 60, 1000, t)
    // Windows are not aligned with the rate changes, so the slow window mixes in a few faster frames.
    expect(meter.value.min).toBeGreaterThanOrEqual(40)
    expect(meter.value.min).toBeLessThan(45)
    expect(meter.value.current).toBeCloseTo(60, 0)
  })
})
