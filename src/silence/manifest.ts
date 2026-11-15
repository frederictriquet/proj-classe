// [SPEC-4.1] [SPEC-9.6] [SPEC-9.8] [SPEC-13.1.1] [SPEC-14.1.1] Card of an activity of silence:
// animals come out when the class is quiet and hide at the noise. The activity makes no sound; it
// listens to the microphone.
//
// [SPEC-9.6] The four settings, applied at once [SPEC-7.2]. Kept free of the calm logic so the
// menu stays light: manifest.test.ts checks that the defaults are DEFAULT_CALM_SETTINGS and the
// flight mark is `fleeThresholdDb` (calm.ts). The sensitivity goes up to 80 dB so the slider never
// stops the adult from tolerating more noise: high values are out of the microphone's reach.
import type { AppManifest } from '../apps/types'

/** Setting ids, read by app.ts. */
export const SETTING = {
  /** Alert threshold, dB above the ambient noise: the lower, the more sensitive. */
  alertDb: 'alertDb',
  /** Seconds of calm before the first animal. Keep the former total-duration storage id so
   *  an adult's saved value (including 300 s) becomes the initial delay. */
  firstS: 'totalS',
  /** Seconds of calm between two successive animals. */
  intervalS: 'intervalS',
  /** Longest alert, in seconds, that does not make the animals flee. */
  toleranceS: 'toleranceS',
} as const

/** What tells one activity of silence from another on the menu. */
export interface SilenceCard {
  /** Same as the folder name under `src/apps/`. */
  id: string
  /** Title shown to the adult on the menu, in French. */
  title: string
  /** URL of the menu thumbnail. */
  thumbnail: string
  /** First animal, with its article, for the initial-delay label (e.g. « l’écureuil »). */
  firstAnimal: string
}

export function silenceManifest(card: SilenceCard): AppManifest {
  const { id, title, thumbnail } = card
  return {
    id,
    title,
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
        id: SETTING.firstS,
        label: `Délai de calme avant ${card.firstAnimal}`,
        min: 5,
        max: 300,
        step: 5,
        default: 90,
        unit: 's',
      },
      {
        type: 'slider',
        id: SETTING.intervalS,
        label: 'Délai de calme entre deux animaux',
        min: 5,
        max: 300,
        step: 5,
        default: 30,
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
}
