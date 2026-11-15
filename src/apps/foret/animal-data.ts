// [SPEC-9.3] The six animals of « Forêt du silence »: their hideout, the path from the hideout to
// their place in the clearing, their size, their speeds and their small activities. Free of
// PixiJS: the calm logic [SPEC-9.4.5] and the tests read it.
//
// Positions are in world units (see layout.ts): `x, y` is the point between the feet, on the
// ground. An animal drawn facing right has its head on the right.
import { BRANCH, type HideoutId } from './layout'

/** [SPEC-9.4.1] From the least to the most timid: the order in which they come out. */
export const ANIMAL_IDS = ['squirrel', 'rabbit', 'hedgehog', 'owl', 'fox', 'fawn'] as const
export type AnimalId = (typeof ANIMAL_IDS)[number]

/** [SPEC-9.3] Hidden; peeks out of its hideout; comes closer; settled in the clearing; on alert
 *  (frozen); running back to its hideout. */
export const ANIMAL_STATES = ['hidden', 'peeking', 'approaching', 'settled', 'alert', 'fleeing'] as const
export type AnimalState = (typeof ANIMAL_STATES)[number]

/** [SPEC-9.3] Small activities of a settled animal. Blinking runs on its own, at any time. */
export const ACTIVITIES = ['rest', 'graze', 'scratch', 'sleep', 'look'] as const
export type Activity = (typeof ACTIVITIES)[number]

/** Extent of the drawing around the feet, facing right, standing: `left` and `top` are
 *  negative. Facing left swaps `left` and `right`. */
export interface Extent {
  left: number
  right: number
  top: number
}

export interface Waypoint {
  x: number
  y: number
  /** 0: standing; 1: lying or curled up, as low as the animal goes. */
  crouch: number
}

export interface AnimalSpec {
  id: AnimalId
  hideout: HideoutId
  /**
   * True: while in its hideout the animal is drawn in the hideout's slot, right behind the shape
   * that hides it, and moves to the actors layer at `path[exitIndex]`. False for the bush: the
   * bush is in the foreground, already in front of the actors layer, so the animal stays there
   * and never changes layer.
   */
  usesSlot: boolean
  /** From the hiding place (`path[0]`) to the place in the clearing (last point). */
  path: readonly Waypoint[]
  /** The animal peeks out of its hideout here. */
  peekIndex: number
  /** First point clear of the hideout's shape: the animal changes layer here. */
  exitIndex: number
  /** Facing while hidden and peeking: towards the clearing. */
  hideFacing: 1 | -1
  /** Facing once settled: towards the middle of the clearing. */
  spotFacing: 1 | -1
  /** Seen from the front whatever its direction (the owl): it never turns. */
  frontal: boolean
  extent: Extent
  /** World units per second. Fleeing is fast [SPEC-8.5]: under a second back to the hideout. */
  speed: { peek: number; walk: number; flee: number }
  /** Seconds spent peeking before coming out. */
  peekPause: number
  /** Hops (rabbit, squirrel, owl) or walks. */
  gait: 'hop' | 'walk'
  /** World units travelled per stride or per hop. */
  strideLength: number
  /** Height of a hop, or of the bob of a walk, in world units. */
  bounce: number
  /** Crouch added while sleeping (lying down) and while grazing. */
  sleepCrouch: number
  grazeCrouch: number
  /** Relative weights of the activities once settled. */
  activities: Readonly<Record<Activity, number>>
}

/** [SPEC-9.2] Top of the high branch at `x`: the curve drawn by `branchPath` in clearing.ts. */
export function branchTopY(x: number): number {
  const { from, to, baseThickness, tipThickness } = BRANCH
  const p0 = from.y - baseThickness / 2
  const p1 = (from.y + to.y) / 2 - baseThickness / 2 - 14
  const p2 = to.y - tipThickness / 2
  // The control point is halfway along x, so x is linear in t.
  const t = (from.x - x) / (from.x - to.x)
  return (1 - t) ** 2 * p0 + 2 * t * (1 - t) * p1 + t ** 2 * p2
}

const onBranch = (x: number): Waypoint => ({ x, y: branchTopY(x), crouch: 0 })

/**
 * [SPEC-9.3] Hideouts, paths and places. Two animals share the bush (the fawn lying, the
 * hedgehog), which is the largest hideout; they come out at different heights. The places keep
 * the six animals apart; `animal-data.test.ts` checks that a path never crosses a settled
 * animal's depth while overlapping it, so the drawing order never flips on screen.
 */
