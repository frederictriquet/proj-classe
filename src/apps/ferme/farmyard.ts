// [SPEC-8.1] [SPEC-8.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-12.3] The farmyard of « Ferme du
// silence », drawn in code with PixiJS in paper cut-out style: flat colours of the farm palette,
// round shapes, a soft shadow under each piece. Five planes (sky, hills, ground, buildings,
// foreground), six hideouts, and quiet permanent life (slow clouds, swaying reeds and cabbages).
//
// For the animals: each hideout has a slot, a container placed right behind the shape that hides
// it (see `Hideout.cover` in layout.ts). The foreground hideouts (haystack, garden, reeds) hide
// the animals of the actors layer, drawn in front of the buildings and behind the foreground.
// Everything is in world units (layout.ts): `resize` scales the whole farmyard to the screen.
import { Container, Graphics } from 'pixi.js'
import { oscillate, wrap } from '../../silence/ambient'
import type { Decor } from '../../silence/decor'
import { viewport, type Ellipse, type Rect } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT } from './ambient'
import {
  BARN,
  CABBAGES,
  DECOR_BOUNDS,
  HAYSTACK,
  HENHOUSE,
  SLOT_HIDEOUT_IDS,
  HORIZON_Y,
  MUD,
  POND,
  REEDS,
  STY,
  SUN,
  type SlotHideoutId,
  type PlaneId,
} from './layout'
import { PALETTE } from './palette'

/** [SPEC-9.8] The decor of the farm, as the shared code sees it, plus its planes. */
export interface Farmyard extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** One container per hideout of the buildings, right behind the shape that hides an animal. */
  readonly slots: Readonly<Record<SlotHideoutId, Container>>
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)

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
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius).fill(PALETTE.straw))
  const { min, max } = AMBIENT.cloudSpeed
  const clouds = (
    [
      [140, 110, 140, 64],
      [660, 60, 120, 56],
      [980, 210, 130, 60],
      [1750, 120, 130, 60],
      [-380, 230, 120, 56],
    ] as const
  ).map(([x, y, rx, ry], i): Cloud => {
    const node = piece(lobed({ x: 0, y: 0, rx, ry }, 5, 50 + i, true), PALETTE.cream)
    node.position.set(x, y)
    plane.addChild(node)
    return { x, rx, node, speed: min + ((max - min) * ((i * 3) % 5)) / 4 }
  })
  return { plane, clouds }
}

/** A line of rolling hills between the left and right edges of the decor, standing on `baseY`,
 *  filled down to the bottom of the decor. */
function hills(baseY: number, heights: [number, number], widths: [number, number], seed: number): PathBuilder {
  return (g) => {
    const rand = seededRandom(seed)
    let x = DECOR_BOUNDS.x
    g.moveTo(x, BOTTOM).lineTo(x, baseY)
    while (x < RIGHT) {
      const width = widths[0] + rand() * (widths[1] - widths[0])
      const height = heights[0] + rand() * (heights[1] - heights[0])
      g.bezierCurveTo(x + width * 0.3, baseY - height, x + width * 0.7, baseY - height, x + width, baseY)
      x += width
    }
    return g.lineTo(x, BOTTOM).closePath()
  }
}

/** Far hills with fields of wheat, a hedge and round trees at the foot of the near hills. */
function drawHills(): Container {
  const plane = new Container()
  plane.addChild(piece(hills(450, [70, 120], [520, 760], 3), PALETTE.leaf, null))
  // Fields of wheat on the far hills, as soft bands.
  const fields = new Graphics()
  for (const [x, y, w, h] of [
    [-160, 418, 420, 34],
    [520, 404, 380, 30],
    [1180, 412, 460, 34],
  ] as const) {
    fields.roundRect(x, y, w, h, h / 2)
  }
  plane.addChild(fields.fill({ color: PALETTE.straw, alpha: 0.85 }))
  plane.addChild(piece(hills(HORIZON_Y + 10, [30, 60], [380, 560], 9), PALETTE.grass, null))
  // Round trees standing on the near hills.
  for (const [i, [x, r]] of (
    [
      [-520, 46],
      [700, 40],
      [860, 52],
      [1960, 48],
    ] as const
  ).entries()) {
    plane.addChild(piece((g) => g.rect(x - 7, HORIZON_Y - 30, 14, 40), PALETTE.brown, null))
    plane.addChild(piece(lobed({ x, y: HORIZON_Y - 40 - r * 0.6, rx: r, ry: r * 0.9 }, 7, 70 + i), PALETTE.leaf))
  }
  return plane
}

