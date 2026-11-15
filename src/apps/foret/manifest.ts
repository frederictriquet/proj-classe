// [SPEC-4.1] [SPEC-9.1] « Forêt du silence »: animals come out when the class is quiet and hide
// at the noise. The forest makes no sound; it listens to the microphone.
//
// [SPEC-9.6] The three settings, applied at once [SPEC-7.2]. Kept free of the calm logic so the
// menu stays light: manifest.test.ts checks that the defaults are DEFAULT_CALM_SETTINGS and the
// flight mark is `fleeThresholdDb` (calm.ts). The sensitivity goes up to 80 dB so the slider never
// stops the adult from tolerating more noise: high values are out of the microphone's reach.
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

/** Setting ids, read by app.ts. */
export const SETTING = {
  /** Alert threshold, dB above the ambient noise: the lower, the more sensitive. */
  alertDb: 'alertDb',
  /** Seconds of calm for all six animals to be there. */
  totalS: 'totalS',
  /** Longest alert, in seconds, that does not make the animals flee. */
  toleranceS: 'toleranceS',
} as const

export const manifest: AppManifest = {
  id: 'foret',
  title: 'Forêt du silence',
  thumbnail,
  needs: ['microphone'],
  settings: [
    {
      type: 'slider',
      id: SETTING.alertDb,
      // [SPEC-7.5] Shown under the live level, whose first mark is this slider's value.
      label: 'Sensibilité : les animaux sortent tant que le niveau reste à gauche du premier trait, et fuient au-delà du second',
      min: 2,
      max: 80,
      step: 1,
      default: 6,
      unit: 'dB',
    },
    {
      type: 'slider',
      id: SETTING.totalS,
      label: 'Durée de calme pour que les six animaux soient là',
      min: 30,
      max: 300,
      step: 10,
      default: 90,
      unit: 's',
    },
    {
      type: 'slider',
      id: SETTING.toleranceS,
      label: "Tolérance d'alerte : durée d'un bruit moyen avant la fuite",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.5,
      unit: 's',
    },
  ],
  // [SPEC-9.6] [SPEC-7.5] Both thresholds on the live level; the flight threshold is the alert
  // threshold + 6 dB.
  soundThresholds: [
    { label: 'Alerte', setting: SETTING.alertDb },
    { label: 'Fuite', setting: SETTING.alertDb, offsetDb: 6 },
  ],
  // [SPEC-9.4] [SPEC-9.6] The zones of the calm logic, in words for the adult.
  soundZones: ['Calme : les animaux sortent', 'Alerte : les animaux se figent, puis fuient si ça dure', 'Trop de bruit : les animaux fuient'],
}
