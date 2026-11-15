// [SPEC-15.2] Pure breathing logic of « Cohérence cardiaque »: where the bubble is in the cycle and
// how high it stands. No rendering here, so the tests can run it.
//
// The state keeps the share of the current phase already done, not the elapsed seconds: when the
// adult changes a duration while the app runs [SPEC-7.2], the bubble changes speed without jumping.

export type BreathPhase = 'inhale' | 'exhale'

export interface BreathState {
  phase: BreathPhase
  /** Share of the current phase already done, from 0 (start) to below 1. */
  fraction: number
}

/** Durations of the two phases, in seconds. Both must be above zero. */
export interface BreathDurations {
  inhale: number
  exhale: number
}

/** [SPEC-15.2] The bubble starts at the bottom and goes up first. */
export const START: BreathState = { phase: 'inhale', fraction: 0 }

/** State after `dt` seconds. Crosses as many phases as `dt` covers. */
export function advance(state: BreathState, dt: number, durations: BreathDurations): BreathState {
  if (!(durations.inhale > 0 && durations.exhale > 0)) throw new Error('Durées de respiration invalides')
  let { phase, fraction } = state
  let remaining = Math.max(0, dt)
  for (;;) {
    const duration = durations[phase]
    const left = (1 - fraction) * duration
    if (remaining < left) return { phase, fraction: fraction + remaining / duration }
    remaining -= left
    phase = phase === 'inhale' ? 'exhale' : 'inhale'
    fraction = 0
  }
}

/** [SPEC-15.2] [SPEC-8.5] Height of the bubble: 0 at the bottom, 1 at the top, on a cosine curve
 *  that starts and ends slowly. Continuous from one phase to the next. */
export function rise(state: BreathState): number {
  const eased = (1 - Math.cos(Math.PI * state.fraction)) / 2
  return state.phase === 'inhale' ? eased : 1 - eased
}
