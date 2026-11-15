// [SPEC-8.5] [SPEC-13.3] Quiet permanent life of the apiary: slow clouds, swaying daisies, leaves of
// the clump and grass tufts, and a drop of honey that forms and slowly runs down from the edge of
// the comb into the pot. Only transforms and transparency change; nothing is redrawn. Free of
// PixiJS. The oscillations and the time step are shared (src/silence/ambient.ts).

export const AMBIENT = {
  /** Daisies of the meadow, rotating about the foot of their stem. */
  daisy: { amplitude: 0.035, period: 6.5 },
  /** Leaves of the clump, skewed from their base. */
  clump: { amplitude: 0.02, period: 7.5 },
  /** Grass tufts of the foreground. */
  tuft: { amplitude: 0.04, period: 5.5 },
  /** Cloud speeds, world units per second. Crossing the safe zone takes several minutes. */
  cloudSpeed: { min: 5, max: 9 },
  /** [SPEC-13.3] The drop: seconds to swell from nothing, to fall into the pot, then to wait. */
  drip: { grow: 6, fall: 2.5, rest: 2.5 },
} as const

export const DRIP_PERIOD = AMBIENT.drip.grow + AMBIENT.drip.fall + AMBIENT.drip.rest

export interface DropState {
  /** Size of the drop, 0 (nothing) to 1. */
  scale: number
  /** How far it has fallen, 0 (hanging from the comb) to 1 (in the pot). */
  fall: number
  alpha: number
}

const smooth = (t: number): number => t * t * (3 - 2 * t)

/** [SPEC-8.5] The drop at time `t`, seconds. It grows from nothing, falls slowly and fades out
 *  as it reaches the pot, so it never appears or disappears at once. */
export function dropAt(t: number): DropState {
  const { grow, fall } = AMBIENT.drip
  const phase = ((t % DRIP_PERIOD) + DRIP_PERIOD) % DRIP_PERIOD
  if (phase < grow) return { scale: smooth(phase / grow), fall: 0, alpha: 1 }
  if (phase < grow + fall) {
    const f = (phase - grow) / fall
    // Slow start, like a thick drop letting go; fades over the last third.
    return { scale: 1, fall: f * f, alpha: Math.min(1, 3 * (1 - f)) }
  }
  return { scale: 0, fall: 0, alpha: 0 }
}
