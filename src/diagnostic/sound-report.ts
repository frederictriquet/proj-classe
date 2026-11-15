// [SPEC-7.5] [SPEC-6.3] [SPEC-6.8] What the settings panel no longer shows in dB, for the
// diagnostic page: the chosen microphone, the calibrated ambient noise and the thresholds of each
// app that listens to the classroom. Pure: no DOM.
import type { AppManifest, SettingValues } from '../apps/types'
import { DEFAULT_AMBIENT_DBFS, type Calibration } from '../audio/level'
import type { MicrophoneInfo } from '../audio/microphone-choice'
import { formatDb, thresholdMarks, thresholdText } from '../menu/sound-section'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export function microphoneChoiceText(microphone: MicrophoneInfo | null): string {
  return microphone === null ? 'micro choisi par Chrome (aucun choix dans les réglages)' : `« ${microphone.label} »`
}

export function ambientText(calibration: Calibration | undefined): string {
  if (calibration === undefined) return `${formatDb(DEFAULT_AMBIENT_DBFS)} (valeur par défaut, pas encore calibré)`
  return `${formatDb(calibration.ambientDb)} (calibré le ${dateFormat.format(new Date(calibration.date))})`
}

/** One line per threshold of the app, with its current settings and the ambient noise in use. */
export function appThresholdsText(manifest: AppManifest, values: SettingValues, ambientDb: number): string {
  const marks = thresholdMarks(manifest.soundThresholds ?? [], values, ambientDb)
  return [manifest.title, ...marks.map(thresholdText)].join('\n')
}
