// [SPEC-8.1] [SPEC-8.2] [SPEC-8.4] [SPEC-8.5] [SPEC-8.6] [SPEC-16.3] The winter landscape of « Hiver
// du silence », drawn in code with PixiJS in paper cut-out style: flat colours of the winter
// palette, round shapes, a soft shadow under each piece. Five planes (sky, far, back, middle,
// foreground), nine hideouts, and quiet permanent life (chimney smoke, falling flakes, the bush
// swaying a little) [SPEC-16.3.3].
//
// For the characters: each hideout of the back and the middle has a slot, a container placed right
// behind the shape that hides it (see `Hideout.cover` in layout.ts). The foreground hideouts (bush,
// drifts) hide the characters of the actors layer, drawn in front of the middle plane and behind
// the foreground. Everything is in world units (layout.ts): `resize` scales the whole landscape.
//
// [SPEC-16.5.1] No cream snow lies behind a white character: the owl's branch is bare, the
// Christmas tree has no snow, the drifts and the ground are the blue snow of dusk.
import { Container, Graphics } from 'pixi.js'
import { oscillate, wrap } from '../../silence/ambient'
import type { Decor } from '../../silence/decor'
import { viewport, type Ellipse, type Point, type Rect } from '../../silence/geometry'
import { BIG_SHADOW, lobed, paperPieces, pivoted, type PathBuilder, type Swaying } from '../../silence/paper'
import { seededRandom } from '../../silence/random'
import { AMBIENT, createFlakes, puff, type Flake } from './ambient'
import {
  BIG_DRIFT,
  BULBS,
  BUSH,
  DECOR_BOUNDS,
  DRIFT,
  FIR,
  FIR_TIERS,
  firHalfWidth,
  GARLANDS,
  garlandPoint,
  HILL,
  HORIZON_Y,
  HOUSE,
  ORNAMENTS,
  ROCK,
  SLOT_HIDEOUT_IDS,
  SMOKE_ORIGIN,
  STAR,
  TREE,
  type PlaneId,
  type SlotHideoutId,
} from './layout'
import { PALETTE } from './palette'

/** [SPEC-9.8] The decor of winter, as the shared code sees it, plus its planes. */
export interface Landscape extends Decor {
  readonly planes: Readonly<Record<PlaneId, Container>>
  /** One container per hideout of the back and the middle, right behind the shape that hides a
   *  character. */
  readonly slots: Readonly<Record<SlotHideoutId, Container>>
  /** Over the whole landscape, in front of the characters: the falling flakes, then the reward's. */
  readonly air: Container
  /** Part of the world the screen shows, world units. */
  readonly visible: Rect
}

const BOTTOM = DECOR_BOUNDS.y + DECOR_BOUNDS.height
const RIGHT = DECOR_BOUNDS.x + DECOR_BOUNDS.width

const piece = paperPieces(PALETTE.ink)

/** A limb of a tree from `from` to `to`, `t0` thick at its root and `t1` at its tip. */
function limb(from: Point, to: Point, t0: number, t1: number): PathBuilder {
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
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI + (i / 40) * Math.PI
      points.push(e.x + e.rx * Math.cos(a), e.y + e.ry * Math.sin(a))
    }
    return g.poly(points)
  }
}

/** A line of rolling hills between the edges of the decor, standing on `baseY`, filled down to the
 *  bottom of the decor. */
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

/** A small fir of the far edge of the forest: a narrow triangle standing on `y`. */
function farFir(g: Graphics, x: number, y: number, height: number): Graphics {
  return g.moveTo(x, y - height).lineTo(x + height * 0.28, y).lineTo(x - height * 0.28, y).closePath()
}

