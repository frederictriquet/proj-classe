import { describe, expect, it } from 'vitest'
import { DEFAULT_CALM_SETTINGS, fleeThresholdDb } from './calm'
import { manifest, SETTING } from './manifest'
import { thresholdMarks } from '../../menu/sound-section'
import { defaultValues } from '../../settings/settings'

describe('manifest of « Forêt du silence » [SPEC-9.6]', () => {
  it('declares the microphone need and the three settings with the defaults of the logic', () => {
    expect(manifest.needs).toEqual(['microphone'])
    const values = defaultValues(manifest.settings)
    expect(values).toEqual({
      [SETTING.alertDb]: DEFAULT_CALM_SETTINGS.alertDb,
      [SETTING.totalS]: DEFAULT_CALM_SETTINGS.totalS,
      [SETTING.toleranceS]: DEFAULT_CALM_SETTINGS.toleranceS,
    })
  })

  it('bounds the total duration from 30 s to 5 min and the tolerance from 0 to 2 s', () => {
    const slider = (id: string) => manifest.settings.find((s) => s.id === id)
    expect(slider(SETTING.totalS)).toMatchObject({ type: 'slider', min: 30, max: 300, unit: 's' })
    expect(slider(SETTING.toleranceS)).toMatchObject({ type: 'slider', min: 0, max: 2, unit: 's' })
    expect(slider(SETTING.alertDb)).toMatchObject({ type: 'slider', unit: 'dB' })
  })

  it('marks the alert and flight thresholds of the logic on the live level [SPEC-7.5]', () => {
    for (const alertDb of [2, 6, 13, 20]) {
      const marks = thresholdMarks(manifest.soundThresholds ?? [], { [SETTING.alertDb]: alertDb, totalS: 90, toleranceS: 0.5 }, -60)
      expect(marks.map((m) => m.aboveDb)).toEqual([alertDb, fleeThresholdDb(alertDb)])
      expect(marks.map((m) => m.db)).toEqual([-60 + alertDb, -60 + fleeThresholdDb(alertDb)])
    }
  })
})
