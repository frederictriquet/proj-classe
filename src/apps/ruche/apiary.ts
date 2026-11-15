// [SPEC-8.1] [SPEC-8.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-13.3] The apiary of « Ruche du
// silence », drawn in code with PixiJS in paper cut-out style: flat colours of the hive palette,
// round shapes, a soft shadow under each piece. Six planes (sky, hills, meadow, apiary, flowers,
// foreground), two hideouts, and quiet permanent life (slow clouds, swaying daisies, leaves and
// grass, a drop of honey running from the comb into the pot).
//
// For the animals [SPEC-9.8]: the hive has a slot, a container right behind its façade, shown only
// through the flight hole. The clump of the foreground hides the butterflies of the actors layer.
// Every flower an animal perches on is drawn behind the actors layer. Everything is in world units
// (layout.ts): `resize` scales the whole apiary to the screen.
import { Container, Graphics } from 'pixi.js'
import { paperShadow } from '../../art/palette'
import { oscillate, wrap } from '../../silence/ambient'
import type { Decor } from '../../silence/decor'
import { viewport, type Rect } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, SHADOW, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT, dropAt } from './ambient'
import {
  BEE_FLOWERS,
  BIG_FLOWERS,
  CELLS,
  CLUMP,
  COMB,
  COMB_INNER,
  DECOR_BOUNDS,
  DRIP,
  HIVE,
  HORIZON_Y,
  POT,
  SLOT_HIDEOUT_IDS,
  STUMP,
  SUN,
  type Flower,
  type PlaneId,
  type SlotHideoutId,
} from './layout'
import { PALETTE } from './palette'

/** [SPEC-9.8] The decor of the hive, as the shared code sees it, plus what its reward needs. */
export interface Apiary extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** The hive's slot, right behind its façade, shown only through the flight hole. */
  readonly slots: Readonly<Record<SlotHideoutId, Container>>
  /** [SPEC-13.4] Over the cells of the comb, under the drop: the reward fills the empty cells
   *  here (positions in `CELLS`, layout.ts). */
  readonly comb: Container
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)
const shadowFill = paperShadow(PALETTE.ink)

interface Cloud {
  /** Position at time 0. */
  x: number
  /** World units per second. */
  speed: number
  rx: number
  node: Container
}

function drawSky(): { plane: Container; clouds: Cloud[] } {
  const plane = new Container()
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, HORIZON_Y + 200 - DECOR_BOUNDS.y).fill(PALETTE.sky))
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius + 32).fill({ color: PALETTE.cream, alpha: 0.4 }))
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius).fill(PALETTE.yellow))
  const { min, max } = AMBIENT.cloudSpeed
  const clouds = (
    [
      [160, 120, 140, 64],
      [700, 70, 120, 56],
      [1000, 220, 130, 60],
      [1780, 130, 130, 60],
      [-420, 210, 120, 56],
    ] as const
  ).map(([x, y, rx, ry], i): Cloud => {
    const node = piece(lobed({ x: 0, y: 0, rx, ry }, 5, 150 + i, true), PALETTE.cream)
    node.position.set(x, y)
    plane.addChild(node)
    return { x, rx, node, speed: min + ((max - min) * ((i * 3) % 5)) / 4 }
  })
  return { plane, clouds }
}

/** Far hills and hedge. [SPEC-8.2] They dip behind the hive and the comb: the honey wood and the
 *  brown frame are too close to the dark green in lightness to stand against it (SPEC-13.5). */
