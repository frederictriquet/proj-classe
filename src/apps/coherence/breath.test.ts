import { describe, expect, it } from 'vitest'
import { advance, rise, START, type BreathState } from './breath'

const FIVE = { inhale: 5, exhale: 5 }

/** Runs `seconds` in frames of 1/60 s. */
function run(state: BreathState, seconds: number, durations = FIVE): BreathState {
  let s = state
  for (let i = 0; i < Math.round(seconds * 60); i++) s = advance(s, 1 / 60, durations)
  return s
}

describe('breathing of the bubble [SPEC-15.2] [SPEC-15.3]', () => {
  it('starts at the bottom and goes up first', () => {
    expect(rise(START)).toBe(0)
    expect(rise(advance(START, 1, FIVE))).toBeGreaterThan(0)
  })

  it('reaches the top at the end of the inhale and the bottom at the end of the exhale', () => {
    const top = advance(START, 5, FIVE)
    expect(top.phase).toBe('exhale')
    expect(rise(top)).toBeCloseTo(1)
    const bottom = advance(START, 10, FIVE)
    expect(bottom.phase).toBe('inhale')
    expect(rise(bottom)).toBeCloseTo(0)
  })

  it('follows each duration on its own', () => {
    const durations = { inhale: 4, exhale: 6 }
    expect(rise(advance(START, 4, durations))).toBeCloseTo(1)
    expect(rise(advance(START, 7, durations))).toBeCloseTo(0.5)
    expect(rise(advance(START, 10, durations))).toBeCloseTo(0)
  })

  it('moves slowly near the top and the bottom, faster in the middle [SPEC-8.5]', () => {
    const near = rise(advance(START, 0.25, FIVE)) - rise(START)
    const middle = rise(advance(START, 2.75, FIVE)) - rise(advance(START, 2.5, FIVE))
    expect(near).toBeLessThan(middle / 5)
  })

  it('never jumps from one frame to the next, across several cycles', () => {
    let state = START
    for (let i = 0; i < 60 * 30; i++) {
      const next = advance(state, 1 / 60, FIVE)
      expect(Math.abs(rise(next) - rise(state))).toBeLessThan(0.02)
      state = next
    }
  })

  it('changes speed without jumping when a duration changes mid-phase [SPEC-7.2]', () => {
    const before = run(START, 3)
    const after = advance(before, 1 / 60, { inhale: 2, exhale: 5 })
    expect(Math.abs(rise(after) - rise(before))).toBeLessThan(0.02)
    expect(after.phase).toBe('inhale')
  })

  it('crosses several phases in one long step', () => {
    const state = advance(START, 25, FIVE)
    expect(state.phase).toBe('exhale')
    expect(rise(state)).toBeCloseTo(1)
  })

  it('rejects durations that would never end', () => {
    expect(() => advance(START, 1, { inhale: 0, exhale: 5 })).toThrow()
  })
})
