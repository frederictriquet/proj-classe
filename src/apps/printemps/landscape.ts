// [SPEC-8.1] [SPEC-8.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-17.3] The spring meadow of « Printemps
// du silence », drawn in code with PixiJS in paper cut-out style: flat colours of the spring
// palette, round shapes, a soft shadow under each piece. Five planes (sky, far, back, middle,
// foreground), the hideouts of the characters, and quiet permanent life (tufts of grass swaying a
// little, a small cloud passing far away) [SPEC-17.3].
//
// For the characters: the skep, the nest box and the swallows' cloud each have a slot, a container
// right behind the shape that hides them; the slots of the skep and of the nest box are shown only
// through their hole. The front of the nest, the molehill and the pile of leaves are in the foreground: they hide the
// characters of the actors layer, drawn in front of the middle plane and behind the foreground.
// Everything is in world units (layout.ts): `resize` scales the whole landscape.
import { Container, Graphics } from 'pixi.js'
import { oscillate, wrap } from '../../silence/ambient'
import type { Decor } from '../../silence/decor'
import { viewport, type Ellipse, type Rect } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT } from './ambient'
import {
  BRANCHES,
  DECOR_BOUNDS,
  FAR_VALLEY,
  FENCE,
  HORIZON_Y,
  LEAF_PILE,
  MOLEHILL,
  NEST,
  NEST_BOX,
  SKEP,
  SKEP_BOARD,
  SKEP_HOLE,
  SLOT_HIDEOUT_IDS,
  SUN,
  SUN_CLOUD,
  SWALLOW_CLOUD,
  TREE,
  TUFTS,
  type Limb,
  type PlaneId,
  type SlotHideoutId,
} from './layout'
import { PALETTE } from './palette'

/** [SPEC-9.8] The decor of spring, as the shared code sees it, plus what the reward changes. */
export interface Landscape extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** One container per hideout with a slot, right behind the shape that hides a character. */
  readonly slots: Readonly<Record<SlotHideoutId, Container>>
  /** [SPEC-17.4] Right in front of the branches of the cherry tree: the blossoms of the reward. */
  readonly crown: Container
  /** [SPEC-17.4] The cloud in front of the sun, which the reward slides away. */
  readonly sunCloud: Container
  /** Over the whole landscape, in front of the characters: the petals of the reward. */
  readonly air: Container
  /** Part of the world the screen shows, world units. */
  readonly visible: Rect
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)

/** A limb of a tree from `from` to `to`, `t0` thick at its root and `t1` at its tip. */
export function limb({ from, to, t0, t1 }: Limb): PathBuilder {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const nx = -dy / length
  const ny = dx / length
  return (g) =>
    g
      .moveTo(from.x + (nx * t0) / 2, from.y + (ny * t0) / 2)
      .lineTo(to.x + (nx * t1) / 2, to.y + (ny * t1) / 2)
      .quadraticCurveTo(to.x + (dx / length) * t1 * 0.6, to.y + (dy / length) * t1 * 0.6, to.x - (nx * t1) / 2, to.y - (ny * t1) / 2)
      .lineTo(from.x - (nx * t0) / 2, from.y - (ny * t0) / 2)
      .closePath()
}

/** A smooth dome whose height is `ry` (an ellipse cut on its centre line), as a polygon. */
function ellipseDome(e: Ellipse): PathBuilder {
  return (g) => {
    const points: number[] = []
    for (let i = 0; i <= 48; i++) {
      const a = Math.PI + (i / 48) * Math.PI
      points.push(e.x + e.rx * Math.cos(a), e.y + e.ry * Math.sin(a))
    }
    return g.poly(points)
  }
}

/** A line of rolling hills between the edges of the decor, standing on `baseY`, filled down to the
 *  bottom of the decor. No hill rises over the valley [SPEC-17.5.1]. */
function hills(baseY: number, heights: [number, number], widths: [number, number], seed: number): PathBuilder {
  return (g) => {
    const rand = seededRandom(seed)
    let x = DECOR_BOUNDS.x
    g.moveTo(x, BOTTOM).lineTo(x, baseY)
    while (x < RIGHT) {
      let width = widths[0] + rand() * (widths[1] - widths[0])
      let height = heights[0] + rand() * (heights[1] - heights[0])
      // A hill that would reach into the valley ends at its edge, or the valley stays flat.
      if (x < FAR_VALLEY.from && x + width > FAR_VALLEY.from) {
        // Shortened: lower too, so that it does not turn into a spike.
        height *= Math.min(1, (FAR_VALLEY.from - x) / width)
        width = FAR_VALLEY.from - x
      }
      else if (x >= FAR_VALLEY.from && x < FAR_VALLEY.to) {
        width = FAR_VALLEY.to - x
        height = 0
      }
      if (height > 0) g.bezierCurveTo(x + width * 0.3, baseY - height, x + width * 0.7, baseY - height, x + width, baseY)
      else g.lineTo(x + width, baseY)
      x += width
    }
    return g.lineTo(x, BOTTOM).closePath()
  }
}

