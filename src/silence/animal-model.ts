// [SPEC-9.3] [SPEC-8.5] [SPEC-9.8] Behaviour of one animal, free of PixiJS: the state it is in, where it is
// on its path, and the pose of its pieces. Every value changes continuously: positions move at a
// bounded speed, pose values ease towards their target, turning round goes through a side view
// of zero width. Only fleeing is fast.
//
// Common interface [SPEC-9.3]: `setTarget(state)` says what the animal should do, `step(dt)`
// advances it by `dt` seconds. Any target is accepted in any state:
// - `hidden` or `fleeing`: an animal out of its hideout runs back to it, from where it is.
// - `alert`: an animal out of its hideout freezes where it is; a hidden one stays hidden.
// - `peeking`: comes to the edge of its hideout and stays there.
// - `approaching` or `settled`: peeks, waits a moment, comes out, settles at its place.
// A flight always goes back to the hideout before the animal can come out again.
//
// [SPEC-13.2.3] An animal that flies (`gait: 'fly'`) follows the height of its path. It is in the
// air between its peek point and its place: wings beating [SPEC-13.2.4], legs still, floating
// gently, weaving from side to side while approaching and flying straight back when fleeing. On
// alert in the air it hovers, wings still beating; perched (in its hideout, peeking, settled) its
// wings fold and stop, except the slow beat of a settled butterfly [SPEC-13.2.2], and on alert it
// freezes, wings included.
import {
  ACTIVITIES,
  MAX_WING_RATE,
  pathLengths,
  pointAt,
  type Activity,
  type AnimalSpec,
  type AnimalState,
  type Flight,
} from './animal'
import { seededRandom } from './random'

/** Values the drawing applies to the pieces of an animal. */
export interface Pose {
  /** Feet position on the ground, world units: sets the depth and the shadow. */
  x: number
  y: number
  /** [SPEC-13.2.3] Height of the feet above the ground point, world units: the drawing goes up by
   *  it. Always 0 for an animal that walks or hops. */
  height: number
  /** -1 facing left, 1 facing right; between the two while turning round. */
  facing: number
  /** Height of the body above the feet during a hop or a stride, world units (negative: up). */
  bob: number
  /** 0 standing, 1 lying or curled up. */
  crouch: number
  /** Forward lean of the body, radians. */
  lean: number
  /** Scale of the body for breathing, around 1. */
  breath: number
  /** Head lowered (positive, towards the ground) or raised (negative), radians. */
  headPitch: number
  /** Where the eyes look: -1 backwards, 0 at the children, 1 forwards. */
  look: number
  /** Ears: -1 flat back, 0 relaxed, 1 pricked up. */
  ears: number
  /** 0 closed, 1 open. */
  eyeOpen: number
  /** 0 normal, 1 wide open. */
  eyeWide: number
  /** Phase of the legs, radians. */
  gait: number
  /** Swing of the legs, 0 standing still. */
  stride: number
  /** Swing of the tail, radians. */
  tail: number
  /** Scratching: amplitude 0 to 1 and phase. */
  scratch: number
  scratchPhase: number
  /** Chewing nod of the head, radians. */
  chew: number
  /** Opacity of the shadow on the ground: 0 inside the hideout, 1 in the open. */
  shadow: number
  /** [SPEC-13.2.3] Size of the shadow on the ground, also applied to its opacity: 1 on the ground,
   *  smaller and paler as the animal goes up. */
  shadowScale: number
  /** [SPEC-13.2.4] Phase of the wing beat, radians, and its amplitude: 0 wings folded, 1 full
   *  beat. Always 0 for an animal that walks or hops. */
  wingPhase: number
  wingBeat: number
}

