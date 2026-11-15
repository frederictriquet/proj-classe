// [SPEC-4.1] [SPEC-9.1] « Forêt du silence »: animals come out when the class is quiet and hide
// at the noise. The forest makes no sound; it listens to the microphone. Its card and settings are
// those of every activity of silence [SPEC-9.8].
import { silenceManifest } from '../../silence/manifest'
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = silenceManifest({ id: 'foret', title: 'Forêt du silence', thumbnail, firstAnimal: 'l’écureuil' })
