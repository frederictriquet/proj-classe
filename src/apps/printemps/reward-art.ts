// [SPEC-17.4] [SPEC-8.5] [SPEC-8.3.2] Reward of « Printemps du silence », drawn with PixiJS: once the
// eleven characters are settled, the cherry tree covers itself with blossoms one by one, petals fall
// slowly, the cloud slides away from the sun and the light warms up. It plays no sound
// [SPEC-17.1]. When it shows and how fast it fades are shared (src/silence/reward.ts). Only
// position, scale and transparency change: nothing blinks.
import { Container, Graphics } from 'pixi.js'
import { fadeLevel, type RewardView } from '../../silence/reward'
import { AMBIENT, createPetals } from './ambient'
import type { Landscape } from './landscape'
import { BLOSSOMS, SUN } from './layout'
import { PALETTE } from './palette'

export const REWARD = {
  /** Share of the fade-in the last blossom waits before opening: they open one by one. */
  blossomSpread: 0.6,
  /** Radius of a blossom, world units. */
  blossom: 15,
  /** How far the cloud slides right off the sun, world units. */
  cloudShift: 300,
  /** Rays of the uncovered sun: how many, from and to what distance of its centre. */
  rays: { count: 12, from: 1.25, to: 1.75, width: 12 },
  /** Opacity of the warm light over the whole landscape, at full reward. */
  warmAlpha: 0.06,
} as const

/** [SPEC-17.4] How open the blossom `i` of `count` is with the reward at `level` (0 to 1): each one
 *  waits its turn, then opens over the rest of the fade-in. Steady once open. */
export function blossomLevel(i: number, count: number, level: number): number {
  const delay = (REWARD.blossomSpread * i) / Math.max(1, count - 1)
  return Math.min(1, Math.max(0, (level - delay) / (1 - REWARD.blossomSpread)))
}

/** Order the blossoms open in: spread over the tree rather than branch after branch. */
const ORDER: readonly number[] = BLOSSOMS.map((_, i) => i).sort((a, b) => ((a * 7) % BLOSSOMS.length) - ((b * 7) % BLOSSOMS.length))

/** A cherry blossom: five cream petals around a pink heart. */
function blossom(x: number, y: number, r: number): Container {
  const node = new Container()
  node.position.set(x, y)
  const petals = new Graphics()
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 2 * Math.PI - Math.PI / 2
    petals.circle(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.55)
  }
  node.addChild(petals.fill(PALETTE.cream))
  node.addChild(new Graphics().circle(0, 0, r * 0.32).fill(PALETTE.pink))
  return node
}

/** Adds the reward to the landscape, invisible until it is active. */
export function createReward(landscape: Landscape): RewardView {
  // In front of the branches of the cherry tree, behind the characters.
  const blossoms = BLOSSOMS.map((p) => {
    const node = blossom(p.x, p.y, REWARD.blossom)
    landscape.crown.addChild(node)
    return node
  })

  // Rays of the sun, behind its cloud.
  const sky = landscape.planes.sky
  const rays = new Graphics()
  const { count, from, to, width } = REWARD.rays
  for (let k = 0; k < count; k++) {
    const a = (k / count) * 2 * Math.PI
    rays.moveTo(SUN.x + Math.cos(a) * SUN.radius * from, SUN.y + Math.sin(a) * SUN.radius * from).lineTo(SUN.x + Math.cos(a) * SUN.radius * to, SUN.y + Math.sin(a) * SUN.radius * to)
  }
  rays.stroke({ width, color: PALETTE.yellow, cap: 'round' })
  sky.addChildAt(rays, sky.getChildIndex(landscape.sunCloud))

  // Petals, in front of everything.
  const petals = createPetals(AMBIENT.petals.count, { x: 0, y: 0, width: 1440, height: 1080 }, 41).map((petal) => {
    const node = new Graphics().ellipse(0, 0, petal.size, petal.size * 0.6).fill(PALETTE.cream)
    node.addChild(new Graphics().ellipse(petal.size * 0.3, 0, petal.size * 0.35, petal.size * 0.25).fill({ color: PALETTE.pink, alpha: 0.6 }))
    landscape.air.addChild(node)
    return { petal, node }
  })

  const warm = new Graphics({ label: 'warm-light' }).rect(-1500, -900, 4440, 2880).fill(PALETTE.yellow)
  warm.blendMode = 'add'
  landscape.root.addChild(warm)

  let level = 0
  let time = 0
  const show = () => {
    const on = level > 0
    rays.visible = on
    warm.visible = on
    for (const node of blossoms) node.visible = on
    for (const { node } of petals) node.visible = on
    landscape.sunCloud.x = REWARD.cloudShift * level * level * (3 - 2 * level)
    if (!on) return
    ORDER.forEach((index, rank) => {
      const open = blossomLevel(rank, blossoms.length, level)
      blossoms[index]!.scale.set(open)
    })
    rays.alpha = level
    warm.alpha = REWARD.warmAlpha * level
    const view = landscape.visible
    for (const { petal, node } of petals) {
      const span = view.height + 40
      const y = view.y - 20 + ((((petal.y + petal.speed * time - view.y + 20) % span) + span) % span)
      const x = view.x + (petal.x / 1440) * view.width + AMBIENT.petals.sway * Math.sin(2 * Math.PI * (time / petal.swayPeriod + petal.phase))
      node.position.set(x, y)
      node.rotation = 0.6 * Math.sin(2 * Math.PI * (time / petal.swayPeriod + petal.phase + 0.25))
      node.alpha = 0.95 * level
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
