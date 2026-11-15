// [SPEC-15] « Cohérence cardiaque »: a big pastel bubble goes up while the class breathes in and
// down while it breathes out, in front of an evening sky with still stars and small bubbles rising
// slowly. At the end of the set duration it turns into a smiling face [SPEC-15.6]. Paper cut-out
// style [SPEC-8.1], palette colours only [SPEC-8.3.2], no text, no sound.
import { Application, Container, Graphics } from 'pixi.js'
import { paperShadow } from '../../art/palette'
import type { AppContext, RunningApp } from '../types'
import { PALETTE } from './palette'
import { SESSION_START, step, view } from './session'

/** [SPEC-15.2] [SPEC-15.4] Path of the bubble's centre, as shares of the screen height: it stays in
 *  the central safe area, above the hills [SPEC-8.6]. */
const BOTTOM_Y = 0.66
const TOP_Y = 0.32
/** Radius of the bubble at the bottom, as a share of the smaller screen side. */
const RADIUS = 0.16
/** [SPEC-15.2] Extra size at the top of the path. */
const GROWTH = 0.12
/** Radius the bubble is drawn at; the container is scaled to the screen. */
const UNIT = 100

/** Top of the lower sky band and crests of the hills, as shares of the screen height. */
const BAND_Y = 0.48
const BACK_HILL_Y = 0.86
const FRONT_HILL_Y = 0.91

/** [SPEC-15.4] Still stars: position as shares of the screen, radius as a share of the smaller side. */
const STARS: readonly (readonly [number, number, number])[] = [
  [0.08, 0.1, 0.006], [0.19, 0.27, 0.004], [0.27, 0.07, 0.005], [0.36, 0.2, 0.004],
  [0.62, 0.09, 0.005], [0.71, 0.24, 0.004], [0.8, 0.06, 0.006], [0.9, 0.18, 0.005],
  [0.95, 0.34, 0.004], [0.04, 0.38, 0.004], [0.15, 0.44, 0.003], [0.86, 0.42, 0.003],
]

/** [SPEC-15.4] [SPEC-8.5] Small rising bubbles: x as a share of the width, radius as a share of
 *  the smaller side, seconds to cross the screen, start offset in the climb. */
const SMALL_BUBBLES: readonly (readonly [number, number, number, number])[] = [
  [0.07, 0.018, 46, 0.1], [0.16, 0.012, 58, 0.55], [0.25, 0.022, 52, 0.8],
  [0.34, 0.01, 64, 0.3], [0.66, 0.014, 50, 0.65], [0.75, 0.02, 60, 0.15],
  [0.84, 0.011, 44, 0.45], [0.93, 0.016, 56, 0.9],
]

/** [SPEC-15.6] The face on the bubble, `amount` from 0 (none) to 1 (full smile): closed happy
 *  eyes, a smile that deepens and pink cheeks. */
function drawFace(g: Graphics, amount: number): void {
  const line = { width: 8, color: PALETTE.ink, cap: 'round' as const }
  g.clear()
    .circle(-62, 24, 15)
    .circle(62, 24, 15)
    .fill({ color: PALETTE.rose, alpha: 0.7 })
    .moveTo(-50, 0)
    .quadraticCurveTo(-34, -20, -18, 0)
    .moveTo(18, 0)
    .quadraticCurveTo(34, -20, 50, 0)
    .moveTo(-36, 28)
    .quadraticCurveTo(0, 28 + 44 * amount, 36, 28)
    .stroke(line)
  g.alpha = amount
}

function drawBubble(): { root: Container; halo: Graphics; face: Graphics } {
  const root = new Container()
  const halo = new Graphics()
  for (const scale of [1.5, 1.32, 1.16]) halo.circle(0, 0, UNIT * scale).fill({ color: PALETTE.cream, alpha: 0.08 })
  const shadow = new Graphics().circle(6, 9, UNIT).fill(paperShadow(PALETTE.ink))
  const body = new Graphics()
    .circle(0, 0, UNIT)
    .fill(PALETTE.pink)
    .circle(0, 0, UNIT - 3)
    .stroke({ width: 6, color: PALETTE.rose })
  const shine = new Graphics().ellipse(0, 0, 30, 15).fill({ color: PALETTE.cream, alpha: 0.9 })
  shine.position.set(-42, -46)
  shine.rotation = -0.7
  const dot = new Graphics().circle(-14, -70, 8).fill({ color: PALETTE.cream, alpha: 0.9 })
  const face = new Graphics()
  drawFace(face, 0)
  root.addChild(halo, shadow, body, shine, dot, face)
  return { root, halo, face }
}

