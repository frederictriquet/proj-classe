// [SPEC-15.6] Pure timing of the whole exercise of « Cohérence cardiaque »: the bubble breathes
// until the set duration is reached, then glides to the middle of its path while a smiling face
// appears on it. No rendering here, so the tests can run it.
import { advance, rise, START, type BreathDurations, type BreathState } from './breath'

/** [SPEC-15.6] Seconds the bubble takes to turn into a smiling face. */
export const TRANSFORM_SECONDS = 4
/** [SPEC-15.6] Height the face rests at: the middle of the bubble's path. */
export const REST_RISE = 0.5

export interface SessionState {
  breath: BreathState
  /** Seconds of breathing so far. */
  elapsed: number
  /** Set once the exercise is over; it never goes back to breathing [SPEC-15.6]. */
  ending: { fromRise: number; since: number } | null
}

export interface SessionDurations extends BreathDurations {
  /** Length of the exercise, in seconds. */
  total: number
}

/** What the app draws: the height of the bubble (0 bottom, 1 top) and how much of the face shows
 *  (0 none, 1 full smile). */
export interface SessionView {
  rise: number
  face: number
}

export const SESSION_START: SessionState = { breath: START, elapsed: 0, ending: null }

/** State after `dt` seconds. The durations are read at each step, so a change applies at once
 *  [SPEC-7.2]: a total shortened below the elapsed time ends the exercise. */
export function step(state: SessionState, dt: number, durations: SessionDurations): SessionState {
  const seconds = Math.max(0, dt)
  if (state.ending) return { ...state, ending: { ...state.ending, since: state.ending.since + seconds } }
  const elapsed = state.elapsed + seconds
  const breath = advance(state.breath, seconds, durations)
  if (elapsed >= durations.total) return { breath, elapsed, ending: { fromRise: rise(breath), since: 0 } }
  return { breath, elapsed, ending: null }
}

/** [SPEC-15.6] [SPEC-8.5] Where the bubble stands and how much the face shows, on a cosine curve
 *  that starts and ends slowly. */
export function view(state: SessionState): SessionView {
  if (!state.ending) return { rise: rise(state.breath), face: 0 }
  const progress = Math.min(1, state.ending.since / TRANSFORM_SECONDS)
  const eased = (1 - Math.cos(Math.PI * progress)) / 2
  return { rise: state.ending.fromRise + (REST_RISE - state.ending.fromRise) * eased, face: eased }
}
