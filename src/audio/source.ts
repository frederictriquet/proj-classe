// [SPEC-6.5] Where the raw level comes from: the microphone or the simulated source. Both give
// one dBFS value per frame through the same interface; smoothing and calibration are applied by
// the service, so the simulated source takes the same path as the microphone.
import type { MicrophoneInfo } from './microphone-choice'

export interface OpenedSource {
  /** Current level in dBFS: RMS of the last block of samples [SPEC-6.2]. */
  read(): number
  /** [SPEC-6.1] French warning when Chrome kept an audio processing on. */
  readonly warning?: string
  /** [SPEC-6.6] Name of the device the browser opened (`track.label`), when it gives one. */
  readonly device?: string
  /** Releases everything (tracks, audio context) [SPEC-6.7]. Safe to call twice. */
  close(): void
}

export interface LevelSource {
  /** True for the simulated source [SPEC-6.5]. */
  readonly simulated: boolean
  /**
   * Opens the source. Rejects with an `ExplainedError` whose French message says what to do
   * [SPEC-6.6]. `onLost` is called with such a message if the source stops by itself later
   * (microphone unplugged).
   * @param microphone [SPEC-6.8] the microphone chosen by the adult, null for Chrome's choice.
   */
  open(onLost: (message: string) => void, microphone: MicrophoneInfo | null): Promise<OpenedSource>
  /** [SPEC-6.8] Microphones the adult can choose; none for the simulated source. */
  listMicrophones(): Promise<MicrophoneInfo[]>
  /** [SPEC-6.8] Calls `listener` when a microphone is plugged or unplugged. */
  watchMicrophones(listener: () => void): void
  /** Simulated source only: sets the level in dBFS [SPEC-6.5]. */
  setLevel?(db: number): void
}
