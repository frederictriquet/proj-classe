import { describe, expect, it } from 'vitest'
import { SETTING } from '../../silence/manifest'
import { manifest } from './manifest'

describe('card of « Ferme du silence » [SPEC-12.1] [SPEC-9.8]', () => {
  it('is an activity of silence with eight animals', () => {
    expect(manifest).toMatchObject({ id: 'ferme', title: 'Ferme du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.totalS)?.label).toBe('Durée de calme pour que les huit animaux soient là')
  })
})