function drawHills(): Container {
  const plane = new Container()
  const base = HORIZON_Y + 10
  const humps: readonly (readonly [number, number])[] = [
    [-700, 110],
    [-200, 80],
    [880, 0],
    [1420, 120],
    [1980, 90],
    [2500, 115],
    [RIGHT, 80],
  ]
  plane.addChild(
    piece((g) => {
      let x: number = DECOR_BOUNDS.x
      g.moveTo(x, BOTTOM).lineTo(x, base)
      for (const [to, height] of humps) {
        const width = to - x
        if (height === 0) g.lineTo(to, base)
        else g.bezierCurveTo(x + width * 0.3, base - height, x + width * 0.7, base - height, to, base)
        x = to
      }
      return g.lineTo(RIGHT, BOTTOM).closePath()
    }, PALETTE.leaf, null),
  )
  // The hedge: round bushes along the foot of the hills, right of the comb and left of the hive.
  for (const [i, x] of [-1300, -1060, -820, -560, 960, 1140, 1320, 1500, 1700, 1920, 2160, 2400, 2660].entries()) {
    plane.addChild(piece(lobed({ x, y: HORIZON_Y, rx: 120, ry: 48 }, 6, 300 + i, true), PALETTE.leaf, null))
  }
  // Light on the hedge, so that the bushes read as separate shapes.
  const light = new Graphics()
  for (const x of [-1300, -820, 960, 1320, 1700, 2160, 2660]) light.ellipse(x - 30, HORIZON_Y - 26, 44, 12)
  plane.addChild(light.fill({ color: PALETTE.grass, alpha: 0.35 }))
  return plane
}

/** A small flower of the far meadow, without stem. */
function speck(g: Graphics, x: number, y: number, size: number): Graphics {
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    g.circle(x + Math.cos(angle) * size, y + Math.sin(angle) * size, size * 0.8)
  }
  return g
}

function drawMeadow(): Container {
  const plane = new Container()
  plane.addChild(piece((g) => g.rect(DECOR_BOUNDS.x, HORIZON_Y, DECOR_BOUNDS.width, BOTTOM - HORIZON_Y), PALETTE.grass, null))
  // Far flowers, small: they get bigger towards the front.
  const rand = seededRandom(77)
  const pink = new Graphics()
  const cream = new Graphics()
  for (let i = 0; i < 70; i++) {
    const x = DECOR_BOUNDS.x + rand() * DECOR_BOUNDS.width
    const y = HORIZON_Y + 30 + rand() * 210
    // Clear of the stand of the hive and of the comb's legs.
    if (x > 0 && x < 840 && y < 820) continue
    speck(rand() < 0.5 ? pink : cream, x, y, 4 + ((y - HORIZON_Y) / 210) * 4)
  }
  plane.addChild(pink.fill(PALETTE.pink), cream.fill(PALETTE.cream))
  // Shade at the foot of the hive and of the comb.
  plane.addChild(
    new Graphics()
      .ellipse(HIVE.body.x + HIVE.body.width / 2, HIVE.groundY + 4, 220, 26)
      .ellipse(COMB.frame.x + COMB.frame.width / 2, COMB.groundY + 2, 220, 22)
      .fill({ ...shadowFill, alpha: shadowFill.alpha * 1.4 }),
  )
  return plane
}

/** Wooden boards: darker lines between them. */
function boards(rect: Rect, count: number, alpha: number): Graphics {
  const g = new Graphics()
  for (let i = 1; i < count; i++) {
    const y = rect.y + (rect.height * i) / count
    g.moveTo(rect.x + 6, y).lineTo(rect.x + rect.width - 6, y)
  }
  return g.stroke({ width: 4, color: PALETTE.ink, alpha })
}

/** [SPEC-13.3] The hive: stand, two boxes of honey-coloured wood, blue gable roof, flight hole
 *  open on a dark inside, the slot shown through the hole, then the flight board. */
