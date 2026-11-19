// [SPEC-16.2] [SPEC-8.5] Development gallery of the ten characters of « Hiver du silence » in the
// winter landscape (see src/silence/gallery.ts for the keys and the `window.__galerie` hook).
import { startGallery } from '../../silence/gallery'
import type { AnimalId } from '../hiver/animal-data'
import { HIVER } from '../hiver/world'
import type { AppFactory } from '../types'

const NAMES: Record<AnimalId, string> = {
  rabbit: 'Lapin blanc',
  squirrel: 'Écureuil',
  redFox: 'Renard roux',
  whiteFox: 'Renard blanc',
  snowman: 'Bonhomme de neige',
  robin: 'Rouge-gorge',
  elf: 'Lutin',
  reindeer: 'Renne',
  owl: 'Harfang',
  santa: 'Père Noël',
}

export const start: AppFactory = (context) => startGallery(context, HIVER, NAMES)