/** Seconds an animal stays hidden after a flight. */
export const RECOVER_TIME = 1.5
/** [SPEC-13.2.3] Height, world units, at which the shadow of a flying animal is half its size. */
export const SHADOW_HALF_HEIGHT = 250
/** [SPEC-13.2.3] Floats per second of an animal in the air: slow [SPEC-8.5]. */
const FLOAT_RATE = 0.6
/** Easing rate of the wing beat amplitude, per second; below `WING_STILL` the wings, and the
 *  float, of a perched animal stop. */
const WING_RATE = 4
const WING_STILL = 0.002
/** Seconds of a blink. */
export const BLINK_TIME = 0.24
/** Seconds to turn round at a calm pace, and when fleeing. */
export const TURN_TIME = { calm: 0.45, flee: 0.15 } as const
/** Seconds to reach full speed at a calm pace, and when fleeing or freezing. */
const ACCEL_TIME = { calm: 0.45, flee: 0.12, freeze: 0.15 } as const
/** Pose easing rates, per second: higher is faster. */
const RATE = { calm: 3, sleep: 1.1, alert: 9, flee: 12 } as const
/** Duration ranges of the activities, seconds. */
const ACTIVITY_TIME: Record<Activity, [number, number]> = {
  rest: [2, 4.5],
  graze: [4, 7],
  scratch: [1.8, 2.6],
  sleep: [7, 11],
  look: [3, 5],
}

/** Moves `value` towards `target` with an exponential ease. */
function ease(value: number, target: number, rate: number, dt: number): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt))
}

/** Moves `value` towards `target` by at most `step`. */
function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface Eased {
  crouch: number
  lean: number
  headPitch: number
  look: number
  ears: number
  eyeOpen: number
  eyeWide: number
  tailSwing: number
  scratch: number
  chew: number
  breathDepth: number
}

export class AnimalModel {
  readonly spec: AnimalSpec
  private readonly lengths: number[]
  /** Distances along the path of the peek point, the exit point and the place. */
  readonly sPeek: number
  readonly sExit: number
  readonly sSpot: number

  private target: AnimalState = 'hidden'
  private current: AnimalState = 'hidden'
  /** Distance along the path, and speed along it (positive: outwards). */
  private s = 0
  private v = 0
  private facing: number
  private peekWaited = 0
  private recover = 0
  private activity: Activity = 'rest'
  private activityLeft = 0
  private time = 0
  private gait = 0
  private stride = 0
  private tailPhase = 0
  private breathPhase = 0
  private scratchPhase = 0
  private chewPhase = 0
  /** [SPEC-13.2.3] Flying only: share of the float (0 perched, 1 in the air), share of the weave,
   *  float phase, wing beat phase, amplitude and rate. */
  private readonly flight: Flight | undefined
  private floatShare = 0
  private weaveShare = 0
  private floatPhase = 0
  private wingPhase = 0
  private wingBeat = 0
  private wingRate = 0
  /** Unit vector on the ground from the peek point to the place: the weave goes across it. */
  private readonly across: { dx: number; dy: number }
  private nextBlink: number
  /** Time since the start of the current blink, or -1. */
  private blinkTime = -1
  private readonly eased: Eased
  private readonly random: () => number
  readonly pose: Pose