/** A cream cloud of lobes. */
function cloud(e: Ellipse, seed: number): Container {
  return piece(lobed(e, 9, seed), PALETTE.cream, null)
}

/** The sky, a paler band along the horizon, the sun and its cloud, and the swallows' cloud with
 *  their slot behind it. The small passing cloud is added by `createLandscape`. */
function drawSky(slot: Container, sunCloud: Container): Container {
  const plane = new Container()
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, HORIZON_Y + 200 - DECOR_BOUNDS.y).fill(PALETTE.sky))
  // A paler band along the horizon, in two steps.
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, HORIZON_Y - 260, DECOR_BOUNDS.width, 460).fill({ color: PALETTE.cream, alpha: 0.06 }))
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, HORIZON_Y - 140, DECOR_BOUNDS.width, 340).fill({ color: PALETTE.cream, alpha: 0.06 }))
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius * 1.35).fill({ color: PALETTE.cream, alpha: 0.2 }))
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius).fill(PALETTE.yellow))
  sunCloud.addChild(cloud(SUN_CLOUD, 7))
  plane.addChild(sunCloud)
  plane.addChild(slot)
  plane.addChild(cloud(SWALLOW_CLOUD, 13))
  return plane
}

/** Far hills of leaf green, a little bluer with the distance, then the meadow. */
function drawFar(): Container {
  const plane = new Container()
  plane.addChild(piece(hills(HORIZON_Y + 10, [70, 130], [480, 760], 5), PALETTE.leaf, null))
  plane.addChild(hills(HORIZON_Y + 10, [70, 130], [480, 760], 5)(new Graphics()).fill({ color: PALETTE.sky, alpha: 0.22 }))
  plane.addChild(piece((g) => g.rect(DECOR_BOUNDS.x, HORIZON_Y, DECOR_BOUNDS.width, BOTTOM - HORIZON_Y), PALETTE.grass, null))
  // Soft patches of darker grass.
  const patches = new Graphics()
  for (const [x, y, rx, ry] of [
    [-260, 700, 300, 34],
    [560, 900, 280, 30],
    [1180, 720, 240, 26],
    [1760, 860, 320, 34],
    [300, 1060, 260, 28],
  ] as const)
    patches.ellipse(x, y, rx, ry)
  plane.addChild(patches.fill({ color: PALETTE.leaf, alpha: 0.12 }))
  return plane
}

/** The fence at the back: posts and two rails, across to the right edge of the decor. */
function drawFence(): Container {
  const fence = new Container()
  const { from, groundY, postTop, postWidth, postStep, rails } = FENCE
  for (const rail of rails) fence.addChild(piece((g) => g.roundRect(from - 20, rail.y, RIGHT - from, rail.height, 6), PALETTE.brown))
  for (let x = from; x < RIGHT; x += postStep) {
    fence.addChild(piece((g) => g.moveTo(x, groundY).lineTo(x, postTop + 10).lineTo(x + postWidth / 2, postTop).lineTo(x + postWidth, postTop + 10).lineTo(x + postWidth, groundY).closePath(), PALETTE.brown))
  }
  // Grain: a darker line along each rail.
  const grain = new Graphics()
  for (const rail of rails) grain.moveTo(from - 10, rail.y + rail.height / 2).lineTo(RIGHT, rail.y + rail.height / 2)
  fence.addChild(grain.stroke({ width: 3, color: PALETTE.ink, alpha: 0.2 }))
  return fence
}

/** The nest box on its post: the front, its dark hole and the tit's slot shown through it, then the
 *  red gable roof. */
