// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-14.2] [SPEC-14.3]
// The incubator (« Couvain du silence »), drawn in code with PixiJS in paper cut-out style: flat
// colours of the brood palette, round shapes, a soft shadow under each piece. Six planes (`back`,
// `straw`, `feeder`, `eggs`, `lamps`, `foreground`), twenty eggs in four straw nests, two hanging
// heat lamps with their warm translucent halo, a wooden seed feeder, and quiet permanent life
// (slowly swaying heat lamps, gently breathing warm halos, swaying straw wisps).
//
// Each egg is its chick's hideout (`Decor.slots[eggId]`), with its slot placed between the back
// and the front of the shell so the chick disappears inside it (`usesSlot` in `src/silence/animal.ts`),
// and is built from separate pieces (`whole`, `lower`, `cap`, `crack`) for the hatching and cap
// animations [SPEC-14.2.1] [SPEC-14.2.2].
import { Container, Graphics } from 'pixi.js'
import { paperShadow } from '../../art/palette'
import { oscillate } from '../../silence/ambient'
import type { Decor, DecorAnimal } from '../../silence/decor'
import { viewport, type Point } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, SHADOW, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT } from './ambient'
import {
  CRATE,
  DECOR_BOUNDS,
  EGG_IDS,
  EGG_SIZE,
  EGGS,
  FEEDER,
  LAMPS,
  NESTS,
  type CapVariant,
  type EggHideout,
  type EggId,
  type HeatLamp,
  type PlaneId,
} from './layout'
import { PALETTE } from './palette'

/** [SPEC-14.2.1] [SPEC-14.2.2] Separate pieces of an egg so it can hatch, wobble, crack and lift
 *  its cap according to its chick's state and variant. */
export interface EggArt {
  readonly id: EggId
  readonly variant: CapVariant
  /** Whole egg container, pivoted at the base `(egg.x, egg.y)` so it can rock gently. */
  readonly node: Container
  /** Slot between the back and the front of the shell where the hiding chick is drawn. */
  readonly slot: Container
  /** Intact eggshell, visible before the first hatching and when closed in the `cartoon` variant. */
  readonly whole: Container
  /** Front of the lower half-shell, visible once the egg has hatched. */
  readonly lower: Container
  /** Upper cap (`calotte`), pivoted at the split line so it can hinge open or sit like a hat. */
  readonly cap: Container
  /** Zigzag crack across the middle of the shell. */
  readonly crack: Graphics
}

/** [SPEC-9.8] [SPEC-14.3] The decor of the brood, as the shared code sees it, plus its planes and eggs. */
export interface Incubator extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** Twenty slots, one inside each egg, between the back and the front of its shell. */
  readonly slots: Readonly<Record<EggId, Container>>
  /** Separate pieces of each of the twenty eggs. */
  readonly eggs: Readonly<Record<EggId, EggArt>>
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)
const shadowFill = paperShadow(PALETTE.ink)

interface SwingingLamp {
  node: Container
  halo: Container
  floorGlow: Graphics
  phase: number
}

/** [SPEC-14.3] Back wall of the room (`slate`) and the wooden brooder crate (`brown` back planks,
 *  `wood` top rim and side walls). */
