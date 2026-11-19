// [SPEC-16.2] The ten characters of « Hiver du silence »: their hideout, the path from the hideout to
// their place in the winter landscape, their size, their speeds and their small activities, as the
// shared animal model reads them (src/silence/animal.ts). Free of PixiJS.
//
// Positions are in world units (see layout.ts): `x, y` is the point between the feet, on the
// ground. A character drawn facing right has its head on the right. [SPEC-13.2.3] The robin flies:
// `x, y` is the ground point right under it, `height` lifts its feet above it.
import { pathLengths, type AnimalSpec, type Waypoint } from '../../silence/animal'
import { branchTopY, type HideoutId } from './layout'

/** [SPEC-9.4.1] [SPEC-16.2] [SPEC-16.2.2] From the least to the most timid: the order in which they
 *  come out. The robin comes right after the snowman, on whose hat it perches. */
export const ANIMAL_IDS = ['rabbit', 'squirrel', 'redFox', 'whiteFox', 'snowman', 'robin', 'elf', 'reindeer', 'owl', 'santa'] as const
export type AnimalId = (typeof ANIMAL_IDS)[number]

/** A character of the winter landscape and its hideout. */
export type HiverAnimalSpec = AnimalSpec<AnimalId, HideoutId>

/** [SPEC-16.2] The snowman's place and the height of the top of his hat above his feet: the robin
 *  perches there [SPEC-16.2.2]. */
export const SNOWMAN_PLACE = { x: 980, y: 1005 } as const
export const SNOWMAN_HAT_TOP = 222

/** [SPEC-13.2.4] How the robin beats its wings: slow and wide, like the bees. */
export const ROBIN_WINGS = { rate: 2.5, folded: 0, down: -0.5, up: 0.7 } as const

/** Ground point under the robin while it is in the Christmas tree: the foot of the tree, so that
 *  its depth is the tree's. */
const ROBIN_TREE_Y = 822

/** [SPEC-13.2.3] The robin's path: in the tree, its head out of the tree's left edge, clear of the
 *  tree (exit point: it changes layer there), then a flight to the snowman's hat and the landing. */
const ROBIN_PATH: readonly Waypoint[] = [
  { x: 1250, y: ROBIN_TREE_Y, crouch: 0, height: ROBIN_TREE_Y - 598 },
  { x: 1200, y: ROBIN_TREE_Y, crouch: 0, height: ROBIN_TREE_Y - 596 },
  { x: 1120, y: ROBIN_TREE_Y, crouch: 0, height: ROBIN_TREE_Y - 560 },
  { x: 1040, y: 920, crouch: 0, height: 920 - 640 },
  { x: SNOWMAN_PLACE.x, y: SNOWMAN_PLACE.y + 3, crouch: 0, height: SNOWMAN_PLACE.y + 3 - 700 },
  { x: SNOWMAN_PLACE.x, y: SNOWMAN_PLACE.y + 3, crouch: 0, height: SNOWMAN_HAT_TOP + 3 },
]
/** The weave starts at the peek point; its length is twice the way from there to the exit point,
 *  so that it is zero again at the exit and changing layer there shows no jump (as the bees). */
const ROBIN_WEAVE_LENGTH = 2 * (pathLengths(ROBIN_PATH)[2]! - pathLengths(ROBIN_PATH)[1]!)

const onBranch = (x: number): Waypoint => ({ x, y: branchTopY(x), crouch: 0 })

/** The fox drawing, shared by the red fox and the white fox. */
const FOX = {
  extent: { left: -132, right: 114, top: -152 },
  speed: { peek: 40, walk: 85, flee: 700 },
  peekPause: 1.8,
  gait: 'walk',
  strideLength: 90,
  bounce: 4,
  sleepCrouch: 1,
  grazeCrouch: 0.15,
  activities: { rest: 2, graze: 1, scratch: 2, sleep: 2, look: 2 },
} as const satisfies Partial<HiverAnimalSpec>

/**
 * [SPEC-16.2] Hideouts, paths and places. The characters settle on the snow of the middle of the
 * landscape, the white ones never in front of cream snow [SPEC-16.5.1], Santa on his doorstep and
 * not in front of the wall [SPEC-16.5.2]. `animal-data.test.ts` checks that a path never crosses a
 * still character's depth while overlapping it, so the drawing order never flips on screen.
 */
