import { describe, expect, it, vi } from 'vitest'
import { ExplainedError } from '../errors'
import { CALIBRATION_MS, DEFAULT_AMBIENT_DBFS } from './level'
import { processingReport, processingWarning } from './processing'
import { isSimulationRequested, listenSimulationKeys, SimulatedSource } from './simulated-source'
import { CALIBRATION_KEY, SoundService, type CommonSettings, type FrameClock, type SoundReading } from './sound-service'
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
  lose: ((message: string) => void) | undefined
  open(onLost: (message: string) => void): Promise<OpenedSource> {
    this.opens++
    if (this.failWith) return Promise.reject(this.failWith)
    this.lose = onLost
    return Promise.resolve({ read: () => this.db, warning: this.warning, close: () => this.closes++ })
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
    expect(service.status.error).toMatch(/Calibrage impossible.*Micro perdu/s)
  })

  it('shows the warning of a source whose audio processing stayed on [SPEC-6.1]', async () => {
    const { service, source } = setup()
    ;(source as FakeSource).warning = 'autoGainControl : true'
    const lease = await service.acquire()
    expect(service.status.warning).toBe('autoGainControl : true')
    lease.release()
    expect(service.status.warning).toBeNull()
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
    const stop = listenSimulationKeys(source, target as unknown as Window)
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