function drawSky(): Container {
  const plane = new Container()
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, DECOR_BOUNDS.y, DECOR_BOUNDS.width, HORIZON_Y + 200 - DECOR_BOUNDS.y).fill(PALETTE.sky))
  // A paler band of dusk along the horizon.
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, HORIZON_Y - 260, DECOR_BOUNDS.width, 460).fill({ color: PALETTE.snow, alpha: 0.18 }))
  plane.addChild(new Graphics().rect(DECOR_BOUNDS.x, HORIZON_Y - 140, DECOR_BOUNDS.width, 340).fill({ color: PALETTE.snow, alpha: 0.15 }))
  return plane
}

/** Far snowy hills, the dark edge of a fir forest at their foot, then the snow of the ground. */
function drawFar(): Container {
  const plane = new Container()
  plane.addChild(piece(hills(HORIZON_Y - 20, [60, 120], [520, 780], 5), PALETTE.snow, null))
  // Distance: the far hills are a little bluer.
  plane.addChild(hills(HORIZON_Y - 20, [60, 120], [520, 780], 5)(new Graphics()).fill({ color: PALETTE.sky, alpha: 0.28 }))
  const firs = new Graphics()
  const rand = seededRandom(17)
  for (let x = DECOR_BOUNDS.x; x < RIGHT; x += 34 + rand() * 30) farFir(firs, x, HORIZON_Y + 6, 46 + rand() * 50)
  plane.addChild(firs.fill(PALETTE.fir))
  // The snow of the ground, with soft blue hollows.
  plane.addChild(piece((g) => g.rect(DECOR_BOUNDS.x, HORIZON_Y, DECOR_BOUNDS.width, BOTTOM - HORIZON_Y), PALETTE.snow, null))
  const hollows = new Graphics()
  for (const [x, y, rx, ry] of [
    [-260, 640, 300, 30],
    [640, 900, 260, 26],
    [1120, 700, 220, 22],
    [1720, 820, 320, 30],
    [300, 1000, 240, 24],
  ] as const)
    hollows.ellipse(x, y, rx, ry)
  plane.addChild(hollows.fill({ color: PALETTE.sky, alpha: 0.14 }))
  return plane
}

/** The reindeer's hill: the slot behind it, then the dome of snow. */
function drawHill(slot: Container): Container {
  const hill = new Container()
  hill.addChild(slot)
  hill.addChild(piece(ellipseDome(HILL), PALETTE.snow, BIG_SHADOW))
  // Light from the top left: the right flank is in shade.
  hill.addChild(
    new Graphics()
      .moveTo(HILL.x + HILL.rx * 0.2, HILL.y - HILL.ry * 0.98)
      .quadraticCurveTo(HILL.x + HILL.rx * 0.95, HILL.y - HILL.ry * 0.7, HILL.x + HILL.rx, HILL.y)
      .lineTo(HILL.x + HILL.rx * 0.55, HILL.y)
      .quadraticCurveTo(HILL.x + HILL.rx * 0.6, HILL.y - HILL.ry * 0.7, HILL.x + HILL.rx * 0.2, HILL.y - HILL.ry * 0.98)
      .closePath()
      .fill({ color: PALETTE.sky, alpha: 0.16 }),
  )
  return hill
}

/** Logs of a wooden wall: darker lines between them. */
function logs(rect: Rect, count: number): Graphics {
  const g = new Graphics()
  for (let i = 1; i < count; i++) {
    const y = rect.y + (rect.height * i) / count
    g.moveTo(rect.x + 4, y).lineTo(rect.x + rect.width - 4, y)
  }
  return g.stroke({ width: 4, color: PALETTE.ink, alpha: 0.2 })
}

/** Small icicles hanging under a straight edge from `x0` to `x1` at `y`. */
function icicles(x0: number, x1: number, y: number, lengths: readonly number[], width: number): Graphics {
  const g = new Graphics()
  const step = (x1 - x0) / lengths.length
  lengths.forEach((length, i) => {
    const x = x0 + step * (i + 0.5)
    g.moveTo(x - width / 2, y).lineTo(x + width / 2, y).lineTo(x, y + length).closePath()
  })
  return g.fill(PALETTE.cream)
}

