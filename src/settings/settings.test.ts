import { describe, expect, it } from 'vitest'
import type { SettingDeclaration } from '../apps/types'
import {
  COMMON_SETTINGS_KEY,
  appSettingsKey,
  defaultValues,
  resolveValues,
  SettingsStore,
  type KeyValueStorage,
} from './settings'

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

const DECLARATIONS: SettingDeclaration[] = [
  { type: 'slider', id: 'speed', label: 'Vitesse', min: 0, max: 3, step: 0.1, default: 1 },
  { type: 'toggle', id: 'big', label: 'Grande forme', default: false },
]

function setup() {
  const storage = new MemoryStorage()
  const problems: string[] = []
  const store = new SettingsStore(storage, (message) => problems.push(message))
  return { storage, problems, store }
}

describe('resolveValues', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(resolveValues(DECLARATIONS, undefined)).toEqual({ values: { speed: 1, big: false }, problems: [] })
  })

  it('keeps valid stored values and drops keys that are no longer declared', () => {
    expect(resolveValues(DECLARATIONS, { speed: 2.5, big: true, removed: 4 })).toEqual({
      values: { speed: 2.5, big: true },
      problems: [],
    })
  })

  it('falls back to the default for a wrong type or an out-of-bounds value, and says so', () => {
    const { values, problems } = resolveValues(DECLARATIONS, { speed: 9, big: 'yes' })
    expect(values).toEqual({ speed: 1, big: false })
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('Vitesse')
    expect(problems[1]).toContain('Grande forme')
  })

  it('reports content that is not an object', () => {
    const { values, problems } = resolveValues(DECLARATIONS, [1, 2])
    expect(values).toEqual(defaultValues(DECLARATIONS))
    expect(problems).toHaveLength(1)
  })
})

describe('SettingsStore', () => {
  it('saves a value per app and reads it back', () => {
    const { storage, store, problems } = setup()
    expect(store.write('demo', DECLARATIONS, 'speed', 2)).toEqual({ speed: 2, big: false })
    expect(store.read('demo', DECLARATIONS)).toEqual({ speed: 2, big: false })
    expect(JSON.parse(storage.getItem(appSettingsKey('demo')) ?? '')).toEqual({ speed: 2, big: false })
    expect(problems).toEqual([])
  })

  it('keeps apps apart', () => {
    const { store } = setup()
    store.write('demo', DECLARATIONS, 'big', true)
    expect(store.read('other', DECLARATIONS)).toEqual({ speed: 1, big: false })
  })

  it('rejects an unknown setting or an invalid value without saving it', () => {
    const { storage, store } = setup()
    expect(() => store.write('demo', DECLARATIONS, 'nope', 1)).toThrow(/inconnu/)
    expect(() => store.write('demo', DECLARATIONS, 'speed', 4)).toThrow(RangeError)
    expect(() => store.write('demo', DECLARATIONS, 'big', 1)).toThrow(RangeError)
    expect(storage.data.size).toBe(0)
  })

  it('goes back to the defaults [SPEC-7.4]', () => {
    const { storage, store } = setup()
    store.write('demo', DECLARATIONS, 'speed', 3)
    expect(store.reset('demo', DECLARATIONS)).toEqual({ speed: 1, big: false })
    expect(store.read('demo', DECLARATIONS)).toEqual({ speed: 1, big: false })
    expect(storage.getItem(appSettingsKey('demo'))).toBeNull()
  })

  it('reports unreadable stored JSON and uses the defaults', () => {
    const { storage, store, problems } = setup()
    storage.setItem(appSettingsKey('demo'), '{not json')
    expect(store.read('demo', DECLARATIONS)).toEqual({ speed: 1, big: false })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('demo')
  })

  it('overwrites unreadable content on the next change', () => {
    const { storage, store } = setup()
    storage.setItem(appSettingsKey('demo'), '{not json')
    store.write('demo', DECLARATIONS, 'speed', 0.5)
    expect(JSON.parse(storage.getItem(appSettingsKey('demo')) ?? '')).toEqual({ speed: 0.5, big: false })
  })

  it('keeps a common space shared by all apps [SPEC-7.1]', () => {
    const { storage, store } = setup()
    expect(store.readCommon('ambientDb')).toBeUndefined()
    store.writeCommon('ambientDb', -52)
    store.writeCommon('other', true)
    expect(store.readCommon('ambientDb')).toBe(-52)
    expect(JSON.parse(storage.getItem(COMMON_SETTINGS_KEY) ?? '')).toEqual({ ambientDb: -52, other: true })
    // The common space does not collide with an app called "common".
    store.write('common', DECLARATIONS, 'speed', 2)
    expect(store.readCommon('ambientDb')).toBe(-52)
  })

  it('reports an unreadable common space', () => {
    const { storage, store, problems } = setup()
    storage.setItem(COMMON_SETTINGS_KEY, 'null')
    expect(store.readCommon('ambientDb')).toBeUndefined()
    expect(problems).toHaveLength(1)
  })
})
