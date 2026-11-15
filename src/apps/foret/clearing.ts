// [SPEC-8.1] [SPEC-8.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-9.2] The clearing of « Forêt du
// silence », drawn in code with PixiJS in paper cut-out style: flat colours of the palette, round
// lobed shapes, a soft shadow under each piece. Five planes (sky, far trees, ground, near trees,
// foreground), five hideouts, and quiet permanent life (swaying leaves, slow clouds, light rays).
//
// For the animals: each hideout has a slot, a container placed right behind the shape that hides
// it. A hidden animal lives in its hideout's slot (see `Hideout.cover` in layout.ts); once clear
// of the shape it moves to `actors`, drawn in front of the near trees and behind the foreground.
// Everything is in world units (layout.ts): `resize` scales the whole clearing to the screen.
import { Container, Graphics } from 'pixi.js'
import { PALETTE } from './palette'
import { oscillate, wrap } from '../../silence/ambient'
import type { Decor } from '../../silence/decor'
import { viewport, type Ellipse, type Point, type Rect } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT, rayAlpha } from './ambient'
import {
  BRANCH,
  BRANCH_LEAVES,
  BURROW,
  BUSH,
  DECOR_BOUNDS,
  HIDEOUT_IDS,
  HORIZON_Y,
  LEFT_TREE,
  LOG,
  RIGHT_TREE,
  ROOT_FLARE,
  SUN,
  type HideoutId,
  type PlaneId,
  type Tree,
} from './layout'

/** [SPEC-9.8] The decor of the forest, as the shared code sees it, plus its planes and light. */
export interface Clearing extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** Animals in the open: in front of the near trees, behind the light rays and the foreground. */
  readonly actors: Container
  /** Light rays, over the animals. */
  readonly light: Container
  /** One container per hideout, right behind the shape that hides an animal. */
  readonly slots: Readonly<Record<HideoutId, Container>>
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)

/** Row of rounded tree tops between `left` and `right`, standing on `baseY`, filled down to the
 *  bottom of the decor. */
function treeline(baseY: number, heights: [number, number], widths: [number, number], seed: number): PathBuilder {
  return (g) => {
    const rand = seededRandom(seed)
    let x = DECOR_BOUNDS.x
    g.moveTo(x, BOTTOM).lineTo(x, baseY)
    while (x < RIGHT) {
      const width = widths[0] + rand() * (widths[1] - widths[0])
      const height = heights[0] + rand() * (heights[1] - heights[0])
      const y = baseY + (rand() - 0.5) * 16
      g.quadraticCurveTo(x + width / 2, y - 2 * height, x + width, y)
      x += width
    }
    return g.lineTo(x, BOTTOM).closePath()
  }
}

function trunkPath(trunk: Rect): PathBuilder {
  const base = trunk.y + trunk.height
  const right = trunk.x + trunk.width
  return (g) =>
    g
      .moveTo(trunk.x + 10, trunk.y)
      .lineTo(right - 10, trunk.y)
      .lineTo(right, base - 130)
      .quadraticCurveTo(right + 4, base - 20, right + ROOT_FLARE, base)
      .lineTo(trunk.x - ROOT_FLARE, base)
      .quadraticCurveTo(trunk.x - 4, base - 20, trunk.x, base - 130)
      .closePath()
}

/** Shaded right side of a trunk: a paper fold. */
function trunkShadePath(trunk: Rect): PathBuilder {
  const base = trunk.y + trunk.height
  const right = trunk.x + trunk.width
  const fold = trunk.x + trunk.width * 0.68
  return (g) =>
    g
      .moveTo(fold, trunk.y)
      .lineTo(right - 10, trunk.y)
      .lineTo(right, base - 130)
      .quadraticCurveTo(right + 4, base - 20, right + ROOT_FLARE, base)
      .lineTo(fold + 18, base)
      .quadraticCurveTo(fold + 4, base - 40, fold, base - 130)
      .closePath()
}

/** A crown, a clump of leaves or a bush: two layers of the same paper, the front one casting
 *  its shadow on the back one. */
function foliage(e: Ellipse, seed: number, dome = false): Container {
  const container = new Container()
  container.addChild(piece(lobed(e, dome ? 7 : 9, seed, dome), PALETTE.forest, BIG_SHADOW))
  // A dome stands on `e.y`: the front layer stands on the same base.
  const front: Ellipse = dome
    ? { x: e.x + e.rx * 0.08, y: e.y, rx: e.rx * 0.72, ry: e.ry * 0.66 }
    : { x: e.x + e.rx * 0.1, y: e.y + e.ry * 0.16, rx: e.rx * 0.7, ry: e.ry * 0.66 }
  container.addChild(piece(lobed(front, dome ? 6 : 7, seed + 1, dome), PALETTE.forest))
  return container
}

