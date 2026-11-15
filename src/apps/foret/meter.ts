// [SPEC-9.7] Mini sound meter of « Forêt du silence », for the adult: where the live difference to
// the ambient noise [SPEC-6.4] and the two thresholds [SPEC-9.6] lie on a fixed scale. A pure
// module, free of PixiJS; meter-art.ts draws it.
import { fleeThresholdDb } from './calm'

export const METER = {
  /** Bottom of the scale, in dB above the ambient noise: a room quieter than at calibration. */
  minDb: -6,
  /** Top of the scale, in dB above the ambient noise. Above the highest flight threshold
   *  (sensitivity slider at 80 dB, + 6 dB): every mark stays inside the bar. */
  maxDb: 90,
  /** Bar width, in CSS pixels. */
  width: 6,
  /** Bar height, as a share of the screen height. */
  heightShare: 0.25,
  /** Gap between the bar and the left and bottom edges of the screen, in CSS pixels. */
  margin: 16,
  /** How far a threshold mark sticks out on each side of the bar, in CSS pixels. */
  markOverhang: 3,
  /** Thickness of a threshold mark, in CSS pixels. */
  markThickness: 2,
  /** Ink border around a mark, in CSS pixels: `sun` alone hardly shows on the grass. */
  markBorder: 1,
} as const

/** Height of a level on the bar, from 0 (bottom) to 1 (top), clamped to the scale. */
export function meterFraction(aboveAmbientDb: number): number {
  const fraction = (aboveAmbientDb - METER.minDb) / (METER.maxDb - METER.minDb)
  return Math.min(1, Math.max(0, fraction))
}

/** [SPEC-9.6] Heights of the alert and flight marks for the current sensitivity. */
export function meterMarks(alertDb: number): { alert: number; flee: number } {
  return { alert: meterFraction(alertDb), flee: meterFraction(fleeThresholdDb(alertDb)) }
}
