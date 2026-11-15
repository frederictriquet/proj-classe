// [SPEC-9.3] [SPEC-8.5] [SPEC-9.8] Development gallery of an activity of silence: its animals in
// its decor, driven with the keyboard, with a frames-per-second counter. Escape and + = - stay for
// the host.
//
// Keys: 1 to the number of animals (at most 9) select an animal, 0 all of them; c caché,
// m museau, a s'approche, i installé, l alerte, f fuite; b broute, g se gratte, d dort,
// r regarde, p repos, y cligne; space pauses, n advances one frame while paused, h hides this
// panel.
//
// `window.__galerie` lets the screenshot scripts drive the gallery with a frozen clock.
import { Application, Rectangle } from 'pixi.js'
import type { AppContext, RunningApp } from '../apps/types'
import { FpsMeter } from '../diagnostic/fps-meter'
import { frameStep } from './ambient'
import type { Activity, AnimalState } from './animal'
import { createAnimal, type GalleryAnimal } from './animals'
import type { Decor } from './decor'
import { drawAnimal } from './rig'
import type { SilenceWorld } from './world'

const STATE_NAMES: Record<AnimalState, string> = {
  hidden: 'caché',
  peeking: 'museau',
  approaching: "s'approche",
  settled: 'installé',
  alert: 'alerte',
  fleeing: 'fuite',
}
const ACTIVITY_NAMES: Record<Activity, string> = {
  rest: 'repos',
  graze: 'broute',
  scratch: 'se gratte',
  sleep: 'dort',
  look: 'regarde',
}
const STATE_KEYS: Record<string, AnimalState> = { c: 'hidden', m: 'peeking', a: 'approaching', i: 'settled', l: 'alert', f: 'fleeing' }
const ACTIVITY_KEYS: Record<string, Activity> = { b: 'graze', g: 'scratch', d: 'sleep', r: 'look', p: 'rest' }
const FRAME = 1 / 60