export interface HouseLights {
  /** Where the windows are, for the reward that lights them. */
  window: Rect
  attic: Point & { radius: number }
}

/** The wooden house: chimney, wall of logs, snowy roof with small icicles, windows, the open door,
 *  then the slot. The slot shows only the door and what lies below the wall. */
function drawHouse(slot: Container): Container {
  const house = new Container()
  const { wall, door, roofTop, eaves, window, attic, chimney } = HOUSE
  const bottom = wall.y + wall.height
  const middle = wall.x + wall.width / 2
  house.addChild(piece((g) => g.rect(chimney.x, chimney.y, chimney.width, chimney.height), PALETTE.brown))
  house.addChild(piece((g) => g.roundRect(chimney.x - 6, chimney.y - 12, chimney.width + 12, 18, 9), PALETTE.cream, null))
  house.addChild(piece((g) => g.rect(wall.x, wall.y, wall.width, wall.height), PALETTE.brown, BIG_SHADOW))
  house.addChild(logs(wall, 9))
  // Gable under the roof, then the roof thick with snow.
  house.addChild(piece((g) => g.moveTo(wall.x, wall.y + 2).lineTo(middle, roofTop + 30).lineTo(wall.x + wall.width, wall.y + 2).closePath(), PALETTE.brown, null))
  house.addChild(
    piece(
      (g) =>
        g
          .moveTo(wall.x - eaves, wall.y + 10)
          .lineTo(middle, roofTop)
          .lineTo(wall.x + wall.width + eaves, wall.y + 10)
          .quadraticCurveTo(wall.x + wall.width + eaves + 6, wall.y + 30, wall.x + wall.width + eaves - 10, wall.y + 30)
          .lineTo(middle, roofTop + 34)
          .lineTo(wall.x - eaves + 10, wall.y + 30)
          .quadraticCurveTo(wall.x - eaves - 6, wall.y + 30, wall.x - eaves, wall.y + 10)
          .closePath(),
      PALETTE.cream,
      BIG_SHADOW,
    ),
  )
  // [SPEC-16.3.1] Small icicles along the eaves, under each slope.
  const eaveIcicles = new Graphics()
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 6; i++) {
      const t = 0.12 + i * 0.15
      const x = middle + side * (wall.width / 2 + eaves - 14) * t
      const y = roofTop + 34 + (wall.y + 30 - roofTop - 34) * t
      const length = 12 + ((i * 7) % 11)
      eaveIcicles.moveTo(x - 5, y - 2).lineTo(x + 5, y - 2).lineTo(x, y + length).closePath()
    }
  }
  house.addChild(eaveIcicles.fill(PALETTE.cream))
  // Round window in the gable and the window right of the door: dark panes, a wooden cross.
  house.addChild(new Graphics().circle(attic.x, attic.y, attic.radius + 7).fill(PALETTE.cream).circle(attic.x, attic.y, attic.radius).fill(PALETTE.ink))
  house.addChild(piece((g) => g.rect(window.x - 8, window.y - 8, window.width + 16, window.height + 16), PALETTE.cream))
  house.addChild(new Graphics().rect(window.x, window.y, window.width, window.height).fill(PALETTE.ink))
  house.addChild(
    new Graphics()
      .rect(window.x + window.width / 2 - 4, window.y, 8, window.height)
      .rect(window.x, window.y + window.height / 2 - 4, window.width, 8)
      .fill(PALETTE.brown),
  )
  house.addChild(icicles(window.x - 6, window.x + window.width + 6, window.y + window.height + 8, [10, 16, 8, 14], 8))
  // The door: red frame, dark inside, then the slot over the inside.
  house.addChild(piece((g) => g.rect(door.x - 12, door.y - 14, door.width + 24, door.height + 14), PALETTE.red))
  house.addChild(new Graphics().rect(door.x, door.y, door.width, door.height).fill(PALETTE.ink))
  const mask = new Graphics()
    .rect(door.x, door.y, door.width, door.height)
    .rect(DECOR_BOUNDS.x, bottom, DECOR_BOUNDS.width, BOTTOM - bottom)
    .fill(PALETTE.cream)
  slot.mask = mask
  house.addChild(mask, slot)
  return house
}

