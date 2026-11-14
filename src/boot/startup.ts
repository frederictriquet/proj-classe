// [SPEC-3.9.2] [SPEC-3.9.3] Watches the start of the app on behalf of the bootstrap.

/** The window events the watch listens to: `window` in the browser. */
export interface ErrorEvents {
  addEventListener(type: 'error' | 'unhandledrejection', listener: (event: Event) => void): void
  removeEventListener(type: 'error' | 'unhandledrejection', listener: (event: Event) => void): void
}

/**
 * [SPEC-3.9.3] Runs `start`, which resolves once the first view (the menu) is shown. Calls
 * `onFailure` once if `start` fails, or if an uncaught error or an unhandled rejection occurs
 * before it resolves. Once the first view is shown, the watch stops listening: an error in a
 * sub-application is the app's own and brings back the menu [SPEC-4.8].
 */
export function watchStartup(
  start: () => Promise<unknown>,
  events: ErrorEvents,
  onFailure: (error: unknown) => void,
): void {
  let settled = false
  const stop = () => {
    events.removeEventListener('error', onError)
    events.removeEventListener('unhandledrejection', onRejection)
  }
  const fail = (error: unknown) => {
    if (settled) return
    settled = true
    stop()
    onFailure(error)
  }
  const onError = (event: Event) => {
    const { error, message } = event as ErrorEvent
    fail(error ?? message)
  }
  const onRejection = (event: Event) => fail((event as PromiseRejectionEvent).reason)

  events.addEventListener('error', onError)
  events.addEventListener('unhandledrejection', onRejection)
  let started: Promise<unknown>
  try {
    started = start()
  } catch (error) {
    fail(error)
    return
  }
  started.then(() => {
    if (settled) return
    settled = true
    stop()
  }, fail)
}