  constructor(spec: AnimalSpec, seed = 1) {
    this.spec = spec
    this.lengths = pathLengths(spec.path)
    this.sPeek = this.lengths[spec.peekIndex]!
    this.sExit = this.lengths[spec.exitIndex]!
    this.sSpot = this.lengths[this.lengths.length - 1]!
    this.random = seededRandom(seed)
    this.facing = spec.frontal ? 1 : spec.hideFacing
    this.nextBlink = 1 + 3 * this.random()
    if (spec.gait === 'fly' && !spec.flight) throw new Error(`« ${spec.id} » vole sans réglages de vol`)
    this.flight = spec.gait === 'fly' ? spec.flight : undefined
    if (this.flight && Math.max(this.flight.wingRate, this.flight.restRate) > MAX_WING_RATE)
      throw new Error(`« ${spec.id} » bat des ailes plus de ${MAX_WING_RATE} fois par seconde`)
    // Taken from the seed, not from `random`, so that animals that walk keep the same draws.
    this.floatPhase = seed * 2.399
    const peek = spec.path[spec.peekIndex]!
    const spot = spec.path[spec.path.length - 1]!
    const run = Math.hypot(spot.x - peek.x, spot.y - peek.y)
    this.across = run > 0 ? { dx: (spot.x - peek.x) / run, dy: (spot.y - peek.y) / run } : { dx: 1, dy: 0 }
    const start = pointAt(spec.path, this.lengths, 0)
    this.eased = {
      crouch: start.crouch,
      lean: 0,
      headPitch: 0,
      look: 0,
      ears: 0,
      eyeOpen: 1,
      eyeWide: 0,
      tailSwing: 0.08,
      scratch: 0,
      chew: 0,
      breathDepth: 0.02,
    }
    this.pose = {
      x: start.x,
      y: start.y,
      height: start.height,
      facing: this.facing,
      bob: 0,
      crouch: start.crouch,
      lean: 0,
      breath: 1,
      headPitch: 0,
      look: 0,
      ears: 0,
      eyeOpen: 1,
      eyeWide: 0,
      gait: 0,
      stride: 0,
      tail: 0,
      scratch: 0,
      scratchPhase: 0,
      chew: 0,
      shadow: 0,
      shadowScale: 1 / (1 + start.height / SHADOW_HALF_HEIGHT),
      wingPhase: 0,
      wingBeat: 0,
    }
  }

  get state(): AnimalState {
    return this.current
  }

  get targetState(): AnimalState {
    return this.target
  }

  get currentActivity(): Activity {
    return this.activity
  }

  /** Distance along the path, from the hiding place. */
  get distance(): number {
    return this.s
  }

  /** True while the animal is inside its hideout's shape (before the exit point). */
  get inHideout(): boolean {
    return this.s < this.sExit
  }

  setTarget(state: AnimalState): void {
    this.target = state
  }

  /** Development gallery: starts an activity now, if the animal is settled. */
  forceActivity(activity: Activity, seconds = 9): void {
    if (this.current !== 'settled') return
    this.activity = activity
    this.activityLeft = seconds
  }

  /** Development gallery: starts a blink now. */
  forceBlink(): void {
    if (this.blinkTime < 0) this.blinkTime = 0
  }

  step(dt: number): void {
    if (!(dt > 0)) return
    this.time += dt
    this.recover = Math.max(0, this.recover - dt)
    this.decide(dt)
    this.move(dt)
    if (this.current === 'fleeing' && this.s <= 0) {
      this.current = 'hidden'
      this.recover = RECOVER_TIME
      this.peekWaited = 0
    }
    this.updateActivity(dt)
    this.updatePose(dt)
  }

  /** Chooses the current state from the target and where the animal is. */
  private decide(dt: number): void {
    const { target, s } = this
    if (this.current === 'fleeing') return // a flight always ends in the hideout
    if (target === 'hidden' || target === 'fleeing') {
      this.current = s > 0 ? 'fleeing' : 'hidden'
      return
    }
    if (target === 'alert') {
      this.current = s > 0 ? 'alert' : 'hidden'
      return
    }
    if (s <= 0 && this.recover > 0) {
      this.current = 'hidden'
      return
    }
    if (target === 'peeking') {
      this.current = s <= this.sPeek ? 'peeking' : 'approaching'
      return
    }
    // Out: peek, wait, come out, settle.
    if (s < this.sPeek) {
      this.current = 'peeking'
    } else if (s >= this.sSpot) {
      this.current = 'settled'
    } else if (s === this.sPeek && this.peekWaited < this.spec.peekPause) {
      this.current = 'peeking'
      if (this.v === 0) this.peekWaited += dt
    } else {
      this.current = 'approaching'
    }
  }