function flower(x: number, y: number, size: number): Graphics {
  const g = new Graphics()
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    g.circle(x + Math.cos(angle) * size, y + Math.sin(angle) * size, size * 0.85)
  }
  return g.fill(PALETTE.cream).circle(x, y, size * 0.7).fill(PALETTE.straw)
}

function ellipsePath(e: Ellipse): PathBuilder {
  return (g) => g.ellipse(e.x, e.y, e.rx, e.ry)
}

function drawGround(): Container {
  const plane = new Container()
  plane.addChild(
    piece((g) => g.rect(DECOR_BOUNDS.x, HORIZON_Y, DECOR_BOUNDS.width, BOTTOM - HORIZON_Y), PALETTE.grass, null),
  )
  // Mud in front of the pigsty, with two puddles of darker mud.
  plane.addChild(piece(ellipsePath(MUD), PALETTE.brown))
  plane.addChild(
    new Graphics()
      .ellipse(MUD.x - 50, MUD.y + 6, 34, 10)
      .ellipse(MUD.x + 58, MUD.y - 8, 28, 8)
      .fill({ color: PALETTE.ink, alpha: 0.18 }),
  )
  // The pond: a bank of mud, the water, two calm ripples.
  plane.addChild(piece(ellipsePath({ ...POND, rx: POND.rx + 14, ry: POND.ry + 10 }), PALETTE.brown))
  plane.addChild(new Graphics().ellipse(POND.x, POND.y, POND.rx, POND.ry).fill(PALETTE.blue))
  plane.addChild(
    new Graphics()
      .moveTo(POND.x - 150, POND.y - 18)
      .quadraticCurveTo(POND.x - 100, POND.y - 30, POND.x - 50, POND.y - 18)
      .moveTo(POND.x + 20, POND.y + 26)
      .quadraticCurveTo(POND.x + 80, POND.y + 14, POND.x + 140, POND.y + 26)
      .stroke({ width: 7, color: PALETTE.cream, alpha: 0.45, cap: 'round' }),
  )
  for (const [x, y, size] of [
    [520, 640, 14],
    [960, 660, 13],
    [-120, 860, 16],
    [1580, 830, 15],
    [880, 930, 14],
    [610, 870, 12],
  ] as const) {
    plane.addChild(flower(x, y, size))
  }
  return plane
}

/** Wooden boards, darker lines between them. */
function boards(rect: Rect, count: number, alpha = 0.22): Graphics {
  const g = new Graphics()
  for (let i = 1; i < count; i++) {
    const x = rect.x + (rect.width * i) / count
    g.moveTo(x, rect.y + 6).lineTo(x, rect.y + rect.height - 4)
  }
  return g.stroke({ width: 4, color: PALETTE.ink, alpha })
}

/** Barn: red wall, brown roof, hayloft window, big door open on a dark inside. The slot shows
 *  only the door and what lies below the wall. */