/** @param names name of each animal in the panel, in French. */
export async function startGallery<Id extends string, D extends Decor>(
  context: AppContext,
  world: SilenceWorld<Id, D>,
  names: Readonly<Record<Id, string>>,
): Promise<RunningApp> {
  const ids = world.animals.map((spec) => spec.id)
  const specs = new Map(world.animals.map((spec) => [spec.id, spec]))
  if (ids.length > 9) throw new Error(`La galerie ne sait choisir que 9 animaux au clavier, pas ${ids.length}`)
  const app = new Application()
  await app.init({
    resizeTo: context.container,
    background: world.background,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  context.container.append(app.canvas)

  const decor = world.createDecor()
  app.stage.addChild(decor.root)
  const animals = new Map<Id, GalleryAnimal<Id>>(
    world.animals.map((spec, i) => [spec.id, createAnimal(spec, drawAnimal(spec, world.rigs[spec.id], world.paper), decor, i + 1)]),
  )
  const pick = (id: Id | 'all'): GalleryAnimal<Id>[] => (id === 'all' ? [...animals.values()] : [animals.get(id)!])

  let selection: Id | 'all' = 'all'
  let paused = false
  let fps = new FpsMeter()

  const panel = document.createElement('pre')
  panel.style.cssText = [
    'position:absolute',
    'top:12px',
    'left:12px',
    'margin:0',
    'padding:10px 14px',
    'font:14px/1.45 ui-monospace,Menlo,monospace',
    `color:${world.paper.cream}`,
    `background:${world.paper.ink}`,
    'opacity:0.85',
    'border-radius:8px',
    'pointer-events:none',
  ].join(';')
  context.container.append(panel)

  const advance = (dt: number) => {
    if (dt > 0) decor.tick(dt)
    for (const animal of animals.values()) animal.update(dt)
  }

  const describe = () => {
    const { current, min } = fps.value
    const rate = (value: number | undefined) => (value === undefined ? '…' : value.toFixed(0))
    const lines = [
      `Galerie des animaux${paused ? ' (pause)' : ''}`,
      `Images/s : ${rate(current)} (min ${rate(min)})`,
      '',
      ...ids.map((id, i) => {
        const { model } = animals.get(id)!
        const activity = model.state === 'settled' ? ` (${ACTIVITY_NAMES[model.currentActivity]})` : ''
        const mark = selection === id || selection === 'all' ? '>' : ' '
        return `${mark} ${i + 1} ${names[id].padEnd(9)} ${STATE_NAMES[model.state]}${activity}`
      }),
      '',
      `1-${ids.length} un animal, 0 tous`,
      'c caché  m museau  a approche',
      'i installé  l alerte  f fuite',
      'b broute  g gratte  d dort',
      'r regarde  p repos  y cligne',
      'espace pause  n image  h masquer',
    ]
    panel.textContent = lines.join('\n')
  }

  let width = 0
  let height = 0
  let lastPanel = 0
  app.ticker.add((ticker) => {
    if (app.screen.width !== width || app.screen.height !== height) {
      width = app.screen.width
      height = app.screen.height
      decor.resize(width, height)
    }
    advance(paused ? 0 : frameStep(ticker.deltaMS))
    const now = performance.now()
    fps.frame(now)
    if (now - lastPanel > 250) {
      lastPanel = now
      describe()
    }
  })

  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (/^[0-9]$/.test(key) && Number(key) <= ids.length) selection = key === '0' ? 'all' : ids[Number(key) - 1]!
    else if (key in STATE_KEYS) for (const animal of pick(selection)) animal.setTarget(STATE_KEYS[key]!)
    else if (key in ACTIVITY_KEYS) for (const animal of pick(selection)) animal.forceActivity(ACTIVITY_KEYS[key]!)
    else if (key === 'y') for (const animal of pick(selection)) animal.forceBlink()
    else if (key === ' ') paused = !paused
    else if (key === 'n' && paused) advance(FRAME)
    else if (key === 'h') panel.hidden = !panel.hidden
    else return
    event.preventDefault()
    describe()
  }
  window.addEventListener('keydown', onKey)

  /** Pixels of the whole canvas, as rendered now. */
  const pixels = (): Uint8ClampedArray => {
    app.renderer.render(app.stage)
    return app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(0, 0, app.screen.width, app.screen.height) }).pixels
  }
  const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    let count = 0
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) count++
    }
    return count
  }

  const hook = {
    ids,
    setTarget(id: Id | 'all', state: AnimalState) {
      for (const animal of pick(id)) animal.setTarget(state)
    },
    force(id: Id | 'all', activity: Activity) {
      for (const animal of pick(id)) animal.forceActivity(activity)
    },
    blink(id: Id | 'all') {
      for (const animal of pick(id)) animal.forceBlink()
    },
    pause(on: boolean) {
      paused = on
    },
    /** Advances the frozen clock by `seconds`, frame by frame. */
    advance(seconds: number, step = FRAME) {
      for (let t = 0; t < seconds - 1e-9; t += step) advance(Math.min(step, seconds - t))
    },
    /** Advances frame by frame until `test` holds or `limit` seconds have passed; returns the time,
     *  or -1. `distance`: at least this far along the path; `below`: at most this far. */
    advanceUntil(id: Id, test: { state?: AnimalState; distance?: number; below?: number; inHideout?: boolean }, limit = 30) {
      const animal = animals.get(id)!
      let t = 0
      const done = () =>
        (test.state === undefined || animal.state === test.state) &&
        (test.distance === undefined || animal.model.distance >= test.distance) &&
        (test.below === undefined || animal.model.distance <= test.below) &&
        (test.inHideout === undefined || animal.model.inHideout === test.inHideout)
      while (!done() && t < limit) {
        advance(FRAME)
        t += FRAME
      }
      return done() ? t : -1
    },
    info() {
      return ids.map((id) => {
        const { model, view } = animals.get(id)!
        const bounds = view.getBounds()
        return {
          id,
          state: model.state,
          activity: model.currentActivity,
          distance: model.distance,
          sPeek: model.sPeek,
          sExit: model.sExit,
          sSpot: model.sSpot,
          inHideout: model.inHideout,
          pose: { ...model.pose },
          layer: view.parent?.label ?? '',
          /** Screen bounds, CSS pixels. */
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          extent: specs.get(id)!.extent,
        }
      })
    },
    /** Screen rectangle (CSS pixels) covering the whole path of an animal, to crop screenshots. */
    frame(id: Id, margin = 30) {
      const { path, extent } = specs.get(id)!
      const half = Math.max(-extent.left, extent.right)
      const left = Math.min(...path.map((p) => p.x)) - half - margin
      const right = Math.max(...path.map((p) => p.x)) + half + margin
      const top = Math.min(...path.map((p) => p.y)) + extent.top - margin
      const bottom = Math.max(...path.map((p) => p.y)) + margin
      const { x, y } = decor.root.position
      const scale = decor.root.scale.x
      return { x: x + left * scale, y: y + top * scale, width: (right - left) * scale, height: (bottom - top) * scale }
    },
    /** Number of pixels that change when the animal is drawn in its hideout's slot instead of the
     *  actors layer, at its current position. 0: changing layer there makes no visible jump. */
    diffLayers(id: Id) {
      const animal = animals.get(id)!
      animal.forceLayer('hideout')
      const inSlot = pixels()
      animal.forceLayer('open')
      const inActors = pixels()
      animal.forceLayer(undefined)
      return differing(inSlot, inActors)
    },
    /** Number of pixels the animal changes on screen. 0: it is invisible. */
    diffVisible(id: Id) {
      const { view } = animals.get(id)!
      const shown = pixels()
      view.visible = false
      const hidden = pixels()
      view.visible = true
      return differing(shown, hidden)
    },
    fps() {
      return fps.value
    },
    /** Starts a new measurement, for example once all the animals are settled. */
    resetFps() {
      fps = new FpsMeter()
    },
    panel(visible: boolean) {
      panel.hidden = !visible
    },
  }
  ;(window as unknown as { __galerie?: typeof hook }).__galerie = hook

  return {
    stop() {
      window.removeEventListener('keydown', onKey)
      delete (window as unknown as { __galerie?: typeof hook }).__galerie
      panel.remove()
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
