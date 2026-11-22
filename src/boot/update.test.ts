import { describe, expect, it, vi } from 'vitest'
import type { KeyValueStorage } from '../settings/settings'
import {
  getUpdateCheck,
  getUpdateFailure,
  INSTALL_FAILED,
  lookForUpdate,
  onUpdateChange,
  reportUpdateFailure,
  runUpdateCheck,
  updateCheckLabel,
  pageIsOutdated,
  UpdateGate,
  updateFailureText,
  VERSION_KEY,
  versionChanged,
  type UpdateLookup,
  type WorkerLike,
} from './update'

describe('UpdateGate [SPEC-3.3]', () => {
  it('reloads at once when the new version arrives on the idle menu', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    gate.showingMenu(true)
    gate.setAppActive(false)
    expect(gate.newVersion()).toBe(true)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('waits while an app runs, then reloads when it is back on the menu', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    gate.showingMenu(true)
    gate.setAppActive(true)
    expect(gate.newVersion()).toBe(false)
    expect(apply).not.toHaveBeenCalled()
    gate.setAppActive(false)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('waits on another view (diagnostic) and reloads when the menu is about to show', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    gate.showingMenu(false)
    gate.newVersion()
    expect(apply).not.toHaveBeenCalled()
    expect(gate.showingMenu(true)).toBe(true)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a new version', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    expect(gate.showingMenu(true)).toBe(false)
    expect(gate.setAppActive(false)).toBe(false)
    expect(apply).not.toHaveBeenCalled()
  })

  it('applies only once, and then tells every caller the page is reloading', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    gate.showingMenu(true)
    gate.newVersion()
    gate.newVersion()
    expect(gate.showingMenu(true)).toBe(true)
    expect(gate.setAppActive(true)).toBe(true)
    expect(apply).toHaveBeenCalledTimes(1)
  })
})

describe('UpdateGate after a failed start [SPEC-3.9.3]', () => {
  it('applies a version downloaded before the failure as soon as the start fails', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    expect(gate.newVersion()).toBe(false)
    expect(gate.startupFailed()).toBe(true)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('applies a version downloaded after the failure at once, without a menu', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    expect(gate.startupFailed()).toBe(false)
    expect(apply).not.toHaveBeenCalled()
    expect(gate.newVersion()).toBe(true)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('ignores the menu and app state once the start has failed, and applies only once', () => {
    const apply = vi.fn()
    const gate = new UpdateGate(apply)
    gate.showingMenu(false)
    gate.setAppActive(true)
    gate.startupFailed()
    gate.newVersion()
    gate.newVersion()
    gate.startupFailed()
    expect(apply).toHaveBeenCalledTimes(1)
  })
})

describe('pageIsOutdated [SPEC-3.3]', () => {
  const urls = ['https://x/proj-classe/index.html', 'https://x/proj-classe/assets/index-NEW.js']

  it('is false when the worker holds the script the page loaded', () => {
    expect(pageIsOutdated('https://x/proj-classe/assets/index-NEW.js', urls)).toBe(false)
  })

  it('is true when the page came from an older version (HTTP cache)', () => {
    expect(pageIsOutdated('https://x/proj-classe/assets/index-OLD.js', urls)).toBe(true)
  })

  it('is false when the entry script is unknown', () => {
    expect(pageIsOutdated(null, urls)).toBe(false)
  })
})

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

describe('versionChanged [SPEC-3.4]', () => {
  it('is false at the first launch and stores the version', () => {
    const storage = new MemoryStorage()
    expect(versionChanged(storage, '0.1.0 (aaaaaaa)')).toBe(false)
    expect(storage.data.get(VERSION_KEY)).toBe('0.1.0 (aaaaaaa)')
  })

  it('is false when the same version starts again', () => {
    const storage = new MemoryStorage()
    versionChanged(storage, '0.1.0 (aaaaaaa)')
    expect(versionChanged(storage, '0.1.0 (aaaaaaa)')).toBe(false)
  })

  it('is true once after another version ran', () => {
    const storage = new MemoryStorage()
    versionChanged(storage, '0.1.0 (aaaaaaa)')
    expect(versionChanged(storage, '0.1.1 (bbbbbbb)')).toBe(true)
    expect(versionChanged(storage, '0.1.1 (bbbbbbb)')).toBe(false)
  })
})

/** A worker whose state the test moves forward. */
class FakeWorker extends EventTarget implements WorkerLike {
  constructor(public state: ServiceWorkerState) {
    super()
  }
  moveTo(state: ServiceWorkerState) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

function lookup(options: { update: () => Promise<unknown>; installing?: FakeWorker; reachable: boolean }): UpdateLookup {
  return {
    update: options.update,
    installing: () => options.installing ?? null,
    serverReachable: () => Promise.resolve(options.reachable),
  }
}

describe('lookForUpdate [SPEC-3.6] [SPEC-3.10]', () => {
  const scriptError = new TypeError('A bad HTTP response code (404) was received when fetching the script.')

  it('says up to date when the server has no new version', async () => {
    expect(await lookForUpdate(lookup({ update: () => Promise.resolve(), reachable: true }))).toEqual({ kind: 'up-to-date' })
  })

  it('says offline when the check fails without network', async () => {
    const result = lookForUpdate(lookup({ update: () => Promise.reject(scriptError), reachable: false }))
    expect(await result).toEqual({ kind: 'offline' })
  })

  it('reports the cause when the check fails while the server answers', async () => {
    const result = lookForUpdate(lookup({ update: () => Promise.reject(scriptError), reachable: true }))
    expect(await result).toEqual({ kind: 'failed', cause: `TypeError : ${scriptError.message}` })
  })

  it('tells when the download starts and says downloaded once it ends', async () => {
    const worker = new FakeWorker('installing')
    const onDownload = vi.fn()
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }), onDownload)
    await Promise.resolve()
    expect(onDownload).toHaveBeenCalledTimes(1)
    worker.moveTo('installed')
    expect(await result).toEqual({ kind: 'downloaded' })
  })

  it('reports a failed download while the server answers', async () => {
    const worker = new FakeWorker('installing')
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }))
    worker.moveTo('redundant')
    expect(await result).toEqual({ kind: 'failed', cause: INSTALL_FAILED })
  })

  it('says offline when the download stops because the network went away', async () => {
    const worker = new FakeWorker('installing')
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: false }))
    worker.moveTo('redundant')
    expect(await result).toEqual({ kind: 'offline' })
  })

  it('handles a download that already ended before the check returned', async () => {
    const worker = new FakeWorker('activated')
    expect(await lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }))).toEqual({
      kind: 'downloaded',
    })
  })
})

