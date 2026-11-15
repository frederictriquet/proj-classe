// [SPEC-9.4] [SPEC-9.4.5] Calm and fear logic of « Forêt du silence ». A pure module: no PixiJS,
// no microphone, no clock. Each step receives the difference to the ambient noise in dB, as the
// sound-level service exposes it [SPEC-6.4], the time elapsed and the settings [SPEC-9.6]. It
// gives the zone, the calm gauge and the target of each of the six animals, to pass to
// `Animal.setTarget` (animals.ts). The animal model (animal-model.ts) turns a target into
// movement: `settled` makes a hidden animal peek, wait, come out and settle; `alert` freezes an
// animal that is out; `hidden` makes an animal that is out run back to its hideout.
//
// Two readings of the spec, fixed by calm.test.ts:
// - A fright (noise, or an alert longer than the tolerance) resets the gauge even when no animal
//   is out yet [SPEC-9.4.4]. Otherwise noise before the first animal would cost nothing.
// - An animal called out stays out until a fright. A change of settings never sends it back in
//   without noise; lowering the total duration calls out at once every animal whose new time
//   is already passed.
import { ANIMAL_IDS, type AnimalId, type AnimalState } from './animal-data'

/** [SPEC-9.4.1] Seconds of calm before the first animal comes out. */
export const FIRST_OUT_S = 5
/** [SPEC-9.4.4] Seconds of uninterrupted calm after a fright before the gauge rises again. */
export const RECOVERY_S = 2
/** [SPEC-9.6] The flight threshold is this many dB above the alert threshold. */
export const FLEE_MARGIN_DB = 6

/** [SPEC-9.6] Settings, read at every step: a change applies at once [SPEC-7.2]. */
export interface CalmSettings {
  /** Alert threshold, in dB above the ambient noise (the sensitivity). */
  alertDb: number
  /** Seconds of calm for all six animals to be there. */
  totalS: number
  /** Longest alert, in seconds, that does not make the animals flee. */
  toleranceS: number
}

/** [SPEC-9.6] Starting values, to be adjusted in class. */
export const DEFAULT_CALM_SETTINGS: Readonly<CalmSettings> = { alertDb: 6, totalS: 90, toleranceS: 0.5 }

/** [SPEC-9.4] Calm: under the alert threshold. Alert: between the two thresholds. Noise: above
 *  the flight threshold. */
export type Zone = 'calm' | 'alert' | 'noise'

/** What the logic asks of an animal (see the header). */
export type CalmTarget = Extract<AnimalState, 'hidden' | 'settled' | 'alert'>

export interface CalmOutput {
  zone: Zone
  /** [SPEC-9.4.1] Seconds of calm counted since the start or the last fright, at most the total
   *  duration. */
  gauge: number
  targets: Readonly<Record<AnimalId, CalmTarget>>
  /** [SPEC-9.5] The six animals are called out and the class is calm: the reward may show. The
   *  last animal gets its target at the total duration; it is settled on screen a few seconds
   *  later (peeking pause, then the walk to its place). */
  allSettled: boolean
}

/** [SPEC-9.6] Flight threshold, in dB above the ambient noise. */
export function fleeThresholdDb(alertDb: number): number {
  return alertDb + FLEE_MARGIN_DB
}

/** [SPEC-9.4] Zone of a level given in dB above the ambient noise. */
export function zoneOf(aboveAmbientDb: number, alertDb: number): Zone {
  if (aboveAmbientDb < alertDb) return 'calm'
  if (aboveAmbientDb > fleeThresholdDb(alertDb)) return 'noise'
  return 'alert'
}

/** [SPEC-9.4.1] Gauge value, in seconds of calm, at which each animal comes out, in the order of
 *  `ANIMAL_IDS`: the first after `FIRST_OUT_S`, the last at `totalS`, evenly spaced. */
export function comeOutTimes(totalS: number): number[] {
  const last = Math.max(totalS, FIRST_OUT_S)
  const gaps = ANIMAL_IDS.length - 1
  return ANIMAL_IDS.map((_, i) => FIRST_OUT_S + ((last - FIRST_OUT_S) * i) / gaps)
}

export class CalmLogic {
  private gauge = 0
  /** Animals called out since the last fright: the first `out` of `ANIMAL_IDS`. */
  private out = 0
  /** Seconds the current alert has lasted. */
  private alertS = 0
  /** Seconds of calm still needed before the gauge rises again; 0 when not recovering. */
  private recoveryLeft = 0

  /** Advances by `dt` seconds with the level `aboveAmbientDb` (dB above the ambient noise). */
  step(aboveAmbientDb: number, dt: number, settings: CalmSettings): CalmOutput {
    const elapsed = dt > 0 ? dt : 0
    const zone = zoneOf(aboveAmbientDb, settings.alertDb)
    switch (zone) {
      case 'calm':
        this.calm(elapsed, settings.totalS)
        break
      case 'alert':
        // [SPEC-9.4.2] The gauge stops; an alert longer than the tolerance is a fright.
        this.alertS += elapsed
        if (this.recoveryLeft > 0) this.recoveryLeft = RECOVERY_S
        if (this.alertS > settings.toleranceS) this.fright()
        break
      case 'noise':
        // [SPEC-9.4.3] Immediate flight.
        this.fright()
        break
    }
    return this.output(zone)
  }

  /** [SPEC-9.4.1] [SPEC-9.4.4] The gauge rises, after the recovery that follows a fright. */
  private calm(elapsed: number, totalS: number): void {
    this.alertS = 0
    let rise = elapsed
    if (this.recoveryLeft > 0) {
      const used = Math.min(this.recoveryLeft, rise)
      this.recoveryLeft -= used
      rise -= used
    }
    const times = comeOutTimes(totalS)
    this.gauge = Math.min(this.gauge + rise, times[times.length - 1]!)
    while (this.out < times.length && this.gauge >= times[this.out]!) this.out++
  }

  /** [SPEC-9.4.2] [SPEC-9.4.3] [SPEC-9.4.4] Every animal out flees; the gauge restarts from zero
   *  after `RECOVERY_S` of calm. */
  private fright(): void {
    this.gauge = 0
    this.out = 0
    this.alertS = 0
    this.recoveryLeft = RECOVERY_S
  }

  private output(zone: Zone): CalmOutput {
    const outTarget: CalmTarget = zone === 'alert' ? 'alert' : 'settled'
    const targets = {} as Record<AnimalId, CalmTarget>
    ANIMAL_IDS.forEach((id, i) => {
      targets[id] = i < this.out ? outTarget : 'hidden'
    })
    return {
      zone,
      gauge: this.gauge,
      targets,
      allSettled: zone === 'calm' && this.out === ANIMAL_IDS.length,
    }
  }
}
