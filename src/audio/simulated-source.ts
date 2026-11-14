// [SPEC-6.5] Simulated source for development and tests: no microphone, the level is set with
// the keyboard or a slider of the settings panel. Enabled by `?micro=simule` in the address.
import { DBFS_FLOOR, DEFAULT_AMBIENT_DBFS } from './level'
import type { LevelSource, OpenedSource } from './source'

/** Query parameter that turns the simulated source on: `?micro=simule`. */
export const SIMULATION_PARAM = 'micro'
export const SIMULATION_VALUE = 'simule'

export function isSimulationRequested(search: string): boolean {
  return new URLSearchParams(search).get(SIMULATION_PARAM) === SIMULATION_VALUE
}

/** Keys that raise and lower the simulated level. Escape and the arrows stay free for the
 *  menu and the running app. */
export const RAISE_KEYS: readonly string[] = ['+', '=']
export const LOWER_KEYS: readonly string[] = ['-']
/** dB per key press. */
export const KEY_STEP_DB = 3

export class SimulatedSource implements LevelSource {
  readonly simulated = true
  private db = DEFAULT_AMBIENT_DBFS

  get level(): number {
    return this.db
  }

  setLevel(db: number): void {
    if (!Number.isFinite(db)) throw new RangeError(`Niveau simulé invalide : ${db}`)
    this.db = Math.min(0, Math.max(DBFS_FLOOR, db))
  }

  open(): Promise<OpenedSource> {
    return Promise.resolve({ read: () => this.db, close() {} })
  }
}

/** [SPEC-6.5] Keyboard control of the simulated level, active in the whole window (menu and
 *  running app). `onChange` receives the new level, so that the control window can pass it on to
 *  the scene window [SPEC-5.5]. Returns a function that removes the listener. */
export function listenSimulationKeys(
  source: SimulatedSource,
  target: Window = window,
  onChange: (db: number) => void = () => {},
): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return // keep Chrome's zoom shortcuts
    if (RAISE_KEYS.includes(event.key)) source.setLevel(source.level + KEY_STEP_DB)
    else if (LOWER_KEYS.includes(event.key)) source.setLevel(source.level - KEY_STEP_DB)
    else return
    onChange(source.level)
  }
  target.addEventListener('keydown', onKey)
  return () => target.removeEventListener('keydown', onKey)
}
