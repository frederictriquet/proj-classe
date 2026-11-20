// [SPEC-17.2] [SPEC-8.5] Development gallery of the ten characters of « Printemps du silence » in the
// spring meadow (see src/silence/gallery.ts for the keys and the `window.__galerie` hook).
import { startGallery } from '../../silence/gallery'
import type { AnimalId } from '../printemps/animal-data'
import { PRINTEMPS } from '../printemps/world'
import type { AppFactory } from '../types'

const NAMES: Record<AnimalId, string> = {
  tulips: 'Tulipes',
  buds: 'Bourgeons',
  bee1: 'Abeille 1',
  nestlings: 'Oisillons',
  daffodils: 'Jonquilles',
  tit: 'Mésange',
  mole: 'Taupe',
  bee2: 'Abeille 2',
  swallow1: 'Hirondelle 1',
  swallow2: 'Hirondelle 2',
}

export const start: AppFactory = (context) => startGallery(context, PRINTEMPS, NAMES)
