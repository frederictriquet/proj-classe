import { describe, expect, it } from 'vitest'
import { ExplainedError } from '../errors'
import {
  ambientFromReadings,
  computeRms,
  DBFS_FLOOR,
  parseCalibration,
  RISE_TIME_MS,
  rmsToDbfs,
  smoothLevel,
} from './level'

const SAMPLE_RATE = 48000
const BLOCK = 2048

/** Block of a sine wave of the given peak amplitude. */
function sine(amplitude: number, frequency = 440, length = BLOCK, offset = 0): Float32Array {
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * (i + offset)) / SAMPLE_RATE))
}

/** Deterministic white noise (linear congruential generator), uniform in [-amplitude, amplitude]. */
function noise(amplitude: number, seed: number, length = BLOCK): Float32Array {
  let state = seed >>> 0
  return Float32Array.from({ length }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return amplitude * ((state / 2 ** 32) * 2 - 1)
  })
}

/** dBFS of a block, as the microphone source computes it. */
const blockDb = (samples: Float32Array) => rmsToDbfs(computeRms(samples))

/** Frame duration at 60 frames per second. */
const FRAME_MS = 1000 / 60

describe('computeRms', () => {
  it('returns 0 for silence and for an empty block', () => {
    expect(computeRms(new Float32Array(128))).toBe(0)
    expect(computeRms(new Float32Array(0))).toBe(0)
  })

  it('returns the amplitude of a constant signal', () => {
    expect(computeRms(new Float32Array(64).fill(0.5))).toBeCloseTo(0.5, 6)
  })

  it('returns amplitude / sqrt(2) for a sine wave', () => {
    expect(computeRms(sine(0.8, 440, 4800))).toBeCloseTo(0.8 / Math.SQRT2, 3)
  })

  it('returns amplitude / sqrt(3) for uniform white noise', () => {
    expect(computeRms(noise(0.3, 7, 48000))).toBeCloseTo(0.3 / Math.sqrt(3), 2)
  })
})

describe('rmsToDbfs', () => {
  it('maps full scale to 0 dBFS and halving to about -6 dB', () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0, 6)
    expect(rmsToDbfs(0.5)).toBeCloseTo(-6.0206, 3)
  })

  it('clamps silence and very low levels to the floor', () => {
    expect(rmsToDbfs(0)).toBe(DBFS_FLOOR)
    expect(rmsToDbfs(1e-9)).toBe(DBFS_FLOOR)
  })

  it('gives the expected level for synthetic sines: 20·log10(A/√2)', () => {
    expect(blockDb(sine(1, 1000, 4800))).toBeCloseTo(-3.01, 1)
    expect(blockDb(sine(0.01, 1000, 4800))).toBeCloseTo(-43.01, 1)
    // Ten times the amplitude: +20 dB.
    expect(blockDb(sine(0.1, 1000, 4800)) - blockDb(sine(0.01, 1000, 4800))).toBeCloseTo(20, 1)
  })
})

