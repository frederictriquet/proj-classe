// [SPEC-8.5] [SPEC-17.3] [SPEC-17.4] Quiet permanent life of the spring meadow: the tufts of grass
// sway a little and a small cloud passes slowly far away; the petals of the reward fall slowly. Free
// of PixiJS: the motion is computed here and only transforms and transparency change on screen. The
// oscillations and the time step are shared (src/silence/ambient.ts).
import type { Oscillation } from '../../silence/ambient'
import { seededRandom } from '../../silence/random'

export const AMBIENT = {
  /** The tufts of grass, skewed from their base. */
  tufts: { amplitude: 0.05, period: 6.5 } satisfies Oscillation,
  /** The small far cloud: world units per second (it crosses the decor in several minutes), its
   *  height and size. */
  cloud: { speed: 9, y: 70, rx: 90, ry: 30 },
  /** Petals of the reward: how many, their speed (world units per second; crossing the screen takes
   *  about half a minute), the width and period of their sway, their size. */
  petals: { count: 28, speed: [26, 40] as const, sway: 30, swayPeriod: [5, 9] as const, size: [7, 10] as const },
} as const

export interface Petal {
  /** Start position (world units) and speed. */
  x: number
  y: number
  speed: number
  swayPeriod: number
  phase: number
  size: number
}

/** Petals spread over `area`, falling from its top to its bottom and starting again at its top. */
export function createPetals(count: number, area: { x: number; y: number; width: number; height: number }, seed: number): Petal[] {
  const rand = seededRandom(seed)
  const { speed, swayPeriod, size } = AMBIENT.petals
  return Array.from({ length: count }, (_, i) => ({
    // One petal per column, so they do not bunch up.
    x: area.x + (area.width / count) * (i + rand()),
    y: area.y + rand() * area.height,
    speed: speed[0] + rand() * (speed[1] - speed[0]),
    swayPeriod: swayPeriod[0] + rand() * (swayPeriod[1] - swayPeriod[0]),
    phase: rand(),
    size: size[0] + rand() * (size[1] - size[0]),
  }))
}
