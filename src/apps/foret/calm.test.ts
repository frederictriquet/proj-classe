import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ANIMAL_IDS, type AnimalId } from './animal-data'
import {
  CalmLogic,
  comeOutTimes,
  DEFAULT_CALM_SETTINGS,
  FIRST_OUT_S,
  fleeThresholdDb,
  RECOVERY_S,
  zoneOf,
  type CalmOutput,
  type CalmSettings,
} from './calm'

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
  logic: CalmLogic,
  seconds: number,
  db: number,
  settings: CalmSettings = DEFAULT_CALM_SETTINGS,
  onStep?: (t: number, output: CalmOutput) => void,
): CalmOutput {
  const steps = Math.round(seconds / DT)
  expect(steps > 0 && steps * DT === seconds, `${seconds} s is a whole number of steps`).toBe(true)
  let output: CalmOutput | undefined
  for (let i = 1; i <= steps; i++) {
    output = logic.step(db, DT, settings)
    onStep?.(i * DT, output)
  }
  return output!
}

/** Simulated time at which each animal is first called out, during a run. */
function comeOutLog(): { log: Partial<Record<AnimalId, number>>; onStep: (t: number, o: CalmOutput) => void } {
  const log: Partial<Record<AnimalId, number>> = {}
  return {
    log,
    onStep(t, output) {
      for (const id of ANIMAL_IDS) if (output.targets[id] === 'settled' && log[id] === undefined) log[id] = t
    },
  }
}

const allTargets = (output: CalmOutput) => ANIMAL_IDS.map((id) => output.targets[id])
const hiddenAll = ANIMAL_IDS.map(() => 'hidden')

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
  it('spreads the six animals from 5 s to the total duration', () => {
    expect(comeOutTimes(90)).toEqual([5, 22, 39, 56, 73, 90])
    expect(comeOutTimes(30)).toEqual([5, 10, 15, 20, 25, 30])
    expect(comeOutTimes(300)).toEqual([5, 64, 123, 182, 241, 300])
  })

  for (const totalS of [90, 30]) {
    it(`continuous silence calls the animals out in order, the sixth at ${totalS} s`, () => {
      const settings = { ...DEFAULT_CALM_SETTINGS, totalS }
      const logic = new CalmLogic()
      const { log, onStep } = comeOutLog()
      let settledBefore = false
      const last = run(logic, totalS, QUIET, settings, (t, output) => {
        onStep(t, output)
        if (t < totalS && output.allSettled) settledBefore = true
      })
      expect(ANIMAL_IDS.map((id) => log[id])).toEqual(comeOutTimes(totalS))
      expect(log.squirrel).toBe(FIRST_OUT_S)
      expect(settledBefore).toBe(false)
      expect(last.allSettled).toBe(true)
      expect(last.gauge).toBe(totalS)
      expect(allTargets(last)).toEqual(ANIMAL_IDS.map(() => 'settled'))
    })
  }

  it('keeps everyone settled and the gauge at the total while the calm lasts', () => {
    const logic = new CalmLogic()
    const output = run(logic, 120, QUIET)
    expect(output.gauge).toBe(90)
    expect(output.allSettled).toBe(true)
  })

  it('ignores a step without elapsed time', () => {
    const logic = new CalmLogic()
    run(logic, 4, QUIET)
    expect(logic.step(QUIET, 0, DEFAULT_CALM_SETTINGS).gauge).toBe(4)
    expect(logic.step(QUIET, -1, DEFAULT_CALM_SETTINGS).gauge).toBe(4)
  })
})

