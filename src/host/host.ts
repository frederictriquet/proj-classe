// [SPEC-4.2] [SPEC-4.6] [SPEC-4.7] [SPEC-4.8] [SPEC-6.7] [SPEC-7.2] Runs one sub-application at a time.
// The host only talks through HostCommand / HostState (protocol.ts), so the menu can live in
// the same window [SPEC-5.2] or in another one [SPEC-5.5]. The display (full screen, Escape) is
// injected, which keeps this module free of DOM calls and testable.
import type { AppEntry, AppRegistry } from '../apps/registry'
import type { AppNeed, AppSettings, RunningApp, SettingDeclaration, SettingValues, SoundLevel } from '../apps/types'
import type { MicrophoneInfo } from '../audio/microphone-choice'
import type { SoundLease, SoundReading, SoundStatus } from '../audio/sound-service'
import { errorMessage } from '../errors'
import type { SettingsStore } from '../settings/settings'
import type { HostCommand, HostLink, HostNotice, HostState } from './protocol'

export interface OpenedDisplay {
  /** Element the app renders into. */
  container: HTMLElement
  /** French message when the display works in a degraded way (full screen refused). */
  warning?: string
}

export interface HostDisplay {
  /** Called synchronously while the launch command is handled, so that the user gesture that
   *  sent it is still active when full screen is requested [SPEC-4.6]. */
  open(): Promise<OpenedDisplay>
  /** Leaves full screen and removes the container. Safe to call when already closed. */
  close(): void
}

/** The sound-level service as the host uses it (`SoundService` in the browser) [SPEC-6]. */
export interface HostSound {
  readonly status: SoundStatus
  readonly level: SoundLevel
  subscribeStatus(listener: (status: SoundStatus) => void): () => void
  subscribeLevel(listener: (reading: SoundReading) => void): () => void
  /** Rejects with a French message when the microphone cannot open [SPEC-6.6]. */
  acquire(onLost?: (message: string) => void): Promise<SoundLease>
  /** Never rejects: a failure goes to `status.error`. */
  calibrate(): Promise<void>
  /** [SPEC-6.8] Reopens an open microphone; a failure goes to `status.error`. */
  chooseMicrophone(microphone: MicrophoneInfo | null): void
  simulate(db: number): void
}

export interface HostOptions {
  registry: AppRegistry
  settings: SettingsStore
  display: HostDisplay
  sound: HostSound
}

/** [SPEC-6.4] What an app that did not declare the `microphone` need gets: reading it throws,
 *  so a forgotten declaration shows at once instead of measuring nothing. */
function undeclaredSound(title: string): SoundLevel {
  const fail = (): never => {
    throw new Error(`« ${title} » lit le niveau sonore sans avoir déclaré le besoin « microphone » dans sa fiche.`)
  }
  return {
    get levelDb() {
      return fail()
    },
    get ambientDb() {
      return fail()
    },
    get aboveAmbientDb() {
      return fail()
    },
  }
}

/** Settings view given to a running app; the host pushes every change into it [SPEC-7.2]. */
class LiveSettings implements AppSettings {
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly declarations: readonly SettingDeclaration[],
    private values: SettingValues,
  ) {}

  number(id: string): number {
    const value = this.value(id, 'slider')
    if (typeof value !== 'number') throw new TypeError(`Réglage « ${id} » : nombre attendu`)
    return value
  }

  boolean(id: string): boolean {
    const value = this.value(id, 'toggle')
    if (typeof value !== 'boolean') throw new TypeError(`Réglage « ${id} » : oui ou non attendu`)
    return value
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  update(values: SettingValues): void {
    this.values = values
    for (const listener of [...this.listeners]) listener()
  }

  dispose(): void {
    this.listeners.clear()
  }

  private value(id: string, type: SettingDeclaration['type']) {
    const declaration = this.declarations.find((d) => d.id === id)
    if (declaration?.type !== type) throw new Error(`Réglage « ${id} » non déclaré comme ${type === 'slider' ? 'curseur' : 'interrupteur'}`)
    return this.values[id]
  }
}

interface Run {
  token: number
  appId: string
  settings: LiveSettings
  instance?: RunningApp
  /** Microphone held for an app that declared the need, released at the end of the run [SPEC-6.7]. */
  soundLease?: SoundLease
}

/** Microphone held for the settings panel's live level [SPEC-7.5]. Kept after a failure to
 *  open: the panel still wants the microphone, and a new choice tries again [SPEC-6.8]. */
