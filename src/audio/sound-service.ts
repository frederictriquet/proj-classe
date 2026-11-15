// [SPEC-6] Sound-level service. It opens its source (microphone or simulated) only while someone
// holds a lease: a running app that declared the `microphone` need, or the settings panel that
// shows the live level [SPEC-7.5]. The last release closes the source [SPEC-6.7]. Every frame it
// reads the raw level, smooths it [SPEC-6.2] and publishes the level, the ambient noise and the
// difference between them [SPEC-6.4]. It opens the microphone chosen by the adult and reopens
// it when the choice changes [SPEC-6.8].
import { errorMessage, ExplainedError } from '../errors'
import {
  ambientFromReadings,
  CALIBRATION_MS,
  DBFS_FLOOR,
  DEFAULT_AMBIENT_DBFS,
  parseCalibration,
  smoothLevel,
  type Calibration,
} from './level'
import { MICROPHONE_KEY, parseMicrophoneChoice, type MicrophoneInfo } from './microphone-choice'
import type { LevelSource, OpenedSource } from './source'

/** [SPEC-6.4] What an app reads, refreshed every frame. Thresholds belong to the app. */
export interface SoundLevel {
  /** Smoothed level in dBFS [SPEC-6.2]. */
  readonly levelDb: number
  /** Ambient noise of the room in dBFS: last calibration, or the default value [SPEC-6.3]. */
  readonly ambientDb: number
  /** `levelDb − ambientDb`, in dB: what the app's thresholds compare to [SPEC-6.4]. */
  readonly aboveAmbientDb: number
}

/** One frame of measure, sent to the settings panel [SPEC-7.5]. Plain data. */
export interface SoundReading {
  /** Unsmoothed level of the frame, dBFS. */
  rawDb: number
  levelDb: number
  ambientDb: number
  aboveAmbientDb: number
}

/** State of the service shown to the adult. Plain data, so it can cross windows [SPEC-5.5]. */
export interface SoundStatus {
  /** 'off': source closed; 'opening': waiting for the microphone; 'on': measuring. */
  phase: 'off' | 'opening' | 'on'
  /** [SPEC-6.5] Simulated source in use. */
  simulated: boolean
  ambientDb: number
  /** [SPEC-6.3] ISO date of the calibration in use; null when the default value is used. */
  calibratedAt: string | null
  calibrating: boolean
  /** [SPEC-6.6] French message (refused, no microphone, lost, calibration failed), else null. */
  error: string | null
  /** [SPEC-6.1] French warning when Chrome kept an audio processing on, else null. */
  warning: string | null
  /** [SPEC-6.6] Name of the microphone the browser opened, while measuring; else null. */
  device: string | null
  /** [SPEC-6.8] Microphone chosen by the adult; null for the one Chrome picks. */
  microphone: MicrophoneInfo | null
  /** [SPEC-6.8] Microphones plugged in, as the adult can choose them. */
  microphones: MicrophoneInfo[]
}

export interface SoundLease {
  /** Gives the lease back; the last one closes the source. Safe to call twice. */
  release(): void
}

/** Frame scheduler, `requestAnimationFrame` in the browser; injected by the tests. */
export interface FrameClock {
  request(callback: (now: number) => void): number
  cancel(handle: number): void
}

export const animationFrameClock: FrameClock = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

/** The part of the settings store used here: the common space [SPEC-7.1]. */
export interface CommonSettings {
  readCommon(key: string): unknown
  writeCommon(key: string, value: unknown): void
}

/** Key of the calibration in the common settings space [SPEC-6.3] [SPEC-7.1]. */
export const CALIBRATION_KEY = 'calibration'

/** [SPEC-6.6] A live microphone never gives exact digital silence: after this long at the
 *  floor, the adult is warned that the microphone sends nothing (a virtual device picked by
 *  Chrome, or the microphone muted by macOS, for example). */
export const NO_SIGNAL_MS = 2000

/** [SPEC-6.6] Warning for exact silence, naming the device the browser opened when known. It is
 *  shown in the settings panel, under the microphone menu [SPEC-6.8]. */
export function noSignalText(device: string | null): string {
  const microphone = device === null ? 'Le micro' : `Le micro « ${device} »`
  return `${microphone} ne renvoie aucun son (silence complet) : la mesure ne veut rien dire. Choisissez un autre micro dans le menu « Micro » de ce panneau. Si le bon micro est déjà choisi, vérifiez Réglages Système > Confidentialité et sécurité > Micro > Google Chrome, et Réglages Système > Son > Entrée.`
}

