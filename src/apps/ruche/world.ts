// [SPEC-9.8] [SPEC-13] « Ruche du silence » as the shared code of the activities of silence sees
// it: the fifteen bees and the two butterflies, their rigs, the apiary and the colours of the
// palette.
import type { RewardView } from '../../silence/reward'
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createApiary, type Apiary } from './apiary'
import { PALETTE } from './palette'

/** [SPEC-13.4] Placeholder until the reward is drawn: nothing shows. */
function createReward(): RewardView {
  return { level: 0, update() {} }
}

export const RUCHE: SilenceWorld<AnimalId, Apiary> = {
  probe: 'ruche',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.sky,
  // [SPEC-9.7] Cream level; yellow and pink marks, edged with ink.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.yellow, flee: PALETTE.pink },
  createDecor: createApiary,
  createReward,
}
