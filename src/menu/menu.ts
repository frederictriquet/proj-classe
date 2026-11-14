// [SPEC-4.5] [SPEC-5.1] [SPEC-7.3] [SPEC-8] Menu: a grid of large thumbnails, driven with the
// mouse or the keyboard (arrows, Enter). It reads HostState and sends HostCommand only.
import type { AppRegistry } from '../apps/registry'
import { isInstalledApp } from '../pwa/display-mode'
import { canInstall, onInstallAvailabilityChange, promptInstall } from '../pwa/install'
import { errorMessage } from '../errors'
import type { HostLink, HostState } from '../host/protocol'
import { isArrowKey, moveInGrid } from './grid-nav'
import { openSettingsPanel } from './settings-panel'

/** Number of tiles on the first row of the grid, as laid out by CSS. */
function columnCount(tiles: HTMLElement[]): number {
  const top = tiles[0]?.offsetTop
  return tiles.filter((tile) => tile.offsetTop === top).length
}

export function renderMenu(root: HTMLElement, registry: AppRegistry, link: HostLink): () => void {
  const menu = document.createElement('section')
  menu.className = 'menu'

  // Header: app name [SPEC-1] and « Installer » button in a Chrome tab [SPEC-3.5].
  const header = document.createElement('header')
  header.className = 'menu-header'
  const icon = document.createElement('img')
  icon.src = `${import.meta.env.BASE_URL}icon.svg`
  icon.alt = ''
  const title = document.createElement('h1')
  title.textContent = 'Proj-Classe'
  const install = document.createElement('button')
  install.type = 'button'
  install.className = 'install'
  install.textContent = 'Installer'
  const installMessage = document.createElement('p')
  installMessage.className = 'install-message'
  // [SPEC-6.5] Reminds the adult that the level does not come from the microphone.
  const simulated = document.createElement('p')
  simulated.className = 'simulated-badge'
  simulated.textContent = 'Micro simulé : touches + et −'
  simulated.hidden = true
  header.append(icon, title, install, installMessage, simulated)

  // [SPEC-4.7] [SPEC-4.8] Message for the adult: need not met, error, full screen refused.
  const notice = document.createElement('div')
  notice.className = 'menu-notice'
  notice.setAttribute('role', 'alert')
  notice.hidden = true
  const noticeText = document.createElement('p')
  const noticeOk = document.createElement('button')
  noticeOk.type = 'button'
  noticeOk.textContent = 'OK'
  noticeOk.addEventListener('click', () => link.dispatch({ type: 'dismiss-notice' }))
  notice.append(noticeText, noticeOk)

  const grid = document.createElement('ul')
  grid.className = 'menu-grid'
  const tiles: HTMLButtonElement[] = []
  let state: HostState | undefined
  let lastLaunched: string | undefined
  let panelOpen = false

  for (const { manifest } of registry.entries) {
    const item = document.createElement('li')
    item.className = 'menu-item'
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = 'tile'
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
      if (state?.phase !== 'menu') return
      lastLaunched = manifest.id
      link.dispatch({ type: 'launch', appId: manifest.id })
    })
    item.append(tile)
    tiles.push(tile)

    // [SPEC-7.5] An app that uses the microphone always has a panel: live level and calibration.
    if (manifest.settings.length > 0 || manifest.needs.includes('microphone')) {
      const settings = document.createElement('button')
      settings.type = 'button'
      settings.className = 'tile-settings'
      settings.textContent = 'Réglages'
      settings.setAttribute('aria-label', `Réglages : ${manifest.title}`)
      settings.addEventListener('click', () => {
        if (state?.phase !== 'menu' || panelOpen) return
        panelOpen = true
        openSettingsPanel(manifest, link, () => {
          panelOpen = false
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

  menu.append(header, notice, grid, empty, diagnostic)
  root.append(menu)
  tiles[0]?.focus()

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

  const unsubscribe = link.subscribe((next) => {
    const backToMenu = state !== undefined && state.phase !== 'menu' && next.phase === 'menu'
    state = next
    simulated.hidden = !next.sound.simulated
    notice.hidden = next.notice === null
    noticeText.textContent = next.notice?.message ?? ''
    notice.dataset.kind = next.notice?.kind ?? ''
    if (backToMenu) {
      // Keyboard flow: back on the tile that was launched.
      tiles.find((tile) => tile.dataset.appId === lastLaunched)?.focus()
    }
  })

  return () => {
    unsubscribe()
    offInstall()
    menu.remove()
  }
}
