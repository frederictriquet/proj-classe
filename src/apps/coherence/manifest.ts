// [SPEC-4.1] [SPEC-15.1] [SPEC-15.3] « Cohérence cardiaque »: a big bubble goes up while the class
// breathes in and down while it breathes out, then turns into a smiling face at the end of the
// exercise [SPEC-15.6]. No microphone, no sound.
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
    // [SPEC-15.3] [SPEC-15.6] At the end of this duration, the bubble turns into a smiling face.
    { type: 'slider', id: 'total', label: 'Durée de l’exercice', min: 1, max: 6, step: 0.5, default: 3, unit: 'min' },
  ],
}
