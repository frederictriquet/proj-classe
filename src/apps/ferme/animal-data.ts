// [SPEC-12.2] The eight animals of « Ferme du silence »: their hideout, the path from the hideout
// to their place in the farmyard, their size, their speeds and their small activities, as the
// shared animal model reads them (src/silence/animal.ts). Free of PixiJS.
//
// Positions are in world units (see layout.ts): `x, y` is the point between the feet, on the
// ground. An animal drawn facing right has its head on the right.
import type { AnimalSpec, Waypoint } from '../../silence/animal'
import { HENHOUSE, type HideoutId } from './layout'

/** [SPEC-9.4.1] [SPEC-12.2] From the least to the most timid: the order in which they come out. */
export const ANIMAL_IDS = ['hen', 'horse', 'rabbit', 'sheep', 'pig', 'cow', 'duck', 'goat'] as const
export type AnimalId = (typeof ANIMAL_IDS)[number]

/** A farm animal and its hideout in the farmyard. */
export type FermeAnimalSpec = AnimalSpec<AnimalId, HideoutId>

/** [SPEC-12.2] Point of the henhouse ramp at `x`: the hen walks down the plank. */
export function rampY(x: number): number {
  const { from, to } = HENHOUSE.ramp
  return from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x)
}

const onRamp = (x: number): Waypoint => ({ x, y: rampY(x), crouch: 0 })

/**
 * [SPEC-12.2] [SPEC-12.3] Hideouts, paths and places. The horse and the cow share the barn and
 * settle at the back of the yard, in front of it, so that they never hide the small animals; the
 * sheep and the goat share the haystack, the goat ending up on top of it. The pig settles on the
 * mud, the duck on the pond. `animal-data.test.ts` checks that a path never crosses a settled
 * animal's depth while overlapping it, so the drawing order never flips on screen.
 */
