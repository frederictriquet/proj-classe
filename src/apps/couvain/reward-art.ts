// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3.2] [SPEC-8.5] [SPEC-8.6] [SPEC-9.1] [SPEC-9.5] [SPEC-9.8] [SPEC-13] [SPEC-14.4] [SPEC-14.5]
// Reward of « Couvain du silence », drawn with PixiJS in paper cut-out style: once all twenty
// chicks are settled, the mother hen gently passes her head and neck over the top wooden rim of the
// crate to watch over her brood, the halos of the heat lamps widen and warm up, a warm amber light
// bathes the incubator, and soft down feathers float slowly in the air. Palette colours only
// [SPEC-8.3.2] [SPEC-14.5]. It plays no sound [SPEC-9.1] [SPEC-14.1]. When it shows and how fast it
// fades are shared (src/silence/reward.ts, [SPEC-9.8]).
import { Container, Graphics } from 'pixi.js'
import { BIG_SHADOW, paperPieces, pivoted, SHADOW, type PathBuilder } from '../../silence/paper'
import { fadeLevel, type RewardView } from '../../silence/reward'
import type { Incubator } from './incubator'
import { DECOR_BOUNDS, LAMPS, type HeatLamp } from './layout'
import { PALETTE } from './palette'
import {
  createFeathers,
  featherAlpha,
  featherPose,
  haloScale,
  henPose,
  REWARD,
} from './reward'

const piece = paperPieces(PALETTE.ink)

interface MotherHenArt {
  readonly root: Container
  readonly head: Container
  readonly openEyes: Container
  readonly closedEyes: Graphics
}

/** [SPEC-14.4] [SPEC-14.5] Draws the mother hen (`cream` plumage, `red` scalloped comb and wattles,
 *  `terracotta` beak, big gentle eyes looking down at her chicks), with origin `(0, 0)` at the top
 *  rim of the crate. */
function drawMotherHen(): MotherHenArt {
  const root = new Container({ label: 'mother-hen' })

  // Soft ruffled collar / breast feathers resting over the wooden rim of the crate.
  const collarPath: PathBuilder = (g) =>
    g
      .moveTo(-64, 4)
      .quadraticCurveTo(-56, -24, -34, -22)
      .quadraticCurveTo(0, -30, 34, -22)
      .quadraticCurveTo(56, -24, 64, 4)
      .quadraticCurveTo(54, 26, 26, 20)
      .quadraticCurveTo(0, 32, -26, 20)
      .quadraticCurveTo(-54, 26, -64, 4)
      .closePath()
  root.addChild(
    piece(collarPath, PALETTE.cream, BIG_SHADOW),
    new Graphics()
      .ellipse(0, 8, 46, 14)
      .fill({ color: PALETTE.amber, alpha: 0.2 }),
  )

  // Plump neck rising from behind the collar.
  const neckPath: PathBuilder = (g) =>
    g
      .moveTo(-42, 4)
      .quadraticCurveTo(-44, -34, -28, -54)
      .lineTo(28, -54)
      .quadraticCurveTo(44, -34, 42, 4)
      .closePath()
  root.addChild(piece(neckPath, PALETTE.cream))

  // Head pivoted at `(0, -42)` so her comb, face, eyes, wattles and beak tilt gently together.
  const head = pivoted({ x: 0, y: -42 })
  head.label = 'hen-head'

  // Scalloped red comb (`crête`) on top of the head [SPEC-14.5].
  const combPath: PathBuilder = (g) =>
    g
      .moveTo(-26, -74)
      .quadraticCurveTo(-30, -96, -15, -94)
      .quadraticCurveTo(-9, -104, 0, -103)
      .quadraticCurveTo(9, -104, 15, -94)
      .quadraticCurveTo(30, -96, 26, -74)
      .closePath()
  head.addChild(piece(combPath, PALETTE.red, SHADOW))

  // Two red wattles (`barbillons`) hanging on either side beneath the chin [SPEC-14.5].
  for (const wx of [-15, 15]) {
    head.addChild(piece((g) => g.ellipse(wx, -10, 7.5, 13), PALETTE.red, SHADOW))
  }

  // Round motherly head in cream with warm amber cheeks.
  head.addChild(
    piece((g) => g.ellipse(0, -48, 45, 37), PALETTE.cream, BIG_SHADOW),
    new Graphics()
      .ellipse(-25, -40, 10, 6.5)
      .ellipse(25, -40, 10, 6.5)
      .fill({ color: PALETTE.amber, alpha: 0.28 }),
  )

  // Big gentle eyes looking down at the brood, rimmed in brown so the cream sclera stands out.
  const openEyes = new Container({ label: 'hen-eyes-open' })
  for (const ex of [-19, 19]) {
    openEyes.addChild(
      new Graphics()
        .circle(ex, -51, 9.8)
        .fill(PALETTE.brown)
        .circle(ex, -51, 8.2)
        .fill(PALETTE.cream)
        .circle(ex * 0.92, -49, 5.4)
        .fill(PALETTE.ink)
        .circle(ex * 0.92 - 2, -51.5, 2.1)
        .fill(PALETTE.cream),
    )
  }
  head.addChild(openEyes)

  const closedEyes = new Graphics({ label: 'hen-eyes-closed' })
  for (const ex of [-19, 19]) {
    closedEyes
      .moveTo(ex - 7.5, -50)
      .quadraticCurveTo(ex, -44, ex + 7.5, -50)
  }
  closedEyes.stroke({ width: 3.4, color: PALETTE.ink, cap: 'round' })
  closedEyes.visible = false
  head.addChild(closedEyes)

  // Downward-pointing beak (`terracotta` with an `amber` bridge highlight) in front of the face.
  const beakPath: PathBuilder = (g) =>
    g
      .moveTo(-12, -37)
      .quadraticCurveTo(0, -41, 12, -37)
      .quadraticCurveTo(9, -22, 0, -13)
      .quadraticCurveTo(-9, -22, -12, -37)
      .closePath()
  head.addChild(
    piece(beakPath, PALETTE.terracotta, SHADOW),
    new Graphics()
      .ellipse(0, -31, 4.5, 6.5)
      .fill({ color: PALETTE.amber, alpha: 0.45 }),
  )

  root.addChild(head)
  return { root, head, openEyes, closedEyes }
}

