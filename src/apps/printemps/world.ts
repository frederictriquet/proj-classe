// [SPEC-9.8] [SPEC-17] « Printemps du silence » as the shared code of the activities of silence sees
// it: the eleven characters of the spring meadow, their rigs, the meadow, the reward and the colours
// of the palette.
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createLandscape, type Landscape } from './landscape'
import { PALETTE } from './palette'
import { createReward } from './reward-art'

export const PRINTEMPS: SilenceWorld<AnimalId, Landscape> = {
  probe: 'printemps',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.sky,
  // [SPEC-9.7] Cream level; yellow and red marks, edged with ink.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.yellow, flee: PALETTE.red },
  createDecor: createLandscape,
  createReward,
}
