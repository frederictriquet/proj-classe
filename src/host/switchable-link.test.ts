import { describe, expect, it } from 'vitest'
import type { HostState } from './protocol'
import { SwitchableLink } from './switchable-link'
import { FakeHostLink, hostState, READING } from './testing'

describe('SwitchableLink [SPEC-5.2] [SPEC-5.5]', () => {
  it('forwards to the local host, then to the scene, then back', () => {
    const local = new FakeHostLink(hostState())
    const scene = new FakeHostLink(hostState({ phase: 'running', appId: 'demo' }))
    const link = new SwitchableLink(local)
    const states: HostState[] = []
    link.subscribe((state) => states.push(state))
    const levels: unknown[] = []
    link.subscribeLevel((reading) => levels.push(reading))

    link.dispatch({ type: 'launch', appId: 'demo' })
    expect(local.commands).toHaveLength(1)

    link.switchTo(scene)
    // Listeners get the scene's state at once.
    expect(states.map((s) => s.phase)).toEqual(['menu', 'running'])
    expect(link.state).toBe(scene.state)
    link.dispatch({ type: 'stop' })
    expect(scene.commands).toEqual([{ type: 'stop' }])
    expect(local.commands).toHaveLength(1)

    // The previous target is no longer heard.
    local.emit({ notice: { kind: 'error', appId: 'demo', message: 'old' } })
    local.emitLevel(READING)
    expect(states).toHaveLength(2)
    expect(levels).toHaveLength(0)
    scene.emitLevel(READING)
    expect(levels).toEqual([READING])

    link.switchTo(local)
    expect(scene.subscribers).toBe(0)
    expect(link.state).toBe(local.state)
  })

  it('does nothing when switched to its current target', () => {
    const local = new FakeHostLink()
    const link = new SwitchableLink(local)
    const states: HostState[] = []
    link.subscribe((state) => states.push(state))
    link.switchTo(local)
    expect(states).toHaveLength(1)
    expect(local.subscribers).toBe(2)
  })
})
