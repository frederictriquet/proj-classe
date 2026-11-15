// [SPEC-7.5] [SPEC-6.3] [SPEC-6.6] [SPEC-6.8] Sound part of the settings panel of an app that
// declares the `microphone` need. Top: the microphone menu, the live level on a bar graduated in
// dB above the ambient noise with the app's thresholds [SPEC-9.6], the slider that sets them
// right under the bar on the same scale, the zone in words, the microphone's errors. Bottom: the
// calibration. No value in dB is shown: the diagnostic page gives them. It only sends HostCommand
// and reads HostState and the level stream, so it also works from the control screen [SPEC-5.5].
import type { AppManifest, SettingValues, SliderSetting, SoundThreshold } from '../apps/types'
import { DBFS_FLOOR } from '../audio/level'
import type { SoundReading, SoundStatus } from '../audio/sound-service'
import type { HostLink } from '../host/protocol'

const dbFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Scale of the bar, in dB above the ambient noise [SPEC-6.4]. */
export interface GaugeScale {
  minDb: number
  maxDb: number
}

/** [SPEC-7.5] Scale of an app without thresholds: from the ambient noise to a loud class. */
export const DEFAULT_GAUGE_SCALE: Readonly<GaugeScale> = { minDb: 0, maxDb: 60 }

/** [SPEC-7.5] The slider that sets the app's thresholds, shown under the bar; undefined when the
 *  app declares none (the registry checks that they all name one slider). */
export function gaugeSlider(manifest: AppManifest): SliderSetting | undefined {
  const id = manifest.soundThresholds?.[0]?.setting
  const setting = manifest.settings.find((s) => s.id === id)
  return setting?.type === 'slider' ? setting : undefined
}

/** [SPEC-7.5] The bar has the scale of the slider under it, so the thumb lies on the first mark. */
export function gaugeScale(slider: SliderSetting | undefined): GaugeScale {
  return slider ? { minDb: slider.min, maxDb: slider.max } : DEFAULT_GAUGE_SCALE
}

/** Position on the bar, in percent, of a level in dB above the ambient noise. */
export function gaugePercent(aboveDb: number, scale: GaugeScale): number {
  return Math.min(100, Math.max(0, ((aboveDb - scale.minDb) / (scale.maxDb - scale.minDb)) * 100))
}

/** [SPEC-4.1] Index in `soundZones` of a level, given the thresholds in increasing order: below
 *  the first, 0; on or above it, the first threshold not passed (a level on it stays below); above
 *  the last, their count. Same bounds as `zoneOf` in the forest's logic [SPEC-9.4]. */
export function zoneIndex(aboveDb: number, thresholdsDb: readonly number[]): number {
  const first = thresholdsDb[0]
  if (first === undefined || aboveDb < first) return 0
  for (let i = 1; i < thresholdsDb.length; i++) {
    if (aboveDb <= (thresholdsDb[i] ?? Infinity)) return i
  }
  return thresholdsDb.length
}

/** Badge above the bar: the phase of the microphone, or the zone of the level [SPEC-7.5]. */
export interface LevelBadge {
  text: string
  /** 'calm' for the first zone, 'noise' for the last, 'alert' between; 'off' when not measuring. */
  kind: 'off' | 'calm' | 'alert' | 'noise'
}

export function levelBadge(
  phase: SoundStatus['phase'],
  zones: readonly string[],
  aboveDb: number,
  thresholdsDb: readonly number[],
): LevelBadge | undefined {
  if (phase === 'off') return { text: 'Micro fermé', kind: 'off' }
  if (phase === 'opening') return { text: 'Ouverture du micro…', kind: 'off' }
  const index = zoneIndex(aboveDb, thresholdsDb)
  const text = zones[index]
  if (text === undefined) return undefined
  return { text, kind: index === 0 ? 'calm' : index === zones.length - 1 ? 'noise' : 'alert' }
}

/** [SPEC-6.3] State of the calibration, without the value in dB [SPEC-7.5]. */
export function calibrationText(status: SoundStatus): string {
  if (status.calibrating) return 'Calibrage en cours : silence pendant 3 secondes…'
  if (status.calibratedAt === null) return 'Pas encore calibré : le bruit ambiant par défaut est utilisé.'
  return `Calibré le ${dateFormat.format(new Date(status.calibratedAt))}.`
}

/** Value of the « Micro choisi par Chrome » option. */
export const CHROME_CHOICE = ''

export interface MicrophoneOption {
  value: string
  text: string
}

/** [SPEC-6.8] Options of the microphone menu and the one selected. The option of Chrome's choice
 *  names the microphone Chrome opened, when it is open; a chosen microphone that is unplugged
 *  stays listed, so the menu shows what is stored. */
