import { describe, expect, it, vi } from 'vitest'
import { buildRegistry } from '../apps/registry'
import type { AppContext, AppManifest, AppModule, RunningApp } from '../apps/types'
import { SettingsStore, type KeyValueStorage } from '../settings/settings'
import { AppHost, type HostDisplay, type NeedsCheck, type OpenedDisplay } from './host'
import type { HostCommand, HostState } from './protocol'

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

/** Fake app whose animation loop is a counter driven by `frame()`, like a ticker. */
class FakeApp implements RunningApp {
  running = true
  frames = 0
  context: AppContext
  changes = 0
  constructor(context: AppContext) {
    this.context = context
    context.settings.onChange(() => this.changes++)
  }
  frame() {
    if (this.running) this.frames++
  }
  stop() {
    this.running = false
  }
}

const DEMO: AppManifest = {
  id: 'demo',
  title: 'Démonstration',
  thumbnail: 'demo.svg',
  needs: [],
  settings: [
    { type: 'slider', id: 'speed', label: 'Vitesse', min: 0, max: 3, step: 0.1, default: 1 },
    { type: 'toggle', id: 'big', label: 'Grande forme', default: false },
  ],
}
const MIC: AppManifest = { id: 'mic', title: 'Micro', thumbnail: 'mic.svg', needs: ['microphone'], settings: [] }