function drawNestBox(slot: Container): Container {
  const box = new Container()
  const { front, roofTop, eaves, hole, post } = NEST_BOX
  box.addChild(piece((g) => g.rect(post.x, front.y + front.height - 4, post.width, post.groundY - front.y - front.height + 4), PALETTE.brown))
  box.addChild(piece((g) => g.roundRect(front.x, front.y, front.width, front.height, 6), PALETTE.brown, BIG_SHADOW))
  // Planks.
  const planks = new Graphics()
  for (const x of [front.x + front.width / 3, front.x + (2 * front.width) / 3]) planks.moveTo(x, front.y + 8).lineTo(x, front.y + front.height - 8)
  box.addChild(planks.stroke({ width: 3, color: PALETTE.ink, alpha: 0.18 }))
  const radius = Math.min(hole.width, hole.height) / 2
  box.addChild(new Graphics().roundRect(hole.x - 6, hole.y - 6, hole.width + 12, hole.height + 12, radius + 6).fill({ color: PALETTE.ink, alpha: 0.25 }))
  box.addChild(new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, radius).fill(PALETTE.ink))
  const mask = new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, radius).fill(PALETTE.cream)
  slot.mask = mask
  box.addChild(mask, slot)
  const mid = front.x + front.width / 2
  box.addChild(
    piece(
      (g) =>
        g
          .moveTo(front.x - eaves, front.y + 18)
          .lineTo(mid, roofTop)
          .lineTo(front.x + front.width + eaves, front.y + 18)
          .lineTo(front.x + front.width + eaves, front.y + 36)
          .lineTo(mid, roofTop + 20)
          .lineTo(front.x - eaves, front.y + 36)
          .closePath(),
      PALETTE.red,
    ),
  )
  return box
}

/** The cherry tree: bare branches behind the trunk's top, the trunk, its bark, and the back of the
 *  nest (its dark inside) on the first branch. */
function drawTree(): Container {
  const tree = new Container()
  const { base, top } = TREE
  const mid = (top.left + top.right) / 2
  for (const branch of BRANCHES) tree.addChild(piece(limb(branch), PALETTE.brown))
  tree.addChild(
    piece(
      (g) =>
        g
          .moveTo(base.left - 30, base.y)
          .quadraticCurveTo(base.left + 10, base.y - 20, base.left + 14, base.y - 80)
          .lineTo(top.left, top.y)
          .quadraticCurveTo(mid, top.y - 24, top.right, top.y)
          .lineTo(base.right - 14, base.y - 80)
          .quadraticCurveTo(base.right - 10, base.y - 20, base.right + 30, base.y)
          .closePath(),
      PALETTE.brown,
      BIG_SHADOW,
    ),
  )
  tree.addChild(
    new Graphics()
      .moveTo(base.left + 34, base.y - 20)
      .quadraticCurveTo(base.left + 44, 640, top.left + 20, top.y + 30)
      .moveTo(base.right - 34, base.y - 30)
      .quadraticCurveTo(base.right - 44, 620, top.right - 20, top.y + 40)
      .stroke({ width: 6, color: PALETTE.ink, alpha: 0.18, cap: 'round' }),
  )
  // The inside of the nest, behind the nestlings.
  tree.addChild(new Graphics().ellipse(NEST.x, NEST.rim + 2, NEST.rimHalf - 6, 16).fill(PALETTE.brown))
  tree.addChild(new Graphics().ellipse(NEST.x, NEST.rim + 2, NEST.rimHalf - 6, 16).fill({ color: PALETTE.ink, alpha: 0.4 }))
  return tree
}

/** The straw skep on its board: a tall yellow dome with darker coils of straw, its dark hole and the
 *  bees' slot shown through it. */
function drawSkep(slot: Container): Container {
  const skep = new Container()
  const { y, height, groundY } = SKEP_BOARD
  skep.addChild(piece((g) => g.rect(SKEP.x - 112, y + height - 2, 16, groundY - y - height + 2).rect(SKEP.x + 96, y + height - 2, 16, groundY - y - height + 2), PALETTE.brown))
  skep.addChild(piece((g) => g.roundRect(SKEP.x - 160, y, 320, height, 5), PALETTE.brown))
  skep.addChild(piece(ellipseDome(SKEP), PALETTE.yellow, BIG_SHADOW))
  // Coils of straw: arcs across the dome.
  const coils = new Graphics()
  for (let k = 1; k < 8; k++) {
    const cy = SKEP.y - (SKEP.ry * k) / 8
    const half = SKEP.rx * Math.sqrt(1 - (k / 8) ** 2)
    coils.moveTo(SKEP.x - half, cy).quadraticCurveTo(SKEP.x, cy + 16, SKEP.x + half, cy)
  }
  skep.addChild(coils.stroke({ width: 5, color: PALETTE.brown, alpha: 0.45, cap: 'round' }))
  // Shade on the right.
  skep.addChild(ellipseDome({ x: SKEP.x + SKEP.rx * 0.5, y: SKEP.y, rx: SKEP.rx * 0.5, ry: SKEP.ry * 0.86 })(new Graphics()).fill({ color: PALETTE.brown, alpha: 0.16 }))
  const hole = SKEP_HOLE
  const radius = 34
  skep.addChild(new Graphics().roundRect(hole.x - 6, hole.y - 6, hole.width + 12, hole.height + 12, radius + 6).fill({ color: PALETTE.brown, alpha: 0.4 }))
  skep.addChild(new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, radius).fill(PALETTE.ink))
  const mask = new Graphics().roundRect(hole.x, hole.y, hole.width, hole.height, radius).fill(PALETTE.cream)
  slot.mask = mask
  skep.addChild(mask, slot)
  return skep
}

