// [SPEC-5.5] Two screens: the scene window runs the host (sub-application and microphone), the
// control window (régie) is a remote control. Commands go to the scene and states come back over
// one BroadcastChannel per projection. Every message is plain data (see protocol.ts).
import type { SoundReading } from '../audio/sound-service'
import type { HostCommand, HostLink, HostState } from './protocol'

/** One channel per projection, so that an installed app and a tab open at the same time do not
 *  answer each other. */
export function sceneChannelName(id: string): string {
  return `proj-classe-scene/${id}`
}

/** Control window → scene. */
export type ToScene =
  | { kind: 'command'; command: HostCommand }
  /** The control window goes away (closed, reloaded): the scene closes too [SPEC-5.6]. */
  | { kind: 'bye' }

/** Scene → control window. */
export type FromScene =
  | { kind: 'state'; state: HostState }
  /** [SPEC-7.5] Live level, every frame while the scene's microphone is open. */
  | { kind: 'level'; reading: SoundReading }
  /** [SPEC-5.3] [SPEC-5.4] Whether the scene window is full screen. */
  | { kind: 'display'; fullscreen: boolean }
  /** French text of an error that is not the running app's (the host reports those in its
   *  state): shown on the control window, never on the projector [SPEC-5.1]. */
  | { kind: 'error'; message: string }

type MessageListener = (event: MessageEvent) => void

/** The part of BroadcastChannel used here, so the tests can pass any channel. */
export interface ScenePort {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: MessageListener): void
  removeEventListener(type: 'message', listener: MessageListener): void
}

/** Control side: a HostLink whose host runs in the scene window. Created with the first state
 *  received from the scene, so the menu never shows a state the scene did not send. */
export class RemoteHostLink implements HostLink {
  private current: HostState
  private readonly listeners = new Set<(state: HostState) => void>()
  private readonly levelListeners = new Set<(reading: SoundReading) => void>()

  constructor(
    private readonly port: ScenePort,
    first: HostState,
  ) {
    this.current = first
    port.addEventListener('message', this.onMessage)
  }

  get state(): HostState {
    return this.current
  }

  dispatch(command: HostCommand): void {
    this.port.postMessage({ kind: 'command', command } satisfies ToScene)
  }

  subscribe(listener: (state: HostState) => void): () => void {
    this.listeners.add(listener)
    listener(this.current)
    return () => this.listeners.delete(listener)
  }

  subscribeLevel(listener: (reading: SoundReading) => void): () => void {
    this.levelListeners.add(listener)
    return () => this.levelListeners.delete(listener)
  }

  /** Stops listening to the channel; the channel itself belongs to the caller. */
  dispose(): void {
    this.port.removeEventListener('message', this.onMessage)
    this.listeners.clear()
    this.levelListeners.clear()
  }

  private readonly onMessage = (event: MessageEvent) => {
    const message = event.data as FromScene
    if (message.kind === 'state') {
      this.current = message.state
      for (const listener of [...this.listeners]) listener(message.state)
    } else if (message.kind === 'level') {
      for (const listener of [...this.levelListeners]) listener(message.reading)
    }
  }
}

/** Scene side: relays the control window's commands to the host and sends back every state and
 *  every level. The current state goes out at once. Returns a function that stops the relay. */
export function serveHost(host: HostLink, port: ScenePort, onBye: () => void): () => void {
  const onMessage = (event: MessageEvent) => {
    const message = event.data as ToScene
    if (message.kind === 'command') host.dispatch(message.command)
    else if (message.kind === 'bye') onBye()
  }
  port.addEventListener('message', onMessage)
  const offState = host.subscribe((state) => port.postMessage({ kind: 'state', state } satisfies FromScene))
  const offLevel = host.subscribeLevel((reading) => port.postMessage({ kind: 'level', reading } satisfies FromScene))
  return () => {
    port.removeEventListener('message', onMessage)
    offState()
    offLevel()
  }
}
