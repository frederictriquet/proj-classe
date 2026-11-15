import { describe, expect, it } from 'vitest'
import { ExplainedError } from '../errors'
import { micErrorText } from './mic-errors'
import { microphonesFrom, parseMicrophoneChoice } from './microphone-choice'
import { RAW_AUDIO_CONSTRAINTS, rawAudioConstraints } from './processing'

const device = (kind: MediaDeviceKind, deviceId: string, label: string) => ({ kind, deviceId, label })

describe('microphonesFrom [SPEC-6.8]', () => {
  it("keeps the real microphones, without Chrome's pseudo-devices nor the outputs", () => {
    const devices = [
      device('audioinput', 'default', 'Par défaut - Micro MacBook Air (Built-in)'),
      device('audioinput', 'communications', 'Communications - Micro MacBook Air'),
      device('audioinput', 'mac-1', 'Micro MacBook Air (Built-in)'),
      device('audioinput', 'hue-1', 'Hue Sync Audio (Virtual)'),
      device('audiooutput', 'out-1', 'Haut-parleurs MacBook Air'),
      device('videoinput', 'cam-1', 'Caméra FaceTime HD'),
    ]
    expect(microphonesFrom(devices)).toEqual([
      { id: 'mac-1', label: 'Micro MacBook Air (Built-in)' },
      { id: 'hue-1', label: 'Hue Sync Audio (Virtual)' },
    ])
  })

  it('leaves out the entries Chrome gives before the microphone permission', () => {
    expect(microphonesFrom([device('audioinput', '', '')])).toEqual([])
    expect(microphonesFrom([device('audioinput', 'x', '')])).toEqual([{ id: 'x', label: 'Micro sans nom' }])
  })
})

describe('parseMicrophoneChoice [SPEC-6.8] [SPEC-7.1]', () => {
  it("reads a stored microphone, and Chrome's choice when there is none", () => {
    expect(parseMicrophoneChoice({ id: 'usb-1', label: 'Micro USB' })).toEqual({ id: 'usb-1', label: 'Micro USB' })
    expect(parseMicrophoneChoice(undefined)).toBeNull()
    expect(parseMicrophoneChoice(null)).toBeNull()
  })

  it('rejects an unreadable value with what to do', () => {
    for (const stored of ['usb-1', 3, { id: '', label: 'x' }, { id: 'usb-1' }]) {
      expect(() => parseMicrophoneChoice(stored)).toThrow(ExplainedError)
      expect(() => parseMicrophoneChoice(stored)).toThrow(/Choisissez le micro dans les réglages/)
    }
  })
})

describe('rawAudioConstraints [SPEC-6.1] [SPEC-6.8]', () => {
  it('asks for the raw signal, from the chosen microphone only', () => {
    expect(rawAudioConstraints(null)).toEqual(RAW_AUDIO_CONSTRAINTS)
    expect(rawAudioConstraints({ id: 'usb-1', label: 'Micro USB' })).toEqual({ ...RAW_AUDIO_CONSTRAINTS, deviceId: { exact: 'usb-1' } })
  })
})

describe('micErrorText [SPEC-6.6] [SPEC-6.8]', () => {
  const USB = { id: 'usb-1', label: 'Micro USB' }

  it('names the chosen microphone when Chrome cannot find it, whatever the error class', () => {
    // Depending on the Chrome version, OverconstrainedError is not a DOMException.
    const overconstrained = { name: 'OverconstrainedError', constraint: 'deviceId', message: '' }
    expect(micErrorText(overconstrained, USB)).toMatch(/^Le micro choisi « Micro USB » est introuvable/)
    expect(micErrorText(new DOMException('Requested device not found', 'NotFoundError'), USB)).toMatch(/« Micro USB » est introuvable/)
  })

  it("keeps the general advice for Chrome's choice", () => {
    expect(micErrorText(new DOMException('Requested device not found', 'NotFoundError'))).toMatch(/^Aucun micro trouvé/)
    expect(micErrorText(new DOMException('Permission denied', 'NotAllowedError'), USB)).toMatch(/^Autorisation refusée/)
  })
})
