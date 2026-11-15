// [SPEC-4.4] [SPEC-7.2] [SPEC-7.3] [SPEC-7.4] [SPEC-7.5] Settings panel built from the app's declarations.
// It only reads HostState and sends HostCommand, so it can also sit on the control screen while
// the app runs on the other screen.
import type { AppManifest, SettingDeclaration, SettingValue } from '../apps/types'
import type { HostLink } from '../host/protocol'
import { gaugeSlider, soundSection } from './sound-section'

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export function formatSetting(value: number, unit: string | undefined): string {
  return unit ? `${numberFormat.format(value)} ${unit}` : numberFormat.format(value)
}

interface Control {
  declaration: SettingDeclaration
  show(value: SettingValue): void
}

function sliderControl(appId: string, declaration: SettingDeclaration & { type: 'slider' }, link: HostLink) {
  const row = document.createElement('label')
  row.className = 'setting'
  const name = document.createElement('span')
  name.className = 'setting-label'
  name.textContent = declaration.label
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(declaration.min)
  input.max = String(declaration.max)
  input.step = String(declaration.step)
  const output = document.createElement('output')
  output.className = 'setting-value'
  row.append(name, input, output)
  // 'input' rather than 'change': the app follows the slider while it moves [SPEC-7.2].
  input.addEventListener('input', () => {
    link.dispatch({ type: 'set-setting', appId, settingId: declaration.id, value: Number(input.value) })
  })
  const control: Control = {
    declaration,
    show(value) {
      if (typeof value !== 'number') return
      if (input.valueAsNumber !== value) input.value = String(value)
      output.textContent = formatSetting(value, declaration.unit)
    },
  }
  return { row, control }
}

function toggleControl(appId: string, declaration: SettingDeclaration & { type: 'toggle' }, link: HostLink) {
  const row = document.createElement('label')
  row.className = 'setting setting-toggle'
  const input = document.createElement('input')
  input.type = 'checkbox'
  const name = document.createElement('span')
  name.className = 'setting-label'
  name.textContent = declaration.label
  row.append(input, name)
  input.addEventListener('change', () => {
    link.dispatch({ type: 'set-setting', appId, settingId: declaration.id, value: input.checked })
  })
  const control: Control = {
    declaration,
    show(value) {
      if (typeof value === 'boolean') input.checked = value
    },
  }
  return { row, control }
}

/** True when the app has a settings panel: declared settings, or the microphone [SPEC-7.5]. */
export function hasSettingsPanel(manifest: AppManifest): boolean {
  return manifest.settings.length > 0 || manifest.needs.includes('microphone')
}

interface PanelContent {
  /** Microphone and live level, the declared settings, then the calibration (microphone apps). */
  elements: HTMLElement[]
  /** Row of buttons, « Valeurs par défaut » first [SPEC-7.4]. */
  actions: HTMLElement
  dispose(): void
}

/** Controls of the panel, shared by the modal panel of the menu and the panel that stays on the
 *  control window while the scene runs [SPEC-7.3]. */
function panelContent(manifest: AppManifest, link: HostLink): PanelContent {
  const list = document.createElement('div')
  list.className = 'settings-list'
  const controls: Control[] = []
  // [SPEC-7.5] The slider of the sound thresholds sits under the live level, not in the list.
  const underLevel = manifest.needs.includes('microphone') ? gaugeSlider(manifest)?.id : undefined
  for (const declaration of manifest.settings) {
    if (declaration.id === underLevel) continue
    const { row, control } =
      declaration.type === 'slider'
        ? sliderControl(manifest.id, declaration, link)
        : toggleControl(manifest.id, declaration, link)
    list.append(row)
    controls.push(control)
  }

  const actions = document.createElement('div')
  actions.className = 'settings-actions'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'Valeurs par défaut'
  reset.addEventListener('click', () => link.dispatch({ type: 'reset-settings', appId: manifest.id }))
  actions.append(reset)
  // [SPEC-7.5] Microphone, live level and calibration for an app that listens to the classroom.
  const sound = manifest.needs.includes('microphone') ? soundSection(link, manifest) : undefined

  const unsubscribe = link.subscribe((state) => {
    const values = state.settings[manifest.id]
    if (!values) return
    for (const control of controls) {
      const value = values[control.declaration.id]
      if (value !== undefined) control.show(value)
    }
  })
  return {
    // [SPEC-7.5] The calibration comes last, after the other settings.
    elements: sound ? [sound.top, list, sound.calibration] : [list],
    actions,
    dispose() {
      sound?.dispose()
      unsubscribe()
    },
  }
}

/** Opens the panel as a modal dialog. Returns a function that closes it. */
export function openSettingsPanel(manifest: AppManifest, link: HostLink, onClose: () => void): () => void {
  const dialog = document.createElement('dialog')
  dialog.className = 'settings-panel'
  dialog.setAttribute('aria-labelledby', 'settings-panel-title')
  const title = document.createElement('h2')
  title.id = 'settings-panel-title'
  title.textContent = `Réglages : ${manifest.title}`
  const content = panelContent(manifest, link)
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'primary'
  close.textContent = 'Fermer'
  close.addEventListener('click', () => dialog.close())
  content.actions.append(close)
  dialog.append(title, ...content.elements, content.actions)
  document.body.append(dialog)

  // The dialog closes with the button or with Escape (native behaviour of a modal dialog).
  let closed = false
  const finish = () => {
    if (closed) return
    closed = true
    content.dispose()
    dialog.remove()
    onClose()
  }
  dialog.addEventListener('close', finish)
  dialog.showModal()
  // The 'close' event comes in a later task: the returned function releases everything at once,
  // before the caller switches the link to the other screen [SPEC-5.5].
  return () => {
    dialog.close()
    finish()
  }
}

/** [SPEC-7.3] [SPEC-7.5] Panel that stays on the control window while the scene runs the app:
 *  settings applied at once, live level and « Calibrer » for a microphone app. */
export function inlineSettingsPanel(manifest: AppManifest, link: HostLink): { element: HTMLElement; dispose: () => void } {
  const section = document.createElement('section')
  section.className = 'settings-panel settings-inline'
  section.setAttribute('aria-label', `Réglages : ${manifest.title}`)
  const title = document.createElement('h2')
  title.textContent = 'Réglages'
  const content = panelContent(manifest, link)
  section.append(title, ...content.elements, content.actions)
  return {
    element: section,
    dispose() {
      content.dispose()
      section.remove()
    },
  }
}
