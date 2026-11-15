// [SPEC-9.5] [SPEC-8.5] Reward of « Forêt du silence »: once the six animals are settled, the
// clearing comes alive gently (fireflies, warmer light) for as long as the calm lasts. It plays
// no sound [SPEC-9.1]. Free of PixiJS: how the fireflies drift and glow. When the reward shows and
// how fast it fades are shared (src/silence/reward.ts); reward-art.ts draws it.
import type { Rect } from '../../silence/geometry'
import { seededRandom } from '../../silence/random'
import { MEADOW } from './layout'

export const REWARD = {
  /** Opacity of the warm light over the whole clearing, at full reward. */
  warmAlpha: 0.12,
  fireflies: 14,
  /** Where the fireflies drift: over the meadow and in front of the near trees, world units. */
  area: { x: MEADOW.x - 160, y: 430, width: MEADOW.width + 320, height: MEADOW.y + MEADOW.height - 430 } satisfies Rect,
  /** Drift of a firefly around its anchor: amplitude (world units) and seconds per cycle. */
  drift: { amplitude: [40, 100], period: [9, 16] },
  /** Glow of a firefly: opacity between `min` and 1, over several seconds, never a flicker. */
  glow: { min: 0.65, period: [3.5, 6] },
  /** Share of the fade-in a firefly waits before showing, at most: they light up one by one. */
  maxDelay: 0.6,
  /** Radii of a firefly, world units: visible from the back of the class. A cream heart in a sun
   *  body stands out on the grass and the foliage alike. */
  heartRadius: 6,
  bodyRadius: 14,
  haloRadius: 36,
  haloAlpha: 0.4,
} as const

export interface Firefly {
  /** Centre of its drift, world units. */
  x: number
  y: number
  ax: number
  ay: number
  px: number
  py: number
  phaseX: number
  phaseY: number
  glowPeriod: number
  glowPhase: number
  /** Share of the reward level it waits before showing, 0 to `maxDelay`. */
  delay: number
}

const between = (rand: () => number, [min, max]: readonly [number, number]) => min + rand() * (max - min)

/** The fireflies, spread over `REWARD.area` with their drift kept inside it. */
export function createFireflies(seed = 7): Firefly[] {
  const rand = seededRandom(seed)
  const { area, drift, glow } = REWARD
  return Array.from({ length: REWARD.fireflies }, (_, i) => {
    const ax = between(rand, drift.amplitude)
    const ay = between(rand, drift.amplitude) * 0.7
    // One firefly per column of the area, so they do not bunch up.
    const column = area.width / REWARD.fireflies
    const x = Math.min(Math.max(area.x + column * (i + rand()), area.x + ax), area.x + area.width - ax)
    const y = area.y + ay + rand() * (area.height - 2 * ay)
    return {
      x,
      y,
      ax,
      ay,
      px: between(rand, drift.period),
      py: between(rand, drift.period),
      phaseX: rand(),
      phaseY: rand(),
      glowPeriod: between(rand, glow.period),
      glowPhase: rand(),
      delay: rand() * REWARD.maxDelay,
    }
  })
}

/** Position of a firefly at time `t` (seconds). */
export function fireflyPosition(f: Firefly, t: number): { x: number; y: number } {
  return {
    x: f.x + f.ax * Math.sin(2 * Math.PI * (t / f.px + f.phaseX)),
    y: f.y + f.ay * Math.sin(2 * Math.PI * (t / f.py + f.phaseY)),
  }
}

/** Opacity of a firefly at time `t` with the reward at `level`: it shows once the level passes
 *  its delay, then glows slowly. */
export function fireflyAlpha(f: Firefly, t: number, level: number): number {
  const shown = Math.min(1, Math.max(0, (level - f.delay) / (1 - f.delay)))
  const { min } = REWARD.glow
  const glow = min + ((1 - min) * (1 + Math.sin(2 * Math.PI * (t / f.glowPeriod + f.glowPhase)))) / 2
  return shown * glow
}
