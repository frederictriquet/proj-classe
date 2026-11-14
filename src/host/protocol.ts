// [SPEC-5.1] [SPEC-5.5] Messages between the control side (menu, settings panel) and the host
// that runs the sub-application. In single-screen mode both live in the same window
// [SPEC-5.2]; with two screens they are carried between windows by BroadcastChannel. Every
// message is plain data (no function, no Error, no DOM node) so it survives structuredClone.
import type { SettingValue, SettingValues } from '../apps/types'

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
}

/** What the control side needs: send commands, receive states. In one window the host itself
 *  implements it; with two screens a BroadcastChannel link will [SPEC-5.5]. `subscribe` calls
 *  the listener at once with the current state. */
export interface HostLink {
  dispatch(command: HostCommand): void
  subscribe(listener: (state: HostState) => void): () => void
}
