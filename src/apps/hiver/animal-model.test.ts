import { describe, expect, it } from 'vitest'
import { ANIMAL_STATES, type AnimalState } from '../../silence/animal'
import { AnimalModel, BLINK_TIME, RECOVER_TIME, TURN_TIME, type Pose } from '../../silence/animal-model'
import { seededRandom } from '../../silence/random'
import { ANIMAL_IDS, ANIMALS } from './animal-data'

const DT = 1 / 60

/** Runs the model for `seconds` and returns the states it went through, in order, without
 *  repeats. */
function run(model: AnimalModel, seconds: number, onStep?: (pose: Pose) => void): AnimalState[] {
  const states: AnimalState[] = [model.state]
  for (let t = 0; t < seconds; t += DT) {
    model.step(DT)
    onStep?.(model.pose)
    if (states[states.length - 1] !== model.state) states.push(model.state)
  }
  return states
}

/** Runs until `test` holds; fails after `limit` seconds. */
function runUntil(model: AnimalModel, test: () => boolean, limit = 60): number {
  let t = 0
  while (!test()) {
    model.step(DT)
    t += DT
    if (t > limit) throw new Error(`condition not reached in ${limit} s (state ${model.state})`)
  }
  return t
}

const settled = (id: (typeof ANIMAL_IDS)[number]) => {
  const model = new AnimalModel(ANIMALS[id], 7)
  model.setTarget('settled')
  runUntil(model, () => model.state === 'settled')
  return model
}

describe.each(ANIMAL_IDS)('%s [SPEC-9.3] [SPEC-16.2.1]', (id) => {
  const spec = ANIMALS[id]

  it('comes out by peeking, then approaching, and settles at its place', () => {
    const model = new AnimalModel(spec, 1)
    expect(model.state).toBe('hidden')
    model.setTarget('settled')
    const states = run(model, 40)
    expect(states).toEqual(['hidden', 'peeking', 'approaching', 'settled'])
    const place = spec.path[spec.path.length - 1]!
    expect(model.pose.x).toBeCloseTo(place.x, 6)
    expect(model.pose.y).toBeCloseTo(place.y, 6)
    if (!spec.frontal) expect(model.pose.facing).toBe(spec.spotFacing)
  })

  it('waits while peeking before it comes out', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('settled')
    runUntil(model, () => model.distance === model.sPeek)
    const waited = runUntil(model, () => model.state === 'approaching')
    expect(waited).toBeGreaterThanOrEqual(spec.peekPause - 2 * DT)
  })

  it('stops at the edge of its hideout when the target is peeking', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('peeking')
    run(model, 20)
    expect(model.state).toBe('peeking')
    expect(model.distance).toBe(model.sPeek)
    expect(model.inHideout).toBe(true)
  })

  it('freezes where it is on alert, then goes on', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('settled')
    runUntil(model, () => model.state === 'approaching' && model.distance > (model.sPeek + model.sSpot) / 2)
    model.setTarget('alert')
    run(model, 0.3)
    expect(model.state).toBe('alert')
    const frozen = model.distance
    run(model, 2)
    expect(model.distance).toBe(frozen)
    expect(model.pose.ears).toBeGreaterThan(0.9)
    expect(model.pose.eyeWide).toBeGreaterThan(0.9)
    model.setTarget('settled')
    expect(run(model, 30)).toEqual(['alert', 'approaching', 'settled'])
  })

  it('freezes while peeking on alert', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('settled')
    runUntil(model, () => model.distance === model.sPeek)
    model.setTarget('alert')
    run(model, 1)
    expect(model.state).toBe('alert')
    expect(model.distance).toBe(model.sPeek)
  })

  it('stays hidden on alert', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('alert')
    run(model, 3)
    expect(model.state).toBe('hidden')
    expect(model.distance).toBe(0)
  })

  for (const target of ['hidden', 'fleeing'] as const) {
    it(`flees from where it is when the target is ${target}, fast, and hides`, () => {
      const model = new AnimalModel(spec, 1)
      model.setTarget('settled')
      runUntil(model, () => model.state === 'approaching' && model.distance > model.sExit)
      const from = model.distance
      model.setTarget(target)
      model.step(DT)
      expect(model.state).toBe('fleeing')
      expect(model.distance).toBeLessThanOrEqual(from + 1)
      expect(run(model, 3)).toEqual(['fleeing', 'hidden'])
      expect(model.distance).toBe(0)
      expect(model.inHideout).toBe(true)
    })
  }

  it('runs back from its place in less than a second and a half [SPEC-8.5]', () => {
    const model = settled(id)
    model.setTarget('fleeing')
    const time = runUntil(model, () => model.state === 'hidden')
    expect(time).toBeLessThan(1.5)
  })

  it('ends a flight in its hideout even if called back, then stays hidden a moment', () => {
    const model = settled(id)
    model.setTarget('hidden')
    run(model, 0.15)
    expect(model.state).toBe('fleeing')
    model.setTarget('settled')
    runUntil(model, () => model.state !== 'fleeing')
    expect(model.state).toBe('hidden')
    expect(model.distance).toBe(0)
    run(model, RECOVER_TIME - 0.1)
    expect(model.state).toBe('hidden')
    expect(run(model, 30)).toEqual(['hidden', 'peeking', 'approaching', 'settled'])
  })

  it('changes layer only past the exit point of its path', () => {
    const model = new AnimalModel(spec, 1)
    model.setTarget('settled')
    run(model, 40, () => {
      expect(model.inHideout).toBe(model.distance < model.sExit)
      if (model.state === 'hidden' || model.state === 'peeking') expect(model.inHideout).toBe(true)
    })
    expect(model.inHideout).toBe(false)
  })

  it('has varied activities once settled, and blinks', () => {
    const model = settled(id)
    const seen = new Set<string>()
    let blinked = false
    run(model, 400, (pose) => {
      seen.add(model.currentActivity)
      if (model.currentActivity !== 'sleep' && pose.eyeOpen < 0.2) blinked = true
    })
    for (const [activity, weight] of Object.entries(spec.activities)) {
      if (weight > 0) expect(seen.has(activity), activity).toBe(true)
      else expect(seen.has(activity), activity).toBe(false)
    }
    expect(blinked).toBe(true)
  })

  it('closes its eyes when asleep and opens them wide on alert', () => {
    const model = settled(id)
    model.forceActivity('sleep')
    run(model, 4)
    expect(model.pose.eyeOpen).toBeLessThan(0.05)
    model.setTarget('alert')
    run(model, 0.6)
    expect(model.pose.eyeOpen).toBeGreaterThan(0.95)
    expect(model.pose.eyeWide).toBeGreaterThan(0.95)
  })
})

