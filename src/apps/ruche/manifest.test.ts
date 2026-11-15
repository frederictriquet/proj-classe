import { describe, expect, it } from 'vitest'
import { SETTING } from '../../silence/manifest'
import { manifest } from './manifest'

describe('card of « Ruche du silence » [SPEC-13.1] [SPEC-13.1.1] [SPEC-9.8]', () => {
  it('is an activity of silence with its own duration sentence', () => {
    expect(manifest).toMatchObject({ id: 'ruche', title: 'Ruche du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.totalS)?.label).toBe('Durée de calme pour que les abeilles et les papillons soient là')
  })
})
