import { describe, expect, it } from 'vitest'
import { DEFAULT_CALM_SETTINGS, fleeThresholdDb, zoneOf, type Zone } from './calm'
import { SETTING, silenceManifest } from './manifest'
import { thresholdMarks, zoneIndex } from '../menu/sound-section'
import { defaultValues } from '../settings/settings'

const manifest = silenceManifest({ id: 'essai', title: 'Essai', thumbnail: 'essai.svg', animalCount: 'huit' })

describe('card of an activity of silence [SPEC-9.6] [SPEC-9.8]', () => {
  it('declares the microphone need and the three settings with the defaults of the logic', () => {
    expect(manifest.needs).toEqual(['microphone'])
    const values = defaultValues(manifest.settings)
    expect(values).toEqual({
      [SETTING.alertDb]: DEFAULT_CALM_SETTINGS.alertDb,
      [SETTING.totalS]: DEFAULT_CALM_SETTINGS.totalS,
      [SETTING.toleranceS]: DEFAULT_CALM_SETTINGS.toleranceS,
    })
  })

  it('names the number of animals of the activity in the label of the total duration', () => {
    const slider = manifest.settings.find((s) => s.id === SETTING.totalS)
    expect(slider?.label).toBe('Durée de calme pour que les huit animaux soient là')
  })

  it('takes the sentence of the activity for the total duration when it gives one [SPEC-13.1.1]', () => {
    const label = 'Durée de calme pour que les abeilles et les papillons soient là'
    const own = silenceManifest({ id: 'essai', title: 'Essai', thumbnail: 'essai.svg', durationLabel: label })
    expect(own.settings.find((s) => s.id === SETTING.totalS)?.label).toBe(label)
    // [SPEC-9.6] The zones keep « les animaux ».
    expect(own.soundZones).toEqual(manifest.soundZones)
  })

  it('bounds the sensitivity from 2 to 80 dB, the total duration from 30 s to 5 min and the tolerance from 0 to 2 s', () => {
    const slider = (id: string) => manifest.settings.find((s) => s.id === id)
    expect(slider(SETTING.totalS)).toMatchObject({ type: 'slider', min: 30, max: 300, unit: 's' })
    expect(slider(SETTING.toleranceS)).toMatchObject({ type: 'slider', min: 0, max: 2, unit: 's' })
    // 80 dB: the slider never stops the adult from tolerating more noise.
    expect(slider(SETTING.alertDb)).toMatchObject({ type: 'slider', min: 2, max: 80, unit: 'dB' })
  })

  it('marks the alert and flight thresholds of the logic on the live level [SPEC-7.5]', () => {
    for (const alertDb of [2, 6, 13, 20, 80]) {
      const marks = thresholdMarks(manifest.soundThresholds ?? [], { [SETTING.alertDb]: alertDb, totalS: 90, toleranceS: 0.5 }, -60)
      expect(marks.map((m) => m.aboveDb)).toEqual([alertDb, fleeThresholdDb(alertDb)])
      expect(marks.map((m) => m.db)).toEqual([-60 + alertDb, -60 + fleeThresholdDb(alertDb)])
    }
  })

  it('names in the panel the zone of the calm logic, bounds included [SPEC-7.5] [SPEC-9.4]', () => {
    const order: Zone[] = ['calm', 'alert', 'noise']
    expect(manifest.soundZones).toHaveLength(3)
    for (const alertDb of [2, 6, 80]) {
      const marks = thresholdMarks(manifest.soundThresholds ?? [], { [SETTING.alertDb]: alertDb, totalS: 90, toleranceS: 0.5 }, -60)
      const thresholds = marks.map((m) => m.aboveDb)
      // Every half decibel from below the ambient noise to past the flight mark, both marks included.
      for (let above = -10; above <= fleeThresholdDb(alertDb) + 10; above += 0.5) {
        expect(zoneIndex(above, thresholds), `${above} dB with alert at ${alertDb}`).toBe(order.indexOf(zoneOf(above, alertDb)))
      }
    }
  })
})