describe('continuity [SPEC-8.5]: any target at any time, no jump from one frame to the next', () => {
  /** Largest change of a pose value in one frame of 1/60 s. Easing at the fastest rate (12/s)
   *  covers at most 18 % of the gap per frame; a turn takes at least 0.15 s. */
  const LIMITS: Partial<Record<keyof Pose, number>> = {
    crouch: 0.2,
    lean: 0.05,
    headPitch: 0.2,
    look: 0.4,
    ears: 0.4,
    eyeWide: 0.2,
    eyeOpen: 0.25,
    facing: (2 / TURN_TIME.flee) * DT + 1e-9,
    stride: 0.25,
    scratch: 0.2,
    shadow: 0.35,
    tail: 0.15,
    chew: 0.03,
    breath: 0.01,
  }

  it.each(ANIMAL_IDS)('%s', (id) => {
    const spec = ANIMALS[id]
    const model = new AnimalModel(spec, 3)
    const random = seededRandom(42 + ANIMAL_IDS.indexOf(id))
    // [SPEC-13.2.3] The robin's weave adds a little to its way on the ground.
    const maxStep = spec.speed.flee * DT * (spec.gait === 'fly' ? 1.05 : 1) + 1e-9
    let previous = { ...model.pose }
    const seen = new Set<string>()
    // Ten simulated minutes, a new random target every 0.2 to 6 s.
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
      expect(Math.hypot(pose.x - previous.x, pose.y - previous.y)).toBeLessThanOrEqual(maxStep)
      for (const [key, limit] of Object.entries(LIMITS) as [keyof Pose, number][]) {
        const change = Math.abs(pose[key] - previous[key])
        if (change > limit) expect.fail(`${key} jumped by ${change.toFixed(3)} at ${t.toFixed(2)} s (${before} > ${model.state})`)
      }
      // Legs and hops: at most a quarter turn of the gait per frame, even when fleeing.
      expect(pose.gait - previous.gait).toBeLessThanOrEqual(Math.PI / 2)
      expect(Math.abs(pose.bob - previous.bob)).toBeLessThanOrEqual(spec.bounce * 0.45 + 1e-9)
      previous = { ...pose }
    }
    // The run went through every state.
    for (const state of ANIMAL_STATES) expect([...seen].some((pair) => pair.endsWith(`>${state}`)), state).toBe(true)
  })

  it('blinks in about a quarter of a second', () => {
    expect(BLINK_TIME).toBeGreaterThanOrEqual(0.2)
    expect(BLINK_TIME).toBeLessThanOrEqual(0.3)
  })
})
