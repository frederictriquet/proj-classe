import { describe, expect, it } from 'vitest'
import { manifest as foret } from '../apps/foret/manifest'
import { ambientText, appThresholdsText, microphoneChoiceText } from './sound-report'

describe('sound values of the diagnostic page [SPEC-7.5] [SPEC-6.8]', () => {
  it('names the chosen microphone', () => {
    expect(microphoneChoiceText(null)).toBe('micro choisi par Chrome (aucun choix dans les réglages)')
    expect(microphoneChoiceText({ id: 'usb-1', label: 'Micro USB' })).toBe('« Micro USB »')
  })

  it('gives the ambient noise in dB, calibrated or default', () => {
    expect(ambientText(undefined)).toBe('-60 dB (valeur par défaut, pas encore calibré)')
    expect(ambientText({ ambientDb: -52.4, date: '2026-11-15T09:30:00.000Z' })).toMatch(/^-52 dB \(calibré le 15\/11\/2026/)
  })

  it('gives the thresholds of an app in dB above the ambient noise and in dBFS', () => {
    expect(appThresholdsText(foret, { alertDb: 6, totalS: 90, toleranceS: 0.5 }, -60)).toBe(
      'Forêt du silence\nAlerte : 6 dB au-dessus du bruit ambiant (-54 dB)\nFuite : 12 dB au-dessus du bruit ambiant (-48 dB)',
    )
  })
})
