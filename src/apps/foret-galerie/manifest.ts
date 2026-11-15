// [SPEC-9.3] Development-only gallery of the six animals of « Forêt du silence »: each animal in
// the clearing, moved from one state to another with the keyboard. Not listed in production.
import thumbnail from '../foret/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'foret-galerie',
  title: 'Forêt : galerie des animaux',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