interface Monitor {
  lease?: SoundLease
  opening?: boolean
}

export class AppHost implements HostLink {
  private current: HostState
  private readonly listeners = new Set<(state: HostState) => void>()
  private run: Run | undefined
  private lastToken = 0
  private monitor: Monitor | undefined

  constructor(private readonly options: HostOptions) {
    this.current = { phase: 'menu', appId: null, settings: this.readSettings(), notice: null, sound: options.sound.status }
    options.sound.subscribeStatus((sound) => {
      if (sound !== this.current.sound) this.setState({ sound })
    })
  }

  get state(): HostState {
    return this.current
  }

  /** True while an app is starting or running: uncaught errors are then attributed to it. */
  get busy(): boolean {
    return this.run !== undefined
  }

  subscribe(listener: (state: HostState) => void): () => void {
    this.listeners.add(listener)
    listener(this.current)
    return () => this.listeners.delete(listener)
  }

  subscribeLevel(listener: (reading: SoundReading) => void): () => void {
    return this.options.sound.subscribeLevel(listener)
  }

  dispatch(command: HostCommand): void {
    switch (command.type) {
      case 'launch':
        this.launch(command.appId)
        break
      case 'stop':
        this.endRun(null)
        break
      case 'set-setting': {
        const { manifest } = this.options.registry.get(command.appId)
        const values = this.options.settings.write(command.appId, manifest.settings, command.settingId, command.value)
        this.applySettings(command.appId, values)
        break
      }
      case 'reset-settings': {
        const { manifest } = this.options.registry.get(command.appId)
        this.applySettings(command.appId, this.options.settings.reset(command.appId, manifest.settings))
        break
      }
      case 'dismiss-notice':
        this.setState({ notice: null })
        break
      case 'request-state':
        this.emit()
        break
      case 'monitor-sound':
        this.setMonitor(command.on)
        break
      case 'calibrate':
        void this.options.sound.calibrate() // never rejects: a failure goes to state.sound.error
        break
      case 'choose-microphone':
        this.options.sound.chooseMicrophone(command.microphone)
        // [SPEC-6.8] The open panel whose microphone could not open tries the new choice.
        if (this.monitor && !this.monitor.lease && !this.monitor.opening) this.acquireMonitor(this.monitor)
        break
      case 'simulate-level':
        this.options.sound.simulate(command.db)
        break
    }
  }

  /** [SPEC-5.6] [SPEC-7.1] Reads every app's settings from the store again: the scene window
   *  changed them while it ran the apps. */
  reloadSettings(): void {
    const settings = this.readSettings()
    this.setState({ settings })
    if (this.run) this.run.settings.update(settings[this.run.appId] ?? {})
  }

  /** [SPEC-4.8] Runtime error of the active app: stop it and go back to the menu with a
   *  message. Returns false when no app is active, so the caller reports the error itself. */
  fail(error: unknown): boolean {
    const run = this.run
    if (!run) return false
    this.endRun(this.errorNotice(run.appId, error))
    return true
  }

  private launch(appId: string): void {
    if (this.run) return // already starting or running: a second Enter or click is ignored
    const entry = this.options.registry.get(appId)
    const run: Run = {
      token: ++this.lastToken,
      appId,
      settings: new LiveSettings(entry.manifest.settings, this.current.settings[appId] ?? {}),
    }
    this.run = run
    this.setState({ phase: 'starting', appId, notice: null })
    // Called before any await: the user gesture is still active for full screen [SPEC-4.6].
    let opened: Promise<OpenedDisplay>
    try {
      opened = this.options.display.open()
    } catch (error) {
      opened = Promise.reject(error) // handled below like any launch failure
    }
    this.finishLaunch(run, entry, opened).catch((error: unknown) => {
      if (this.run === run) this.endRun(this.errorNotice(appId, error))
      else this.setState({ notice: this.errorNotice(appId, error) })
    })
  }

