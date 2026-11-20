// [SPEC-17.2] The ten characters of « Printemps du silence »: their hideout, the path from the hideout
// to their place in the spring meadow, their size, their speeds and their small activities, as the
// shared animal model reads them (src/silence/animal.ts). Free of PixiJS.
//
// Positions are in world units (see layout.ts): `x, y` is the point between the feet, on the
// ground. A character drawn facing right has its head on the right. [SPEC-13.2.3] The bees, the tit
// and the swallows fly: `x, y` is the ground point right under them, `height` lifts their feet above
// it. [SPEC-17.2.1] The plants grow in place: the height of their path is how far they have opened.
import { pathLengths, type AnimalSpec, type Extent, type Waypoint } from '../../silence/animal'
import { BUD_POINTS, COVERS, NEST, NEST_BOX, RAIL_TOP, SKEP_BOARD, SKEP_HOLE, tulipTop, type HideoutId } from './layout'

/** [SPEC-9.4.1] [SPEC-17.2] [SPEC-17.2.2] From the least to the most timid: the order in which they
 *  come out. The bees come after the tulips they land on. */
export const ANIMAL_IDS = ['tulips', 'buds', 'bee1', 'nestlings', 'daffodils', 'tit', 'mole', 'bee2', 'swallow1', 'swallow2'] as const
export type AnimalId = (typeof ANIMAL_IDS)[number]
export const PLANT_IDS = ['tulips', 'buds', 'daffodils'] as const satisfies readonly AnimalId[]

/** A character of the spring meadow and its hideout. */
export type PrintempsAnimalSpec = AnimalSpec<AnimalId, HideoutId>

/**
 * [SPEC-17.2.1] Height of a plant's path at each step of its opening: closed buds while hidden,
 * swollen buds that show their colour while peeking, then open. The rigs read the opening as the
 * pose's height over `OPEN`.
 */
export const PLANT_HEIGHTS = { hidden: 0, peek: 30, exit: 55, open: 100 } as const

/** [SPEC-13.2.4] How the birds and the bees beat their wings: slow and wide [SPEC-8.5]. */
export const BEE_WINGS = { rate: 2.5, folded: -0.3, down: -0.55, up: 0.3 } as const
export const BIRD_WINGS = { rate: 2.5, folded: 0, down: -0.5, up: 0.7 } as const

/** Extents, facing right, standing. */
export const EXTENTS = {
  tulips: { left: -118, right: 120, top: -270 },
  daffodils: { left: -112, right: 108, top: -240 },
  bee: { left: -50, right: 50, top: -80 },
  nestlings: { left: -62, right: 62, top: -54 },
  tit: { left: -42, right: 40, top: -64 },
  mole: { left: -60, right: 60, top: -78 },
  swallow: { left: -58, right: 52, top: -60 },
} as const satisfies Record<string, Extent>

/** [SPEC-17.2.1] The buds grow from this point, the ground point of the cherry tree's buds: below
 *  the lowest of them, so that their extent holds them all. */
export const BUDS_ROOT = { x: 200, y: 420 } as const
/** Half size of a bud opened into leaves, world units. */
export const BUD_SIZE = 32
const BUDS_EXTENT: Extent = {
  left: Math.min(...BUD_POINTS.map((p) => p.x)) - BUDS_ROOT.x - BUD_SIZE,
  right: Math.max(...BUD_POINTS.map((p) => p.x)) - BUDS_ROOT.x + BUD_SIZE,
  top: Math.min(...BUD_POINTS.map((p) => p.y)) - BUDS_ROOT.y - BUD_SIZE,
}

/** A point of a path from a ground point, a screen height of the feet and a crouch. */
const at = (x: number, y: number, feetY: number, crouch = 0): Waypoint => ({ x, y, crouch, height: y - feetY })

/** [SPEC-17.2.1] A plant: it grows in place at `x, y`, seen from the front. */
function plant(id: (typeof PLANT_IDS)[number], x: number, y: number, extent: Extent): PrintempsAnimalSpec {
  const h = PLANT_HEIGHTS
  return {
    id,
    hideout: id,
    usesSlot: false,
    path: [h.hidden, h.peek, h.exit, h.open].map((height) => ({ x, y, crouch: 0, height })),
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: true,
    extent,
    // Opens over several seconds; closes in well under a second [SPEC-8.5].
    speed: { peek: 12, walk: 10, flee: 220 },
    peekPause: 1.5,
    gait: 'grow',
    strideLength: 50,
    bounce: 0,
    // Asleep, it closes halfway.
    sleepCrouch: 0.5,
    grazeCrouch: 0,
    activities: { rest: 3, graze: 1, scratch: 0, sleep: 1, look: 2 },
  }
}

