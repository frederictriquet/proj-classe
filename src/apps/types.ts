// [SPEC-4.1] [SPEC-4.2] [SPEC-4.4] Contract between the host and a sub-application.
//
// A sub-application is a folder `src/apps/<id>/` with two files:
// - `manifest.ts` exports `manifest: AppManifest`. It is loaded with the menu, so it must stay
//   light (no PixiJS import).
// - `app.ts` exports `start: AppFactory`. It is loaded on demand when the app is launched [SPEC-4.3].
// The folder name is added to `APP_IDS` in `src/apps/registry.ts`.
import type { SoundLevel } from '../audio/sound-service'

export type { SoundLevel }

/** Needs the host checks before starting the app [SPEC-4.7]. */
export type AppNeed = 'microphone'

/** Slider setting: a number between bounds [SPEC-4.1]. */
export interface SliderSetting {
  type: 'slider'
  id: string
  /** Label shown to the adult in the settings panel, in French. */
  label: string
  min: number
  max: number
  step: number
  default: number
  /** Unit shown after the value, for example 's' or 'dB'. */
  unit?: string
}

/** On/off setting [SPEC-4.1]. */
export interface ToggleSetting {
  type: 'toggle'
  id: string
  label: string
  default: boolean
}

export type SettingDeclaration = SliderSetting | ToggleSetting
export type SettingValue = number | boolean
/** Values of the declared settings of one app, keyed by setting id. */
export type SettingValues = Record<string, SettingValue>

/** Sub-application card ("fiche") [SPEC-4.1]. */
export interface AppManifest {
  /** Same as the folder name under `src/apps/`. */
  id: string
  /** Title shown to the adult on the menu, in French. */
  title: string
  /** URL of the menu thumbnail (an SVG of the app folder, imported with Vite). */
  thumbnail: string
  needs: readonly AppNeed[]
  settings: readonly SettingDeclaration[]
  /** Listed on the menu only in development builds (`npm run dev`). */
  devOnly?: boolean
}

/** Current values of the app's declared settings, updated live by the host [SPEC-7.2]. */
export interface AppSettings {
  /** Value of a slider setting. Throws if the id is not a declared slider. */
  number(id: string): number
  /** Value of a toggle setting. Throws if the id is not a declared toggle. */
  boolean(id: string): boolean
  /** Called after any setting of this app changed. The host removes listeners at stop. */
  onChange(listener: () => void): () => void
}

/** What `start` receives [SPEC-4.2]. */
export interface AppContext {
  /** Element to render into. It fills the screen; the host removes it after `stop()`. */
  container: HTMLElement
  settings: AppSettings
  /** [SPEC-6.4] [SPEC-6.7] Sound level, refreshed every frame. The microphone is open only for an
   *  app whose manifest declares the `microphone` need; for any other app, reading it throws. */
  sound: SoundLevel
}

/** A started app. After `stop()`, nothing of the app may run: animation loop, listeners,
 *  microphone and textures are released [SPEC-4.2]. */
export interface RunningApp {
  stop(): void
}

export type AppFactory = (context: AppContext) => RunningApp | Promise<RunningApp>

/** Shape of `src/apps/<id>/app.ts`. */
export interface AppModule {
  start: AppFactory
}
