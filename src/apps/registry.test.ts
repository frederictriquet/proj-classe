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

  it('rejects sound thresholds on an undeclared slider or without the microphone [SPEC-7.5]', () => {
    const slider = { type: 'slider', id: 's', label: 'S', min: 0, max: 10, step: 1, default: 5 } as const
    const toggle = { type: 'toggle', id: 't', label: 'T', default: false } as const
    const good = manifest('a', { needs: ['microphone'], settings: [slider], soundThresholds: [{ label: 'A', setting: 's', offsetDb: 6 }] })
    expect(manifestProblems(good)).toEqual([])
    const onToggle = manifest('a', { needs: ['microphone'], settings: [toggle], soundThresholds: [{ label: 'A', setting: 't' }] })
    expect(manifestProblems(onToggle)).toEqual(["seuil « A » : « t » n'est pas un curseur déclaré"])
    const noMic = manifest('a', { settings: [slider], soundThresholds: [{ label: 'A', setting: 's' }] })
    expect(manifestProblems(noMic)).toEqual(['seuils sonores déclarés sans le besoin « microphone »'])
  })

  it('wants one slider for every threshold, in increasing order, and one zone more than thresholds [SPEC-7.5]', () => {
    const s = { type: 'slider', id: 's', label: 'S', min: 0, max: 10, step: 1, default: 5 } as const
    const t = { ...s, id: 't', label: 'T' }
    const two = [
      { label: 'A', setting: 's' },
      { label: 'B', setting: 's', offsetDb: 6 },
    ]
    const good = manifest('a', { needs: ['microphone'], settings: [s], soundThresholds: two, soundZones: ['calme', 'alerte', 'bruit'] })
    expect(manifestProblems(good)).toEqual([])
    const twoSliders = manifest('a', { needs: ['microphone'], settings: [s, t], soundThresholds: [two[0]!, { label: 'B', setting: 't', offsetDb: 6 }] })
    expect(manifestProblems(twoSliders)).toEqual(['seuils sonores réglés par plusieurs curseurs'])
    const reversed = manifest('a', { needs: ['microphone'], settings: [s], soundThresholds: [two[1]!, two[0]!] })
    expect(manifestProblems(reversed)).toEqual(['seuils sonores pas dans l’ordre croissant'])
    const zones = manifest('a', { needs: ['microphone'], settings: [s], soundThresholds: two, soundZones: ['calme', 'bruit'] })
    expect(manifestProblems(zones)).toEqual(['2 zones sonores pour 2 seuils : il en faut une de plus que de seuils'])
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