/** The big snowy tree: the owl's slot behind the trunk, the trunk, its hollow and the squirrel's
 *  slot masked to it, then the branches, snowy except the owl's [SPEC-16.5.1]. */
function drawTree(slots: Record<SlotHideoutId, Container>): Container {
  const tree = new Container()
  const { base, top, hollow, branch } = TREE
  const mid = (top.left + top.right) / 2
  // Bare branches of the crown, behind the trunk's top, with snow along them.
  const crown: [Point, Point, number, number][] = [
    [{ x: mid - 10, y: top.y + 20 }, { x: 40, y: 70 }, 36, 12],
    [{ x: mid + 10, y: top.y + 20 }, { x: 270, y: 60 }, 32, 12],
    [{ x: top.left + 20, y: top.y + 110 }, { x: -70, y: 230 }, 30, 12],
    // Twigs, each one growing out of a branch above.
    [{ x: 112, y: 187 }, { x: 130, y: 10 }, 18, 8],
    [{ x: mid - 20, y: top.y + 60 }, { x: -20, y: 140 }, 26, 10],
    [{ x: mid + 20, y: top.y + 50 }, { x: 330, y: 150 }, 24, 10],
    [{ x: 83, y: 140 }, { x: 60, y: 60 }, 14, 6],
    [{ x: 230, y: 140 }, { x: 300, y: 96 }, 12, 6],
  ]
  for (const [from, to, t0, t1] of crown) tree.addChild(piece(limb(from, to, t0, t1), PALETTE.brown))
  for (const [from, to, t0, t1] of crown) tree.addChild(piece(limb({ x: from.x, y: from.y - t0 * 0.35 }, { x: to.x, y: to.y - t1 * 0.4 }, t0 * 0.55, t1 * 0.6), PALETTE.cream, null))
  // The owl's branch, bare, behind her slot: she stands in front of it whether in her slot or in the
  // open, so that changing layer on it shows no jump.
  tree.addChild(piece(limb(branch.from, branch.to, branch.baseThickness, branch.tipThickness), PALETTE.brown))
  tree.addChild(slots.trunk)
  tree.addChild(
    piece(
      (g) =>
        g
          .moveTo(base.left - 30, base.y)
          .quadraticCurveTo(base.left + 10, base.y - 20, base.left + 14, base.y - 80)
          .lineTo(top.left, top.y)
          .quadraticCurveTo(mid, top.y - 30, top.right, top.y)
          .lineTo(base.right - 14, base.y - 80)
          .quadraticCurveTo(base.right - 10, base.y - 20, base.right + 30, base.y)
          .closePath(),
      PALETTE.brown,
      BIG_SHADOW,
    ),
  )
  // Bark grooves.
  tree.addChild(
    new Graphics()
      .moveTo(base.left + 40, base.y - 20)
      .quadraticCurveTo(base.left + 50, 400, top.left + 30, top.y + 30)
      .moveTo(base.right - 40, base.y - 30)
      .quadraticCurveTo(base.right - 50, 380, top.right - 30, top.y + 40)
      .stroke({ width: 6, color: PALETTE.ink, alpha: 0.18, cap: 'round' }),
  )
  // Snow resting where the crown forks.
  tree.addChild(piece(lobed({ x: mid, y: top.y + 6, rx: 70, ry: 22 }, 5, 61, true), PALETTE.cream, null))
  // The hollow: dark inside, then the slot masked to it.
  const radius = 16
  tree.addChild(new Graphics().roundRect(hollow.x - 8, hollow.y - 8, hollow.width + 16, hollow.height + 16, radius + 8).fill({ color: PALETTE.ink, alpha: 0.25 }))
  tree.addChild(new Graphics().roundRect(hollow.x, hollow.y, hollow.width, hollow.height, radius).fill(PALETTE.ink))
  const mask = new Graphics().roundRect(hollow.x, hollow.y, hollow.width, hollow.height, radius).fill(PALETTE.cream)
  slots.hollow.mask = mask
  tree.addChild(mask, slots.hollow)
  return tree
}