function drawHive(slot: Container): Container {
  const hive = new Container()
  const { body, seamY, roofTop, eaves, hole, board, legs, legWidth, groundY } = HIVE
  const bottom = body.y + body.height
  const right = body.x + body.width
  const middle = body.x + body.width / 2
  for (const x of legs) hive.addChild(piece((g) => g.rect(x, bottom - 10, legWidth, groundY - bottom + 10), PALETTE.brown))
  hive.addChild(piece((g) => g.rect(legs[0] + legWidth, groundY - 70, legs[1] - legs[0] - legWidth, 16), PALETTE.brown, null))
  hive.addChild(piece((g) => g.rect(body.x, body.y, body.width, body.height), PALETTE.honey, BIG_SHADOW))
  hive.addChild(boards({ x: body.x, y: body.y, width: body.width, height: seamY - body.y }, 3, 0.12))
  hive.addChild(boards({ x: body.x, y: seamY, width: body.width, height: bottom - seamY }, 1, 0.12))
  // Seam between the boxes, and the handhold of the upper box.
  hive.addChild(new Graphics().rect(body.x, seamY - 4, body.width, 8).fill({ color: PALETTE.ink, alpha: 0.28 }))
  hive.addChild(new Graphics().roundRect(middle - 40, body.y + 52, 80, 20, 10).fill({ color: PALETTE.ink, alpha: 0.3 }))
  hive.addChild(
    piece(
      (g) =>
        g
          .moveTo(body.x - eaves, body.y + 14)
          .lineTo(middle, roofTop)
          .lineTo(right + eaves, body.y + 14)
          .closePath(),
      PALETTE.blue,
      BIG_SHADOW,
    ),
  )
  // The flight hole: a rounded slot on the dark inside, then the slot of the hiding bees.
  const corner = hole.height / 2
  hive.addChild(new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, corner).fill(PALETTE.ink))
  const mask = new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, corner).fill(PALETTE.cream)
  slot.mask = mask
  hive.addChild(mask, slot)
  // The flight board: its top, wider at the front, then its front edge in shade.
  const backLeft = body.x
  const backRight = right
  const frontRight = board.frontX + board.frontWidth
  hive.addChild(
    piece(
      (g) =>
        g
          .moveTo(backLeft, board.backY)
          .lineTo(backRight, board.backY)
          .lineTo(frontRight, board.frontY)
          .lineTo(frontRight, board.frontY + board.thickness)
          .lineTo(board.frontX, board.frontY + board.thickness)
          .lineTo(board.frontX, board.frontY)
          .closePath(),
      PALETTE.brown,
    ),
  )
  hive.addChild(
    new Graphics().rect(board.frontX, board.frontY, board.frontWidth, board.thickness).fill({ color: PALETTE.ink, alpha: 0.25 }),
  )
  return hive
}

/** Pointy-topped hexagon. */
function hexagon(g: Graphics, x: number, y: number, r: number): Graphics {
  g.moveTo(x, y - r)
  for (let i = 1; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3
    g.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle))
  }
  return g.closePath()
}

/** [SPEC-13.3] The frame of comb: legs, wooden frame with the lugs of its top bar, cream wax, and
 *  the cells, full of honey at the top, empty at the bottom. Returns the frame and the container
 *  over its cells, for the reward. */
function drawComb(): { node: Container; comb: Container } {
  const node = new Container()
  const { frame, bar, lug, legs, legWidth, groundY, cellRadius, wall } = COMB
  const bottom = frame.y + frame.height
  for (const x of legs) node.addChild(piece((g) => g.rect(x, bottom - 10, legWidth, groundY - bottom + 10), PALETTE.brown))
  node.addChild(
    piece(
      (g) =>
        g
          .rect(frame.x - lug, frame.y, frame.width + 2 * lug, bar)
          .rect(frame.x, frame.y + bar, frame.width, frame.height - bar),
      PALETTE.brown,
      BIG_SHADOW,
    ),
  )
  const inner = COMB_INNER
  node.addChild(new Graphics().rect(inner.x, inner.y, inner.width, inner.height).fill(PALETTE.cream))
  // Cells: the wax walls are the cream between them.
  const r = cellRadius - wall / Math.sqrt(3)
  const full = new Graphics()
  const empty = new Graphics()
  const depth = new Graphics()
  const gloss = new Graphics()
  for (const cell of CELLS) {
    if (cell.full) {
      hexagon(full, cell.x, cell.y, r)
      gloss.ellipse(cell.x - r * 0.3, cell.y - r * 0.35, r * 0.28, r * 0.16)
    } else {
      hexagon(empty, cell.x, cell.y, r)
      hexagon(depth, cell.x + 3, cell.y + 4, r * 0.62)
    }
  }
  node.addChild(full.fill(PALETTE.honey), empty.fill(PALETTE.brown), depth.fill({ color: PALETTE.ink, alpha: 0.3 }))
  node.addChild(gloss.fill({ color: PALETTE.cream, alpha: 0.45 }))
  const comb = new Container({ label: 'comb' })
  node.addChild(comb)
  return { node, comb }
}

