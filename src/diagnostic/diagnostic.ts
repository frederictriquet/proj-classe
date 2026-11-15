// [SPEC-10] Diagnostic page: one row per point to check on the teacher's Mac.
import { isInstalledApp } from '../pwa/display-mode'
import { canInstall, installPromptReceived, onInstallAvailabilityChange, promptInstall } from '../pwa/install'
import { checkOfflineCache } from '../pwa/precache-check'
import { errorMessage } from '../errors'
import { getSwRegistrationState, onSwRegistrationChange } from '../boot/register'
import { requestPersistentStorage } from '../pwa/storage'
import { VERSION_LABEL } from '../version'
import { APP_REGISTRY } from '../apps/registry'
import { DEFAULT_AMBIENT_DBFS, parseCalibration, type Calibration } from '../audio/level'
import { MICROPHONE_KEY, parseMicrophoneChoice, type MicrophoneInfo } from '../audio/microphone-choice'
import { CALIBRATION_KEY } from '../audio/sound-service'
import { SettingsStore } from '../settings/settings'
import { MicTest, watchMicPermission } from './mic-test'
import { ambientText, appThresholdsText, microphoneChoiceText } from './sound-report'
import { DiagnosticReport, type Row } from './rows'
import { ScreensTest } from './screens-test'
import { formatFps, startTestAnimation, type TestAnimation } from './test-animation'

type Dispose = () => void

export function renderDiagnostic(root: HTMLElement): Dispose {
  const disposers: Dispose[] = []
  const page = document.createElement('div')
  page.className = 'diagnostic'
  const header = document.createElement('header')
  const title = document.createElement('h1')
  title.textContent = 'Diagnostic de Proj-Classe'
  const tools = document.createElement('div')
  const back = document.createElement('a')
  back.href = '#'
  back.textContent = 'Retour à l’accueil'
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'primary'
  copy.textContent = 'Copier le rapport'
  const copyStatus = document.createElement('span')
  tools.append(copy, ' ', copyStatus, ' ', back)
  header.append(title, tools)
  page.append(header)
  root.append(page)

  const report = new DiagnosticReport(page)

  // Application
  const app = report.section('Application')
  app('Version').set(VERSION_LABEL)
  showBrowser(app('Navigateur'))
  disposers.push(watchDisplayMode(app('Mode d’affichage')))
  disposers.push(watchNetwork(app('Réseau')))

  // Offline [SPEC-3.1] [SPEC-3.2] [SPEC-10 V2] [SPEC-10 V5] [SPEC-10 V7]
  const offline = report.section('Hors ligne')
  const swRow = offline('Service worker')
  const cacheRow = offline('Cache hors ligne')
  disposers.push(watchServiceWorker(swRow, cacheRow))
  void showPersistence(offline('Stockage persistant'))

  // Microphone [SPEC-6.1] [SPEC-10 V1] [SPEC-10 V6]
  const mic = report.section('Micro')
  const micPermission = mic('Autorisation micro')
  void watchMicPermission(micPermission)
  // [SPEC-6.8] [SPEC-7.5] Settings that the panel shows without their values in dB.
  const { microphone, ambientDb } = showSoundSettings(mic('Micro choisi'), mic('Bruit ambiant'), mic('Seuils des activités'))
  const micTest = new MicTest(
    {
      permission: micPermission,
      level: mic('Niveau sonore'),
      processing: mic('Traitements audio (getSettings)'),
      device: mic('Micro utilisé'),
    },
    microphone,
    ambientDb,
  )
  disposers.push(() => micTest.stop())

  // Screens [SPEC-5.3] [SPEC-10 V4]
  const screens = report.section('Écrans')
  const screensTest = new ScreensTest({
    api: screens('Window Management API'),
    permission: screens('Autorisation « gestion des fenêtres »'),
    extended: screens('Bureau étendu'),
    screens: screens('Écrans détectés'),
    sceneTest: screens('Fenêtre d’essai sur l’autre écran'),
  })
  disposers.push(() => screensTest.dispose())

  // Test animation [SPEC-10 V9]
  const anim = report.section('Animation d’essai')
  disposers.push(setupAnimation(anim('Images par seconde'), page))

  copy.addEventListener('click', () => {
    const text = report.asText(`Diagnostic Proj-Classe ${VERSION_LABEL}, ${new Date().toLocaleString('fr-FR')}`)
    navigator.clipboard.writeText(text).then(
      () => {
        copyStatus.className = 'status-ok'
        copyStatus.textContent = 'Rapport copié'
      },
      (error: unknown) => {
        copyStatus.className = 'status-error'
        copyStatus.textContent = `Copie impossible : ${errorMessage(error)}`
      },
    )
  })

  return () => {
    for (const dispose of disposers) dispose()
    page.remove()
  }
}