describe('alert [SPEC-9.4.2]', () => {
  it('a brief peak freezes the animals out, stops the gauge, then everything resumes', () => {
    const logic = new CalmLogic()
    const before = run(logic, 30, QUIET) // squirrel (5 s) and rabbit (22 s) are out
    expect(before.gauge).toBe(30)

    const during = run(logic, 0.25, MURMUR)
    expect(during.zone).toBe('alert')
    expect(during.gauge).toBe(30)
    expect(allTargets(during)).toEqual(['alert', 'alert', 'hidden', 'hidden', 'hidden', 'hidden'])
    expect(during.allSettled).toBe(false)

    const after = logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS)
    expect(after.zone).toBe('calm')
    expect(allTargets(after)).toEqual(['settled', 'settled', 'hidden', 'hidden', 'hidden', 'hidden'])
    expect(after.gauge).toBe(30 + DT)

    // The hedgehog comes out at 39 s of calm: the alert time does not count.
    const { log, onStep } = comeOutLog()
    run(logic, 9, QUIET, DEFAULT_CALM_SETTINGS, onStep)
    expect(log.hedgehog).toBe(9 - DT)
  })

  it('an alert lasting exactly the tolerance does not make the animals flee', () => {
    const logic = new CalmLogic()
    run(logic, 30, QUIET)
    const output = run(logic, DEFAULT_CALM_SETTINGS.toleranceS, MURMUR)
    expect(allTargets(output).slice(0, 2)).toEqual(['alert', 'alert'])
    expect(output.gauge).toBe(30)
  })

  it('an alert longer than the tolerance makes the animals flee', () => {
    const logic = new CalmLogic()
    run(logic, 30, QUIET)
    run(logic, DEFAULT_CALM_SETTINGS.toleranceS, MURMUR)
    const output = logic.step(MURMUR, DT, DEFAULT_CALM_SETTINGS)
    expect(allTargets(output)).toEqual(hiddenAll)
    expect(output.gauge).toBe(0)
  })

  it('with no tolerance, the first moment of alert makes the animals flee', () => {
    const settings = { ...DEFAULT_CALM_SETTINGS, toleranceS: 0 }
    const logic = new CalmLogic()
    run(logic, 30, QUIET, settings)
    const output = logic.step(MURMUR, DT, settings)
    expect(allTargets(output)).toEqual(hiddenAll)
    expect(output.gauge).toBe(0)
  })

  it('does not add up separate brief alerts', () => {
    const logic = new CalmLogic()
    run(logic, 30, QUIET)
    for (let i = 0; i < 5; i++) {
      run(logic, 0.375, MURMUR)
      run(logic, 0.25, QUIET)
    }
    const output = logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS)
    expect(allTargets(output).slice(0, 2)).toEqual(['settled', 'settled'])
    expect(output.gauge).toBe(30 + 5 * 0.25 + DT)
  })
})

describe('noise and recovery [SPEC-9.4.3] [SPEC-9.4.4]', () => {
  it('loud noise: immediate flight, gauge to zero, rises again after 2 s of calm', () => {
    const logic = new CalmLogic()
    expect(run(logic, 90, QUIET).allSettled).toBe(true)

    const noise = logic.step(LOUD, DT, DEFAULT_CALM_SETTINGS)
    expect(noise.zone).toBe('noise')
    expect(allTargets(noise)).toEqual(hiddenAll)
    expect(noise.gauge).toBe(0)
    expect(noise.allSettled).toBe(false)

    const gauges: number[] = []
    const { log, onStep } = comeOutLog()
    run(logic, 30, QUIET, DEFAULT_CALM_SETTINGS, (t, output) => {
      onStep(t, output)
      if (t <= RECOVERY_S) gauges.push(output.gauge)
    })
    expect(gauges.every((g) => g === 0)).toBe(true)
    // The squirrel comes out after the recovery plus its usual 5 s.
    expect(log.squirrel).toBe(RECOVERY_S + FIRST_OUT_S)
    expect(log.rabbit).toBe(RECOVERY_S + 22)
  })

  it('animals that fled do not freeze at a later alert', () => {
    const logic = new CalmLogic()
    run(logic, 30, QUIET)
    logic.step(LOUD, DT, DEFAULT_CALM_SETTINGS)
    const output = run(logic, 0.25, MURMUR)
    expect(allTargets(output)).toEqual(hiddenAll)
  })

  it('the 2 s of calm must be uninterrupted: an alert or a noise restarts them', () => {
    for (const interruption of [MURMUR, LOUD]) {
      const logic = new CalmLogic()
      run(logic, 30, QUIET)
      logic.step(LOUD, DT, DEFAULT_CALM_SETTINGS)
      run(logic, 1.5, QUIET)
      logic.step(interruption, DT, DEFAULT_CALM_SETTINGS)
      expect(run(logic, RECOVERY_S, QUIET).gauge).toBe(0)
      expect(logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS).gauge).toBe(DT)
    }
  })

  it('noise before the first animal also resets the gauge', () => {
    const logic = new CalmLogic()
    expect(run(logic, 4, QUIET).gauge).toBe(4)
    expect(logic.step(LOUD, DT, DEFAULT_CALM_SETTINGS).gauge).toBe(0)
    const { log, onStep } = comeOutLog()
    run(logic, 10, QUIET, DEFAULT_CALM_SETTINGS, onStep)
    expect(log.squirrel).toBe(RECOVERY_S + FIRST_OUT_S)
  })

  it('no recovery delay at the start', () => {
    const logic = new CalmLogic()
    expect(run(logic, 1, QUIET).gauge).toBe(1)
  })
})

