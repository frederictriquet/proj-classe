// [SPEC-8.5] [SPEC-16.3.3] Quiet permanent life of the winter landscape: the smoke of the chimney,
// a few flakes falling slowly and the bush swaying a little. Free of PixiJS: the motion is computed
// here and only transforms and transparency change on screen. The oscillations and the time step
// are shared (src/silence/ambient.ts).
import type { Oscillation } from '../../silence/ambient'
import { seededRandom } from '../../silence/random'

export const AMBIENT = {
  /** The bush, skewed from its base. */
  bush: { amplitude: 0.012, period: 7.5 } satisfies Oscillation,
  /** Puffs of smoke: how many are in the air at once, seconds from the chimney to gone, how high
   *  they rise (world units), how far the wind pushes them right, and their radius at birth and
   *  when they fade. */
  smoke: { puffs: 6, life: 12, rise: 300, drift: 120, radius: [16, 52] as const, alpha: 0.55 },
  /** Falling flakes: how many, their speed (world units per second; crossing the screen takes
   *  about a minute), the width and period of their side-to-side sway and their radius. */
  flakes: { count: 36, speed: [14, 24] as const, sway: 18, swayPeriod: [6, 10] as const, radius: [3, 5] as const, alpha: 0.8 },
} as const

/** Where a puff of smoke is and how it looks `age` seconds after leaving the chimney (0 to
 *  `life`): it rises, drifts with the wind, grows and fades. */
export function puff(age: number): { dx: number; dy: number; radius: number; alpha: number } {
  const { life, rise, drift, radius, alpha } = AMBIENT.smoke
  const t = Math.min(1, Math.max(0, age / life))
  // Fades in quickly, out slowly: never a flicker.
  const shown = Math.min(1, t / 0.12) * (1 - t)
  return { dx: drift * t * t, dy: -rise * t, radius: radius[0] + (radius[1] - radius[0]) * t, alpha: alpha * shown }
}

export interface Flake {
  /** Start position (world units) and speed. */
  x: number
  y: number
  speed: number
  swayPeriod: number
  phase: number
  radius: number
}

/** Flakes spread over `area`, falling from its top to its bottom and starting again at its top. */
export function createFlakes(count: number, area: { x: number; y: number; width: number; height: number }, radius: readonly [number, number], seed: number): Flake[] {
  const rand = seededRandom(seed)
  const { speed, swayPeriod } = AMBIENT.flakes
  return Array.from({ length: count }, (_, i) => ({
    // One flake per column, so they do not bunch up.
    x: area.x + (area.width / count) * (i + rand()),
    y: area.y + rand() * area.height,
    speed: speed[0] + rand() * (speed[1] - speed[0]),
    swayPeriod: swayPeriod[0] + rand() * (swayPeriod[1] - swayPeriod[0]),
    phase: rand(),
    radius: radius[0] + rand() * (radius[1] - radius[0]),
  }))
}
