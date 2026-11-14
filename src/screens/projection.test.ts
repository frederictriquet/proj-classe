import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FromScene, ToScene } from '../host/scene-link'
import { SwitchableLink } from '../host/switchable-link'
import { FakeHostLink, hostState } from '../host/testing'
import {
  BLOCKED_TEXT,
  CLOSED_POLL_MS,
  CLOSED_TEXT,
  CONNECT_TIMEOUT_MS,
  DENIED_TEXT,
  LOST_TEXT,
  NO_API_TEXT,
  Projection,
  projectionStatus,
  TIMEOUT_TEXT,
  type ProjectionEnv,
  type ProjectionState,
  type SceneChannel,
  type SceneWindow,
} from './projection'
import { parseSceneHash, sceneUrl, type SceneParams, type ScreenDetailed, type ScreenDetails } from './screen-api'

function fakeScreen(props: { left: number; label: string; internal: boolean }): ScreenDetailed {
  return {
    left: props.left,
    top: 0,
    availLeft: props.left,
    availTop: 25,
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1055,
    isInternal: props.internal,
    isPrimary: props.internal,
    label: props.label,
    devicePixelRatio: 1,
  } as unknown as ScreenDetailed
}

class FakeDetails extends EventTarget implements ScreenDetails {
  constructor(
    public screens: ScreenDetailed[],
    public currentScreen: ScreenDetailed,
  ) {
    super()
  }
}

/** In-memory channel: messages are cloned like between two windows, and delivered at once. */
class FakeChannel implements SceneChannel {
  readonly sent: ToScene[] = []
  closed = false
  private readonly listeners = new Set<(event: MessageEvent) => void>()
  postMessage(message: unknown): void {
    if (this.closed) throw new Error('InvalidStateError: channel closed')
    this.sent.push(structuredClone(message) as ToScene)
  }
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener)
  }
  close(): void {
    this.closed = true
  }
  /** A message from the scene window. */
  receive(message: FromScene): void {
    for (const listener of [...this.listeners]) listener({ data: structuredClone(message) } as MessageEvent)
  }
}

class FakePopup implements SceneWindow {
  closed = false
  closeCalls = 0
  close(): void {
    this.closeCalls++
    this.closed = true
  }
}

const MAC = fakeScreen({ left: 0, label: 'Écran intégré', internal: true })
const PROJECTOR = fakeScreen({ left: 1512, label: 'EPSON', internal: false })

class FakeEnv implements ProjectionEnv {
  extended: boolean | undefined = true
  permission: PermissionState | undefined = 'granted'
  details = new FakeDetails([MAC, PROJECTOR], MAC)
  /** Rejection of getScreenDetails (refused permission). */
  refuse: unknown
  hasApi = true
  detailsCalls = 0
  popup: FakePopup | null = new FakePopup()
  readonly opened: { url: string; name: string; features: string }[] = []
  readonly channels: FakeChannel[] = []
  private readonly screenListeners = new Set<() => void>()

  isExtended = () => this.extended
  onScreenChange(listener: () => void) {
    this.screenListeners.add(listener)
    return () => this.screenListeners.delete(listener)
  }
  queryPermission = () => Promise.resolve(this.permission)
  get getScreenDetails() {
    if (!this.hasApi) return undefined
    return () => {
      this.detailsCalls++
      return this.refuse === undefined ? Promise.resolve<ScreenDetails>(this.details) : Promise.reject(this.refuse)
    }
  }
  open(url: string, name: string, features: string) {
    this.opened.push({ url, name, features })
    return this.popup
  }
  createChannel() {
    const created = new FakeChannel()
    this.channels.push(created)
    return created
  }
  sceneUrl(params: SceneParams) {
    return sceneUrl('https://example.test/proj-classe/?micro=simule', params)
  }
  newId = () => 'id1'
  screensChanged(): void {
    for (const listener of [...this.screenListeners]) listener()
  }
  get channel(): FakeChannel {
    const last = this.channels.at(-1)
    if (!last) throw new Error('no channel')
    return last
  }
}

function setup(env = new FakeEnv()) {
  const local = new FakeHostLink(hostState())
  const link = new SwitchableLink(local)
  const onSingle = vi.fn()
  const onSceneError = vi.fn()
  const projection = new Projection({ env, local, link, onSingle, onSceneError })
  const states: ProjectionState[] = []
  projection.subscribe((state) => states.push(state))
  return { env, local, link, projection, onSingle, onSceneError, states }
}