/** Ground point of a bee in the skep: the foot of its board. */
const SKEP_Y = SKEP_BOARD.groundY
/** Screen height of the feet of a bee crossing the depth of the tulips: its drawing then stays
 *  above them. */
const BEE_CRUISE = 640
/** Indices of the peek point and of the exit point in the path of a flying character. */
const PEEK = 1
const EXIT = 2

/** The weave starts at the peek point; its length is twice the way from there to the exit point,
 *  so that it is zero again at the exit and changing layer there shows no jump (as the bees of the
 *  hive). */
function weaveLength(path: readonly Waypoint[]): number {
  const lengths = pathLengths(path)
  return 2 * (lengths[EXIT]! - lengths[PEEK]!)
}

/**
 * [SPEC-17.2] [SPEC-17.2.2] A bee: hidden in the skep below the sill of its hole, its head in the
 * hole, the whole bee in the hole (exit point: it changes layer there), a climb out still at the
 * depth of the skep, a cruise above the tulips while its depth changes, and a straight descent onto
 * the rim of the tulip `tulip`.
 */
function bee(id: 'bee1' | 'bee2', peekX: number, tulip: number): PrintempsAnimalSpec {
  const top = tulipTop(tulip)
  const y = 990 + 2 + tulip
  const exitX = SKEP_HOLE.x + SKEP_HOLE.width / 2 - 2
  const path = [
    at(peekX, SKEP_Y, COVERS.skep.y + COVERS.skep.height - 3),
    at(peekX, SKEP_Y, SKEP_HOLE.y + 140),
    at(exitX, SKEP_Y, SKEP_HOLE.y + SKEP_HOLE.height - 8),
    at(exitX + 0.2 * (top.x - exitX), SKEP_Y, BEE_CRUISE),
    at(top.x, y, BEE_CRUISE),
    at(top.x, y, top.y),
  ]
  return {
    id,
    hideout: 'skep',
    usesSlot: true,
    path,
    peekIndex: PEEK,
    exitIndex: EXIT,
    hideFacing: 1,
    spotFacing: top.x < 700 ? 1 : -1,
    frontal: false,
    extent: EXTENTS.bee,
    // [SPEC-13.2.3] A slow flight; back to the skep in under a second.
    speed: { peek: 45, walk: 130, flee: 2000 },
    peekPause: 1.1,
    gait: 'fly',
    flight: { wingRate: BEE_WINGS.rate, weave: 18, weaveLength: weaveLength(path), restBeat: 0, restRate: 0 },
    strideLength: 40,
    bounce: 3,
    sleepCrouch: 0.6,
    grazeCrouch: 0.5,
    activities: { rest: 2, graze: 4, scratch: 2, sleep: 1, look: 2 },
  }
}

/** Ground point of the swallows: the depth of the fence, in front of it. */
const FENCE_Y = 660
/** Screen heights of the swallows' feet in the cloud, and where they leave it on its left. */
const CLOUD_FEET = COVERS.cloud.y + COVERS.cloud.height - 2

/** [SPEC-17.2] A swallow: in the cloud, its head out of the cloud's left edge, clear of the cloud
 *  (exit point), then a flight down to the upper rail of the fence. Its depth never changes. */
function swallow(id: 'swallow1' | 'swallow2', hideX: number, placeX: number, depth: number): PrintempsAnimalSpec {
  const y = FENCE_Y + depth
  const path = [at(hideX, y, CLOUD_FEET), at(680, y, CLOUD_FEET), at(600, y, CLOUD_FEET), at((600 + placeX) / 2, y, 400), at(placeX, y, RAIL_TOP)]
  return {
    id,
    hideout: 'cloud',
    usesSlot: true,
    path,
    peekIndex: PEEK,
    exitIndex: EXIT,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: EXTENTS.swallow,
    speed: { peek: 40, walk: 150, flee: 1600 },
    peekPause: 1.6,
    gait: 'fly',
    flight: { wingRate: BIRD_WINGS.rate, weave: 16, weaveLength: weaveLength(path), restBeat: 0, restRate: 0 },
    strideLength: 40,
    bounce: 4,
    sleepCrouch: 0.3,
    grazeCrouch: 0.2,
    activities: { rest: 3, graze: 1, scratch: 2, sleep: 1, look: 3 },
  }
}