  private async finishLaunch(run: Run, entry: AppEntry, opened: Promise<OpenedDisplay>): Promise<void> {
    const needMessage = await this.acquireNeeds(run, entry.manifest.needs)
    if (this.run !== run) return
    if (needMessage !== undefined) {
      // [SPEC-4.7] The app is not started; the menu says what to do.
      this.endRun({ kind: 'need', appId: run.appId, message: needMessage })
      return
    }
    const { container, warning } = await opened
    if (this.run !== run) return
    const module = await entry.load()
    if (this.run !== run) return
    const sound = run.soundLease ? this.options.sound.level : undeclaredSound(entry.manifest.title)
    const instance = await module.start({ container, settings: run.settings, sound })
    if (this.run !== run) {
      // Stopped while it was starting: release it now, nothing may keep running [SPEC-4.2].
      instance.stop()
      return
    }
    run.instance = instance
    this.setState({
      phase: 'running',
      notice: warning === undefined ? null : { kind: 'warning', appId: run.appId, message: warning },
    })
  }

  /**
   * [SPEC-4.7] Acquires what the app declared. Resolves with a French message saying what to do
   * when a need is not met. Every need has its own case: a new need without one is a type error.
   */
  private async acquireNeeds(run: Run, needs: readonly AppNeed[]): Promise<string | undefined> {
    for (const need of needs) {
      switch (need) {
        case 'microphone': {
          let lease: SoundLease
          try {
            // [SPEC-6.6] Microphone lost during the run: back to the menu with what to do.
            lease = await this.options.sound.acquire((message) => {
              if (this.run === run) this.endRun({ kind: 'error', appId: run.appId, message })
            })
          } catch (error) {
            return `L'activité a besoin du micro et ne peut pas démarrer.\n${errorMessage(error)}`
          }
          // Stopped while the microphone was opening: give it back at once [SPEC-6.7].
          if (this.run === run) run.soundLease = lease
          else lease.release()
          break
        }
        default: {
          const unknown: never = need
          throw new Error(`Besoin inconnu : « ${String(unknown)} »`)
        }
      }
    }
    return undefined
  }

  /** [SPEC-7.5] Opens the microphone for the settings panel's live level, or gives it back. */
  private setMonitor(on: boolean): void {
    if (!on) {
      this.monitor?.lease?.release()
      this.monitor = undefined
      return
    }
    if (this.monitor) return
    const monitor: Monitor = {}
    this.monitor = monitor
    this.acquireMonitor(monitor)
  }

  private acquireMonitor(monitor: Monitor): void {
    monitor.opening = true
    this.options.sound.acquire().then(
      (lease) => {
        monitor.opening = false
        if (this.monitor === monitor) monitor.lease = lease
        else lease.release() // the panel closed while the microphone was opening
      },
      () => {
        // The service already put the French message in state.sound.error, shown by the panel.
        monitor.opening = false
      },
    )
  }

  private endRun(notice: HostNotice | null): void {
    const run = this.run
    if (!run) return // already on the menu: Escape and the full-screen exit may both ask to stop
    this.run = undefined
    run.settings.dispose()
    let finalNotice = notice
    try {
      run.instance?.stop()
    } catch (error) {
      const stopMessage = `« ${this.title(run.appId)} » ne s'est pas arrêtée proprement.\n${errorMessage(error)}`
      finalNotice = {
        kind: 'error',
        appId: run.appId,
        message: finalNotice ? `${finalNotice.message}\n${stopMessage}` : stopMessage,
      }
    }
    // [SPEC-6.7] After the app's own stop: the microphone is given back, Chrome's indicator goes off.
    run.soundLease?.release()
    try {
      this.options.display.close()
    } finally {
      this.setState({ phase: 'menu', appId: null, notice: finalNotice ?? this.current.notice })
    }
  }

  private readSettings(): Record<string, SettingValues> {
    const settings: Record<string, SettingValues> = {}
    for (const { manifest } of this.options.registry.entries) {
      settings[manifest.id] = this.options.settings.read(manifest.id, manifest.settings)
    }
    return settings
  }

  private applySettings(appId: string, values: SettingValues): void {
    this.setState({ settings: { ...this.current.settings, [appId]: values } })
    if (this.run?.appId === appId) this.run.settings.update(values)
  }

  private errorNotice(appId: string, error: unknown): HostNotice {
    return {
      kind: 'error',
      appId,
      message: `« ${this.title(appId)} » s'est arrêtée à cause d'une erreur. Vous pouvez la relancer.\n${errorMessage(error)}`,
    }
  }

  private title(appId: string): string {
    return this.options.registry.entries.find((e) => e.manifest.id === appId)?.manifest.title ?? appId
  }

  private setState(partial: Partial<HostState>): void {
    this.current = { ...this.current, ...partial }
    this.emit()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener(this.current)
  }
}
