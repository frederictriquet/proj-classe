// [SPEC-4.1] [SPEC-16.1] « Hiver du silence »: the characters come out when the class is quiet and
// hide at the noise. The activity makes no sound; it listens to the microphone. Its card and
// settings are those of every activity of silence [SPEC-9.8].
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({ id: 'hiver', title: 'Hiver du silence', thumbnail, firstAnimal: 'le lapin' })
