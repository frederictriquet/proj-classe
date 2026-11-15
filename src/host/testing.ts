// Test helpers: a HostLink whose state and level the test drives. Not imported by the app.
import type { SoundReading } from '../audio/sound-service'
import type { HostCommand, HostLink, HostState } from './protocol'

export function hostState(partial: Partial<HostState> = {}): HostState {
  return {
    phase: 'menu',
    appId: null,
    settings: { demo: { speed: 1, big: false } },
    notice: null,
    sound: {
      phase: 'off',
      simulated: false,
      ambientDb: -60,
      calibratedAt: null,
      calibrating: false,
      error: null,
      warning: null,
      device: null,
      microphone: null,
      microphones: [],
    },
    ...partial,
  }
}

export const READING: SoundReading = { rawDb: -40, levelDb: -42, ambientDb: -60, aboveAmbientDb: 18 }

export class FakeHostLink implements HostLink {
  readonly commands: HostCommand[] = []
  private readonly listeners = new Set<(state: HostState) => void>()
  private readonly levelListeners = new Set<(reading: SoundReading) => void>()

  constructor(public state: HostState = hostState()) {}

  get subscribers(): number {
    return this.listeners.size + this.levelListeners.size
  }

  dispatch(command: HostCommand): void {
    this.commands.push(command)
  }

  subscribe(listener: (state: HostState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  subscribeLevel(listener: (reading: SoundReading) => void): () => void {
    this.levelListeners.add(listener)
    return () => this.levelListeners.delete(listener)
  }

  emit(partial: Partial<HostState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of [...this.listeners]) listener(this.state)
  }

  emitLevel(reading: SoundReading): void {
    for (const listener of [...this.levelListeners]) listener(reading)
  }
}
