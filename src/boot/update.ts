// [SPEC-3.3] [SPEC-3.4] [SPEC-3.6] [SPEC-3.9.2] [SPEC-3.10] New versions of the app: looked for at each launch
// with network, applied (page reload) on the menu only, reported on the menu. Part of the
// bootstrap, so it must not import the rest of the app at run time. The browser glue is in
// register.ts; this module holds the logic and the state the menu shows.
import { errorMessage } from '../errors'
import type { KeyValueStorage } from '../settings/settings'

/**
 * [SPEC-3.3] Holds a downloaded version until the menu is shown with no app running, then
 * applies it once. The service worker has already taken over (autoUpdate); what waits is the
 * reload of the page, which would otherwise interrupt an app.
 * [SPEC-3.9.3] Once the app has failed to start, a version applies as soon as it is downloaded.
 */
export class UpdateGate {
  private pending = false
  private applied = false
  private onMenu = false
  private appActive = false
  private startFailed = false

  /** @param apply reloads the page on the new version. */
  constructor(private readonly apply: () => void) {}

  /** A new version controls the page. Returns true when it was applied at once. */
  newVersion(): boolean {
    this.pending = true
    return this.tryApply()
  }

  /** The control window is about to show the menu (true) or another view (false). Returns true
   *  when the page is reloading on the new version instead: render nothing. */
  showingMenu(onMenu: boolean): boolean {
    this.onMenu = onMenu
    return this.tryApply()
  }

  /** An app is starting or running, in this window or in the scene window [SPEC-5.5]. */
  setAppActive(active: boolean): boolean {
    this.appActive = active
    return this.tryApply()
  }

  /** [SPEC-3.9.3] The app did not start: the fallback screen shows, there is no menu to wait
   *  for. Returns true when a downloaded version is applied at once. */
  startupFailed(): boolean {
    this.startFailed = true
    return this.tryApply()
  }

  private tryApply(): boolean {
    if (this.applied) return true
    if (!this.pending) return false
    if (!this.startFailed && (!this.onMenu || this.appActive)) return false
    this.applied = true
    this.apply()
    return true
  }
}

/**
 * [SPEC-3.3] True when the page runs another version than the one its first worker holds: the
 * entry script the page loaded is not among the worker's files. It happens when Chrome takes the
 * page from its HTTP cache (GitHub Pages sends max-age=600) while it fetches a newer worker.
 */
export function pageIsOutdated(entryScriptUrl: string | null, workerUrls: readonly string[]): boolean {
  return entryScriptUrl !== null && !workerUrls.includes(entryScriptUrl)
}

/** Storage key of the version that ran at the previous launch. */
export const VERSION_KEY = 'proj-classe.version'

/** [SPEC-3.4] Stores the running version. Returns true when another version ran at the previous
 *  launch: an update was installed since. False at the very first launch. */
export function versionChanged(storage: KeyValueStorage, label: string): boolean {
  const previous = storage.getItem(VERSION_KEY)
  if (previous === label) return false
  storage.setItem(VERSION_KEY, label)
  return previous !== null
}

