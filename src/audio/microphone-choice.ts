// [SPEC-6.8] Microphone chosen by the adult, kept in the common settings space [SPEC-7.1]. Pure:
// shared by the sound-level service, the settings panel and the diagnostic page.
import { ExplainedError } from '../errors'

/** A microphone the adult can choose. `id` is Chrome's `deviceId` for this origin. */
export interface MicrophoneInfo {
  id: string
  label: string
}

/** Key of the chosen microphone in the common settings space [SPEC-7.1]. */
export const MICROPHONE_KEY = 'microphone'

/** Chrome's pseudo-devices follow the macOS default input, not the device Chrome opens without a
 *  choice: listing them would show two different « default » microphones. */
const PSEUDO_DEVICE_IDS = new Set(['default', 'communications'])

/** [SPEC-6.8] Microphones to offer, from `enumerateDevices()`. Without the microphone permission
 *  Chrome gives entries with an empty id: they cannot be chosen. */
export function microphonesFrom(devices: readonly Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[]): MicrophoneInfo[] {
  return devices
    .filter((d) => d.kind === 'audioinput' && d.deviceId !== '' && !PSEUDO_DEVICE_IDS.has(d.deviceId))
    .map((d) => ({ id: d.deviceId, label: d.label || 'Micro sans nom' }))
}

/** Stored choice; null means « Micro choisi par Chrome » (also when never chosen). Throws an
 *  `ExplainedError` when the stored value is unreadable. */
export function parseMicrophoneChoice(stored: unknown): MicrophoneInfo | null {
  if (stored === undefined || stored === null) return null
  if (typeof stored === 'object') {
    const { id, label } = stored as Record<string, unknown>
    if (typeof id === 'string' && id !== '' && typeof label === 'string') return { id, label }
  }
  throw new ExplainedError(
    "Micro choisi enregistré illisible : le micro choisi par Chrome est utilisé. Choisissez le micro dans les réglages de l'activité.",
  )
}
