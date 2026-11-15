// [SPEC-13.2] Development-only gallery of the fifteen bees and the two butterflies of « Ruche du
// silence »: each animal in the apiary, moved from one state to another with the keyboard. Not
// listed in production.
import thumbnail from '../ruche/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'ruche-galerie',
  title: 'Ruche : galerie des animaux',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
