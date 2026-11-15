// [SPEC-9] [SPEC-9.7] [SPEC-9.8] [SPEC-13] [SPEC-14] « Couvain du silence » as the shared code of
// the activities of silence sees it: the twenty chicks in come-out order [SPEC-9.4.1] [SPEC-14.2],
// their rigs [SPEC-9.3], the incubator decor [SPEC-14.3], the mother-hen reward [SPEC-9.5]
// [SPEC-14.4], and the colours of the mini sound meter from the brood palette [SPEC-8.3.2]
// [SPEC-9.7] [SPEC-14.5].
import type { SilenceWorld } from '../../silence/world'
import { RIGS } from './animal-art'
import { ANIMAL_IDS, ANIMALS, type AnimalId } from './animal-data'
import { createIncubator, type Incubator } from './incubator'
import { PALETTE } from './palette'
import { createReward } from './reward-art'

export const COUVAIN: SilenceWorld<AnimalId, Incubator> = {
  probe: 'couvain',
  animals: ANIMAL_IDS.map((id) => ANIMALS[id]),
  rigs: RIGS,
  paper: PALETTE,
  background: PALETTE.slate,
  // [SPEC-9.7] [SPEC-8.3.2] Cream level; yellow alert mark and red flight mark, edged with ink.
  meter: { ink: PALETTE.ink, level: PALETTE.cream, alert: PALETTE.yellow, flee: PALETTE.red },
  createDecor: createIncubator,
  createReward,
}
