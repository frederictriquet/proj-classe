import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CalmLogic,
  comeOutTimes,
  DEFAULT_CALM_SETTINGS,
  fleeThresholdDb,
  RECOVERY_S,
  zoneOf,
  type CalmOutput,
  type CalmSettings,
} from './calm'

/** Six animals, as many as in the forest, from the least to the most timid. */
const IDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const
type Id = (typeof IDS)[number]

/** Short timings for the alert/recovery scenarios. Production defaults are tested separately. */
const SETTINGS: CalmSettings = { ...DEFAULT_CALM_SETTINGS, firstS: 5, intervalS: 17 }

/** Simulated frame: a power of two, so 5 s, 0.5 s and 2 s are whole numbers of steps and the
 *  gauge adds up without rounding. */
const DT = 1 / 64
/** Levels in dB above the ambient noise, for the default alert threshold (6 dB, flight 12 dB). */
const QUIET = 0
const MURMUR = 9
const LOUD = 20

/** Runs `seconds` of simulated time at the level `db`; returns the last output. `onStep` gets
 *  the simulated time since the start of this run and the output of each step. */
function run(
  logic: CalmLogic<Id>,
  seconds: number,
  db: number,
  settings: CalmSettings = SETTINGS,
  onStep?: (t: number, output: CalmOutput<Id>) => void,
): CalmOutput<Id> {
  const steps = Math.round(seconds / DT)
  expect(steps > 0 && steps * DT === seconds, `${seconds} s is a whole number of steps`).toBe(true)
  let output: CalmOutput<Id> | undefined
  for (let i = 1; i <= steps; i++) {
    output = logic.step(db, DT, settings)
    onStep?.(i * DT, output)
  }
  return output!
}

/** Simulated time at which each animal is first called out, during a run. */
function comeOutLog(): { log: Partial<Record<Id, number>>; onStep: (t: number, o: CalmOutput<Id>) => void } {
  const log: Partial<Record<Id, number>> = {}
  return {
    log,
    onStep(t, output) {
      for (const id of IDS) if (output.targets[id] === 'settled' && log[id] === undefined) log[id] = t
    },
  }
}

const allTargets = (output: CalmOutput<Id>) => IDS.map((id) => output.targets[id])
const hiddenAll = IDS.map(() => 'hidden')

describe('zones [SPEC-9.4] [SPEC-9.6]', () => {
  it('puts the flight threshold 6 dB above the alert threshold', () => {
    expect(fleeThresholdDb(6)).toBe(12)
    expect(fleeThresholdDb(10)).toBe(16)
  })

  it('is calm under the alert threshold, noise above the flight threshold, alert between', () => {
    expect(zoneOf(5.99, 6)).toBe('calm')
    expect(zoneOf(6, 6)).toBe('alert')
    expect(zoneOf(12, 6)).toBe('alert')
    expect(zoneOf(12.01, 6)).toBe('noise')
    expect(zoneOf(-30, 6)).toBe('calm')
  })
})

