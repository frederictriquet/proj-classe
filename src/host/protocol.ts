// [SPEC-5.1] [SPEC-5.5] Messages between the control side (menu, settings panel) and the host
// that runs the sub-application. In single-screen mode both live in the same window
// [SPEC-5.2]; with two screens they are carried between windows by BroadcastChannel. Every
// message is plain data (no function, no Error, no DOM node) so it survives structuredClone.
import type { SettingValue, SettingValues } from '../apps/types'
import type { MicrophoneInfo } from '../audio/microphone-choice'
import type { SoundReading, SoundStatus } from '../audio/sound-service'

export type HostCommand =
  /** Start an app from the menu. Ignored while another app is starting or running. */
  | { type: 'launch'; appId: string }
  /** Stop the current app and go back to the menu. Ignored on the menu. */
  | { type: 'stop' }
  /** Change one setting; applied at once to the running app [SPEC-7.2]. */
  | { type: 'set-setting'; appId: string; settingId: string; value: SettingValue }
  /** Back to the declared defaults [SPEC-7.4]. */
  | { type: 'reset-settings'; appId: string }
  /** Hide the current notice. */
  | { type: 'dismiss-notice' }
  /** Ask the host to send its state again (a control window that just opened). */
  | { type: 'request-state' }
  /** [SPEC-7.5] The settings panel shows the live level: keep the microphone open while `on`. */
  | { type: 'monitor-sound'; on: boolean }
  /** [SPEC-6.3] Measure the ambient noise for 3 seconds and keep it. */
  | { type: 'calibrate' }
  /** [SPEC-6.8] Microphone to use from now on; null for the one Chrome picks. */
  | { type: 'choose-microphone'; microphone: MicrophoneInfo | null }
  /** [SPEC-6.5] Level of the simulated source, in dBFS. Rejected with the real microphone. */
  | { type: 'simulate-level'; db: number }

export type HostPhase = 'menu' | 'starting' | 'running'

/** Message for the adult, shown on the menu. */
export interface HostNotice {
  /** 'need': a declared need is not met [SPEC-4.7]; 'error': the app failed [SPEC-4.8];
   *  'warning': the app ran but something went wrong (full screen refused). */
  kind: 'need' | 'error' | 'warning'
  appId: string
  /** French text that says what happened and what to do. */
  message: string
}

export interface HostState {
  phase: HostPhase
  /** App starting or running, null on the menu. */
  appId: string | null
  /** Current settings of every app on the menu, keyed by app id. */
  settings: Record<string, SettingValues>
  notice: HostNotice | null
  /** [SPEC-6] Sound-level service: microphone open or not, calibration, errors. */
  sound: SoundStatus
}

/** What the control side needs: send commands, receive states. In one window the host itself
 *  implements it; with two screens a BroadcastChannel link will [SPEC-5.5]. `subscribe` calls
 *  the listener at once with the current state. */
export interface HostLink {
  dispatch(command: HostCommand): void
  subscribe(listener: (state: HostState) => void): () => void
  /** [SPEC-5.5] [SPEC-7.5] Live sound level, every frame while the microphone is open. Kept out
   *  of HostState: it changes 60 times a second. */
  subscribeLevel(listener: (reading: SoundReading) => void): () => void
}
