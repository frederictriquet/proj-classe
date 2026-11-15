// [SPEC-4.1] [SPEC-15.1] [SPEC-15.3] « Cohérence cardiaque »: a big bubble goes up while the class
// breathes in and down while it breathes out. No microphone, no sound.
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = {
  id: 'coherence',
  title: 'Cohérence cardiaque',
  thumbnail,
  needs: [],
  settings: [
    { type: 'slider', id: 'inhale', label: 'Durée de l’inspiration', min: 2, max: 8, step: 0.5, default: 5, unit: 's' },
    { type: 'slider', id: 'exhale', label: 'Durée de l’expiration', min: 2, max: 8, step: 0.5, default: 5, unit: 's' },
  ],
}
