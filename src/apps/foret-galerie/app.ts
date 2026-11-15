// [SPEC-9.3] [SPEC-8.5] Development gallery of the six animals of « Forêt du silence » in the
// clearing (see src/silence/gallery.ts for the keys and the `window.__galerie` hook).
import { startGallery } from '../../silence/gallery'
import type { AnimalId } from '../foret/animal-data'
import { FORET } from '../foret/world'
import type { AppFactory } from '../types'

const NAMES: Record<AnimalId, string> = {
  squirrel: 'Écureuil',
  rabbit: 'Lapin',
  hedgehog: 'Hérisson',
  owl: 'Chouette',
  fox: 'Renard',
  fawn: 'Faon',
}

export const start: AppFactory = (context) => startGallery(context, FORET, NAMES)