function drawBarn(slot: Container): Container {
  const barn = new Container()
  const { wall, door, roofTop, eaves } = BARN
  const bottom = wall.y + wall.height
  const middle = wall.x + wall.width / 2
  barn.addChild(piece((g) => g.rect(wall.x, wall.y, wall.width, wall.height), PALETTE.red, BIG_SHADOW))
  barn.addChild(boards(wall, 12, 0.16))
  // Gable roof, a little wider than the wall.
  barn.addChild(
    piece(
      (g) =>
        g
          .moveTo(wall.x - eaves, wall.y + 18)
          .lineTo(middle, roofTop)
          .lineTo(wall.x + wall.width + eaves, wall.y + 18)
          .lineTo(wall.x + wall.width + eaves, wall.y + 44)
          .lineTo(middle, roofTop + 30)
          .lineTo(wall.x - eaves, wall.y + 44)
          .closePath(),
      PALETTE.brown,
      BIG_SHADOW,
    ),
  )
  // Hayloft window under the gable, with hay showing.
  const loft = { x: middle - 46, y: roofTop + 70, width: 92, height: 74 }
  barn.addChild(piece((g) => g.roundRect(loft.x - 10, loft.y - 10, loft.width + 20, loft.height + 20, 8), PALETTE.cream))
  barn.addChild(new Graphics().rect(loft.x, loft.y, loft.width, loft.height).fill(PALETTE.ink))
  barn.addChild(piece(lobed({ x: middle, y: loft.y + loft.height, rx: 40, ry: 34 }, 5, 12, true), PALETTE.straw, null))
  // The door: frame, dark inside, then the slot over the inside.
  barn.addChild(piece((g) => g.rect(door.x - 16, door.y - 16, door.width + 32, door.height + 16), PALETTE.cream))
  barn.addChild(new Graphics().rect(door.x, door.y, door.width, door.height).fill(PALETTE.ink))
  const mask = new Graphics()
    .rect(door.x, door.y, door.width, door.height)
    .rect(DECOR_BOUNDS.x, bottom, DECOR_BOUNDS.width, BOTTOM - bottom)
    .fill(PALETTE.cream)
  slot.mask = mask
  barn.addChild(mask, slot)
  return barn
}

/** Henhouse on stilts: stilts, wooden body, red roof, small door, the ramp down to the yard, then
 *  the slot. The slot shows only the door, what lies left of it and what lies below the body. */
function drawHenhouse(slot: Container): Container {
  const house = new Container()
  const { body, door, roofTop, stiltBase, ramp } = HENHOUSE
  const bottom = body.y + body.height
  for (const x of [body.x + 18, body.x + body.width - 30]) {
    house.addChild(piece((g) => g.rect(x, bottom - 10, 14, stiltBase - bottom + 10), PALETTE.brown))
  }
  house.addChild(piece((g) => g.rect(body.x, body.y, body.width, body.height), PALETTE.brown, BIG_SHADOW))
  house.addChild(boards(body, 6, 0.2))
  house.addChild(
    piece(
      (g) =>
        g
          .moveTo(body.x - 24, body.y + 10)
          .lineTo(body.x + body.width / 2, roofTop)
          .lineTo(body.x + body.width + 24, body.y + 10)
          .closePath(),
      PALETTE.red,
    ),
  )
  // Round window on the right of the front.
  house.addChild(new Graphics().circle(body.x + 150, body.y + 62, 22).fill(PALETTE.cream).circle(body.x + 150, body.y + 62, 15).fill(PALETTE.ink))
  house.addChild(new Graphics().roundRect(door.x, door.y, door.width, door.height, 8).fill(PALETTE.ink))
  // The ramp, a plank with cleats, from the door sill down to the yard.
  const dx = ramp.to.x - ramp.from.x
  const dy = ramp.to.y - ramp.from.y
  const length = Math.hypot(dx, dy)
  const nx = (-dy / length) * 8
  const ny = (dx / length) * 8
  house.addChild(
    piece(
      (g) =>
        g
          .moveTo(ramp.from.x - nx, ramp.from.y - ny)
          .lineTo(ramp.to.x - nx, ramp.to.y - ny)
          .lineTo(ramp.to.x + nx, ramp.to.y + ny)
          .lineTo(ramp.from.x + nx, ramp.from.y + ny)
          .closePath(),
      PALETTE.brown,
    ),
  )
  const cleats = new Graphics()
  for (let i = 1; i < 6; i++) {
    const x = ramp.from.x + (dx * i) / 6
    const y = ramp.from.y + (dy * i) / 6
    cleats.moveTo(x - nx * 0.8, y - ny * 0.8).lineTo(x + nx * 0.8, y + ny * 0.8)
  }
  house.addChild(cleats.stroke({ width: 5, color: PALETTE.cream, alpha: 0.7, cap: 'round' }))
  // The slot over the ramp: a hen in it is drawn as in the actors layer, in front of the ramp.
  const mask = new Graphics()
    .rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, door.x - DECOR_BOUNDS.x, DECOR_BOUNDS.height)
    .rect(door.x, door.y, door.width, door.height)
    .rect(door.x, bottom, DECOR_BOUNDS.x + DECOR_BOUNDS.width - door.x, BOTTOM - bottom)
    .fill(PALETTE.cream)
  slot.mask = mask
  house.addChild(mask, slot)
  return house
}

