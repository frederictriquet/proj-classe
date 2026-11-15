// [SPEC-8.5] [SPEC-8.6] [SPEC-9.1] [SPEC-9.5] [SPEC-9.8] [SPEC-13] [SPEC-14.4]
// Reward of « Couvain du silence »: once all twenty chicks are settled, the mother hen gently
// passes her head and neck over the top wooden rim of the brooder crate to watch over her brood,
// the halos of the heat lamps widen and warm up, and soft down feathers float slowly in the air
// for as long as the calm lasts. It plays no sound [SPEC-9.1] [SPEC-14.1].
//
// Free of PixiJS: how the mother hen rises and sways, how the lamp halos widen, and how the down
// feathers drift and rock. When the reward shows and how fast it fades are shared
// (src/silence/reward.ts, [SPEC-9.8]); reward-art.ts draws it.
import type { Rect } from '../../silence/geometry'
import { seededRandom } from '../../silence/random'
import { MOTHER_HEN } from './layout'

export const REWARD = {
  /** Opacity of the warm light over the whole incubator, at full reward. */
  warmAlpha: 0.11,
  /** World units the mother hen rises from behind the crate rim while the reward fades in. */
  henRise: 48,
  /** Slow gentle side-to-side head sway of the mother hen watching her brood (radians and seconds). */
  henSway: { amplitude: 0.085, period: 7.5 },
  /** Gentle breathing bob of the mother hen (world units and seconds). */
  henBob: { amplitude: 3, period: 5.5 },
  /** Periodic soft eye blink of the mother hen (seconds per cycle and blink duration). */
  henBlink: { period: 6.4, duration: 0.18 },
  /** Extra horizontal scale added to the heat lamp halos and floor pools at full reward. */
  haloExpand: 0.42,
  /** Number of down feathers floating slowly in the air of the incubator. */
  feathers: 10,
  /** Safe-zone area where the down feathers drift, world units [SPEC-8.6]. */
  area: { x: 170, y: 260, width: 1100, height: 620 } satisfies Rect,
  /** Slow drift of a down feather around its anchor: amplitude (world units) and seconds per cycle [SPEC-8.5]. */
  drift: { amplitude: [34, 74], period: [9, 15] },
  /** Slow rocking tilt of a floating feather: amplitude (radians) and seconds per cycle [SPEC-8.5]. */
  sway: { amplitude: [0.18, 0.34], period: [6, 11] },
  /** Share of the fade-in a feather waits before showing, at most: they appear one by one. */
  maxDelay: 0.55,
} as const

export interface DownFeather {
  /** Centre of its drift, world units. */
  x: number
  y: number
  ax: number
  ay: number
  px: number
  py: number
  phaseX: number
  phaseY: number
  swayAmp: number
  swayPeriod: number
  swayPhase: number
  scale: number
  /** Share of the reward level it waits before showing, 0 to `maxDelay`. */
  delay: number
}

export interface HenPose {
  x: number
  y: number
  headRotation: number
  blink: boolean
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const between = (rand: () => number, [min, max]: readonly [number, number]): number =>
  min + rand() * (max - min)

/** The floating down feathers, spread across columns of `REWARD.area` with their drift kept inside it. */
export function createFeathers(seed = 14): DownFeather[] {
  const rand = seededRandom(seed)
  const { area, drift, sway } = REWARD
  return Array.from({ length: REWARD.feathers }, (_, i) => {
    const ax = between(rand, drift.amplitude)
    const ay = between(rand, drift.amplitude) * 0.65
    const column = area.width / REWARD.feathers
    const x = Math.min(Math.max(area.x + column * (i + rand()), area.x + ax), area.x + area.width - ax)
    const y = area.y + ay + rand() * (area.height - 2 * ay)
    return {
      x,
      y,
      ax,
      ay,
      px: between(rand, drift.period),
      py: between(rand, drift.period),
      phaseX: rand(),
      phaseY: rand(),
      swayAmp: between(rand, sway.amplitude),
      swayPeriod: between(rand, sway.period),
      swayPhase: rand(),
      scale: 0.88 + rand() * 0.26,
      delay: rand() * REWARD.maxDelay,
    }
  })
}

/** Position and rocking angle of a down feather at time `t` (seconds). */
export function featherPose(f: DownFeather, t: number): { x: number; y: number; rotation: number } {
  return {
    x: f.x + f.ax * Math.sin(2 * Math.PI * (t / f.px + f.phaseX)),
    y: f.y + f.ay * Math.sin(2 * Math.PI * (t / f.py + f.phaseY)),
    rotation: f.swayAmp * Math.sin(2 * Math.PI * (t / f.swayPeriod + f.swayPhase)),
  }
}

/** Opacity of a down feather with the reward at `level`: it fades in once `level` passes its delay. */
export function featherAlpha(f: DownFeather, level: number): number {
  return clamp01((level - f.delay) / (1 - f.delay))
}

/** Scale factor (`>= 1`) by which the heat lamp halos widen at reward `level` [SPEC-14.4]. */
export function haloScale(level: number): number {
  return 1 + REWARD.haloExpand * clamp01(level)
}

/** Pose of the mother hen watching over her brood at time `t` (seconds) and reward `level`. */
export function henPose(t: number, level: number): HenPose {
  const l = clamp01(level)
  const bob = REWARD.henBob.amplitude * Math.sin((2 * Math.PI * t) / REWARD.henBob.period) * l
  const headRotation = REWARD.henSway.amplitude * Math.sin((2 * Math.PI * t) / REWARD.henSway.period)
  const blinkPhase = ((t % REWARD.henBlink.period) + REWARD.henBlink.period) % REWARD.henBlink.period
  return {
    x: MOTHER_HEN.x,
    y: MOTHER_HEN.rimY + REWARD.henRise * (1 - l) + bob,
    headRotation,
    blink: blinkPhase < REWARD.henBlink.duration,
  }
}