/** Draws one soft fluffy down feather (`plume de duvet`) in `cream` with a `yellow` quill heart. */
function drawDownFeather(scale: number): Container {
  const node = new Container()
  const vanePath: PathBuilder = (g) =>
    g
      .moveTo(-16, 4)
      .quadraticCurveTo(-22, -4, -12, -10)
      .quadraticCurveTo(-4, -16, 8, -12)
      .quadraticCurveTo(20, -8, 18, 2)
      .quadraticCurveTo(10, 12, -4, 10)
      .quadraticCurveTo(-14, 10, -16, 4)
      .closePath()
  node.addChild(
    piece(vanePath, PALETTE.cream, SHADOW),
    // Soft downy puffs at the base of the feather.
    new Graphics()
      .circle(-11, 2, 7)
      .circle(-6, -5, 6.5)
      .circle(-5, 5, 6)
      .fill(PALETTE.cream),
    // Delicate warm quill line along the middle.
    new Graphics()
      .moveTo(-14, 3)
      .quadraticCurveTo(0, -3, 14, -2)
      .stroke({ width: 2.5, color: PALETTE.yellow, cap: 'round' }),
  )
  node.scale.set(scale)
  return node
}

/** Warm expanded halo cone and floor pool for one heat lamp during the reward [SPEC-14.4]. */
function drawRewardLampHalo(lamp: HeatLamp): { cone: Container; floor: Container } {
  const { x, shadeBottomY, shadeBottomRx, haloFloor } = lamp
  const cone = pivoted({ x, y: shadeBottomY })
  const haloBottomY = haloFloor.y - haloFloor.ry * 0.2
  const outerCone: PathBuilder = (g) =>
    g
      .moveTo(x - shadeBottomRx * 0.86, shadeBottomY - 2)
      .lineTo(x + shadeBottomRx * 0.86, shadeBottomY - 2)
      .lineTo(haloFloor.x + haloFloor.rx * 1.05, haloBottomY)
      .quadraticCurveTo(haloFloor.x, haloFloor.y + haloFloor.ry * 0.42, haloFloor.x - haloFloor.rx * 1.05, haloBottomY)
      .closePath()
  const innerCone: PathBuilder = (g) =>
    g
      .moveTo(x - shadeBottomRx * 0.52, shadeBottomY)
      .lineTo(x + shadeBottomRx * 0.52, shadeBottomY)
      .lineTo(haloFloor.x + haloFloor.rx * 0.68, haloBottomY)
      .quadraticCurveTo(haloFloor.x, haloFloor.y + haloFloor.ry * 0.24, haloFloor.x - haloFloor.rx * 0.68, haloBottomY)
      .closePath()
  cone.addChild(
    outerCone(new Graphics()).fill({ color: PALETTE.amber, alpha: 0.14 }),
    innerCone(new Graphics()).fill({ color: PALETTE.yellow, alpha: 0.11 }),
  )

  const floor = pivoted({ x: haloFloor.x, y: haloFloor.y })
  floor.addChild(
    new Graphics()
      .ellipse(haloFloor.x, haloFloor.y, haloFloor.rx * 1.08, haloFloor.ry * 1.08)
      .fill({ color: PALETTE.amber, alpha: 0.2 })
      .ellipse(haloFloor.x, haloFloor.y, haloFloor.rx * 0.72, haloFloor.ry * 0.72)
      .fill({ color: PALETTE.yellow, alpha: 0.16 }),
  )
  return { cone, floor }
}

