// [SPEC-4.1] [SPEC-14.1] [SPEC-14.1.1] « Couvain du silence »: twenty chicks hatch and come out
// when the class is quiet and hide back in their egg at the noise. The brood makes no sound; it
// listens to the microphone. Its card and settings are those of every activity of silence
// [SPEC-9.8], with « le premier poussin » for the initial delay.
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({
  id: 'couvain',
  title: 'Couvain du silence',
  thumbnail,
  firstAnimal: 'le premier poussin',
})
