// [SPEC-8.5] [SPEC-9.3] [SPEC-9.4.1] [SPEC-9.8] [SPEC-13] [SPEC-14.2] [SPEC-14.2.1] [SPEC-14.2.3]
// The twenty chicks of « Couvain du silence »: their egg hideout, the short path from the egg to
// their place in the incubator (by the feeder, under a heat lamp, or in the straw), their colour
// variant, their speeds and their activity weights specialised by zone, as the shared animal model
// reads them (src/silence/animal.ts). Free of PixiJS.
//
// Positions are in world units (see layout.ts): `x, y` is the point between the feet, on the
// ground. An animal drawn facing right has its head on the right.
import type { Activity, AnimalSpec, Waypoint } from '../../silence/animal'
import {
  CHICK_EXTENT,
  HIDEOUTS,
  PLACES,
  type EggId,
  type Place,
  type PlaceZone,
} from './layout'

/** [SPEC-9.4.1] [SPEC-14.2] The twenty chicks, from the least to the most timid: the order in
 *  which they hatch and come out. */
export const ANIMAL_IDS = [
  'chick1',
  'chick2',
  'chick3',
  'chick4',
  'chick5',
  'chick6',
  'chick7',
  'chick8',
  'chick9',
  'chick10',
  'chick11',
  'chick12',
  'chick13',
  'chick14',
  'chick15',
  'chick16',
  'chick17',
  'chick18',
  'chick19',
  'chick20',
] as const
export type AnimalId = (typeof ANIMAL_IDS)[number]

/** A chick of the brood and its egg hideout in the incubator. */
export type CouvainAnimalSpec = AnimalSpec<AnimalId, EggId>

/** [SPEC-14.2] [SPEC-14.5] Plumage colour variants within the brood palette: fourteen golden-yellow
 *  chicks, three russet (`terracotta`), two brown and one cream. */
export type ChickColor = 'yellow' | 'terracotta' | 'brown' | 'cream'

export const CHICK_COLORS: Readonly<Record<AnimalId, ChickColor>> = {
  chick1: 'yellow',
  chick2: 'yellow',
  chick3: 'yellow',
  chick4: 'terracotta',
  chick5: 'yellow',
  chick6: 'brown',
  chick7: 'yellow',
  chick8: 'cream',
  chick9: 'yellow',
  chick10: 'yellow',
  chick11: 'yellow',
  chick12: 'terracotta',
  chick13: 'yellow',
  chick14: 'yellow',
  chick15: 'yellow',
  chick16: 'brown',
  chick17: 'yellow',
  chick18: 'yellow',
  chick19: 'terracotta',
  chick20: 'yellow',
}

/**
 * [SPEC-14.2.3] Relative weights of the five common activities according to where the chick
 * settles:
 * - by the feeder: mostly pecking seeds (`graze`), resting (`rest`) and looking around (`look`);
 * - under the heat lamps: mostly sleeping in the warmth (`sleep`) and resting (`rest`);
 * - in the straw around the eggs: mostly scratching the straw (`scratch`), looking around (`look`)
 *   and pecking (`graze`).
 */
export const ZONE_ACTIVITIES: Readonly<Record<PlaceZone, Readonly<Record<Activity, number>>>> = {
  feeder: { graze: 5, rest: 3, look: 3, scratch: 1, sleep: 1 },
  lamp: { sleep: 5, rest: 4, look: 1, graze: 1, scratch: 1 },
  straw: { scratch: 5, look: 4, graze: 3, rest: 1, sleep: 1 },
}

/**
 * [SPEC-14.2] Egg assigned to each chick in come-out order. The order cycles through the four
 * corner nests (`topLeft`, `bottomRight`, `topRight`, `bottomLeft`), so two consecutive hatchings
 * never happen in the same nest nor in neighbouring eggs. The first three chicks also cover the
 * three cap variants (`lid`, `hat`, `cartoon` [SPEC-14.2.2]).
 */
export const CHICK_EGGS: Readonly<Record<AnimalId, EggId>> = {
  chick1: 'egg1', // nest 0 (topLeft), lid
  chick2: 'egg17', // nest 3 (bottomRight), hat
  chick3: 'egg6', // nest 1 (topRight), cartoon
  chick4: 'egg13', // nest 2 (bottomLeft), lid
  chick5: 'egg3', // nest 0 (topLeft), cartoon
  chick6: 'egg20', // nest 3 (bottomRight), hat
  chick7: 'egg8', // nest 1 (topRight), hat
  chick8: 'egg11', // nest 2 (bottomLeft), hat
  chick9: 'egg5', // nest 0 (topLeft), hat
  chick10: 'egg16', // nest 3 (bottomRight), lid
  chick11: 'egg10', // nest 1 (topRight), lid
  chick12: 'egg15', // nest 2 (bottomLeft), cartoon
  chick13: 'egg2', // nest 0 (topLeft), hat
  chick14: 'egg18', // nest 3 (bottomRight), cartoon
  chick15: 'egg7', // nest 1 (topRight), lid
  chick16: 'egg12', // nest 2 (bottomLeft), cartoon
  chick17: 'egg4', // nest 0 (topLeft), lid
  chick18: 'egg19', // nest 3 (bottomRight), lid
  chick19: 'egg9', // nest 1 (topRight), cartoon
  chick20: 'egg14', // nest 2 (bottomLeft), hat
}