  /** Moves along the path towards the goal of the current state, with eased speed. */
  private move(dt: number): void {
    const { speed } = this.spec
    let goal = this.s
    let maxSpeed = speed.walk
    let accelTime: number = ACCEL_TIME.calm
    switch (this.current) {
      case 'hidden':
        goal = 0
        break
      case 'peeking':
        goal = this.sPeek
        maxSpeed = speed.peek
        break
      case 'approaching':
        goal = this.target === 'peeking' ? this.sPeek : this.sSpot
        break
      case 'settled':
        goal = this.sSpot
        break
      case 'alert':
        accelTime = ACCEL_TIME.freeze
        break
      case 'fleeing':
        goal = 0
        maxSpeed = speed.flee
        accelTime = ACCEL_TIME.flee
        break
    }
    // Acceleration such that full walking (or fleeing) speed takes `accelTime`.
    const accel = (this.current === 'alert' ? speed.walk : maxSpeed) / accelTime
    const distance = goal - this.s
    let wanted = 0
    if (this.current !== 'alert' && Math.abs(distance) > 1e-6) {
      // Slows down so as to stop on the goal.
      wanted = Math.sign(distance) * Math.min(maxSpeed, Math.sqrt(2 * accel * Math.abs(distance)))
    }
    this.v = approach(this.v, wanted, accel * dt)
    const before = this.s
    this.s = clamp(this.s + this.v * dt, 0, this.sSpot)
    // Stops on the goal instead of overshooting it.
    if (this.current !== 'alert' && (before - goal) * (this.s - goal) <= 0 && before !== goal) {
      this.s = goal
      this.v = 0
    }
    if ((this.s === 0 && this.v < 0) || (this.s === this.sSpot && this.v > 0)) this.v = 0
  }

  private updateActivity(dt: number): void {
    if (this.current !== 'settled') {
      this.activity = 'rest'
      this.activityLeft = ACTIVITY_TIME.rest[0]
      return
    }
    this.activityLeft -= dt
    if (this.activityLeft > 0) return
    // Weighted draw of the next activity; sleep never follows sleep.
    const weights = ACTIVITIES.map((a) => (a === 'sleep' && this.activity === 'sleep' ? 0 : this.spec.activities[a]))
    let pick = this.random() * weights.reduce((sum, w) => sum + w, 0)
    let next: Activity = 'rest'
    for (const [i, a] of ACTIVITIES.entries()) {
      pick -= weights[i]!
      if (pick < 0) {
        next = a
        break
      }
    }
    const [min, max] = ACTIVITY_TIME[next]
    this.activity = next
    this.activityLeft = min + (max - min) * this.random()
  }

