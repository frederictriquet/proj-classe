import { describe, expect, it } from 'vitest'
import { SETTING } from '../../silence/manifest'
import { manifest } from './manifest'

describe('card of « Printemps du silence » [SPEC-17.1] [SPEC-9.8]', () => {
  it('is an activity of silence whose first character is the tulips', () => {
    expect(manifest).toMatchObject({ id: 'printemps', title: 'Printemps du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant les tulipes')
  })
})
