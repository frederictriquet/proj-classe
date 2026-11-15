// [SPEC-13] [SPEC-14.2] Development-only gallery of the twenty chicks of « Couvain du silence »:
// each chick in the incubator, moved from one state to another with the keyboard. Not listed in
// production.
import thumbnail from '../couvain/thumbnail.svg'
import type { AppManifest } from '../types'

export const manifest: AppManifest = {
  id: 'couvain-galerie',
  title: 'Couvain : galerie des animaux',
  thumbnail,
  needs: [],
  settings: [],
  devOnly: true,
}
