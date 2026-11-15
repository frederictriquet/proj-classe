// [SPEC-8.5] [SPEC-9.8] Time and slow motion shared by the activities of silence: the time step of
// a frame and the oscillations of the quiet permanent life of a decor. Free of PixiJS.

export interface Oscillation {
  /** Largest deviation from rest: radians for a rotation, a factor for a skew. */
  amplitude: number
  /** Seconds per cycle. Several seconds: anything faster reads as flicker. */
  period: number
}

/** Longest time step applied in one frame, in seconds: after a pause (hidden window, slow frame)
 *  the scene resumes where it was instead of jumping. */
export const MAX_STEP = 0.1

/** Value of an oscillation at time `t` (seconds); `phase` (0 to 1) shifts elements apart. */
export function oscillate({ amplitude, period }: Oscillation, t: number, phase = 0): number {
  return amplitude * Math.sin(2 * Math.PI * (t / period + phase))
}

/** Brings `value` back into [min, max), as a cloud leaving on one side comes back on the other. */
export function wrap(value: number, min: number, max: number): number {
  const span = max - min
  return min + ((((value - min) % span) + span) % span)
}

/** Time step actually applied for a frame that lasted `ms` milliseconds. */
export function frameStep(ms: number): number {
  return Math.min(Math.max(ms, 0) / 1000, MAX_STEP)
}
