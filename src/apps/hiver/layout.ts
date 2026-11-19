// [SPEC-8.6] [SPEC-16.3] Geometry of the winter landscape, in world units, free of PixiJS so it can
// be tested. `landscape.ts` draws from these values; the world is drawn once and a screen only
// changes its scale and position (see src/silence/geometry.ts).
import { lobedBounds, type Ellipse, type Point, type Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** Foot of the far snowy hills: the snow of the ground starts here. */
export const HORIZON_Y = 500

/** [SPEC-16.3] The five planes, back to front. Characters in the open are drawn between `middle`
 *  and `foreground` (see `landscape.ts`). */
export const PLANES = ['sky', 'far', 'back', 'middle', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

/** A straight line between two points. */
export interface Segment {
  from: Point
  to: Point
}

/**
 * [SPEC-16.3] The big snowy tree on the left: a trunk wider at its foot, from `base` up to `top`,
 * with a hollow (the squirrel's) and a bare branch on the right (the snowy owl's, without snow
 * where she perches [SPEC-16.5.1]).
 */
export const TREE = {
  base: { y: 800, left: 30, right: 290 },
  top: { y: 230, left: 70, right: 250 },
  /** The hollow, an opening on the dark inside of the trunk. */
  hollow: { x: 95, y: 452, width: 150, height: 178 },
  /** The owl's branch, from the trunk to its tip, and its thickness at both ends. */
  branch: { from: { x: 240, y: 420 }, to: { x: 450, y: 392 }, baseThickness: 40, tipThickness: 22 },
} as const

/** Left and right edges of the trunk at height `y`. */
export function trunkAt(y: number): { left: number; right: number } {
  const { base, top } = TREE
  const t = (base.y - y) / (base.y - top.y)
  return { left: base.left + (top.left - base.left) * t, right: base.right + (top.right - base.right) * t }
}

/** [SPEC-16.2] Top of the owl's branch at `x` (a straight branch, thinner at its tip). */
export function branchTopY(x: number): number {
  const { from, to, baseThickness, tipThickness } = TREE.branch
  const t = (x - from.x) / (to.x - from.x)
  return from.y + (to.y - from.y) * t - (baseThickness + (tipThickness - baseThickness) * t) / 2
}

/** [SPEC-16.2] The reindeer's hill, at the back: a dome standing on its centre line. */
export const HILL: Ellipse = { x: 520, y: 640, rx: 250, ry: 230 }

/**
 * [SPEC-16.3] [SPEC-16.3.1] The rock in the middle: its body, the slab that overhangs it on the
 * right, and the big icicles under the right end of the slab. The white fox lies behind the body
 * and peeks out under the slab, below the icicles.
 */
export const ROCK = {
  body: { x: 260, y: 640, width: 300, height: 210 },
  slab: { x: 240, y: 588, width: 345, height: 58 },
  /** Icicles hang from under the slab between these x, down to `bottom` at most. */
  icicles: { from: 470, to: 578, bottom: 684 },
} as const

/**
 * [SPEC-16.3] [SPEC-16.3.2] The wooden house at the back on the right: its wall, the top of its
 * gable roof covered with snow, the door sized for Santa, a window, a round window in the gable
 * and the chimney. Santa waits inside, right of the door.
 */
export const HOUSE = {
  wall: { x: 850, y: 400, width: 320, height: 230 },
  roofTop: 250,
  /** Roof overhang beyond the wall on each side. */
  eaves: 30,
  door: { x: 880, y: 420, width: 150, height: 210 },
  window: { x: 1056, y: 440, width: 96, height: 80 },
  attic: { x: 1010, y: 330, radius: 24 },
  /** Its foot goes down behind the roof, which hides it. */
  chimney: { x: 1090, y: 222, width: 40, height: 140 },
} as const

/** [SPEC-16.3.3] Where the smoke leaves the chimney. */
export const SMOKE_ORIGIN: Point = { x: HOUSE.chimney.x + HOUSE.chimney.width / 2, y: HOUSE.chimney.y - 6 }

/** [SPEC-16.3] [SPEC-16.4] The Christmas tree, in the middle on the right: a cone of tiers from
 *  `top` down to `base`, `halfBase` wide on each side at its foot; its star above the top. */
export const FIR = { x: 1260, base: 820, top: 330, halfBase: 170, trunk: 26 } as const
/** [SPEC-16.2] Where the robin hides, among the upper tiers of the Christmas tree. */
export const ROBIN_NEST: Rect = { x: 1206, y: 525, width: 96, height: 75 }
export const STAR: Point & { radius: number } = { x: FIR.x, y: FIR.top - 8, radius: 34 }

/** Half width of the Christmas tree at height `y` (zero above its top, its foot's below it). */
export function firHalfWidth(y: number): number {
  return Math.max(0, (FIR.halfBase * (Math.min(y, FIR.base) - FIR.top)) / (FIR.base - FIR.top))
}

/** [SPEC-16.3] Foreground hideouts, closest to the children: domes standing on their centre lines.
 *  The bush is lobed; the drifts are smooth. */
export const BUSH: Ellipse = { x: 160, y: 1085, rx: 210, ry: 210 }
export const DRIFT: Ellipse = { x: 620, y: 1085, rx: 150, ry: 175 }
export const BIG_DRIFT: Ellipse = { x: 1300, y: 1085, rx: 190, ry: 330 }

/** [SPEC-16.2] The hideouts. */
export const HIDEOUT_IDS = ['drift', 'hollow', 'bush', 'rock', 'bigDrift', 'fir', 'hill', 'trunk', 'house'] as const
export type HideoutId = (typeof HIDEOUT_IDS)[number]

/** The hideouts drawn behind the characters in the open, which have a slot: the others hide the
 *  characters of the actors layer behind a shape of the foreground. */
export const SLOT_HIDEOUT_IDS = ['hollow', 'rock', 'fir', 'hill', 'trunk', 'house'] as const satisfies readonly HideoutId[]
export type SlotHideoutId = (typeof SLOT_HIDEOUT_IDS)[number]

export interface Hideout {
  id: HideoutId
  /** Plane whose shape hides the character. */
  plane: PlaneId
  /** Visible extent of the hideout's drawing. */
  footprint: Rect
  /** Where a hidden character stands: one lying entirely inside this rectangle is invisible. Its
   *  feet are on the bottom edge. */
  cover: Rect
  /** Spot just outside the hideout where a character that comes out stands (feet position). */
  exit: Point
}

/** Extent of a dome standing on its centre line, lobes included for a lobed one. */
function domeBounds(d: Ellipse, lobedShape: boolean): Rect {
  if (lobedShape) return lobedBounds(d, true)
  return { x: d.x - d.rx, y: d.y - d.ry, width: 2 * d.rx, height: d.ry }
}

/** Extent of the tree's trunk with its hollow (not its crown nor its branch). */
const TRUNK_BOUNDS: Rect = { x: TREE.base.left, y: TREE.top.y, width: TREE.base.right - TREE.base.left, height: TREE.base.y - TREE.top.y }

/**
 * Covers are sized for the character that hides there, in world units: lying rabbit 100×130
 * (drift), squirrel 120×155 (hollow), lying fox 255×125 (bush), white fox 255×160 (rock), snowman
 * 150×220 (big drift), elf 110×170 (Christmas tree), crouching reindeer 250×180 (hill), snowy owl
 * 130×155 (trunk), Santa 135×220 (house).
 */
export const HIDEOUTS: Readonly<Record<HideoutId, Hideout>> = {
  // Lying behind the small drift of the foreground.
  drift: { id: 'drift', plane: 'foreground', footprint: domeBounds(DRIFT, false), cover: { x: 564, y: 932, width: 110, height: 128 }, exit: { x: 790, y: 1010 } },
  // Inside the trunk, below the sill of the hollow. The slot is masked to the hollow: a squirrel
  // below the sill is invisible.
  hollow: { id: 'hollow', plane: 'middle', footprint: TRUNK_BOUNDS, cover: { x: 100, y: 634, width: 140, height: 160 }, exit: { x: 170, y: 622 } },
  // Lying behind the bush of the foreground.
  bush: { id: 'bush', plane: 'foreground', footprint: domeBounds(BUSH, true), cover: { x: 34, y: 925, width: 254, height: 120 }, exit: { x: 440, y: 950 } },
  // Behind the body of the rock.
  rock: { id: 'rock', plane: 'middle', footprint: { x: ROCK.slab.x, y: ROCK.slab.y, width: ROCK.slab.width, height: ROCK.body.y + ROCK.body.height - ROCK.slab.y }, cover: { x: 280, y: 690, width: 260, height: 158 }, exit: { x: 705, y: 852 } },
  // Behind the big drift of the foreground.
  bigDrift: { id: 'bigDrift', plane: 'foreground', footprint: domeBounds(BIG_DRIFT, false), cover: { x: 1210, y: 815, width: 160, height: 227 }, exit: { x: 1040, y: 995 } },
  // Behind the Christmas tree.
  fir: {
    id: 'fir',
    plane: 'middle',
    footprint: { x: FIR.x - FIR.halfBase, y: STAR.y - STAR.radius, width: 2 * FIR.halfBase, height: FIR.base + FIR.trunk - (STAR.y - STAR.radius) },
    cover: { x: 1160, y: 645, width: 140, height: 170 },
    exit: { x: 1030, y: 830 },
  },
  // Behind the hill, crouching.
  hill: { id: 'hill', plane: 'back', footprint: domeBounds(HILL, false), cover: { x: 395, y: 448, width: 250, height: 182 }, exit: { x: 570, y: 398 } },
  // Behind the top of the trunk.
  trunk: { id: 'trunk', plane: 'middle', footprint: TRUNK_BOUNDS, cover: { x: 96, y: 255, width: 130, height: 155 }, exit: { x: 352, y: 392 } },
  // Inside the house, right of the door. The slot is masked to the door and to what lies below
  // the wall: Santa inside, right of the door, is invisible.
  house: {
    id: 'house',
    plane: 'back',
    footprint: { x: HOUSE.wall.x - HOUSE.eaves, y: HOUSE.chimney.y, width: HOUSE.wall.width + 2 * HOUSE.eaves, height: HOUSE.wall.y + HOUSE.wall.height - HOUSE.chimney.y },
    cover: { x: 1034, y: 400, width: 135, height: 228 },
    exit: { x: 955, y: 662 },
  },
}

/** [SPEC-16.3] Tiers of the Christmas tree, top to bottom: each one a flared skirt from `top` to
 *  `bottom`, overlapping the next, so that together they cover the whole cone. */
export const FIR_TIERS: readonly { top: number; bottom: number }[] = [
  { top: FIR.top, bottom: 470 },
  { top: 440, bottom: 600 },
  { top: 570, bottom: 720 },
  { top: 690, bottom: FIR.base },
]

/** [SPEC-16.3] [SPEC-16.4] The garland across the three lower tiers, sagging in the middle, and its
 *  bulbs: unlit in the decor, lit one by one by the reward. */
export const GARLANDS: readonly { y: number; sag: number }[] = [
  { y: 520, sag: 26 },
  { y: 655, sag: 30 },
  { y: 780, sag: 32 },
]

/** Point of a garland at `t` (0: left end, 1: right end), on the tree's outline at its ends. */
export function garlandPoint(garland: { y: number; sag: number }, t: number): Point {
  const half = firHalfWidth(garland.y) * 0.92
  return { x: FIR.x - half + 2 * half * t, y: garland.y + garland.sag * 4 * t * (1 - t) }
}

/** Bulbs of the garland, from the top garland down, left to right. */
export const BULBS: readonly Point[] = GARLANDS.flatMap((garland, i) => {
  const count = 4 + i
  return Array.from({ length: count }, (_, k) => garlandPoint(garland, (k + 0.5) / count))
})

/** [SPEC-16.5.2] Ornaments between the garlands: red ones with a cream highlight, orange ones. */
export const ORNAMENTS: readonly (Point & { color: 'red' | 'orange' })[] = [
  { x: FIR.x - 24, y: 455, color: 'orange' },
  { x: FIR.x + 30, y: 470, color: 'red' },
  { x: FIR.x - 70, y: 590, color: 'red' },
  { x: FIR.x + 6, y: 600, color: 'orange' },
  { x: FIR.x + 78, y: 585, color: 'red' },
  { x: FIR.x - 110, y: 730, color: 'orange' },
  { x: FIR.x - 30, y: 735, color: 'red' },
  { x: FIR.x + 50, y: 728, color: 'orange' },
  { x: FIR.x + 120, y: 740, color: 'red' },
]