/** [SPEC-16.3.1] The rock: the white fox's slot behind it, its body, the snowy slab overhanging on
 *  the right and the big icicles under it. */
function drawRock(slot: Container): Container {
  const rock = new Container()
  const { body, slab, icicles: ice } = ROCK
  rock.addChild(slot)
  // A lumpy boulder, lit on the left, in shade on the right.
  const lumps: PathBuilder = (g) =>
    g
      .moveTo(body.x, body.y + body.height)
      .quadraticCurveTo(body.x - 16, body.y + 120, body.x + 8, body.y + 50)
      .quadraticCurveTo(body.x + 30, body.y + 4, body.x + 110, body.y)
      .quadraticCurveTo(body.x + 200, body.y - 8, body.x + 262, body.y + 14)
      .quadraticCurveTo(body.x + body.width + 4, body.y + 60, body.x + body.width, body.y + 140)
      .quadraticCurveTo(body.x + body.width + 2, body.y + 180, body.x + body.width, body.y + body.height)
      .closePath()
  rock.addChild(piece(lumps, PALETTE.brown, BIG_SHADOW))
  rock.addChild(
    new Graphics()
      .moveTo(body.x + 6, body.y + 150)
      .quadraticCurveTo(body.x + 10, body.y + 40, body.x + 110, body.y + 22)
      .quadraticCurveTo(body.x + 70, body.y + 70, body.x + 60, body.y + 190)
      .closePath()
      .fill({ color: PALETTE.cream, alpha: 0.1 }),
  )
  rock.addChild(
    new Graphics()
      .moveTo(body.x + 230, body.y + 30)
      .quadraticCurveTo(body.x + body.width, body.y + 70, body.x + body.width - 2, body.y + body.height)
      .lineTo(body.x + 200, body.y + body.height)
      .quadraticCurveTo(body.x + 240, body.y + 120, body.x + 230, body.y + 30)
      .closePath()
      .fill({ color: PALETTE.ink, alpha: 0.14 }),
  )
  rock.addChild(
    new Graphics()
      .moveTo(body.x + 120, body.y + 60)
      .lineTo(body.x + 150, body.y + 120)
      .lineTo(body.x + 130, body.y + 180)
      .stroke({ width: 6, color: PALETTE.ink, alpha: 0.2, cap: 'round', join: 'round' }),
  )
  // The slab: a flat, uneven ledge over the boulder.
  rock.addChild(
    piece(
      (g) =>
        g
          .moveTo(slab.x + 6, slab.y + slab.height)
          .quadraticCurveTo(slab.x - 10, slab.y + 30, slab.x + 20, slab.y + 8)
          .quadraticCurveTo(slab.x + 120, slab.y - 6, slab.x + 220, slab.y + 4)
          .quadraticCurveTo(slab.x + slab.width - 10, slab.y + 6, slab.x + slab.width, slab.y + 30)
          .quadraticCurveTo(slab.x + slab.width + 2, slab.y + slab.height, slab.x + slab.width - 16, slab.y + slab.height)
          .closePath(),
      PALETTE.brown,
      BIG_SHADOW,
    ),
  )
  rock.addChild(new Graphics().roundRect(slab.x + 14, slab.y + slab.height - 16, slab.width - 34, 12, 6).fill({ color: PALETTE.ink, alpha: 0.2 }))
  // Snow on the slab.
  rock.addChild(piece(lobed({ x: slab.x + slab.width / 2, y: slab.y + 14, rx: slab.width / 2 - 4, ry: 30 }, 7, 81, true), PALETTE.cream, null))
  // Big icicles under the right end of the slab, small ones under its left end.
  const under = slab.y + slab.height - 8
  const longest = ice.bottom - under
  rock.addChild(icicles(ice.from, ice.to, under, [longest * 0.6, longest, longest * 0.75, longest * 0.95, longest * 0.55], 18))
  rock.addChild(icicles(slab.x + 20, slab.x + 120, under, [16, 24, 14], 12))
  return rock
}

