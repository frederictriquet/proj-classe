// [SPEC-3.3] [SPEC-3.4] [SPEC-3.6] New versions of the app: looked for at each launch with
// network, applied (page reload) on the menu only, reported on the menu. The browser glue is in
// register.ts; this module holds the logic and the state the menu shows.
import { errorMessage } from '../errors'
import type { KeyValueStorage } from '../settings/settings'

/**
 * [SPEC-3.3] Holds a downloaded version until the menu is shown with no app running, then
 * applies it once. The service worker has already taken over (autoUpdate); what waits is the
 * reload of the page, which would otherwise interrupt an app.
 */
export class UpdateGate {
  private pending = false
  private applied = false
  private onMenu = false
  private appActive = false

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

  private tryApply(): boolean {
    if (this.applied) return true
    if (!this.pending || !this.onMenu || this.appActive) return false
    this.applied = true
    this.apply()
    return true
  }
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

/**
 * [SPEC-3.3] [SPEC-3.6] Looks for a new version and follows its download. Resolves with the
 * cause of a failure to show, or null: up to date, new version downloaded, or no network. Without
 * network nothing is reported: it is the normal offline use [SPEC-3.4].
 */
export async function lookForUpdate(lookup: UpdateLookup): Promise<string | null> {
  try {
    await lookup.update()
  } catch (error) {
    return (await lookup.serverReachable()) ? errorMessage(error) : null
  }
  const worker = lookup.installing()
  if (!worker || (await installSucceeds(worker))) return null
  return (await lookup.serverReachable()) ? INSTALL_FAILED : null
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

// State shown by the menu, set by register.ts and main.ts.

let failureCause: string | null = null
let installedUntil = 0
const listeners = new Set<() => void>()

/** [SPEC-3.6] Cause of the last failed update of this launch, or null. */
export function getUpdateFailure(): string | null {
  return failureCause
}

export function reportUpdateFailure(cause: string): void {
  failureCause = cause
  for (const listener of listeners) listener()
}

/** [SPEC-3.4] « Mise à jour installée » shows on the menu for `durationMs` from now. */
export function announceUpdateInstalled(durationMs: number): void {
  installedUntil = Date.now() + durationMs
  for (const listener of listeners) listener()
}

/** Milliseconds left to show « Mise à jour installée », 0 when it is not shown. */
export function updateInstalledRemaining(): number {
  return Math.max(0, installedUntil - Date.now())
}

export function onUpdateChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