/** Resolves pending promises (several await steps in the launch). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(options: { start?: AppModule['start']; checkNeeds?: NeedsCheck; display?: Partial<HostDisplay> } = {}) {
  const apps: FakeApp[] = []
  const start =
    options.start ??
    ((context: AppContext) => {
      const app = new FakeApp(context)
      apps.push(app)
      return app
    })
  const load = vi.fn(() => Promise.resolve({ start }))
  const registry = buildRegistry(
    ['demo', 'mic'],
    { './demo/manifest.ts': { manifest: DEMO }, './mic/manifest.ts': { manifest: MIC } },
    { './demo/app.ts': load, './mic/app.ts': load },
    true,
  )
  const container = { fake: 'container' } as unknown as HTMLElement
  const display = {
    open: vi.fn((): Promise<OpenedDisplay> => Promise.resolve({ container })),
    close: vi.fn(),
    ...options.display,
  }
  const storage = new MemoryStorage()
  const host = new AppHost({
    registry,
    settings: new SettingsStore(storage, (message) => {
      throw new Error(message)
    }),
    display,
    checkNeeds: options.checkNeeds ?? (() => Promise.resolve(undefined)),
  })
  const states: HostState[] = []
  host.subscribe((state) => states.push(state))
  return { host, apps, display, load, container, states, storage }
}

describe('AppHost', () => {
  it('starts with the menu and the settings of every app', () => {
    const { host } = setup()
    expect(host.state).toEqual({
      phase: 'menu',
      appId: null,
      settings: { demo: { speed: 1, big: false }, mic: {} },
      notice: null,
    })
  })

  it('launches an app: display opened synchronously, code loaded on demand, then running', async () => {
    const { host, apps, display, load, container } = setup()
    expect(load).not.toHaveBeenCalled()
    host.dispatch({ type: 'launch', appId: 'demo' })
    // Opened in the same call as the command, while the user gesture is active [SPEC-4.6].
    expect(display.open).toHaveBeenCalledTimes(1)
    expect(host.state.phase).toBe('starting')
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(host.state).toMatchObject({ phase: 'running', appId: 'demo', notice: null })
    expect(apps[0]?.context.container).toBe(container)
    expect(apps[0]?.context.settings.number('speed')).toBe(1)
  })

  it('ignores a second launch while an app is starting or running', async () => {
    const { host, display } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    host.dispatch({ type: 'launch', appId: 'mic' })
    expect(display.open).toHaveBeenCalledTimes(1)
    expect(host.state.appId).toBe('demo')
  })

  it('stops the app on the stop command: its loop no longer runs and the display closes', async () => {
    const { host, apps, display } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    const app = apps[0]!
    app.frame()
    host.dispatch({ type: 'stop' })
    app.frame()
    app.frame()
    expect(app.running).toBe(false)
    expect(app.frames).toBe(1)
    expect(display.close).toHaveBeenCalledTimes(1)
    expect(host.state).toMatchObject({ phase: 'menu', appId: null, notice: null })
  })

  it('treats a second stop (Escape then end of full screen) as a no-op', async () => {
    const { host, display } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    host.dispatch({ type: 'stop' })
    host.dispatch({ type: 'stop' })
    expect(display.close).toHaveBeenCalledTimes(1)
  })

  it('releases an app that finishes starting after a stop [SPEC-4.2]', async () => {
    let finish: (app: RunningApp) => void = () => {}
    const late = { stop: vi.fn() }
    const { host } = setup({ start: () => new Promise<RunningApp>((resolve) => (finish = resolve)) })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(host.state.phase).toBe('starting')
    host.dispatch({ type: 'stop' })
    expect(host.state.phase).toBe('menu')
    finish(late)
    await settle()
    expect(late.stop).toHaveBeenCalledTimes(1)
    expect(host.state).toMatchObject({ phase: 'menu', notice: null })
  })

  it('does not start an app whose need is not met and says what to do [SPEC-4.7]', async () => {
    const message = 'Autorisez le micro puis relancez.'
    const { host, apps, display, load } = setup({
      checkNeeds: (needs) => Promise.resolve(needs.includes('microphone') ? message : undefined),
    })
    host.dispatch({ type: 'launch', appId: 'mic' })
    await settle()
    expect(load).not.toHaveBeenCalled()
    expect(apps).toHaveLength(0)
    expect(display.close).toHaveBeenCalled()
    expect(host.state).toMatchObject({ phase: 'menu', notice: { kind: 'need', appId: 'mic', message } })
  })

  it('goes back to the menu with a message when start throws [SPEC-4.8]', async () => {
    const { host, display } = setup({
      start: () => {
        throw new Error('boom at start')
      },
    })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(display.close).toHaveBeenCalled()
    expect(host.state.phase).toBe('menu')
    expect(host.state.notice?.kind).toBe('error')
    expect(host.state.notice?.message).toContain('Démonstration')
    expect(host.state.notice?.message).toContain('boom at start')
  })

  it('stops the app and shows a message on a runtime error [SPEC-4.8]', async () => {
    const { host, apps } = setup()
    expect(host.fail(new Error('not running'))).toBe(false)
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(host.fail(new Error('boom in the loop'))).toBe(true)
    expect(apps[0]?.running).toBe(false)
    expect(host.state.phase).toBe('menu')
    expect(host.state.notice?.message).toContain('boom in the loop')
    host.dispatch({ type: 'dismiss-notice' })
    expect(host.state.notice).toBeNull()
  })

  it('reports an app whose stop() throws, and still goes back to the menu', async () => {
    const { host, display } = setup({
      start: () => ({
        stop() {
          throw new Error('stop failed')
        },
      }),
    })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    host.dispatch({ type: 'stop' })
    expect(display.close).toHaveBeenCalled()
    expect(host.state.phase).toBe('menu')
    expect(host.state.notice?.message).toContain('stop failed')
  })

  it('applies a setting change to the running app at once and saves it [SPEC-7.2]', async () => {
    const { host, apps, storage } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    const app = apps[0]!
    host.dispatch({ type: 'set-setting', appId: 'demo', settingId: 'speed', value: 2.5 })
    expect(app.context.settings.number('speed')).toBe(2.5)
    expect(app.changes).toBe(1)
    expect(host.state.settings.demo).toEqual({ speed: 2.5, big: false })
    expect(storage.data.size).toBe(1)
    host.dispatch({ type: 'reset-settings', appId: 'demo' })
    expect(app.context.settings.number('speed')).toBe(1)
    expect(app.changes).toBe(2)
  })

  it('stops notifying an app after it stopped', async () => {
    const { host, apps } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    host.dispatch({ type: 'stop' })
    host.dispatch({ type: 'set-setting', appId: 'demo', settingId: 'big', value: true })
    expect(apps[0]?.changes).toBe(0)
  })

  it('gives the next launch the settings changed on the menu', async () => {
    const { host, apps } = setup()
    host.dispatch({ type: 'set-setting', appId: 'demo', settingId: 'big', value: true })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(apps[0]?.context.settings.boolean('big')).toBe(true)
  })

  it('rejects reading a setting with the wrong type', async () => {
    const { host, apps } = setup()
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(() => apps[0]?.context.settings.number('big')).toThrow()
    expect(() => apps[0]?.context.settings.boolean('nope')).toThrow()
  })

  it('goes back to the menu with a message when the display cannot open', async () => {
    const { host } = setup({
      display: {
        open: () => {
          throw new Error('no stage')
        },
      },
    })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(host.state.phase).toBe('menu')
    expect(host.state.notice?.message).toContain('no stage')
  })

  it('shows a warning after the run when full screen was refused', async () => {
    const container = {} as HTMLElement
    const { host } = setup({
      display: { open: () => Promise.resolve({ container, warning: 'Plein écran refusé' }) },
    })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    expect(host.state).toMatchObject({ phase: 'running', notice: { kind: 'warning' } })
    host.dispatch({ type: 'stop' })
    expect(host.state.notice?.message).toBe('Plein écran refusé')
  })

  it('sends its state again on request', () => {
    const { host, states } = setup()
    const before = states.length
    host.dispatch({ type: 'request-state' })
    expect(states.length).toBe(before + 1)
  })

  it('exchanges only plain data, so commands and states can cross windows [SPEC-5.5]', async () => {
    const commands: HostCommand[] = [
      { type: 'launch', appId: 'demo' },
      { type: 'stop' },
      { type: 'set-setting', appId: 'demo', settingId: 'speed', value: 2 },
      { type: 'reset-settings', appId: 'demo' },
      { type: 'dismiss-notice' },
      { type: 'request-state' },
    ]
    for (const command of commands) expect(structuredClone(command)).toEqual(command)

    const { host, states } = setup({
      start: () => {
        throw new Error('boom')
      },
    })
    host.dispatch({ type: 'launch', appId: 'demo' })
    await settle()
    // Every state seen: menu, starting, menu with an error notice.
    expect(states.map((s) => s.phase)).toEqual(['menu', 'starting', 'menu'])
    for (const state of states) expect(structuredClone(state)).toEqual(state)
  })
})