/** Lets the start-up permission query and screen reading resolve. */
const flush = () => vi.advanceTimersByTimeAsync(1)
const SCENE_STATE = hostState({ settings: { demo: { speed: 2, big: true } } })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Projection', () => {
  it('offers « Projeter » only with a second screen [SPEC-5.3]', () => {
    const env = new FakeEnv()
    env.extended = false
    const { projection } = setup(env)
    expect(projection.state.available).toBe(false)
    env.extended = true
    env.screensChanged()
    expect(projection.state.available).toBe(true)
  })

  it('opens the scene full screen on the projector within the click, then hands it the menu [SPEC-5.3] [SPEC-5.5]', async () => {
    const { env, local, link, projection } = setup()
    await flush() // permission granted: screens read at start-up
    projection.project()
    // Synchronous: the click is still active when the window opens.
    expect(env.opened).toHaveLength(1)
    const { url, name, features } = env.opened[0]!
    expect(name).toBe('proj-classe-scene')
    expect(features).toBe('popup,fullscreen,left=1512,top=25,width=1920,height=1055')
    expect(parseSceneHash(new URL(url).hash)).toEqual({ channel: 'id1', target: { left: 1512, top: 0 } })
    expect(new URL(url).search).toBe('?micro=simule')
    expect(projection.state).toMatchObject({ mode: 'opening', placed: true, screenLabel: 'EPSON', notice: null })

    // Until the scene answers, the menu stays on the local host.
    expect(link.state).toBe(local.state)
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    expect(projection.state.mode).toBe('dual')
    expect(link.state).toEqual(SCENE_STATE)
    link.dispatch({ type: 'launch', appId: 'demo' })
    expect(env.channel.sent).toEqual([{ kind: 'command', command: { type: 'launch', appId: 'demo' } }])
    expect(local.commands).toHaveLength(0)

    env.channel.receive({ kind: 'display', fullscreen: true })
    expect(projectionStatus(projection.state)).toBe('Scène projetée en plein écran sur « EPSON ».')
  })

  it('switches the mode before the link when the scene answers, and the link before the mode when it ends', async () => {
    const { env, local, link, projection } = setup()
    const seen: string[] = []
    projection.subscribe((state) => seen.push(`${state.mode}:${link.state === local.state ? 'local' : 'scene'}`))
    await flush()
    projection.project()
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    projection.closeScene()
    // A panel closed on 'dual' gives the microphone back to the local host; one closed on
    // 'single' does not write to the closed channel.
    expect(seen).toEqual(['single:local', 'opening:local', 'dual:local', 'single:local'])
  })

  it('goes back to single-screen mode with a message when the scene window is closed [SPEC-5.6]', async () => {
    const { env, local, link, projection, onSingle } = setup()
    await flush()
    projection.project()
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    env.popup!.closed = true
    vi.advanceTimersByTime(CLOSED_POLL_MS)
    expect(projection.state).toMatchObject({ mode: 'single', notice: CLOSED_TEXT, sceneFullscreen: false })
    // Settings and calibration are read again before the local host takes over.
    expect(onSingle).toHaveBeenCalledTimes(1)
    expect(link.state).toBe(local.state)
    link.dispatch({ type: 'stop' })
    expect(local.commands).toEqual([{ type: 'stop' }])
    expect(env.channel.sent.at(-1)).toEqual({ kind: 'bye' })
    expect(env.channel.closed).toBe(true)
    projection.dismissNotice()
    expect(projection.state.notice).toBeNull()
  })

  it('closes the scene when the projector is unplugged or mirrored [SPEC-5.6]', async () => {
    const { env, projection } = setup()
    await flush()
    projection.project()
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    env.extended = false
    env.screensChanged()
    expect(env.popup!.closeCalls).toBe(1)
    expect(projection.state).toMatchObject({ mode: 'single', available: false, notice: LOST_TEXT })
  })

  it('closes the scene when Chrome reports one screen left', async () => {
    const { env, projection } = setup()
    await flush()
    projection.project()
    env.details.screens = [MAC]
    env.details.dispatchEvent(new Event('screenschange'))
    expect(projection.state).toMatchObject({ mode: 'single', available: false, notice: LOST_TEXT })
  })

  it('closes the scene on request, without a message', async () => {
    const { env, projection, onSingle } = setup()
    await flush()
    projection.project()
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    projection.closeScene()
    expect(env.popup!.closeCalls).toBe(1)
    expect(projection.state).toMatchObject({ mode: 'single', notice: null })
    expect(onSingle).toHaveBeenCalledTimes(1)
  })

  it('asks for the permission on the first click, then places the scene [SPEC-5.3]', async () => {
    const env = new FakeEnv()
    env.permission = 'prompt'
    const { projection } = setup(env)
    await flush()
    expect(env.detailsCalls).toBe(0) // nothing asked before the click
    projection.project()
    expect(env.opened).toHaveLength(0)
    await flush()
    expect(env.opened[0]?.features).toContain('fullscreen,left=1512')
    expect(projection.state.placed).toBe(true)
  })

  it('falls back to a window to drag when the permission is refused [SPEC-5.4]', async () => {
    const env = new FakeEnv()
    env.permission = 'prompt'
    env.refuse = new DOMException('Permission denied', 'NotAllowedError')
    const { projection } = setup(env)
    await flush()
    projection.project()
    await flush()
    expect(env.opened[0]?.features).toBe('popup,width=1024,height=640')
    expect(parseSceneHash(new URL(env.opened[0]!.url).hash)).toEqual({ channel: 'id1' })
    expect(projection.state).toMatchObject({ mode: 'opening', placed: false, notice: DENIED_TEXT })
    env.channel.receive({ kind: 'state', state: SCENE_STATE })
    expect(projectionStatus(projection.state)).toBe(
      'Glissez la fenêtre de la scène sur le projecteur, puis cliquez dedans pour passer en plein écran.',
    )
  })

  it('falls back within the click when the API is absent [SPEC-5.4]', () => {
    const env = new FakeEnv()
    env.hasApi = false
    env.extended = undefined
    const { projection } = setup(env)
    expect(projection.state.available).toBe(true)
    projection.project()
    expect(env.opened[0]?.features).toBe('popup,width=1024,height=640')
    expect(projection.state).toMatchObject({ mode: 'opening', placed: false, notice: NO_API_TEXT })
  })

  it('says to click again when Chrome blocks the window', async () => {
    const env = new FakeEnv()
    env.popup = null
    const { projection } = setup(env)
    await flush()
    projection.project()
    expect(projection.state).toMatchObject({ mode: 'single', notice: BLOCKED_TEXT })
    expect(env.channel.closed).toBe(true)
  })

  it('gives up on a scene that never answers', async () => {
    const { env, projection, onSingle } = setup()
    await flush()
    projection.project()
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS)
    expect(env.popup!.closeCalls).toBe(1)
    expect(projection.state).toMatchObject({ mode: 'single', notice: TIMEOUT_TEXT })
    // The local host never stopped being the target: nothing to read again.
    expect(onSingle).not.toHaveBeenCalled()
  })

  it('shows the scene errors on the control window [SPEC-5.1]', async () => {
    const { env, projection, onSceneError } = setup()
    await flush()
    projection.project()
    env.channel.receive({ kind: 'error', message: 'Réglages communs illisibles' })
    expect(onSceneError).toHaveBeenCalledWith('Réglages communs illisibles')
  })

  it('ignores a second « Projeter » while a scene is open', async () => {
    const { env, projection } = setup()
    await flush()
    projection.project()
    projection.project()
    expect(env.opened).toHaveLength(1)
  })

  it('closes the scene with the control window', async () => {
    const { env, projection } = setup()
    await flush()
    projection.project()
    projection.dispose()
    expect(env.popup!.closeCalls).toBe(1)
    expect(env.channel.sent).toEqual([{ kind: 'bye' }])
  })
})

describe('projectionStatus', () => {
  const base: ProjectionState = {
    mode: 'dual',
    available: true,
    placed: true,
    screenLabel: null,
    sceneFullscreen: false,
    notice: null,
  }
  it('describes where the scene is', () => {
    expect(projectionStatus({ ...base, mode: 'single' })).toBeNull()
    expect(projectionStatus({ ...base, mode: 'opening' })).toBe('Ouverture de la scène…')
    expect(projectionStatus({ ...base, sceneFullscreen: true })).toBe('Scène projetée en plein écran.')
    expect(projectionStatus(base)).toMatch(/pas en plein écran : cliquez dans sa fenêtre/)
  })
})