/** A hill line across the whole width, crest at `crest` (pixels), with two soft bumps. */
function hill(g: Graphics, width: number, height: number, crest: number, swell: number, shift: number): Graphics {
  return g
    .moveTo(0, crest + swell * 0.4)
    .bezierCurveTo(width * (0.2 + shift), crest - swell, width * (0.4 + shift), crest + swell, width * 0.55, crest)
    .bezierCurveTo(width * (0.7 + shift), crest - swell, width * 0.88, crest + swell * 0.6, width, crest - swell * 0.2)
    .lineTo(width, height)
    .lineTo(0, height)
    .closePath()
}

function drawDecor(sky: Graphics, hills: Graphics, width: number, height: number): void {
  const side = Math.min(width, height)
  const shadow = paperShadow(PALETTE.ink)
  sky.clear().rect(0, 0, width, height).fill(PALETTE.dusk)
  for (const [x, y, r] of STARS) sky.circle(x * width, y * height, r * side).fill(PALETTE.butter)
  // Lower band with a soft wavy edge, its paper shadow cast on the upper band [SPEC-8.1].
  const band = (g: Graphics, dy: number) =>
    g
      .moveTo(0, height * BAND_Y + dy)
      .bezierCurveTo(width * 0.3, height * (BAND_Y - 0.04) + dy, width * 0.6, height * (BAND_Y + 0.04) + dy, width, height * BAND_Y + dy)
      .lineTo(width, height)
      .lineTo(0, height)
      .closePath()
  band(sky, -6).fill(shadow)
  band(sky, 0).fill(PALETTE.lavender)

  const swell = height * 0.025
  hills.clear()
  hill(hills, width, height, height * BACK_HILL_Y - 6, swell, 0).fill(shadow)
  hill(hills, width, height, height * BACK_HILL_Y, swell, 0).fill(PALETTE.mint)
  hill(hills, width, height, height * FRONT_HILL_Y - 6, swell, 0.08).fill(shadow)
  hill(hills, width, height, height * FRONT_HILL_Y, swell, 0.08).fill(PALETTE.mint)
}

export async function start(context: AppContext): Promise<RunningApp> {
  const app = new Application()
  await app.init({
    resizeTo: context.container,
    background: PALETTE.dusk,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  context.container.append(app.canvas)

  const sky = new Graphics()
  const small = new Container()
  const smallBubbles = SMALL_BUBBLES.map(() => {
    const g = new Graphics()
      .circle(0, 0, UNIT)
      .fill({ color: PALETTE.cream, alpha: 0.16 })
      .circle(0, 0, UNIT - 6)
      .stroke({ width: 12, color: PALETTE.cream, alpha: 0.5 })
    small.addChild(g)
    return g
  })
  const bubble = drawBubble()
  const hills = new Graphics()
  app.stage.addChild(sky, small, bubble.root, hills)

  let session = SESSION_START
  let drawnFace = 0
  let clock = 0
  let drawnWidth = 0
  let drawnHeight = 0

  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    // [SPEC-15.3] [SPEC-15.6] Raw frame time, not the ticker's capped delta: the exercise lasts the
    // set minutes of real time even when frames are slow.
    const dt = ticker.elapsedMS / 1000
    clock += dt
    const { width, height } = app.screen
    if (width !== drawnWidth || height !== drawnHeight) {
      drawDecor(sky, hills, width, height)
      drawnWidth = width
      drawnHeight = height
    }
    const side = Math.min(width, height)

    // [SPEC-15.2] [SPEC-15.3] Settings are read every frame, so a change applies at once [SPEC-7.2].
    session = step(session, dt, {
      inhale: context.settings.number('inhale'),
      exhale: context.settings.number('exhale'),
      total: context.settings.number('total') * 60,
    })
    const { rise: r, face } = view(session)
    // [SPEC-15.6] The face is redrawn only while it changes.
    if (face !== drawnFace) {
      drawFace(bubble.face, face)
      drawnFace = face
    }
    bubble.root.position.set(width / 2, height * (BOTTOM_Y + (TOP_Y - BOTTOM_Y) * r))
    bubble.root.scale.set(((RADIUS * side) / UNIT) * (1 + GROWTH * r))
    bubble.halo.alpha = 0.6 + 0.4 * r

    // [SPEC-15.4] Small bubbles climb from behind the hills and leave at the top, swaying a little.
    SMALL_BUBBLES.forEach(([x, size, seconds, offset], i) => {
      const g = smallBubbles[i]
      if (!g) return
      const climb = (clock / seconds + offset) % 1
      const radius = size * side
      g.position.set(
        x * width + Math.sin(clock / 4 + i) * side * 0.01,
        height * FRONT_HILL_Y + radius - climb * (height * FRONT_HILL_Y + 2 * radius),
      )
      g.scale.set(radius / UNIT)
    })
  })

  return {
    stop() {
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
