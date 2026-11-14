// [SPEC-7.1] Settings kept in localStorage, one entry per sub-application plus a common space
// (calibration). Values are validated against the app's declarations [SPEC-4.1]: anything
// unreadable falls back to the default value and is reported to the adult.
import type { SettingDeclaration, SettingValue, SettingValues } from '../apps/types'

/** The part of the Web Storage API used here, so tests can pass an in-memory store. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY_PREFIX = 'proj-classe.settings.'
/** Storage key of an app's settings. */
export function appSettingsKey(appId: string): string {
  return `${KEY_PREFIX}app.${appId}`
}
/** Storage key of the common space, shared by all apps (calibration) [SPEC-7.1]. */
export const COMMON_SETTINGS_KEY = `${KEY_PREFIX}common`

export function defaultValues(declarations: readonly SettingDeclaration[]): SettingValues {
  const values: SettingValues = {}
  for (const declaration of declarations) values[declaration.id] = declaration.default
  return values
}

/** Reason why a value does not fit its declaration, or undefined when it fits. */
export function invalidReason(declaration: SettingDeclaration, value: unknown): string | undefined {
  if (declaration.type === 'toggle') return typeof value === 'boolean' ? undefined : 'oui ou non attendu'
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'nombre attendu'
  if (value < declaration.min || value > declaration.max)
    return `valeur ${value} hors des bornes ${declaration.min} à ${declaration.max}`
  return undefined
}

export interface ResolvedValues {
  values: SettingValues
  /** One French sentence per value replaced by its default. */
  problems: string[]
}

/** Declared values from what was stored. Keys no longer declared are dropped without notice
 *  (a newer version removed the setting). */
export function resolveValues(declarations: readonly SettingDeclaration[], stored: unknown): ResolvedValues {
  const values = defaultValues(declarations)
  const problems: string[] = []
  if (stored === undefined) return { values, problems }
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    problems.push('contenu enregistré illisible, toutes les valeurs par défaut sont utilisées')
    return { values, problems }
  }
  const record = stored as Record<string, unknown>
  for (const declaration of declarations) {
    if (!(declaration.id in record)) continue
    const value = record[declaration.id]
    const reason = invalidReason(declaration, value)
    if (reason) problems.push(`« ${declaration.label} » : ${reason}, valeur par défaut utilisée`)
    else values[declaration.id] = value as SettingValue
  }
  return { values, problems }
}

export class SettingsStore {
  /**
   * @param onProblem receives a French message when stored settings could not be used,
   *   so that it is shown to the adult.
   */
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly onProblem: (message: string) => void,
  ) {}

  /** Current values of an app's settings. */
  read(appId: string, declarations: readonly SettingDeclaration[]): SettingValues {
    const key = appSettingsKey(appId)
    let stored: unknown
    const text = this.storage.getItem(key)
    if (text !== null) {
      try {
        stored = JSON.parse(text)
      } catch {
        stored = null // reported below as unreadable content
      }
    }
    const { values, problems } = resolveValues(declarations, stored)
    if (problems.length > 0) this.onProblem(`Réglages de « ${appId} » : ${problems.join(' ; ')}.`)
    return values
  }

  /** Validates and saves one value; returns the app's values after the change.
   *  Throws on an unknown setting or an invalid value. */
  write(appId: string, declarations: readonly SettingDeclaration[], id: string, value: SettingValue): SettingValues {
    const declaration = declarations.find((d) => d.id === id)
    if (!declaration) throw new Error(`Réglage inconnu « ${id} » pour « ${appId} »`)
    const reason = invalidReason(declaration, value)
    if (reason) throw new RangeError(`Réglage « ${declaration.label} » : ${reason}`)
    const values = { ...this.read(appId, declarations), [id]: value }
    this.storage.setItem(appSettingsKey(appId), JSON.stringify(values))
    return values
  }

  /** Back to the declared defaults [SPEC-7.4]. */
  reset(appId: string, declarations: readonly SettingDeclaration[]): SettingValues {
    this.storage.removeItem(appSettingsKey(appId))
    return defaultValues(declarations)
  }

  /** Value of the common space [SPEC-7.1], undefined when never written. */
  readCommon(key: string): unknown {
    return this.readCommonRecord()[key]
  }

  writeCommon(key: string, value: unknown): void {
    const record = { ...this.readCommonRecord(), [key]: value }
    this.storage.setItem(COMMON_SETTINGS_KEY, JSON.stringify(record))
  }

  private readCommonRecord(): Record<string, unknown> {
    const text = this.storage.getItem(COMMON_SETTINGS_KEY)
    if (text === null) return {}
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    this.onProblem('Réglages communs illisibles : ils sont ignorés.')
    return {}
  }
}