/** [SPEC-13.3] A drop of honey hanging by its tip: drawn with its tip at the origin. One outline,
 *  so that its transparency is even. */
function drawDrop(): Container {
  const R = DRIP.radius
  const drop = new Graphics()
    .moveTo(0, 0)
    .lineTo(R * Math.cos(-Math.PI / 6), 2 * R + R * Math.sin(-Math.PI / 6))
    .arc(0, 2 * R, R, -Math.PI / 6, (7 * Math.PI) / 6)
    .closePath()
    .fill(PALETTE.honey)
  const node = new Container({ label: 'drop' })
  node.addChild(drop)
  node.position.set(DRIP.x, DRIP.y)
  return node
}

/** [SPEC-13.3] The stump and, on it, the open pot of honey. */
function drawStumpAndPot(): Container {
  const node = new Container()
  const { x, top, rx, groundY } = STUMP
  const ry = 18
  node.addChild(
    piece(
      (g) =>
        g
          .moveTo(x - rx, top)
          .lineTo(x - rx, groundY - 14)
          .quadraticCurveTo(x - rx - 26, groundY + 4, x - rx - 30, groundY + 6)
          .lineTo(x + rx + 30, groundY + 6)
          .quadraticCurveTo(x + rx + 26, groundY + 4, x + rx, groundY - 14)
          .lineTo(x + rx, top)
          .closePath(),
      PALETTE.brown,
    ),
  )
  node.addChild(new Graphics().ellipse(x, top, rx, ry).fill(PALETTE.honey))
  node.addChild(new Graphics().ellipse(x, top, rx * 0.55, ry * 0.5).stroke({ width: 4, color: PALETTE.brown, alpha: 0.45 }))
  // The pot: a round cream jar, its rim, the honey inside and a dribble down its side.
  const { mouthY, mouthRx, bellyRx, bottom } = POT
  const belly = { y: (mouthY + bottom) / 2 + 4, ry: (bottom - mouthY) / 2 - 4 }
  node.addChild(piece((g) => g.ellipse(x, belly.y, bellyRx, belly.ry), PALETTE.cream))
  node.addChild(new Graphics().ellipse(x, mouthY, mouthRx, 9).fill(PALETTE.honey))
  node.addChild(
    new Graphics()
      .moveTo(x - mouthRx - 6, mouthY)
      .quadraticCurveTo(x, mouthY + 22, x + mouthRx + 6, mouthY)
      .lineTo(x + mouthRx + 6, mouthY + 12)
      .quadraticCurveTo(x, mouthY + 34, x - mouthRx - 6, mouthY + 12)
      .closePath()
      .fill(PALETTE.cream),
  )
  node.addChild(
    new Graphics()
      .moveTo(x + 6, mouthY + 14)
      .quadraticCurveTo(x + 26, mouthY + 18, x + 28, mouthY + 14)
      .lineTo(x + 28, mouthY + 40)
      .arc(x + 21, mouthY + 40, 7, 0, Math.PI)
      .lineTo(x + 14, mouthY + 26)
      .quadraticCurveTo(x + 8, mouthY + 22, x + 6, mouthY + 14)
      .closePath()
      .fill(PALETTE.honey),
  )
  node.addChild(new Graphics().ellipse(x - bellyRx * 0.45, belly.y - belly.ry * 0.2, 10, 16).fill({ color: PALETTE.honey, alpha: 0.25 }))
  return node
}

function drawApiary(slots: Record<SlotHideoutId, Container>): { plane: Container; comb: Container; drop: Container } {
  const plane = new Container()
  const comb = drawComb()
  const drop = drawDrop()
  plane.addChild(drawHive(slots.hive), comb.node, drop, drawStumpAndPot())
  return { plane, comb: comb.comb, drop }
}