describe('calm gauge and come-out times [SPEC-9.4.1]', () => {
  it('uses independent initial and successive delays, regardless of the animal count [SPEC-9.8]', () => {
    expect(comeOutTimes(300, 30, 6)).toEqual([300, 330, 360, 390, 420, 450])
    expect(comeOutTimes(90, 30, 6)).toEqual([90, 120, 150, 180, 210, 240])
    expect(comeOutTimes(5, 10, 8)).toEqual([5, 15, 25, 35, 45, 55, 65, 75])
    expect(comeOutTimes(5, 5, 20)).toEqual(Array.from({ length: 20 }, (_, i) => 5 + 5 * i))
    expect(() => comeOutTimes(90, 30, 1)).toThrow(RangeError)
    expect(() => new CalmLogic(['alone'])).toThrow(RangeError)
  })

  it('honours a 300 s initial delay: the squirrel stays hidden at 5 s and until 5 minutes', () => {
    const logic = new CalmLogic(IDS)
    const settings = { ...DEFAULT_CALM_SETTINGS, firstS: 300, intervalS: 30 }
    expect(allTargets(run(logic, 5, QUIET, settings))).toEqual(hiddenAll)
    expect(allTargets(run(logic, 295 - DT, QUIET, settings))).toEqual(hiddenAll)
    expect(logic.step(QUIET, DT, settings).targets.first).toBe('settled')
    expect(run(logic, 30 - DT, QUIET, settings).targets.second).toBe('hidden')
    expect(logic.step(QUIET, DT, settings).targets.second).toBe('settled')
  })

  for (const [firstS, intervalS] of [[5, 5], [90, 30], [300, 60]] as const) {
    it(`calls the six animals out after ${firstS} s, then every ${intervalS} s of calm`, () => {
      const settings = { ...DEFAULT_CALM_SETTINGS, firstS, intervalS }
      const logic = new CalmLogic(IDS)
      const { log, onStep } = comeOutLog()
      const lastS = firstS + 5 * intervalS
      let settledBefore = false
      const last = run(logic, lastS, QUIET, settings, (t, output) => {
        onStep(t, output)
        if (t < lastS && output.allSettled) settledBefore = true
      })
      expect(IDS.map((id) => log[id])).toEqual(comeOutTimes(firstS, intervalS, IDS.length))
      expect(log.first).toBe(firstS)
      expect(settledBefore).toBe(false)
      expect(last.allSettled).toBe(true)
      expect(last.gauge).toBe(lastS)
      expect(allTargets(last)).toEqual(IDS.map(() => 'settled'))
    })
  }

  for (const count of [8, 17, 20]) {
    it(`keeps the chosen interval for ${count} animals [SPEC-9.8] [SPEC-13.2] [SPEC-14.2]`, () => {
      const ids = Array.from({ length: count }, (_, i) => `animal${i + 1}`)
      const logic = new CalmLogic(ids)
      const settings = { ...DEFAULT_CALM_SETTINGS, firstS: 5, intervalS: 5 }
      const times = comeOutTimes(settings.firstS, settings.intervalS, count)
      expect(times[0]).toBe(5)
      expect(times[count - 1]).toBe(settings.firstS + (count - 1) * settings.intervalS)
      for (let i = 0; i < count; i++) {
        logic.step(QUIET, (i === 0 ? settings.firstS : settings.intervalS) - DT, settings)
        const before = logic.step(QUIET, 0, settings)
        expect(ids.map((id) => before.targets[id])).toEqual(ids.map((_, j) => j < i ? 'settled' : 'hidden'))
        expect(before.allSettled).toBe(false)
        const output = logic.step(QUIET, DT, settings)
        expect(ids.map((id) => output.targets[id])).toEqual(ids.map((_, j) => j <= i ? 'settled' : 'hidden'))
        expect(output.allSettled).toBe(i === count - 1)
      }
    })
  }

  it('uses the production defaults for the first animal and all following intervals', () => {
    const logic = new CalmLogic(IDS)
    expect(run(logic, 90 - DT, QUIET, DEFAULT_CALM_SETTINGS).targets.first).toBe('hidden')
    expect(logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS).targets.first).toBe('settled')
    expect(run(logic, 30 - DT, QUIET, DEFAULT_CALM_SETTINGS).targets.second).toBe('hidden')
    expect(logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS).targets.second).toBe('settled')
  })

  it('keeps everyone settled and the gauge capped while the calm lasts', () => {
    const logic = new CalmLogic(IDS)
    const output = run(logic, 120, QUIET)
    expect(output.gauge).toBe(90)
    expect(output.allSettled).toBe(true)
  })

  it('ignores a step without elapsed time', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 4, QUIET)
    expect(logic.step(QUIET, 0, SETTINGS).gauge).toBe(4)
    expect(logic.step(QUIET, -1, SETTINGS).gauge).toBe(4)
  })
})

describe('alert [SPEC-9.4.2]', () => {
  it('a brief peak freezes the animals out, stops the gauge, then everything resumes', () => {
    const logic = new CalmLogic(IDS)
    const before = run(logic, 30, QUIET) // the first (5 s) and the second (22 s) are out
    expect(before.gauge).toBe(30)

    const during = run(logic, 0.25, MURMUR)
    expect(during.zone).toBe('alert')
    expect(during.gauge).toBe(30)
    expect(allTargets(during)).toEqual(['alert', 'alert', 'hidden', 'hidden', 'hidden', 'hidden'])
    expect(during.allSettled).toBe(false)

    const after = logic.step(QUIET, DT, SETTINGS)
    expect(after.zone).toBe('calm')
    expect(allTargets(after)).toEqual(['settled', 'settled', 'hidden', 'hidden', 'hidden', 'hidden'])
    expect(after.gauge).toBe(30 + DT)

    // The third comes out at 39 s of calm: the alert time does not count.
    const { log, onStep } = comeOutLog()
    run(logic, 9, QUIET, SETTINGS, onStep)
    expect(log.third).toBe(9 - DT)
  })

  it('an alert lasting exactly the tolerance does not make the animals flee', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET)
    const output = run(logic, SETTINGS.toleranceS, MURMUR)
    expect(allTargets(output).slice(0, 2)).toEqual(['alert', 'alert'])
    expect(output.gauge).toBe(30)
  })

  it('an alert longer than the tolerance makes the animals flee', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET)
    run(logic, SETTINGS.toleranceS, MURMUR)
    const output = logic.step(MURMUR, DT, SETTINGS)
    expect(allTargets(output)).toEqual(hiddenAll)
    expect(output.gauge).toBe(0)
  })

  it('with no tolerance, the first moment of alert makes the animals flee', () => {
    const settings = { ...SETTINGS, toleranceS: 0 }
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET, settings)
    const output = logic.step(MURMUR, DT, settings)
    expect(allTargets(output)).toEqual(hiddenAll)
    expect(output.gauge).toBe(0)
  })

  it('does not add up separate brief alerts', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET)
    for (let i = 0; i < 5; i++) {
      run(logic, 0.375, MURMUR)
      run(logic, 0.25, QUIET)
    }
    const output = logic.step(QUIET, DT, SETTINGS)
    expect(allTargets(output).slice(0, 2)).toEqual(['settled', 'settled'])
    expect(output.gauge).toBe(30 + 5 * 0.25 + DT)
  })
})