/** Pigsty: hut with a red roof, the slot, then the fence of planks in front. */
function drawSty(slot: Container): Container {
  const sty = new Container()
  const { hut, fence } = STY
  sty.addChild(piece((g) => g.rect(hut.x, hut.y, hut.width, hut.height), PALETTE.brown))
  sty.addChild(new Graphics().roundRect(hut.x + 60, hut.y + 40, 70, hut.height - 40, 10).fill(PALETTE.ink))
  sty.addChild(
    piece(
      (g) =>
        g
          .moveTo(hut.x - 20, hut.y + 12)
          .lineTo(hut.x + hut.width / 2, hut.y - 60)
          .lineTo(hut.x + hut.width + 20, hut.y + 12)
          .closePath(),
      PALETTE.red,
    ),
  )
  sty.addChild(slot)
  // Planks with rounded tops, side by side: one outline.
  const planks = 7
  const width = fence.width / planks
  sty.addChild(
    piece((g) => {
      const base = fence.y + fence.height
      g.moveTo(fence.x, base)
      for (let i = 0; i < planks; i++) {
        const x = fence.x + i * width
        const top = fence.y + (i % 2 ? 10 : 0)
        g.lineTo(x, top + width / 2).quadraticCurveTo(x + width / 2, top - width / 4, x + width, top + width / 2)
      }
      return g.lineTo(fence.x + fence.width, base).closePath()
    }, PALETTE.brown),
  )
  sty.addChild(boards({ x: fence.x, y: fence.y + 20, width: fence.width, height: fence.height - 20 }, planks, 0.25))
  sty.addChild(
    new Graphics()
      .rect(fence.x - 4, fence.y + 38, fence.width + 4, 12)
      .rect(fence.x - 4, fence.y + 86, fence.width + 4, 12)
      .fill({ color: PALETTE.ink, alpha: 0.2 }),
  )
  return sty
}

function drawBuildings(slots: Record<SlotHideoutId, Container>): Container {
  const plane = new Container()
  plane.addChild(drawBarn(slots.barn), drawHenhouse(slots.henhouse), drawSty(slots.sty))
  return plane
}

/** Haystack: a lobed dome of hay with a few darker wisps. */
function drawHaystack(): Container {
  const stack = new Container()
  stack.addChild(piece(lobed(HAYSTACK, 9, 31, true), PALETTE.straw, BIG_SHADOW))
  const wisps = new Graphics()
  const rand = seededRandom(33)
  for (let i = 0; i < 9; i++) {
    const x = HAYSTACK.x + (rand() - 0.5) * HAYSTACK.rx * 1.3
    const y = HAYSTACK.y - 40 - rand() * HAYSTACK.ry * 0.75
    const lean = (rand() - 0.5) * 30
    wisps.moveTo(x, y).quadraticCurveTo(x + lean, y - 20, x + lean * 1.6, y - 44)
  }
  stack.addChild(wisps.stroke({ width: 5, color: PALETTE.brown, alpha: 0.35, cap: 'round' }))
  return stack
}

