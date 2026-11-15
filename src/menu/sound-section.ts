// [SPEC-7.5] [SPEC-6.3] [SPEC-6.6] Live sound level and « Calibrer » button, shown in the settings
// panel of an app that declares the `microphone` need, with the app's thresholds marked on the
// level [SPEC-9.6]. It only sends HostCommand and reads HostState and the level stream, so it
// also works from the control screen [SPEC-5.5].
import type { AppManifest, SettingValues, SoundThreshold } from '../apps/types'
import type { SoundReading, SoundStatus } from '../audio/sound-service'
import { DBFS_FLOOR } from '../audio/level'
import type { HostLink } from '../host/protocol'

/** Range of the level bar, dBFS: from a very quiet room to a shout close to the microphone. */
const BAR_MIN_DB = -90
const BAR_MAX_DB = -10

const dbFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const signedDbFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Position of a level on the bar, in percent. */
export function barPercent(db: number): number {
  return Math.min(100, Math.max(0, ((db - BAR_MIN_DB) / (BAR_MAX_DB - BAR_MIN_DB)) * 100))
}

export function formatDb(db: number): string {
  return db <= DBFS_FLOOR ? 'silence' : `${dbFormat.format(db)} dB`
}

export function calibrationText(status: SoundStatus): string {
  const ambient = `Bruit ambiant : ${formatDb(status.ambientDb)}`
  if (status.calibrating) return `${ambient}. Calibrage en cours : silence pendant 3 secondes…`
  if (status.calibratedAt === null) return `${ambient} (valeur par défaut, pas encore calibré).`
  return `${ambient} (calibré le ${dateFormat.format(new Date(status.calibratedAt))}).`
}

/** A threshold placed on the level [SPEC-7.5]. */
export interface ThresholdMark {
  label: string
  /** dB above the ambient noise. */
  aboveDb: number
  /** Level in dBFS: ambient noise + `aboveDb`. */
  db: number
}

/** [SPEC-7.5] [SPEC-9.6] Where the app's thresholds lie with its current settings and the
 *  ambient noise in use. */
export function thresholdMarks(thresholds: readonly SoundThreshold[], values: SettingValues, ambientDb: number): ThresholdMark[] {
  return thresholds.map((threshold) => {
    const value = values[threshold.setting]
    if (typeof value !== 'number') throw new Error(`Seuil « ${threshold.label} » : réglage « ${threshold.setting} » sans valeur numérique`)
    const aboveDb = value + (threshold.offsetDb ?? 0)
    return { label: threshold.label, aboveDb, db: ambientDb + aboveDb }
  })
}

/** Legend of the marks, for example « Alerte : 6 dB au-dessus du bruit ambiant (−54 dB) ». */
export function thresholdText(mark: ThresholdMark): string {
  return `${mark.label} : ${dbFormat.format(mark.aboveDb)} dB au-dessus du bruit ambiant (${formatDb(mark.db)})`
}

