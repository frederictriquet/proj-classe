// [SPEC-4.4] [SPEC-7.2] [SPEC-7.3] [SPEC-7.4] Settings panel built from the app's declarations.
// It only reads HostState and sends HostCommand, so it can also sit on the control screen while
// the app runs on the other screen.
import type { AppManifest, SettingDeclaration, SettingValue } from '../apps/types'
import type { HostLink } from '../host/protocol'

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

/** Opens the panel as a modal dialog. Returns a function that closes it. */
export function openSettingsPanel(manifest: AppManifest, link: HostLink, onClose: () => void): () => void {
  const dialog = document.createElement('dialog')
  dialog.className = 'settings-panel'
  dialog.setAttribute('aria-labelledby', 'settings-panel-title')
  const title = document.createElement('h2')
  title.id = 'settings-panel-title'
  title.textContent = `Réglages : ${manifest.title}`
  const list = document.createElement('div')
  list.className = 'settings-list'
  const controls: Control[] = []
  for (const declaration of manifest.settings) {
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
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'primary'
  close.textContent = 'Fermer'
  close.addEventListener('click', () => dialog.close())
  actions.append(reset, close)
  dialog.append(title, list, actions)
  document.body.append(dialog)

  const unsubscribe = link.subscribe((state) => {
    const values = state.settings[manifest.id]
    if (!values) return
    for (const control of controls) {
      const value = values[control.declaration.id]
      if (value !== undefined) control.show(value)
    }
  })
  // The dialog closes with the button or with Escape (native behaviour of a modal dialog).
  dialog.addEventListener('close', () => {
    unsubscribe()
    dialog.remove()
    onClose()
  })
  dialog.showModal()
  return () => dialog.close()
}