function drawBack(): Container {
  const plane = new Container({ label: 'plane:back' })
  const { rimY, rimHeight, wallLeft, wallRight, postWidth, strawTopY } = CRATE
  const crateTop = rimY + rimHeight
  const backBottom = strawTopY + 90

  // Cool dark room wall behind and above the crate.
  plane.addChild(
    new Graphics()
      .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, crateTop + 40 - DECOR_BOUNDS.y)
      .fill(PALETTE.slate),
  )

  // Warm dark wooden back wall inside the crate.
  plane.addChild(
    new Graphics()
      .rect(DECOR_BOUNDS.x, crateTop, DECOR_BOUNDS.width, backBottom - crateTop)
      .fill(PALETTE.brown),
  )

  // Horizontal wooden plank seams on the dark back wall.
  const planks = new Graphics()
  for (const y of [255, 325, 395, 455]) {
    planks.moveTo(DECOR_BOUNDS.x, y).lineTo(RIGHT, y)
  }
  plane.addChild(planks.stroke({ width: 5, color: PALETTE.ink, alpha: 0.28 }))

  // Subtle warm wood grain strips on the back planks.
  const grain = new Graphics()
  for (const [x, y, w] of [
    [160, 210, 280],
    [620, 280, 320],
    [1040, 215, 250],
    [260, 350, 340],
    [860, 355, 300],
  ] as const) {
    grain.roundRect(x, y, w, 16, 8)
  }
  plane.addChild(grain.fill({ color: PALETTE.wood, alpha: 0.1 }))

  // Left and right wooden side walls / corner posts of the crate, framing the safe zone.
  plane.addChild(
    piece((g) => g.rect(DECOR_BOUNDS.x, crateTop, wallLeft - DECOR_BOUNDS.x, BOTTOM - crateTop), PALETTE.wood, BIG_SHADOW),
    piece((g) => g.rect(wallRight, crateTop, RIGHT - wallRight, BOTTOM - crateTop), PALETTE.wood, BIG_SHADOW),
  )
  // Inner vertical corner posts with plank lines and wooden pegs.
  const sideDetails = new Graphics()
  for (const y of [280, 410, 560, 720, 880]) {
    sideDetails
      .moveTo(DECOR_BOUNDS.x, y)
      .lineTo(wallLeft, y)
      .moveTo(wallRight, y)
      .lineTo(RIGHT, y)
  }
  plane.addChild(sideDetails.stroke({ width: 4, color: PALETTE.brown, alpha: 0.35 }))

  const postShade = new Graphics()
    .rect(wallLeft - postWidth, crateTop, postWidth, BOTTOM - crateTop)
    .rect(wallRight, crateTop, postWidth, BOTTOM - crateTop)
    .fill({ color: PALETTE.amber, alpha: 0.18 })
  plane.addChild(postShade)

  // Top horizontal wooden rim of the crate (the mother hen peeks over it in the reward [SPEC-14.4]).
  plane.addChild(
    piece((g) => g.rect(DECOR_BOUNDS.x, rimY, DECOR_BOUNDS.width, rimHeight), PALETTE.wood, BIG_SHADOW),
  )
  plane.addChild(
    new Graphics()
      .rect(DECOR_BOUNDS.x, rimY + rimHeight - 8, DECOR_BOUNDS.width, 8)
      .fill({ color: PALETTE.brown, alpha: 0.28 }),
  )

  return plane
}

/** A small cluster of 3 curved straw blades that sways gently about its root `(x, y)`. */
function drawStrawTuft(x: number, y: number, seed: number, scale = 1): Container {
  const node = pivoted({ x, y })
  const rand = seededRandom(seed)
  const amberBlades = new Graphics()
  const darkBlades = new Graphics()
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 14 * scale
    const len = (34 + rand() * 18) * scale
    const lean = ((i - 1) * 18 + (rand() - 0.5) * 14) * scale
    const g = i === 1 ? darkBlades : amberBlades
    g.moveTo(x + dx - 4 * scale, y)
      .quadraticCurveTo(x + dx + lean * 0.45, y - len * 0.55, x + dx + lean, y - len)
      .quadraticCurveTo(x + dx + lean * 0.5 + 4 * scale, y - len * 0.45, x + dx + 4 * scale, y)
      .closePath()
  }
  node.addChild(
    darkBlades.fill({ color: PALETTE.terracotta, alpha: 0.55 }),
    amberBlades.fill({ color: PALETTE.amber, alpha: 0.85 }),
  )
  return node
}

/** [SPEC-14.3] Thick straw litter covering the floor of the incubator, with warm floor pools under
 *  the lamps, four cosy straw nests, and swaying wisps. */
