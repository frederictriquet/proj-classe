import { errorMessage } from '../errors'

export type PersistState =
  | { kind: 'pending' }
  | { kind: 'unsupported' }
  | { kind: 'done'; granted: boolean }
  | { kind: 'error'; message: string }

let persistState: PersistState = { kind: 'pending' }
let persistPromise: Promise<PersistState> | undefined

/** [SPEC-3.2] Asks for persistent storage once at startup; the result is shown by the diagnostic page. */
export function requestPersistentStorage(): Promise<PersistState> {
  persistPromise ??= (async (): Promise<PersistState> => {
    if (!navigator.storage?.persist) {
      persistState = { kind: 'unsupported' }
      return persistState
    }
    try {
      persistState = { kind: 'done', granted: await navigator.storage.persist() }
    } catch (error) {
      persistState = { kind: 'error', message: errorMessage(error) }
    }
    return persistState
  })()
  return persistPromise
}

export function getPersistState(): PersistState {
  return persistState
}
