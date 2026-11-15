// [SPEC-8.5] [SPEC-9.2] Quiet permanent life of the clearing: swaying leaves, slow clouds, light
// rays. Only transforms and transparency change; nothing is redrawn. Free of PixiJS. The
// oscillations and the time step are shared (src/silence/ambient.ts).

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
} as const

/** Transparency of a light ray at time `t`. */
export function rayAlpha(t: number, phase = 0): number {
  const { min, max, period } = AMBIENT.rays
  return min + ((max - min) * (1 + Math.sin(2 * Math.PI * (t / period + phase)))) / 2
}