describe('noise and recovery [SPEC-9.4.3] [SPEC-9.4.4]', () => {
  it('restarts the configured 300 s initial delay after a fright and the recovery', () => {
    const logic = new CalmLogic(IDS)
    const settings = { ...DEFAULT_CALM_SETTINGS, firstS: 300, intervalS: 60 }
    expect(run(logic, 300, QUIET, settings).targets.first).toBe('settled')
    expect(allTargets(logic.step(LOUD, DT, settings))).toEqual(hiddenAll)
    expect(allTargets(run(logic, RECOVERY_S + 300 - DT, QUIET, settings))).toEqual(hiddenAll)
    expect(logic.step(QUIET, DT, settings).targets.first).toBe('settled')
    expect(run(logic, 60 - DT, QUIET, settings).targets.second).toBe('hidden')
    expect(logic.step(QUIET, DT, settings).targets.second).toBe('settled')
  })

  it('loud noise: immediate flight, gauge to zero, rises again after 2 s of calm', () => {
    const logic = new CalmLogic(IDS)
    expect(run(logic, 90, QUIET).allSettled).toBe(true)

    const noise = logic.step(LOUD, DT, SETTINGS)
    expect(noise.zone).toBe('noise')
    expect(allTargets(noise)).toEqual(hiddenAll)
    expect(noise.gauge).toBe(0)
    expect(noise.allSettled).toBe(false)

    const gauges: number[] = []
    const { log, onStep } = comeOutLog()
    run(logic, 30, QUIET, SETTINGS, (t, output) => {
      onStep(t, output)
      if (t <= RECOVERY_S) gauges.push(output.gauge)
    })
    expect(gauges.every((g) => g === 0)).toBe(true)
    // The first comes out after the recovery plus its usual 5 s.
    expect(log.first).toBe(RECOVERY_S + SETTINGS.firstS)
    expect(log.second).toBe(RECOVERY_S + 22)
  })

  it('animals that fled do not freeze at a later alert', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET)
    logic.step(LOUD, DT, SETTINGS)
    const output = run(logic, 0.25, MURMUR)
    expect(allTargets(output)).toEqual(hiddenAll)
  })

  it('the 2 s of calm must be uninterrupted: an alert or a noise restarts them', () => {
    for (const interruption of [MURMUR, LOUD]) {
      const logic = new CalmLogic(IDS)
      run(logic, 30, QUIET)
      logic.step(LOUD, DT, SETTINGS)
      run(logic, 1.5, QUIET)
      logic.step(interruption, DT, SETTINGS)
      expect(run(logic, RECOVERY_S, QUIET).gauge).toBe(0)
      expect(logic.step(QUIET, DT, SETTINGS).gauge).toBe(DT)
    }
  })

  it('noise before the first animal also resets the gauge', () => {
    const logic = new CalmLogic(IDS)
    expect(run(logic, 4, QUIET).gauge).toBe(4)
    expect(logic.step(LOUD, DT, SETTINGS).gauge).toBe(0)
    const { log, onStep } = comeOutLog()
    run(logic, 10, QUIET, SETTINGS, onStep)
    expect(log.first).toBe(RECOVERY_S + SETTINGS.firstS)
  })

  it('no recovery delay at the start', () => {
    const logic = new CalmLogic(IDS)
    expect(run(logic, 1, QUIET).gauge).toBe(1)
  })
})

