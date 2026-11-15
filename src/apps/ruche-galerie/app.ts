// [SPEC-13.2] [SPEC-8.5] Development gallery of the animals of « Ruche du silence » in the apiary
// (see src/silence/gallery.ts for the keys and the `window.__galerie` hook).
import { startGallery } from '../../silence/gallery'
import { ANIMAL_IDS, isBee, type AnimalId } from '../ruche/animal-data'
import { RUCHE } from '../ruche/world'
import type { AppFactory } from '../types'

const NAMES = Object.fromEntries(
  ANIMAL_IDS.map((id) => [id, isBee(id) ? `Abeille ${id.slice(3)}` : `Papillon ${id.slice(9)}`]),
) as Record<AnimalId, string>

export const start: AppFactory = (context) => startGallery(context, RUCHE, NAMES)