export const ANIMALS: Readonly<Record<AnimalId, FermeAnimalSpec>> = {
  // Inside the henhouse, right of the door; out by the door, down the ramp.
  hen: {
    id: 'hen',
    hideout: 'henhouse',
    usesSlot: true,
    path: [{ x: 1106, y: 450, crouch: 0 }, { x: 1066, y: 450, crouch: 0 }, { x: 1012, y: 452, crouch: 0 }, onRamp(930), onRamp(858), { x: 935, y: 715, crouch: 0 }],
    peekIndex: 1,
    exitIndex: 3,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -50, right: 52, top: -104 },
    speed: { peek: 35, walk: 80, flee: 700 },
    peekPause: 1.2,
    gait: 'walk',
    strideLength: 50,
    bounce: 6,
    sleepCrouch: 0.7,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 4, scratch: 2, sleep: 1, look: 2 },
  },
  // Inside the barn, left of the door: into the doorway, out towards the children, then to the
  // back of the yard on the right, facing the yard like the cow.
  horse: {
    id: 'horse',
    hideout: 'barn',
    usesSlot: true,
    path: [
      { x: 150, y: 650, crouch: 0 },
      { x: 330, y: 650, crouch: 0 },
      { x: 445, y: 650, crouch: 0 },
      { x: 445, y: 745, crouch: 0 },
      { x: 725, y: 700, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 3,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -124, right: 138, top: -257 },
    speed: { peek: 40, walk: 85, flee: 800 },
    peekPause: 1.8,
    gait: 'walk',
    strideLength: 120,
    bounce: 5,
    sleepCrouch: 0.5,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 4, scratch: 1, sleep: 1, look: 2 },
  },
  // Lying behind the big cabbage; sits up, then hops out over the garden into the yard.
  rabbit: {
    id: 'rabbit',
    hideout: 'garden',
    usesSlot: false,
    path: [
      { x: 795, y: 1048, crouch: 1 },
      { x: 795, y: 1030, crouch: 0 },
      { x: 785, y: 960, crouch: 0 },
      { x: 760, y: 878, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -50, right: 44, top: -171 },
    speed: { peek: 40, walk: 110, flee: 650 },
    peekPause: 1.4,
    gait: 'hop',
    strideLength: 70,
    bounce: 18,
    sleepCrouch: 0.6,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 4, scratch: 2, sleep: 1, look: 2 },
  },
  // Behind the haystack, low on the left; out by its right side.
  sheep: {
    id: 'sheep',
    hideout: 'haystack',
    usesSlot: false,
    path: [
      { x: 185, y: 1046, crouch: 0 },
      { x: 362, y: 1046, crouch: 0 },
      { x: 440, y: 1000, crouch: 0 },
      { x: 480, y: 900, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -79, right: 83, top: -117 },
    speed: { peek: 35, walk: 70, flee: 600 },
    peekPause: 1.6,
    gait: 'walk',
    strideLength: 70,
    bounce: 5,
    sleepCrouch: 0.8,
    grazeCrouch: 0.1,
    activities: { rest: 2, graze: 5, scratch: 1, sleep: 1, look: 1 },
  },
  // Behind the fence of the pigsty; out by its left end, onto the mud.
  pig: {
    id: 'pig',
    hideout: 'sty',
    usesSlot: true,
    path: [
      { x: 1325, y: 696, crouch: 0 },
      { x: 1210, y: 696, crouch: 0 },
      { x: 1080, y: 760, crouch: 0 },
      { x: 1045, y: 812, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -92, right: 101, top: -104 },
    speed: { peek: 35, walk: 70, flee: 600 },
    peekPause: 1.6,
    gait: 'walk',
    strideLength: 60,
    bounce: 4,
    sleepCrouch: 0.9,
    grazeCrouch: 0.1,
    activities: { rest: 2, graze: 4, scratch: 2, sleep: 2, look: 1 },
  },
  // Inside the barn, like the horse; settles right in front of the door.
  cow: {
    id: 'cow',
    hideout: 'barn',
    usesSlot: true,
    path: [
      { x: 150, y: 650, crouch: 0 },
      { x: 330, y: 650, crouch: 0 },
      { x: 445, y: 650, crouch: 0 },
      { x: 445, y: 745, crouch: 0 },
      { x: 440, y: 757, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 3,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -125, right: 147, top: -214 },
    speed: { peek: 35, walk: 70, flee: 800 },
    peekPause: 2,
    gait: 'walk',
    strideLength: 115,
    bounce: 4,
    sleepCrouch: 0.9,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 5, scratch: 1, sleep: 1, look: 1 },
  },
  // Behind the reeds; out by their left side, onto the pond.
  duck: {
    id: 'duck',
    hideout: 'reeds',
    usesSlot: false,
    path: [
      { x: 1366, y: 1046, crouch: 0 },
      { x: 1300, y: 1040, crouch: 0 },
      { x: 1235, y: 1012, crouch: 0 },
      { x: 1110, y: 1000, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -52, right: 62, top: -96 },
    speed: { peek: 35, walk: 70, flee: 600 },
    peekPause: 1.5,
    gait: 'walk',
    strideLength: 40,
    bounce: 4,
    sleepCrouch: 0.5,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 3, scratch: 2, sleep: 1, look: 2 },
  },
  // Behind the haystack; pokes its head over the top, then climbs up and stays there.
  goat: {
    id: 'goat',
    hideout: 'haystack',
    usesSlot: false,
    path: [
      { x: 250, y: 985, crouch: 0.2 },
      { x: 236, y: 880, crouch: 0 },
      { x: 222, y: 832, crouch: 0 },
      { x: 205, y: 798, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -71, right: 82, top: -176 },
    speed: { peek: 30, walk: 60, flee: 500 },
    peekPause: 2.2,
    gait: 'hop',
    strideLength: 60,
    bounce: 12,
    sleepCrouch: 0.6,
    grazeCrouch: 0.1,
    activities: { rest: 2, graze: 3, scratch: 1, sleep: 1, look: 3 },
  },
}
