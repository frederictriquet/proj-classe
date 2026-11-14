import { describe, expect, it, vi } from 'vitest'
import type { KeyValueStorage } from '../settings/settings'
import {
  INSTALL_FAILED,
  lookForUpdate,
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

describe('lookForUpdate [SPEC-3.6]', () => {
  const scriptError = new TypeError('A bad HTTP response code (404) was received when fetching the script.')

  it('reports nothing when the app is up to date', async () => {
    expect(await lookForUpdate(lookup({ update: () => Promise.resolve(), reachable: true }))).toBeNull()
  })

  it('reports nothing when the check fails without network', async () => {
    const result = lookForUpdate(lookup({ update: () => Promise.reject(scriptError), reachable: false }))
    expect(await result).toBeNull()
  })

  it('reports the cause when the check fails while the server answers', async () => {
    const result = lookForUpdate(lookup({ update: () => Promise.reject(scriptError), reachable: true }))
    expect(await result).toBe(`TypeError : ${scriptError.message}`)
  })

  it('reports nothing once the new version is downloaded', async () => {
    const worker = new FakeWorker('installing')
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }))
    worker.moveTo('installed')
    expect(await result).toBeNull()
  })

  it('reports a failed download while the server answers', async () => {
    const worker = new FakeWorker('installing')
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }))
    worker.moveTo('redundant')
    expect(await result).toBe(INSTALL_FAILED)
  })

  it('reports nothing when the download stops because the network went away', async () => {
    const worker = new FakeWorker('installing')
    const result = lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: false }))
    worker.moveTo('redundant')
    expect(await result).toBeNull()
  })

  it('handles a download that already ended before the check returned', async () => {
    const worker = new FakeWorker('activated')
    expect(await lookForUpdate(lookup({ update: () => Promise.resolve(), installing: worker, reachable: true }))).toBeNull()
  })
})

describe('updateFailureText [SPEC-3.6]', () => {
  it('names the version still in service', () => {
    expect(updateFailureText('cause', '0.1.0 (aaaaaaa)')).toBe(
      'La mise à jour a échoué : cause\nVersion restée en service : 0.1.0 (aaaaaaa)',
    )
  })
})
