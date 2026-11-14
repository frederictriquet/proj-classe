// [SPEC-4.1] [SPEC-6.4] Development-only demo used to check the sub-application contract and the
// sound-level service: it declares the `microphone` need.
import type { AppManifest } from '../types'
import thumbnail from './thumbnail.svg'

export const manifest: AppManifest = {
  id: 'demo',
  title: 'Démonstration',
  thumbnail,
  needs: ['microphone'],
  settings: [
    { type: 'slider', id: 'speed', label: 'Vitesse', min: 0, max: 3, step: 0.1, default: 1, unit: '×' },
    { type: 'toggle', id: 'big', label: 'Grande forme', default: false },
  ],
  devOnly: true,
}
