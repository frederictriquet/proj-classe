// [SPEC-9.3] [SPEC-9.8] What an animal of an activity of silence is made of: its states, its small
// activities, its hideout, the path from the hideout to its place in the decor, its size and its
// speeds. Free of PixiJS: the calm logic [SPEC-9.4.5] and the tests read it. Each activity gives
// the specs of its own animals.
//
// Positions are in world units (see geometry.ts): `x, y` is the point between the feet, on the
// ground. An animal drawn facing right has its head on the right.
//
// [SPEC-13.2.3] An animal that flies (bees, butterflies) also has a height above the ground: `x, y`
// stays the point of the ground right under it, which sets its depth (drawing order) and its
// shadow; the drawing goes up by the height. Animals that walk or hop keep a height of zero.

/** [SPEC-9.3] Hidden; peeks out of its hideout; comes closer; settled in the decor; on alert
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
  /** [SPEC-13.2.3] Height of the feet above the ground point `x, y`, world units, zero or more.
   *  Zero when absent. */
  height?: number
}

/** [SPEC-13.2.4] [SPEC-8.5] Fastest wing beat allowed, beats per second: slow and wide, never a
 *  flicker. */
export const MAX_WING_RATE = 3

/** [SPEC-13.2.3] [SPEC-13.2.4] How an animal that flies moves its wings and weaves. */
export interface Flight {
  /** Wing beats per second while flying, at most `MAX_WING_RATE`. */
  wingRate: number
  /** Width of the side-to-side weaving while approaching, world units, on each side of the path.
   *  None while fleeing: the flight back is direct. */
  weave: number
  /** World units travelled per weave, there and back. */
  weaveLength: number
  /** [SPEC-13.2.2] Wing beat once settled (0: wings folded and still) and its rate, beats per
   *  second, at most `MAX_WING_RATE`: the butterflies open and close their wings slowly. */
  restBeat: number
  restRate: number
}

export interface AnimalSpec<Id extends string = string, Hideout extends string = string> {
  id: Id
  /** The hideout of the decor (see `Decor.slots` in decor.ts). */
  hideout: Hideout
  /**
   * True: while in its hideout the animal is drawn in the hideout's slot, right behind the shape
   * that hides it, and moves to the actors layer at `path[exitIndex]`. False for a hideout of the
   * foreground (the forest's bush), already in front of the actors layer: the animal stays there
   * and never changes layer.
   */
  usesSlot: boolean
  /** From the hiding place (`path[0]`) to the place in the decor (last point). */
  path: readonly Waypoint[]
  /** The animal peeks out of its hideout here. */
  peekIndex: number
  /** First point clear of the hideout's shape: the animal changes layer here. */
  exitIndex: number
  /** Facing while hidden and peeking: towards the open. */
  hideFacing: 1 | -1
  /** Facing once settled: towards the middle of the decor. */
  spotFacing: 1 | -1
  /** Seen from the front whatever its direction (the forest's owl): it never turns. */
  frontal: boolean
  extent: Extent
  /** World units per second along the path, in space for an animal that flies. Fleeing is fast
   *  [SPEC-8.5]: under a second back to the hideout. */
  speed: { peek: number; walk: number; flee: number }
  /** Seconds spent peeking before coming out. */
  peekPause: number
  /** Hops (in the forest: rabbit, squirrel, owl), walks or flies [SPEC-9.8] [SPEC-13.2.3]. */
  gait: 'hop' | 'walk' | 'fly'
  /** Wings and weaving of an animal that flies: required with `gait: 'fly'`, ignored otherwise. */
  flight?: Flight
  /** World units travelled per stride or per hop. */
  strideLength: number
  /** Height of a hop, or of the bob of a walk, or of the float of a flight, in world units. */
  bounce: number
  /** Crouch added while sleeping (lying down) and while grazing. */
  sleepCrouch: number
  grazeCrouch: number
  /** Relative weights of the activities once settled. */
  activities: Readonly<Record<Activity, number>>
}

/** Lengths along a path: `at[i]` is the distance from the hiding place to `path[i]`. Measured in
 *  space, height included [SPEC-13.2.3]: a flying animal that rises straight up still travels. */
export function pathLengths(path: readonly Waypoint[]): number[] {
  const at = [0]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const dh = (b.height ?? 0) - (a.height ?? 0)
    at.push(at[i - 1]! + (dh === 0 ? Math.hypot(b.x - a.x, b.y - a.y) : Math.hypot(b.x - a.x, b.y - a.y, dh)))
  }
  return at
}

/** Point of the path at distance `s` from the hiding place (see `pathLengths`), with the crouch
 *  and the height there and the direction of the segment on the ground (unit vector, towards the
 *  place in the decor; zero for a segment that only rises or falls). */
export function pointAt(path: readonly Waypoint[], lengths: readonly number[], s: number): Required<Waypoint> & { dx: number; dy: number } {
  const last = path.length - 1
  let i = 1
  while (i < last && lengths[i]! < s) i++
  const a = path[i - 1]!
  const b = path[i]!
  const length = lengths[i]! - lengths[i - 1]!
  const t = length > 0 ? Math.min(1, Math.max(0, (s - lengths[i - 1]!) / length)) : 0
  const ground = (a.height ?? 0) === (b.height ?? 0) ? length : Math.hypot(b.x - a.x, b.y - a.y)
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    crouch: a.crouch + (b.crouch - a.crouch) * t,
    height: (a.height ?? 0) + ((b.height ?? 0) - (a.height ?? 0)) * t,
    dx: ground > 0 ? (b.x - a.x) / ground : 0,
    dy: ground > 0 ? (b.y - a.y) / ground : 0,
  }
}
