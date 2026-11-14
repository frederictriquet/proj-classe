// [SPEC-5.2] [SPEC-5.5] [SPEC-5.6] The link the menu and the panels use on the control window. It
// forwards to the local host in single-screen mode and to the scene window in two-screen mode;
// switching re-subscribes and sends the new target's state to every listener.
import type { SoundReading } from '../audio/sound-service'
import type { HostCommand, HostLink, HostState } from './protocol'

export class SwitchableLink implements HostLink {
  private target: HostLink
  private current: HostState | undefined
  private detach: () => void = () => {}
  private readonly listeners = new Set<(state: HostState) => void>()
  private readonly levelListeners = new Set<(reading: SoundReading) => void>()

  constructor(target: HostLink) {
    this.target = target
    this.attach(target)
  }

  /** State of the current target. */
  get state(): HostState {
    if (!this.current) throw new Error('SwitchableLink: target sent no state on subscribe')
    return this.current
  }

  switchTo(target: HostLink): void {
    if (target === this.target) return
    this.detach()
    this.target = target
    this.attach(target)
  }

  dispatch(command: HostCommand): void {
    this.target.dispatch(command)
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

  private attach(target: HostLink): void {
    // HostLink.subscribe calls back at once: `current` is set before this returns.
    const offState = target.subscribe((state) => {
      this.current = state
      for (const listener of [...this.listeners]) listener(state)
    })
    const offLevel = target.subscribeLevel((reading) => {
      for (const listener of [...this.levelListeners]) listener(reading)
    })
    this.detach = () => {
      offState()
      offLevel()
    }
  }
}
