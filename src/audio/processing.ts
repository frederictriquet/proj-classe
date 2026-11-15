// [SPEC-6.1] Raw microphone signal: Chrome's echo cancellation, noise suppression and automatic
// gain are turned off, because the automatic gain distorts the measure. Shared by the
// sound-level service and the diagnostic page.
import type { MicrophoneInfo } from './microphone-choice'

export const RAW_AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const satisfies MediaTrackConstraints

/** [SPEC-6.1] [SPEC-6.8] Constraints of the capture: raw signal, from the chosen microphone or,
 *  when none is chosen, from the one Chrome picks. */
export function rawAudioConstraints(microphone: MicrophoneInfo | null): MediaTrackConstraints {
  return microphone === null ? { ...RAW_AUDIO_CONSTRAINTS } : { ...RAW_AUDIO_CONSTRAINTS, deviceId: { exact: microphone.id } }
}

const PROCESSING_KEYS = ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const

export interface ProcessingReport {
  /** One line per processing, as reported by `track.getSettings()`. */
  lines: string[]
  /** True when the three are reported and off. */
  allOff: boolean
}

/** [SPEC-6.1] What `track.getSettings()` says about the three processings. */
export function processingReport(settings: MediaTrackSettings): ProcessingReport {
  const lines = PROCESSING_KEYS.map((key) => `${key} : ${settings[key] === undefined ? 'non signalé' : String(settings[key])}`)
  return { lines, allOff: PROCESSING_KEYS.every((key) => settings[key] === false) }
}

/** [SPEC-6.1] French warning for the adult when a processing is still on or not reported. */
export function processingWarning(settings: MediaTrackSettings): string | undefined {
  const report = processingReport(settings)
  if (report.allOff) return undefined
  return `Chrome n'a pas désactivé tous les traitements audio : la mesure peut être faussée.\n${report.lines.join('\n')}`
}