function drawStraw(strawWisps: Swaying[]): { plane: Container; floorGlows: Graphics[] } {
  const plane = new Container({ label: 'plane:straw' })
  const base = CRATE.strawTopY

  // Rolling top edge of the thick straw bed across the whole decor width.
  const mounds: readonly (readonly [number, number])[] = [
    [-900, 28],
    [-300, 18],
    [270, 34],
    [720, 16],
    [1170, 34],
    [1750, 22],
    [2350, 28],
    [RIGHT, 20],
  ]
  plane.addChild(
    piece((g) => {
      let x = DECOR_BOUNDS.x
      g.moveTo(x, BOTTOM).lineTo(x, base)
      for (const [to, h] of mounds) {
        const w = to - x
        g.bezierCurveTo(x + w * 0.3, base - h, x + w * 0.7, base - h, to, base)
        x = to
      }
      return g.lineTo(RIGHT, BOTTOM).closePath()
    }, PALETTE.straw, null),
  )

  // Subtle layered straw ridges for depth across the floor.
  const ridges = new Graphics()
  for (const [x, y, rx, ry] of [
    [270, 610, 250, 48],
    [1170, 610, 250, 48],
    [720, 645, 280, 44],
    [260, 995, 250, 50],
    [1180, 995, 250, 50],
  ] as const) {
    ridges.ellipse(x, y, rx, ry)
  }
  plane.addChild(ridges.fill({ color: PALETTE.brown, alpha: 0.14 }))

  // Warm pools of light on the straw directly under the two heat lamps [SPEC-8.3.2] [SPEC-14.3].
  const floorGlows: Graphics[] = []
  for (const lamp of LAMPS) {
    const { x, y, rx, ry } = lamp.haloFloor
    const glow = new Graphics()
      .ellipse(x, y, rx, ry)
      .fill({ color: PALETTE.amber, alpha: 0.18 })
      .ellipse(x, y, rx * 0.62, ry * 0.62)
      .fill({ color: PALETTE.yellow, alpha: 0.14 })
    glow.pivot.set(x, y)
    glow.position.set(x, y)
    plane.addChild(glow)
    floorGlows.push(glow)
  }

  // Static straw texture strokes scattered across the bed.
  const rand = seededRandom(42)
  const darkStrands = new Graphics()
  const lightStrands = new Graphics()
  for (let i = 0; i < 65; i++) {
    const x = -200 + rand() * 1840
    const y = base + 25 + rand() * (CRATE.frontLipY - base - 45)
    const len = 28 + rand() * 26
    const angle = (rand() - 0.5) * 0.7
    const dx = Math.cos(angle) * len
    const dy = Math.sin(angle) * len
    const target = i % 2 === 0 ? darkStrands : lightStrands
    target.moveTo(x - dx / 2, y - dy / 2).quadraticCurveTo(x, y - 5, x + dx / 2, y + dy / 2)
  }
  plane.addChild(
    darkStrands.stroke({ width: 5, color: PALETTE.terracotta, alpha: 0.38, cap: 'round' }),
    lightStrands.stroke({ width: 4, color: PALETTE.amber, alpha: 0.5, cap: 'round' }),
  )

  // The four cosy straw nests where the twenty eggs rest [SPEC-14.3].
  for (const [i, nest] of NESTS.entries()) {
    const nestGroup = new Container({ label: `nest:${nest.id}` })
    // Outer lobed cushion of straw.
    nestGroup.addChild(piece(lobed(nest, 12, 100 + i * 7), PALETTE.straw, BIG_SHADOW))
    // Darker woven hollow inside the nest so the cream eggs pop out even more.
    nestGroup.addChild(
      new Graphics()
        .ellipse(nest.x, nest.y + 4, nest.rx * 0.88, nest.ry * 0.74)
        .fill({ color: PALETTE.brown, alpha: 0.28 })
        .ellipse(nest.x, nest.y + 6, nest.rx * 0.78, nest.ry * 0.58)
        .fill({ color: PALETTE.terracotta, alpha: 0.28 }),
    )
    // Woven rim strands around the nest perimeter.
    const rim = new Graphics()
    for (let a = 0; a < 10; a++) {
      const t = (a / 10) * Math.PI * 2
      const a2 = t + 0.42
      rim
        .moveTo(nest.x + Math.cos(t) * nest.rx * 0.9, nest.y + Math.sin(t) * nest.ry * 0.85)
        .quadraticCurveTo(
          nest.x + Math.cos((t + a2) / 2) * nest.rx * 1.02,
          nest.y + Math.sin((t + a2) / 2) * nest.ry * 0.98,
          nest.x + Math.cos(a2) * nest.rx * 0.88,
          nest.y + Math.sin(a2) * nest.ry * 0.82,
        )
    }
    nestGroup.addChild(rim.stroke({ width: 5, color: PALETTE.amber, alpha: 0.65, cap: 'round' }))
    plane.addChild(nestGroup)
  }

  // Gently swaying straw tufts in the litter [SPEC-14.3].
  const tuftSpots: readonly (readonly [number, number])[] = [
    [130, 675],
    [575, 515],
    [865, 515],
    [1310, 675],
    [175, 835],
    [1265, 835],
    [480, 645],
    [960, 645],
    [520, 910],
    [920, 910],
  ]
  for (const [i, [x, y]] of tuftSpots.entries()) {
    const tuft = drawStrawTuft(x, y, 200 + i)
    strawWisps.push({ node: tuft, phase: (i * 0.27) % 1 })
    plane.addChild(tuft)
  }

  return { plane, floorGlows }
}

