// [SPEC-5.2] [SPEC-5.3] [SPEC-5.4] [SPEC-5.5] [SPEC-5.6] Control window side of the two-screen mode.
// It offers « Projeter » when a second screen is there, opens the scene window on it, hands the
// menu over to the scene once the scene has sent its first state, and takes it back when the
// scene closes or the screen goes away.
import { errorMessage } from '../errors'
import type { HostLink, HostState } from '../host/protocol'
import { RemoteHostLink, sceneChannelName, type FromScene, type ScenePort, type ToScene } from '../host/scene-link'
import type { SwitchableLink } from '../host/switchable-link'
import {
  otherScreen,
  sceneFeatures,
  sceneUrl,
  SCENE_WINDOW_NAME,
  type SceneParams,
  type ScreenDetails,
  type ScreenWithExtended,
  type WindowWithScreens,
} from './screen-api'

/** How often the control window checks that the scene window is still open. */
export const CLOSED_POLL_MS = 500
/** Time the scene window has to send its first state. */
export const CONNECT_TIMEOUT_MS = 10_000

export const BLOCKED_TEXT =
  "Chrome a bloqué l'ouverture de la fenêtre de la scène. Cliquez de nouveau sur « Projeter ». Si cela se répète, autorisez les fenêtres pop-up pour ce site (icône à droite de la barre d'adresse)."
export const CLOSED_TEXT = "La fenêtre de la scène a été fermée : l'application repasse sur un seul écran."
export const LOST_TEXT =
  "Le second écran a été débranché ou mis en recopie vidéo : la scène est fermée et l'application repasse sur un seul écran."
export const TIMEOUT_TEXT = `La fenêtre de la scène n'a pas répondu en ${CONNECT_TIMEOUT_MS / 1000} secondes : elle a été fermée. Cliquez de nouveau sur « Projeter ».`
export const NO_API_TEXT = 'Placement automatique impossible : ce navigateur ne sait pas placer une fenêtre sur un autre écran.'
export const DENIED_TEXT =
  "Placement automatique impossible : Chrome n'a pas l'autorisation de gérer les fenêtres sur tous vos écrans. Pour la donner : icône à gauche de la barre d'adresse, « Gestion des fenêtres » sur Autoriser, puis « Fermer la scène » et de nouveau « Projeter »."
export const ONE_SCREEN_TEXT = "Placement automatique impossible : Chrome ne détecte qu'un seul écran."

/** The part of BroadcastChannel used here. */
export interface SceneChannel extends ScenePort {
  close(): void
}

/** The part of the scene window the control window uses. */
export interface SceneWindow {
  readonly closed: boolean
  close(): void
}

/** Browser services, injected so the tests can play screens, refusals and closed windows. */
export interface ProjectionEnv {
  /** `screen.isExtended`; undefined when Chrome does not expose it. */
  isExtended(): boolean | undefined
  /** Calls the listener when the screens change. Returns a remover. */
  onScreenChange(listener: () => void): () => void
  /** State of the window-management permission, undefined when it cannot be queried. */
  queryPermission(): Promise<PermissionState | undefined>
  /** `window.getScreenDetails`, undefined when the API is absent. */
  getScreenDetails: (() => Promise<ScreenDetails>) | undefined
  open(url: string, name: string, features: string): SceneWindow | null
  createChannel(name: string): SceneChannel
  sceneUrl(params: SceneParams): string
  newId(): string
}

export type ProjectionMode = 'single' | 'opening' | 'dual'

export interface ProjectionState {
  /** 'single': this window plays both roles [SPEC-5.2]; 'opening': the scene window is open and
   *  has not answered yet; 'dual': the scene runs the apps, this window is the remote [SPEC-5.5]. */
  mode: ProjectionMode
  /** [SPEC-5.3] A second screen is there (extended desktop): « Projeter » is offered. */
  available: boolean
  /** The scene window was opened on the projector by the API [SPEC-5.3]; false in the fallback,
   *  where the adult drags it [SPEC-5.4]. */
  placed: boolean
  /** Name of the projector screen, when Chrome gives one. */
  screenLabel: string | null
  /** The scene window reported that it is full screen. */
  sceneFullscreen: boolean
  /** French message for the adult about the last event (window blocked, scene closed…). */
  notice: string | null
}

export interface ProjectionOptions {
  env: ProjectionEnv
  /** Host of this window, used in single-screen mode [SPEC-5.2]. */
  local: HostLink
  /** Link of the menu and panels, switched between the local host and the scene. */
  link: SwitchableLink
  /** Called before the local host takes over again: the scene may have changed the stored
   *  settings and calibration meanwhile [SPEC-5.6]. */
  onSingle: () => void
  /** French text of an error that happened in the scene window [SPEC-5.1]. */
  onSceneError: (message: string) => void
}