/** [SPEC-9.5] [SPEC-14.4] Adds the reward to the incubator, invisible until it is active. */
export function createReward(incubator: Incubator): RewardView {
  // 1. Expanded warm halos under the heat lamps (cones in `planes.lamps`, pools on `planes.straw`).
  const haloCones = new Container({ label: 'reward-lamp-cones' })
  const haloFloors = new Container({ label: 'reward-lamp-floors' })
  const lampHalos = LAMPS.map((lamp) => {
    const built = drawRewardLampHalo(lamp)
    haloCones.addChild(built.cone)
    haloFloors.addChild(built.floor)
    return built
  })
  incubator.planes.lamps.addChildAt(haloCones, 0)
  incubator.planes.straw.addChild(haloFloors)

  // 2. Mother hen peeking gently over the top wooden rim of the crate, between the two lamps.
  const hen = drawMotherHen()
  // Placed just in front of `planes.back` so her collar and head lean over the top rim of the crate.
  incubator.root.addChildAt(hen.root, incubator.root.getChildIndex(incubator.planes.back) + 1)

  // 3. Soft down feathers floating slowly in front of the chicks and behind the foreground.
  const feathers = createFeathers()
  const featherLayer = new Container({ label: 'reward' })
  const featherSprites = feathers.map((f) => {
    const sprite = drawDownFeather(f.scale)
    featherLayer.addChild(sprite)
    return sprite
  })
  incubator.root.addChildAt(featherLayer, incubator.root.getChildIndex(incubator.planes.foreground))

  // 4. [SPEC-8.6] Warm amber light over the whole decor, covering any screen shape.
  const warm = new Graphics({ label: 'warm-light' })
    .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, DECOR_BOUNDS.height)
    .fill(PALETTE.amber)
  warm.blendMode = 'add'
  incubator.root.addChild(warm)

  let level = 0
  let time = 0
  const show = () => {
    const visible = level > 0
    hen.root.visible = visible
    haloCones.visible = visible
    haloFloors.visible = visible
    featherLayer.visible = visible
    warm.visible = visible
    if (!visible) return

    // Mother hen pose and fade.
    const pose = henPose(time, level)
    hen.root.position.set(pose.x, pose.y)
    hen.root.alpha = level
    hen.head.rotation = pose.headRotation
    hen.openEyes.visible = !pose.blink
    hen.closedEyes.visible = pose.blink

    // Widening and warming of the heat lamp halos.
    const scale = haloScale(level)
    haloCones.alpha = level
    haloFloors.alpha = level
    for (const h of lampHalos) {
      h.cone.scale.x = scale
      h.floor.scale.set(scale)
    }

    // Floating down feathers.
    feathers.forEach((f, i) => {
      const sprite = featherSprites[i]!
      const fp = featherPose(f, time)
      sprite.position.set(fp.x, fp.y)
      sprite.rotation = fp.rotation
      sprite.alpha = featherAlpha(f, level)
    })

    warm.alpha = REWARD.warmAlpha * level
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
