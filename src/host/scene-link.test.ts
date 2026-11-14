import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HostState } from './protocol'
import { RemoteHostLink, sceneChannelName, serveHost, type FromScene } from './scene-link'
import { FakeHostLink, hostState, READING } from './testing'

// Node has BroadcastChannel: the round trip uses the real API, as between two Chrome windows.
const open: BroadcastChannel[] = []
function channel(id: string): BroadcastChannel {
  const created = new BroadcastChannel(sceneChannelName(id))
  open.push(created)
  return created
}

/** Resolves with the first message of the given kind received on the channel. */
function next<K extends FromScene['kind']>(port: BroadcastChannel, kind: K): Promise<Extract<FromScene, { kind: K }>> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data as FromScene
      if (message.kind !== kind) return
      port.removeEventListener('message', onMessage)
      resolve(message as Extract<FromScene, { kind: K }>)
    }
    port.addEventListener('message', onMessage)
  })
}

afterEach(() => {
  for (const port of open.splice(0)) port.close()
})

describe('scene link [SPEC-5.5]', () => {
  it('relays commands to the scene host and brings back its states and levels', async () => {
    const control = channel('a')
    const scene = channel('a')
    const host = new FakeHostLink()
    const firstState = next(control, 'state')
    const stop = serveHost(host, scene, () => {})
    // The scene sends its state as soon as it serves.
    const first = await firstState
    expect(first.state).toEqual(host.state)

    const remote = new RemoteHostLink(control, first.state)
    const states: HostState[] = []
    remote.subscribe((state) => states.push(state))
    const levels: unknown[] = []
    remote.subscribeLevel((reading) => levels.push(reading))

    remote.dispatch({ type: 'launch', appId: 'demo' })
    remote.dispatch({ type: 'set-setting', appId: 'demo', settingId: 'speed', value: 2 })
    await vi.waitFor(() => expect(host.commands).toHaveLength(2))
    expect(host.commands).toEqual([
      { type: 'launch', appId: 'demo' },
      { type: 'set-setting', appId: 'demo', settingId: 'speed', value: 2 },
    ])

    host.emit({ phase: 'running', appId: 'demo' })
    host.emitLevel(READING)
    await vi.waitFor(() => expect(levels).toHaveLength(1))
    expect(states.map((s) => s.phase)).toEqual(['menu', 'running'])
    expect(remote.state.appId).toBe('demo')
    expect(levels[0]).toEqual(READING)
    stop()
  })

  it('closes the scene on the control window goodbye', async () => {
    const control = channel('b')
    const scene = channel('b')
    const onBye = vi.fn()
    serveHost(new FakeHostLink(), scene, onBye)
    control.postMessage({ kind: 'bye' })
    await vi.waitFor(() => expect(onBye).toHaveBeenCalledTimes(1))
  })

  it('stops relaying after dispose', async () => {
    const control = channel('c')
    const scene = channel('c')
    const host = new FakeHostLink()
    const remote = new RemoteHostLink(control, hostState())
    const states: HostState[] = []
    remote.subscribe((state) => states.push(state))
    remote.dispose()
    const stop = serveHost(host, scene, () => {})
    // A second listener on the control side tells when the state has arrived.
    await next(control, 'state')
    expect(states).toHaveLength(1)
    stop()
    expect(host.subscribers).toBe(0)
  })

  it('keeps projections apart: another channel id hears nothing', async () => {
    const otherControl = channel('other')
    const control = channel('d')
    const scene = channel('d')
    const heard = vi.fn()
    otherControl.addEventListener('message', heard)
    const arrived = next(control, 'state')
    serveHost(new FakeHostLink(), scene, () => {})
    await arrived
    expect(heard).not.toHaveBeenCalled()
  })
})