describe('smoothLevel [SPEC-6.2]', () => {
  /** Runs the smoothing over `ms` of 60 fps frames towards `target`. */
  function run(start: number, target: number, ms: number, frameMs = FRAME_MS): number {
    let level = start
    for (let t = 0; t < ms - 1e-9; t += frameMs) level = smoothLevel(level, target, Math.min(frameMs, ms - t))
    return level
  }

  /** Time for the level to get within 1 dB of the target. */
  function timeToReach(start: number, target: number, frameMs = FRAME_MS): number {
    let level = start
    let t = 0
    while (Math.abs(level - target) > 1) {
      level = smoothLevel(level, target, frameMs)
      t += frameMs
    }
    return t
  }

  it('does not move without elapsed time', () => {
    expect(smoothLevel(-60, -20, 0)).toBe(-60)
  })

  it('covers 63 % of a rise in one rise time constant', () => {
    expect(run(-60, -20, RISE_TIME_MS)).toBeCloseTo(-60 + 40 * (1 - Math.exp(-1)), 1)
  })

  it('rises fast and falls more slowly', () => {
    const rise = timeToReach(-60, -20)
    const fall = timeToReach(-20, -60)
    expect(rise).toBeLessThan(250)
    expect(fall).toBeGreaterThan(1000)
    expect(fall / rise).toBeGreaterThan(5)
  })

  it('behaves the same at 60 and 120 frames per second', () => {
    expect(run(-60, -20, 200, 1000 / 120)).toBeCloseTo(run(-60, -20, 200, 1000 / 60), 6)
    expect(run(-20, -60, 800, 1000 / 120)).toBeCloseTo(run(-20, -60, 800, 1000 / 60), 6)
  })

  it('follows a synthetic clap: up within 10 frames, back down within about two seconds', () => {
    const quiet = blockDb(noise(0.001, 1)) // about -65 dBFS
    const clap = blockDb(sine(0.5, 1000)) // about -9 dBFS
    let level = quiet
    for (let frame = 0; frame < 10; frame++) level = smoothLevel(level, clap, FRAME_MS)
    expect(level).toBeGreaterThan(clap - 3)
    let t = 0
    while (level > quiet + 3) {
      level = smoothLevel(level, quiet, FRAME_MS)
      t += FRAME_MS
    }
    expect(t).toBeGreaterThan(1000)
    expect(t).toBeLessThan(2500)
  })
})

describe('ambientFromReadings [SPEC-6.3]', () => {
  /** 3 s of frames: per-frame dBFS of noise blocks of the given amplitude. */
  function frames(amplitude: number, count = 180, seed = 11): number[] {
    return Array.from({ length: count }, (_, i) => blockDb(noise(amplitude, seed + i)))
  }

  it('gives the level of a steady room noise', () => {
    const expected = rmsToDbfs(0.002 / Math.sqrt(3))
    expect(ambientFromReadings(frames(0.002))).toBeCloseTo(expected, 0)
  })

  it('ignores a short noise during the measure (a cough, a chair)', () => {
    const room = frames(0.002)
    const withCough = room.map((db, i) => (i >= 60 && i < 90 ? blockDb(sine(0.3, 300)) : db))
    expect(ambientFromReadings(withCough)).toBeCloseTo(ambientFromReadings(room), 0)
  })

  it('takes the middle of an even number of readings', () => {
    expect(ambientFromReadings([-50, -40, -60, -70])).toBe(-55)
  })

  it('refuses a measure stuck at the floor (microphone muted)', () => {
    expect(() => ambientFromReadings(frames(0))).toThrow(/aucun son.*menu « Micro »/s)
    expect(() => ambientFromReadings([])).toThrow(/Aucune mesure/)
    // [SPEC-6.6] Explained errors: shown without the technical error name.
    expect(() => ambientFromReadings(frames(0))).toThrow(ExplainedError)
    expect(() => ambientFromReadings([])).toThrow(ExplainedError)
  })
})

describe('parseCalibration [SPEC-6.3] [SPEC-7.1]', () => {
  it('reads a stored calibration and treats an absent one as never calibrated', () => {
    expect(parseCalibration({ ambientDb: -58.5, date: '2026-11-14T09:00:00.000Z' })).toEqual({
      ambientDb: -58.5,
      date: '2026-11-14T09:00:00.000Z',
    })
    expect(parseCalibration(undefined)).toBeUndefined()
  })

  it('rejects unreadable values with a French message', () => {
    for (const stored of [null, 'x', { ambientDb: 'loud', date: 'd' }, { ambientDb: 5, date: 'd' }, { ambientDb: -100, date: 'd' }, { ambientDb: -50 }]) {
      expect(() => parseCalibration(stored)).toThrow(/Recalibrez/)
      expect(() => parseCalibration(stored)).toThrow(ExplainedError)
    }
  })
})
