// [SPEC-4.1] [SPEC-12.1] « Ferme du silence »: animals come out when the class is quiet and hide
// at the noise. The farm makes no sound; it listens to the microphone. Its card and settings are
// those of every activity of silence [SPEC-9.8].
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({ id: 'ferme', title: 'Ferme du silence', thumbnail, animalCount: 'huit' })
