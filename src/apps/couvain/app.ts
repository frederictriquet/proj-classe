// [SPEC-4.2] [SPEC-4.4] [SPEC-9.8] [SPEC-14] « Couvain du silence », first step: the incubator
// decor alone, with its twenty eggs and its quiet permanent life [SPEC-14.3], until the twenty
// chicks join it through the shared loop of the activities of silence. Same set-up and same
// release as src/silence/app.ts.
import { Application } from 'pixi.js'
import { frameStep } from '../../silence/ambient'
import type { AppFactory } from '../types'
import { createIncubator } from './incubator'
import { PALETTE } from './palette'

export const start: AppFactory = async (context) => {
  const app = new Application()
  await app.init({
    resizeTo: context.container,
    background: PALETTE.slate,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  context.container.append(app.canvas)
  const incubator = createIncubator()
  app.stage.addChild(incubator.root)

  // [SPEC-8.6] Checked every frame: also covers the scene window moved to the projector.
  let width = 0
  let height = 0
  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    if (app.screen.width !== width || app.screen.height !== height) {
      width = app.screen.width
      height = app.screen.height
      incubator.resize(width, height)
    }
    incubator.tick(frameStep(ticker.deltaMS))
  })

  return {
    stop() {
      // [SPEC-4.2] Ticker, display objects, their geometry and textures. The host gives the
      // microphone back right after [SPEC-6.7].
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
