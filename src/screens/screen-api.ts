// [SPEC-5.3] [SPEC-5.4] Chrome's Window Management API (types missing from the DOM library) and the
// pure helpers that place the scene window: which screen, which window features, which address.

export interface ScreenDetailed extends Screen {
  readonly availLeft: number
  readonly availTop: number
  readonly left: number
  readonly top: number
  readonly isPrimary: boolean
  readonly isInternal: boolean
  readonly devicePixelRatio: number
  readonly label: string
}

export interface ScreenDetails extends EventTarget {
  readonly screens: readonly ScreenDetailed[]
  readonly currentScreen: ScreenDetailed
}

export type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> }
/** `screen` in Chrome: `isExtended` and the `change` event come with the Window Management API. */
export type ScreenWithExtended = Screen & EventTarget & { isExtended?: boolean }
export type FullscreenOptionsWithScreen = FullscreenOptions & { screen?: ScreenDetailed }

/** Name of the scene window: a second « Projeter » reuses it instead of piling up windows. */
export const SCENE_WINDOW_NAME = 'proj-classe-scene'

/** [SPEC-5.4] Size of the scene window when it cannot be placed: small enough to drag. */
export const FALLBACK_WIDTH = 1024
export const FALLBACK_HEIGHT = 640

/** Position of the projector screen, carried in the scene address so that the scene can ask
 *  for full screen on that screen [SPEC-5.3]. */
export interface ScreenPosition {
  left: number
  top: number
}

/** What the scene window reads from its address. */
export interface SceneParams {
  /** Identifies the BroadcastChannel of this projection. */
  channel: string
  /** Projector screen chosen by the control window; absent in the fallback [SPEC-5.4]. */
  target?: ScreenPosition
}

const SCENE_HASH = '#scene?'

/** [SPEC-5.3] The screen the scene goes to: another screen than the control window's, an external
 *  one first. Undefined with a single screen. */
export function otherScreen(details: ScreenDetails): ScreenDetailed | undefined {
  const others = details.screens.filter((s) => s !== details.currentScreen)
  return others.find((s) => !s.isInternal) ?? others[0]
}

/** [SPEC-5.3] [SPEC-5.4] `window.open` features: at the projector's coordinates, full screen when
 *  Chrome honours it; otherwise a plain window the adult drags onto the projector. */
export function sceneFeatures(target: ScreenDetailed | undefined): string {
  if (!target) return `popup,width=${FALLBACK_WIDTH},height=${FALLBACK_HEIGHT}`
  return `popup,fullscreen,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`
}

/** Address of the scene window: the same page (query string kept, `?micro=simule` included)
 *  with a hash the scene recognises. A hash, not a query parameter, so that the service worker
 *  serves the cached page offline [SPEC-3.1]. */
export function sceneUrl(pageUrl: string, params: SceneParams): string {
  const url = new URL(pageUrl)
  const query = new URLSearchParams({ canal: params.channel })
  if (params.target) {
    query.set('x', String(params.target.left))
    query.set('y', String(params.target.top))
  }
  url.hash = `${SCENE_HASH.slice(1)}${query.toString()}`
  return url.href
}

/** Reads the scene address; undefined for any other page. */
export function parseSceneHash(hash: string): SceneParams | undefined {
  if (!hash.startsWith(SCENE_HASH)) return undefined
  const query = new URLSearchParams(hash.slice(SCENE_HASH.length))
  const channel = query.get('canal')
  if (!channel) return undefined
  const left = Number(query.get('x') ?? Number.NaN)
  const top = Number(query.get('y') ?? Number.NaN)
  return Number.isFinite(left) && Number.isFinite(top) ? { channel, target: { left, top } } : { channel }
}
