import { describe, expect, it } from 'vitest'
import { REST_RISE, SESSION_START, step, TRANSFORM_SECONDS, view, type SessionDurations, type SessionState } from './session'

const ONE_MINUTE: SessionDurations = { inhale: 5, exhale: 5, total: 60 }

/** Runs `seconds` in frames of 1/60 s, checking that the bubble and the face never jump. */
function run(state: SessionState, seconds: number, durations = ONE_MINUTE): SessionState {
  let s = state
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const next = step(s, 1 / 60, durations)
    expect(Math.abs(view(next).rise - view(s).rise)).toBeLessThan(0.02)
    expect(Math.abs(view(next).face - view(s).face)).toBeLessThan(0.02)
    s = next
  }
  return s
}

describe('end of the exercise [SPEC-15.3] [SPEC-15.6]', () => {
  it('breathes without a face until the set duration', () => {
    const state = run(SESSION_START, 59)
    expect(state.ending).toBeNull()
    expect(view(state).face).toBe(0)
  })

  it('stops breathing at the set duration and shows the full smile after the transformation', () => {
    const ended = run(SESSION_START, 60.5)
    expect(ended.ending).not.toBeNull()
    const smiling = run(ended, TRANSFORM_SECONDS)
    expect(view(smiling).face).toBeCloseTo(1)
    expect(view(smiling).rise).toBeCloseTo(REST_RISE)
    const later = run(smiling, 30)
    expect(view(later)).toEqual(view(smiling))
  })

  it('glides to the middle from the top as well as from the bottom', () => {
    // 5 s in, the bubble is at the top; 10 s in, at the bottom.
    for (const total of [5, 10]) {
      const durations = { ...ONE_MINUTE, total }
      const done = run(SESSION_START, total + TRANSFORM_SECONDS + 0.5, durations)
      expect(view(done).rise).toBeCloseTo(REST_RISE)
    }
  })

  it('ends at once when the duration is shortened below the elapsed time [SPEC-7.2]', () => {
    const state = run(SESSION_START, 30)
    expect(step(state, 1 / 60, { ...ONE_MINUTE, total: 20 }).ending).not.toBeNull()
  })

  it('does not breathe again when the duration is lengthened after the end', () => {
    const ended = run(SESSION_START, 61)
    const next = run(ended, TRANSFORM_SECONDS + 1, { ...ONE_MINUTE, total: 360 })
    expect(next.ending).not.toBeNull()
    expect(view(next).face).toBeCloseTo(1)
  })
})
