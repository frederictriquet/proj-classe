import { describe, expect, it, vi } from 'vitest'
import { ExplainedError } from '../errors'
import { CALIBRATION_MS, DEFAULT_AMBIENT_DBFS } from './level'
import { processingReport, processingWarning } from './processing'
import { isSimulationRequested, listenSimulationKeys, SimulatedSource } from './simulated-source'
import { MICROPHONE_KEY, type MicrophoneInfo } from './microphone-choice'
import { CALIBRATION_KEY, MICROPHONE_CHANGED_TEXT, noSignalText, SoundService, type CommonSettings, type FrameClock, type SoundReading } from './sound-service'
import type { LevelSource, OpenedSource } from './source'

/** Frame scheduler driven by the test, like requestAnimationFrame. */
class ManualClock implements FrameClock {
  private pending = new Map<number, (now: number) => void>()
  private next = 1
  time = 0
  request(callback: (now: number) => void): number {
    const handle = this.next++
    this.pending.set(handle, callback)
    return handle
  }
  cancel(handle: number): void {
    this.pending.delete(handle)
  }
  get scheduled(): number {
    return this.pending.size
  }
  /** Runs `count` frames of `ms` each. */
  frames(count: number, ms = 1000 / 60): void {
    for (let i = 0; i < count; i++) {
      this.time += ms
      const callbacks = [...this.pending.values()]
      this.pending.clear()
      for (const callback of callbacks) callback(this.time)
    }
  }
}

/** Source whose level is set by the test; counts opens and closes. */
class FakeSource implements LevelSource {
  readonly simulated = false
  db = -50
  opens = 0
  closes = 0
  failWith: Error | undefined
  warning: string | undefined
  device: string | undefined = 'Micro MacBook Air'
  lose: ((message: string) => void) | undefined
  /** [SPEC-6.8] Microphone asked at each opening. */
  openedWith: (MicrophoneInfo | null)[] = []
  microphones: MicrophoneInfo[] = []
  listFails: Error | undefined
  onMicrophonesChange: (() => void) | undefined
  /** When set, an opening waits for `finishOpen()`. */
  hold = false
  private pending: (() => void) | undefined
  open(onLost: (message: string) => void, microphone: MicrophoneInfo | null): Promise<OpenedSource> {
    this.opens++
    this.openedWith.push(microphone)
    const failWith = this.failWith
    const opened = (): OpenedSource => {
      this.lose = onLost
      return { read: () => this.db, warning: this.warning, device: microphone?.label ?? this.device, close: () => this.closes++ }
    }
    if (!this.hold) return failWith ? Promise.reject(failWith) : Promise.resolve(opened())
    return new Promise((resolve, reject) => {
      this.pending = () => (failWith ? reject(failWith) : resolve(opened()))
    })
  }
  finishOpen() {
    this.pending?.()
  }
  listMicrophones(): Promise<MicrophoneInfo[]> {
    return this.listFails ? Promise.reject(this.listFails) : Promise.resolve(this.microphones)
  }
  watchMicrophones(listener: () => void) {
    this.onMicrophonesChange = listener
  }
  get isOpen(): boolean {
    return this.opens - this.closes > 0 && this.failWith === undefined
  }
}

