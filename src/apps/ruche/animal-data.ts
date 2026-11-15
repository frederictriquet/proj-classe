// [SPEC-13.2] The seventeen animals of « Ruche du silence »: fifteen bees, then two butterflies,
// with their hideout, the path from the hideout to their place, their size, their speeds, their
// wings and their small activities, as the shared animal model reads them (src/silence/animal.ts).
// Free of PixiJS.
//
// Positions are in world units (see layout.ts). [SPEC-13.2.3] `x, y` is the ground point right under
// the animal, which sets its depth; `height` lifts its feet above it.
import { pathLengths, type AnimalSpec, type Flight, type Waypoint } from '../../silence/animal'
import { PAPER_SHADOW } from '../../silence/overlap'
import { APIARY_FRONT_Y, EXTENT_BUDGET, FLIGHT_HOLE, HIDEOUTS, HIVE, PLACES, type HideoutId, type Place } from './layout'

export const BEE_IDS = [
  'bee1',
  'bee2',
  'bee3',
  'bee4',
  'bee5',
  'bee6',
  'bee7',
  'bee8',
  'bee9',
  'bee10',
  'bee11',
  'bee12',
  'bee13',
  'bee14',
  'bee15',
] as const
export const BUTTERFLY_IDS = ['butterfly1', 'butterfly2'] as const
/** [SPEC-9.4.1] [SPEC-13.2] From the least to the most timid: the bees, then the butterflies. */
export const ANIMAL_IDS = [...BEE_IDS, ...BUTTERFLY_IDS] as const
export type BeeId = (typeof BEE_IDS)[number]
export type ButterflyId = (typeof BUTTERFLY_IDS)[number]
export type AnimalId = (typeof ANIMAL_IDS)[number]

/** An animal of the hive and its hideout. */
export type RucheAnimalSpec = AnimalSpec<AnimalId, HideoutId>

export const isBee = (id: AnimalId): id is BeeId => id.startsWith('bee')

/**
 * [SPEC-13.2.4] [SPEC-8.5] How the bees beat their wings, chosen in the gallery: slow and wide,
 * opaque cream wings. `rate` is in beats per second (at most `MAX_WING_RATE`), `folded`, `down` and
 * `up` are the rotations of a wing about its root, radians (0: standing up on the back, leaning
 * backwards; negative: lowered along the body).
 */
export const BEE_WINGS = { rate: 2.5, folded: -0.3, down: -0.55, up: 0.3 } as const

/** [SPEC-13.2.1] Height of a bee, world units: about 80 of the 1080 of the safe zone. */
export const BEE_EXTENT = EXTENT_BUDGET.bee
/** [SPEC-13.2.2] A butterfly, wings open, seen from above: it never turns. */
export const BUTTERFLY_EXTENT = { left: -64, right: 64, top: -100 } as const

/**
 * Screen heights (feet, world units) the bees cruise at, between their climb out of the hole and
 * their descent onto their place. A bee bound for the back of the meadow flies higher than the
 * heads of the bees already perched on the comb and on the far flowers; one bound for the front
 * flies higher than those perched on the near flowers. `animal-data.test.ts` checks it: a bee never
 * crosses the depth of a perched animal while their drawings overlap [SPEC-13.2.3].
 */
export const CRUISE = { back: 330, front: 520, apiary: 560 } as const
/** Share of the way to its place a bee covers while climbing out of the hole, still at the depth
 *  of the hive. */
const CLIMB_SHARE = 0.2
/** A bee hides right under its peek point, below the sill of the flight hole: the hole, the only
 *  window on the hive's slot, shows nothing of it, and its head rises into the hole to peek. */
const HIDE_FEET_Y = HIVE.hole.y + HIVE.hole.height - BEE_EXTENT.top + PAPER_SHADOW.y + 10

/** [SPEC-13.2.1] Places of the bees, in the order they come out: the back of the meadow first, then
 *  the comb and the flight board, then the front. A bee flying to its place thus mostly passes in
 *  front of the bees already perched. */
export const BEE_PLACES: readonly Place[] = PLACES.filter((p) => p.animal === 'bee').sort((a, b) => a.y - b.y || a.x - b.x)
/** [SPEC-13.2.2] The left big flower for the first butterfly, the right one for the second. */
export const BUTTERFLY_PLACES: readonly Place[] = PLACES.filter((p) => p.animal === 'butterfly').sort((a, b) => a.x - b.x)

/** Indices of the peek point and of the exit point in the path of a bee (see `beePath`). */
const BEE_PEEK = 1
const BEE_EXIT = 2

/** A point of a path from a ground point, a screen height of the feet and a crouch. */
const at = (x: number, y: number, feetY: number, crouch = 0): Waypoint => ({ x, y, crouch, height: y - feetY })

/**
 * [SPEC-13.2.1] [SPEC-13.2.3] Path of the bee that comes out `rank`-th (from 0) to `place`: hidden in
 * the hive under the flight hole, its head in the hole (at either end of it in turn, so that two
 * heads show when the bees follow each other closely), the whole bee in the hole (exit point: it changes
 * layer there), then a climb out still at the depth of the hive, a cruise at a constant screen
 * height while its depth changes, and a straight descent onto its place. Deterministic.
 */
