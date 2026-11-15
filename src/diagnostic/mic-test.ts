// [SPEC-6.1] [SPEC-10 V1] [SPEC-10 V6] Microphone check: permission state, live level and
// the audio processing actually applied by Chrome. [SPEC-6.8] It opens the microphone chosen in
// the settings, and [SPEC-7.5] gives the difference to the calibrated ambient noise.
import { computeRms, rmsToDbfs } from '../audio/level'
import { micErrorText } from '../audio/mic-errors'
import type { MicrophoneInfo } from '../audio/microphone-choice'
import { processingReport, rawAudioConstraints } from '../audio/processing'
import { errorMessage } from '../errors'
import type { Row } from './rows'

const STABILITY_WINDOW_MS = 3000

export interface MicRows {
  permission: Row
  level: Row
  processing: Row
  device: Row
}

const PERMISSION_LABELS: Record<PermissionState, string> = {
  granted: 'accordée',
  prompt: 'pas encore accordée (Chrome la demandera)',
  denied: 'refusée',
}

export async function watchMicPermission(row: Row): Promise<void> {
  if (!navigator.permissions?.query) {
    row.set('API Permissions absente', 'warn')
    return
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    const show = () =>
      row.set(PERMISSION_LABELS[status.state], status.state === 'granted' ? 'ok' : status.state === 'denied' ? 'error' : 'warn')
    show()
    status.addEventListener('change', show)
  } catch (error) {
    row.set(`Erreur : ${errorMessage(error)}`, 'error')
  }
}

export class MicTest {
  private stream: MediaStream | undefined
  private audio: AudioContext | undefined
  private frame = 0
  private history: { t: number; db: number }[] = []
  readonly button: HTMLButtonElement

  /**
   * @param microphone the microphone chosen in the settings, null for Chrome's choice [SPEC-6.8].
   * @param ambientDb the ambient noise in use, in dBFS [SPEC-6.3].
   */
  constructor(
    private readonly rows: MicRows,
    private readonly microphone: MicrophoneInfo | null,
    private readonly ambientDb: number,
  ) {
    rows.level.set('pas encore essayé')
    rows.processing.set('pas encore essayé')
    rows.device.set('pas encore essayé')
    this.button = rows.level.addButton('Essayer le micro', () => (this.stream ? this.stop() : this.start()), true)
  }

  async start(): Promise<void> {
    this.button.disabled = true
    try {
      // [SPEC-6.1] Raw signal: automatic gain would distort the measure.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: rawAudioConstraints(this.microphone), video: false })
    } catch (error) {
      this.rows.level.set(micErrorText(error, this.microphone), 'error')
      this.button.disabled = false
      return
    }
    const track = this.stream.getAudioTracks()[0]
    if (!track) {
      this.rows.level.set("Le flux micro ne contient aucune piste audio.", 'error')
      this.stop()
      return
    }
    track.addEventListener('ended', () => {
      this.rows.level.set('Micro perdu en cours de route (débranché ou coupé par macOS).', 'error')
      this.stop(false)
    })
    this.showSettings(track)

    this.audio = new AudioContext()
    const source = this.audio.createMediaStreamSource(this.stream)
    const analyser = this.audio.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    this.history = []

    const tick = () => {
      analyser.getFloatTimeDomainData(samples)
      const db = rmsToDbfs(computeRms(samples))
      const now = performance.now()
      this.history.push({ t: now, db })
      while (this.history.length > 0 && now - (this.history[0]?.t ?? now) > STABILITY_WINDOW_MS) this.history.shift()
      const values = this.history.map((h) => h.db)
      const min = Math.min(...values)
      const max = Math.max(...values)
      this.rows.level.set(
        `${db.toFixed(1)} dBFS, soit ${(db - this.ambientDb).toFixed(1)} dB au-dessus du bruit ambiant\nsur les 3 dernières secondes : min ${min.toFixed(1)}, max ${max.toFixed(1)} (écart ${(max - min).toFixed(1)} dB)`,
        'ok',
      )
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
    this.button.textContent = 'Arrêter le micro'
    this.button.disabled = false
  }

  private showSettings(track: MediaStreamTrack): void {
    const settings = track.getSettings()
    const { lines, allOff } = processingReport(settings)
    this.rows.processing.set(
      allOff ? `${lines.join('\n')}\nles trois traitements sont désactivés` : `${lines.join('\n')}\nATTENTION : un traitement reste actif ou n'est pas signalé`,
      allOff ? 'ok' : 'warn',
    )
    this.rows.device.set(`${track.label || 'sans nom'}\n${settings.sampleRate ?? '?'} Hz, ${settings.channelCount ?? '?'} canal(aux)`)
  }

  stop(resetText = true): void {
    cancelAnimationFrame(this.frame)
    // [SPEC-6.7] Release the microphone: Chrome's recording indicator goes off.
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = undefined
    void this.audio?.close()
    this.audio = undefined
    if (resetText && this.rows.level.text().includes('dBFS')) {
      this.rows.level.set(`${this.rows.level.text()}\n(micro arrêté)`)
    }
    this.button.textContent = 'Essayer le micro'
    this.button.disabled = false
  }
}
