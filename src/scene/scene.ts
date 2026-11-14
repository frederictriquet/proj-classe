// [SPEC-5.1] [SPEC-5.3] [SPEC-5.4] [SPEC-5.5] [SPEC-5.6] Scene window, on the projector: the
// sub-application alone. It runs the host (app and microphone) and obeys the control window over
// BroadcastChannel. The only thing it ever shows besides the app is the prompt to go full
// screen, for the adult, until the window is full screen.
import { errorMessage } from '../errors'
import type { HostDisplay, OpenedDisplay } from '../host/host'
import type { HostLink } from '../host/protocol'
import { serveHost, type FromScene, type ScenePort } from '../host/scene-link'
import type { FullscreenOptionsWithScreen, SceneParams, ScreenDetailed, WindowWithScreens } from '../screens/screen-api'

/** How often the scene checks that the control window is still there. */
const OPENER_POLL_MS = 1000

/** [SPEC-5.5] The app renders into a stage that fills the scene window. Unlike the single-screen
 *  display, it neither asks for full screen at each launch (no click reaches this window) nor
 *  stops the app when full screen ends: only the control window stops it [SPEC-5.1]. */
export class SceneDisplay implements HostDisplay {
  private stage: HTMLElement | undefined

  constructor(private readonly root: HTMLElement) {}

  open(): Promise<OpenedDisplay> {
    this.close()
    const stage = document.createElement('div')
    stage.className = 'app-stage'
    this.root.append(stage)
    this.stage = stage
    return Promise.resolve({ container: stage })
  }

  close(): void {
    this.stage?.remove()
    this.stage = undefined
  }
}

/** [SPEC-5.3] Projector screen chosen by the control window, when the permission is already
 *  granted: the scene never asks for a permission on the projector. */
async function projectorScreen(params: SceneParams): Promise<ScreenDetailed | undefined> {
  const win = window as WindowWithScreens
  const target = params.target
  if (!target || typeof win.getScreenDetails !== 'function' || !navigator.permissions?.query) return undefined
  const permission = await navigator.permissions.query({ name: 'window-management' as PermissionName })
  if (permission.state !== 'granted') return undefined
  const details = await win.getScreenDetails()
  return details.screens.find((s) => s.left === target.left && s.top === target.top)
}

export interface SceneOptions {
  /** Element that fills the scene window. */
  root: HTMLElement
  host: HostLink
  channel: ScenePort
  params: SceneParams
}

export function startScene({ root, host, channel, params }: SceneOptions): void {
  document.title = 'Proj-Classe : scène'
  const post = (message: FromScene) => channel.postMessage(message)

  // [SPEC-5.4] Full screen needs a click in this window when Chrome did not open it full screen.
  // The whole window is the button, so a click anywhere on the projector works.
  const prompt = document.createElement('button')
  prompt.type = 'button'
  prompt.className = 'scene-fullscreen'
  const promptText = document.createElement('span')
  promptText.textContent = 'Cliquer ici pour passer en plein écran'
  prompt.append(promptText)
  root.append(prompt)

  let projector: ScreenDetailed | undefined
  projectorScreen(params).then(
    (found) => {
      projector = found
    },
    (error: unknown) => post({ kind: 'error', message: `La scène ne retrouve pas l'écran du projecteur. ${errorMessage(error)}` }),
  )
  prompt.addEventListener('click', () => {
    // [SPEC-5.3] `screen`: full screen on the projector even if Chrome left the window elsewhere.
    const options: FullscreenOptionsWithScreen = { navigationUI: 'hide', ...(projector ? { screen: projector } : {}) }
    document.documentElement.requestFullscreen(options).catch((error: unknown) => {
      post({ kind: 'error', message: `La scène n'a pas pu passer en plein écran. ${errorMessage(error)}` })
    })
  })

  const showDisplay = () => {
    const fullscreen = document.fullscreenElement !== null
    prompt.hidden = fullscreen
    post({ kind: 'display', fullscreen })
  }
  document.addEventListener('fullscreenchange', showDisplay)

  // [SPEC-5.5] From now on the control window drives the host. Its goodbye closes the scene.
  serveHost(host, channel, () => window.close())
  showDisplay()

  // [SPEC-4.2] [SPEC-6.7] Closing the scene stops the app and gives the microphone back.
  window.addEventListener('pagehide', () => host.dispatch({ type: 'stop' }))

  // [SPEC-5.6] Control window gone without a goodbye (crash): the scene closes too.
  const opener = window.opener as Window | null
  if (opener) {
    window.setInterval(() => {
      if (opener.closed) window.close()
    }, OPENER_POLL_MS)
  }
}
