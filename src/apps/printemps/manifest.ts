// [SPEC-4.1] [SPEC-17.1] « Printemps du silence »: the characters come out and the flowers open when
// the class is quiet; they hide and close at the noise. The activity makes no sound; it listens to
// the microphone. Its card and settings are those of every activity of silence [SPEC-9.8].
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({ id: 'printemps', title: 'Printemps du silence', thumbnail, firstAnimal: 'les tulipes' })
