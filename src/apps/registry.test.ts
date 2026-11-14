import { describe, expect, it } from 'vitest'
import { APP_FOLDERS, APP_IDS, APP_REGISTRY, buildRegistry, manifestProblems, type AppFiles, type ManifestFiles } from './registry'
import type { AppManifest, AppModule } from './types'

function manifest(id: string, extra: Partial<AppManifest> = {}): AppManifest {
  return { id, title: id, thumbnail: `${id}.svg`, needs: [], settings: [], ...extra }
}

const load = (): Promise<AppModule> => Promise.resolve({ start: () => ({ stop() {} }) })

function files(...manifests: AppManifest[]): { manifests: ManifestFiles; apps: AppFiles } {
  const result: { manifests: ManifestFiles; apps: AppFiles } = { manifests: {}, apps: {} }
  for (const m of manifests) {
    result.manifests[`./${m.id}/manifest.ts`] = { manifest: m }
    result.apps[`./${m.id}/app.ts`] = load
  }
  return result
}

describe('buildRegistry', () => {
  it('lists the apps in the order of the ids', () => {
    const { manifests, apps } = files(manifest('a'), manifest('b'))
    const registry = buildRegistry(['b', 'a'], manifests, apps, true)
    expect(registry.entries.map((e) => e.manifest.id)).toEqual(['b', 'a'])
    expect(registry.get('a').load).toBe(load)
  })

  it('hides development-only apps outside development', () => {
    const { manifests, apps } = files(manifest('a'), manifest('demo', { devOnly: true }))
    expect(buildRegistry(['a', 'demo'], manifests, apps, false).entries.map((e) => e.manifest.id)).toEqual(['a'])
    expect(buildRegistry(['a', 'demo'], manifests, apps, true).entries.map((e) => e.manifest.id)).toEqual(['a', 'demo'])
  })

  it('throws on an unknown id at launch time', () => {
    const { manifests, apps } = files(manifest('a'))
    expect(() => buildRegistry(['a'], manifests, apps, true).get('zzz')).toThrow(/inconnue/)
  })

  it('rejects a missing folder, a missing app file, a duplicate id or a mismatched id', () => {
    const { manifests, apps } = files(manifest('a'))
    expect(() => buildRegistry(['missing'], manifests, apps, true)).toThrow(/manifest\.ts/)
    expect(() => buildRegistry(['a'], manifests, {}, true)).toThrow(/app\.ts/)
    expect(() => buildRegistry(['a', 'a'], manifests, apps, true)).toThrow(/deux fois/)
    const wrong = { './a/manifest.ts': { manifest: manifest('b') } }
    expect(() => buildRegistry(['a'], wrong, apps, true)).toThrow(/identifiant/)
  })

  it('rejects invalid setting declarations', () => {
    const bad = manifest('a', {
      settings: [
        { type: 'slider', id: 's', label: 'S', min: 0, max: 1, step: 0.1, default: 2 },
        { type: 'toggle', id: 's', label: 'T', default: false },
      ],
    })
    const { manifests, apps } = files(bad)
    expect(() => buildRegistry(['a'], manifests, apps, true)).toThrow(/valeur par défaut/)
    expect(manifestProblems(bad)).toHaveLength(2)
  })
})

describe('APP_REGISTRY', () => {
  it('registers every folder of src/apps/ and nothing else', () => {
    expect([...APP_IDS].sort()).toEqual([...APP_FOLDERS].sort())
  })

  it('has valid manifests with a default inside the bounds of every setting', () => {
    // buildRegistry throws on any problem; this checks the real files, dev-only ones included.
    expect(APP_REGISTRY.entries.length).toBe(APP_IDS.length)
    for (const { manifest } of APP_REGISTRY.entries) {
      expect(manifestProblems(manifest)).toEqual([])
      expect(manifest.title).not.toBe('')
      expect(manifest.thumbnail).not.toBe('')
    }
  })
})
