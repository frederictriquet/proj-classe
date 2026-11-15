// [SPEC-12.2] Development-only gallery of the eight animals of « Ferme du silence »: each animal in
// the farmyard, moved from one state to another with the keyboard. Not listed in production.
import thumbnail from '../ferme/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'ferme-galerie',
  title: 'Ferme : galerie des animaux',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
