// [SPEC-8.6] [SPEC-17.3] Geometry of the spring meadow, in world units, free of PixiJS so it can be
// tested. `landscape.ts` draws from these values; the world is drawn once and a screen only
// changes its scale and position (see src/silence/geometry.ts).
import type { Ellipse, Point, Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** Foot of the far hills: the meadow starts here. */
export const HORIZON_Y = 560

/** [SPEC-17.5.1] The far hills dip to the horizon between these x, behind the swallows perched on
 *  the fence: they have the sky behind them, not the leaf green of the hills. */
export const FAR_VALLEY = { from: 580, to: 880 } as const

/** [SPEC-17.3] The five planes, back to front. Characters in the open are drawn between `middle`
 *  and `foreground` (see `landscape.ts`). */
export const PLANES = ['sky', 'far', 'back', 'middle', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

/** [SPEC-17.3] [SPEC-17.4] The sun at the top right, half hidden by its cloud until the reward
 *  slides the cloud away. */
export const SUN: Point & { radius: number } = { x: 1340, y: 105, radius: 64 }
/** Right of the ridge of the nest box: the tit perched there has the sky behind it
 *  [SPEC-17.5.1]. */
export const SUN_CLOUD: Ellipse = { x: 1400, y: 165, rx: 140, ry: 55 }

/** [SPEC-17.2] The still cloud the swallows come back from. */
export const SWALLOW_CLOUD: Ellipse = { x: 860, y: 190, rx: 175, ry: 75 }

/** [SPEC-17.3] The wooden fence at the back: posts standing on `groundY`, two rails. */
export const FENCE = {
  from: 590,
  groundY: 655,
  postTop: 548,
  postWidth: 26,
  postStep: 140,
  rails: [
    { y: 566, height: 18 },
    { y: 610, height: 18 },
  ],
} as const

/** Top of the upper rail: the swallows perch on it. */
export const RAIL_TOP = FENCE.rails[0].y

/**
 * [SPEC-17.2] [SPEC-17.3] The nest box on a post higher than the fence: its front, the gable roof
 * above it and the round hole. The tit hides inside, below the sill of the hole: the slot of the
 * nest box is shown only through the hole.
 */
export const NEST_BOX = {
  front: { x: 1105, y: 300, width: 150, height: 220 },
  roofTop: 250,
  eaves: 18,
  hole: { x: 1132, y: 338, width: 96, height: 92 },
  post: { x: 1166, width: 28, groundY: 662 },
} as const

/**
 * [SPEC-17.3] The cherry tree on the left: a trunk wider at its foot, from `base` up to `top`, and
 * its bare branches, each one a limb from `from` to `to`, `t0` thick at its root and `t1` at its
 * tip. The nest sits on the first branch.
 */
export const TREE = {
  base: { y: 830, left: 110, right: 250 },
  top: { y: 430, left: 145, right: 220 },
} as const

export interface Limb {
  from: Point
  to: Point
  t0: number
  t1: number
}

export const BRANCHES: readonly Limb[] = [
  // The nest's branch, on the right.
  { from: { x: 195, y: 445 }, to: { x: 500, y: 330 }, t0: 36, t1: 16 },
  { from: { x: 160, y: 450 }, to: { x: 10, y: 255 }, t0: 34, t1: 14 },
  { from: { x: 185, y: 440 }, to: { x: 255, y: 110 }, t0: 32, t1: 12 },
  // Twigs, each one growing out of a branch above.
  { from: { x: 238, y: 190 }, to: { x: 400, y: 120 }, t0: 16, t1: 8 },
  { from: { x: 228, y: 240 }, to: { x: 100, y: 120 }, t0: 16, t1: 8 },
  { from: { x: 60, y: 320 }, to: { x: 40, y: 175 }, t0: 12, t1: 6 },
  { from: { x: 330, y: 395 }, to: { x: 400, y: 250 }, t0: 13, t1: 6 },
  { from: { x: 100, y: 375 }, to: { x: -40, y: 360 }, t0: 13, t1: 6 },
  { from: { x: 249, y: 130 }, to: { x: 210, y: 40 }, t0: 10, t1: 5 },
]

/** Point at `t` (0: root, 1: tip) along a branch. */
export function along(limb: Limb, t: number): Point {
  return { x: limb.from.x + (limb.to.x - limb.from.x) * t, y: limb.from.y + (limb.to.y - limb.from.y) * t }
}

/** [SPEC-17.2.1] Where the buds of the cherry tree grow: along the branches, towards their tips,
 *  away from the nest. */
export const BUD_POINTS: readonly (Point & { angle: number })[] = (
  [
    [1, 0.55],
    [1, 0.7],
    [2, 0.5],
    [2, 0.75],
    [2, 0.95],
    [3, 0.5],
    [3, 0.8],
    [3, 1],
    [4, 0.6],
    [4, 1],
    [5, 0.55],
    [5, 0.75],
    [6, 1],
    [7, 0.4],
    [8, 0.8],
    [0, 0.42],
  ] as const
).map(([branch, t], i) => {
  const limb = BRANCHES[branch]!
  const p = along(limb, t)
  // Buds point away from the branch, alternately to one side and the other.
  const angle = Math.atan2(limb.to.y - limb.from.y, limb.to.x - limb.from.x) + (i % 2 === 0 ? -1 : 1) * 0.9
  return { x: p.x, y: p.y, angle }
})

/** [SPEC-17.4] Where the blossoms of the reward open: the buds, and more along the branches. */
export const BLOSSOMS: readonly Point[] = [
  ...BUD_POINTS,
  ...(
    [
      [0, 0.3],
      [0, 0.55],
      [1, 0.35],
      [1, 0.68],
      [1, 0.9],
      [2, 0.38],
      [2, 0.62],
      [2, 0.85],
      [3, 0.3],
      [3, 0.65],
      [3, 0.9],
      [4, 0.35],
      [4, 0.8],
      [5, 0.8],
      [6, 0.8],
      [7, 0.35],
      [7, 0.8],
      [8, 0.6],
    ] as const
  ).map(([branch, t]) => along(BRANCHES[branch]!, t)),
]

/**
 * [SPEC-17.2.3] The nest on the first branch: a bowl from its rim down to its bottom, `rimHalf`
 * wide on each side at the rim and `bottomHalf` at the bottom. Its front is drawn in the
 * foreground plane: it hides the nestlings of the actors layer, whatever their depth.
 */
export const NEST = { x: 420, rim: 326, bottom: 392, rimHalf: 92, bottomHalf: 70 } as const

/** Half width of the nest's front at height `y` (zero outside it). */
export function nestHalfWidth(y: number): number {
  if (y < NEST.rim || y > NEST.bottom) return 0
  return NEST.rimHalf + ((NEST.bottomHalf - NEST.rimHalf) * (y - NEST.rim)) / (NEST.bottom - NEST.rim)
}

/**
 * [SPEC-17.2] [SPEC-17.3] The straw skep on its board: a tall dome standing on its centre line,
 * and the hole the bees come out of. A bee hides inside, below the sill of the hole; the skep's
 * slot is shown only through the hole.
 */
export const SKEP: Ellipse = { x: 960, y: 800, rx: 125, ry: 300 }
export const SKEP_HOLE: Rect = { x: 902, y: 606, width: 116, height: 100 }
/** The board under the skep, and the ground under it. */
export const SKEP_BOARD = { y: 800, height: 16, groundY: 822 } as const

/** Half width of the skep at height `y`. */
export function skepHalfWidth(y: number): number {
  const t = (SKEP.y - y) / SKEP.ry
  return t < 0 || t > 1 ? 0 : SKEP.rx * Math.sqrt(1 - t * t)
}

/** [SPEC-17.2] The molehill of the foreground: a dome of earth standing on its centre line. */
export const MOLEHILL: Ellipse = { x: 1230, y: 1050, rx: 140, ry: 100 }

/** Top of a dome standing on its centre line at `x` (its base when `x` is off the dome). */
export function domeTop(d: Ellipse, x: number): number {
  return d.y - d.ry * Math.sqrt(Math.max(0, 1 - ((x - d.x) / d.rx) ** 2))
}

/**
 * [SPEC-17.2.1] A clump of flowers rooted at `x, y`: each stem leans from the root to its head,
 * `dx` across and `height` up. An open flower's head reaches `head` above the top of its stem.
 */
export interface Clump {
  x: number
  y: number
  stems: readonly { dx: number; height: number }[]
  head: number
}

export const TULIPS: Clump = {
  x: 700,
  y: 990,
  stems: [
    { dx: -72, height: 200 },
    { dx: 0, height: 150 },
    { dx: 74, height: 205 },
  ],
  head: 50,
}

export const DAFFODILS: Clump = {
  x: 250,
  y: 1010,
  stems: [
    { dx: -62, height: 150 },
    { dx: 0, height: 186 },
    { dx: 58, height: 160 },
  ],
  head: 40,
}

/** [SPEC-17.2.2] Where a bee lands on the tulip `i`: on the rim of its open head. */
export function tulipTop(i: number): Point {
  const stem = TULIPS.stems[i]!
  return { x: TULIPS.x + stem.dx, y: TULIPS.y - stem.height - TULIPS.head + 2 }
}

/** [SPEC-17.3] Tufts of grass of the foreground, which sway a little. */
export const TUFTS: readonly (Point & { size: number })[] = [
  { x: 470, y: 1082, size: 70 },
  { x: 900, y: 1086, size: 60 },
  { x: 1420, y: 1080, size: 80 },
  { x: -60, y: 1080, size: 80 },
]

/** [SPEC-17.2] The hideouts. */
export const HIDEOUT_IDS = ['tulips', 'buds', 'skep', 'nest', 'daffodils', 'nestBox', 'molehill', 'cloud'] as const
export type HideoutId = (typeof HIDEOUT_IDS)[number]

/** The hideouts drawn behind the characters in the open, which have a slot. The nest and the
 *  molehill hide the characters of the actors layer behind a shape of the foreground; the plants
 *  grow in the actors layer. */
export const SLOT_HIDEOUT_IDS = ['skep', 'nestBox', 'cloud'] as const satisfies readonly HideoutId[]
export type SlotHideoutId = (typeof SLOT_HIDEOUT_IDS)[number]

/**
 * Where a hidden character stands: one lying entirely inside this rectangle is invisible. Its feet
 * are on the bottom edge. Sized for the character that hides there, in world units: bee 105×87
 * (skep), tit 81×73 (nest box), the three nestlings 136×52 (nest), sitting mole 125×81
 * (molehill), swallow 115×67 (cloud).
 */
export const COVERS: Readonly<Record<Exclude<HideoutId, 'tulips' | 'buds' | 'daffodils'>, Rect>> = {
  skep: { x: 880, y: 706, width: 160, height: 87 },
  nestBox: { x: 1120, y: 432, width: 120, height: 84 },
  nest: { x: 352, y: 330, width: 136, height: 54 },
  molehill: { x: 1165, y: 970, width: 130, height: 80 },
  cloud: { x: 710, y: 156, width: 290, height: 70 },
}
