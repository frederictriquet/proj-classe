// [SPEC-8.5] [SPEC-9.2] Quiet permanent life of the clearing: swaying leaves, slow clouds, light
// rays. Only transforms and transparency change; nothing is redrawn. Free of PixiJS.

export interface Oscillation {
  /** Largest deviation from rest: radians for a rotation, a factor for a skew. */
  amplitude: number
  /** Seconds per cycle. Several seconds: anything faster reads as flicker. */
  period: number
}

export const AMBIENT = {
  /** Crowns of the big trees, rotating about the top of their trunk. */
  crown: { amplitude: 0.012, period: 9 },
  /** Leaves at the tip of the high branch. */
  branchLeaves: { amplitude: 0.025, period: 7 },
  /** The bush, skewed from its base. */
  bush: { amplitude: 0.03, period: 6.5 },
  /** Ferns of the foreground. */
  fern: { amplitude: 0.05, period: 6 },
  /** Light rays: transparency between `min` and `max`. */
  rays: { min: 0.07, max: 0.17, period: 12 },
  /** Cloud speeds, world units per second. Crossing the safe zone takes several minutes. */
  cloudSpeed: { min: 5, max: 9 },
  /** Longest time step applied in one frame, in seconds: after a pause (hidden window, slow
   *  frame) the clearing resumes where it was instead of jumping. */
  maxStep: 0.1,
} as const

/** Value of an oscillation at time `t` (seconds); `phase` (0 to 1) shifts elements apart. */
export function oscillate({ amplitude, period }: Oscillation, t: number, phase = 0): number {
  return amplitude * Math.sin(2 * Math.PI * (t / period + phase))
}

/** Transparency of a light ray at time `t`. */
export function rayAlpha(t: number, phase = 0): number {
  const { min, max, period } = AMBIENT.rays
  return min + ((max - min) * (1 + Math.sin(2 * Math.PI * (t / period + phase)))) / 2
}

/** Brings `value` back into [min, max), as a cloud leaving on one side comes back on the other. */
export function wrap(value: number, min: number, max: number): number {
  const span = max - min
  return min + ((((value - min) % span) + span) % span)
}

/** Time step actually applied for a frame that lasted `ms` milliseconds. */
export function frameStep(ms: number): number {
  return Math.min(Math.max(ms, 0) / 1000, AMBIENT.maxStep)
}
