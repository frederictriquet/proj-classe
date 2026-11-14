// [SPEC-6.2] Pure level computation, shared by the diagnostic and the future sound-level service.

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
