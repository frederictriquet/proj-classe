// [SPEC-8.6] [SPEC-13.2] [SPEC-13.3] Geometry of the apiary, in world units, free of PixiJS so it can
// be tested. `apiary.ts` draws from these values; the world is drawn once and a screen only changes
// its scale and position (see src/silence/geometry.ts).
//
// [SPEC-13.2.3] Points where an animal stands or perches follow the convention of the shared code
// (src/silence/animal.ts): `x, y` is the point of the ground right under the animal, which sets its
// depth and its shadow; `height` lifts its feet above that point.
import type { Extent } from '../../silence/animal'
import { lobedBounds, type Ellipse, type Point, type Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** Top edge of the grass of the meadow, at the foot of the far hills. */
export const HORIZON_Y = 500

/** [SPEC-13.3] The six planes, back to front. Animals in the open are drawn between `flowers` and
 *  `foreground` (see `apiary.ts`): every flower an animal perches on is behind them. */
export const PLANES = ['sky', 'hills', 'meadow', 'apiary', 'flowers', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

export const SUN = { x: 1270, y: 110, radius: 58 } as const

/** A point where an animal stands, hides, peeks or perches: ground point and height of the feet. */
export interface Perch {
  x: number
  /** Ground right under the animal: its depth. */
  y: number
  /** Feet above the ground point, world units. */
  height: number
}

/** Ground in front of the hive and of the comb: the depth of the animals hiding in the hive, on
 *  the flight board, in front of the flight hole and on the comb. */
export const APIARY_FRONT_Y = 815

/** [SPEC-13.3] Wooden hive with a gable roof, on the left, on a stand. Its body is made of two
 *  boxes; the flight hole is a wide slot at the bottom, over the flight board. */
export const HIVE = {
  body: { x: 60, y: 400, width: 320, height: 250 },
  /** Seam between the two boxes of the body. */
  seamY: 520,
  roofTop: 300,
  /** Roof overhang beyond the body on each side. */
  eaves: 26,
  /** [SPEC-13.2.1] Wide enough for two or three heads side by side, tall enough for a whole bee. */
  hole: { x: 110, y: 540, width: 220, height: 96 },
  /** The flight board, sticking out under the hole: back edge against the body, front edge
   *  wider and lower, then its thickness. */
  board: { backY: 636, frontY: 660, thickness: 16, frontX: 30, frontWidth: 380 },
  /** Legs of the stand, left edges, down to the ground. */
  legs: [86, 330],
  legWidth: 24,
  groundY: 800,
} as const

/**
 * [SPEC-13.2.1] The flight hole as the bees see it. `peeks`: where a bee stands to show its head,
 * eyes and antennae in the hole, the rest of it hidden behind the board, at either end of the hole
 * so that two heads stay visible when the bees come out one after the other; far enough from
 * `inside` for the bee's weave to swing once on the way (see `beeFlight` in animal-data.ts).
 * `inside`: feet height of a bee standing wholly in the hole, on its sill; the hole is taller than a
 * bee, so a bee there can move from the hive's slot to the actors layer without being cut.
 */
export const FLIGHT_HOLE = {
  rect: HIVE.hole,
  peeks: [160, 280].map((x): Perch => ({ x, y: APIARY_FRONT_Y, height: APIARY_FRONT_Y - 660 })),
  inside: { x: HIVE.hole.x + HIVE.hole.width / 2, y: APIARY_FRONT_Y, height: APIARY_FRONT_Y - 628 } satisfies Perch,
} as const

/** [SPEC-13.3] [SPEC-13.4] Frame of honeycomb against the hive: wooden frame, lugs of its top bar,
 *  legs, and the comb inside. */
export const COMB = {
  frame: { x: 430, y: 336, width: 390, height: 294 },
  bar: 22,
  lug: 18,
  legs: [458, 792],
  legWidth: 22,
  groundY: 805,
  /** Centre to corner of a hexagonal cell, pointing up; the wax wall between two cells. */
  cellRadius: 30,
  wall: 6,
} as const

/** Centre to corner of the honey or the hollow of a cell, inside its wax walls: the decor draws the
 *  cells with it, and the reward fills the empty ones to the same edge [SPEC-13.4]. */
export const CELL_INNER_RADIUS = COMB.cellRadius - COMB.wall / Math.sqrt(3)

/** Inside of the frame, where the cells lie. */
export const COMB_INNER: Rect = {
  x: COMB.frame.x + COMB.bar,
  y: COMB.frame.y + COMB.bar,
  width: COMB.frame.width - 2 * COMB.bar,
  height: COMB.frame.height - 2 * COMB.bar,
}

export interface Cell {
  x: number
  y: number
  /** Full of honey; otherwise empty: the reward fills it [SPEC-13.4]. */
  full: boolean
}

const COMB_ROWS = 5
const COMB_COLUMNS = 6

/** [SPEC-13.3] Honey at the top, as in a real frame; empty cells at the bottom, with a few full
 *  ones among them. Rows and columns of the cells that are empty. */
function emptyCell(row: number, column: number): boolean {
  if (row < 3) return false
  return !((row === 3 && column === 5) || (row === 4 && column === 0))
}

/** [SPEC-13.4] Every cell of the comb, row by row from the top, left to right: the reward fills
 *  the empty ones one by one. Odd rows are shifted by half a cell. */
export const CELLS: readonly Cell[] = (() => {
  const r = COMB.cellRadius
  const step = Math.sqrt(3) * r
  const rowStep = 1.5 * r
  const width = (COMB_COLUMNS + 0.5) * step
  const height = 2 * r + (COMB_ROWS - 1) * rowStep
  const x0 = COMB_INNER.x + (COMB_INNER.width - width) / 2 + step / 2
  const y0 = COMB_INNER.y + (COMB_INNER.height - height) / 2 + r
  const cells: Cell[] = []
  for (let row = 0; row < COMB_ROWS; row++) {
    for (let column = 0; column < COMB_COLUMNS; column++) {
      cells.push({ x: x0 + column * step + (row % 2) * (step / 2), y: y0 + row * rowStep, full: !emptyCell(row, column) })
    }
  }
  return cells
})()

/** Box around a cell, walls included. */
export function cellBox(cell: Cell): Rect {
  const r = COMB.cellRadius
  const half = (Math.sqrt(3) / 2) * r
  return { x: cell.x - half, y: cell.y - r, width: 2 * half, height: 2 * r }
}

/** [SPEC-13.3] Stump under the right of the comb, and the honey pot on it, an open jar. */
export const STUMP = { x: 735, top: 772, rx: 72, groundY: 830 } as const
export const POT = { x: STUMP.x, mouthY: 690, mouthRx: 36, bellyRx: 56, bottom: STUMP.top } as const

/** [SPEC-13.3] [SPEC-13.4] A drop of honey forms here, on the bottom edge of the frame, and falls
 *  into the pot (`fallTo`, behind the pot's rim). The reward's trickle runs the same way. */
export const DRIP = { x: POT.x, y: COMB.frame.y + COMB.frame.height, fallTo: POT.mouthY + 14, radius: 13 } as const

/** A flower of the meadow: a stem from the ground point up to its head. */
export interface Flower {
  x: number
  /** Ground at the foot of the stem. */
  y: number
  /** Height of the centre of the head above the ground point. */
  height: number
  /** Radius of the head, petals included. */
  radius: number
  color: 'pink' | 'blue'
}

/** Head centre of a flower, on the screen. */
export const flowerHead = (f: Flower): Point => ({ x: f.x, y: f.y - f.height })

/** [SPEC-13.2.1] The flowers of the meadow where a bee perches, one bee each, on the heart of the
 *  flower. Pink and blue only: the bee's yellow is too close to the cream of a daisy [SPEC-13.5].
 *  They stay still, so that a perched bee never floats beside its flower. */
export const BEE_FLOWERS: readonly Flower[] = [
  { x: 900, y: 720, height: 80, radius: 48, color: 'pink' },
  { x: 1040, y: 700, height: 100, radius: 46, color: 'blue' },
  { x: 1190, y: 730, height: 90, radius: 48, color: 'pink' },
  { x: 1330, y: 680, height: 120, radius: 46, color: 'blue' },
  { x: 90, y: 1000, height: 100, radius: 48, color: 'pink' },
  { x: 300, y: 1050, height: 90, radius: 48, color: 'blue' },
  { x: 520, y: 980, height: 100, radius: 50, color: 'pink' },
  { x: 720, y: 1050, height: 90, radius: 48, color: 'blue' },
  { x: 880, y: 920, height: 100, radius: 50, color: 'pink' },
  { x: 960, y: 1050, height: 90, radius: 48, color: 'blue' },
  { x: 1020, y: 890, height: 90, radius: 48, color: 'pink' },
]

/** [SPEC-13.2.2] The clump of big flowers at the front right. Its leaves, a lobed dome of the
 *  foreground, hide the butterflies; its two big flowers, the biggest of the meadow, rise behind the
 *  actors layer and the butterflies settle on them. */
export const CLUMP: Ellipse = { x: 1230, y: 1095, rx: 190, ry: 170 }
export const BIG_FLOWERS: readonly Flower[] = [
  { x: 1180, y: 1060, height: 300, radius: 70, color: 'pink' },
  { x: 1350, y: 1060, height: 360, radius: 72, color: 'pink' },
]

/** Grass tufts along the bottom edge, in the foreground: from this line down. */
export const TUFTS_TOP = 1040

/** [SPEC-13.2] The two hideouts: the hive for the bees, the clump for the butterflies. */
export const HIDEOUT_IDS = ['hive', 'clump'] as const
export type HideoutId = (typeof HIDEOUT_IDS)[number]

/** The hideouts with a slot, right behind the shape that hides the animals: the hive's façade. The
 *  clump, in the foreground, hides the animals of the actors layer. */
export const SLOT_HIDEOUT_IDS = ['hive'] as const satisfies readonly HideoutId[]
export type SlotHideoutId = (typeof SLOT_HIDEOUT_IDS)[number]

export interface Hideout {
  id: HideoutId
  /** Plane whose shape hides the animals. */
  plane: PlaneId
  /** Visible extent of the hideout's drawing. */
  footprint: Rect
  /** An animal whose drawing lies entirely in this rectangle is invisible, in the hideout's slot
   *  or behind a shape of the foreground. */
  cover: Rect
  /** First point clear of the hideout's shape, on the side of the meadow: an animal coming out of
   *  the hive changes layer here. */
  exit: Perch
}

export const HIDEOUTS: Readonly<Record<HideoutId, Hideout>> = {
  // Inside the body, above the flight hole: the slot shows only the hole.
  hive: {
    id: 'hive',
    plane: 'apiary',
    footprint: {
      x: HIVE.board.frontX,
      y: HIVE.roofTop,
      width: HIVE.board.frontWidth,
      height: HIVE.groundY - HIVE.roofTop,
    },
    cover: { x: 80, y: 410, width: 280, height: 120 },
    exit: FLIGHT_HOLE.inside,
  },
  // Behind the leaves of the clump, wings folded.
  clump: {
    id: 'clump',
    plane: 'foreground',
    footprint: lobedBounds(CLUMP, true),
    cover: { x: 1160, y: 950, width: 140, height: 115 },
    exit: { x: CLUMP.x, y: 1060, height: 170 },
  },
}

/**
 * Size each animal is drawn within, standing at rest, facing right, around its feet, paper shadow
 * excluded: the places below are spaced for it. A bee is about 80 units tall [SPEC-13.2.1]; a
 * butterfly with its wings open is bigger. The animals' drawings stay within these extents.
 */
export const EXTENT_BUDGET: Readonly<Record<'bee' | 'butterfly', Extent>> = {
  bee: { left: -50, right: 50, top: -80 },
  butterfly: { left: -65, right: 65, top: -110 },
}

export interface Place extends Perch {
  animal: 'bee' | 'butterfly'
  /** [SPEC-13.2.1] [SPEC-13.2.2] What the animal settles on. */
  support: 'flower' | 'comb' | 'board'
  /** Facing once settled: towards the middle of the decor. */
  facing: 1 | -1
}

const MIDDLE_X = 720
const facingMiddle = (x: number): 1 | -1 => (x < MIDDLE_X ? 1 : -1)

const onFlower = (animal: Place['animal']) => (f: Flower): Place => ({
  animal,
  support: 'flower',
  x: f.x,
  y: f.y,
  height: f.height,
  facing: facingMiddle(f.x),
})

/** Feet on the honey of the comb's top rows, over full cells only: the cells the reward fills stay
 *  in sight [SPEC-13.4], and a bee never sits on the cream walls alone [SPEC-13.5]. */
const COMB_PERCHES: readonly Point[] = [
  { x: 530, y: 470 },
  { x: 720, y: 470 },
]

/** Feet on the flight board, at its two ends, clear of the flight hole. */
const BOARD_PERCHES: readonly Point[] = [
  { x: 75, y: 652 },
  { x: 365, y: 652 },
]

/**
 * [SPEC-13.2.1] [SPEC-13.2.2] One place per animal: fifteen bees (eleven on the flowers of the
 * meadow, two on the comb, two on the flight board), then the two butterflies on the two big
 * flowers. Which bee takes which place is the animals' business.
 */
export const PLACES: readonly Place[] = [
  ...BEE_FLOWERS.map(onFlower('bee')),
  ...COMB_PERCHES.map((p): Place => ({ animal: 'bee', support: 'comb', x: p.x, y: APIARY_FRONT_Y, height: APIARY_FRONT_Y - p.y, facing: facingMiddle(p.x) })),
  ...BOARD_PERCHES.map((p): Place => ({ animal: 'bee', support: 'board', x: p.x, y: APIARY_FRONT_Y, height: APIARY_FRONT_Y - p.y, facing: 1 })),
  ...BIG_FLOWERS.map(onFlower('butterfly')),
]
