// [SPEC-13.2] [SPEC-13.2.4] [SPEC-8.5] Development gallery of the animals of « Ruche du silence » in
// the apiary (see src/silence/gallery.ts for the keys and the `window.__galerie` hook). The way the
// bees beat their wings is chosen here: `?ailes=ample` (default) or `?ailes=vibrent` in the address.
import { startGallery } from '../../silence/gallery'
import { ANIMAL_IDS, BEE_WINGS, DEFAULT_BEE_WINGS, isBee, type AnimalId, type BeeWingStyle } from '../ruche/animal-data'
import { rucheWorld } from '../ruche/world'
import type { AppFactory } from '../types'

const NAMES = Object.fromEntries(
  ANIMAL_IDS.map((id) => [id, isBee(id) ? `Abeille ${id.slice(3)}` : `Papillon ${id.slice(9)}`]),
) as Record<AnimalId, string>

function wingStyle(): BeeWingStyle {
  const asked = new URLSearchParams(window.location.search).get('ailes')
  if (asked === null) return DEFAULT_BEE_WINGS
  if (!(asked in BEE_WINGS)) throw new Error(`Ailes « ${asked} » inconnues : ${Object.keys(BEE_WINGS).join(' ou ')}`)
  return asked as BeeWingStyle
}

export const start: AppFactory = (context) => startGallery(context, rucheWorld(wingStyle()), NAMES)