export const ANIMALS: Readonly<Record<AnimalId, HiverAnimalSpec>> = {
  // Lying behind the small drift; sits up, then hops out on the right.
  rabbit: {
    id: 'rabbit',
    hideout: 'drift',
    usesSlot: false,
    path: [
      { x: 618, y: 1058, crouch: 1 },
      { x: 620, y: 1005, crouch: 0 },
      { x: 790, y: 1010, crouch: 0 },
      { x: 830, y: 1010, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
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
  // Inside the trunk, below the hollow; peeks into the hollow, stands in it, then climbs down the
  // trunk to its foot.
  squirrel: {
    id: 'squirrel',
    hideout: 'hollow',
    usesSlot: true,
    path: [
      { x: 170, y: 793, crouch: 0 },
      { x: 170, y: 700, crouch: 0 },
      { x: 170, y: 622, crouch: 0 },
      { x: 170, y: 800, crouch: 0 },
      { x: 150, y: 838, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -66, right: 46, top: -146 },
    speed: { peek: 55, walk: 120, flee: 650 },
    peekPause: 1.4,
    gait: 'hop',
    strideLength: 70,
    bounce: 16,
    sleepCrouch: 0.5,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 3, scratch: 2, sleep: 1, look: 2 },
  },
  // Lying behind the bush; peeks out on its right, then comes out on the snow.
  redFox: {
    id: 'redFox',
    hideout: 'bush',
    usesSlot: false,
    path: [
      { x: 166, y: 1044, crouch: 1 },
      { x: 255, y: 1000, crouch: 0.3 },
      { x: 440, y: 950, crouch: 0 },
      { x: 450, y: 870, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    ...FOX,
  },
  // Behind the rock; peeks out under the slab, below the icicles, then comes out on the snow.
  whiteFox: {
    id: 'whiteFox',
    hideout: 'rock',
    usesSlot: true,
    path: [
      { x: 414, y: 842, crouch: 0 },
      { x: 495, y: 842, crouch: 0 },
      { x: 705, y: 852, crouch: 0 },
      { x: 720, y: 880, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    ...FOX,
  },
  // Behind the big drift; rises until his eyes show over it, then hops out on the left.
  snowman: {
    id: 'snowman',
    hideout: 'bigDrift',
    usesSlot: false,
    path: [
      { x: 1290, y: 1040, crouch: 0 },
      { x: 1270, y: 890, crouch: 0 },
      { x: 1110, y: 960, crouch: 0 },
      { x: 1040, y: 995, crouch: 0 },
      { x: SNOWMAN_PLACE.x, y: SNOWMAN_PLACE.y, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 3,
    hideFacing: -1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -75, right: 75, top: -SNOWMAN_HAT_TOP },
    speed: { peek: 45, walk: 80, flee: 600 },
    peekPause: 2,
    gait: 'hop',
    strideLength: 60,
    bounce: 10,
    // [SPEC-16.2.2] Never lower: the robin stays on his hat.
    sleepCrouch: 0,
    grazeCrouch: 0,
    activities: { rest: 3, graze: 1, scratch: 1, sleep: 2, look: 3 },
  },
  // In the Christmas tree; peeks out of its left edge, then flies onto the snowman's hat.
  robin: {
    id: 'robin',
    hideout: 'fir',
    usesSlot: true,
    path: ROBIN_PATH,
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -42, right: 40, top: -64 },
    speed: { peek: 40, walk: 120, flee: 1600 },
    peekPause: 1.6,
    gait: 'fly',
    flight: { wingRate: ROBIN_WINGS.rate, weave: 14, weaveLength: ROBIN_WEAVE_LENGTH, restBeat: 0, restRate: 0 },
    strideLength: 40,
    bounce: 4,
    sleepCrouch: 0.5,
    grazeCrouch: 0.4,
    activities: { rest: 2, graze: 2, scratch: 2, sleep: 1, look: 3 },
  },
  // Behind the Christmas tree; peeks out of its left edge, then stands beside it.
  elf: {
    id: 'elf',
    hideout: 'fir',
    usesSlot: true,
    path: [
      { x: 1235, y: 813, crouch: 0 },
      { x: 1150, y: 813, crouch: 0 },
      { x: 1030, y: 830, crouch: 0 },
      { x: 1075, y: 840, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -50, right: 52, top: -166 },
    speed: { peek: 40, walk: 90, flee: 650 },
    peekPause: 1.6,
    gait: 'walk',
    strideLength: 50,
    bounce: 6,
    sleepCrouch: 0.4,
    grazeCrouch: 0.2,
    activities: { rest: 2, graze: 2, scratch: 2, sleep: 1, look: 3 },
  },
  // Crouching behind the hill; stands up, its antlers and head over the top, walks over the crest
  // and down the hill.
  reindeer: {
    id: 'reindeer',
    hideout: 'hill',
    usesSlot: true,
    path: [
      { x: 512, y: 628, crouch: 1 },
      { x: 530, y: 560, crouch: 0 },
      { x: 570, y: 398, crouch: 0 },
      { x: 650, y: 560, crouch: 0 },
      { x: 690, y: 700, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -110, right: 128, top: -250 },
    speed: { peek: 35, walk: 75, flee: 750 },
    peekPause: 2,
    gait: 'walk',
    strideLength: 110,
    bounce: 4,
    sleepCrouch: 1,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 4, scratch: 1, sleep: 1, look: 2 },
  },
  // Behind the top of the trunk; peeks out on its right, then steps along the bare branch.
  owl: {
    id: 'owl',
    hideout: 'trunk',
    usesSlot: true,
    path: [{ x: 160, y: 408, crouch: 0 }, { x: 250, y: 402, crouch: 0 }, onBranch(352), onBranch(392)],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: true,
    extent: { left: -60, right: 60, top: -150 },
    speed: { peek: 40, walk: 60, flee: 520 },
    peekPause: 2,
    gait: 'hop',
    strideLength: 40,
    bounce: 12,
    sleepCrouch: 0.2,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 0, scratch: 2, sleep: 3, look: 3 },
  },
  // Inside the house, right of the door; into the doorway, then onto his doorstep.
  santa: {
    id: 'santa',
    hideout: 'house',
    usesSlot: true,
    path: [
      { x: 1100, y: 622, crouch: 0 },
      { x: 1010, y: 622, crouch: 0 },
      { x: 955, y: 622, crouch: 0 },
      { x: 955, y: 662, crouch: 0 },
      { x: 955, y: 710, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 3,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -62, right: 66, top: -215 },
    speed: { peek: 35, walk: 70, flee: 650 },
    peekPause: 2.2,
    gait: 'walk',
    strideLength: 60,
    bounce: 5,
    sleepCrouch: 0.2,
    grazeCrouch: 0.1,
    activities: { rest: 3, graze: 1, scratch: 2, sleep: 1, look: 3 },
  },
}
