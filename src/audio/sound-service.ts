// [SPEC-6] Sound-level service. It opens its source (microphone or simulated) only while someone
// holds a lease: a running app that declared the `microphone` need, or the settings panel that
// shows the live level [SPEC-7.5]. The last release closes the source [SPEC-6.7]. Every frame it
// reads the raw level, smooths it [SPEC-6.2] and publishes the level, the ambient noise and the
// difference between them [SPEC-6.4].
import { errorMessage } from '../errors'
import {
  ambientFromReadings,
  CALIBRATION_MS,
  DBFS_FLOOR,
  DEFAULT_AMBIENT_DBFS,
  parseCalibration,
  smoothLevel,
  type Calibration,
} from './level'
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

interface Recording {
  readings: number[]
  elapsedMs: number
  resolve: (readings: number[]) => void
  reject: (error: Error) => void
}

export interface SoundServiceOptions {
  source: LevelSource
  settings: CommonSettings
  /** Receives a French message when the stored calibration cannot be used. */
  onProblem: (message: string) => void
  clock?: FrameClock
  /** Date of a new calibration; injected by the tests. */
  now?: () => Date
}

export class SoundService {
  private readonly source: LevelSource
  private readonly settings: CommonSettings
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
  private current: SoundStatus
  private readonly statusListeners = new Set<(status: SoundStatus) => void>()
  private readonly levelListeners = new Set<(reading: SoundReading) => void>()

  /** [SPEC-6.4] Read by the apps that declared the `microphone` need. */
  readonly level: SoundLevel

  constructor(options: SoundServiceOptions) {
    this.source = options.source
    this.settings = options.settings
    this.clock = options.clock ?? animationFrameClock
    this.now = options.now ?? (() => new Date())
    try {
      this.calibration = parseCalibration(options.settings.readCommon(CALIBRATION_KEY))
    } catch (error) {
      options.onProblem(errorMessage(error))
    }
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
      this.calibration = calibration
      this.reading = { ...this.reading, ambientDb: calibration.ambientDb, aboveAmbientDb: this.reading.levelDb - calibration.ambientDb }
      this.setStatus({ calibrating: false, ambientDb: calibration.ambientDb, calibratedAt: calibration.date })
    } catch (error) {
      this.recording = undefined
      this.setStatus({ calibrating: false, error: `Calibrage impossible. ${errorMessage(error)}` })
    } finally {
      lease?.release()
    }
  }

  /** [SPEC-6.5] Sets the level of the simulated source. Throws with the microphone. */
  simulate(db: number): void {
    if (!this.source.setLevel) throw new Error("Le niveau ne se règle à la main qu'avec le micro simulé (?micro=simule).")
    this.source.setLevel(db)
  }

  private ensureOpen(): Promise<void> {
    if (this.opened) return Promise.resolve()
    if (this.opening) return this.opening
    this.setStatus({ phase: 'opening' })
    this.opening = this.source.open((message) => this.lose(message)).then(
      (opened) => {
        this.opening = undefined
        this.opened = opened
        this.lastFrameTime = undefined
        this.setStatus({ phase: 'on', error: null, warning: opened.warning ?? null })
        this.frame = this.clock.request(this.tick)
      },
      (error: unknown) => {
        this.opening = undefined
        this.setStatus({ phase: 'off', error: errorMessage(error) })
        throw error
      },
    )
    return this.opening
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

  /** Closes the source and stops the frame loop [SPEC-6.7]. */
  private close(): void {
    if (this.frame !== undefined) this.clock.cancel(this.frame)
    this.frame = undefined
    this.opened?.close()
    this.opened = undefined
    this.reading = { ...this.reading, rawDb: DBFS_FLOOR, levelDb: DBFS_FLOOR, aboveAmbientDb: DBFS_FLOOR - this.reading.ambientDb }
    if (this.current.phase !== 'opening') this.setStatus({ phase: 'off', warning: null })
  }

  /** [SPEC-6.6] The source stopped by itself (microphone unplugged). */
  private lose(message: string): void {
    if (!this.opened) return
    this.close()
    this.recording?.reject(new Error(message))
    this.recording = undefined
    this.setStatus({ error: message })
    for (const listener of [...this.lostListeners]) listener(message)
  }

  private setStatus(partial: Partial<SoundStatus>): void {
    this.current = { ...this.current, ...partial }
    for (const listener of [...this.statusListeners]) listener(this.current)
  }
}