/** Five-pointed star centred on (x, y). */
export function starPath(x: number, y: number, radius: number): PathBuilder {
  return (g) => {
    const points: number[] = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? radius * 0.45 : radius
      points.push(x + r * Math.cos(a), y + r * Math.sin(a))
    }
    return g.poly(points)
  }
}

/** [SPEC-16.3] The Christmas tree: the slot behind it, its trunk, its tiers (no snow
 *  [SPEC-16.5.1]), its ornaments, the garland with its unlit bulbs and the unlit star. */
function drawFir(slot: Container): Container {
  const fir = new Container()
  fir.addChild(slot)
  fir.addChild(piece((g) => g.rect(FIR.x - FIR.trunk, FIR.base - 20, 2 * FIR.trunk, 60), PALETTE.brown))
  FIR_TIERS.forEach(({ top, bottom }, i) => {
    const a = firHalfWidth(top)
    const b = firHalfWidth(bottom) + 14
    fir.addChild(
      piece(
        (g) =>
          (a === 0 ? g.moveTo(FIR.x, top) : g.moveTo(FIR.x - a, top).lineTo(FIR.x + a, top))
            .lineTo(FIR.x + b, bottom)
            .quadraticCurveTo(FIR.x, bottom + 26, FIR.x - b, bottom)
            .closePath(),
        PALETTE.fir,
        i === FIR_TIERS.length - 1 ? BIG_SHADOW : undefined,
      ),
    )
  })
  // Ornaments.
  const balls = new Graphics()
  const shines = new Graphics()
  for (const o of ORNAMENTS) {
    balls.circle(o.x, o.y, 14).fill(PALETTE[o.color])
    shines.circle(o.x - 5, o.y - 5, 4.5)
  }
  fir.addChild(balls, shines.fill({ color: PALETTE.cream, alpha: 0.85 }))
  // The garland and its unlit bulbs.
  const wire = new Graphics()
  for (const garland of GARLANDS) {
    for (let k = 0; k <= 20; k++) {
      const p = garlandPoint(garland, k / 20)
      if (k === 0) wire.moveTo(p.x, p.y)
      else wire.lineTo(p.x, p.y)
    }
  }
  fir.addChild(wire.stroke({ width: 4, color: PALETTE.ink, alpha: 0.45, cap: 'round' }))
  const bulbs = new Graphics()
  for (const b of BULBS) bulbs.circle(b.x, b.y, 8)
  fir.addChild(bulbs.fill({ color: PALETTE.cream, alpha: 0.35 }))
  fir.addChild(piece(starPath(STAR.x, STAR.y, STAR.radius), PALETTE.orange))
  return fir
}

/** The bush: lobed leaves of fir green with a cream cap of snow on top. */
function drawBush(): Container {
  const bush = pivoted({ x: BUSH.x, y: BUSH.y })
  bush.addChild(piece(lobed(BUSH, 9, 91, true), PALETTE.fir, BIG_SHADOW))
  bush.addChild(piece(lobed({ x: BUSH.x - 10, y: BUSH.y - BUSH.ry * 0.62, rx: BUSH.rx * 0.62, ry: BUSH.ry * 0.36 }, 6, 93, true), PALETTE.cream, null))
  return bush
}