/** A cabbage: a lobed dome of leaves with two veins. */
function drawCabbage(e: Ellipse, seed: number): Container {
  const cabbage = pivoted({ x: e.x, y: e.y })
  cabbage.addChild(piece(lobed(e, 7, seed, true), PALETTE.leaf, BIG_SHADOW))
  cabbage.addChild(piece(lobed({ x: e.x + e.rx * 0.06, y: e.y, rx: e.rx * 0.66, ry: e.ry * 0.72 }, 5, seed + 1, true), PALETTE.leaf))
  cabbage.addChild(
    new Graphics()
      .moveTo(e.x, e.y - 10)
      .quadraticCurveTo(e.x - e.rx * 0.2, e.y - e.ry * 0.5, e.x - e.rx * 0.05, e.y - e.ry * 0.8)
      .moveTo(e.x + e.rx * 0.2, e.y - 10)
      .quadraticCurveTo(e.x + e.rx * 0.45, e.y - e.ry * 0.45, e.x + e.rx * 0.35, e.y - e.ry * 0.7)
      .stroke({ width: 5, color: PALETTE.grass, alpha: 0.8, cap: 'round' }),
  )
  return cabbage
}

/** Clump of reeds: a lobed dome of leaves, long blades and two brown cattails. */
function drawReeds(): Container {
  const reeds = pivoted({ x: REEDS.x, y: REEDS.y })
  const blades = new Graphics()
  for (const [dx, height, lean] of [
    [-90, 250, -0.25],
    [-40, 300, -0.08],
    [20, 280, 0.06],
    [80, 240, 0.2],
  ] as const) {
    const root = { x: REEDS.x + dx, y: REEDS.y - 60 }
    const tip = { x: root.x + Math.sin(lean) * height, y: root.y - Math.cos(lean) * height }
    blades.moveTo(root.x - 12, root.y).quadraticCurveTo(root.x + Math.sin(lean) * height * 0.5 - 4, root.y - height * 0.5, tip.x, tip.y).quadraticCurveTo(root.x + Math.sin(lean) * height * 0.5 + 8, root.y - height * 0.5, root.x + 12, root.y)
  }
  reeds.addChild(blades.fill(PALETTE.leaf))
  for (const [dx, height] of [
    [-55, 270],
    [50, 250],
  ] as const) {
    const x = REEDS.x + dx
    reeds.addChild(new Graphics().rect(x - 3, REEDS.y - height, 6, height).fill(PALETTE.leaf))
    reeds.addChild(piece((g) => g.roundRect(x - 11, REEDS.y - height - 20, 22, 64, 11), PALETTE.brown))
  }
  reeds.addChild(piece(lobed(REEDS, 8, 41, true), PALETTE.leaf, BIG_SHADOW))
  return reeds
}

function drawForeground(cabbages: Swaying[], reeds: Swaying[]): Container {
  const plane = new Container()
  plane.addChild(drawHaystack())
  for (const [i, e] of CABBAGES.entries()) {
    const cabbage = drawCabbage(e, 20 + 3 * i)
    cabbages.push({ node: cabbage, phase: i / 3 })
    plane.addChild(cabbage)
  }
  const clump = drawReeds()
  reeds.push({ node: clump, phase: 0 })
  plane.addChild(clump)
  return plane
}

export function createFarmyard(): Farmyard {
  const actors = new Container({ label: 'actors' })
  const slots = {} as Record<SlotHideoutId, Container>
  for (const id of SLOT_HIDEOUT_IDS) slots[id] = new Container({ label: `slot:${id}` })
  const cabbages: Swaying[] = []
  const reeds: Swaying[] = []

  const sky = drawSky()
  const planes: Record<PlaneId, Container> = {
    sky: sky.plane,
    hills: drawHills(),
    ground: drawGround(),
    buildings: drawBuildings(slots),
    foreground: drawForeground(cabbages, reeds),
  }
  const root = new Container({ label: 'farmyard' })
  root.addChild(planes.sky, planes.hills, planes.ground, planes.buildings, actors, planes.foreground)

  let visible: Rect = { x: 0, y: 0, width: 0, height: 0 }
  let time = 0
  const tick = (dt: number) => {
    time += dt
    for (const { node, phase } of reeds) node.rotation = oscillate(AMBIENT.reeds, time, phase)
    for (const { node, phase } of cabbages) node.skew.x = oscillate(AMBIENT.cabbage, time, phase)
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