/** [SPEC-14.3] Small wooden feeder filled with seeds in the front center of the incubator. */
function drawFeeder(): Container {
  const plane = new Container({ label: 'plane:feeder' })
  const { body, rim } = FEEDER
  const { x, y, width, height } = body

  // Wooden base feet at each end of the trough.
  for (const footX of [x - 8, x + width - 20]) {
    plane.addChild(
      piece((g) => g.roundRect(footX, y + height - 10, 28, 18, 6), PALETTE.brown),
    )
  }

  // Main wooden trough body (trapezoid slightly wider at the top).
  const troughPath: PathBuilder = (g) =>
    g
      .moveTo(x - 10, y)
      .lineTo(x + width + 10, y)
      .lineTo(x + width, y + height)
      .lineTo(x, y + height)
      .closePath()
  plane.addChild(piece(troughPath, PALETTE.wood, BIG_SHADOW))

  // Front plank line and wooden rim.
  plane.addChild(
    new Graphics()
      .moveTo(x + 8, y + height * 0.58)
      .lineTo(x + width - 8, y + height * 0.58)
      .stroke({ width: 4, color: PALETTE.brown, alpha: 0.35 }),
  )

  // Dark hollow of the trough opening at the top.
  const hollow = { x: x + rim, y: y + 5, width: width - 2 * rim, height: 24 }
  plane.addChild(
    new Graphics()
      .roundRect(hollow.x, hollow.y, hollow.width, hollow.height, 10)
      .fill(PALETTE.brown),
  )

  // Heap of golden, yellow and terracotta seeds inside the trough.
  const amberSeeds = new Graphics()
  const yellowSeeds = new Graphics()
  const darkSeeds = new Graphics()
  const rand = seededRandom(88)
  for (let i = 0; i < 42; i++) {
    const sx = hollow.x + 12 + rand() * (hollow.width - 24)
    const sy = hollow.y + 6 + rand() * (hollow.height - 10)
    const g = i % 3 === 0 ? yellowSeeds : i % 3 === 1 ? amberSeeds : darkSeeds
    g.ellipse(sx, sy, 6.5, 4.2)
  }
  // A few seeds spilled on the straw right in front of the feeder.
  for (const [sx, sy] of [
    [x + 45, y + height + 14],
    [x + 95, y + height + 18],
    [x + 150, y + height + 15],
    [x + 195, y + height + 17],
  ] as const) {
    amberSeeds.ellipse(sx, sy, 5.5, 3.8)
    yellowSeeds.ellipse(sx + 14, sy - 3, 5, 3.5)
  }
  plane.addChild(
    darkSeeds.fill(PALETTE.terracotta),
    amberSeeds.fill(PALETTE.amber),
    yellowSeeds.fill(PALETTE.yellow),
  )

  return plane
}

