import { describe, expect, it } from 'vitest'
import { DEFAULT_CALM_SETTINGS } from '../../silence/calm'
import { SETTING } from '../../silence/manifest'
import { defaultValues } from '../../settings/settings'
import { manifest } from './manifest'

describe('card of « Ruche du silence » [SPEC-13.1] [SPEC-13.1.1] [SPEC-9.8]', () => {
  it('is an activity of silence with its own initial-delay sentence', () => {
    expect(manifest).toMatchObject({ id: 'ruche', title: 'Ruche du silence', needs: ['microphone'] })
    expect(manifest.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant la première abeille')
  })

  it('declares the four shared settings with their defaults [SPEC-9.6]', () => {
    expect(manifest.settings.map((s) => s.id)).toEqual([SETTING.alertDb, SETTING.firstS, SETTING.intervalS, SETTING.toleranceS])
    expect(defaultValues(manifest.settings)).toEqual({
      [SETTING.alertDb]: DEFAULT_CALM_SETTINGS.alertDb,
      [SETTING.firstS]: DEFAULT_CALM_SETTINGS.firstS,
      [SETTING.intervalS]: DEFAULT_CALM_SETTINGS.intervalS,
      [SETTING.toleranceS]: DEFAULT_CALM_SETTINGS.toleranceS,
    })
  })

  it('shows both thresholds and the three zones on the live level, zones keeping « les animaux » [SPEC-7.5] [SPEC-13.1.1]', () => {
    expect(manifest.soundThresholds).toEqual([
      { label: 'Alerte', setting: SETTING.alertDb },
      { label: 'Fuite', setting: SETTING.alertDb, offsetDb: 6 },
    ])
    expect(manifest.soundZones).toEqual([
      'Calme : les animaux sortent',
      'Alerte : les animaux se figent, puis fuient si ça dure',
      'Trop de bruit : les animaux fuient',
    ])
  })
})
