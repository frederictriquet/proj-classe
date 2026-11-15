// [SPEC-8.5] [SPEC-13] [SPEC-14.2] Development gallery of the twenty chicks of « Couvain du
// silence » in the incubator (see src/silence/gallery.ts for the keys and the `window.__galerie`
// hook).
import { startGallery } from '../../silence/gallery'
import { ANIMAL_IDS, type AnimalId } from '../couvain/animal-data'
import { COUVAIN } from '../couvain/world'
import type { AppFactory } from '../types'

const NAMES = Object.fromEntries(
  ANIMAL_IDS.map((id, i) => [id, `Poussin ${i + 1}`]),
) as Record<AnimalId, string>

export const start: AppFactory = (context) => startGallery(context, COUVAIN, NAMES)
