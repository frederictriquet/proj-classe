// [SPEC-4.2] Development-only demo: a round shape with big eyes circling the screen.
// It checks the contract: live settings, full release at stop(), runtime error capture.
import { Application, Container, Graphics } from 'pixi.js'
import type { AppContext, RunningApp } from '../types'

/** Seconds per turn at speed 1. Slow on purpose [SPEC-8.5]. */
const SECONDS_PER_TURN = 8
/** Key that makes the next frame throw, to check that the host returns to the menu [SPEC-4.8]. */
export const CRASH_KEY = 'x'

/** Angle after `dt` seconds at the given speed factor. */
export function advanceAngle(angle: number, dt: number, speed: number): number {
  return (angle + (dt * speed * 2 * Math.PI) / SECONDS_PER_TURN) % (2 * Math.PI)
}

function drawCreature(): Container {
  // Paper cut-out style: flat colours, round shapes, big eyes [SPEC-8.1].
  const creature = new Container()
  const body = new Graphics().circle(0, 0, 90).fill('#F4C430')
  const eyes = new Graphics()
    .circle(-32, -20, 30)
    .circle(32, -20, 30)
    .fill('#FFFFFF')
    .circle(-26, -14, 14)
    .circle(38, -14, 14)
    .fill('#1B1B1B')
  const mouth = new Graphics()
    .moveTo(-30, 30)
    .quadraticCurveTo(0, 56, 30, 30)
    .stroke({ width: 10, color: '#1B1B1B', cap: 'round' })
  creature.addChild(body, eyes, mouth)
  return creature
}

export async function start(context: AppContext): Promise<RunningApp> {
  const app = new Application()
  await app.init({
    resizeTo: context.container,
    background: '#2E6B3F',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  context.container.append(app.canvas)

  const creature = drawCreature()
  app.stage.addChild(creature)

  let angle = 0
  let crashRequested = false
  const onKey = (event: KeyboardEvent) => {
    if (event.key === CRASH_KEY) crashRequested = true
  }
  window.addEventListener('keydown', onKey)

  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    if (crashRequested) throw new Error('Erreur provoquée dans la démonstration (touche X)')
    angle = advanceAngle(angle, ticker.deltaMS / 1000, context.settings.number('speed'))
    const { width, height } = app.screen
    const radius = Math.min(width, height) * 0.3
    creature.position.set(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius)
    creature.scale.set((context.settings.boolean('big') ? 2 : 1) * (Math.min(width, height) / 1000))
  })

  return {
    stop() {
      window.removeEventListener('keydown', onKey)
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