/** Head of a flower: round petals around a yellow heart, over one round shadow. */
function flowerHead(x: number, y: number, radius: number, color: 'pink' | 'blue' | 'cream'): Container {
  const head = new Container()
  head.addChild(new Graphics().circle(x + SHADOW.x * 0.7, y + SHADOW.y * 0.7, radius * 0.95).fill(shadowFill))
  const [count, distance, size] = color === 'blue' ? [8, 0.64, 0.36] : [6, 0.58, 0.42]
  const petals = new Graphics()
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    petals.circle(x + Math.cos(angle) * radius * distance, y + Math.sin(angle) * radius * distance, radius * size)
  }
  head.addChild(petals.fill(PALETTE[color]))
  // [SPEC-13.5] A daisy's heart is honey: yellow on cream would not show.
  head.addChild(new Graphics().circle(x, y, radius * 0.36).fill(color === 'cream' ? PALETTE.honey : PALETTE.yellow))
  return head
}

/** A stem from the ground point up to under the head, with a leaf on one side. */
function stem(x: number, ground: number, top: number, width: number, leafSide: 1 | -1, leafSize: number): Container {
  const node = new Container()
  const lean = leafSide * 8
  const path: PathBuilder = (g) =>
    g
      .moveTo(x - width / 2, ground)
      .quadraticCurveTo(x + lean - width / 2, (ground + top) / 2, x - width / 2, top)
      .lineTo(x + width / 2, top)
      .quadraticCurveTo(x + lean + width / 2, (ground + top) / 2, x + width / 2, ground)
      .closePath()
  node.addChild(path(new Graphics()).fill(PALETTE.leaf))
  const leafY = ground - (ground - top) * 0.35
  const leaf = new Graphics()
    .ellipse(0, 0, leafSize, leafSize * 0.38)
    .fill(PALETTE.leaf)
  leaf.position.set(x + leafSide * leafSize * 0.85, leafY)
  leaf.rotation = -leafSide * 0.5
  node.addChild(leaf)
  return node
}

function drawFlower(f: Flower, i: number, stemWidth = 10): Container {
  const node = new Container()
  const head = f.y - f.height
  node.addChild(stem(f.x, f.y, head, stemWidth, i % 2 ? 1 : -1, f.radius * 0.6))
  node.addChild(flowerHead(f.x, head, f.radius, f.color))
  return node
}

/** Daisies of the meadow, where no animal perches: they sway. */
const DAISIES: readonly (readonly [number, number, number, number])[] = [
  // x, ground, height, radius
  [620, 880, 60, 26],
  [1120, 810, 60, 24],
  [420, 1060, 80, 28],
  [200, 870, 60, 24],
  [1420, 790, 80, 26],
  [840, 1050, 60, 24],
  [-160, 900, 80, 28],
  [-420, 760, 60, 24],
  [1640, 940, 80, 28],
  [1880, 780, 60, 24],
]

function drawFlowers(daisies: Swaying[]): Container {
  const plane = new Container()
  const flowers: { ground: number; node: Container }[] = []
  for (const [i, [x, ground, height, radius]] of DAISIES.entries()) {
    const daisy = pivoted({ x, y: ground })
    daisy.addChild(stem(x, ground, ground - height, 7, i % 2 ? 1 : -1, radius * 0.7))
    daisy.addChild(flowerHead(x, ground - height, radius, 'cream'))
    daisies.push({ node: daisy, phase: (i * 0.37) % 1 })
    flowers.push({ ground, node: daisy })
  }
  // [SPEC-13.2.2] The big flowers of the clump, behind its leaves, and the flowers of the bees.
  for (const [i, f] of BIG_FLOWERS.entries()) flowers.push({ ground: f.y, node: drawFlower(f, i, 14) })
  for (const [i, f] of BEE_FLOWERS.entries()) flowers.push({ ground: f.y, node: drawFlower(f, i) })
  // Back to front: a nearer flower covers a farther one.
  for (const { node } of flowers.sort((a, b) => a.ground - b.ground)) plane.addChild(node)
  return plane
}

/** A tuft of grass blades standing on `base`. */
function tuft(x: number, base: number, seed: number): Container {
  const node = pivoted({ x, y: base })
  const rand = seededRandom(seed)
  const blades = new Graphics()
  for (let i = 0; i < 4; i++) {
    const root = x - 30 + i * 20
    const height = 28 + rand() * 16
    const lean = (rand() - 0.5) * 30
    blades.moveTo(root - 9, base).quadraticCurveTo(root + lean * 0.4, base - height * 0.6, root + lean, base - height).quadraticCurveTo(root + lean * 0.4 + 4, base - height * 0.4, root + 9, base).closePath()
  }
  node.addChild(blades.fill(PALETTE.leaf))
  return node
}

