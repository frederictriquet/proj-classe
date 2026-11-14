import { describe, expect, it } from 'vitest'
import { otherScreen, parseSceneHash, sceneFeatures, sceneUrl, type ScreenDetailed, type ScreenDetails } from './screen-api'

const screenAt = (left: number, isInternal: boolean) => ({ left, top: 0, isInternal }) as unknown as ScreenDetailed
const details = (screens: ScreenDetailed[], current: ScreenDetailed) =>
  ({ screens, currentScreen: current }) as unknown as ScreenDetails

describe('screen helpers [SPEC-5.3] [SPEC-5.4]', () => {
  it('picks another screen than the current one, an external one first', () => {
    const mac = screenAt(0, true)
    const tv = screenAt(-1920, false)
    const projector = screenAt(1512, false)
    expect(otherScreen(details([mac], mac))).toBeUndefined()
    expect(otherScreen(details([mac, projector], mac))).toBe(projector)
    expect(otherScreen(details([mac, projector], projector))).toBe(mac)
    expect(otherScreen(details([projector, mac, tv], mac))).toBe(projector)
  })

  it('opens a plain window to drag in the fallback', () => {
    expect(sceneFeatures(undefined)).toBe('popup,width=1024,height=640')
  })

  it('carries the channel and the projector position in the hash, keeping the query string', () => {
    const url = sceneUrl('https://example.test/proj-classe/?micro=simule#diagnostic', {
      channel: 'abc',
      target: { left: -1920, top: 0 },
    })
    expect(url).toBe('https://example.test/proj-classe/?micro=simule#scene?canal=abc&x=-1920&y=0')
    expect(parseSceneHash(new URL(url).hash)).toEqual({ channel: 'abc', target: { left: -1920, top: 0 } })
    expect(parseSceneHash(new URL(sceneUrl('https://example.test/', { channel: 'abc' })).hash)).toEqual({ channel: 'abc' })
  })

  it('does not take other pages for the scene', () => {
    expect(parseSceneHash('')).toBeUndefined()
    expect(parseSceneHash('#scene-test')).toBeUndefined()
    expect(parseSceneHash('#diagnostic')).toBeUndefined()
    expect(parseSceneHash('#scene?x=1')).toBeUndefined()
  })
})
