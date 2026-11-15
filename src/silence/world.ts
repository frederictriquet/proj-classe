// [SPEC-9.8] What an activity of silence gives the shared code: its animals and how to draw them,
// its decor, its reward and the colours the shared code draws with. Everything else (calm logic,
// animal behaviour, reward timing, settings, sound meter, loop) is shared.
import type { PaperColors } from '../art/palette'
import type { AnimalSpec } from './animal'
import type { Decor } from './decor'
import type { MeterColors } from './meter-art'
import type { RewardView } from './reward'
import type { RigFactory } from './rig'

export interface SilenceWorld<Id extends string = string, D extends Decor = Decor> {
  /** Name of the development hook on `window`, `__<probe>` (`npm run dev` only), for the
   *  end-to-end checks. */
  readonly probe: string
  /** [SPEC-9.4.1] The animals, from the least to the most timid: the order they come out in. */
  readonly animals: readonly AnimalSpec<Id>[]
  /** How to draw each animal. */
  readonly rigs: Readonly<Record<Id, RigFactory>>
  /** [SPEC-8.3] Ink and cream of the palette: pupils, eye whites, paper shadows. */
  readonly paper: PaperColors
  /** Colour of the canvas under the decor. */
  readonly background: string
  /** [SPEC-9.7] Colours of the mini sound meter. */
  readonly meter: MeterColors
  createDecor(): D
  /** [SPEC-9.5] Adds the reward to the decor, invisible until it is active. */
  createReward(decor: D): RewardView
}
