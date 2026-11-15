import { describe, expect, it } from 'vitest'
import type { AnimalState } from './animal'
import { CalmLogic, DEFAULT_CALM_SETTINGS, type CalmOutput } from './calm'
import { fadeLevel, REWARD_FADE, rewardActive } from './reward'

/** Six animals, as many as in the forest. */
const IDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const
type Id = (typeof IDS)[number]

const DT = 1 / 64
const QUIET = 0
const MURMUR = 9
const LOUD = 20

function run(logic: CalmLogic<Id>, seconds: number, db: number): CalmOutput<Id> {
  let output: CalmOutput<Id> | undefined
  for (let i = 0; i < Math.round(seconds / DT); i++) output = logic.step(db, DT, DEFAULT_CALM_SETTINGS)
  return output!
}

const all = (state: AnimalState): AnimalState[] => IDS.map(() => state)

describe('rewardActive [SPEC-9.5]', () => {
  it('waits until the six animals are settled on screen, not only called out', () => {
    const logic = new CalmLogic(IDS)
    const called = run(logic, DEFAULT_CALM_SETTINGS.totalS, QUIET)
    expect(called.allSettled).toBe(true)
    const walking: AnimalState[] = [...all('settled').slice(0, 5), 'approaching']
    expect(rewardActive(false, called, walking)).toBe(false)
    expect(rewardActive(false, called, all('settled'))).toBe(true)
  })

  it('does not start before the logic calls the sixth animal', () => {
    const logic = new CalmLogic(IDS)
    const early = run(logic, DEFAULT_CALM_SETTINGS.totalS / 2, QUIET)
    expect(rewardActive(false, early, all('settled'))).toBe(false)
  })

  it('lasts through a short alert and ends at the first flight', () => {
    const logic = new CalmLogic(IDS)
    run(logic, DEFAULT_CALM_SETTINGS.totalS, QUIET)
    // Short alert, under the tolerance: frozen animals, reward kept.
    const alert = run(logic, DEFAULT_CALM_SETTINGS.toleranceS / 2, MURMUR)
    expect(alert.zone).toBe('alert')
    expect(rewardActive(true, alert, all('alert'))).toBe(true)
    const calmAgain = run(logic, 1, QUIET)
    expect(rewardActive(true, calmAgain, all('settled'))).toBe(true)
    // Noise: flight, reward gone.
    const noise = run(logic, DT, LOUD)
    expect(rewardActive(true, noise, all('settled'))).toBe(false)
  })

  it('ends when an alert lasts longer than the tolerance', () => {
    const logic = new CalmLogic(IDS)
    run(logic, DEFAULT_CALM_SETTINGS.totalS, QUIET)
    const long = run(logic, DEFAULT_CALM_SETTINGS.toleranceS + 2 * DT, MURMUR)
    expect(rewardActive(true, long, all('alert'))).toBe(false)
  })
})

describe('fadeLevel [SPEC-8.5]', () => {
  it('comes in over several seconds and goes faster, between 0 and 1', () => {
    let level = 0
    for (let t = 0; t < REWARD_FADE.inS / 2; t += DT) level = fadeLevel(level, true, DT)
    expect(level).toBeCloseTo(0.5, 1)
    for (let t = 0; t < REWARD_FADE.inS; t += DT) level = fadeLevel(level, true, DT)
    expect(level).toBe(1)
    expect(REWARD_FADE.inS).toBeGreaterThanOrEqual(3)
    for (let t = 0; t < REWARD_FADE.outS + DT; t += DT) level = fadeLevel(level, false, DT)
    expect(level).toBe(0)
  })
})

describe('rewardActive with eight animals [SPEC-9.8]', () => {
  it('waits for all eight to be settled on screen', () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
    const logic = new CalmLogic(eight)
    let output = logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS)
    for (let i = 0; i < Math.round(DEFAULT_CALM_SETTINGS.totalS / DT); i++) output = logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS)
    expect(output.allSettled).toBe(true)
    const settled: AnimalState[] = eight.map(() => 'settled')
    expect(rewardActive(false, output, settled.slice(0, 6))).toBe(false)
    expect(rewardActive(false, output, [...settled.slice(0, 7), 'approaching'])).toBe(false)
    expect(rewardActive(false, output, settled)).toBe(true)
  })
})
