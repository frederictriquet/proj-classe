// [SPEC-7.5] [SPEC-6.3] [SPEC-6.6] Live sound level and « Calibrer » button, shown in the settings
// panel of an app that declares the `microphone` need. It only sends HostCommand and reads
// HostState and the level stream, so it also works from the control screen [SPEC-5.5].
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

/** Builds the section; `dispose` stops the live level and gives the microphone back. */
export function soundSection(link: HostLink): { element: HTMLElement; dispose: () => void } {
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

  section.append(title, bar, values, calibration, help, calibrate, error, warning, simulation)

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

  const offState = link.subscribe((state) => {
    if (state.sound !== status) showStatus(state.sound)
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
