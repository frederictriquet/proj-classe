// [SPEC-12.4] [SPEC-8.5] [SPEC-8.3.2] Reward of « Ferme du silence », drawn with PixiJS: once the
// eight animals are settled, a rainbow rises slowly over the hills, behind the buildings, and a
// warm light, the palette's straw added with transparency, brightens the whole farmyard. It plays
// no sound [SPEC-12.1]. When it shows and how fast it fades are shared (src/silence/reward.ts).
// Only position and transparency change.
import { Container, Graphics } from 'pixi.js'
import { fadeLevel, type RewardView } from '../../silence/reward'
import type { Farmyard } from './farmyard'
import { DECOR_BOUNDS, RAINBOW } from './layout'
import { PALETTE } from './palette'

export const REWARD = {
  /** Bands from the outside in: palette colours only [SPEC-8.3.2]. */
  bands: [PALETTE.red, PALETTE.straw, PALETTE.grass, PALETTE.blue],
  /** Opacity of the rainbow at full reward: a little see-through, like light. */
  alpha: 0.88,
  /** World units the rainbow rises while it appears, from behind the hills. */
  rise: 140,
  /** Opacity of the warm light over the whole farmyard, at full reward. */
  warmAlpha: 0.1,
} as const

/** Adds the reward to the farmyard, invisible until it is active. */
export function createReward(farmyard: Farmyard): RewardView {
  const { x, y, inner, band } = RAINBOW
  const rainbow = new Container({ label: 'reward' })
  const arcs = new Graphics()
  REWARD.bands.forEach((color, i) => {
    const outer = inner + (REWARD.bands.length - i) * band
    const r = outer - band
    arcs
      .moveTo(x - outer, y)
      .arc(x, y, outer, Math.PI, 2 * Math.PI)
      .lineTo(x + r, y)
      .arc(x, y, r, 2 * Math.PI, Math.PI, true)
      .closePath()
      .fill(color)
  })
  rainbow.addChild(arcs)
  // Over the sky, behind the hills that hide its feet.
  farmyard.root.addChildAt(rainbow, farmyard.root.getChildIndex(farmyard.planes.hills))

  // [SPEC-8.6] Over the whole decor, so that it covers any screen shape.
  const warm = new Graphics({ label: 'warm-light' })
    .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, DECOR_BOUNDS.height)
    .fill(PALETTE.straw)
  warm.blendMode = 'add'
  farmyard.root.addChild(warm)

  let level = 0
  const show = () => {
    rainbow.visible = level > 0
    warm.visible = level > 0
    if (level === 0) return
    rainbow.alpha = REWARD.alpha * level
    rainbow.y = REWARD.rise * (1 - level)
    warm.alpha = REWARD.warmAlpha * level
  }
  show()

  return {
    get level() {
      return level
    },
    update(dt, active) {
      level = fadeLevel(level, active, dt)
      show()
    },
  }
}
