import { describe, expect, it } from 'vitest'
import { SETTING } from '../../silence/manifest'
import { manifest } from './manifest'

describe('card of « Hiver du silence » [SPEC-16.1] [SPEC-9.8]', () => {
  it('is an activity of silence whose first character is the rabbit', () => {
    expect(manifest).toMatchObject({ id: 'hiver', title: 'Hiver du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant le lapin')
  })
})
