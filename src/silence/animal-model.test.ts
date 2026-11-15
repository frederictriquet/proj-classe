// [SPEC-13.2.3] [SPEC-13.2.4] [SPEC-8.5] The shared animal model with an animal that flies,
// described here: a bee-like animal that leaves a hive hole high up, flies over the meadow and
// lands on a flower. The animals of each activity have their own tests next to their data.
import { describe, expect, it } from 'vitest'
import { ANIMAL_STATES, MAX_WING_RATE, pathLengths, pointAt, type AnimalSpec } from './animal'
import { AnimalModel, SHADOW_HALF_HEIGHT, TURN_TIME, type Pose } from './animal-model'
import { seededRandom } from './random'

const DT = 1 / 60

const FLYER: AnimalSpec = {
  id: 'flyer',
  hideout: 'hive',
  usesSlot: true,
  path: [
    { x: 200, y: 700, crouch: 0, height: 250 },
    { x: 230, y: 700, crouch: 0, height: 250 },
    { x: 260, y: 700, crouch: 0, height: 250 },
    { x: 500, y: 800, crouch: 0, height: 350 },
    { x: 800, y: 900, crouch: 0, height: 60 },
  ],
  peekIndex: 1,
  exitIndex: 2,
  hideFacing: 1,
  spotFacing: -1,
  frontal: false,
  extent: { left: -40, right: 40, top: -80 },
  speed: { peek: 40, walk: 160, flee: 1100 },
  peekPause: 1,
  gait: 'fly',
  flight: { wingRate: 2.5, weave: 25, weaveLength: 160, restBeat: 0, restRate: 0.5 },
  strideLength: 40,
  bounce: 8,
  sleepCrouch: 0.2,
  grazeCrouch: 0.1,
  activities: { rest: 2, graze: 3, scratch: 2, sleep: 1, look: 2 },
}

/** [SPEC-13.2.2] Opens and closes its wings slowly once settled. */
const BUTTERFLY: AnimalSpec = { ...FLYER, id: 'butterfly', flight: { ...FLYER.flight!, restBeat: 1, restRate: 0.4 } }
/** The same path without weaving: the height is the path's. */
const STRAIGHT: AnimalSpec = { ...FLYER, id: 'straight', flight: { ...FLYER.flight!, weave: 0 } }
/** [SPEC-13.2.2] Rises straight up from behind a tuft before flying off: a segment with no length
 *  on the ground. */
const RISER: AnimalSpec = {
  ...FLYER,
  id: 'riser',
  path: [
    { x: 600, y: 950, crouch: 0, height: 0 },
    { x: 600, y: 950, crouch: 0, height: 60 },
    { x: 600, y: 950, crouch: 0, height: 160 },
    { x: 400, y: 900, crouch: 0, height: 120 },
  ],
}
/** An animal that walks, on the ground. */
const WALKER: AnimalSpec = {
  ...FLYER,
  id: 'walker',
  path: FLYER.path.map(({ x, y, crouch }) => ({ x, y, crouch })),
  gait: 'walk',
  flight: undefined,
}

const lengths = pathLengths(FLYER.path)
const pathAt = (model: AnimalModel) => pointAt(FLYER.path, lengths, model.distance)
/** Angle of a wing as the rig computes it, folded at 0, for a wing beating between -1 and 1. */
const wingAngle = (pose: Pose) => pose.wingBeat * Math.sin(pose.wingPhase)

function run(model: AnimalModel, seconds: number, onStep?: (pose: Pose) => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    model.step(DT)
    onStep?.(model.pose)
  }
}

function runUntil(model: AnimalModel, test: () => boolean, limit = 60): number {
  let t = 0
  while (!test()) {
    model.step(DT)
    t += DT
    if (t > limit) throw new Error(`condition not reached in ${limit} s (state ${model.state})`)
  }
  return t
}

function settled(spec: AnimalSpec): AnimalModel {
  const model = new AnimalModel(spec, 5)
  model.setTarget('settled')
  runUntil(model, () => model.state === 'settled')
  return model
}

