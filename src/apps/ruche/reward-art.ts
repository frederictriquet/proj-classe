// [SPEC-13.4] [SPEC-8.5] [SPEC-8.3.2] Reward of « Ruche du silence », drawn with PixiJS: once the
// seventeen animals are settled, honey rises in the empty cells of the comb one by one, a trickle
// of honey runs from the bottom of the frame into the pot, and a warm light, the palette's honey
// added with transparency, warms the whole apiary. Palette colours only. It plays no sound
// [SPEC-13.1]. When it shows and how fast it fades are shared (src/silence/reward.ts, [SPEC-9.8]);
// reward.ts says when each cell fills.
import { Container, Graphics } from 'pixi.js'
import { fadeLevel, type RewardView } from '../../silence/reward'
import type { Apiary } from './apiary'
import { CELL_INNER_RADIUS, DECOR_BOUNDS, DRIP } from './layout'
import { PALETTE } from './palette'
import { cellFill, EMPTY_CELLS, honeyIn, REWARD, rewardClock, trickleLength } from './reward'

/** Adds the reward to the apiary, invisible until it is active. */
export function createReward(apiary: Apiary): RewardView {
  const r = CELL_INNER_RADIUS
  const layer = new Container({ label: 'reward' })
  // A full cell, as the decor draws one: honey and its gloss. Drawn once, shown when full.
  const full = EMPTY_CELLS.map((cell) => {
    const node = new Graphics()
      .poly(honeyIn(cell, 1))
      .fill(PALETTE.honey)
      .ellipse(cell.x - r * 0.3, cell.y - r * 0.35, r * 0.28, r * 0.16)
      .fill({ color: PALETTE.cream, alpha: 0.45 })
    layer.addChild(node)
    return node
  })
  // The cell filling now: drawn again while its honey rises.
  const filling = new Graphics()
  layer.addChild(filling)
  // The trickle: from the bottom edge of the frame down behind the pot's rim, as the drop of the
  // decor; the pot is drawn after the comb, over it [SPEC-13.3].
  const trickle = new Graphics()
  layer.addChild(trickle)
  // Over the cells of the comb, under the bees perched on it.
  apiary.comb.addChild(layer)

  // [SPEC-8.6] Over the whole decor, so that it covers any screen shape. The mini sound meter is
  // on the stage, out of it.
  const warm = new Graphics({ label: 'warm-light' })
    .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, DECOR_BOUNDS.height)
    .fill(PALETTE.honey)
  warm.blendMode = 'add'
  apiary.root.addChild(warm)

  let level = 0
  let clock = 0
  let fillingIndex = -1
  let fillingShare = 0
  let trickleShare = 0

  const drawFilling = (index: number, share: number) => {
    if (index === fillingIndex && share === fillingShare) return
    fillingIndex = index
    fillingShare = share
    filling.clear()
    const cell = EMPTY_CELLS[index]
    if (cell) filling.poly(honeyIn(cell, share)).fill(PALETTE.honey)
  }

  const drawTrickle = (share: number) => {
    if (share === trickleShare) return
    trickleShare = share
    trickle.clear()
    if (share === 0) return
    const w = REWARD.trickleWidth
    const length = share * (DRIP.fallTo - DRIP.y)
    trickle
      .roundRect(DRIP.x - w / 2, DRIP.y - w / 2, w, length + w / 2, w / 2)
      .fill(PALETTE.honey)
      // Where it leaves the frame, a little bulge of honey.
      .ellipse(DRIP.x, DRIP.y, w * 0.9, w * 0.55)
      .fill(PALETTE.honey)
  }

  const show = () => {
    layer.visible = level > 0
    warm.visible = level > 0
    if (level === 0) return
    layer.alpha = level
    warm.alpha = REWARD.warmAlpha * level
    let partly = -1
    let share = 0
    full.forEach((node, i) => {
      const fill = cellFill(i, clock)
      node.visible = fill >= 1
      if (fill > 0 && fill < 1) {
        partly = i
        share = fill
      }
    })
    drawFilling(partly, share)
    drawTrickle(trickleLength(clock))
  }
  show()

  return {
    get level() {
      return level
    },
    update(dt, active) {
      level = fadeLevel(level, active, dt)
      clock = rewardClock(clock, active, level, dt)
      show()
    },
  }
}