function drawTree(tree: Tree, seed: number, swaying: Swaying[]): { trunk: Container; crown: Container } {
  const trunk = new Container()
  trunk.addChild(piece(trunkPath(tree.trunk), PALETTE.bark, BIG_SHADOW))
  trunk.addChild(trunkShadePath(tree.trunk)(new Graphics()).fill({ color: PALETTE.ink, alpha: 0.15 }))
  const crown = pivoted({ x: tree.crown.x, y: tree.crown.y + tree.crown.ry })
  crown.addChild(foliage(tree.crown, seed))
  swaying.push({ node: crown, phase: (seed % 7) / 7 })
  return { trunk, crown }
}

/** Extra trees beyond the safe zone, seen on wider screens [SPEC-8.6]. */
const SIDE_TREES: Tree[] = [-250, -790, -1250, 1690, 2170, 2640].map((x, i) => ({
  trunk: { x: x - 70, y: -300, width: 140, height: 975 + (i % 3) * 15 },
  crown: { x: x + (i % 2 ? 40 : -40), y: -10 + (i % 3) * 20, rx: 270, ry: 240 },
}))

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
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius + 34).fill({ color: PALETTE.cream, alpha: 0.4 }))
  plane.addChild(new Graphics().circle(SUN.x, SUN.y, SUN.radius).fill(PALETTE.sun))
  const { min, max } = AMBIENT.cloudSpeed
  const clouds = (
    [
      [180, 120, 150, 70],
      [760, 70, 120, 58],
      [1150, 230, 140, 64],
      [1700, 140, 130, 60],
      [-300, 250, 120, 56],
    ] as const
  ).map(([x, y, rx, ry], i): Cloud => {
    const node = piece(lobed({ x: 0, y: 0, rx, ry }, 5, 40 + i, true), PALETTE.cream)
    node.position.set(x, y)
    plane.addChild(node)
    return { x, rx, node, speed: min + ((max - min) * ((i * 3) % 5)) / 4 }
  })
  return { plane, clouds }
}

function drawFarTrees(): Container {
  const plane = new Container()
  plane.addChild(piece(treeline(575, [40, 95], [140, 230], 7), PALETTE.teal, null))
  plane.addChild(piece(treeline(HORIZON_Y + 20, [24, 52], [80, 140], 11), PALETTE.forest, null))
  return plane
}

function flower(x: number, y: number, size: number): Graphics {
  const g = new Graphics()
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    g.circle(x + Math.cos(angle) * size, y + Math.sin(angle) * size, size * 0.85)
  }
  return g.fill(PALETTE.cream).circle(x, y, size * 0.7).fill(PALETTE.sun)
}

/** Burrow: mound, dark hole, slot masked above the rim, lip of earth in front. */
function drawBurrow(slot: Container): Container {
  const burrow = new Container()
  const { mound, hole, rimY } = BURROW
  burrow.addChild(piece(lobed(mound, 6, 21, true), PALETTE.bark))
  burrow.addChild(new Graphics().ellipse(hole.x, hole.y, hole.rx, hole.ry).fill(PALETTE.ink))
  const mask = new Graphics().rect(hole.x - 300, DECOR_BOUNDS.y, 600, rimY - DECOR_BOUNDS.y).fill(PALETTE.cream)
  slot.mask = mask
  burrow.addChild(mask, slot)
  burrow.addChild(new Graphics().ellipse(hole.x, rimY + 4, hole.rx + 22, 18).fill(PALETTE.bark))
  return burrow
}

/** Hollow log: body, cut face with its opening, slot masked to the opening and to what lies
 *  left of the face. */
