import './style.css'
import { APP_REGISTRY } from './apps/registry'
import { MicrophoneSource } from './audio/microphone-source'
import { isSimulationRequested, listenSimulationKeys, SimulatedSource } from './audio/simulated-source'
import { SoundService, type SoundReading } from './audio/sound-service'
import type { LevelSource } from './audio/source'
import { errorMessage } from './errors'
import { FullscreenDisplay } from './host/fullscreen-display'
import { AppHost, type HostDisplay } from './host/host'
import type { HostCommand, HostState } from './host/protocol'
import { sceneChannelName, type FromScene } from './host/scene-link'
import { SwitchableLink } from './host/switchable-link'
import { listenForInstallPrompt } from './pwa/install'
import { registerServiceWorker } from './pwa/register'
import { requestPersistentStorage } from './pwa/storage'
import { browserProjectionEnv, Projection, type ProjectionState } from './screens/projection'
import { parseSceneHash, type SceneParams } from './screens/screen-api'
import { SceneDisplay, startScene } from './scene/scene'
import { SettingsStore } from './settings/settings'

const root = document.getElementById('app')
if (!root) throw new Error('#app element missing')
const appRoot: HTMLElement = root

/** The host and the services it runs on, built the same way in both windows. */
function createHost(display: HostDisplay, onProblem: (message: string) => void) {
  const settings = new SettingsStore(localStorage, onProblem)
  // [SPEC-6.5] `?micro=simule` replaces the microphone with a level driven by the keyboard
  // (+ and −) and by a slider of the settings panel. Read once, at start-up.
  const simulated = isSimulationRequested(location.search) ? new SimulatedSource() : undefined
  const source: LevelSource = simulated ?? new MicrophoneSource()
  const sound = new SoundService({ source, settings, onProblem })
  const host = new AppHost({ registry: APP_REGISTRY, settings, display, sound })
  // [SPEC-4.8] While an app runs, an uncaught error is its own: the host stops it and the menu
  // shows the message. Otherwise the error goes to `onProblem`.
  const onUncaught = (error: unknown) => {
    if (!host.fail(error)) onProblem(errorMessage(error))
  }
  window.addEventListener('error', (event) => onUncaught(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => onUncaught(event.reason))
  return { host, sound, simulated }
}

/** [SPEC-5.1] [SPEC-5.5] Scene window on the projector: runs the apps, shows nothing else. Its
 *  errors are sent to the control window, never shown to the children. */
function runScene(params: SceneParams): void {
  const channel = new BroadcastChannel(sceneChannelName(params.channel))
  const report = (message: string) => channel.postMessage({ kind: 'error', message } satisfies FromScene)
  const scene = document.createElement('div')
  scene.className = 'scene'
  appRoot.append(scene)
  const { host, simulated } = createHost(new SceneDisplay(scene), report)
  if (simulated) listenSimulationKeys(simulated)
  startScene({ root: scene, host, channel, params })
}

/** [SPEC-5.2] [SPEC-5.3] Control window (régie): menu, settings, live level. With one screen it
 *  also shows the app full screen; with two, the scene window does. */
function runControl(): void {
  // Any uncaught error is shown on screen, not only in the console.
  const banner = document.getElementById('error-banner')
  const showError = (message: string) => {
    if (!banner) return
    banner.textContent = `Erreur : ${message}`
    banner.hidden = false
  }

  const display = new FullscreenDisplay(() => host.dispatch({ type: 'stop' }))
  const { host, sound, simulated } = createHost(display, showError)
  const link = new SwitchableLink(host)
  const projection = new Projection({
    env: browserProjectionEnv(),
    local: host,
    link,
    onSingle: () => {
      host.reloadSettings()
      sound.reloadCalibration()
    },
    onSceneError: (message) => showError(`fenêtre de la scène : ${message}`),
  })
  // [SPEC-5.6] The control window closes or reloads: the scene goes with it.
  window.addEventListener('pagehide', () => projection.dispose())

  if (simulated) {
    // [SPEC-6.5] With two screens, + and − typed here set the level of the scene's source.
    listenSimulationKeys(simulated, window, (db) => {
      if (projection.state.mode === 'dual') link.dispatch({ type: 'simulate-level', db })
    })
    // Keeps the local level equal to the scene's, so that + and − start from what is shown.
    link.subscribeLevel((reading) => simulated.setLevel(reading.rawDb))
  }

  if (import.meta.env.DEV) {
    let lastReading: SoundReading | undefined
    link.subscribeLevel((reading) => (lastReading = reading))
    // Development hook: drives the menu's link, so it reaches the scene with two screens [SPEC-5.5].
    ;(window as unknown as { __projClasse: unknown }).__projClasse = {
      dispatch: (command: HostCommand) => link.dispatch(command),
      state: (): HostState => link.state,
      /** Last frame measured by the sound-level service [SPEC-6.4], undefined before the first. */
      level: (): SoundReading | undefined => lastReading,
      projection: (): ProjectionState => projection.state,
    }
  }

  registerServiceWorker() // [SPEC-3.1]
  listenForInstallPrompt() // [SPEC-3.5]
  void requestPersistentStorage() // [SPEC-3.2]

  let dispose: (() => void) | undefined
  let renderId = 0

  async function route(): Promise<void> {
    const id = ++renderId
    dispose?.()
    dispose = undefined
    const hash = location.hash
    let next: () => void
    // Views are loaded on demand so that PixiJS is not part of the start-up bundle.
    if (hash === '#diagnostic') next = (await import('./diagnostic/diagnostic')).renderDiagnostic(appRoot)
    else if (hash === '#scene-test') next = (await import('./diagnostic/scene-test')).renderSceneTest(appRoot)
    else next = (await import('./menu/menu')).renderMenu(appRoot, APP_REGISTRY, link, projection)
    if (id !== renderId) next()
    else dispose = next
  }

  const onRouteError = (error: unknown) => showError(errorMessage(error))
  window.addEventListener('hashchange', () => void route().catch(onRouteError))
  route().catch(onRouteError)
}

// [SPEC-5.1] One code, two roles: the address of the scene window carries `#scene?canal=…`.
// The scene does not register the service worker: an update never reloads it during an app.
const sceneParams = parseSceneHash(location.hash)
if (sceneParams) runScene(sceneParams)
else runControl()