interface Session {
  channel: SceneChannel
  popup: SceneWindow
  /** Set when the scene sent its first state. */
  remote?: RemoteHostLink
  stopTimers: () => void
}

/** Line shown on the control window about the scene, or null in single-screen mode. */
export function projectionStatus(state: ProjectionState): string | null {
  if (state.mode === 'single') return null
  if (state.mode === 'opening') return 'Ouverture de la scène…'
  if (state.sceneFullscreen) {
    return state.screenLabel ? `Scène projetée en plein écran sur « ${state.screenLabel} ».` : 'Scène projetée en plein écran.'
  }
  // [SPEC-5.4] Fallback, or Chrome did not honour the full-screen window.
  if (!state.placed) return 'Glissez la fenêtre de la scène sur le projecteur, puis cliquez dedans pour passer en plein écran.'
  return "La scène est sur le projecteur mais pas en plein écran : cliquez dans sa fenêtre, sur le projecteur."
}

/** French reason why the screens could not be read. */
function screensProblem(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return DENIED_TEXT
  return `Placement automatique impossible : ${errorMessage(error)}`
}

export class Projection {
  private current: ProjectionState
  private readonly listeners = new Set<(state: ProjectionState) => void>()
  private details: ScreenDetails | undefined
  /** Why the screens are unknown, shown with the fallback [SPEC-5.4]. */
  private screensError: string | undefined
  private session: Session | undefined
  private readonly removeScreenListener: () => void

  constructor(private readonly options: ProjectionOptions) {
    this.current = {
      mode: 'single',
      available: this.secondScreen(),
      placed: false,
      screenLabel: null,
      sceneFullscreen: false,
      notice: null,
    }
    this.removeScreenListener = options.env.onScreenChange(this.onScreensChanged)
    void this.readScreensIfAllowed()
  }

  get state(): ProjectionState {
    return this.current
  }

  /** Calls the listener at once, then after every change. */
  subscribe(listener: (state: ProjectionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.current)
    return () => this.listeners.delete(listener)
  }

  /** [SPEC-5.3] To be called from the click on « Projeter »: Chrome opens a window only during
   *  a user gesture. */
  project(): void {
    if (this.current.mode !== 'single') return
    const { getScreenDetails } = this.options.env
    if (this.details || !getScreenDetails) {
      // Screens already known, or no API: the window opens within the click itself.
      this.openScene()
      return
    }
    // First use: Chrome asks for the permission. If the adult answers slowly, the click has
    // expired and the window is blocked; openScene then asks to click again.
    getScreenDetails()
      .then(
        (details) => this.useDetails(details),
        (error: unknown) => {
          this.screensError = screensProblem(error)
        },
      )
      .then(() => this.openScene())
  }

  /** Closes the scene from the control window and goes back to single-screen mode. */
  closeScene(): void {
    if (this.session) this.end(this.session, null, true)
  }

  dismissNotice(): void {
    if (this.current.notice !== null) this.setState({ notice: null })
  }

  /** The control window goes away: the scene closes with it [SPEC-5.6]. */
  dispose(): void {
    this.closeScene()
    this.removeScreenListener()
    this.details?.removeEventListener('screenschange', this.onScreensChanged)
  }

  /** With the permission already granted, the screens are read at start-up, so that the click on
   *  « Projeter » opens the window at once. */
  private async readScreensIfAllowed(): Promise<void> {
    const { env } = this.options
    if (!env.getScreenDetails || (await env.queryPermission()) !== 'granted') return
    try {
      this.useDetails(await env.getScreenDetails())
    } catch (error) {
      this.screensError = screensProblem(error) // shown if the fallback is used
    }
  }

  private useDetails(details: ScreenDetails): void {
    this.screensError = undefined
    if (this.details === details) return
    this.details?.removeEventListener('screenschange', this.onScreensChanged)
    this.details = details
    details.addEventListener('screenschange', this.onScreensChanged)
    this.onScreensChanged()
  }

  private secondScreen(): boolean {
    const extended = this.options.env.isExtended()
    const count = this.details?.screens.length
    if (count !== undefined && count < 2) return false
    // Without the API nothing tells: « Projeter » stays offered and uses the fallback [SPEC-5.4].
    return extended !== false
  }

  private readonly onScreensChanged = () => {
    const available = this.secondScreen()
    // [SPEC-5.6] Projector unplugged or mirrored: macOS moves the scene onto the Mac's screen,
    // over the control window. Close it.
    if (this.session && !available) this.end(this.session, LOST_TEXT, true)
    if (available !== this.current.available) this.setState({ available })
  }