function drawForeground(clump: Swaying[], tufts: Swaying[]): Container {
  const plane = new Container()
  for (let i = 0, x = DECOR_BOUNDS.x + 40; x < RIGHT; i++, x += 150 + ((i * 37) % 50)) {
    const node = tuft(x, 1086, 500 + i)
    tufts.push({ node, phase: (i * 0.29) % 1 })
    plane.addChild(node)
  }
  // [SPEC-13.2.2] The leaves of the clump hide the butterflies.
  const leaves = pivoted({ x: CLUMP.x, y: CLUMP.y })
  leaves.addChild(piece(lobed(CLUMP, 9, 61, true), PALETTE.leaf, BIG_SHADOW))
  leaves.addChild(piece(lobed({ x: CLUMP.x + 20, y: CLUMP.y, rx: CLUMP.rx * 0.6, ry: CLUMP.ry * 0.62 }, 6, 63, true), PALETTE.grass, null))
  leaves.addChild(
    new Graphics()
      .moveTo(CLUMP.x - 70, CLUMP.y - 20)
      .quadraticCurveTo(CLUMP.x - 80, CLUMP.y - 90, CLUMP.x - 40, CLUMP.y - 140)
      .moveTo(CLUMP.x + 90, CLUMP.y - 20)
      .quadraticCurveTo(CLUMP.x + 110, CLUMP.y - 80, CLUMP.x + 80, CLUMP.y - 130)
      .stroke({ width: 6, color: PALETTE.grass, alpha: 0.8, cap: 'round' }),
  )
  clump.push({ node: leaves, phase: 0 })
  plane.addChild(leaves)
  return plane
}

export function createApiary(): Apiary {
  const actors = new Container({ label: 'actors' })
  const slots = {} as Record<SlotHideoutId, Container>
  for (const id of SLOT_HIDEOUT_IDS) slots[id] = new Container({ label: `slot:${id}` })
  const daisies: Swaying[] = []
  const clump: Swaying[] = []
  const tufts: Swaying[] = []

  const sky = drawSky()
  const apiary = drawApiary(slots)
  const planes: Record<PlaneId, Container> = {
    sky: sky.plane,
    hills: drawHills(),
    meadow: drawMeadow(),
    apiary: apiary.plane,
    flowers: drawFlowers(daisies),
    foreground: drawForeground(clump, tufts),
  }
  const root = new Container({ label: 'apiary' })
  root.addChild(planes.sky, planes.hills, planes.meadow, planes.apiary, planes.flowers, actors, planes.foreground)

  let visible: Rect = { x: 0, y: 0, width: 0, height: 0 }
  let time = 0
  const tick = (dt: number) => {
    time += dt
    for (const { node, phase } of daisies) node.rotation = oscillate(AMBIENT.daisy, time, phase)
    for (const { node, phase } of tufts) node.rotation = oscillate(AMBIENT.tuft, time, phase)
    for (const { node, phase } of clump) node.skew.x = oscillate(AMBIENT.clump, time, phase)
    const drop = dropAt(time)
    apiary.drop.visible = drop.scale > 0 && drop.alpha > 0
    apiary.drop.scale.set(drop.scale)
    apiary.drop.alpha = drop.alpha
    apiary.drop.y = DRIP.y + drop.fall * (DRIP.fallTo - DRIP.y)
    // Clouds drift right and come back on the left of what the screen shows.
    for (const cloud of sky.clouds) {
      const margin = cloud.rx * 1.3
      cloud.node.x = wrap(cloud.x + cloud.speed * time, visible.x - margin, visible.x + visible.width + margin)
    }
  }

  return {
    root,
    planes,
    actors,
    slots,
    comb: apiary.comb,
    resize(width, height) {
      const view = viewport(width, height)
      visible = view.visible
      root.scale.set(view.scale)
      root.position.set(view.offsetX, view.offsetY)
      tick(0)
    },
    tick,
  }
}