/** Ground point of the tit: in front of the post of the nest box. */
const TIT_Y = NEST_BOX.post.groundY + 6
// Left of the middle of the hole: its tail reaches further than its beak.
const TIT_X = NEST_BOX.hole.x + NEST_BOX.hole.width / 2 - 3
/** [SPEC-17.2] The tit's path: inside the nest box below the sill, its head in the hole, the whole
 *  bird in the hole (exit point), then up onto the ridge of the roof. Its ground point moves a
 *  little forwards so that it weaves across the screen. */
const TIT_PATH: readonly Waypoint[] = [
  at(TIT_X, TIT_Y, COVERS.nestBox.y + COVERS.nestBox.height - 1),
  at(TIT_X, TIT_Y, 470),
  at(TIT_X, TIT_Y, NEST_BOX.hole.y + NEST_BOX.hole.height - 8),
  at(TIT_X, TIT_Y + 4, NEST_BOX.roofTop + 4),
]

/** [SPEC-17.2.3] Ground point of the nestlings: the bottom of the nest. They rise straight up. */
const NESTLINGS_Y = COVERS.nest.y + COVERS.nest.height

/**
 * [SPEC-17.2] Hideouts, paths and places. `animal-data.test.ts` checks that a path never crosses a
 * still character's depth while overlapping it, so the drawing order never flips on screen.
 */
export const ANIMALS: Readonly<Record<AnimalId, PrintempsAnimalSpec>> = {
  tulips: plant('tulips', 700, 990, EXTENTS.tulips),
  buds: plant('buds', BUDS_ROOT.x, BUDS_ROOT.y, BUDS_EXTENT),
  bee1: bee('bee1', 945, 0),
  // [SPEC-17.2.3] In the nest, seen from the front: their eyes over its rim to peek, then their
  // heads and necks out.
  nestlings: {
    id: 'nestlings',
    hideout: 'nest',
    usesSlot: false,
    path: [
      { x: NEST.x, y: NESTLINGS_Y, crouch: 0, height: 0 },
      { x: NEST.x, y: NESTLINGS_Y, crouch: 0, height: 30 },
      { x: NEST.x, y: NESTLINGS_Y, crouch: 0, height: 42 },
      { x: NEST.x, y: NESTLINGS_Y, crouch: 0, height: 52 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: true,
    extent: EXTENTS.nestlings,
    speed: { peek: 14, walk: 14, flee: 200 },
    peekPause: 1.5,
    gait: 'walk',
    strideLength: 40,
    bounce: 0,
    sleepCrouch: 0.4,
    grazeCrouch: 0,
    // « Broute » is opening their beaks wide.
    activities: { rest: 2, graze: 3, scratch: 1, sleep: 2, look: 2 },
  },
  daffodils: plant('daffodils', 250, 1010, EXTENTS.daffodils),
  tit: {
    id: 'tit',
    hideout: 'nestBox',
    usesSlot: true,
    path: TIT_PATH,
    peekIndex: PEEK,
    exitIndex: EXIT,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: EXTENTS.tit,
    speed: { peek: 40, walk: 110, flee: 1400 },
    peekPause: 1.6,
    gait: 'fly',
    flight: { wingRate: BIRD_WINGS.rate, weave: 12, weaveLength: weaveLength(TIT_PATH), restBeat: 0, restRate: 0 },
    strideLength: 40,
    bounce: 4,
    sleepCrouch: 0.3,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 1, scratch: 2, sleep: 1, look: 3 },
  },
  // In the molehill; its snout and eyes over the top, then down its left side, behind it, to sit
  // on the meadow.
  mole: {
    id: 'mole',
    hideout: 'molehill',
    usesSlot: false,
    path: [
      // Its feet and their shadow above the foot of the molehill.
      { x: 1230, y: 1040, crouch: 0, height: 0 },
      { x: 1230, y: 1040, crouch: 0, height: 56 },
      { x: 1150, y: 1043, crouch: 0, height: 36 },
      { x: 1010, y: 1046, crouch: 0, height: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: EXTENTS.mole,
    speed: { peek: 30, walk: 60, flee: 450 },
    peekPause: 2,
    gait: 'walk',
    strideLength: 36,
    bounce: 4,
    sleepCrouch: 0.6,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 2, scratch: 2, sleep: 2, look: 2 },
  },
  bee2: bee('bee2', 975, 2),
  swallow1: swallow('swallow1', 770, 660, 0),
  swallow2: swallow('swallow2', 880, 790, 2),
}
