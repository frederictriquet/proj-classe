// [SPEC-16.2] Development-only gallery of the ten characters of « Hiver du silence »: each one in
// the winter landscape, moved from one state to another with the keyboard. Not listed in
// production.
import thumbnail from '../hiver/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'hiver-galerie',
  title: 'Hiver : galerie des personnages',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