/** A drift: a smooth dome of snow, in shade on the right. */
function drawDrift(e: Ellipse): Container {
  const drift = new Container()
  drift.addChild(piece(ellipseDome(e), PALETTE.snow, BIG_SHADOW))
  drift.addChild(ellipseDome({ x: e.x + e.rx * 0.45, y: e.y, rx: e.rx * 0.55, ry: e.ry * 0.82 })(new Graphics()).fill({ color: PALETTE.sky, alpha: 0.2 }))
  // A darker rim along its top, so that it reads on the snow of the ground.
  drift.addChild(ellipseDome(e)(new Graphics()).stroke({ width: 5, color: PALETTE.sky, alpha: 0.35 }))
  return drift
}

interface SmokePuff {
  node: Graphics
  /** Offset in its life, seconds. */
  offset: number
}

export function createLandscape(): Landscape {
  const actors = new Container({ label: 'actors' })
  const slots = {} as Record<SlotHideoutId, Container>
  for (const id of SLOT_HIDEOUT_IDS) slots[id] = new Container({ label: `slot:${id}` })

  const back = new Container()
  back.addChild(drawHill(slots.hill), drawHouse(slots.house))
  // [SPEC-16.3.3] Puffs of smoke over the chimney, born one after the other.
  const smoke = new Container({ label: 'smoke' })
  const puffs: SmokePuff[] = Array.from({ length: AMBIENT.smoke.puffs }, (_, i) => {
    const node = new Graphics().circle(0, 0, 1).fill(PALETTE.cream)
    smoke.addChild(node)
    return { node, offset: (i * AMBIENT.smoke.life) / AMBIENT.smoke.puffs }
  })
  back.addChild(smoke)

  const middle = new Container()
  middle.addChild(drawTree(slots), drawRock(slots.rock), drawFir(slots.fir))

  const foreground = new Container()
  const bush = drawBush()
  const swaying: Swaying[] = [{ node: bush, phase: 0 }]
  foreground.addChild(bush, drawDrift(DRIFT), drawDrift(BIG_DRIFT))

  const planes: Record<PlaneId, Container> = { sky: drawSky(), far: drawFar(), back, middle, foreground }

  // [SPEC-16.3.3] A few flakes falling slowly over everything.
  const air = new Container({ label: 'air' })
  // Spread over the width of the safe zone, then over what the screen shows.
  const flakes: { flake: Flake; node: Graphics }[] = createFlakes(AMBIENT.flakes.count, { x: 0, y: 0, width: 1440, height: 1080 }, AMBIENT.flakes.radius, 23).map((flake) => {
    const node = new Graphics().circle(0, 0, flake.radius).fill({ color: PALETTE.cream, alpha: AMBIENT.flakes.alpha })
    air.addChild(node)
    return { flake, node }
  })

  const root = new Container({ label: 'landscape' })
  root.addChild(planes.sky, planes.far, planes.back, planes.middle, actors, planes.foreground, air)

  let visible: Rect = { x: 0, y: 0, width: 1440, height: 1080 }
  let time = 0
  const tick = (dt: number) => {
    time += dt
    for (const { node, phase } of swaying) node.skew.x = oscillate(AMBIENT.bush, time, phase)
    for (const { node, offset } of puffs) {
      const p = puff((time + offset) % AMBIENT.smoke.life)
      node.position.set(SMOKE_ORIGIN.x + p.dx, SMOKE_ORIGIN.y + p.dy)
      node.scale.set(p.radius)
      node.alpha = p.alpha
    }
    for (const { flake, node } of flakes) {
      const span = visible.height + 40
      const y = wrap(flake.y + flake.speed * time, visible.y - 20, visible.y - 20 + span)
      const across = visible.x + (flake.x / 1440) * visible.width
      const x = across + AMBIENT.flakes.sway * Math.sin(2 * Math.PI * (time / flake.swayPeriod + flake.phase))
      node.position.set(x, y)
    }
  }

  return {
    root,
    planes,
    actors,
    slots,
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
