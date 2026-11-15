import { describe, expect, it } from 'vitest'
import { ANIMAL_IDS, type AnimalState } from './animal-data'
import { CalmLogic, DEFAULT_CALM_SETTINGS, type CalmOutput } from './calm'
import { contains } from './layout'
import { createFireflies, fadeLevel, fireflyAlpha, fireflyPosition, REWARD, rewardActive } from './reward'

const DT = 1 / 64
const QUIET = 0
const MURMUR = 9
const LOUD = 20

function run(logic: CalmLogic, seconds: number, db: number): CalmOutput {
  let output: CalmOutput | undefined
  for (let i = 0; i < Math.round(seconds / DT); i++) output = logic.step(db, DT, DEFAULT_CALM_SETTINGS)
  return output!
}

const all = (state: AnimalState): AnimalState[] => ANIMAL_IDS.map(() => state)

describe('rewardActive [SPEC-9.5]', () => {
  it('waits until the six animals are settled on screen, not only called out', () => {
    const logic = new CalmLogic()
    const called = run(logic, DEFAULT_CALM_SETTINGS.totalS, QUIET)
    expect(called.allSettled).toBe(true)
    const walking: AnimalState[] = [...all('settled').slice(0, 5), 'approaching']
    expect(rewardActive(false, called, walking)).toBe(false)
    expect(rewardActive(false, called, all('settled'))).toBe(true)
  })

  it('does not start before the logic calls the sixth animal', () => {
    const logic = new CalmLogic()
    const early = run(logic, DEFAULT_CALM_SETTINGS.totalS / 2, QUIET)
    expect(rewardActive(false, early, all('settled'))).toBe(false)
  })

  it('lasts through a short alert and ends at the first flight', () => {
    const logic = new CalmLogic()
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
    const logic = new CalmLogic()
    run(logic, DEFAULT_CALM_SETTINGS.totalS, QUIET)
    const long = run(logic, DEFAULT_CALM_SETTINGS.toleranceS + 2 * DT, MURMUR)
    expect(rewardActive(true, long, all('alert'))).toBe(false)
  })
})

describe('fadeLevel [SPEC-8.5]', () => {
  it('comes in over several seconds and goes faster, between 0 and 1', () => {
    let level = 0
    for (let t = 0; t < REWARD.fadeInS / 2; t += DT) level = fadeLevel(level, true, DT)
    expect(level).toBeCloseTo(0.5, 1)
    for (let t = 0; t < REWARD.fadeInS; t += DT) level = fadeLevel(level, true, DT)
    expect(level).toBe(1)
    expect(REWARD.fadeInS).toBeGreaterThanOrEqual(3)
    for (let t = 0; t < REWARD.fadeOutS + DT; t += DT) level = fadeLevel(level, false, DT)
    expect(level).toBe(0)
  })
})

describe('fireflies [SPEC-9.5] [SPEC-8.5]', () => {
  const fireflies = createFireflies()

  it('drift slowly inside their area', () => {
    expect(fireflies).toHaveLength(REWARD.fireflies)
    for (const f of fireflies) {
      for (let t = 0; t < 60; t += 0.25) {
        const { x, y } = fireflyPosition(f, t)
        expect(contains(REWARD.area, { x, y, width: 0, height: 0 }), `${x}, ${y}`).toBe(true)
      }
      // Fastest speed of the drift, world units per second: a slow float.
      const speed = Math.hypot((2 * Math.PI * f.ax) / f.px, (2 * Math.PI * f.ay) / f.py)
      expect(speed).toBeLessThan(80)
    }
  })

  it('glow over several seconds without going dark: no flicker', () => {
    for (const f of fireflies) {
      expect(f.glowPeriod).toBeGreaterThanOrEqual(3)
      for (let t = 0; t < 20; t += 0.1) {
        const alpha = fireflyAlpha(f, t, 1)
        expect(alpha).toBeGreaterThanOrEqual(REWARD.glow.min - 1e-9)
        expect(alpha).toBeLessThanOrEqual(1)
      }
    }
  })

  it('are invisible without reward and all shown at full reward', () => {
    for (const f of fireflies) {
      expect(fireflyAlpha(f, 3, 0)).toBe(0)
      expect(fireflyAlpha(f, 3, 1)).toBeGreaterThan(0)
    }
  })
})
