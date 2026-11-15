// [SPEC-4.2] [SPEC-13] « Ruche du silence », first step: the apiary alone, with its quiet life
// [SPEC-13.3], until the bees and the butterflies join it through the shared loop of the
// activities of silence [SPEC-9.8]. Same set-up and same release as src/silence/app.ts.
import { Application } from 'pixi.js'
import { frameStep } from '../../silence/ambient'
import type { AppFactory } from '../types'
import { createApiary } from './apiary'
import { PALETTE } from './palette'

export const start: AppFactory = async (context) => {
  const app = new Application()
  await app.init({
    resizeTo: context.container,
    background: PALETTE.sky,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  context.container.append(app.canvas)
  const apiary = createApiary()
  app.stage.addChild(apiary.root)

  // [SPEC-8.6] Checked every frame: also covers the scene window moved to the projector.
  let width = 0
  let height = 0
  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    if (app.screen.width !== width || app.screen.height !== height) {
      width = app.screen.width
      height = app.screen.height
      apiary.resize(width, height)
    }
    apiary.tick(frameStep(ticker.deltaMS))
  })

  return {
    stop() {
      // [SPEC-4.2] Ticker, display objects, their geometry and textures. The host gives the
      // microphone back right after [SPEC-6.7].
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