describe('change of settings on the way [SPEC-9.6] [SPEC-7.2]', () => {
  it('a new sensitivity moves both thresholds at the next step', () => {
    const logic = new CalmLogic()
    const sensitive = { ...DEFAULT_CALM_SETTINGS, alertDb: 6 }
    const tolerant = { ...DEFAULT_CALM_SETTINGS, alertDb: 10 }
    run(logic, 30, QUIET, sensitive)
    expect(logic.step(9, DT, sensitive).zone).toBe('alert')
    expect(logic.step(9, DT, tolerant).zone).toBe('calm')
    expect(logic.step(15, DT, tolerant).zone).toBe('alert')
    const output = logic.step(15, DT, sensitive)
    expect(output.zone).toBe('noise')
    expect(allTargets(output)).toEqual(hiddenAll)
  })

  it('a longer duration never sends an animal back in; the next ones follow the new times', () => {
    const short = { ...DEFAULT_CALM_SETTINGS, totalS: 30 }
    const long = { ...DEFAULT_CALM_SETTINGS, totalS: 90 }
    const logic = new CalmLogic()
    // 20 s at 30 s total: squirrel, rabbit, hedgehog and owl are out.
    run(logic, 20, QUIET, short)
    const { log, onStep } = comeOutLog()
    let hidingAgain = false
    run(logic, 70, QUIET, long, (t, output) => {
      onStep(t, output)
      if (ANIMAL_IDS.slice(0, 4).some((id) => output.targets[id] !== 'settled')) hidingAgain = true
    })
    expect(hidingAgain).toBe(false)
    // At 90 s total, the fox comes out at 73 s of calm and the fawn at 90 s.
    expect(log.fox).toBe(73 - 20)
    expect(log.fawn).toBe(90 - 20)
  })

  it('a shorter duration calls out at once the animals whose new time is passed', () => {
    const logic = new CalmLogic()
    const before = run(logic, 40, QUIET) // 90 s total: squirrel, rabbit and hedgehog are out
    expect(allTargets(before)).toEqual(['settled', 'settled', 'settled', 'hidden', 'hidden', 'hidden'])
    const after = logic.step(QUIET, DT, { ...DEFAULT_CALM_SETTINGS, totalS: 30 })
    expect(after.gauge).toBe(30)
    expect(after.allSettled).toBe(true)
  })

  it('a lower tolerance applies to the alert under way', () => {
    const logic = new CalmLogic()
    run(logic, 30, QUIET)
    const patient = { ...DEFAULT_CALM_SETTINGS, toleranceS: 1 }
    expect(run(logic, 0.75, MURMUR, patient).targets.squirrel).toBe('alert')
    const output = logic.step(MURMUR, DT, { ...DEFAULT_CALM_SETTINGS, toleranceS: 0.5 })
    expect(allTargets(output)).toEqual(hiddenAll)
  })
})

describe('reward signal [SPEC-9.5]', () => {
  it('holds while the six are out and the class is calm, not during an alert nor after a flight', () => {
    const logic = new CalmLogic()
    expect(run(logic, 90, QUIET).allSettled).toBe(true)
    expect(logic.step(MURMUR, DT, DEFAULT_CALM_SETTINGS).allSettled).toBe(false)
    expect(logic.step(QUIET, DT, DEFAULT_CALM_SETTINGS).allSettled).toBe(true)
    expect(logic.step(LOUD, DT, DEFAULT_CALM_SETTINGS).allSettled).toBe(false)
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

  it('imports no package, nothing outside the forest folder, no browser API', () => {
    const { files, packages } = importGraph()
    expect(packages).toEqual([])
    for (const path of files) {
      expect(relative(folder, path), path).not.toMatch(/^\.\./)
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/\b(window|document|navigator|performance|requestAnimationFrame|Date)\b/)
    }
    expect(files.map((path) => relative(folder, path)).sort()).toEqual(['animal-data.ts', 'calm.ts', 'layout.ts'])
  })
})