/** Index in `PLACES` of the spot where the chick from each egg settles, and intermediate ground
 *  waypoints between `egg.exit` and that place so no path crosses a settled chick's depth while
 *  overlapping it. */
const EGG_ROUTES: Readonly<Record<EggId, { placeIndex: number; via?: readonly (readonly [number, number])[] }>> = {
  // Top-left nest (eggs 1..5)
  egg1: { placeIndex: 18 },
  egg2: { placeIndex: 0 },
  egg3: { placeIndex: 1, via: [[248, 615]] },
  egg4: { placeIndex: 14 },
  egg5: { placeIndex: 15, via: [[430, 555]] },
  // Top-right nest (eggs 6..10)
  egg6: { placeIndex: 16, via: [[1010, 555]] },
  egg7: { placeIndex: 17 },
  egg8: { placeIndex: 5, via: [[1192, 615]] },
  egg9: { placeIndex: 6 },
  egg10: { placeIndex: 19 },
  // Bottom-left nest (eggs 11..15)
  egg11: { placeIndex: 3, via: [[310, 788]] },
  egg12: { placeIndex: 2, via: [[295, 820], [295, 720]] },
  egg13: { placeIndex: 8 },
  egg14: { placeIndex: 10, via: [[450, 975]] },
  egg15: { placeIndex: 11, via: [[440, 990]] },
  // Bottom-right nest (eggs 16..20)
  egg16: { placeIndex: 12, via: [[1000, 990]] },
  egg17: { placeIndex: 13, via: [[990, 975]] },
  egg18: { placeIndex: 9 },
  egg19: { placeIndex: 4, via: [[1145, 820], [1145, 720]] },
  egg20: { placeIndex: 7, via: [[1130, 788]] },
}

/** Vertical offsets from `egg.y` of a chick crouched in its egg (`path[0]`), peeking out of the
 *  lower half-shell (`path[1]`), and hopping clear of the rim (`path[2]`, where it changes layer). */
export const EGG_PATH_DY = {
  hidden: -15,
  peek: -18,
  rim: -68,
} as const

/** Place in the incubator where each chick settles. */
export const CHICK_PLACES: Readonly<Record<AnimalId, Place>> = Object.fromEntries(
  ANIMAL_IDS.map((id) => {
    const eggId = CHICK_EGGS[id]
    return [id, PLACES[EGG_ROUTES[eggId].placeIndex]!]
  }),
) as Record<AnimalId, Place>

/** Builds the path of a chick from inside `eggId` to its place in the incubator. */
function chickPath(eggId: EggId): Waypoint[] {
  const egg = HIDEOUTS[eggId]
  const route = EGG_ROUTES[eggId]
  const place = PLACES[route.placeIndex]!
  const via = (route.via ?? []).map(([x, y]): Waypoint => ({ x, y, crouch: 0 }))
  return [
    // Crouched down inside the lower half-shell.
    { x: egg.x, y: egg.y + EGG_PATH_DY.hidden, crouch: 1 },
    // Standing up inside the shell: head, eyes, beak and tuft peek above the zigzag split.
    { x: egg.x, y: egg.y + EGG_PATH_DY.peek, crouch: 0 },
    // Hopped up clear of the top rim of the lower half-shell: switches from `slot` to `actors`.
    { x: egg.x, y: egg.y + EGG_PATH_DY.rim, crouch: 0 },
    // Steps onto the straw just outside the egg, then walks/hops to its place.
    { x: egg.exit.x, y: egg.exit.y, crouch: 0 },
    ...via,
    { x: place.x, y: place.y, crouch: 0 },
  ]
}

function makeChick(id: AnimalId, rank: number): CouvainAnimalSpec {
  const eggId = CHICK_EGGS[id]
  const egg = HIDEOUTS[eggId]
  const place = CHICK_PLACES[id]
  const hideFacing: 1 | -1 = egg.nest === 0 || egg.nest === 2 ? 1 : -1
  const hops = rank % 3 === 1
  return {
    id,
    hideout: eggId,
    usesSlot: true,
    path: chickPath(eggId),
    peekIndex: 1,
    exitIndex: 2,
    hideFacing,
    spotFacing: place.facing,
    frontal: false,
    extent: CHICK_EXTENT,
    // [SPEC-8.5] [SPEC-14.2.1] Calm peek and walk; flees back into its egg in under a second.
    speed: { peek: 22, walk: 95, flee: 950 },
    peekPause: 1.5 + 0.1 * (rank % 4),
    gait: hops ? 'hop' : 'walk',
    strideLength: hops ? 44 : 36,
    bounce: hops ? 9 : 4.5,
    sleepCrouch: 0.85,
    grazeCrouch: 0.25,
    activities: ZONE_ACTIVITIES[place.zone],
  }
}

/** [SPEC-14.2] The twenty chicks of the brood. */
export const ANIMALS: Readonly<Record<AnimalId, CouvainAnimalSpec>> = Object.fromEntries(
  ANIMAL_IDS.map((id, rank) => [id, makeChick(id, rank)]),
) as Record<AnimalId, CouvainAnimalSpec>