/** [SPEC-6.8] A calibration interrupted by a change of microphone. */
export const MICROPHONE_CHANGED_TEXT = 'Le micro a changé pendant la mesure : recalibrez.'

interface Recording {
  readings: number[]
  elapsedMs: number
  resolve: (readings: number[]) => void
  reject: (error: Error) => void
}

export interface SoundServiceOptions {
  source: LevelSource
  settings: CommonSettings
  /** Receives a French message when the stored calibration or microphone cannot be used. */
  onProblem: (message: string) => void
  clock?: FrameClock
  /** Date of a new calibration; injected by the tests. */
  now?: () => Date
}

export class SoundService {
  private readonly source: LevelSource
  private readonly settings: CommonSettings
  private readonly onProblem: (message: string) => void
  private readonly clock: FrameClock
  private readonly now: () => Date
  private leases = 0
  private opening: Promise<void> | undefined
  private opened: OpenedSource | undefined
  /** Callbacks of the leases that want to know when the source is lost. */
  private readonly lostListeners = new Set<(message: string) => void>()
  private frame: number | undefined
  private lastFrameTime: number | undefined
  private reading: SoundReading
  private recording: Recording | undefined
  private calibration: Calibration | undefined
  /** [SPEC-6.8] Chosen microphone; replaced, never mutated, so that an opening can tell whether
   *  the choice changed while it waited. */
  private microphone: MicrophoneInfo | null
  /** Time spent at the floor, for the no-signal warning [SPEC-6.6]. */
  private silentMs = 0
  private processingWarning: string | null = null
  private current: SoundStatus
  private readonly statusListeners = new Set<(status: SoundStatus) => void>()
  private readonly levelListeners = new Set<(reading: SoundReading) => void>()

  /** [SPEC-6.4] Read by the apps that declared the `microphone` need. */
  readonly level: SoundLevel

  constructor(options: SoundServiceOptions) {
    this.source = options.source
    this.settings = options.settings
    this.onProblem = options.onProblem
    this.clock = options.clock ?? animationFrameClock
    this.now = options.now ?? (() => new Date())
    this.calibration = this.readCalibration()
    this.microphone = this.readMicrophone()
    const ambientDb = this.calibration?.ambientDb ?? DEFAULT_AMBIENT_DBFS
    this.reading = { rawDb: DBFS_FLOOR, levelDb: DBFS_FLOOR, ambientDb, aboveAmbientDb: DBFS_FLOOR - ambientDb }
    this.current = {
      phase: 'off',
      simulated: this.source.simulated,
      ambientDb,
      calibratedAt: this.calibration?.date ?? null,
      calibrating: false,
      error: null,
      warning: null,
      device: null,
      microphone: this.microphone,
      microphones: [],
    }
    const service = this
    this.level = {
      get levelDb() {
        return service.reading.levelDb
      },
      get ambientDb() {
        return service.reading.ambientDb
      },
      get aboveAmbientDb() {
        return service.reading.aboveAmbientDb
      },
    }
    // [SPEC-6.8] The list follows the microphones plugged in, for the life of the window.
    this.source.watchMicrophones(() => void this.refreshMicrophones())
    void this.refreshMicrophones()
  }

  get status(): SoundStatus {
    return this.current
  }

  /** Calls the listener at once, then after every change. */
  subscribeStatus(listener: (status: SoundStatus) => void): () => void {
    this.statusListeners.add(listener)
    listener(this.current)
    return () => this.statusListeners.delete(listener)
  }

  /** Called every frame while the source is open. */
  subscribeLevel(listener: (reading: SoundReading) => void): () => void {
    this.levelListeners.add(listener)
    return () => this.levelListeners.delete(listener)
  }

  /**
   * Opens the source if needed and holds it until the lease is released. Rejects with a French
   * message when it cannot open [SPEC-6.6]; the message is also put in the status.
   * @param onLost called if the source stops by itself while the lease is held.
   */
  async acquire(onLost?: (message: string) => void): Promise<SoundLease> {
    this.leases++
    try {
      await this.ensureOpen()
    } catch (error) {
      this.leases--
      throw error
    }
    if (onLost) this.lostListeners.add(onLost)
    let released = false
    return {
      release: () => {
        if (released) return
        released = true
        if (onLost) this.lostListeners.delete(onLost)
        this.leases--
        if (this.leases === 0) this.close()
      },
    }
  }

