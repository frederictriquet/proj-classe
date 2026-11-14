import { describe, expect, it, vi } from 'vitest'
import { watchStartup } from './startup'

function errorEvent(error: unknown): Event {
  return Object.assign(new Event('error'), { error, message: String(error) })
}

function rejectionEvent(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason })
}

/** Resolves after the pending promise callbacks have run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('watchStartup [SPEC-3.9.3]', () => {
  it('reports nothing when the first view shows without error', async () => {
    const events = new EventTarget()
    const onFailure = vi.fn()
    watchStartup(() => Promise.resolve(), events, onFailure)
    await flush()
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('reports a start that rejects (app module or first view failing to load)', async () => {
    const failure = new Error('menu chunk missing')
    const onFailure = vi.fn()
    watchStartup(() => Promise.reject(failure), new EventTarget(), onFailure)
    await flush()
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports a start that throws synchronously', () => {
    const failure = new Error('boom')
    const onFailure = vi.fn()
    watchStartup(
      () => {
        throw failure
      },
      new EventTarget(),
      onFailure,
    )
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports an uncaught error raised before the first view shows', () => {
    const events = new EventTarget()
    const failure = new Error('uncaught')
    const onFailure = vi.fn()
    watchStartup(() => new Promise(() => {}), events, onFailure)
    events.dispatchEvent(errorEvent(failure))
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports an unhandled rejection raised before the first view shows', () => {
    const events = new EventTarget()
    const onFailure = vi.fn()
    watchStartup(() => new Promise(() => {}), events, onFailure)
    events.dispatchEvent(rejectionEvent('lost promise'))
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('lost promise')
  })

  it('reports only the first failure', async () => {
    const events = new EventTarget()
    const onFailure = vi.fn()
    watchStartup(() => Promise.reject(new Error('second')), events, onFailure)
    events.dispatchEvent(errorEvent(new Error('first')))
    await flush()
    events.dispatchEvent(rejectionEvent('third'))
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure.mock.calls[0]?.[0]).toEqual(new Error('first'))
  })

  it('leaves later errors to the app once the first view is shown [SPEC-4.8]', async () => {
    const events = new EventTarget()
    const onFailure = vi.fn()
    watchStartup(() => Promise.resolve(), events, onFailure)
    await flush()
    events.dispatchEvent(errorEvent(new Error('error in a sub-application')))
    events.dispatchEvent(rejectionEvent('rejection in a sub-application'))
    expect(onFailure).not.toHaveBeenCalled()
  })
})
