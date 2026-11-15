// [SPEC-6.1] [SPEC-6.2] [SPEC-6.6] [SPEC-6.7] Microphone source: getUserMedia with the audio
// processing off, RMS of an AnalyserNode's time-domain signal. The stream goes to the analyser
// only: it is never recorded nor sent anywhere.
import { ExplainedError } from '../errors'
import { computeRms, rmsToDbfs } from './level'
import { MIC_LOST_TEXT, micErrorText, NO_MIC_API_TEXT } from './mic-errors'
import { microphonesFrom, type MicrophoneInfo } from './microphone-choice'
import { processingWarning, rawAudioConstraints } from './processing'
import type { LevelSource, OpenedSource } from './source'

/** 2048 samples: about 43 ms at 48 kHz, longer than a frame, so no sound falls between two reads. */
const FFT_SIZE = 2048
/** How long to wait for Chrome to start a suspended audio context. */
const RESUME_TIMEOUT_MS = 1000

export class MicrophoneSource implements LevelSource {
  readonly simulated = false

  async open(onLost: (message: string) => void, microphone: MicrophoneInfo | null): Promise<OpenedSource> {
    if (!navigator.mediaDevices?.getUserMedia) throw new ExplainedError(NO_MIC_API_TEXT)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: rawAudioConstraints(microphone), video: false })
    } catch (error) {
      throw new ExplainedError(micErrorText(error, microphone), { cause: error })
    }
    const stopTracks = () => {
      for (const track of stream.getTracks()) track.stop()
    }
    const track = stream.getAudioTracks()[0]
    if (!track) {
      stopTracks()
      throw new ExplainedError('Le flux du micro ne contient aucune piste audio. Vérifiez Réglages Système > Son > Entrée.')
    }

    const audio = new AudioContext()
    let closed = false
    // Closing an audio context twice rejects, so the first call does everything.
    const closeAll = () => {
      if (closed) return
      closed = true
      track.removeEventListener('ended', onEnded)
      stopTracks()
      void audio.close()
    }
    function onEnded() {
      closeAll()
      onLost(MIC_LOST_TEXT)
    }
    // A function, so that TypeScript does not keep the narrowing across the await.
    const state = (): AudioContextState => audio.state
    if (state() !== 'running') {
      // Started from a click, the context runs at once; otherwise Chrome may keep it suspended.
      await Promise.race([audio.resume(), new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS))])
      const reached = state()
      if (reached !== 'running') {
        closeAll()
        throw new ExplainedError(
          // [SPEC-5.5] With two screens, the window to click is the scene, on the projector.
          `Chrome n'a pas démarré l'audio (état « ${reached} »). Cliquez une fois dans la fenêtre où l'activité s'affiche (sur le projecteur avec deux écrans), puis relancez l'activité.`,
        )
      }
    }
    // [SPEC-6.6] Unplugged microphone, permission withdrawn: the track ends by itself.
    track.addEventListener('ended', onEnded)

    const analyser = audio.createAnalyser()
    analyser.fftSize = FFT_SIZE
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)

    return {
      read() {
        analyser.getFloatTimeDomainData(samples)
        return rmsToDbfs(computeRms(samples))
      },
      warning: processingWarning(track.getSettings()),
      device: track.label || undefined,
      // [SPEC-6.7] Stopping every track turns Chrome's microphone indicator off.
      close: closeAll,
    }
  }

  async listMicrophones(): Promise<MicrophoneInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    return microphonesFrom(await navigator.mediaDevices.enumerateDevices())
  }

  watchMicrophones(listener: () => void): void {
    // Kept for the life of the window, like the service that asks for it.
    navigator.mediaDevices?.addEventListener('devicechange', listener)
  }
}