/** The front of the nest: a bowl of twigs, wider at its rim. */
function drawNestFront(): Container {
  const nest = new Container()
  const { x, rim, bottom, rimHalf, bottomHalf } = NEST
  const bowl: PathBuilder = (g) =>
    g
      .moveTo(x - rimHalf - 6, rim - 4)
      .quadraticCurveTo(x, rim + 4, x + rimHalf + 6, rim - 4)
      .quadraticCurveTo(x + rimHalf + 4, bottom - 20, x + bottomHalf - 6, bottom)
      .quadraticCurveTo(x, bottom + 12, x - bottomHalf + 6, bottom)
      .quadraticCurveTo(x - rimHalf - 4, bottom - 20, x - rimHalf - 6, rim - 4)
      .closePath()
  nest.addChild(piece(bowl, PALETTE.brown))
  // Twigs woven across it.
  const twigs = new Graphics()
  for (let k = 0; k < 4; k++) {
    const y = rim + 8 + k * 14
    const half = rimHalf - 6 - k * 6
    twigs.moveTo(x - half, y - 2).quadraticCurveTo(x, y + 8, x + half, y - 4)
  }
  nest.addChild(twigs.stroke({ width: 4, color: PALETTE.ink, alpha: 0.3, cap: 'round' }))
  nest.addChild(new Graphics().moveTo(x - rimHalf - 2, rim - 2).quadraticCurveTo(x, rim + 10, x + rimHalf + 2, rim - 2).stroke({ width: 6, color: PALETTE.yellow, alpha: 0.25, cap: 'round' }))
  return nest
}

/** The molehill: a dome of earth with a few clods. */
function drawMolehill(): Container {
  const hill = new Container()
  hill.addChild(piece(ellipseDome(MOLEHILL), PALETTE.brown, BIG_SHADOW))
  const clods = new Graphics()
  for (const [dx, dy, r] of [
    [-60, -30, 12],
    [10, -70, 10],
    [55, -40, 13],
    [-15, -24, 9],
    [80, -14, 9],
  ] as const)
    clods.circle(MOLEHILL.x + dx, MOLEHILL.y + dy, r)
  hill.addChild(clods.fill({ color: PALETTE.ink, alpha: 0.2 }))
  return hill
}

/** A leaf `length` long and `width` wide, centred on `x, y` and turned by `angle`, as a polygon. */
function leafShape(x: number, y: number, length: number, width: number, angle: number): PathBuilder {
  return (g) => {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const points: number[] = []
    for (let i = 0; i < 24; i++) {
      // Along the leaf from one tip to the other and back, its half width rounded in between.
      const t = i < 12 ? -1 + i / 6 : 1 - (i - 12) / 6
      const u = (t * length) / 2
      const v = ((i < 12 ? 1 : -1) * width * (1 - t * t)) / 2
      points.push(x + u * cos - v * sin, y + u * sin + v * cos)
    }
    return g.poly(points)
  }
}

/** [SPEC-17.2] The pile of dead leaves: a brown dome edged with leaves, a few yellow leaves and two
 *  twigs on top. */