/** The parts of a ServiceWorker that `lookForUpdate` follows. */
export interface WorkerLike {
  readonly state: ServiceWorkerState
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

export interface UpdateLookup {
  /** `registration.update()`: rejects when the new script cannot be fetched or run. */
  update(): Promise<unknown>
  /** `registration.installing`: the new version being downloaded, if one was found. */
  installing(): WorkerLike | null
  /** True when the server answers at all, whatever the HTTP status: the network is there. */
  serverReachable(): Promise<boolean>
}

/** Cause shown when the new version was found but could not be stored. */
export const INSTALL_FAILED = 'la nouvelle version a été trouvée mais son téléchargement a échoué.'

/** Outcome of a search for a new version. */
export type UpdateCheckResult =
  | { kind: 'up-to-date' }
  /** The new version is installed; the service worker takes over and the UpdateGate reloads. */
  | { kind: 'downloaded' }
  /** The server could not be reached: normal offline use [SPEC-3.4]. */
  | { kind: 'offline' }
  | { kind: 'failed'; cause: string }

/**
 * [SPEC-3.3] [SPEC-3.6] [SPEC-3.10] Looks for a new version and follows its download.
 * `onDownload` is called when a new version was found and its download starts.
 */
export async function lookForUpdate(lookup: UpdateLookup, onDownload: () => void = () => {}): Promise<UpdateCheckResult> {
  try {
    await lookup.update()
  } catch (error) {
    return (await lookup.serverReachable()) ? { kind: 'failed', cause: errorMessage(error) } : { kind: 'offline' }
  }
  const worker = lookup.installing()
  if (!worker) return { kind: 'up-to-date' }
  onDownload()
  if (await installSucceeds(worker)) return { kind: 'downloaded' }
  return (await lookup.serverReachable()) ? { kind: 'failed', cause: INSTALL_FAILED } : { kind: 'offline' }
}

/** Resolves true once the worker is installed, false if it is discarded before. */
function installSucceeds(worker: WorkerLike): Promise<boolean> {
  return new Promise((resolve) => {
    const check = () => {
      if (worker.state === 'parsed' || worker.state === 'installing') return
      worker.removeEventListener('statechange', check)
      resolve(worker.state !== 'redundant')
    }
    worker.addEventListener('statechange', check)
    check()
  })
}

/** [SPEC-3.6] Text of the failure shown on the menu, with the version still in service. */
export function updateFailureText(cause: string, versionLabel: string): string {
  return `La mise à jour a échoué : ${cause}\nVersion restée en service : ${versionLabel}`
}

/** [SPEC-3.10.1] Where the search for a new version stands. `manual` is true when the adult asked
 *  for it with the button [SPEC-3.10.2]. */
export interface UpdateCheck {
  phase: 'idle' | 'checking' | 'downloading' | 'up-to-date' | 'downloaded' | 'offline' | 'failed'
  manual: boolean
}

/** True while a search runs or once a version is downloaded: the button has nothing to do. */
export function updateCheckBusy(check: UpdateCheck): boolean {
  return check.phase === 'checking' || check.phase === 'downloading' || check.phase === 'downloaded'
}

/**
 * [SPEC-3.10.1] [SPEC-3.10.3] Text shown at the bottom of the menu, or null for nothing.
 * @param appActive an app runs on the other screen: a downloaded version waits for the menu.
 */
export function updateCheckLabel(check: UpdateCheck, appActive: boolean): string | null {
  switch (check.phase) {
    case 'checking':
      return "Recherche d'une mise à jour…"
    case 'downloading':
      return 'Téléchargement de la nouvelle version…'
    case 'downloaded':
      return appActive
        ? "Nouvelle version prête : elle s'appliquera au retour au menu"
        : 'Nouvelle version téléchargée : redémarrage…'
    case 'up-to-date':
      return 'Application à jour'
    case 'offline':
      return check.manual ? 'Pas de connexion internet : recherche impossible' : null
    case 'idle':
    case 'failed':
      // A failure shows in its own banner [SPEC-3.6].
      return null
  }
}

// State shown by the menu, set by register.ts and src/main.ts.

let updateCheck: UpdateCheck = { phase: 'idle', manual: false }
let failureCause: string | null = null
let installedUntil = 0
const listeners = new Set<() => void>()

/** [SPEC-3.6] Cause of the last failed update of this launch, or null. */
export function getUpdateFailure(): string | null {
  return failureCause
}

export function reportUpdateFailure(cause: string): void {
  failureCause = cause
  notify()
}

/** [SPEC-3.10.1] Current state of the search for a new version. */
export function getUpdateCheck(): UpdateCheck {
  return updateCheck
}

function setUpdateCheck(next: UpdateCheck): void {
  updateCheck = next
  notify()
}

/**
 * [SPEC-3.3] [SPEC-3.6] [SPEC-3.10] Searches for a new version and publishes its progress to the
 * menu. Does nothing while a search runs or once a version is downloaded. A new search clears the
 * previous failure [SPEC-3.10.3].
 */
export async function runUpdateCheck(lookup: UpdateLookup, manual: boolean): Promise<void> {
  if (updateCheckBusy(updateCheck)) return
  failureCause = null
  setUpdateCheck({ phase: 'checking', manual })
  let result: UpdateCheckResult
  try {
    result = await lookForUpdate(lookup, () => setUpdateCheck({ phase: 'downloading', manual }))
  } catch (error) {
    result = { kind: 'failed', cause: errorMessage(error) }
  }
  if (result.kind === 'failed') failureCause = result.cause
  setUpdateCheck({ phase: result.kind, manual })
}

function notify(): void {
  for (const listener of listeners) listener()
}

/** [SPEC-3.4] « Mise à jour installée » shows on the menu for `durationMs` from now. */
export function announceUpdateInstalled(durationMs: number): void {
  installedUntil = Date.now() + durationMs
  notify()
}

/** Milliseconds left to show « Mise à jour installée », 0 when it is not shown. */
export function updateInstalledRemaining(): number {
  return Math.max(0, installedUntil - Date.now())
}

export function onUpdateChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
