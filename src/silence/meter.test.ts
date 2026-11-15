import { describe, expect, it } from 'vitest'
import { DEFAULT_CALM_SETTINGS, fleeThresholdDb } from './calm'
import { SETTING, silenceManifest } from './manifest'
import { METER, meterFraction, meterMarks } from './meter'

const manifest = silenceManifest({ id: 'essai', title: 'Essai', thumbnail: 'essai.svg', animalCount: 'huit' })

describe('meterFraction [SPEC-9.7]', () => {
  it('places the scale from 6 dB below the ambient noise to 90 dB above', () => {
    expect(meterFraction(-6)).toBe(0)
    expect(meterFraction(90)).toBe(1)
    expect(meterFraction(42)).toBeCloseTo(0.5)
  })

  it('stays inside the bar for a level off the scale', () => {
    expect(meterFraction(-100)).toBe(0) // microphone at the floor
    expect(meterFraction(120)).toBe(1) // above the top of the scale
  })
})

describe('meterMarks [SPEC-9.7] [SPEC-9.6]', () => {
  it('marks the default alert (6 dB) and flight (12 dB) thresholds', () => {
    const marks = meterMarks(DEFAULT_CALM_SETTINGS.alertDb)
    expect(marks.alert).toBeCloseTo(12 / 96)
    expect(marks.flee).toBeCloseTo(18 / 96)
  })

  it('keeps both marks inside the bar, apart, over the whole sensitivity slider', () => {
    const slider = manifest.settings.find((s) => s.id === SETTING.alertDb)
    if (slider?.type !== 'slider') throw new Error('sensitivity slider missing')
    for (const alertDb of [slider.min, slider.default, slider.max]) {
      const { alert, flee } = meterMarks(alertDb)
      expect(alert).toBeGreaterThan(0)
      expect(flee).toBeLessThan(1)
      expect(flee).toBeGreaterThan(alert)
    }
    expect(METER.maxDb).toBeGreaterThan(fleeThresholdDb(slider.max))
  })
})