/** Builds the section; `dispose` stops the live level and gives the microphone back. */
export function soundSection(link: HostLink, manifest: AppManifest): { element: HTMLElement; dispose: () => void } {
  const section = document.createElement('section')
  section.className = 'sound-section'
  const title = document.createElement('h3')
  title.textContent = 'Niveau sonore'

  const bar = document.createElement('div')
  bar.className = 'sound-bar'
  bar.setAttribute('role', 'meter')
  bar.setAttribute('aria-label', 'Niveau sonore en direct')
  bar.setAttribute('aria-valuemin', String(BAR_MIN_DB))
  bar.setAttribute('aria-valuemax', String(BAR_MAX_DB))
  const fill = document.createElement('div')
  fill.className = 'sound-bar-fill'
  const ambientMark = document.createElement('div')
  ambientMark.className = 'sound-bar-ambient'
  bar.append(fill, ambientMark)
  // [SPEC-9.6] One mark per declared threshold, with its legend.
  const thresholds = manifest.soundThresholds ?? []
  const thresholdLines = thresholds.map((_, i) => {
    const mark = document.createElement('div')
    mark.className = `sound-bar-threshold sound-threshold-${i}`
    bar.append(mark)
    const line = document.createElement('li')
    line.className = `sound-threshold-${i}`
    return { mark, line }
  })
  const legend = document.createElement('ul')
  legend.className = 'sound-thresholds'
  legend.append(...thresholdLines.map((t) => t.line))
  legend.hidden = thresholds.length === 0

  const values = document.createElement('p')
  values.className = 'sound-values'
  const calibration = document.createElement('p')
  calibration.className = 'sound-calibration'
  const help = document.createElement('p')
  help.className = 'sound-help'
  help.textContent = 'Demandez le silence à la classe, puis cliquez sur « Calibrer » : la mesure dure 3 secondes.'
  const calibrate = document.createElement('button')
  calibrate.type = 'button'
  calibrate.textContent = 'Calibrer'
  calibrate.addEventListener('click', () => link.dispatch({ type: 'calibrate' }))
  const error = document.createElement('p')
  error.className = 'sound-error'
  error.setAttribute('role', 'alert')
  const warning = document.createElement('p')
  warning.className = 'sound-warning'

  // [SPEC-6.5] Simulated source: a slider sets the level.
  const simulation = document.createElement('label')
  simulation.className = 'setting sound-simulation'
  const simulationName = document.createElement('span')
  simulationName.className = 'setting-label'
  simulationName.textContent = 'Micro simulé (touches + et −)'
  const simulationInput = document.createElement('input')
  simulationInput.type = 'range'
  simulationInput.min = String(DBFS_FLOOR)
  simulationInput.max = '0'
  simulationInput.step = '1'
  const simulationValue = document.createElement('output')
  simulationValue.className = 'setting-value'
  simulation.append(simulationName, simulationInput, simulationValue)
  simulationInput.addEventListener('input', () => {
    link.dispatch({ type: 'simulate-level', db: simulationInput.valueAsNumber })
  })

  section.append(title, bar, legend, values, calibration, help, calibrate, error, warning, simulation)

  let status: SoundStatus | undefined
  const showReading = (reading: SoundReading) => {
    fill.style.width = `${barPercent(reading.levelDb)}%`
    bar.setAttribute('aria-valuenow', String(Math.round(reading.levelDb)))
    values.textContent = `Niveau : ${formatDb(reading.levelDb)}, écart au bruit ambiant : ${signedDbFormat.format(reading.aboveAmbientDb)} dB`
    // While the slider moves, the reading comes back with the slider's own value: no conflict.
    if (status?.simulated && simulationInput.valueAsNumber !== reading.rawDb) {
      simulationInput.value = String(reading.rawDb)
    }
    simulationValue.textContent = formatDb(reading.rawDb)
  }
  const showStatus = (next: SoundStatus) => {
    status = next
    ambientMark.style.left = `${barPercent(next.ambientDb)}%`
    calibration.textContent = calibrationText(next)
    calibrate.disabled = next.calibrating || next.phase === 'opening'
    calibrate.textContent = next.calibrating ? 'Calibrage…' : 'Calibrer'
    if (next.phase === 'opening') values.textContent = 'Ouverture du micro…'
    else if (next.phase === 'off') values.textContent = 'Micro fermé.'
    error.textContent = next.error ?? ''
    error.hidden = next.error === null
    warning.textContent = next.warning ?? ''
    warning.hidden = next.warning === null
    simulation.hidden = !next.simulated
    if (next.phase !== 'on') fill.style.width = '0%'
  }

  // Moves with the settings and after a calibration.
  let shownValues: SettingValues | undefined
  let shownAmbient: number | undefined
  const showThresholds = (values: SettingValues, ambientDb: number) => {
    if (values === shownValues && ambientDb === shownAmbient) return
    shownValues = values
    shownAmbient = ambientDb
    thresholdMarks(thresholds, values, ambientDb).forEach((mark, i) => {
      const { mark: element, line } = thresholdLines[i]!
      element.style.left = `${barPercent(mark.db)}%`
      line.textContent = thresholdText(mark)
    })
  }

  const offState = link.subscribe((state) => {
    if (state.sound !== status) showStatus(state.sound)
    const values = state.settings[manifest.id]
    if (thresholds.length > 0) {
      if (!values) throw new Error(`Réglages de « ${manifest.title} » absents de l'état de l'hôte`)
      showThresholds(values, state.sound.ambientDb)
    }
  })
  const offLevel = link.subscribeLevel(showReading)
  // The panel holds the microphone while it is open [SPEC-7.5] [SPEC-6.7].
  link.dispatch({ type: 'monitor-sound', on: true })

  return {
    element: section,
    dispose() {
      offLevel()
      offState()
      link.dispatch({ type: 'monitor-sound', on: false })
    },
  }
}
