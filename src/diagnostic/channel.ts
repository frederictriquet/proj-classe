// Messages between the diagnostic page and the test window opened on the other screen.

export const DIAGNOSTIC_CHANNEL = 'proj-classe-diagnostic'

export type SceneTestMessage =
  | {
      type: 'scene-test-status'
      fullscreen: boolean
      fps: string
      minFps: number | undefined
      width: number
      height: number
    }
  | { type: 'scene-test-closed' }