describe('change of settings on the way [SPEC-9.6] [SPEC-7.2]', () => {
  it('applies a longer initial delay before the first animal comes out', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 4, QUIET)
    const settings = { ...SETTINGS, firstS: 300 }
    expect(allTargets(run(logic, 296 - DT, QUIET, settings))).toEqual(hiddenAll)
    expect(logic.step(QUIET, DT, settings).targets.first).toBe('settled')
  })

  it('applies a shorter initial delay at once without changing the following interval', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 40, QUIET, { ...DEFAULT_CALM_SETTINGS, firstS: 300 })
    const settings = { ...DEFAULT_CALM_SETTINGS, firstS: 30 }
    expect(allTargets(logic.step(QUIET, 0, settings))).toEqual(['settled', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'])
    expect(run(logic, 20 - DT, QUIET, settings).targets.second).toBe('hidden')
    expect(logic.step(QUIET, DT, settings).targets.second).toBe('settled')
  })

  it('a new sensitivity moves both thresholds at the next step', () => {
    const logic = new CalmLogic(IDS)
    const sensitive = { ...SETTINGS, alertDb: 6 }
    const tolerant = { ...SETTINGS, alertDb: 10 }
    run(logic, 30, QUIET, sensitive)
    expect(logic.step(9, DT, sensitive).zone).toBe('alert')
    expect(logic.step(9, DT, tolerant).zone).toBe('calm')
    expect(logic.step(15, DT, tolerant).zone).toBe('alert')
    const output = logic.step(15, DT, sensitive)
    expect(output.zone).toBe('noise')
    expect(allTargets(output)).toEqual(hiddenAll)
  })

  it('a longer interval never sends an animal back in; the next ones follow the new times', () => {
    const short = { ...SETTINGS, firstS: 5, intervalS: 5 }
    const long = { ...SETTINGS, firstS: 5, intervalS: 17 }
    const logic = new CalmLogic(IDS)
    // First at 5 s, then every 5 s: the first four are out at 20 s.
    run(logic, 20, QUIET, short)
    const { log, onStep } = comeOutLog()
    let hidingAgain = false
    run(logic, 70, QUIET, long, (t, output) => {
      onStep(t, output)
      if (IDS.slice(0, 4).some((id) => output.targets[id] !== 'settled')) hidingAgain = true
    })
    expect(hidingAgain).toBe(false)
    // With a 17 s interval, the fifth comes out at 73 s of calm and the sixth at 90 s.
    expect(log.fifth).toBe(73 - 20)
    expect(log.sixth).toBe(90 - 20)
  })

  it('a shorter interval calls out at once the animals whose new time is passed', () => {
    const logic = new CalmLogic(IDS)
    const before = run(logic, 40, QUIET) // First at 5 s, then every 17 s: the first three are out
    expect(allTargets(before)).toEqual(['settled', 'settled', 'settled', 'hidden', 'hidden', 'hidden'])
    const after = logic.step(QUIET, DT, { ...SETTINGS, firstS: 5, intervalS: 5 })
    expect(after.gauge).toBe(30)
    expect(after.allSettled).toBe(true)
  })

  it('a lower tolerance applies to the alert under way', () => {
    const logic = new CalmLogic(IDS)
    run(logic, 30, QUIET)
    const patient = { ...SETTINGS, toleranceS: 1 }
    expect(run(logic, 0.75, MURMUR, patient).targets.first).toBe('alert')
    const output = logic.step(MURMUR, DT, { ...SETTINGS, toleranceS: 0.5 })
    expect(allTargets(output)).toEqual(hiddenAll)
  })
})

describe('reward signal [SPEC-9.5]', () => {
  it('holds while the six are out and the class is calm, not during an alert nor after a flight', () => {
    const logic = new CalmLogic(IDS)
    expect(run(logic, 90, QUIET).allSettled).toBe(true)
    expect(logic.step(MURMUR, DT, SETTINGS).allSettled).toBe(false)
    expect(logic.step(QUIET, DT, SETTINGS).allSettled).toBe(true)
    expect(logic.step(LOUD, DT, SETTINGS).allSettled).toBe(false)
    expect(run(logic, 10, QUIET).allSettled).toBe(false)
  })
})

describe('no rendering dependency [SPEC-9.4.5]', () => {
  const folder = dirname(fileURLToPath(import.meta.url))

  /** Every file `calm.ts` loads, directly or not, and the packages they import. */
  function importGraph(): { files: string[]; packages: string[] } {
    const files: string[] = []
    const packages: string[] = []
    const visit = (path: string) => {
      if (files.includes(path)) return
      files.push(path)
      const source = readFileSync(path, 'utf8')
      for (const [, specifier] of source.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        if (specifier!.startsWith('.')) visit(join(dirname(path), `${specifier}.ts`))
        else packages.push(specifier!)
      }
    }
    visit(join(folder, 'calm.ts'))
    return { files, packages }
  }

  it('imports no package, nothing outside the shared folder, no browser API', () => {
    const { files, packages } = importGraph()
    expect(packages).toEqual([])
    for (const path of files) {
      expect(relative(folder, path), path).not.toMatch(/^\.\./)
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/\b(window|document|navigator|performance|requestAnimationFrame|Date)\b/)
    }
    expect(files.map((path) => relative(folder, path)).sort()).toEqual(['animal.ts', 'calm.ts'])
  })
})
