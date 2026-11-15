// [SPEC-9.8] « Forêt du silence » as the shared code of the activities of silence sees it: the six
// animals of the clearing, their rigs, the clearing, the fireflies and the colours of the palette.
import { PALETTE } from './palette'
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createClearing, type Clearing } from './clearing'
import { createReward } from './reward-art'

export const FORET: SilenceWorld<AnimalId, Clearing> = {
  probe: 'foret',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.sky,
  // [SPEC-9.7] Cream level; sun and orange marks, edged with ink: sun alone hardly shows on the grass.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.sun, flee: PALETTE.orange },
  createDecor: createClearing,
  createReward,
}
