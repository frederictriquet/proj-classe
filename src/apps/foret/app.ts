// [SPEC-4.2] [SPEC-9] « Forêt du silence »: the clearing, its six animals and the reward, driven
// by the sound level. Every frame the difference to the ambient noise [SPEC-6.4] feeds the calm
// logic [SPEC-9.4], whose targets set what each animal does [SPEC-9.3]. No sound is played
// [SPEC-9.1], nothing for the adult is drawn [SPEC-4.4] and no noise indicator is shown: the
// animals are the indicator [SPEC-9.7].
import { Application } from 'pixi.js'
import { PALETTE } from '../../art/palette'
import type { AppContext, RunningApp } from '../types'
import { frameStep } from './ambient'
import { ANIMAL_IDS } from './animal-data'
import { createAnimal } from './animals'
import { CalmLogic, type CalmOutput, type CalmSettings } from './calm'
import { createClearing } from './clearing'
import { SETTING } from './manifest'
import { rewardActive } from './reward'
import { createReward } from './reward-art'

/** Development hook (`npm run dev` only) for the end-to-end checks: reads what the scene shows. */
interface ForetProbe {
  output: CalmOutput | undefined
  states(): Record<string, string>
  settings(): CalmSettings
  reward(): { active: boolean; level: number }
}
type ProbeWindow = Window & { __foret?: ForetProbe }

export async function start(context: AppContext): Promise<RunningApp> {
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

  const clearing = createClearing()
  app.stage.addChild(clearing.root)
  const animals = ANIMAL_IDS.map((id, i) => createAnimal(id, clearing, i + 1))
  const reward = createReward(clearing)
  const logic = new CalmLogic()

  // [SPEC-9.6] [SPEC-7.2] Read again at every change, used from the next frame on.
  const readSettings = (): CalmSettings => ({
    alertDb: context.settings.number(SETTING.alertDb),
    totalS: context.settings.number(SETTING.totalS),
    toleranceS: context.settings.number(SETTING.toleranceS),
  })
  let settings = readSettings()
  const offSettings = context.settings.onChange(() => {
    settings = readSettings()
  })

  let rewarded = false
  let output: CalmOutput | undefined
  // [SPEC-8.6] Checked every frame rather than on a resize event: this also covers the scene
  // window moved to the projector and the change to full screen.
  let width = 0
  let height = 0
  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    if (app.screen.width !== width || app.screen.height !== height) {
      width = app.screen.width
      height = app.screen.height
      clearing.resize(width, height)
    }
    const dt = frameStep(ticker.deltaMS)
    output = logic.step(context.sound.aboveAmbientDb, dt, settings)
    for (const animal of animals) {
      animal.setTarget(output.targets[animal.id])
      animal.update(dt)
    }
    rewarded = rewardActive(rewarded, output, animals.map((animal) => animal.state))
    clearing.tick(dt)
    reward.update(dt, rewarded)
  })

  const probeWindow = window as ProbeWindow
  if (import.meta.env.DEV) {
    probeWindow.__foret = {
      get output() {
        return output
      },
      states: () => Object.fromEntries(animals.map((animal) => [animal.id, animal.state])),
      settings: () => settings,
      reward: () => ({ active: rewarded, level: reward.level }),
    }
  }

  return {
    stop() {
      offSettings()
      delete probeWindow.__foret
      // [SPEC-4.2] Ticker, display objects, their geometry and textures. The host gives the
      // microphone back right after [SPEC-6.7].
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