/** Egg outline centred at `(0, -ry)` (standing on `(0, 0)`): slightly narrower at the top than at
 *  the bottom, like a real hen's egg. */
function wholeEggPath(rx: number, ry: number): PathBuilder {
  return (g) =>
    g
      .moveTo(0, -2 * ry)
      .bezierCurveTo(rx * 0.78, -2 * ry, rx, -ry * 1.35, rx, -ry * 0.85)
      .bezierCurveTo(rx, -ry * 0.25, rx * 0.62, 0, 0, 0)
      .bezierCurveTo(-rx * 0.62, 0, -rx, -ry * 0.25, -rx, -ry * 0.85)
      .bezierCurveTo(-rx, -ry * 1.35, -rx * 0.78, -2 * ry, 0, -2 * ry)
      .closePath()
}

/** Zigzag points across the middle of the egg, in local egg coordinates where `(0, 0)` is the base. */
function zigzagPoints(rx: number, splitY: number): readonly Point[] {
  const w = rx * 0.96
  return [
    { x: -w, y: splitY + 2 },
    { x: -w * 0.6, y: splitY - 9 },
    { x: -w * 0.2, y: splitY + 6 },
    { x: w * 0.2, y: splitY - 10 },
    { x: w * 0.6, y: splitY + 5 },
    { x: w, y: splitY - 3 },
  ]
}

/** Lower half-shell outline, from the zigzag rim down to the base `(0, 0)`. */
function lowerShellPath(rx: number, ry: number, splitY: number): PathBuilder {
  const pts = zigzagPoints(rx, splitY)
  return (g) => {
    g.moveTo(pts[0]!.x, pts[0]!.y)
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y)
    return g
      .bezierCurveTo(rx, -ry * 0.25, rx * 0.62, 0, 0, 0)
      .bezierCurveTo(-rx * 0.62, 0, -rx, -ry * 0.25, pts[0]!.x, pts[0]!.y)
      .closePath()
  }
}

/** Upper cap (`calotte`) outline, in coordinates local to `(0, splitY)` so it can pivot or lift. */
function capShellPath(rx: number, ry: number, splitY: number): PathBuilder {
  const pts = zigzagPoints(rx, splitY)
  const topY = -2 * ry - splitY
  return (g) => {
    g.moveTo(0, topY)
      .bezierCurveTo(rx * 0.78, topY, rx, -ry * 1.35 - splitY, pts[pts.length - 1]!.x, pts[pts.length - 1]!.y - splitY)
    for (let i = pts.length - 2; i >= 0; i--) {
      g.lineTo(pts[i]!.x, pts[i]!.y - splitY)
    }
    return g
      .bezierCurveTo(-rx, -ry * 1.35 - splitY, -rx * 0.78, topY, 0, topY)
      .closePath()
  }
}

/** [SPEC-14.2] [SPEC-14.2.1] [SPEC-14.2.2] Draws one egg in separate pieces (`whole`, `lower`,
 *  `cap`, `crack`) with its `slot` between the back of the shell and the front pieces. */