/** [SPEC-6.8] [SPEC-7.5] Chosen microphone, calibrated ambient noise and thresholds of the
 *  microphone apps, as stored. Returns what the microphone test needs. */
function showSoundSettings(
  microphoneRow: Row,
  ambientRow: Row,
  thresholdsRow: Row,
): { microphone: MicrophoneInfo | null; ambientDb: number } {
  const problems: string[] = []
  const settings = new SettingsStore(localStorage, (message) => problems.push(message))

  let microphone: MicrophoneInfo | null = null
  try {
    microphone = parseMicrophoneChoice(settings.readCommon(MICROPHONE_KEY))
    microphoneRow.set(microphoneChoiceText(microphone))
  } catch (error) {
    microphoneRow.set(errorMessage(error), 'error')
  }

  let calibration: Calibration | undefined
  try {
    calibration = parseCalibration(settings.readCommon(CALIBRATION_KEY))
    ambientRow.set(ambientText(calibration), calibration ? 'ok' : 'warn')
  } catch (error) {
    ambientRow.set(errorMessage(error), 'error')
  }
  const ambientDb = calibration?.ambientDb ?? DEFAULT_AMBIENT_DBFS

  const texts = APP_REGISTRY.entries
    .filter(({ manifest }) => (manifest.soundThresholds ?? []).length > 0)
    .map(({ manifest }) => appThresholdsText(manifest, settings.read(manifest.id, manifest.settings), ambientDb))
  thresholdsRow.set([...texts, ...problems].join('\n') || 'aucune activité ne déclare de seuil', problems.length > 0 ? 'warn' : 'neutral')
  return { microphone, ambientDb }
}

function showBrowser(row: Row): void {
  const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1]
  const mac = /Mac OS X ([\d_]+)/.exec(navigator.userAgent)?.[1]?.replace(/_/g, '.')
  row.set(`${chrome ? `Chrome ${chrome}` : 'navigateur autre que Chrome'}${mac ? `, macOS (agent ${mac})` : ''}\n${navigator.userAgent}`, chrome ? 'neutral' : 'warn')
}

function watchDisplayMode(row: Row): Dispose {
  const button = row.addButton('Installer', async () => {
    const outcome = await promptInstall()
    row.set(outcome === 'accepted' ? 'installation acceptée' : 'installation annulée', outcome === 'accepted' ? 'ok' : 'warn')
  }, true)
  const show = () => {
    const installed = isInstalledApp()
    button.hidden = installed || !canInstall()
    if (installed) row.set('application installée (fenêtre autonome)', 'ok')
    else if (canInstall()) row.set('onglet de Chrome : installation proposée par Chrome', 'warn')
    else if (installPromptReceived()) row.set('onglet de Chrome : installation déjà proposée ou effectuée', 'warn')
    else row.set('onglet de Chrome : installation pas (encore) proposée par Chrome', 'warn')
  }
  show()
  const media = window.matchMedia('(display-mode: standalone)')
  media.addEventListener('change', show)
  const off = onInstallAvailabilityChange(show)
  return () => {
    media.removeEventListener('change', show)
    off()
  }
}

function watchNetwork(row: Row): Dispose {
  const show = () => row.set(navigator.onLine ? 'en ligne' : 'hors ligne', navigator.onLine ? 'neutral' : 'warn')
  show()
  window.addEventListener('online', show)
  window.addEventListener('offline', show)
  return () => {
    window.removeEventListener('online', show)
    window.removeEventListener('offline', show)
  }
}

