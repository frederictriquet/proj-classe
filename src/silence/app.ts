// [SPEC-4.2] [SPEC-9] [SPEC-9.8] The loop of an activity of silence: its decor, its animals and its
// reward, driven by the sound level. Every frame the difference to the ambient noise [SPEC-6.4]
// feeds the calm logic [SPEC-9.4], whose targets set what each animal does [SPEC-9.3]. No sound
// is played [SPEC-9.1] and no control for the adult is drawn [SPEC-4.4]. The animals are the
// children's indicator; the adult reads a mini sound meter at the bottom left [SPEC-9.7].
import { Application } from 'pixi.js'
import type { AppContext, RunningApp } from '../apps/types'
import { frameStep } from './ambient'
import { createAnimal } from './animals'
import { CalmLogic, type CalmOutput, type CalmSettings } from './calm'
import type { Decor } from './decor'
import { SETTING } from './manifest'
import { createMeter } from './meter-art'
import { rewardActive } from './reward'
import { drawAnimal } from './rig'
import type { SilenceWorld } from './world'

/** Development hook (`npm run dev` only) for the end-to-end checks: reads what the scene shows. */
interface SilenceProbe<Id extends string> {
  output: CalmOutput<Id> | undefined
  states(): Record<string, string>
  settings(): CalmSettings
  reward(): { active: boolean; level: number }
}
/** The window, as a place to hang the development hook. */
type ProbeWindow = Record<string, unknown>

export async function startSilence<Id extends string, D extends Decor>(context: AppContext, world: SilenceWorld<Id, D>): Promise<RunningApp> {
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
  const animals = world.animals.map((spec, i) => createAnimal(spec, drawAnimal(spec, world.rigs[spec.id], world.paper), decor, i + 1))
  const reward = world.createReward(decor)
  // [SPEC-9.7] On the stage, in screen pixels, over the scaled decor.
  const meter = createMeter(world.meter)
  app.stage.addChild(meter.root)
  const logic = new CalmLogic(world.animals.map((spec) => spec.id))

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
  let output: CalmOutput<Id> | undefined
  // [SPEC-8.6] Checked every frame rather than on a resize event: this also covers the scene
  // window moved to the projector and the change to full screen.
  let width = 0
  let height = 0
  // The app's own ticker: destroying the application stops it [SPEC-4.2].
  app.ticker.add((ticker) => {
    if (app.screen.width !== width || app.screen.height !== height) {
      width = app.screen.width
      height = app.screen.height
      decor.resize(width, height)
      meter.resize(width, height)
    }
    const dt = frameStep(ticker.deltaMS)
    const aboveAmbientDb = context.sound.aboveAmbientDb
    output = logic.step(aboveAmbientDb, dt, settings)
    meter.update(aboveAmbientDb, settings.alertDb)
    for (const animal of animals) {
      animal.setTarget(output.targets[animal.id])
      animal.update(dt)
    }
    rewarded = rewardActive(rewarded, output, animals.map((animal) => animal.state))
    decor.tick(dt)
    reward.update(dt, rewarded)
  })

  const probeWindow = window as unknown as ProbeWindow
  const probeName = `__${world.probe}`
  if (import.meta.env.DEV) {
    const probe: SilenceProbe<Id> = {
      get output() {
        return output
      },
      states: () => Object.fromEntries(animals.map((animal) => [animal.id, animal.state])),
      settings: () => settings,
      reward: () => ({ active: rewarded, level: reward.level }),
    }
    probeWindow[probeName] = probe
  }

  return {
    stop() {
      offSettings()
      delete probeWindow[probeName]
      // [SPEC-4.2] Ticker, display objects, their geometry and textures. The host gives the
      // microphone back right after [SPEC-6.7].
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true, context: true })
    },
  }
}