function drawOneEgg(egg: EggHideout, slot: Container): EggArt {
  const { rx, ry } = EGG_SIZE
  const splitY = -ry * 1.02

  // Pivoted at the egg's base `(egg.x, egg.y)` in world coordinates so `slot` stays in world
  // coordinates while the egg rocks around its base.
  const node = pivoted({ x: egg.x, y: egg.y })
  node.label = `egg:${egg.id}`

  // 1. Cast shadow of the egg on the straw nest.
  const shadow = wholeEggPath(rx, ry)(new Graphics()).fill(shadowFill)
  shadow.position.set(egg.x + SHADOW.x, egg.y + SHADOW.y)
  node.addChild(shadow)

  // 2. Back interior of the opened lower shell (visible behind the chick once hatched).
  const backInside = new Graphics()
    .ellipse(egg.x, egg.y + splitY + 4, rx * 0.9, 14)
    .fill(PALETTE.brown)
    .ellipse(egg.x, egg.y + splitY + 6, rx * 0.78, 10)
    .fill({ color: PALETTE.ink, alpha: 0.35 })
  node.addChild(backInside)

  // 3. The chick's slot: between the back of the shell and the front pieces (`lower`, `whole`).
  node.addChild(slot)

  // 4. Front of the lower half-shell (`lower`), covering the bottom of the chick in the egg.
  const lower = new Container({ label: 'lower' })
  lower.position.set(egg.x, egg.y)
  lower.addChild(
    lowerShellPath(rx, ry, splitY)(new Graphics()).fill(PALETTE.cream),
    lowerShellPath(rx * 0.92, ry * 0.85, splitY + 8)(new Graphics()).fill({ color: PALETTE.amber, alpha: 0.14 }),
  )
  node.addChild(lower)

  // 5. Intact whole shell (`whole`), shown at launch before hatching and when closed in `cartoon`.
  const whole = new Container({ label: 'whole' })
  whole.position.set(egg.x, egg.y)
  whole.addChild(
    wholeEggPath(rx, ry)(new Graphics()).fill(PALETTE.cream),
    // Soft warm shading near the bottom of the egg so it sits roundly in the nest.
    new Graphics()
      .ellipse(4, -ry * 0.55, rx * 0.78, ry * 0.42)
      .fill({ color: PALETTE.amber, alpha: 0.16 }),
    // Bright highlight on the upper left of the shell.
    new Graphics()
      .ellipse(-rx * 0.32, -ry * 1.32, rx * 0.24, ry * 0.32)
      .fill({ color: PALETTE.yellow, alpha: 0.25 }),
  )
  node.addChild(whole)

  // 6. Zigzag crack (`crack`) across the middle of the shell.
  const crack = new Graphics({ label: 'crack' })
  crack.position.set(egg.x, egg.y)
  const pts = zigzagPoints(rx, splitY)
  crack.moveTo(pts[0]!.x, pts[0]!.y)
  for (const p of pts.slice(1)) crack.lineTo(p.x, p.y)
  crack.stroke({ width: 3.5, color: PALETTE.ink, cap: 'round', join: 'round' })
  crack.visible = false
  node.addChild(crack)

  // 7. Upper cap (`calotte`), positioned at `(egg.x, egg.y + splitY)` so it can lift or hinge.
  const cap = new Container({ label: 'cap' })
  cap.position.set(egg.x, egg.y + splitY)
  cap.addChild(
    capShellPath(rx, ry, splitY)(new Graphics()).fill(PALETTE.cream),
    new Graphics()
      .ellipse(-rx * 0.3, -ry * 0.3, rx * 0.22, ry * 0.28)
      .fill({ color: PALETTE.yellow, alpha: 0.25 }),
  )
  cap.visible = false
  node.addChild(cap)

  // 8. Small front cradle of straw wisps hugging the very bottom of the egg.
  const cradle = new Graphics()
    .moveTo(egg.x - rx * 0.85, egg.y - 4)
    .quadraticCurveTo(egg.x, egg.y + 8, egg.x + rx * 0.85, egg.y - 4)
    .stroke({ width: 6, color: PALETTE.straw, cap: 'round' })
    .moveTo(egg.x - rx * 0.55, egg.y + 1)
    .quadraticCurveTo(egg.x + 4, egg.y + 9, egg.x + rx * 0.65, egg.y)
    .stroke({ width: 4, color: PALETTE.amber, alpha: 0.85, cap: 'round' })
  node.addChild(cradle)

  return {
    id: egg.id,
    variant: egg.variant,
    node,
    slot,
    whole,
    lower,
    cap,
    crack,
  }
}

function drawEggs(slots: Record<EggId, Container>): {
  plane: Container
  eggs: Record<EggId, EggArt>
} {
  const plane = new Container({ label: 'plane:eggs' })
  const eggs = {} as Record<EggId, EggArt>
  // Sort eggs back-to-front by base `y`.
  for (const spec of [...EGGS].sort((a, b) => a.y - b.y)) {
    const art = drawOneEgg(spec, slots[spec.id])
    eggs[spec.id] = art
    plane.addChild(art.node)
  }
  return { plane, eggs }
}