  private openScene(): void {
    if (this.current.mode !== 'single') return
    const { env } = this.options
    const target = this.details ? otherScreen(this.details) : undefined
    const id = env.newId()
    const channel = env.createChannel(sceneChannelName(id))
    const url = env.sceneUrl({ channel: id, ...(target ? { target: { left: target.left, top: target.top } } : {}) })
    const popup = env.open(url, SCENE_WINDOW_NAME, sceneFeatures(target))
    if (!popup) {
      channel.close()
      this.setState({ notice: BLOCKED_TEXT })
      return
    }
    const session: Session = { channel, popup, stopTimers: () => {} }
    // The channel exists before the window opens: the scene's first state cannot be missed.
    channel.addEventListener('message', (event) => this.onSceneMessage(session, event))
    const poll = setInterval(() => {
      if (popup.closed) this.end(session, CLOSED_TEXT, false)
    }, CLOSED_POLL_MS)
    const timeout = setTimeout(() => {
      if (!session.remote) this.end(session, TIMEOUT_TEXT, true)
    }, CONNECT_TIMEOUT_MS)
    session.stopTimers = () => {
      clearInterval(poll)
      clearTimeout(timeout)
    }
    this.session = session
    this.setState({
      mode: 'opening',
      placed: target !== undefined,
      screenLabel: target?.label || null,
      sceneFullscreen: false,
      notice: target ? null : this.fallbackReason(),
    })
  }

  /** [SPEC-5.4] Why the scene could not be placed on the projector. */
  private fallbackReason(): string {
    if (this.screensError) return this.screensError
    if (!this.options.env.getScreenDetails) return NO_API_TEXT
    return ONE_SCREEN_TEXT
  }

  private onSceneMessage(session: Session, event: MessageEvent): void {
    if (this.session !== session) return
    const message = event.data as FromScene
    switch (message.kind) {
      case 'state':
        if (!session.remote) this.connect(session, message.state)
        break
      case 'display':
        this.setState({ sceneFullscreen: message.fullscreen })
        break
      case 'error':
        this.options.onSceneError(message.message)
        break
      case 'level':
        break // the RemoteHostLink forwards it
    }
  }

  /** [SPEC-5.5] The scene answered: from now on the menu and the panels talk to it. */
  private connect(session: Session, first: HostState): void {
    session.remote = new RemoteHostLink(session.channel, first)
    // Mode first: the menu closes an open settings panel while the link still points at the
    // local host, which gives its microphone back.
    this.setState({ mode: 'dual' })
    this.options.link.switchTo(session.remote)
  }

  /** [SPEC-5.6] Back to single-screen mode, with a message unless the adult asked for it. */
  private end(session: Session, notice: string | null, closeWindow: boolean): void {
    if (this.session !== session) return
    this.session = undefined
    session.stopTimers()
    if (session.remote) {
      this.options.onSingle()
      // Link first: whatever the menu sends while it updates (a panel that closes gives its
      // microphone back) goes to the local host, not to a closed channel.
      this.options.link.switchTo(this.options.local)
      session.remote.dispose()
    }
    this.setState({ mode: 'single', placed: false, screenLabel: null, sceneFullscreen: false, notice })
    session.channel.postMessage({ kind: 'bye' } satisfies ToScene)
    session.channel.close()
    if (closeWindow && !session.popup.closed) session.popup.close()
  }

  private setState(partial: Partial<ProjectionState>): void {
    this.current = { ...this.current, ...partial }
    for (const listener of [...this.listeners]) listener(this.current)
  }
}

/** The browser's services for the control window. */
export function browserProjectionEnv(): ProjectionEnv {
  const win = window as WindowWithScreens
  const scr = screen as ScreenWithExtended
  const getScreenDetails = win.getScreenDetails
  return {
    isExtended: () => scr.isExtended,
    onScreenChange(listener) {
      if (typeof scr.addEventListener !== 'function') return () => {}
      scr.addEventListener('change', listener)
      return () => scr.removeEventListener('change', listener)
    },
    async queryPermission() {
      if (!navigator.permissions?.query) return undefined
      try {
        return (await navigator.permissions.query({ name: 'window-management' as PermissionName })).state
      } catch {
        return undefined // permission unknown to this Chrome: the first « Projeter » asks for it
      }
    },
    getScreenDetails: typeof getScreenDetails === 'function' ? () => getScreenDetails.call(win) : undefined,
    open: (url, name, features) => window.open(url, name, features),
    createChannel: (name) => new BroadcastChannel(name),
    sceneUrl: (params) => sceneUrl(location.href, params),
    newId: () => crypto.randomUUID(),
  }
}