function drawLeafPile(): Container {
  const pile = new Container()
  const { x, y, rx, ry } = LEAF_PILE
  const rand = seededRandom(61)
  // Leaves along the top of the dome make its outline uneven.
  const edge: PathBuilder = (g) => {
    ellipseDome(LEAF_PILE)(g)
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + 0.12 + ((Math.PI - 0.24) * i) / 10
      leafShape(x + rx * 0.97 * Math.cos(a), y + ry * 0.97 * Math.sin(a), 56, 26, a + Math.PI / 2 + (rand() - 0.5) * 0.8)(g)
    }
    return g
  }
  pile.addChild(piece(edge, PALETTE.brown, BIG_SHADOW))
  const twigs = new Graphics()
    .moveTo(x - 30, y - ry + 20)
    .lineTo(x - 70, y - ry - 30)
    .moveTo(x - 52, y - ry - 6)
    .lineTo(x - 40, y - ry - 26)
    .moveTo(x + 40, y - ry + 24)
    .lineTo(x + 92, y - ry - 14)
    .stroke({ width: 6, color: PALETTE.brown, cap: 'round' })
  pile.addChild(twigs)
  const darker = new Graphics()
  const yellow = new Graphics()
  const veins = new Graphics()
  for (let i = 0; i < 16; i++) {
    // Spread over the dome, away from its edge.
    const a = Math.PI + 0.25 + (Math.PI - 0.5) * rand()
    const r = 0.25 + 0.55 * rand()
    const lx = x + rx * r * Math.cos(a)
    const ly = y + ry * r * Math.sin(a) + 8
    const angle = rand() * Math.PI
    leafShape(lx, ly, 44, 22, angle)(i % 3 === 0 ? yellow : darker)
    veins.moveTo(lx - 18 * Math.cos(angle), ly - 18 * Math.sin(angle)).lineTo(lx + 18 * Math.cos(angle), ly + 18 * Math.sin(angle))
  }
  pile.addChild(darker.fill({ color: PALETTE.ink, alpha: 0.18 }), yellow.fill(PALETTE.yellow), veins.stroke({ width: 2, color: PALETTE.ink, alpha: 0.3 }))
  return pile
}

/** A tuft of grass: a few blades of leaf green, swaying from its foot. */
function drawTuft(x: number, y: number, size: number, seed: number): Container {
  const tuft = pivoted({ x, y })
  const rand = seededRandom(seed)
  const blades: PathBuilder = (g) => {
    for (let i = 0; i < 6; i++) {
      const dx = (i - 2.5) * size * 0.16
      const tipX = x + dx * 2.2 + (rand() - 0.5) * size * 0.3
      const tipY = y - size * (0.7 + 0.4 * rand())
      g.moveTo(x + dx - 8, y).quadraticCurveTo(x + dx, y - size * 0.5, tipX, tipY).quadraticCurveTo(x + dx + 4, y - size * 0.45, x + dx + 8, y).closePath()
    }
    return g
  }
  tuft.addChild(blades(new Graphics()).fill(PALETTE.leaf))
  return tuft
}

export function createLandscape(): Landscape {
  const actors = new Container({ label: 'actors' })
  const slots = {} as Record<SlotHideoutId, Container>
  for (const id of SLOT_HIDEOUT_IDS) slots[id] = new Container({ label: `slot:${id}` })

  const sunCloud = new Container({ label: 'sun-cloud' })
  const sky = drawSky(slots.cloud, sunCloud)
  // [SPEC-17.3] The small cloud passing far away, in front of the sun.
  const { cloud: passing } = AMBIENT
  const passingCloud = cloud({ x: 0, y: AMBIENT.cloud.y, rx: passing.rx, ry: passing.ry }, 29)
  sky.addChildAt(passingCloud, sky.getChildIndex(sunCloud))

  const back = new Container()
  back.addChild(drawFence(), drawNestBox(slots.nestBox))

  const middle = new Container()
  const crown = new Container({ label: 'crown' })
  middle.addChild(drawTree(), crown, drawSkep(slots.skep))

  const foreground = new Container()
  foreground.addChild(drawNestFront(), drawMolehill(), drawLeafPile())
  const swaying: Swaying[] = TUFTS.map((t, i) => {
    const node = drawTuft(t.x, t.y, t.size, 40 + i)
    foreground.addChild(node)
    return { node, phase: i * 0.27 }
  })

  const planes: Record<PlaneId, Container> = { sky, far: drawFar(), back, middle, foreground }
  const air = new Container({ label: 'air' })

  const root = new Container({ label: 'landscape' })
  root.addChild(planes.sky, planes.far, planes.back, planes.middle, actors, planes.foreground, air)

  let visible: Rect = { x: 0, y: 0, width: 1440, height: 1080 }
  let time = 0
  const tick = (dt: number) => {
    time += dt
    for (const { node, phase } of swaying) node.skew.x = oscillate(AMBIENT.tufts, time, phase)
    const span = visible.width + 2 * passing.rx + 200
    passingCloud.x = wrap(visible.x - passing.rx - 100 + 300 + passing.speed * time, visible.x - passing.rx - 100, visible.x - passing.rx - 100 + span)
  }

  return {
    root,
    planes,
    actors,
    slots,
    crown,
    sunCloud,
    air,
    get visible() {
      return visible
    },
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