/** [SPEC-8.3.2] [SPEC-14.3] One hanging heat lamp: cord, red socket, terracotta shade, yellow bulb,
 *  and its translucent amber halo cone. */
function drawOneLamp(lamp: HeatLamp, floorGlow: Graphics, phase: number): SwingingLamp {
  const { x, cordTopY, socketTopY, shadeTopY, shadeBottomY, shadeTopRx, shadeBottomRx, haloFloor } = lamp
  const node = pivoted({ x, y: cordTopY })
  node.label = `lamp:${lamp.id}`

  // Translucent warm light cone from the lamp shade down to the straw [SPEC-8.3.2].
  // Drawn as a single smooth silhouette down to the top of the floor pool so there is no seam.
  const halo = pivoted({ x, y: shadeBottomY })
  const haloBottomY = haloFloor.y - haloFloor.ry * 0.25
  const outerCone: PathBuilder = (g) =>
    g
      .moveTo(x - shadeBottomRx * 0.78, shadeBottomY - 4)
      .lineTo(x + shadeBottomRx * 0.78, shadeBottomY - 4)
      .lineTo(haloFloor.x + haloFloor.rx * 0.88, haloBottomY)
      .quadraticCurveTo(haloFloor.x, haloFloor.y + haloFloor.ry * 0.35, haloFloor.x - haloFloor.rx * 0.88, haloBottomY)
      .closePath()
  const innerCone: PathBuilder = (g) =>
    g
      .moveTo(x - shadeBottomRx * 0.44, shadeBottomY)
      .lineTo(x + shadeBottomRx * 0.44, shadeBottomY)
      .lineTo(haloFloor.x + haloFloor.rx * 0.54, haloBottomY)
      .quadraticCurveTo(haloFloor.x, haloFloor.y + haloFloor.ry * 0.18, haloFloor.x - haloFloor.rx * 0.54, haloBottomY)
      .closePath()
  halo.addChild(
    outerCone(new Graphics()).fill({ color: PALETTE.amber, alpha: 0.11 }),
    innerCone(new Graphics()).fill({ color: PALETTE.yellow, alpha: 0.08 }),
  )
  node.addChild(halo)

  // Suspension cord from the top of the decor down to the socket.
  node.addChild(
    piece((g) => g.rect(x - 5, DECOR_BOUNDS.y, 10, socketTopY - DECOR_BOUNDS.y + 6), PALETTE.wood),
  )

  // Red ceramic socket at the top of the shade.
  node.addChild(
    piece((g) => g.roundRect(x - 24, socketTopY, 48, shadeTopY - socketTopY + 10, 10), PALETTE.red, BIG_SHADOW),
  )

  // Glowing yellow heat bulb protruding under the shade.
  node.addChild(
    new Graphics()
      .circle(x, shadeBottomY + 4, 34)
      .fill({ color: PALETTE.amber, alpha: 0.45 })
      .circle(x, shadeBottomY + 2, 24)
      .fill(PALETTE.yellow)
      .circle(x - 5, shadeBottomY - 2, 10)
      .fill(PALETTE.cream),
  )

  // Terracotta dome/cone shade with a warm rim.
  const shadePath: PathBuilder = (g) =>
    g
      .moveTo(x - shadeTopRx, shadeTopY)
      .lineTo(x + shadeTopRx, shadeTopY)
      .quadraticCurveTo(x + shadeBottomRx * 0.95, (shadeTopY + shadeBottomY) / 2, x + shadeBottomRx, shadeBottomY)
      .quadraticCurveTo(x, shadeBottomY + 16, x - shadeBottomRx, shadeBottomY)
      .quadraticCurveTo(x - shadeBottomRx * 0.95, (shadeTopY + shadeBottomY) / 2, x - shadeTopRx, shadeTopY)
      .closePath()
  node.addChild(piece(shadePath, PALETTE.terracotta, BIG_SHADOW))

  // Bright rim and decorative band on the shade.
  node.addChild(
    new Graphics()
      .moveTo(x - shadeBottomRx + 6, shadeBottomY - 2)
      .quadraticCurveTo(x, shadeBottomY + 12, x + shadeBottomRx - 6, shadeBottomY - 2)
      .stroke({ width: 6, color: PALETTE.amber, cap: 'round' }),
  )

  return { node, halo, floorGlow, phase }
}

