// [SPEC-4.1] [SPEC-13.1] [SPEC-13.1.1] « Ruche du silence »: bees and butterflies come out when
// the class is quiet and hide at the noise. The hive makes no sound; it listens to the microphone.
// Its card and settings are those of every activity of silence [SPEC-9.8], with its own sentence
// for the initial delay.
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({
  id: 'ruche',
  title: 'Ruche du silence',
  thumbnail,
  firstAnimal: 'la première abeille',
})
