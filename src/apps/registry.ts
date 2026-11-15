// [SPEC-4.1] [SPEC-4.3] Registry of the sub-applications shown on the menu.
import { invalidReason } from '../settings/settings'
import type { AppManifest, AppModule } from './types'

/**
 * [SPEC-4.3] The only list to complete to add a sub-application: the name of its folder under
 * `src/apps/`, in menu order. The folder holds `manifest.ts` and `app.ts` (see `types.ts`).
 */
export const APP_IDS: readonly string[] = ['foret', 'ferme', 'ruche', 'couvain', 'foret-galerie', 'ferme-galerie', 'ruche-galerie', 'couvain-galerie', 'demo']

export interface AppEntry {
  manifest: AppManifest
  /** Loads the app code on demand (dynamic `import()`). */
  load: () => Promise<AppModule>
}

export interface AppRegistry {
  readonly entries: readonly AppEntry[]
  /** Throws if the id is not on the menu. */
  get(id: string): AppEntry
}

/** Manifests keyed by file path, as returned by `import.meta.glob('./*\/manifest.ts', { eager: true })`. */
export type ManifestFiles = Record<string, { manifest: AppManifest }>
/** App loaders keyed by file path, as returned by `import.meta.glob('./*\/app.ts')`. */
export type AppFiles = Record<string, () => Promise<AppModule>>

/** Problems in a manifest's declarations, one French sentence each. */
export function manifestProblems(manifest: AppManifest): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const setting of manifest.settings) {
    if (seen.has(setting.id)) problems.push(`réglage « ${setting.id} » déclaré deux fois`)
    seen.add(setting.id)
    if (setting.type === 'slider' && !(setting.min < setting.max && setting.step > 0))
      problems.push(`réglage « ${setting.id} » : bornes ou pas invalides`)
    const reason = invalidReason(setting, setting.default)
    if (reason) problems.push(`réglage « ${setting.id} » : valeur par défaut invalide (${reason})`)
  }
  // [SPEC-7.5] A threshold is drawn on the live level, shown only for a microphone app.
  for (const threshold of manifest.soundThresholds ?? []) {
    const setting = manifest.settings.find((s) => s.id === threshold.setting)
    if (setting?.type !== 'slider')
      problems.push(`seuil « ${threshold.label} » : « ${threshold.setting} » n'est pas un curseur déclaré`)
  }
  const thresholds = manifest.soundThresholds ?? []
  if (thresholds.length > 0 && !manifest.needs.includes('microphone'))
    problems.push('seuils sonores déclarés sans le besoin « microphone »')
  // [SPEC-7.5] One slider under the level sets every threshold.
  if (new Set(thresholds.map((t) => t.setting)).size > 1) problems.push('seuils sonores réglés par plusieurs curseurs')
  const offsets = thresholds.map((t) => t.offsetDb ?? 0)
  if (offsets.some((offset, i) => i > 0 && offset <= (offsets[i - 1] ?? 0))) problems.push('seuils sonores pas dans l’ordre croissant')
  if (manifest.soundZones !== undefined && manifest.soundZones.length !== thresholds.length + 1)
    problems.push(`${manifest.soundZones.length} zones sonores pour ${thresholds.length} seuils : il en faut une de plus que de seuils`)
  return problems
}

/** Builds the menu list from the ids and the files found in `src/apps/`. Throws on any
 *  inconsistency, so a broken registry fails the tests and the build check. */
export function buildRegistry(
  ids: readonly string[],
  manifests: ManifestFiles,
  apps: AppFiles,
  includeDevOnly: boolean,
): AppRegistry {
  const entries: AppEntry[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Registre : « ${id} » est inscrite deux fois`)
    seen.add(id)
    const manifest = manifests[`./${id}/manifest.ts`]?.manifest
    if (!manifest) throw new Error(`Registre : src/apps/${id}/manifest.ts introuvable ou sans export « manifest »`)
    if (manifest.id !== id) throw new Error(`Registre : la fiche de src/apps/${id}/ porte l'identifiant « ${manifest.id} »`)
    const load = apps[`./${id}/app.ts`]
    if (!load) throw new Error(`Registre : src/apps/${id}/app.ts introuvable`)
    const problems = manifestProblems(manifest)
    if (problems.length > 0) throw new Error(`Registre : fiche « ${id} » : ${problems.join(' ; ')}`)
    if (manifest.devOnly && !includeDevOnly) continue
    entries.push({ manifest, load })
  }
  return {
    entries,
    get(id) {
      const entry = entries.find((e) => e.manifest.id === id)
      if (!entry) throw new Error(`Activité inconnue : « ${id} »`)
      return entry
    },
  }
}

const manifestFiles: ManifestFiles = import.meta.glob<{ manifest: AppManifest }>('./*/manifest.ts', { eager: true })
const appFiles: AppFiles = import.meta.glob<AppModule>('./*/app.ts')

/** Folders found under `src/apps/`, for the test that checks each one is registered. */
export const APP_FOLDERS: readonly string[] = Object.keys(manifestFiles).map((path) => path.split('/')[1] ?? path)

export const APP_REGISTRY: AppRegistry = buildRegistry(APP_IDS, manifestFiles, appFiles, import.meta.env.DEV)