function drawLamps(floorGlows: Graphics[]): { plane: Container; lamps: SwingingLamp[] } {
  const plane = new Container({ label: 'plane:lamps' })
  const lamps = LAMPS.map((lamp, i) => {
    const built = drawOneLamp(lamp, floorGlows[i]!, i * 0.45)
    plane.addChild(built.node)
    return built
  })
  return { plane, lamps }
}

/** [SPEC-14.3] Front wooden lip of the crate and swaying foreground straw wisps along the bottom. */
function drawForeground(strawWisps: Swaying[]): Container {
  const plane = new Container({ label: 'plane:foreground' })
  const lipY = CRATE.frontLipY

  // Swaying straw tufts peeking up behind the front wooden lip.
  for (let i = 0, x = -240; x <= 1680; i++, x += 140 + ((i * 29) % 40)) {
    const tuft = drawStrawTuft(x, lipY + 8, 400 + i, 1.1)
    strawWisps.push({ node: tuft, phase: (i * 0.31) % 1 })
    plane.addChild(tuft)
  }

  // Front wooden board of the brooder crate at the bottom of the screen.
  plane.addChild(
    piece((g) => g.rect(DECOR_BOUNDS.x, lipY, DECOR_BOUNDS.width, BOTTOM - lipY), PALETTE.wood, null),
    new Graphics().rect(DECOR_BOUNDS.x, lipY, DECOR_BOUNDS.width, 8).fill({ color: PALETTE.brown, alpha: 0.35 }),
  )

  return plane
}

export function createIncubator(): Incubator {
  const actors = new Container({ label: 'actors' })
  const slots = {} as Record<EggId, Container>
  for (const id of EGG_IDS) slots[id] = new Container({ label: `slot:${id}` })

  const strawWisps: Swaying[] = []
  const backPlane = drawBack()
  const straw = drawStraw(strawWisps)
  const feederPlane = drawFeeder()
  const eggs = drawEggs(slots)
  const lamps = drawLamps(straw.floorGlows)
  const foregroundPlane = drawForeground(strawWisps)

  const planes: Record<PlaneId, Container> = {
    back: backPlane,
    straw: straw.plane,
    feeder: feederPlane,
    eggs: eggs.plane,
    lamps: lamps.plane,
    foreground: foregroundPlane,
  }

  const root = new Container({ label: 'incubator' })
  root.addChild(
    planes.back,
    planes.straw,
    planes.feeder,
    planes.eggs,
    actors,
    planes.lamps,
    planes.foreground,
  )

  let time = 0
  const tick = (dt: number, _animals?: readonly DecorAnimal[]) => {
    time += dt
    for (const { node, phase } of strawWisps) {
      node.rotation = oscillate(AMBIENT.straw, time, phase)
    }
    for (const lamp of lamps.lamps) {
      lamp.node.rotation = oscillate(AMBIENT.lampSway, time, lamp.phase)
      const pulse = oscillate(AMBIENT.haloPulse, time, lamp.phase)
      lamp.halo.scale.x = 1 + pulse
      lamp.halo.alpha = 1 + pulse * 1.2
      lamp.floorGlow.scale.set(1 + pulse * 0.5)
      lamp.floorGlow.alpha = 1 + pulse
    }
  }

  return {
    root,
    planes,
    actors,
    slots,
    eggs: eggs.eggs,
    resize(width, height) {
      const view = viewport(width, height)
      root.scale.set(view.scale)
      root.position.set(view.offsetX, view.offsetY)
      tick(0)
    },
    tick,
  }
}
