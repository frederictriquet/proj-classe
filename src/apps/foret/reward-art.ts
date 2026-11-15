// [SPEC-9.5] [SPEC-8.1] [SPEC-8.3.2] [SPEC-8.5] The reward drawn with PixiJS: fireflies of the
// palette's `sun` colour with a `cream` heart, drifting over the meadow in front of the animals and
// behind the foreground, and a warm light over the whole clearing: the palette's `orange`, added
// with transparency, which brightens and warms every colour without hiding any. Only positions
// and transparency change.
import { Container, Graphics } from 'pixi.js'
import { PALETTE } from '../../art/palette'
import type { Clearing } from './clearing'
import { DECOR_BOUNDS } from './layout'
import { createFireflies, fadeLevel, fireflyAlpha, fireflyPosition, REWARD } from './reward'

export interface RewardView {
  /** Advances by `dt` seconds; the reward fades in while `active`, out otherwise. */
  update(dt: number, active: boolean): void
  /** 0: nothing shows; 1: full reward. */
  readonly level: number
}

/** Adds the reward to the clearing, invisible until it is active. */
export function createReward(clearing: Clearing): RewardView {
  const fireflies = createFireflies()
  const layer = new Container({ label: 'reward' })
  const sprites = fireflies.map(() => {
    const node = new Graphics()
      .circle(0, 0, REWARD.haloRadius)
      .fill({ color: PALETTE.sun, alpha: REWARD.haloAlpha })
      .circle(0, 0, REWARD.bodyRadius)
      .fill(PALETTE.sun)
      .circle(0, 0, REWARD.heartRadius)
      .fill(PALETTE.cream)
    layer.addChild(node)
    return node
  })
  // In front of the animals and the light rays, behind the foreground.
  clearing.root.addChildAt(layer, clearing.root.getChildIndex(clearing.light) + 1)

  // [SPEC-8.6] Over the whole decor, so that it covers any screen shape.
  const warm = new Graphics({ label: 'warm-light' })
    .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, DECOR_BOUNDS.height)
    .fill(PALETTE.orange)
  warm.blendMode = 'add'
  clearing.root.addChild(warm)

  let level = 0
  let time = 0
  const show = () => {
    layer.visible = level > 0
    warm.visible = level > 0
    if (level === 0) return
    warm.alpha = REWARD.warmAlpha * level
    fireflies.forEach((firefly, i) => {
      const node = sprites[i]!
      const { x, y } = fireflyPosition(firefly, time)
      node.position.set(x, y)
      node.alpha = fireflyAlpha(firefly, time, level)
    })
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
