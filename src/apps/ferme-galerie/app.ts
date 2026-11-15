// [SPEC-12.2] [SPEC-8.5] Development gallery of the eight animals of « Ferme du silence » in the
// farmyard (see src/silence/gallery.ts for the keys and the `window.__galerie` hook).
import { startGallery } from '../../silence/gallery'
import type { AnimalId } from '../ferme/animal-data'
import { FERME } from '../ferme/world'
import type { AppFactory } from '../types'

const NAMES: Record<AnimalId, string> = {
  hen: 'Poule',
  horse: 'Cheval',
  rabbit: 'Lapin',
  sheep: 'Mouton',
  pig: 'Cochon',
  cow: 'Vache',
  duck: 'Canard',
  goat: 'Chèvre',
}

export const start: AppFactory = (context) => startGallery(context, FERME, NAMES)