  private updatePose(dt: number): void {
    const { spec, pose, eased } = this
    const here = pointAt(spec.path, this.lengths, this.s)
    const state = this.current
    const fleeing = state === 'fleeing'

    // Targets of the eased values.
    const t: Eased = {
      crouch: here.crouch,
      lean: 0,
      headPitch: 0,
      look: 0,
      ears: 0,
      eyeOpen: 1,
      eyeWide: 0,
      tailSwing: 0.08,
      scratch: 0,
      chew: 0,
      breathDepth: 0.02,
    }
    let rate: number = RATE.calm
    switch (state) {
      case 'peeking':
        // Cautious: ears up, eyes wide, looking around.
        t.ears = 0.6
        t.eyeWide = 0.45
        t.look = 0.7 * Math.sin(this.time * 1.1)
        t.headPitch = -0.05
        break
      case 'approaching':
        t.ears = 0.3
        t.eyeWide = 0.15
        t.look = 0.5
        break
      case 'settled':
        switch (this.activity) {
          case 'graze':
            t.headPitch = 0.55
            t.chew = 1
            t.crouch += spec.grazeCrouch
            break
          case 'scratch':
            t.scratch = 1
            t.headPitch = 0.22
            t.eyeOpen = 0.45
            break
          case 'sleep':
            t.eyeOpen = 0
            t.headPitch = 0.3
            t.ears = -0.5
            t.crouch += spec.sleepCrouch
            t.tailSwing = 0
            t.breathDepth = 0.04
            rate = RATE.sleep
            break
          case 'look':
            t.look = Math.sin(this.time * 0.9)
            t.ears = 0.4
            break
          case 'rest':
            break
        }
        break
      case 'alert':
        // Frozen: ears pricked, eyes wide open, head up, holding its breath.
        t.ears = 1
        t.eyeWide = 1
        t.headPitch = -0.12
        t.tailSwing = 0
        t.breathDepth = 0.004
        t.crouch = Math.min(t.crouch, here.crouch + 0.2)
        rate = RATE.alert
        break
      case 'fleeing':
        t.ears = -1
        t.eyeWide = 0.6
        t.lean = 0.12
        t.tailSwing = 0.25
        t.crouch += 0.15
        t.look = 1
        rate = RATE.flee
        break
      case 'hidden':
        break
    }
    t.crouch = clamp(t.crouch, 0, 1)
    for (const key of Object.keys(eased) as (keyof Eased)[]) eased[key] = ease(eased[key], t[key], rate, dt)

    // Legs: the phase follows the distance travelled; the swing follows the speed.
    const speed = Math.abs(this.v)
    let bob: number
    let height = here.height
    let x = here.x
    if (this.flight) {
      // [SPEC-13.2.3] Legs still in the air; the animal floats and weaves instead.
      ;({ bob, height, x } = this.fly(dt, here, rate))
    } else {
      // Running, the strides get longer rather than faster: no flickering legs [SPEC-8.5].
      const strideLength = spec.strideLength * (1 + 0.5 * Math.max(0, speed / spec.speed.walk - 1))
      this.gait += ((speed * dt) / strideLength) * 2 * Math.PI
      this.stride = ease(this.stride, Math.min(1.3, speed / spec.speed.walk), 10, dt)
      bob =
        spec.gait === 'hop'
          ? -spec.bounce * this.stride * Math.abs(Math.sin(this.gait / 2))
          : -spec.bounce * this.stride * Math.abs(Math.sin(this.gait))
    }

    // Facing: the direction of travel; at rest, towards the open.
    if (!spec.frontal) {
      let wanted = Math.sign(this.facing) || 1
      if (state === 'alert') {
        // Frozen: no turning.
      } else if (speed > 5 && Math.abs(here.dx) > 0.25) {
        wanted = Math.sign(here.dx * this.v)
      } else if (speed <= 5 && state === 'settled') {
        wanted = spec.spotFacing
      } else if (speed <= 5 && (state === 'hidden' || state === 'peeking')) {
        wanted = spec.hideFacing
      }
      const turnTime = fleeing ? TURN_TIME.flee : TURN_TIME.calm
      this.facing = approach(this.facing, wanted, (2 / turnTime) * dt)
    }

    // Blinks: not while asleep, frozen or fleeing, but one that has started ends.
    const canBlink = state !== 'alert' && state !== 'fleeing' && !(state === 'settled' && this.activity === 'sleep')
    if (this.blinkTime >= 0) {
      this.blinkTime += dt
      if (this.blinkTime >= BLINK_TIME) {
        this.blinkTime = -1
        this.nextBlink = 2.5 + 4 * this.random()
      }
    } else if (canBlink) {
      this.nextBlink -= dt
      if (this.nextBlink <= 0) this.blinkTime = 0
    }
    const blink = this.blinkTime >= 0 ? 1 - Math.sin((Math.PI * this.blinkTime) / BLINK_TIME) : 1

    const tailSpeed = fleeing ? 3 : 1 / 2.8
    this.tailPhase += dt * 2 * Math.PI * tailSpeed
    this.breathPhase += (dt * 2 * Math.PI) / (this.activity === 'sleep' && state === 'settled' ? 4.5 : 3)
    this.scratchPhase += dt * 2 * Math.PI * 3
    this.chewPhase += dt * 2 * Math.PI * 1.6

    pose.x = x
    pose.y = here.y
    pose.height = height
    pose.facing = this.facing
    pose.bob = bob
    pose.crouch = eased.crouch
    pose.lean = eased.lean
    pose.breath = 1 + eased.breathDepth * Math.sin(this.breathPhase)
    pose.headPitch = eased.headPitch
    pose.look = eased.look
    pose.ears = eased.ears
    pose.eyeOpen = eased.eyeOpen * blink
    pose.eyeWide = eased.eyeWide
    pose.gait = this.gait
    pose.stride = this.stride
    pose.tail = eased.tailSwing * Math.sin(this.tailPhase)
    pose.scratch = eased.scratch
    pose.scratchPhase = this.scratchPhase
    pose.chew = 0.06 * eased.chew * Math.sin(this.chewPhase)
    // Flying animals flee faster [SPEC-13.2.3]: their shadow fades over a longer way, so that it
    // does not flick on or off.
    pose.shadow = clamp((this.s - this.sExit) / (this.flight ? 120 : 40), 0, 1)
    pose.shadowScale = 1 / (1 + height / SHADOW_HALF_HEIGHT)
    pose.wingPhase = this.wingPhase
    pose.wingBeat = this.wingBeat
  }