describe('an animal that flies [SPEC-13.2.3]', () => {
  it('follows the height of its path, and lands exactly at its place', () => {
    const model = new AnimalModel(STRAIGHT, 1)
    model.setTarget('settled')
    let highest = 0
    run(model, 30, (pose) => {
      expect(pose.height).toBeCloseTo(pointAt(STRAIGHT.path, lengths, model.distance).height, 9)
      highest = Math.max(highest, pose.height)
    })
    expect(model.state).toBe('settled')
    expect(highest).toBeGreaterThan(340)
    expect(model.pose).toMatchObject({ x: 800, y: 900, height: 60 })
  })

  it('weaves across its path while approaching, never more than the weave, and lands exactly', () => {
    const model = new AnimalModel(FLYER, 1)
    model.setTarget('settled')
    let widest = 0
    run(model, 30, (pose) => {
      const here = pathAt(model)
      const off = Math.hypot(pose.x - here.x, pose.height - here.height)
      expect(off).toBeLessThanOrEqual(FLYER.flight!.weave + 1e-9)
      widest = Math.max(widest, off)
      // The depth stays the path's: the weave moves the drawing, not the drawing order.
      expect(pose.y).toBe(here.y)
    })
    expect(widest).toBeGreaterThan(FLYER.flight!.weave / 2)
    expect(model.pose).toMatchObject({ x: 800, y: 900, height: 60 })
  })

  it('casts a smaller, paler shadow the higher it flies; full size on the ground', () => {
    const model = new AnimalModel(FLYER, 1)
    model.setTarget('settled')
    run(model, 30, (pose) => expect(pose.shadowScale).toBeCloseTo(1 / (1 + pose.height / SHADOW_HALF_HEIGHT), 12))
    expect(model.pose.shadowScale).toBeCloseTo(1 / (1 + 60 / SHADOW_HALF_HEIGHT), 12)
    // Higher, smaller.
    expect(1 / (1 + 350 / SHADOW_HALF_HEIGHT)).toBeLessThan(model.pose.shadowScale)
    const walker = settled(WALKER)
    expect(walker.pose.height).toBe(0)
    expect(walker.pose.shadowScale).toBe(1)
  })

  it('beats its wings in the air, legs still, and folds them once settled: then they do not move', () => {
    const model = new AnimalModel(FLYER, 1)
    model.setTarget('settled')
    runUntil(model, () => model.state === 'approaching' && model.distance > (model.sExit + model.sSpot) / 2)
    expect(model.pose.wingBeat).toBeGreaterThan(0.9)
    const phase = model.pose.wingPhase
    run(model, 1, (pose) => {
      expect(pose.stride).toBe(0)
      expect(pose.gait).toBe(0)
    })
    // [SPEC-13.2.4] A few beats per second, never more than the cap.
    expect((model.pose.wingPhase - phase) / (2 * Math.PI)).toBeCloseTo(FLYER.flight!.wingRate, 1)
    runUntil(model, () => model.state === 'settled')
    run(model, 3)
    const still = { ...model.pose }
    expect(still.wingBeat).toBe(0)
    run(model, 20, (pose) => {
      expect(pose.wingBeat).toBe(0)
      expect(wingAngle(pose)).toBe(0)
      expect(pose.bob).toBeCloseTo(still.bob, 6)
    })
  })

  it('a settled butterfly opens and closes its wings slowly [SPEC-13.2.2]', () => {
    const model = settled(BUTTERFLY)
    run(model, 3)
    const phase = model.pose.wingPhase
    run(model, 10, (pose) => expect(pose.wingBeat).toBeGreaterThan(0.99))
    expect((model.pose.wingPhase - phase) / (2 * Math.PI)).toBeCloseTo(10 * 0.4, 1)
  })

  it('hovers on alert in the air: does not move nor fall, wings still beating', () => {
    const model = new AnimalModel(FLYER, 1)
    model.setTarget('settled')
    runUntil(model, () => model.state === 'approaching' && model.distance > (model.sExit + model.sSpot) / 2)
    model.setTarget('alert')
    run(model, 0.3)
    expect(model.state).toBe('alert')
    const frozen = { ...model.pose, distance: model.distance }
    const phase = model.pose.wingPhase
    run(model, 2, (pose) => {
      expect(model.distance).toBe(frozen.distance)
      expect(pose.x).toBe(frozen.x)
      expect(pose.y).toBe(frozen.y)
      expect(pose.height).toBe(frozen.height)
      expect(pose.wingBeat).toBeGreaterThan(0.9)
    })
    expect(model.pose.wingPhase - phase).toBeGreaterThan(2 * Math.PI * 2 * FLYER.flight!.wingRate * 0.9)
    expect(model.pose.ears).toBeGreaterThan(0.9)
    expect(model.pose.eyeWide).toBeGreaterThan(0.9)
    model.setTarget('settled')
    runUntil(model, () => model.state === 'settled')
  })

  it('freezes on alert once settled, wings included, even a butterfly', () => {
    for (const spec of [FLYER, BUTTERFLY]) {
      const model = settled(spec)
      run(model, 3)
      model.setTarget('alert')
      run(model, 0.01)
      const frozen = { ...model.pose }
      run(model, 2, (pose) => {
        expect(pose.wingBeat).toBe(frozen.wingBeat)
        expect(pose.wingPhase).toBe(frozen.wingPhase)
        expect(pose.height).toBe(frozen.height)
        expect(pose.x).toBe(frozen.x)
      })
      expect(model.pose.ears, spec.id).toBeGreaterThan(0.9)
    }
  })

  it('flies straight back to its hideout in less than a second when fleeing [SPEC-13.2.3]', () => {
    const model = settled(FLYER)
    model.setTarget('fleeing')
    const time = runUntil(model, () => {
      const here = pathAt(model)
      // Direct: on the path itself, no weave.
      expect(model.pose.x).toBe(here.x)
      expect(model.pose.height).toBe(here.height)
      return model.state === 'hidden'
    })
    expect(time).toBeLessThan(1)
    expect(model.distance).toBe(0)
  })

  it('stops weaving smoothly when fleeing from the middle of its approach', () => {
    const model = new AnimalModel(FLYER, 1)
    model.setTarget('settled')
    runUntil(model, () => model.state === 'approaching' && Math.hypot(model.pose.x - pathAt(model).x, model.pose.height - pathAt(model).height) > 15)
    model.setTarget('fleeing')
    run(model, 0.4)
    expect(Math.hypot(model.pose.x - pathAt(model).x, model.pose.height - pathAt(model).height)).toBeLessThan(1)
  })

  it('refuses a wing beat faster than the cap, and a flight without its settings [SPEC-8.5]', () => {
    expect(MAX_WING_RATE).toBeLessThanOrEqual(3)
    expect(() => new AnimalModel({ ...FLYER, flight: { ...FLYER.flight!, wingRate: MAX_WING_RATE + 0.5 } })).toThrow()
    expect(() => new AnimalModel({ ...FLYER, flight: { ...FLYER.flight!, restRate: MAX_WING_RATE + 0.5 } })).toThrow()
    expect(() => new AnimalModel({ ...FLYER, flight: undefined })).toThrow()
  })

  it('an animal that walks has no height and no wings', () => {
    const model = new AnimalModel(WALKER, 1)
    model.setTarget('settled')
    run(model, 30, (pose) => {
      expect(pose.height).toBe(0)
      expect(pose.shadowScale).toBe(1)
      expect(pose.wingBeat).toBe(0)
      expect(pose.wingPhase).toBe(0)
    })
  })
})

