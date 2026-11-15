// [SPEC-9.8] [SPEC-12] « Ferme du silence » as the shared code of the activities of silence sees
// it: the eight animals of the farmyard, their rigs, the farmyard, the rainbow and the colours of
// the palette.
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createFarmyard, type Farmyard } from './farmyard'
import { PALETTE } from './palette'
import { createReward } from './reward-art'

export const FERME: SilenceWorld<AnimalId, Farmyard> = {
  probe: 'ferme',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.sky,
  // [SPEC-9.7] Cream level; straw and red marks, edged with ink.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.straw, flee: PALETTE.red },
  createDecor: createFarmyard,
  createReward,
}