export const ANIMALS: Readonly<Record<AnimalId, AnimalSpec>> = {
  // Behind the trunk of the left tree; peeks out by the side of the trunk.
  squirrel: {
    id: 'squirrel',
    hideout: 'behindTree',
    usesSlot: true,
    path: [
      { x: 175, y: 690, crouch: 0.2 },
      { x: 258, y: 690, crouch: 0.1 },
      { x: 385, y: 702, crouch: 0 },
      { x: 470, y: 810, crouch: 0 },
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
  // In the burrow: rises out of the hole, hops over the rim, then down the mound.
  rabbit: {
    id: 'rabbit',
    hideout: 'burrow',
    usesSlot: true,
    path: [
      { x: 620, y: 935, crouch: 0 },
      { x: 620, y: 818, crouch: 0 },
      { x: 620, y: 716, crouch: 0 },
      { x: 680, y: 800, crouch: 0 },
      { x: 745, y: 865, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -54, right: 50, top: -156 },
    speed: { peek: 45, walk: 105, flee: 600 },
    peekPause: 1.6,
    gait: 'hop',
    strideLength: 80,
    bounce: 22,
    sleepCrouch: 0.5,
    grazeCrouch: 0.25,
    activities: { rest: 2, graze: 3, scratch: 2, sleep: 1, look: 1 },
  },
  // Low in the bush, behind the fawn: its snout comes out at the bottom right of the bush.
  hedgehog: {
    id: 'hedgehog',
    hideout: 'bush',
    usesSlot: false,
    path: [
      { x: 250, y: 1015, crouch: 0.3 },
      { x: 418, y: 1015, crouch: 0.15 },
      { x: 480, y: 1016, crouch: 0 },
      { x: 770, y: 1032, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -80, right: 92, top: -104 },
    speed: { peek: 35, walk: 60, flee: 420 },
    peekPause: 1.6,
    gait: 'walk',
    strideLength: 46,
    bounce: 3,
    sleepCrouch: 0.6,
    grazeCrouch: 0.1,
    activities: { rest: 2, graze: 3, scratch: 1, sleep: 2, look: 1 },
  },
  // In the leaves at the tip of the high branch; hops along the branch towards the trunk.
  owl: {
    id: 'owl',
    hideout: 'highBranch',
    usesSlot: true,
    path: [onBranch(800), onBranch(982), onBranch(1072), onBranch(1125)],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: true,
    extent: { left: -60, right: 60, top: -146 },
    speed: { peek: 40, walk: 60, flee: 520 },
    peekPause: 2,
    gait: 'hop',
    strideLength: 40,
    bounce: 12,
    sleepCrouch: 0.2,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 0, scratch: 2, sleep: 3, look: 3 },
  },
  // In the hollow log: shows its face in the opening, crawls out, then trots to its place.
  fox: {
    id: 'fox',
    hideout: 'hollowLog',
    usesSlot: true,
    path: [
      { x: 1245, y: 852, crouch: 0.4 },
      { x: 1162, y: 852, crouch: 0.45 },
      { x: 950, y: 856, crouch: 0.1 },
      { x: 925, y: 978, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: -1,
    spotFacing: -1,
    frontal: false,
    extent: { left: -132, right: 114, top: -152 },
    speed: { peek: 40, walk: 85, flee: 700 },
    peekPause: 1.8,
    gait: 'walk',
    strideLength: 90,
    bounce: 4,
    sleepCrouch: 1,
    grazeCrouch: 0.15,
    activities: { rest: 2, graze: 1, scratch: 2, sleep: 2, look: 2 },
  },
  // Lying in the bush; stands up, its head comes out over the bush, then it steps out.
  fawn: {
    id: 'fawn',
    hideout: 'bush',
    usesSlot: false,
    path: [
      { x: 215, y: 1022, crouch: 1 },
      { x: 352, y: 1022, crouch: 0.45 },
      { x: 470, y: 1026, crouch: 0 },
      { x: 590, y: 1050, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -96, right: 112, top: -262 },
    speed: { peek: 40, walk: 75, flee: 750 },
    peekPause: 2,
    gait: 'walk',
    strideLength: 110,
    bounce: 4,
    sleepCrouch: 1,
    grazeCrouch: 0,
    activities: { rest: 2, graze: 4, scratch: 1, sleep: 1, look: 2 },
  },
}

/** Lengths along a path: `at[i]` is the distance from the hiding place to `path[i]`. */
export function pathLengths(path: readonly Waypoint[]): number[] {
  const at = [0]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    at.push(at[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y))
  }
  return at
}

/** Point of the path at distance `s` from the hiding place, with the crouch there and the
 *  direction of the segment (unit vector, towards the place in the clearing). */
export function pointAt(path: readonly Waypoint[], lengths: readonly number[], s: number): Waypoint & { dx: number; dy: number } {
  const last = path.length - 1
  let i = 1
  while (i < last && lengths[i]! < s) i++
  const a = path[i - 1]!
  const b = path[i]!
  const length = lengths[i]! - lengths[i - 1]!
  const t = length > 0 ? Math.min(1, Math.max(0, (s - lengths[i - 1]!) / length)) : 0
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    crouch: a.crouch + (b.crouch - a.crouch) * t,
    dx: length > 0 ? (b.x - a.x) / length : 0,
    dy: length > 0 ? (b.y - a.y) / length : 0,
  }
}