function watchServiceWorker(swRow: Row, cacheRow: Row): Dispose {
  if (import.meta.env.DEV) {
    swRow.set('désactivé en mode développement (npm run dev)', 'warn')
    cacheRow.set('pas de cache en mode développement', 'warn')
    return () => {}
  }
  if (!('serviceWorker' in navigator)) {
    swRow.set('non pris en charge par ce navigateur (ou page non sécurisée)', 'error')
    cacheRow.set('aucun cache hors ligne possible', 'error')
    return () => {}
  }

  const show = () => {
    const state = getSwRegistrationState()
    if (state.kind === 'error') {
      swRow.set(`échec de l’enregistrement : ${state.message}`, 'error')
      return
    }
    if (state.kind !== 'registered' || !state.registration) {
      swRow.set('enregistrement en cours…')
      return
    }
    const reg = state.registration
    const phase = reg.installing ? 'installation en cours' : reg.waiting ? 'nouvelle version en attente' : reg.active ? 'actif' : 'inactif'
    const controlled = navigator.serviceWorker.controller !== null
    swRow.set(`${phase}\ncontrôle cette page : ${controlled ? 'oui' : 'non'}\nportée : ${reg.scope}`, reg.active && controlled ? 'ok' : 'warn')
    reg.addEventListener('updatefound', show, { once: true })
    reg.installing?.addEventListener('statechange', show, { once: true })
  }

  const check = async () => {
    cacheRow.set('vérification…')
    const result = await checkOfflineCache()
    if (result.missing.length === 0) cacheRow.set(`complet : ${result.expected} fichiers sur ${result.expected}`, 'ok')
    else
      cacheRow.set(
        `INCOMPLET : ${result.missing.length} fichier(s) manquant(s) sur ${result.expected}\n${result.missing.slice(0, 10).join('\n')}`,
        'error',
      )
  }
  const runCheck = () => check().catch((error: unknown) => cacheRow.set(`Erreur : ${errorMessage(error)}`, 'error'))

  cacheRow.set('en attente du service worker…')
  cacheRow.addButton('Revérifier', runCheck)
  show()
  const off = onSwRegistrationChange(show)
  navigator.serviceWorker.addEventListener('controllerchange', show)
  void navigator.serviceWorker.ready.then(() => {
    show()
    void runCheck()
  })
  return () => {
    off()
    navigator.serviceWorker.removeEventListener('controllerchange', show)
  }
}

async function showPersistence(row: Row): Promise<void> {
  const state = await requestPersistentStorage()
  let text: string
  let status: 'ok' | 'warn' | 'error'
  switch (state.kind) {
    case 'done':
      text = state.granted
        ? 'accordé : persist() a répondu true'
        : 'refusé : persist() a répondu false (Chrome pourrait vider le cache si le disque manque de place)'
      status = state.granted ? 'ok' : 'warn'
      break
    case 'unsupported':
      text = 'navigator.storage.persist() absent'
      status = 'error'
      break
    case 'error':
      text = `Erreur : ${state.message}`
      status = 'error'
      break
    case 'pending':
      text = 'demande en cours…'
      status = 'warn'
      break
  }
  try {
    const estimate = await navigator.storage.estimate()
    const mb = (bytes: number | undefined) => (bytes === undefined ? '?' : `${(bytes / 1e6).toFixed(1)} Mo`)
    text += `\nespace utilisé : ${mb(estimate.usage)} sur ${mb(estimate.quota)} disponibles`
  } catch (error) {
    text += `\nestimation de l’espace impossible : ${errorMessage(error)}`
  }
  row.set(text, status)
}

function setupAnimation(row: Row, page: HTMLElement): Dispose {
  const stage = document.createElement('div')
  stage.className = 'anim-stage'
  stage.hidden = true
  page.append(stage)
  let animation: TestAnimation | undefined
  row.set('arrêtée')

  const toggle = row.addButton('Lancer l’animation', async () => {
    if (animation) {
      animation.stop()
      animation = undefined
      stage.hidden = true
      toggle.textContent = 'Lancer l’animation'
      row.set(`${row.text()}\n(arrêtée)`)
      return
    }
    stage.hidden = false
    toggle.disabled = true
    try {
      animation = await startTestAnimation(stage, (stats) => {
        const verdict = stats.min === undefined ? '' : stats.min >= 50 ? '\nminimum ≥ 50 : oui' : '\nminimum ≥ 50 : NON'
        row.set(`${formatFps(stats)}${verdict}${document.fullscreenElement ? '\n(plein écran)' : ''}`, stats.min !== undefined && stats.min < 50 ? 'warn' : 'ok')
      })
      toggle.textContent = 'Arrêter l’animation'
    } finally {
      toggle.disabled = false
    }
  }, true)
  row.addButton('Plein écran', async () => {
    if (!animation) throw new Error('Lancez d’abord l’animation.')
    await stage.requestFullscreen()
  })
  return () => animation?.stop()
}
