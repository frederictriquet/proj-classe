import { describe, expect, it } from 'vitest'
import type { AppManifest } from '../apps/types'
import type { SoundStatus } from '../audio/sound-service'
import { hostState } from '../host/testing'
import {
  calibrationText,
  CHROME_CHOICE,
  DEFAULT_GAUGE_SCALE,
  gaugePercent,
  gaugeScale,
  gaugeSlider,
  levelBadge,
  microphoneOptions,
  zoneIndex,
} from './sound-section'

const status = (partial: Partial<SoundStatus> = {}): SoundStatus => ({ ...hostState().sound, ...partial })

const SLIDER = { type: 'slider', id: 'alertDb', label: 'Sensibilité', min: 2, max: 80, step: 1, default: 6, unit: 'dB' } as const
const MIC_APP: AppManifest = {
  id: 'a',
  title: 'A',
  thumbnail: 'a.svg',
  needs: ['microphone'],
  settings: [{ type: 'toggle', id: 'big', label: 'Grand', default: false }, SLIDER],
  soundThresholds: [
    { label: 'Alerte', setting: 'alertDb' },
    { label: 'Fuite', setting: 'alertDb', offsetDb: 6 },
  ],
  soundZones: ['calme', 'alerte', 'bruit'],
}

describe('gauge of the settings panel [SPEC-7.5]', () => {
  it('takes the scale of the slider that sets the thresholds', () => {
    expect(gaugeSlider(MIC_APP)).toBe(SLIDER)
    expect(gaugeScale(SLIDER)).toEqual({ minDb: 2, maxDb: 80 })
  })

  it('goes from the ambient noise to 60 dB above it for an app without thresholds', () => {
    const demo: AppManifest = { ...MIC_APP, soundThresholds: undefined, soundZones: undefined }
    expect(gaugeSlider(demo)).toBeUndefined()
    expect(gaugeScale(undefined)).toEqual(DEFAULT_GAUGE_SCALE)
    expect(DEFAULT_GAUGE_SCALE).toEqual({ minDb: 0, maxDb: 60 })
  })

  it('places the slider bounds at the ends of the bar, and keeps any level inside it', () => {
    const scale = gaugeScale(SLIDER)
    expect(gaugePercent(2, scale)).toBe(0)
    expect(gaugePercent(80, scale)).toBe(100)
    expect(gaugePercent(41, scale)).toBe(50)
    expect(gaugePercent(-40, scale)).toBe(0) // quieter than at calibration
    expect(gaugePercent(86, scale)).toBe(100) // flight mark of the highest setting
  })
})

describe('zone of the level [SPEC-7.5]', () => {
  it('counts a level on the first threshold above it, on the next ones below them', () => {
    const thresholds = [6, 12]
    expect(zoneIndex(5.9, thresholds)).toBe(0)
    expect(zoneIndex(6, thresholds)).toBe(1)
    expect(zoneIndex(12, thresholds)).toBe(1)
    expect(zoneIndex(12.1, thresholds)).toBe(2)
    expect(zoneIndex(50, [])).toBe(0)
  })

  it('names the zone while measuring, the phase of the microphone otherwise', () => {
    const zones = MIC_APP.soundZones ?? []
    expect(levelBadge('on', zones, 0, [6, 12])).toEqual({ text: 'calme', kind: 'calm' })
    expect(levelBadge('on', zones, 8, [6, 12])).toEqual({ text: 'alerte', kind: 'alert' })
    expect(levelBadge('on', zones, 20, [6, 12])).toEqual({ text: 'bruit', kind: 'noise' })
    expect(levelBadge('off', zones, 20, [6, 12])).toEqual({ text: 'Micro fermé', kind: 'off' })
    expect(levelBadge('opening', zones, 20, [6, 12])).toEqual({ text: 'Ouverture du micro…', kind: 'off' })
    expect(levelBadge('on', [], 20, [])).toBeUndefined() // no zone declared: no badge
  })
})

describe('calibration of the settings panel [SPEC-6.3] [SPEC-7.5]', () => {
  it('says whether and when the room was calibrated, without a value in dB', () => {
    expect(calibrationText(status())).toBe('Pas encore calibré : le bruit ambiant par défaut est utilisé.')
    expect(calibrationText(status({ calibrating: true }))).toBe('Calibrage en cours : silence pendant 3 secondes…')
    const done = calibrationText(status({ calibratedAt: '2026-11-15T09:30:00.000Z' }))
    expect(done).toMatch(/^Calibré le 15\/11\/2026/)
    expect(done).not.toMatch(/dB/)
  })
})

describe('microphone menu [SPEC-6.8]', () => {
  const USB = { id: 'usb-1', label: 'Micro USB' }
  const BUILT_IN = { id: 'mac-1', label: 'Micro MacBook Air' }

  it("offers Chrome's choice first, named after the microphone it opened", () => {
    const { options, selected } = microphoneOptions(status({ microphones: [BUILT_IN, USB], device: 'Hue Sync Audio' }))
    expect(options).toEqual([
      { value: CHROME_CHOICE, text: 'Micro choisi par Chrome (Hue Sync Audio)' },
      { value: 'mac-1', text: 'Micro MacBook Air' },
      { value: 'usb-1', text: 'Micro USB' },
    ])
    expect(selected).toBe(CHROME_CHOICE)
  })

  it('selects the chosen microphone, and keeps it listed when unplugged', () => {
    expect(microphoneOptions(status({ microphones: [BUILT_IN, USB], microphone: USB, device: 'Micro USB' }))).toMatchObject({
      selected: 'usb-1',
      options: [{ text: 'Micro choisi par Chrome' }, { text: 'Micro MacBook Air' }, { text: 'Micro USB' }],
    })
    const unplugged = microphoneOptions(status({ microphones: [BUILT_IN], microphone: USB }))
    expect(unplugged.selected).toBe('usb-1')
    expect(unplugged.options.at(-1)).toEqual({ value: 'usb-1', text: 'Micro USB (débranché)' })
  })
})
