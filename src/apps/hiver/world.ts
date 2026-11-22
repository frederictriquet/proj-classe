// [SPEC-9.8] [SPEC-16] « Hiver du silence » as the shared code of the activities of silence sees it:
// the eleven characters of the winter landscape, their rigs, the landscape, the reward and the colours
// of the palette.
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createLandscape, type Landscape } from './landscape'
import { PALETTE } from './palette'
import { createReward } from './reward-art'

export const HIVER: SilenceWorld<AnimalId, Landscape> = {
  probe: 'hiver',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.sky,
  // [SPEC-9.7] Cream level; yellow and red marks, edged with ink.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.yellow, flee: PALETTE.red },
  createDecor: createLandscape,
  createReward,
}