class MemoryCommon implements CommonSettings {
  readonly data = new Map<string, unknown>()
  readCommon(key: string) {
    return this.data.get(key)
  }
  writeCommon(key: string, value: unknown) {
    this.data.set(key, value)
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(options: { stored?: unknown; source?: LevelSource } = {}) {
  const source = options.source ?? new FakeSource()
  const clock = new ManualClock()
  const settings = new MemoryCommon()
  if (options.stored !== undefined) settings.data.set(CALIBRATION_KEY, options.stored)
  const problems: string[] = []
  const service = new SoundService({
    source,
    settings,
    clock,
    onProblem: (message) => problems.push(message),
    now: () => new Date('2026-11-14T09:30:00.000Z'),
  })
  const readings: SoundReading[] = []
  service.subscribeLevel((reading) => readings.push(reading))
  return { service, source, clock, settings, problems, readings }
}

describe('SoundService', () => {
  it('opens the source once for several leases and closes it after the last release [SPEC-6.7]', async () => {
    const { service, source, clock } = setup()
    const fake = source as FakeSource
    expect(service.status.phase).toBe('off')
    const a = await service.acquire()
    const b = await service.acquire()
    expect(fake.opens).toBe(1)
    expect(service.status.phase).toBe('on')
    a.release()
    a.release() // twice: no effect
    expect(fake.closes).toBe(0)
    b.release()
    expect(fake.closes).toBe(1)
    expect(service.status.phase).toBe('off')
    expect(clock.scheduled).toBe(0) // the frame loop stopped
  })

  it('publishes the smoothed level and the difference to the default ambient noise every frame [SPEC-6.4]', async () => {
    const { service, source, clock, readings } = setup()
    const fake = source as FakeSource
    fake.db = -60
    await service.acquire()
    clock.frames(1)
    expect(readings.at(-1)).toEqual({ rawDb: -60, levelDb: -60, ambientDb: DEFAULT_AMBIENT_DBFS, aboveAmbientDb: -60 - DEFAULT_AMBIENT_DBFS })
    fake.db = -30
    clock.frames(1)
    const afterOne = readings.at(-1)!
    // Smoothed: moving up, not there yet.
    expect(afterOne.rawDb).toBe(-30)
    expect(afterOne.levelDb).toBeGreaterThan(-60)
    expect(afterOne.levelDb).toBeLessThan(-30)
    clock.frames(30)
    expect(service.level.levelDb).toBeCloseTo(-30, 1)
    expect(service.level.aboveAmbientDb).toBeCloseTo(-30 - DEFAULT_AMBIENT_DBFS, 1)
    expect(service.level.ambientDb).toBe(DEFAULT_AMBIENT_DBFS)
  })

  it('measures the ambient noise for 3 seconds and keeps it in the common settings [SPEC-6.3]', async () => {
    const { service, source, clock, settings } = setup()
    const fake = source as FakeSource
    fake.db = -52
    const lease = await service.acquire()
    const done = service.calibrate()
    await settle()
    expect(service.status.calibrating).toBe(true)
    clock.frames(Math.floor(CALIBRATION_MS / (1000 / 60)) - 3)
    expect(service.status.calibrating).toBe(true) // not 3 s yet
    clock.frames(6)
    await done
    expect(service.status).toMatchObject({ calibrating: false, ambientDb: -52, calibratedAt: '2026-11-14T09:30:00.000Z', error: null })
    expect(settings.data.get(CALIBRATION_KEY)).toEqual({ ambientDb: -52, date: '2026-11-14T09:30:00.000Z' })
    clock.frames(5)
    expect(service.level.aboveAmbientDb).toBeCloseTo(0, 6)
    lease.release()
    expect(service.status.phase).toBe('off')
  })

  it('opens the source itself to calibrate when nobody holds it, and closes it after', async () => {
    const { service, source, clock } = setup()
    const fake = source as FakeSource
    const done = service.calibrate()
    await settle()
    expect(fake.isOpen).toBe(true)
    clock.frames(200)
    await done
    expect(fake.isOpen).toBe(false)
    expect(service.status.calibratedAt).not.toBeNull()
  })

  it('uses the stored calibration at start-up', () => {
    const { service } = setup({ stored: { ambientDb: -48, date: '2026-11-13T08:00:00.000Z' } })
    expect(service.status).toMatchObject({ ambientDb: -48, calibratedAt: '2026-11-13T08:00:00.000Z' })
    expect(service.level.ambientDb).toBe(-48)
  })

  it('reads the calibration again after the scene window calibrated [SPEC-5.6]', async () => {
    const { service, settings, clock, readings } = setup()
    const lease = await service.acquire()
    clock.frames(1)
    settings.data.set(CALIBRATION_KEY, { ambientDb: -55, date: '2026-11-14T10:00:00.000Z' })
    service.reloadCommonSettings()
    expect(service.status).toMatchObject({ ambientDb: -55, calibratedAt: '2026-11-14T10:00:00.000Z' })
    clock.frames(1)
    expect(readings.at(-1)).toMatchObject({ ambientDb: -55, aboveAmbientDb: -50 - -55 })
    lease.release()
  })

  it('reports an unreadable stored calibration and uses the default value', () => {
    const { service, problems } = setup({ stored: { ambientDb: 'loud' } })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/Recalibrez/)
    expect(service.status).toMatchObject({ ambientDb: DEFAULT_AMBIENT_DBFS, calibratedAt: null })
  })

  it('does not keep a calibration stuck at the floor and says why', async () => {
    const { service, source, clock, settings } = setup()
    ;(source as FakeSource).db = -100
    const done = service.calibrate()
    await settle()
    clock.frames(200)
    await done
    expect(service.status.calibrating).toBe(false)
    expect(service.status.error).toMatch(/Calibrage impossible.*aucun son/s)
    // [SPEC-6.6] The message is shown as is, without the technical error name.
    expect(service.status.error).not.toContain('Error :')
    expect(service.status.calibratedAt).toBeNull()
    expect(settings.data.has(CALIBRATION_KEY)).toBe(false)
  })

  it('rejects the lease with the French message when the source cannot open, and retries next time [SPEC-6.6]', async () => {
    const { service, source } = setup()
    const fake = source as FakeSource
    fake.failWith = new ExplainedError('Autorisation refusée. Autorisez le micro.')
    await expect(service.acquire()).rejects.toThrow('Autorisation refusée')
    expect(service.status).toMatchObject({ phase: 'off', error: 'Autorisation refusée. Autorisez le micro.' })
    fake.failWith = undefined
    const lease = await service.acquire()
    expect(fake.opens).toBe(2)
    expect(service.status).toMatchObject({ phase: 'on', error: null })
    lease.release()
    expect(fake.closes).toBe(1)
  })

  it('tells the lease holders when the microphone is lost, and stops measuring [SPEC-6.6]', async () => {
    const { service, source, clock } = setup()
    const fake = source as FakeSource
    const onLost = vi.fn()
    const lease = await service.acquire(onLost)
    clock.frames(2)
    fake.lose?.('Micro perdu en cours de route.')
    expect(onLost).toHaveBeenCalledWith('Micro perdu en cours de route.')
    expect(fake.closes).toBe(1)
    expect(service.status).toMatchObject({ phase: 'off', error: 'Micro perdu en cours de route.' })
    expect(clock.scheduled).toBe(0)
    lease.release()
    expect(fake.closes).toBe(1) // already closed
  })

  it('fails a calibration interrupted by the loss of the microphone', async () => {
    const { service, source, clock } = setup()
    const fake = source as FakeSource
    const done = service.calibrate()
    await settle()
    clock.frames(30)
    fake.lose?.('Micro perdu.')
    await done
    expect(service.status).toMatchObject({ calibrating: false, calibratedAt: null })
    expect(service.status.error).toBe('Calibrage impossible. Micro perdu.')
  })

  it('names the microphone the browser opened, while measuring only [SPEC-6.6]', async () => {
    const { service, source } = setup()
    ;(source as FakeSource).device = 'Hue Sync Audio'
    expect(service.status.device).toBeNull()
    const lease = await service.acquire()
    expect(service.status.device).toBe('Hue Sync Audio')
    lease.release()
    expect(service.status.device).toBeNull()
  })

  it('shows the warning of a source whose audio processing stayed on [SPEC-6.1]', async () => {
    const { service, source } = setup()
    ;(source as FakeSource).warning = 'autoGainControl : true'
    const lease = await service.acquire()
    expect(service.status.warning).toBe('autoGainControl : true')
    lease.release()
    expect(service.status.warning).toBeNull()
  })

  it('warns after 2 s of exact silence (microphone muted by macOS) and clears it when sound comes back [SPEC-6.6]', async () => {
    const { service, source, clock } = setup()
    const fake = source as FakeSource
    fake.device = 'Hue Sync Audio'
    fake.db = -100
    fake.warning = 'autoGainControl : true'
    await service.acquire()
    clock.frames(60) // 1 s
    expect(service.status.warning).toBe('autoGainControl : true')
    clock.frames(70)
    expect(service.status.warning).toBe(`autoGainControl : true\n${noSignalText('Hue Sync Audio')}`)
    fake.db = -70
    clock.frames(1)
    expect(service.status.warning).toBe('autoGainControl : true')
  })

  it('drives the simulated source through the same path [SPEC-6.5]', async () => {
    const simulated = new SimulatedSource()
    const { service, clock } = setup({ source: simulated })
    expect(service.status.simulated).toBe(true)
    await service.acquire()
    service.simulate(-40)
    clock.frames(60)
    expect(service.level.levelDb).toBeCloseTo(-40, 1)
    expect(service.level.aboveAmbientDb).toBeCloseTo(-40 - DEFAULT_AMBIENT_DBFS, 1)
  })

  it('refuses to set the level by hand with the real microphone', () => {
    const { service } = setup()
    expect(() => service.simulate(-40)).toThrow(/simulé/)
  })
})

describe('SimulatedSource [SPEC-6.5]', () => {
  it('is enabled by ?micro=simule only', () => {
    expect(isSimulationRequested('?micro=simule')).toBe(true)
    expect(isSimulationRequested('?foo=1&micro=simule')).toBe(true)
    expect(isSimulationRequested('')).toBe(false)
    expect(isSimulationRequested('?micro=vrai')).toBe(false)
  })

  it('starts at the default ambient noise and stays within the dBFS range', () => {
    const source = new SimulatedSource()
    expect(source.level).toBe(DEFAULT_AMBIENT_DBFS)
    source.setLevel(12)
    expect(source.level).toBe(0)
    source.setLevel(-300)
    expect(source.level).toBe(-100)
    expect(() => source.setLevel(Number.NaN)).toThrow()
  })

  it('is driven by the + and − keys, not by Cmd + or other keys', () => {
    const target = new EventTarget()
    const source = new SimulatedSource()
    const changes: number[] = []
    const stop = listenSimulationKeys(source, target as unknown as Window, (db) => changes.push(db))
    const press = (key: string, metaKey = false) => target.dispatchEvent(Object.assign(new Event('keydown'), { key, metaKey, ctrlKey: false, altKey: false }))
    press('+')
    press('=')
    expect(source.level).toBe(DEFAULT_AMBIENT_DBFS + 6)
    press('-')
    expect(source.level).toBe(DEFAULT_AMBIENT_DBFS + 3)
    press('+', true)
    press('Escape')
    press('ArrowUp')
    expect(source.level).toBe(DEFAULT_AMBIENT_DBFS + 3)
    // [SPEC-5.5] Each change is passed on, for the scene window.
    expect(changes).toEqual([DEFAULT_AMBIENT_DBFS + 3, DEFAULT_AMBIENT_DBFS + 6, DEFAULT_AMBIENT_DBFS + 3])
    stop()
    press('+')
    expect(source.level).toBe(DEFAULT_AMBIENT_DBFS + 3)
  })
})

describe('processingReport [SPEC-6.1]', () => {
  it('accepts only the three processings reported off', () => {
    const off = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    expect(processingReport(off).allOff).toBe(true)
    expect(processingWarning(off)).toBeUndefined()
    const agc = { ...off, autoGainControl: true }
    expect(processingWarning(agc)).toMatch(/autoGainControl : true/)
    expect(processingReport({ echoCancellation: false, autoGainControl: false }).lines).toContain('noiseSuppression : non signalé')
    expect(processingReport({ echoCancellation: false, autoGainControl: false }).allOff).toBe(false)
  })
})

describe('noSignalText [SPEC-6.6]', () => {
  it('names the silent microphone and points to the microphone menu of the panel [SPEC-6.8]', () => {
    const text = noSignalText('Hue Sync Audio')
    expect(text).toContain('« Hue Sync Audio »')
    expect(text).toContain('menu « Micro »')
  })

  it('reads without a name when the browser gives none', () => {
    expect(noSignalText(null)).toMatch(/^Le micro ne renvoie aucun son/)
  })
})

describe('SoundService, choice of the microphone [SPEC-6.8]', () => {
  const USB: MicrophoneInfo = { id: 'usb-1', label: 'Micro USB' }
  const BUILT_IN: MicrophoneInfo = { id: 'mac-1', label: 'Micro MacBook Air' }

  it('opens the chosen microphone and keeps the choice in the common settings', async () => {
    const { service, source, settings } = setup()
    const fake = source as FakeSource
    service.chooseMicrophone(USB)
    expect(fake.opens).toBe(0) // nothing held: nothing opened
    expect(settings.data.get(MICROPHONE_KEY)).toEqual(USB)
    expect(service.status.microphone).toEqual(USB)
    const lease = await service.acquire()
    expect(fake.openedWith).toEqual([USB])
    expect(service.status.device).toBe('Micro USB')
    lease.release()

    const again = setup({ stored: undefined })
    again.settings.data.set(MICROPHONE_KEY, USB)
    const reread = new SoundService({ source: new FakeSource(), settings: again.settings, onProblem: () => {}, clock: again.clock })
    expect(reread.status.microphone).toEqual(USB)
  })

  it('reopens an open microphone with the new choice and clears the calibration', async () => {
    const { service, source, settings } = setup({ stored: { ambientDb: -48, date: '2026-11-13T08:00:00.000Z' } })
    const fake = source as FakeSource
    const lease = await service.acquire()
    service.chooseMicrophone(USB)
    await settle()
    expect(fake.closes).toBe(1)
    expect(fake.openedWith).toEqual([null, USB])
    expect(service.status).toMatchObject({ phase: 'on', microphone: USB, calibratedAt: null, ambientDb: DEFAULT_AMBIENT_DBFS })
    expect(settings.data.get(CALIBRATION_KEY)).toBeUndefined()
    expect(service.level.ambientDb).toBe(DEFAULT_AMBIENT_DBFS)
    lease.release()
    expect(fake.closes).toBe(2)
  })

  it('interrupts a calibration when the microphone changes, and keeps saying so once reopened', async () => {
    const { service, source, clock, settings } = setup()
    const fake = source as FakeSource
    const panel = await service.acquire()
    const done = service.calibrate()
    await settle()
    clock.frames(30)
    fake.hold = true // the new microphone opens after the calibration has failed, as in Chrome
    service.chooseMicrophone(USB)
    await done
    fake.finishOpen()
    await settle()
    expect(service.status).toMatchObject({ phase: 'on', error: `Calibrage impossible. ${MICROPHONE_CHANGED_TEXT}` })
    expect(settings.data.get(CALIBRATION_KEY)).toBeUndefined()
    panel.release()
    expect(fake.isOpen).toBe(false)
  })

  it('closes a reopened microphone whose leases were given back while it opened [SPEC-6.7]', async () => {
    const { service, source } = setup()
    const fake = source as FakeSource
    const lease = await service.acquire()
    fake.hold = true
    service.chooseMicrophone(USB)
    lease.release()
    fake.finishOpen()
    await settle()
    expect(fake.opens).toBe(2)
    expect(fake.closes).toBe(2)
    expect(service.status.phase).toBe('off')
  })

  it('tells the lease holders when the new microphone cannot open, then opens at the next choice', async () => {
    const { service, source } = setup()
    const fake = source as FakeSource
    const onLost = vi.fn()
    const lease = await service.acquire(onLost)
    fake.failWith = new ExplainedError('Le micro choisi « Micro USB » est introuvable.')
    service.chooseMicrophone(USB)
    await settle()
    expect(onLost).toHaveBeenCalledWith('Le micro choisi « Micro USB » est introuvable.')
    expect(service.status).toMatchObject({ phase: 'off', error: 'Le micro choisi « Micro USB » est introuvable.' })
    fake.failWith = undefined
    service.chooseMicrophone(null) // the lease is still held: the panel stays open
    await settle()
    expect(service.status).toMatchObject({ phase: 'on', error: null, microphone: null })
    expect(fake.openedWith).toEqual([null, USB, null])
    lease.release()
  })

  it('opens the latest choice when it changed while the microphone was opening', async () => {
    const { service, source } = setup()
    const fake = source as FakeSource
    fake.hold = true
    const acquiring = service.acquire()
    service.chooseMicrophone(USB)
    fake.finishOpen() // the opening with Chrome's choice ends
    await settle()
    fake.finishOpen() // then the one with the USB microphone
    const lease = await acquiring
    expect(fake.openedWith).toEqual([null, USB])
    expect(fake.closes).toBe(1)
    expect(service.status).toMatchObject({ phase: 'on', device: 'Micro USB' })
    lease.release()
  })

  it('lists the microphones, again after an opening and when one is plugged', async () => {
    const fake = new FakeSource()
    fake.microphones = [BUILT_IN]
    const { service } = setup({ source: fake })
    await settle()
    expect(service.status.microphones).toEqual([BUILT_IN])
    fake.microphones = [BUILT_IN, USB]
    fake.onMicrophonesChange?.()
    await settle()
    expect(service.status.microphones).toEqual([BUILT_IN, USB])
    fake.listFails = new Error('enumerateDevices refusé')
    fake.onMicrophonesChange?.()
    await settle()
    expect(service.status.error).toBe('Liste des micros indisponible. Error : enumerateDevices refusé')
  })

  it('reports an unreadable stored microphone and uses the one Chrome picks', () => {
    const settings = new MemoryCommon()
    settings.data.set(MICROPHONE_KEY, 'Micro USB')
    const problems: string[] = []
    const service = new SoundService({ source: new FakeSource(), settings, onProblem: (m) => problems.push(m), clock: new ManualClock() })
    expect(service.status.microphone).toBeNull()
    expect(problems).toEqual([expect.stringContaining('Micro choisi enregistré illisible')])
  })

  it('reopens with the microphone the scene window chose [SPEC-5.6]', async () => {
    const { service, source, settings } = setup()
    const fake = source as FakeSource
    const lease = await service.acquire()
    service.reloadCommonSettings() // nothing changed: the microphone stays open
    expect(fake.opens).toBe(1)
    settings.data.set(MICROPHONE_KEY, USB)
    service.reloadCommonSettings()
    await settle()
    expect(fake.openedWith).toEqual([null, USB])
    expect(service.status.microphone).toEqual(USB)
    lease.release()
  })
})
