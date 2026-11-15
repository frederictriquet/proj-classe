// [SPEC-9.5] [SPEC-8.5] [SPEC-9.8] When the reward of an activity of silence shows and how fast it
// fades. Each activity draws its own reward (fireflies in the forest). Free of PixiJS.
//
// Reading of the spec, fixed by reward.test.ts: a short alert (under the tolerance) freezes the
// animals but does not end the reward; the first flight does.
import type { AnimalState } from './animal'
import type { CalmOutput, CalmTarget } from './calm'

/** What the shared loop needs of the reward an activity draws. */
export interface RewardView {
  /** Advances by `dt` seconds; the reward fades in while `active`, out otherwise. */
  update(dt: number, active: boolean): void
  /** 0: nothing shows; 1: full reward. */
  readonly level: number
}

export const REWARD_FADE = {
  /** Seconds for the reward to appear fully: it comes slowly. */
  inS: 5,
  /** Seconds for it to go at the first flight. */
  outS: 1.2,
} as const

/**
 * [SPEC-9.5] Whether the reward shows after this frame. It starts when the logic calls all the
 * animals out in the calm and all of them are settled on screen (the last one settles a few
 * seconds after its call). It ends at the first fright, when the logic sends the animals back in.
 * `states` are the states on screen of all the animals of the activity.
 */
export function rewardActive<Id extends string>(wasActive: boolean, output: CalmOutput<Id>, states: readonly AnimalState[]): boolean {
  const targets: CalmTarget[] = Object.values(output.targets)
  if (wasActive) return !targets.some((target) => target === 'hidden')
  return output.allSettled && states.length === targets.length && states.every((state) => state === 'settled')
}

/** Moves the reward level (0 none, 1 full) towards `active` for `dt` seconds. */
export function fadeLevel(level: number, active: boolean, dt: number): number {
  const step = Math.max(dt, 0) / (active ? REWARD_FADE.inS : REWARD_FADE.outS)
  return active ? Math.min(1, level + step) : Math.max(0, level - step)
}
