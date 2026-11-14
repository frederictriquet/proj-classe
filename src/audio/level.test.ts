import { describe, expect, it } from 'vitest'
import { computeRms, DBFS_FLOOR, rmsToDbfs } from './level'

describe('computeRms', () => {
  it('returns 0 for silence and for an empty block', () => {
    expect(computeRms(new Float32Array(128))).toBe(0)
    expect(computeRms(new Float32Array(0))).toBe(0)
  })

  it('returns the amplitude of a constant signal', () => {
    expect(computeRms(new Float32Array(64).fill(0.5))).toBeCloseTo(0.5, 6)
  })

  it('returns amplitude / sqrt(2) for a sine wave', () => {
    const n = 4800
    const sine = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 440 * i) / 48000))
    expect(computeRms(sine)).toBeCloseTo(0.8 / Math.SQRT2, 3)
  })
})

describe('rmsToDbfs', () => {
  it('maps full scale to 0 dBFS and halving to about -6 dB', () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0, 6)
    expect(rmsToDbfs(0.5)).toBeCloseTo(-6.0206, 3)
  })

  it('clamps silence and very low levels to the floor', () => {
    expect(rmsToDbfs(0)).toBe(DBFS_FLOOR)
    expect(rmsToDbfs(1e-9)).toBe(DBFS_FLOOR)
  })
})