export function microphoneOptions(status: SoundStatus): { options: MicrophoneOption[]; selected: string } {
  const opened = status.microphone === null && status.device !== null ? ` (${status.device})` : ''
  const options: MicrophoneOption[] = [
    { value: CHROME_CHOICE, text: `Micro choisi par Chrome${opened}` },
    ...status.microphones.map((m) => ({ value: m.id, text: m.label })),
  ]
  const chosen = status.microphone
  if (chosen !== null && !status.microphones.some((m) => m.id === chosen.id)) {
    options.push({ value: chosen.id, text: `${chosen.label} (débranché)` })
  }
  return { options, selected: chosen?.id ?? CHROME_CHOICE }
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

/** For the diagnostic page [SPEC-7.5]: « Alerte : 6 dB au-dessus du bruit ambiant (−54 dB) ». */
export function thresholdText(mark: ThresholdMark): string {
  return `${mark.label} : ${dbFormat.format(mark.aboveDb)} dB au-dessus du bruit ambiant (${formatDb(mark.db)})`
}

export function formatDb(db: number): string {
  return db <= DBFS_FLOOR ? 'silence' : `${dbFormat.format(db)} dB`
}

function paragraph(className: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = className
  return p
}

/**
 * Builds both parts; the settings panel puts the calibration at its bottom [SPEC-7.5]. `dispose`
 * stops the live level and gives the microphone back.
 */
export function soundSection(
  link: HostLink,
  manifest: AppManifest,
): { top: HTMLElement; calibration: HTMLElement; dispose: () => void } {
  const top = document.createElement('section')
  top.className = 'sound-section'
  top.setAttribute('aria-label', 'Micro et niveau sonore')

  // [SPEC-6.8] Microphone menu, hidden with the simulated source.
  const microphone = document.createElement('label')
  microphone.className = 'setting sound-microphone'
  const microphoneName = document.createElement('span')
  microphoneName.className = 'setting-label'
  microphoneName.textContent = 'Micro'
  const select = document.createElement('select')
  microphone.append(microphoneName, select)

  // Live level, with the zone in words [SPEC-7.5].
  const head = document.createElement('div')
  head.className = 'sound-level-head'
  const levelName = document.createElement('span')
  levelName.className = 'setting-label'
  levelName.textContent = 'Niveau sonore'
  const badge = document.createElement('span')
  badge.className = 'sound-zone'
  badge.setAttribute('role', 'status')
  head.append(levelName, badge)

  const slider = gaugeSlider(manifest)
  const scale = gaugeScale(slider)
  const thresholds = manifest.soundThresholds ?? []
  const zones = manifest.soundZones ?? []

  const gauge = document.createElement('div')
  gauge.className = 'sound-gauge'
  const bar = document.createElement('div')
  bar.className = 'sound-bar'
  bar.setAttribute('role', 'meter')
  bar.setAttribute('aria-label', 'Niveau sonore en direct')
  bar.setAttribute('aria-valuemin', '0')
  bar.setAttribute('aria-valuemax', '100')
  const fill = document.createElement('div')
  fill.className = 'sound-bar-fill'
  bar.append(fill)
  // [SPEC-9.6] One mark per declared threshold.
  const marks = thresholds.map((_, i) => {
    const mark = document.createElement('div')
    mark.className = `sound-bar-threshold sound-threshold-${i}`
    bar.append(mark)
    return mark
  })
  gauge.append(bar)

  // [SPEC-7.5] The slider of the thresholds, under the bar, its thumb on the first mark.
  let input: HTMLInputElement | undefined
  if (slider) {
    const range = document.createElement('input')
    range.type = 'range'
    range.className = 'sound-gauge-slider'
    range.min = String(slider.min)
    range.max = String(slider.max)
    range.step = String(slider.step)
    range.setAttribute('aria-label', slider.label)
    // 'input' rather than 'change': the app and the marks follow the slider while it moves [SPEC-7.2].
    range.addEventListener('input', () => {
      link.dispatch({ type: 'set-setting', appId: manifest.id, settingId: slider.id, value: range.valueAsNumber })
    })
    const explanation = paragraph('sound-gauge-label')
    explanation.textContent = slider.label
    gauge.append(range, explanation)
    input = range
  }

  const error = paragraph('sound-error')
  error.setAttribute('role', 'alert')
  const warning = paragraph('sound-warning')

  // [SPEC-6.5] Simulated source: a slider sets the raw level, in dBFS (development only).
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

  top.append(microphone, head, gauge, error, warning, simulation)

  // [SPEC-6.3] Calibration, at the bottom of the panel.
  const calibration = document.createElement('section')
  calibration.className = 'sound-calibration'
  const calibrationTitle = document.createElement('h3')
  calibrationTitle.textContent = 'Calibrage'
  const calibrationState = paragraph('sound-calibration-state')
  const help = paragraph('sound-help')
  help.textContent = 'Demandez le silence à la classe, puis cliquez sur « Calibrer » : la mesure dure 3 secondes.'
  const calibrate = document.createElement('button')
  calibrate.type = 'button'
  calibrate.textContent = 'Calibrer'
  calibrate.addEventListener('click', () => link.dispatch({ type: 'calibrate' }))
  const calibrationBody = document.createElement('div')
  calibrationBody.append(calibrationTitle, calibrationState, help)
  calibration.append(calibrationBody, calibrate)

  let status: SoundStatus | undefined
  let thresholdsDb: number[] = []
  let lastAboveDb = -Infinity
  const showBadge = () => {
    if (!status) return
    const next = levelBadge(status.phase, zones, lastAboveDb, thresholdsDb)
    badge.hidden = next === undefined
    if (next === undefined) return
    if (badge.textContent !== next.text) badge.textContent = next.text
    badge.dataset['zone'] = next.kind
  }

  const showReading = (reading: SoundReading) => {
    lastAboveDb = reading.aboveAmbientDb
    const percent = gaugePercent(reading.aboveAmbientDb, scale)
    fill.style.width = `${percent}%`
    bar.setAttribute('aria-valuenow', String(Math.round(percent)))
    showBadge()
    // While the slider moves, the reading comes back with the slider's own value: no conflict.
    if (status?.simulated && simulationInput.valueAsNumber !== reading.rawDb) {
      simulationInput.value = String(reading.rawDb)
    }
    simulationValue.textContent = formatDb(reading.rawDb)
  }

  let shownOptions = ''
  const showMicrophones = (next: SoundStatus) => {
    microphone.hidden = next.simulated
    const { options, selected } = microphoneOptions(next)
    // Rebuilt only when the list changes: rebuilding would close a menu the adult has open.
    const key = JSON.stringify(options)
    if (key !== shownOptions) {
      shownOptions = key
      select.replaceChildren(
        ...options.map((o) => {
          const option = document.createElement('option')
          option.value = o.value
          option.textContent = o.text
          return option
        }),
      )
    }
    select.value = selected
  }
  select.addEventListener('change', () => {
    if (select.value === CHROME_CHOICE) {
      link.dispatch({ type: 'choose-microphone', microphone: null })
      return
    }
    const known = [...(status?.microphones ?? []), ...(status?.microphone ? [status.microphone] : [])]
    const chosen = known.find((m) => m.id === select.value)
    if (!chosen) throw new Error(`Micro inconnu dans le menu : « ${select.value} »`)
    link.dispatch({ type: 'choose-microphone', microphone: chosen })
  })

  const showStatus = (next: SoundStatus) => {
    status = next
    showMicrophones(next)
    showBadge()
    calibrationState.textContent = calibrationText(next)
    calibrate.disabled = next.calibrating || next.phase === 'opening'
    calibrate.textContent = next.calibrating ? 'Calibrage…' : 'Calibrer'
    error.textContent = next.error ?? ''
    error.hidden = next.error === null
    warning.textContent = next.warning ?? ''
    warning.hidden = next.warning === null
    simulation.hidden = !next.simulated
    if (next.phase !== 'on') fill.style.width = '0%'
  }

  // Marks and slider move with the settings (« Valeurs par défaut » too) [SPEC-7.4].
  let shownValues: SettingValues | undefined
  const showThresholds = (values: SettingValues) => {
    if (values === shownValues) return
    shownValues = values
    // The marks are placed in dB above the ambient noise: the ambient value plays no part.
    const placed = thresholdMarks(thresholds, values, 0)
    thresholdsDb = placed.map((mark) => mark.aboveDb)
    placed.forEach((mark, i) => {
      const element = marks[i]
      if (element) element.style.left = `${gaugePercent(mark.aboveDb, scale)}%`
    })
    const value = slider ? values[slider.id] : undefined
    if (input && typeof value === 'number' && input.valueAsNumber !== value) input.value = String(value)
    showBadge()
  }

  const offState = link.subscribe((state) => {
    if (state.sound !== status) showStatus(state.sound)
    if (thresholds.length > 0) {
      const values = state.settings[manifest.id]
      if (!values) throw new Error(`Réglages de « ${manifest.title} » absents de l'état de l'hôte`)
      showThresholds(values)
    }
  })
  const offLevel = link.subscribeLevel(showReading)
  // The panel holds the microphone while it is open [SPEC-7.5] [SPEC-6.7].
  link.dispatch({ type: 'monitor-sound', on: true })

  return {
    top,
    calibration,
    dispose() {
      offLevel()
      offState()
      link.dispatch({ type: 'monitor-sound', on: false })
    },
  }
}