  /**
   * [SPEC-6.3] Measures the ambient noise for 3 seconds and keeps it in the common settings.
   * Never rejects: a failure is shown in `status.error`.
   */
  async calibrate(): Promise<void> {
    if (this.current.calibrating) return
    this.setStatus({ calibrating: true, error: null })
    let lease: SoundLease | undefined
    try {
      lease = await this.acquire()
      const readings = await new Promise<number[]>((resolve, reject) => {
        this.recording = { readings: [], elapsedMs: 0, resolve, reject }
      })
      const calibration: Calibration = { ambientDb: ambientFromReadings(readings), date: this.now().toISOString() }
      this.settings.writeCommon(CALIBRATION_KEY, calibration)
      this.setCalibration(calibration)
      this.setStatus({ calibrating: false })
    } catch (error) {
      this.recording = undefined
      this.setStatus({ calibrating: false, error: `Calibrage impossible. ${errorMessage(error)}` })
    } finally {
      lease?.release()
    }
  }

  /** [SPEC-5.6] [SPEC-6.3] [SPEC-6.8] Reads the common settings again: the scene window may have
   *  calibrated or changed the microphone while it ran the apps. */
  reloadCommonSettings(): void {
    this.setCalibration(this.readCalibration())
    const microphone = this.readMicrophone()
    const changed = microphone?.id !== this.microphone?.id || microphone?.label !== this.microphone?.label
    this.microphone = microphone
    this.setStatus({ microphone })
    if (changed) this.reopen()
  }

  /**
   * [SPEC-6.8] Keeps the adult's choice of microphone (null: the one Chrome picks) and clears the
   * calibration, which belongs to one microphone. An open source is reopened with the new choice;
   * a failure goes to `status.error` and to the lease holders, like a lost microphone.
   */
  chooseMicrophone(microphone: MicrophoneInfo | null): void {
    this.settings.writeCommon(MICROPHONE_KEY, microphone)
    // Written as undefined, the key is dropped by JSON.stringify: read back as never calibrated.
    this.settings.writeCommon(CALIBRATION_KEY, undefined)
    this.microphone = microphone
    this.setCalibration(undefined)
    this.setStatus({ microphone, error: null })
    this.reopen()
  }

  /** [SPEC-6.8] Lists the microphones again. Never rejects: a failure goes to `status.error`. */
  private async refreshMicrophones(): Promise<void> {
    try {
      this.setStatus({ microphones: await this.source.listMicrophones() })
    } catch (error) {
      this.setStatus({ error: `Liste des micros indisponible. ${errorMessage(error)}` })
    }
  }

  /** [SPEC-6.5] Sets the level of the simulated source. Throws with the microphone. */
  simulate(db: number): void {
    if (!this.source.setLevel) throw new Error("Le niveau ne se règle à la main qu'avec le micro simulé (?micro=simule).")
    this.source.setLevel(db)
  }

  private setCalibration(calibration: Calibration | undefined): void {
    this.calibration = calibration
    const ambientDb = calibration?.ambientDb ?? DEFAULT_AMBIENT_DBFS
    this.reading = { ...this.reading, ambientDb, aboveAmbientDb: this.reading.levelDb - ambientDb }
    this.setStatus({ ambientDb, calibratedAt: calibration?.date ?? null })
  }

  /** [SPEC-6.8] Stored microphone; null (Chrome's choice) when none, or when it is unreadable,
   *  which is reported to the adult. */
  private readMicrophone(): MicrophoneInfo | null {
    try {
      return parseMicrophoneChoice(this.settings.readCommon(MICROPHONE_KEY))
    } catch (error) {
      this.onProblem(errorMessage(error))
      return null
    }
  }

  /** Stored calibration; undefined (default value) when none, or when it is unreadable, which is
   *  reported to the adult. */
  private readCalibration(): Calibration | undefined {
    try {
      return parseCalibration(this.settings.readCommon(CALIBRATION_KEY))
    } catch (error) {
      this.onProblem(errorMessage(error))
      return undefined
    }
  }

