import { describe, expect, it } from 'vitest'
import type { AnimalState } from './animal'
import { CalmLogic, DEFAULT_CALM_SETTINGS, type CalmOutput } from './calm'
import { fadeLevel, REWARD_FADE, rewardActive } from './reward'

/** Six animals, as many as in the forest. */
const IDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const
type Id = (typeof IDS)[number]
const LAST_OUT_S = DEFAULT_CALM_SETTINGS.firstS + (IDS.length - 1) * DEFAULT_CALM_SETTINGS.intervalS

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
    const called = run(logic, LAST_OUT_S, QUIET)
    expect(called.allSettled).toBe(true)
    const walking: AnimalState[] = [...all('settled').slice(0, 5), 'approaching']
    expect(rewardActive(false, called, walking)).toBe(false)
    expect(rewardActive(false, called, all('settled'))).toBe(true)
  })

  it('does not start before the logic calls the sixth animal', () => {
    const logic = new CalmLogic(IDS)
    const early = run(logic, LAST_OUT_S / 2, QUIET)
    expect(rewardActive(false, early, all('settled'))).toBe(false)
  })

  it('lasts through a short alert and ends at the first flight', () => {
    const logic = new CalmLogic(IDS)
    run(logic, LAST_OUT_S, QUIET)
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
    run(logic, LAST_OUT_S, QUIET)
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
    for (let i = 0; i < Math.round((DEFAULT_CALM_SETTINGS.firstS + (eight.length - 1) * DEFAULT_CALM_SETTINGS.intervalS) / DT); i++) output = logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS)
    expect(output.allSettled).toBe(true)
    const settled: AnimalState[] = eight.map(() => 'settled')
    expect(rewardActive(false, output, settled.slice(0, 6))).toBe(false)
    expect(rewardActive(false, output, [...settled.slice(0, 7), 'approaching'])).toBe(false)
    expect(rewardActive(false, output, settled)).toBe(true)
  })
})

describe('rewardActive with twenty animals [SPEC-9.8] [SPEC-14.2] [SPEC-14.4]', () => {
  it('waits for all twenty chicks to be settled on screen and ends at the first flight', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `chick${i + 1}`)
    const logic = new CalmLogic(twenty)
    const settings = { ...DEFAULT_CALM_SETTINGS, firstS: 5, intervalS: 5 }
    const lastOutS = settings.firstS + (twenty.length - 1) * settings.intervalS
    let output = logic.step(QUIET, 0, settings)
    for (let i = 0; i < Math.round(lastOutS / DT); i++) output = logic.step(QUIET, DT, settings)
    expect(output.allSettled).toBe(true)
    const settled: AnimalState[] = twenty.map(() => 'settled')
    expect(rewardActive(false, output, [...settled.slice(0, 19), 'approaching'])).toBe(false)
    expect(rewardActive(false, output, settled)).toBe(true)
    const noise = logic.step(LOUD, DT, settings)
    expect(rewardActive(true, noise, settled)).toBe(false)
  })
})