describe('continuity of a flight [SPEC-8.5]: any target at any time, no jump from one frame to the next', () => {
  const LIMITS: Partial<Record<keyof Pose, number>> = {
    crouch: 0.2,
    lean: 0.05,
    headPitch: 0.2,
    look: 0.4,
    ears: 0.4,
    eyeWide: 0.2,
    eyeOpen: 0.25,
    facing: (2 / TURN_TIME.flee) * DT + 1e-9,
    shadow: 0.35,
    tail: 0.15,
    chew: 0.03,
    breath: 0.01,
    wingBeat: 0.07,
  }

  it.each([FLYER, BUTTERFLY, RISER])('$id', (spec) => {
    const model = new AnimalModel(spec, 3)
    const random = seededRandom(17)
    // Lengths along the path are measured in space, height included: one unit of path moves the
    // drawing at most √2 units on the screen (x, and y - height). The weave adds its own change
    // per unit of path, and its fading when the flight starts.
    const at = pathLengths(spec.path)
    const { weave, weaveLength } = spec.flight!
    const weaveSlope = weave * ((2 * Math.PI) / weaveLength + Math.PI / (at.at(-1)! - at[spec.peekIndex]!))
    const maxStep = spec.speed.flee * DT * (Math.SQRT2 + weaveSlope) + weave * 0.2
    // The shadow follows the height, which changes by at most `maxStep` a frame; it shrinks
    // fastest near the ground: 1 / SHADOW_HALF_HEIGHT per unit of height.
    const limits = { ...LIMITS, shadowScale: maxStep / SHADOW_HALF_HEIGHT }
    let previous = { ...model.pose }
    const seen = new Set<string>()
    let nextChange = 0
    for (let t = 0; t < 600; t += DT) {
      if (t >= nextChange) {
        model.setTarget(ANIMAL_STATES[Math.floor(random() * ANIMAL_STATES.length)]!)
        nextChange = t + 0.2 + random() * 5.8
      }
      const before = model.state
      model.step(DT)
      seen.add(`${before}>${model.state}`)
      const pose = model.pose
      const moved = Math.hypot(pose.x - previous.x, pose.y - pose.height - (previous.y - previous.height))
      if (moved > maxStep) expect.fail(`moved ${moved.toFixed(2)} on screen at ${t.toFixed(2)} s (${before} > ${model.state})`)
      for (const [key, limit] of Object.entries(limits) as [keyof Pose, number][]) {
        const change = Math.abs(pose[key] - previous[key])
        if (change > limit) expect.fail(`${key} jumped by ${change.toFixed(3)} at ${t.toFixed(2)} s (${before} > ${model.state})`)
      }
      // [SPEC-13.2.4] Never faster than the cap: at most this much of a beat per frame.
      expect(pose.wingPhase - previous.wingPhase).toBeLessThanOrEqual(2 * Math.PI * MAX_WING_RATE * DT + 1e-9)
      expect(pose.wingPhase - previous.wingPhase).toBeGreaterThanOrEqual(0)
      expect(Math.abs(wingAngle(pose) - wingAngle(previous))).toBeLessThanOrEqual(2 * Math.PI * MAX_WING_RATE * DT + 0.07)
      expect(Math.abs(pose.bob - previous.bob)).toBeLessThanOrEqual(spec.bounce * 0.1)
      expect(pose.stride).toBe(0)
      previous = { ...pose }
    }
    for (const state of ANIMAL_STATES) expect([...seen].some((pair) => pair.endsWith(`>${state}`)), state).toBe(true)
  })
})