function drawLog(slot: Container): Container {
  const log = new Container()
  const top = LOG.y - LOG.faceRy
  const bottom = LOG.y + LOG.faceRy
  const end = LOG.x + LOG.length
  const cap = 40 * (4 / 3) // control offset of a half ellipse 40 wide
  log.addChild(
    piece(
      (g) => g.moveTo(LOG.x, top).lineTo(end, top).bezierCurveTo(end + cap, top, end + cap, bottom, end, bottom).lineTo(LOG.x, bottom).closePath(),
      PALETTE.bark,
    ),
  )
  // Two grooves of bark along the log.
  log.addChild(
    new Graphics()
      .roundRect(LOG.x + 70, LOG.y - 42, LOG.length - 80, 14, 7)
      .roundRect(LOG.x + 110, LOG.y + 30, LOG.length - 110, 14, 7)
      .fill({ color: PALETTE.ink, alpha: 0.2 }),
  )
  log.addChild(piece((g) => g.ellipse(LOG.x, LOG.y, LOG.faceRx, LOG.faceRy), PALETTE.tan))
  log.addChild(new Graphics().ellipse(LOG.x, LOG.y, LOG.faceRx * 0.82, LOG.faceRy * 0.86).stroke({ width: 6, color: PALETTE.bark, alpha: 0.5 }))
  log.addChild(new Graphics().ellipse(LOG.x, LOG.y + 3, LOG.holeRx, LOG.holeRy).fill(PALETTE.ink))
  // One outline: everything left of the face, plus the right half of the opening.
  const k = (4 / 3) * LOG.holeRx
  const holeTop = LOG.y + 3 - LOG.holeRy
  const holeBottom = LOG.y + 3 + LOG.holeRy
  const mask = new Graphics()
    .moveTo(DECOR_BOUNDS.x, DECOR_BOUNDS.y)
    .lineTo(LOG.x, DECOR_BOUNDS.y)
    .lineTo(LOG.x, holeTop)
    .bezierCurveTo(LOG.x + k, holeTop, LOG.x + k, holeBottom, LOG.x, holeBottom)
    .lineTo(LOG.x, BOTTOM)
    .lineTo(DECOR_BOUNDS.x, BOTTOM)
    .closePath()
    .fill(PALETTE.cream)
  slot.mask = mask
  log.addChild(mask, slot)
  return log
}

function drawGround(slots: Record<HideoutId, Container>): Container {
  const plane = new Container()
  plane.addChild(
    piece((g) => {
      // Gentle waves along the edge of the grass.
      g.moveTo(DECOR_BOUNDS.x, HORIZON_Y)
      for (let x = DECOR_BOUNDS.x, i = 0; x < RIGHT; x += 600, i++) g.quadraticCurveTo(x + 300, HORIZON_Y + (i % 2 ? -16 : 16), x + 600, HORIZON_Y)
      return g.lineTo(RIGHT, BOTTOM).lineTo(DECOR_BOUNDS.x, BOTTOM).closePath()
    }, PALETTE.grass, null),
  )
  for (const [x, y, size] of [
    [880, 700, 15],
    [1240, 955, 16],
    [330, 742, 13],
    [-120, 860, 16],
    [1560, 830, 15],
    [1010, 1050, 14],
  ] as const) {
    plane.addChild(flower(x, y, size))
  }
  plane.addChild(drawBurrow(slots.burrow))
  plane.addChild(drawLog(slots.hollowLog))
  return plane
}

function branchPath(g: Graphics): Graphics {
  const { from, to, baseThickness, tipThickness } = BRANCH
  return g
    .moveTo(from.x, from.y - baseThickness / 2)
    .quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 - baseThickness / 2 - 14, to.x, to.y - tipThickness / 2)
    .lineTo(to.x, to.y + tipThickness / 2)
    .quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 + baseThickness / 2 - 10, from.x, from.y + baseThickness / 2)
    .closePath()
}

function drawNearTrees(slots: Record<HideoutId, Container>, swaying: Swaying[], leaves: Swaying[]): Container {
  const plane = new Container()
  for (const [i, tree] of SIDE_TREES.entries()) {
    const { trunk, crown } = drawTree(tree, 60 + i, swaying)
    plane.addChild(trunk, crown)
  }
  // Left tree: the slot is behind its trunk.
  const left = drawTree(LEFT_TREE, 3, swaying)
  plane.addChild(slots.behindTree, left.trunk, left.crown)
  // Right tree and its high branch: the slot is in front of the branch, behind its leaves.
  const right = drawTree(RIGHT_TREE, 5, swaying)
  const clump = pivoted({ x: BRANCH_LEAVES.x, y: BRANCH_LEAVES.y + BRANCH_LEAVES.ry })
  clump.addChild(foliage(BRANCH_LEAVES, 9))
  leaves.push({ node: clump, phase: 0.4 })
  // The branch goes under the trunk, which hides its base.
  plane.addChild(piece(branchPath, PALETTE.bark), right.trunk, slots.highBranch, clump, right.crown)
  return plane
}

