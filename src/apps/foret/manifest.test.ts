import { describe, expect, it } from 'vitest'
import { SETTING } from '../../silence/manifest'
import { manifest } from './manifest'

describe('card of « Forêt du silence » [SPEC-9.1] [SPEC-9.8]', () => {
  it('is an activity of silence with six animals', () => {
    expect(manifest).toMatchObject({ id: 'foret', title: 'Forêt du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.totalS)?.label).toBe('Durée de calme pour que les six animaux soient là')
  })
})
