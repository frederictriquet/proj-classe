// [SPEC-13.4] [SPEC-8.5] Reward of « Ruche du silence »: once the seventeen animals are settled,
// the empty cells of the comb fill with honey one by one, a trickle of honey runs from the comb
// into the pot and the light warms up, for as long as the calm lasts. It plays no sound
// [SPEC-13.1]. Free of PixiJS: when each cell fills and how far the trickle runs. When the reward
// shows and how fast it fades are shared (src/silence/reward.ts, [SPEC-9.8]); reward-art.ts draws
// it. The comb does not fill as the animals come out: the shared code is left as it is.
import type { Point } from '../../silence/geometry'
import { CELL_INNER_RADIUS, CELLS, type Cell } from './layout'

export const REWARD = {
  /** Seconds for one cell to fill; the next one starts when it is full. Slow, so that the
   *  children can follow the honey rising [SPEC-8.5]. */
  cellS: 1.6,
  /** Seconds for the trickle to reach the pot from the bottom of the frame. */
  trickleS: 2,
  /** Width of the trickle, world units: thin, but seen from the back of the class [SPEC-8.2]. */
  trickleWidth: 12,
  /** Opacity of the warm light over the whole apiary, at full reward. */
  warmAlpha: 0.12,
} as const

/** [SPEC-13.4] The cells the reward fills, in the order it fills them: row by row from the top,
 *  next to the honey already there, left to right. */
export const EMPTY_CELLS: readonly Cell[] = CELLS.filter((cell) => !cell.full)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Share of the empty cell `index` filled with honey after `t` seconds of reward, 0 to 1. One
 *  cell fills at a time. */
export function cellFill(index: number, t: number): number {
  return clamp01((t - index * REWARD.cellS) / REWARD.cellS)
}

/** Share of the way from the comb to the pot the trickle runs after `t` seconds of reward. */
export function trickleLength(t: number): number {
  return clamp01(t / REWARD.trickleS)
}

/**
 * Seconds of reward the drawing shows, after a frame of `dt` seconds. The clock runs while the
 * reward is active. It stops while the reward fades out, so that the cells already full stay full
 * and fade with it; and once nothing shows (`level` 0), it goes back to 0 and the comb is the
 * decor's again.
 */
export function rewardClock(clock: number, active: boolean, level: number, dt: number): number {
  if (level === 0) return 0
  return active ? clock + Math.max(dt, 0) : clock
}

/** Corners of the honey of a cell, pointing up like the cells of the decor. */
export function hexagonPoints(cell: Point, r = CELL_INNER_RADIUS): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3
    return { x: cell.x + r * Math.cos(angle), y: cell.y + r * Math.sin(angle) }
  })
}

/**
 * Honey in a cell filled to `fill` (0 to 1): the part of its hexagon under the level of the honey,
 * which rises from the bottom corner to the top one. Empty under 0, the whole hexagon at 1.
 */
export function honeyIn(cell: Point, fill: number, r = CELL_INNER_RADIUS): Point[] {
  const hexagon = hexagonPoints(cell, r)
  if (fill <= 0) return []
  if (fill >= 1) return hexagon
  const surface = cell.y + r - 2 * r * fill
  // The hexagon is convex: keep its corners under the surface and cut the edges it crosses.
  const honey: Point[] = []
  hexagon.forEach((a, i) => {
    const b = hexagon[(i + 1) % hexagon.length] ?? a
    const aIn = a.y >= surface
    const bIn = b.y >= surface
    if (aIn) honey.push(a)
    if (aIn !== bIn) honey.push({ x: a.x + ((surface - a.y) / (b.y - a.y)) * (b.x - a.x), y: surface })
  })
  return honey
}