/** Light rays from the sun across the clearing. They start side by side at the centre of the sun
 *  and never overlap, so their transparency stays even. */
function drawLight(): { layer: Container; rays: Swaying[] } {
  const layer = new Container()
  const rays: Swaying[] = (
    [
      [-24, -10, 300, 430],
      [-6, 8, 620, 790],
      [12, 26, 960, 1100],
    ] as const
  ).map(([topLeft, topRight, bottomLeft, bottomRight], i) => {
    const ray = new Graphics()
      .poly([SUN.x + topLeft, SUN.y, SUN.x + topRight, SUN.y, bottomRight, 1120, bottomLeft, 1120])
      .fill(PALETTE.cream)
    layer.addChild(ray)
    return { node: ray, phase: i / 3 }
  })
  return { layer, rays }
}

/** A tuft of long leaves growing from `root`, leaning towards `lean` (radians, 0 = upright). */
function tuft(root: Point, lean: number, seed: number): Container {
  const container = pivoted(root)
  const rand = seededRandom(seed)
  const g = new Graphics()
  for (let i = 0; i < 5; i++) {
    const angle = lean + (i - 2) * 0.32 + (rand() - 0.5) * 0.15
    const length = 170 + rand() * 70
    const width = 34 + rand() * 10
    const tip = { x: root.x + Math.sin(angle) * length, y: root.y - Math.cos(angle) * length }
    const mid = { x: root.x + Math.sin(angle) * length * 0.5, y: root.y - Math.cos(angle) * length * 0.5 }
    const nx = Math.cos(angle) * width
    const ny = Math.sin(angle) * width
    g.moveTo(root.x, root.y).quadraticCurveTo(mid.x + nx, mid.y + ny, tip.x, tip.y).quadraticCurveTo(mid.x - nx, mid.y - ny, root.x, root.y)
  }
  container.addChild(g.fill(PALETTE.forest))
  return container
}

function drawForeground(slots: Record<HideoutId, Container>, ferns: Swaying[]): { plane: Container; bush: Container } {
  const plane = new Container()
  const bush = pivoted({ x: BUSH.x, y: BUSH.y })
  bush.addChild(foliage(BUSH, 31, true))
  plane.addChild(slots.bush, bush)
  for (const [i, [x, y, lean]] of (
    [
      [-170, 1100, -0.35],
      [-520, 1110, 0.2],
      [1500, 1100, -0.45],
      [1830, 1110, 0.1],
    ] as const
  ).entries()) {
    const fern = tuft({ x, y }, lean, 80 + i)
    ferns.push({ node: fern, phase: i / 4 })
    plane.addChild(fern)
  }
  return { plane, bush }
}

export function createClearing(): Clearing {
  const slots = {} as Record<HideoutId, Container>
  for (const id of HIDEOUT_IDS) {
    slots[id] = new Container({ label: `slot:${id}` })
  }
  const crowns: Swaying[] = []
  const leaves: Swaying[] = []
  const ferns: Swaying[] = []

  const sky = drawSky()
  const foreground = drawForeground(slots, ferns)
  const planes: Record<PlaneId, Container> = {
    sky: sky.plane,
    farTrees: drawFarTrees(),
    ground: drawGround(slots),
    nearTrees: drawNearTrees(slots, crowns, leaves),
    foreground: foreground.plane,
  }
  const actors = new Container({ label: 'actors' })
  const light = drawLight()

  const root = new Container({ label: 'clearing' })
  root.addChild(planes.sky, planes.farTrees, planes.ground, planes.nearTrees, actors, light.layer, planes.foreground)

  let visible: Rect = { x: 0, y: 0, width: 0, height: 0 }
  let time = 0

  const tick = (dt: number) => {
    time += dt
    for (const { node, phase } of crowns) node.rotation = oscillate(AMBIENT.crown, time, phase)
    for (const { node, phase } of leaves) node.rotation = oscillate(AMBIENT.branchLeaves, time, phase)
    for (const { node, phase } of ferns) node.rotation = oscillate(AMBIENT.fern, time, phase)
    foreground.bush.skew.x = oscillate(AMBIENT.bush, time)
    for (const { node, phase } of light.rays) node.alpha = rayAlpha(time, phase)
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
    light: light.layer,
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