  /** [SPEC-13.2.3] [SPEC-13.2.4] Float, weave and wings of an animal that flies: the offset of its
   *  drawing, its height and its position across the path. */
  private fly(dt: number, here: ReturnType<typeof pointAt>, rate: number): { bob: number; height: number; x: number } {
    const flight = this.flight!
    const { spec, s, sPeek, sSpot } = this
    const state = this.current
    const inAir = s > sPeek && s < sSpot
    const frozen = state === 'alert' && !inAir

    this.floatShare = ease(this.floatShare, inAir ? 1 : 0, RATE.calm, dt)
    if (!inAir && this.floatShare < WING_STILL) this.floatShare = 0
    this.floatPhase += dt * 2 * Math.PI * FLOAT_RATE
    // Hovering on alert keeps the weave where it is: no drift while frozen in the air. Perched,
    // the weave is zero anyway (see below): a flight from there is straight from the start.
    if (!inAir) this.weaveShare = 0
    else if (state !== 'alert') this.weaveShare = ease(this.weaveShare, state === 'approaching' ? 1 : 0, rate, dt)

    if (!frozen) {
      const posed = state === 'settled' && s === sSpot
      const beat = inAir ? 1 : posed ? flight.restBeat : 0
      this.wingRate = ease(this.wingRate, inAir ? flight.wingRate : flight.restRate, WING_RATE, dt)
      this.wingBeat = ease(this.wingBeat, beat, WING_RATE, dt)
      if (beat === 0 && this.wingBeat < WING_STILL) this.wingBeat = 0
      if (this.wingBeat > 0) this.wingPhase += dt * 2 * Math.PI * this.wingRate
    }
    this.stride = 0

    // The weave is zero at the peek point and at the place, so that the animal leaves and lands
    // exactly there; it goes across the line between them, on the screen.
    const along = sSpot > sPeek ? clamp((s - sPeek) / (sSpot - sPeek), 0, 1) : 0
    const weave = this.weaveShare * flight.weave * Math.sin(Math.PI * along) * Math.sin((2 * Math.PI * (s - sPeek)) / flight.weaveLength)
    return {
      bob: -spec.bounce * this.floatShare * (0.5 + 0.5 * Math.sin(this.floatPhase)),
      height: Math.max(0, here.height - weave * this.across.dx),
      x: here.x - weave * this.across.dy,
    }
  }
}
