// [SPEC-17.2] Development-only gallery of the ten characters of « Printemps du silence »: each one in
// the spring meadow, moved from one state to another with the keyboard. Not listed in production.
import thumbnail from '../printemps/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'printemps-galerie',
  title: 'Printemps : galerie des personnages',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