  private ensureOpen(): Promise<void> {
    if (this.opened) return Promise.resolve()
    if (this.opening) return this.opening
    this.setStatus({ phase: 'opening' })
    const microphone = this.microphone
    // A success clears the errors already shown, not one that came meanwhile (a calibration
    // interrupted by the change of microphone).
    const errorBefore = this.current.error
    this.opening = this.source.open((message) => this.lose(message), microphone).then(
      (opened): Promise<void> | void => {
        this.opening = undefined
        // [SPEC-6.8] A reopening whose leases were all given back meanwhile [SPEC-6.7].
        if (this.leases === 0) {
          opened.close()
          this.setStatus({ phase: 'off' })
          return
        }
        // [SPEC-6.8] Another microphone was chosen while this one opened: open that one instead.
        if (microphone !== this.microphone) {
          opened.close()
          return this.ensureOpen()
        }
        this.opened = opened
        this.lastFrameTime = undefined
        this.silentMs = 0
        this.processingWarning = opened.warning ?? null
        const error = this.current.error === errorBefore ? null : this.current.error
        this.setStatus({ phase: 'on', error, warning: this.processingWarning, device: opened.device ?? null })
        this.frame = this.clock.request(this.tick)
        // [SPEC-6.8] Chrome names the microphones only once it has opened one.
        void this.refreshMicrophones()
      },
      (error: unknown): Promise<void> => {
        this.opening = undefined
        if (microphone !== this.microphone) return this.ensureOpen()
        this.setStatus({ phase: 'off', error: errorMessage(error) })
        throw error
      },
    )
    return this.opening
  }

  /** [SPEC-6.8] Opens the source again with the current choice, for the leases still held. An
   *  opening in progress checks the choice itself when it ends. */
  private reopen(): void {
    if (this.leases === 0 || this.opening) return
    if (this.opened) {
      this.close()
      this.recording?.reject(new ExplainedError(MICROPHONE_CHANGED_TEXT))
      this.recording = undefined
    }
    this.ensureOpen().catch((error: unknown) => this.fail(errorMessage(error)))
  }

  private readonly tick = (now: number): void => {
    const opened = this.opened
    if (!opened) return
    const rawDb = opened.read()
    const previousTime = this.lastFrameTime
    this.lastFrameTime = now
    const dtMs = previousTime === undefined ? 0 : now - previousTime
    // First frame: start from the measure itself, not from the floor.
    const levelDb = previousTime === undefined ? rawDb : smoothLevel(this.reading.levelDb, rawDb, dtMs)
    const { ambientDb } = this.reading
    this.reading = { rawDb, levelDb, ambientDb, aboveAmbientDb: levelDb - ambientDb }
    this.watchSignal(rawDb, dtMs)

    const recording = this.recording
    if (recording) {
      // The raw level of each frame, so the smoothing of the previous noise does not leak in.
      recording.readings.push(rawDb)
      recording.elapsedMs += dtMs
      if (recording.elapsedMs >= CALIBRATION_MS) {
        this.recording = undefined
        recording.resolve(recording.readings)
      }
    }
    for (const listener of [...this.levelListeners]) listener(this.reading)
    if (this.opened === opened) this.frame = this.clock.request(this.tick)
  }

  /** [SPEC-6.6] Warns when the source sends exact silence, clears the warning when sound comes back. */
  private watchSignal(rawDb: number, dtMs: number): void {
    this.silentMs = rawDb <= DBFS_FLOOR ? this.silentMs + dtMs : 0
    const noSignal = this.silentMs >= NO_SIGNAL_MS ? noSignalText(this.current.device) : null
    const warnings = [this.processingWarning, noSignal].filter((w) => w !== null)
    const warning = warnings.length > 0 ? warnings.join('\n') : null
    if (warning !== this.current.warning) this.setStatus({ warning })
  }

  /** Closes the source and stops the frame loop [SPEC-6.7]. */
  private close(): void {
    if (this.frame !== undefined) this.clock.cancel(this.frame)
    this.frame = undefined
    this.opened?.close()
    this.opened = undefined
    this.reading = { ...this.reading, rawDb: DBFS_FLOOR, levelDb: DBFS_FLOOR, aboveAmbientDb: DBFS_FLOOR - this.reading.ambientDb }
    this.processingWarning = null
    if (this.current.phase !== 'opening') this.setStatus({ phase: 'off', warning: null, device: null })
  }

  /** [SPEC-6.6] The source stopped by itself (microphone unplugged). */
  private lose(message: string): void {
    if (!this.opened) return
    this.close()
    this.fail(message)
  }

  /** [SPEC-6.6] The source is gone (lost, or a new choice that cannot open): the calibration in
   *  progress fails and the lease holders are told. Their leases stay counted until released. */
  private fail(message: string): void {
    // The message is already a French explanation: shown without the technical error name.
    this.recording?.reject(new ExplainedError(message))
    this.recording = undefined
    this.setStatus({ error: message })
    for (const listener of [...this.lostListeners]) listener(message)
  }

  private setStatus(partial: Partial<SoundStatus>): void {
    this.current = { ...this.current, ...partial }
    for (const listener of [...this.statusListeners]) listener(this.current)
  }
}
