// [SPEC-16.4] [SPEC-8.5] [SPEC-8.3.2] Reward of « Hiver du silence », drawn with PixiJS: once the eleven
// characters are settled, the bulbs of the garland light up one by one, with a steady light, the
// star lights up at the top of the Christmas tree, the windows of the house light up and big flakes
// fall slowly. It plays no sound [SPEC-16.1]. When it shows and how fast it fades are shared
// (src/silence/reward.ts). Only position and transparency change: nothing blinks.
import { Container, Graphics } from 'pixi.js'
import { fadeLevel, type RewardView } from '../../silence/reward'
import { createFlakes } from './ambient'
import type { Landscape } from './landscape'
import { starPath } from './landscape'
import { BULBS, HOUSE, STAR } from './layout'
import { PALETTE } from './palette'

export const REWARD = {
  /** Share of the fade-in the last bulb waits before lighting: they light up one by one. */
  bulbSpread: 0.6,
  /** Radius of a lit bulb and of its halo, world units. */
  bulb: 9,
  halo: 22,
  haloAlpha: 0.35,
  /** Big flakes: how many and their radius. */
  flakes: 26,
  flakeRadius: [7, 10] as const,
  /** World units per second: slow. */
  flakeSpeed: 30,
  /** Opacity of the warm light over the whole landscape, at full reward. */
  warmAlpha: 0.06,
} as const

/** [SPEC-16.4] How lit the bulb `i` of `count` is with the reward at `level` (0 to 1): each one
 *  waits its turn, then lights up over the rest of the fade-in. Steady once lit. */
export function bulbLevel(i: number, count: number, level: number): number {
  const delay = (REWARD.bulbSpread * i) / Math.max(1, count - 1)
  return Math.min(1, Math.max(0, (level - delay) / (1 - REWARD.bulbSpread)))
}

/** Adds the reward to the landscape, invisible until it is active. */
export function createReward(landscape: Landscape): RewardView {
  const reward = new Container({ label: 'reward' })
  const middle = landscape.planes.middle
  // In the middle plane, over the Christmas tree and the house, behind the characters.
  middle.addChild(reward)

  const bulbs = BULBS.map((b) => {
    const node = new Container()
    node.addChild(new Graphics().circle(b.x, b.y, REWARD.halo).fill({ color: PALETTE.yellow, alpha: REWARD.haloAlpha }))
    node.addChild(new Graphics().circle(b.x, b.y, REWARD.bulb).fill(PALETTE.yellow))
    reward.addChild(node)
    return node
  })
  const star = new Container()
  star.addChild(new Graphics().circle(STAR.x, STAR.y, STAR.radius * 1.7).fill({ color: PALETTE.yellow, alpha: 0.3 }))
  star.addChild(starPath(STAR.x, STAR.y, STAR.radius)(new Graphics()).fill(PALETTE.yellow))
  reward.addChild(star)

  // The windows, over their dark panes: the cross of the window stays.
  const { window: w, attic } = HOUSE
  const halfW = w.width / 2 - 4
  const halfH = w.height / 2 - 4
  const windows = new Graphics()
    .rect(w.x, w.y, halfW, halfH)
    .rect(w.x + halfW + 8, w.y, halfW, halfH)
    .rect(w.x, w.y + halfH + 8, halfW, halfH)
    .rect(w.x + halfW + 8, w.y + halfH + 8, halfW, halfH)
    .circle(attic.x, attic.y, attic.radius)
    .fill(PALETTE.yellow)
  landscape.planes.back.addChild(windows)

  // Big flakes, in front of everything.
  const flakes = createFlakes(REWARD.flakes, { x: 0, y: 0, width: 1440, height: 1080 }, REWARD.flakeRadius, 41).map((flake) => {
    const node = new Graphics().circle(0, 0, flake.radius).fill(PALETTE.cream)
    landscape.air.addChild(node)
    return { flake, node }
  })

  const warm = new Graphics({ label: 'warm-light' }).rect(-1500, -900, 4440, 2880).fill(PALETTE.yellow)
  warm.blendMode = 'add'
  landscape.root.addChild(warm)

  let level = 0
  let time = 0
  const show = () => {
    const on = level > 0
    reward.visible = on
    windows.visible = on
    warm.visible = on
    for (const { node } of flakes) node.visible = on
    if (!on) return
    bulbs.forEach((node, i) => (node.alpha = bulbLevel(i, bulbs.length, level)))
    star.alpha = level
    windows.alpha = level
    warm.alpha = REWARD.warmAlpha * level
    const view = landscape.visible
    for (const { flake, node } of flakes) {
      const span = view.height + 40
      const y = view.y - 20 + ((((flake.y + REWARD.flakeSpeed * time - view.y + 20) % span) + span) % span)
      const x = view.x + (flake.x / 1440) * view.width + 22 * Math.sin(2 * Math.PI * (time / flake.swayPeriod + flake.phase))
      node.position.set(x, y)
      node.alpha = 0.9 * level
    }
  }
  show()

  return {
    get level() {
      return level
    },
    update(dt, active) {
      time += dt
      level = fadeLevel(level, active, dt)
      show()
    },
  }
}
