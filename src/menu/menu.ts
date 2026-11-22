// [SPEC-4.5] [SPEC-5.1] [SPEC-5.3] [SPEC-7.3] [SPEC-8] Menu of the control window: a grid of large
// thumbnails, driven with the mouse or the keyboard (arrows, Enter). It reads HostState and sends
// HostCommand only. With two screens it also offers « Projeter », shows where the scene is and,
// while the scene runs an app, becomes the remote: app in progress, « Retour au menu », settings
// and live level [SPEC-5.5] [SPEC-7.5]. It also shows the version, the update messages and the
// offline witness [SPEC-3.4] [SPEC-3.6] [SPEC-3.7], and the search for a new version [SPEC-3.10].
import type { AppRegistry } from '../apps/registry'
import { isInstalledApp } from '../pwa/display-mode'
import { canInstall, onInstallAvailabilityChange, promptInstall } from '../pwa/install'
import { OFFLINE_NOTICE, offlineLabel, watchOfflineStatus } from '../pwa/offline-status'
import {
  getUpdateCheck,
  getUpdateFailure,
  onUpdateChange,
  updateCheckBusy,
  updateCheckLabel,
  updateFailureText,
  updateInstalledRemaining,
} from '../boot/update'
import { canCheckForUpdate, checkForUpdateNow, onSwRegistrationChange } from '../boot/register'
import { VERSION_LABEL } from '../version'
import { errorMessage } from '../errors'
import type { HostLink, HostState } from '../host/protocol'
import { projectionStatus, type Projection, type ProjectionMode, type ProjectionState } from '../screens/projection'
import { isArrowKey, moveInGrid } from './grid-nav'
import { hasSettingsPanel, inlineSettingsPanel, openSettingsPanel } from './settings-panel'

/** Number of tiles on the first row of the grid, as laid out by CSS. */
function columnCount(tiles: HTMLElement[]): number {
  const top = tiles[0]?.offsetTop
  return tiles.filter((tile) => tile.offsetTop === top).length
}

function button(text: string, className = ''): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = text
  if (className) element.className = className
  return element
}

/** The part of the projection the menu uses (absent on a page without two-screen mode). */
export type ProjectionControl = Pick<Projection, 'subscribe' | 'project' | 'closeScene' | 'dismissNotice'>