export function beePath(place: Place, rank: number): Waypoint[] {
  const peek = FLIGHT_HOLE.peeks[rank % FLIGHT_HOLE.peeks.length]!
  const exit = FLIGHT_HOLE.inside
  const y = APIARY_FRONT_Y
  const feet = place.y - place.height
  // A little variety between the bees, still above every perched head.
  const lift = 12 * ((rank % 3) - 1)
  const cruise =
    place.y < y ? CRUISE.back + lift : place.y > y ? CRUISE.front + lift : Math.min(CRUISE.apiary + lift, feet - 70)
  const climbX = exit.x + CLIMB_SHARE * (place.x - exit.x)
  return [
    at(peek.x, y, HIDE_FEET_Y),
    at(peek.x, peek.y, peek.y - peek.height),
    at(exit.x, exit.y, exit.y - exit.height),
    at(climbX, y, cruise),
    at(place.x, place.y, cruise),
    at(place.x, place.y, feet),
  ]
}

/** [SPEC-13.2.2] Path of a butterfly to `place`: lying behind the leaves of the clump, wings open; its
 *  head and antennae over them; clear of them (exit point); a rise above its big flower; landing. Its
 *  ground point stays at the foot of the big flowers, so its depth never changes. */
export function butterflyPath(place: Place): Waypoint[] {
  const { exit, cover, footprint } = HIDEOUTS.clump
  const y = place.y
  const hideFeet = cover.y + cover.height - PAPER_SHADOW.y - 1
  // Each butterfly peeks on the side of its flower, far enough from the other for its wings not to
  // hide the other's head.
  const side = Math.sign(place.x - exit.x)
  const hideX = Math.min(Math.max(exit.x + 10 * side, cover.x - BUTTERFLY_EXTENT.left), cover.x + cover.width - BUTTERFLY_EXTENT.right - PAPER_SHADOW.x)
  return [
    at(hideX, y, hideFeet, 1),
    // Head and eyes over the top of the leaves.
    at(exit.x + 50 * side, y, footprint.y + 58),
    at(exit.x, y, exit.y - exit.height),
    at((exit.x + place.x) / 2, y, place.y - place.height - 110),
    at(place.x, y, place.y - place.height),
  ]
}

/**
 * [SPEC-13.2.3] Wings and weave of the bee that comes out `rank`-th along `path`. The weave starts at
 * the peek point; its length is twice the way from there to the exit point, so that the weave is
 * zero again at the exit: the bee is then wholly inside the flight hole, and changing layer there
 * shows no jump.
 */
function beeFlight(rank: number, path: readonly Waypoint[]): Flight {
  const lengths = pathLengths(path)
  return {
    wingRate: BEE_WINGS.rate,
    weave: 18 + 4 * (rank % 3),
    weaveLength: 2 * (lengths[BEE_EXIT]! - lengths[BEE_PEEK]!),
    restBeat: 0,
    restRate: 0,
  }
}

/** [SPEC-13.2.1] The bee that comes out `rank`-th (from 0). All bees share one drawing; their small
 *  activities differ by the seed the shared code gives them. */
function bee(id: BeeId, rank: number): RucheAnimalSpec {
  const place = BEE_PLACES[rank]!
  const path = beePath(place, rank)
  return {
    id,
    hideout: 'hive',
    usesSlot: true,
    path,
    peekIndex: BEE_PEEK,
    exitIndex: BEE_EXIT,
    hideFacing: 1,
    spotFacing: place.facing,
    frontal: false,
    extent: BEE_EXTENT,
    // [SPEC-13.2.3] A slow flight; back to the hive in under a second.
    speed: { peek: 45, walk: 130, flee: 2000 },
    peekPause: 0.9 + 0.15 * (rank % 4),
    gait: 'fly',
    flight: beeFlight(rank, path),
    strideLength: 40,
    bounce: 3,
    sleepCrouch: 0.6,
    grazeCrouch: 0.5,
    activities: { rest: 2, graze: 4, scratch: 2, sleep: 1, look: 2 },
  }
}

/** [SPEC-13.2.2] A butterfly: slow wide wing beats, and once settled it opens and closes its wings
 *  slowly. */
function butterfly(id: ButterflyId, rank: number): RucheAnimalSpec {
  return {
    id,
    hideout: 'clump',
    usesSlot: false,
    path: butterflyPath(BUTTERFLY_PLACES[rank]!),
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: true,
    extent: BUTTERFLY_EXTENT,
    speed: { peek: 30, walk: 70, flee: 900 },
    peekPause: 1.8,
    gait: 'fly',
    flight: { wingRate: 1.4, weave: 26, weaveLength: 150, restBeat: 1, restRate: 0.3 },
    strideLength: 40,
    bounce: 8,
    sleepCrouch: 0.6,
    grazeCrouch: 0.6,
    activities: { rest: 3, graze: 3, scratch: 2, sleep: 1, look: 2 },
  }
}

/** [SPEC-13.2] Every animal of the hive. */
export const ANIMALS = Object.fromEntries([
  ...BEE_IDS.map((id, rank) => [id, bee(id, rank)] as const),
  ...BUTTERFLY_IDS.map((id, rank) => [id, butterfly(id, rank)] as const),
]) as Readonly<Record<AnimalId, RucheAnimalSpec>>
