import { describe, expect, it } from 'vitest'
import { DEFAULT_CALM_SETTINGS, fleeThresholdDb, zoneOf, type Zone } from './calm'
import { SETTING, silenceManifest } from './manifest'
import { thresholdMarks, zoneIndex } from '../menu/sound-section'
import { defaultValues, resolveValues } from '../settings/settings'

const manifest = silenceManifest({ id: 'essai', title: 'Essai', thumbnail: 'essai.svg', firstAnimal: 'le premier animal' })

describe('card of an activity of silence [SPEC-9.6] [SPEC-9.8]', () => {
  it('declares the microphone need and the four settings with the defaults of the logic', () => {
    expect(manifest.needs).toEqual(['microphone'])
    const values = defaultValues(manifest.settings)
    expect(values).toEqual({
      [SETTING.alertDb]: DEFAULT_CALM_SETTINGS.alertDb,
      [SETTING.firstS]: DEFAULT_CALM_SETTINGS.firstS,
      [SETTING.intervalS]: DEFAULT_CALM_SETTINGS.intervalS,
      [SETTING.toleranceS]: DEFAULT_CALM_SETTINGS.toleranceS,
    })
  })

  it('separates the initial delay from the interval between animals', () => {
    expect(manifest.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant le premier animal')
    expect(manifest.settings.find((s) => s.id === SETTING.intervalS)?.label).toBe('Délai de calme entre deux animaux')
  })

  it('names the first animal of the activity in the initial-delay label [SPEC-13.1.1] [SPEC-14.1.1]', () => {
    const hive = silenceManifest({ id: 'essai', title: 'Essai', thumbnail: 'essai.svg', firstAnimal: 'la première abeille' })
    expect(hive.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant la première abeille')
    const brood = silenceManifest({ id: 'couvain', title: 'Couvain du silence', thumbnail: 'couvain.svg', firstAnimal: 'le premier poussin' })
    expect(brood.settings.find((s) => s.id === SETTING.firstS)?.label).toBe('Délai de calme avant le premier poussin')
    expect(brood.settings.find((s) => s.id === SETTING.intervalS)?.label).toBe('Délai de calme entre deux animaux')
    // [SPEC-9.6] [SPEC-14.1.1] The sensitivity and the zones keep « les animaux ».
    expect(brood.soundZones).toEqual(manifest.soundZones)
  })

  it('preserves a saved 300 s duration as the initial delay and defaults the new interval', () => {
    const { values, problems } = resolveValues(manifest.settings, { alertDb: 8, totalS: 300, toleranceS: 1 })
    expect(values).toEqual({ [SETTING.alertDb]: 8, [SETTING.firstS]: 300, [SETTING.intervalS]: 30, [SETTING.toleranceS]: 1 })
    expect(problems).toEqual([])
    expect(resolveValues(manifest.settings, { ...values, [SETTING.intervalS]: 60 }).values[SETTING.intervalS]).toBe(60)
  })

  it('bounds both delays from 5 s to 5 min, sensitivity from 2 to 80 dB and tolerance from 0 to 2 s', () => {
    const slider = (id: string) => manifest.settings.find((s) => s.id === id)
    expect(slider(SETTING.firstS)).toMatchObject({ type: 'slider', min: 5, max: 300, step: 5, unit: 's' })
    expect(slider(SETTING.intervalS)).toMatchObject({ type: 'slider', min: 5, max: 300, step: 5, unit: 's' })
    expect(slider(SETTING.toleranceS)).toMatchObject({ type: 'slider', min: 0, max: 2, unit: 's' })
    // 80 dB: the slider never stops the adult from tolerating more noise.
    expect(slider(SETTING.alertDb)).toMatchObject({ type: 'slider', min: 2, max: 80, unit: 'dB' })
  })

  it('marks the alert and flight thresholds of the logic on the live level [SPEC-7.5]', () => {
    for (const alertDb of [2, 6, 13, 20, 80]) {
      const marks = thresholdMarks(manifest.soundThresholds ?? [], { ...defaultValues(manifest.settings), [SETTING.alertDb]: alertDb }, -60)
      expect(marks.map((m) => m.aboveDb)).toEqual([alertDb, fleeThresholdDb(alertDb)])
      expect(marks.map((m) => m.db)).toEqual([-60 + alertDb, -60 + fleeThresholdDb(alertDb)])
    }
  })

  it('names in the panel the zone of the calm logic, bounds included [SPEC-7.5] [SPEC-9.4]', () => {
    const order: Zone[] = ['calm', 'alert', 'noise']
    expect(manifest.soundZones).toHaveLength(3)
    for (const alertDb of [2, 6, 80]) {
      const marks = thresholdMarks(manifest.soundThresholds ?? [], { ...defaultValues(manifest.settings), [SETTING.alertDb]: alertDb }, -60)
      const thresholds = marks.map((m) => m.aboveDb)
      // Every half decibel from below the ambient noise to past the flight mark, both marks included.
      for (let above = -10; above <= fleeThresholdDb(alertDb) + 10; above += 0.5) {
        expect(zoneIndex(above, thresholds), `${above} dB with alert at ${alertDb}`).toBe(order.indexOf(zoneOf(above, alertDb)))
      }
    }
  })
})
