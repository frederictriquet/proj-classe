// [SPEC-6.2] [SPEC-6.3] Pure level computation, shared by the diagnostic and the sound-level
// service: RMS, dBFS, smoothing and calibration. No DOM, no Web Audio: tested with synthetic signals.

export const DBFS_FLOOR = -100

/** Root mean square of a block of samples in [-1, 1]. */
export function computeRms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0
    sum += s * s
  }
  return Math.sqrt(sum / samples.length)
}

/** RMS converted to dBFS (0 dBFS = full-scale sine peak of 1), clamped to a floor for silence. */
export function rmsToDbfs(rms: number, floor = DBFS_FLOOR): number {
  if (rms <= 0) return floor
  return Math.max(floor, 20 * Math.log10(rms))
}

/** [SPEC-6.2] Time constant of the smoothing when the level rises: a noise shows at once. */
export const RISE_TIME_MS = 50
/** [SPEC-6.2] Time constant when the level falls: slower, so the level does not flicker. */
export const FALL_TIME_MS = 500

/**
 * [SPEC-6.2] One smoothing step: exponential approach of `target` (dBFS) during `dtMs`, with a
 * fast time constant upwards and a slower one downwards. Driven by the elapsed time rather than
 * by a per-frame factor, so it behaves the same at 60 and 120 frames per second.
 */
export function smoothLevel(
  previous: number,
  target: number,
  dtMs: number,
  riseMs = RISE_TIME_MS,
  fallMs = FALL_TIME_MS,
): number {
  if (dtMs <= 0) return previous
  const tau = target > previous ? riseMs : fallMs
  return previous + (target - previous) * (1 - Math.exp(-dtMs / tau))
}

/** [SPEC-6.3] Duration of the ambient noise measure. */
export const CALIBRATION_MS = 3000

/** [SPEC-6.3] Ambient noise used before any calibration, in dBFS: a quiet room heard by the
 *  built-in microphone of a MacBook with the audio processing off. */
export const DEFAULT_AMBIENT_DBFS = -60

/**
 * [SPEC-6.3] Ambient noise from the per-frame levels (dBFS) measured during the calibration.
 * The median is used, so that a short noise (a cough, a chair) does not raise it.
 * Throws a French message when the measure cannot be used.
 */
export function ambientFromReadings(readings: readonly number[]): number {
  if (readings.length === 0) throw new Error('Aucune mesure reçue du micro pendant le calibrage.')
  const sorted = [...readings].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1 ? (sorted[middle] ?? DBFS_FLOOR) : ((sorted[middle - 1] ?? DBFS_FLOOR) + (sorted[middle] ?? DBFS_FLOOR)) / 2
  if (median <= DBFS_FLOOR + 1) {
    throw new Error(
      "Le micro ne capte aucun son (niveau au plancher). Vérifiez qu'il n'est pas coupé dans Réglages Système > Son > Entrée, puis recalibrez.",
    )
  }
  return median
}

/** [SPEC-6.3] [SPEC-7.1] Calibration kept in the common settings space. */
export interface Calibration {
  ambientDb: number
  /** ISO date of the measure. */
  date: string
}

/** Stored calibration if usable, `undefined` when never calibrated; throws a French message
 *  when the stored value is unreadable. */
export function parseCalibration(stored: unknown): Calibration | undefined {
  if (stored === undefined) return undefined
  if (typeof stored === 'object' && stored !== null) {
    const { ambientDb, date } = stored as Record<string, unknown>
    if (
      typeof ambientDb === 'number' &&
      Number.isFinite(ambientDb) &&
      ambientDb > DBFS_FLOOR &&
      ambientDb <= 0 &&
      typeof date === 'string'
    ) {
      return { ambientDb, date }
    }
  }
  throw new Error('Calibrage enregistré illisible : le bruit ambiant par défaut est utilisé. Recalibrez depuis les réglages.')
}
