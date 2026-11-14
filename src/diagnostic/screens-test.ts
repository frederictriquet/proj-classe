// [SPEC-5.3] [SPEC-5.4] [SPEC-10 V4] Screen detection and a test window opened full screen
// on the other screen through Chrome's Window Management API.
import { errorMessage } from '../errors'
import { DIAGNOSTIC_CHANNEL, type SceneTestMessage } from './channel'
import type { Row } from './rows'

interface ScreenDetailed extends Screen {
  readonly availLeft: number
  readonly availTop: number
  readonly left: number
  readonly top: number
  readonly isPrimary: boolean
  readonly isInternal: boolean
  readonly devicePixelRatio: number
  readonly label: string
}

interface ScreenDetails extends EventTarget {
  readonly screens: readonly ScreenDetailed[]
  readonly currentScreen: ScreenDetailed
}

type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> }
type ScreenWithExtended = Screen & { isExtended?: boolean }

export interface ScreenRows {
  api: Row
  permission: Row
  extended: Row
  screens: Row
  sceneTest: Row
}

const PERMISSION_LABELS: Record<PermissionState, string> = {
  granted: 'accordée',
  prompt: 'pas encore accordée (Chrome la demandera)',
  denied: 'refusée',
}

function describeScreen(s: ScreenDetailed, details: ScreenDetails, index: number): string {
  const tags = [s.isPrimary ? 'principal' : '', s.isInternal ? 'intégré' : 'externe', s === details.currentScreen ? 'cette fenêtre' : '']
  return `${index + 1}. ${s.label || 'écran'} : ${s.width}×${s.height} à (${s.left}, ${s.top}), ×${s.devicePixelRatio} (${tags.filter(Boolean).join(', ')})`
}

export class ScreensTest {
  private details: ScreenDetails | undefined
  private popup: Window | null = null
  private closeWatch = 0
  private readonly channel = new BroadcastChannel(DIAGNOSTIC_CHANNEL)
  private readonly win = window as WindowWithScreens

  constructor(private readonly rows: ScreenRows) {
    const available = typeof this.win.getScreenDetails === 'function'
    rows.api.set(available ? 'disponible' : 'absente : la fenêtre d’essai s’ouvrira sans placement automatique', available ? 'ok' : 'warn')
    const extended = (screen as ScreenWithExtended).isExtended
    rows.extended.set(
      extended === undefined ? 'non signalé par Chrome' : extended ? 'oui (plusieurs écrans)' : 'non (un seul écran ou recopie vidéo)',
      extended === undefined ? 'warn' : 'neutral',
    )
    rows.screens.set('cliquez sur « Détecter les écrans »')
    rows.screens.addButton('Détecter les écrans', () => this.detect())
    rows.sceneTest.set('pas encore ouverte')
    rows.sceneTest.addButton('Ouvrir la fenêtre d’essai', () => this.openSceneTest(), true)
    this.channel.addEventListener('message', (event: MessageEvent<SceneTestMessage>) => this.onSceneMessage(event.data))
    void this.watchPermission()
  }

  private async watchPermission(): Promise<void> {
    const row = this.rows.permission
    if (!navigator.permissions?.query) {
      row.set('API Permissions absente', 'warn')
      return
    }
    try {
      const status = await navigator.permissions.query({ name: 'window-management' as PermissionName })
      const show = () =>
        row.set(PERMISSION_LABELS[status.state], status.state === 'granted' ? 'ok' : status.state === 'denied' ? 'error' : 'warn')
      show()
      status.addEventListener('change', show)
    } catch (error) {
      row.set(`Erreur : ${errorMessage(error)}`, 'error')
    }
  }

  private async detect(): Promise<ScreenDetails | undefined> {
    if (typeof this.win.getScreenDetails !== 'function') {
      this.rows.screens.set(`API absente. Écran courant : ${screen.width}×${screen.height}`, 'warn')
      return undefined
    }
    try {
      this.details = await this.win.getScreenDetails()
    } catch (error) {
      this.rows.screens.set(`Détection refusée ou impossible : ${errorMessage(error)}`, 'error')
      return undefined
    }
    const details = this.details
    const show = () => {
      const lines = details.screens.map((s, i) => describeScreen(s, details, i))
      this.rows.screens.set(`${details.screens.length} écran(s)\n${lines.join('\n')}`, 'ok')
    }
    show()
    details.addEventListener('screenschange', show)
    details.addEventListener('currentscreenchange', show)
    return details
  }

  private async openSceneTest(): Promise<void> {
    const details = this.details ?? (await this.detect())
    const target = details?.screens.find((s) => s !== details.currentScreen)
    const url = new URL('#scene-test', location.href).href
    let features: string
    let where: string
    if (details && target) {
      // [SPEC-5.3] Open at the other screen's coordinates; "fullscreen" asks Chrome for a full-screen popup.
      features = `popup,fullscreen,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`
      where = `sur l'autre écran (${target.label || `${target.width}×${target.height}`})`
    } else if (details) {
      features = `popup,fullscreen,left=${details.currentScreen.availLeft},top=${details.currentScreen.availTop},width=${details.currentScreen.availWidth},height=${details.currentScreen.availHeight}`
      where = 'sur cet écran (aucun autre écran détecté)'
    } else {
      // [SPEC-5.4] Fallback: plain window, to be dragged onto the projector.
      features = 'popup,width=1024,height=640'
      where = 'sans placement : glissez-la sur le projecteur puis cliquez dedans pour passer en plein écran'
    }
    if (this.popup && !this.popup.closed) this.popup.close()
    this.popup = window.open(url, 'proj-classe-scene-test', features)
    if (!this.popup) {
      this.rows.sceneTest.set('Chrome a bloqué l’ouverture de la fenêtre (fenêtres pop-up bloquées pour ce site).', 'error')
      return
    }
    this.rows.sceneTest.set(`ouverte ${where}\nen attente de la fenêtre…`)
    clearInterval(this.closeWatch)
    this.closeWatch = window.setInterval(() => {
      if (this.popup?.closed) {
        clearInterval(this.closeWatch)
        this.rows.sceneTest.set(`${this.rows.sceneTest.text()}\n(fenêtre fermée)`)
      }
    }, 1000)
  }

  private onSceneMessage(message: SceneTestMessage): void {
    if (message.type === 'scene-test-closed') return
    const fsText = message.fullscreen ? 'plein écran : oui' : 'plein écran : NON (cliquez dans la fenêtre d’essai)'
    const fpsOk = message.minFps === undefined ? undefined : message.minFps >= 50
    const fpsText = fpsOk === undefined ? '' : fpsOk ? ' (≥ 50 : oui)' : ' (≥ 50 : NON)'
    this.rows.sceneTest.set(
      `${fsText}\nfenêtre ${message.width}×${message.height}\n${message.fps}${fpsText}`,
      message.fullscreen && fpsOk !== false ? 'ok' : 'warn',
    )
  }

  dispose(): void {
    clearInterval(this.closeWatch)
    this.channel.close()
  }
}