describe('updateCheckLabel [SPEC-3.10]', () => {
  it('shows the search and the download in progress', () => {
    expect(updateCheckLabel({ phase: 'checking', manual: false }, false)).toBe("Recherche d'une mise à jour…")
    expect(updateCheckLabel({ phase: 'downloading', manual: true }, false)).toBe('Téléchargement de la nouvelle version…')
  })

  it('says up to date', () => {
    expect(updateCheckLabel({ phase: 'up-to-date', manual: false }, false)).toBe('Application à jour')
  })

  it('says when a downloaded version applies: at once on the menu, later while an app runs', () => {
    expect(updateCheckLabel({ phase: 'downloaded', manual: true }, false)).toBe('Nouvelle version téléchargée : redémarrage…')
    expect(updateCheckLabel({ phase: 'downloaded', manual: true }, true)).toBe(
      "Nouvelle version prête : elle s'appliquera au retour au menu",
    )
  })

  it('shows nothing offline after the launch search, a message after a click [SPEC-3.10.3]', () => {
    expect(updateCheckLabel({ phase: 'offline', manual: false }, false)).toBeNull()
    expect(updateCheckLabel({ phase: 'offline', manual: true }, false)).toBe('Pas de connexion internet : recherche impossible')
  })

  it('leaves a failure to its banner and shows nothing before any search', () => {
    expect(updateCheckLabel({ phase: 'failed', manual: true }, false)).toBeNull()
    expect(updateCheckLabel({ phase: 'idle', manual: false }, false)).toBeNull()
  })
})

describe('runUpdateCheck [SPEC-3.10]', () => {
  it('publishes its progress, clears the previous failure and refuses a second search meanwhile', async () => {
    reportUpdateFailure('old cause')
    const phases: string[] = []
    const off = onUpdateChange(() => phases.push(getUpdateCheck().phase))
    const worker = new FakeWorker('installing')
    const update = vi.fn(() => Promise.resolve())
    const search = runUpdateCheck(lookup({ update, installing: worker, reachable: true }), true)
    expect(getUpdateFailure()).toBeNull()
    await runUpdateCheck(lookup({ update, reachable: true }), true)
    expect(update).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    worker.moveTo('installed')
    await search
    off()
    expect(phases).toEqual(['checking', 'downloading', 'downloaded'])
    expect(getUpdateCheck()).toEqual({ phase: 'downloaded', manual: true })
    // A downloaded version waits for the reload: nothing more to search.
    await runUpdateCheck(lookup({ update, reachable: true }), true)
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('updateFailureText [SPEC-3.6]', () => {
  it('names the version still in service', () => {
    expect(updateFailureText('cause', '0.1.0 (aaaaaaa)')).toBe(
      'La mise à jour a échoué : cause\nVersion restée en service : 0.1.0 (aaaaaaa)',
    )
  })
})