export function renderMenu(
  root: HTMLElement,
  registry: AppRegistry,
  link: HostLink,
  projection?: ProjectionControl,
): () => void {
  const menu = document.createElement('section')
  menu.className = 'menu'

  // Header: app name [SPEC-1], « Projeter » [SPEC-5.3] and « Installer » in a Chrome tab [SPEC-3.5].
  const header = document.createElement('header')
  header.className = 'menu-header'
  const icon = document.createElement('img')
  icon.src = `${import.meta.env.BASE_URL}icon.svg`
  icon.alt = ''
  const title = document.createElement('h1')
  title.textContent = 'Proj-Classe'
  const actions = document.createElement('div')
  actions.className = 'header-actions'
  const project = button('Projeter', 'project primary')
  project.hidden = true
  project.addEventListener('click', () => projection?.project())
  const install = button('Installer', 'install')
  actions.append(project, install)
  const installMessage = document.createElement('p')
  installMessage.className = 'install-message'
  // [SPEC-6.5] Reminds the adult that the level does not come from the microphone.
  const simulated = document.createElement('p')
  simulated.className = 'simulated-badge'
  simulated.textContent = 'Micro simulé : touches + et −'
  simulated.hidden = true
  header.append(icon, title, actions, installMessage, simulated)

  // [SPEC-3.4] [SPEC-3.6] Update messages for the adult. None without network.
  const updateInstalled = document.createElement('p')
  updateInstalled.className = 'update-installed'
  updateInstalled.setAttribute('role', 'status')
  updateInstalled.textContent = 'Mise à jour installée'
  updateInstalled.hidden = true
  const updateFailure = document.createElement('p')
  updateFailure.className = 'update-failure'
  updateFailure.setAttribute('role', 'alert')
  updateFailure.hidden = true

  // [SPEC-3.4] [SPEC-3.7] [SPEC-3.8] Bottom of the menu: offline witness, version, diagnostic.
  const footer = document.createElement('footer')
  footer.className = 'menu-footer'
  const offlineNotice = document.createElement('p')
  offlineNotice.className = 'offline-notice'
  offlineNotice.id = 'offline-notice'
  offlineNotice.textContent = OFFLINE_NOTICE
  offlineNotice.hidden = true
  const witness = button('', 'offline-witness')
  witness.setAttribute('aria-controls', offlineNotice.id)
  witness.setAttribute('aria-expanded', 'false')
  witness.addEventListener('click', () => {
    offlineNotice.hidden = !offlineNotice.hidden
    witness.setAttribute('aria-expanded', String(!offlineNotice.hidden))
  })
  const version = document.createElement('span')
  version.className = 'app-version'
  version.textContent = `Version ${VERSION_LABEL}`
  // [SPEC-3.10] Search for a new version: where it stands, and a button to run it again.
  const updateCheck = document.createElement('span')
  updateCheck.className = 'update-check'
  updateCheck.setAttribute('role', 'status')
  const checkUpdate = button('Rechercher une mise à jour', 'check-update')
  checkUpdate.addEventListener('click', () => void checkForUpdateNow(true))

  // [SPEC-5.3] [SPEC-5.4] [SPEC-5.6] Where the scene is, and what happened to it.
  const screenBar = document.createElement('div')
  screenBar.className = 'screen-bar'
  screenBar.setAttribute('role', 'status')
  screenBar.hidden = true
  const screenText = document.createElement('p')
  const closeScene = button('Fermer la scène')
  closeScene.addEventListener('click', () => projection?.closeScene())
  const screenOk = button('OK')
  screenOk.addEventListener('click', () => projection?.dismissNotice())
  screenBar.append(screenText, closeScene, screenOk)

  // [SPEC-4.7] [SPEC-4.8] Message for the adult: need not met, error, full screen refused.
  const notice = document.createElement('div')
  notice.className = 'menu-notice'
  notice.setAttribute('role', 'alert')
  notice.hidden = true
  const noticeText = document.createElement('p')
  const noticeOk = button('OK')
  noticeOk.addEventListener('click', () => link.dispatch({ type: 'dismiss-notice' }))
  notice.append(noticeText, noticeOk)

  // [SPEC-5.5] [SPEC-7.3] Remote shown while the scene runs an app on the other screen.
  const control = document.createElement('section')
  control.className = 'control-view'
  control.hidden = true
  const controlHead = document.createElement('div')
  controlHead.className = 'control-head'
  const controlTitle = document.createElement('h2')
  const back = button('Retour au menu', 'primary back')
  back.addEventListener('click', () => link.dispatch({ type: 'stop' }))
  controlHead.append(controlTitle, back)
  control.append(controlHead)

  const grid = document.createElement('ul')
  grid.className = 'menu-grid'
  const tiles: HTMLButtonElement[] = []
  let state: HostState | undefined
  let screens: ProjectionState | undefined
  let lastLaunched: string | undefined
  let closePanel: (() => void) | undefined
  let inline: { appId: string; dispose: () => void } | undefined

  for (const { manifest } of registry.entries) {
    const item = document.createElement('li')
    item.className = 'menu-item'
    const tile = button('', 'tile')
    tile.dataset.appId = manifest.id
    const thumbnail = document.createElement('img')
    thumbnail.src = manifest.thumbnail
    thumbnail.alt = ''
    const label = document.createElement('span')
    label.className = 'tile-title'
    label.textContent = manifest.title
    tile.append(thumbnail, label)
    // A button: Enter and Space click it natively, no extra key handler [SPEC-4.5].
    tile.addEventListener('click', () => {
      if (state?.phase !== 'menu' || screens?.mode === 'opening') return
      lastLaunched = manifest.id
      link.dispatch({ type: 'launch', appId: manifest.id })
    })
    item.append(tile)
    tiles.push(tile)

    // [SPEC-7.5] An app that uses the microphone always has a panel: live level and calibration.
    if (hasSettingsPanel(manifest)) {
      const settings = button('Réglages', 'tile-settings')
      settings.setAttribute('aria-label', `Réglages : ${manifest.title}`)
      settings.addEventListener('click', () => {
        if (state?.phase !== 'menu' || closePanel) return
        closePanel = openSettingsPanel(manifest, link, () => {
          closePanel = undefined
          settings.focus()
        })
      })
      item.append(settings)
    }
    grid.append(item)
  }

  grid.addEventListener('keydown', (event) => {
    if (state?.phase !== 'menu' || !isArrowKey(event.key)) return
    const index = tiles.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    tiles[moveInGrid(index, event.key, tiles.length, columnCount(tiles))]?.focus()
  })

  const empty = document.createElement('p')
  empty.className = 'menu-empty'
  empty.textContent = 'Les activités arrivent bientôt.'
  empty.hidden = tiles.length > 0

  const diagnostic = document.createElement('a')
  diagnostic.className = 'discreet-link'
  diagnostic.href = '#diagnostic'
  diagnostic.textContent = 'Diagnostic'
  footer.append(offlineNotice, witness, version, updateCheck, checkUpdate, diagnostic)

  menu.append(header, updateInstalled, updateFailure, screenBar, notice, control, grid, empty, footer)
  root.append(menu)
  tiles[0]?.focus()

  const offWitness = watchOfflineStatus((status) => {
    witness.textContent = offlineLabel(status)
    witness.dataset.state = status.kind
  })

  let installedTimer: number | undefined
  const showUpdate = () => {
    const failure = getUpdateFailure()
    updateFailure.hidden = failure === null
    updateFailure.textContent = failure === null ? '' : updateFailureText(failure, VERSION_LABEL)
    const remaining = updateInstalledRemaining()
    updateInstalled.hidden = remaining === 0
    window.clearTimeout(installedTimer)
    if (remaining > 0) installedTimer = window.setTimeout(showUpdate, remaining)
    // [SPEC-3.10.1] A downloaded version waits for the menu while the scene runs an app.
    const check = getUpdateCheck()
    const label = updateCheckLabel(check, state !== undefined && state.phase !== 'menu')
    updateCheck.hidden = label === null
    updateCheck.textContent = label ?? ''
    updateCheck.dataset.phase = check.phase
    checkUpdate.hidden = !canCheckForUpdate()
    checkUpdate.disabled = updateCheckBusy(check)
  }
  showUpdate()
  const offUpdate = onUpdateChange(showUpdate)
  // [SPEC-3.10.2] The button shows once the service worker is registered.
  const offRegistration = onSwRegistrationChange(showUpdate)

  const showInstall = () => {
    install.hidden = isInstalledApp() || !canInstall()
  }
  install.addEventListener('click', () => {
    promptInstall().then(
      (outcome) => {
        installMessage.textContent = outcome === 'accepted' ? 'Installation en cours.' : 'Installation annulée.'
      },
      (error: unknown) => {
        installMessage.textContent = `Installation impossible : ${errorMessage(error)}`
      },
    )
  })
  showInstall()
  const offInstall = onInstallAvailabilityChange(showInstall)

  /** [SPEC-5.1] [SPEC-7.3] Grid on the menu; remote while the scene runs an app. */
  const render = () => {
    project.hidden = !(screens?.mode === 'single' && screens.available && state?.phase === 'menu')
    const appId = screens?.mode === 'dual' && state?.phase !== 'menu' ? state?.appId : null
    const showControl = typeof appId === 'string'
    const wasHidden = control.hidden
    control.hidden = !showControl
    grid.hidden = showControl
    empty.hidden = showControl || tiles.length > 0
    if (!showControl) {
      inline?.dispose()
      inline = undefined
      return
    }
    const manifest = registry.entries.find((entry) => entry.manifest.id === appId)?.manifest
    const name = manifest?.title ?? appId
    controlTitle.textContent = state?.phase === 'starting' ? `Démarrage : ${name}…` : `En cours : ${name}`
    if (inline?.appId !== appId) {
      inline?.dispose()
      inline = undefined
      if (manifest && hasSettingsPanel(manifest)) {
        const panel = inlineSettingsPanel(manifest, link)
        control.append(panel.element)
        inline = { appId, dispose: panel.dispose }
      }
    }
    if (wasHidden) back.focus()
  }

  const unsubscribe = link.subscribe((next) => {
    const backToMenu = state !== undefined && state.phase !== 'menu' && next.phase === 'menu'
    state = next
    simulated.hidden = !next.sound.simulated
    notice.hidden = next.notice === null
    noticeText.textContent = next.notice?.message ?? ''
    notice.dataset.kind = next.notice?.kind ?? ''
    render()
    showUpdate()
    if (backToMenu) {
      // Keyboard flow: back on the tile that was launched.
      tiles.find((tile) => tile.dataset.appId === lastLaunched)?.focus()
    }
  })

  let lastMode: ProjectionMode | undefined
  const offProjection = projection?.subscribe((next) => {
    // The link is about to point at the other window: a settings panel open on the menu gives
    // its microphone back to the window that lent it [SPEC-5.5].
    if (lastMode !== undefined && next.mode !== lastMode) closePanel?.()
    lastMode = next.mode
    screens = next
    const status = projectionStatus(next)
    const lines = [status, next.notice].filter((line) => line !== null)
    screenBar.hidden = lines.length === 0
    screenText.textContent = lines.join('\n')
    screenBar.dataset.mode = next.mode
    closeScene.hidden = next.mode === 'single'
    screenOk.hidden = next.notice === null
    render()
  })

  // [SPEC-4.6] Escape goes back to the menu, also when the app runs on the other screen.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || control.hidden) return
    event.preventDefault()
    link.dispatch({ type: 'stop' })
  }
  document.addEventListener('keydown', onKey)

  return () => {
    document.removeEventListener('keydown', onKey)
    offWitness()
    offUpdate()
    offRegistration()
    window.clearTimeout(installedTimer)
    unsubscribe()
    offProjection?.()
    offInstall()
    closePanel?.()
    inline?.dispose()
    menu.remove()
  }
}
