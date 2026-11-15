import { describe, expect, it } from 'vitest'
import { contains, insideEllipse, intersects, SAFE_ZONE, viewport, type Rect } from '../../silence/geometry'
import { drawingBox } from '../../silence/overlap'
import { AMBIENT, DRIP_PERIOD, dropAt } from './ambient'
import {
  APIARY_FRONT_Y,
  BEE_FLOWERS,
  BIG_FLOWERS,
  CELLS,
  cellBox,
  CLUMP,
  COMB,
  COMB_INNER,
  DECOR_BOUNDS,
  DRIP,
  EXTENT_BUDGET,
  FLIGHT_HOLE,
  HIDEOUT_IDS,
  HIDEOUTS,
  HIVE,
  PLACES,
  POT,
  STUMP,
  TUFTS_TOP,
  type Place,
} from './layout'

/** Margin kept between a place or a hiding spot and the edge of the safe zone, in world units. */
const SAFE_MARGIN = 0

const pointRect = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })
const area = (r: Rect) => r.width * r.height
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

/** Drawing box of an animal of the size budget settled at its place, paper shadow included. */
const placeBox = (p: Place): Rect => drawingBox({ extent: EXTENT_BUDGET[p.animal] }, p.x, p.y, p.facing, p.height)

const HIVE_BOX: Rect = HIDEOUTS.hive.footprint
const COMB_BOX: Rect = { x: COMB.frame.x - COMB.lug, y: COMB.frame.y, width: COMB.frame.width + 2 * COMB.lug, height: COMB.groundY - COMB.frame.y }

describe('apiary on every screen [SPEC-8.6]', () => {
  it('covers screens from 1:2 to 4:1 with decor', () => {
    for (const [width, height] of [
      [1000, 2000],
      [4000, 1000],
      [1920, 1080],
      [1440, 900],
      [1024, 768],
    ] as const) {
      expect(contains(DECOR_BOUNDS, viewport(width, height).visible)).toBe(true)
    }
  })

  it('keeps the hive, the comb, the pot and every place in the safe zone', () => {
    expect(contains(SAFE_ZONE, HIVE_BOX), 'hive').toBe(true)
    expect(contains(SAFE_ZONE, COMB_BOX), 'comb').toBe(true)
    expect(contains(SAFE_ZONE, { x: STUMP.x - STUMP.rx - 30, y: POT.mouthY - 10, width: 2 * STUMP.rx + 60, height: STUMP.groundY - POT.mouthY + 16 }), 'pot').toBe(true)
    for (const [i, p] of PLACES.entries()) expect(contains(SAFE_ZONE, placeBox(p), SAFE_MARGIN), `place ${i} (${p.support})`).toBe(true)
  })
})

describe('places of the animals [SPEC-13.2]', () => {
  it('has seventeen places: fifteen bees, then two butterflies', () => {
    expect(PLACES).toHaveLength(17)
    expect(PLACES.slice(0, 15).every((p) => p.animal === 'bee')).toBe(true)
    expect(PLACES.slice(15).every((p) => p.animal === 'butterfly')).toBe(true)
  })

  it('puts most bees on the flowers, two or three on the comb, one or two on the flight board [SPEC-13.2.1]', () => {
    const bees = PLACES.filter((p) => p.animal === 'bee')
    const on = (support: Place['support']) => bees.filter((p) => p.support === support).length
    expect(on('comb')).toBeGreaterThanOrEqual(2)
    expect(on('comb')).toBeLessThanOrEqual(3)
    expect(on('board')).toBeGreaterThanOrEqual(1)
    expect(on('board')).toBeLessThanOrEqual(2)
    expect(on('flower')).toBeGreaterThan(bees.length / 2)
  })

  it('puts the butterflies on the two biggest flowers [SPEC-13.2.2]', () => {
    const smallestBig = Math.min(...BIG_FLOWERS.map((f) => f.radius))
    for (const f of BEE_FLOWERS) expect(f.radius).toBeLessThan(smallestBig)
    const butterflies = PLACES.filter((p) => p.animal === 'butterfly')
    expect(butterflies.map((p) => [p.x, p.y - p.height])).toEqual(BIG_FLOWERS.map((f) => [f.x, f.y - f.height]))
  })

  it('perches every bee of the meadow on the heart of a pink or blue flower, never on cream [SPEC-13.5]', () => {
    const flowers = PLACES.filter((p) => p.animal === 'bee' && p.support === 'flower')
    expect(flowers.map((p) => [p.x, p.y, p.height])).toEqual(BEE_FLOWERS.map((f) => [f.x, f.y, f.height]))
    for (const f of BEE_FLOWERS) expect(['pink', 'blue']).toContain(f.color)
  })

  it('perches the bees of the comb on its honey, clear of the empty cells the reward fills [SPEC-13.4]', () => {
    for (const p of PLACES.filter((q) => q.support === 'comb')) {
      const box = placeBox(p)
      expect(contains(COMB_INNER, { ...pointRect(p.x, p.y - p.height) })).toBe(true)
      for (const cell of CELLS.filter((c) => !c.full)) expect(intersects(box, cellBox(cell)), `comb place at ${p.x}`).toBe(false)
    }
  })

  it('perches the bees of the board on it, clear of the middle of the flight hole', () => {
    const { hole, board, body } = HIVE
    for (const p of PLACES.filter((q) => q.support === 'board')) {
      const feet = p.y - p.height
      expect(feet).toBeGreaterThanOrEqual(board.backY)
      expect(feet).toBeLessThanOrEqual(board.frontY)
      expect(p.x).toBeGreaterThanOrEqual(board.frontX)
      expect(p.x).toBeLessThanOrEqual(board.frontX + board.frontWidth)
      const box = placeBox(p)
      expect(box.x + box.width < hole.x + hole.width / 4 || box.x > hole.x + (3 * hole.width) / 4, `board place at ${p.x}`).toBe(true)
      expect(p.y).toBeGreaterThan(body.y + body.height)
    }
  })

  // As for the farm: settled animals overlap little, so that each one reads on its own.
  it('keeps the animals apart: their boxes overlap little', () => {
    for (const [i, a] of PLACES.entries()) {
      for (const [j, b] of PLACES.entries()) {
        if (j <= i) continue
        const ra = placeBox(a)
        const rb = placeBox(b)
        expect(overlapArea(ra, rb) / Math.min(area(ra), area(rb)), `place ${i} / place ${j}`).toBeLessThan(0.2)
      }
    }
  })

  it('keeps every place clear of the foreground, which is in front of the animals', () => {
    const foreground = [HIDEOUTS.clump.footprint, { x: DECOR_BOUNDS.x, y: TUFTS_TOP, width: DECOR_BOUNDS.width, height: 100 }]
    for (const [i, p] of PLACES.entries()) {
      for (const shape of foreground) expect(intersects(placeBox(p), shape), `place ${i}`).toBe(false)
    }
  })

  it('stands the perches of the apiary in front of the hive and the comb', () => {
    expect(APIARY_FRONT_Y).toBeGreaterThan(HIVE.groundY)
    expect(APIARY_FRONT_Y).toBeGreaterThan(COMB.groundY)
  })
})

describe('hideouts [SPEC-13.2] [SPEC-13.2.1] [SPEC-13.2.2]', () => {
  it('has the hive and the clump', () => {
    expect(Object.keys(HIDEOUTS).sort()).toEqual([...HIDEOUT_IDS].sort())
    for (const id of HIDEOUT_IDS) expect(HIDEOUTS[id].id).toBe(id)
  })

  it('keeps the hiding spots and the exits in the safe zone', () => {
    for (const h of Object.values(HIDEOUTS)) {
      expect(contains(SAFE_ZONE, h.cover), `${h.id} cover`).toBe(true)
      expect(contains(SAFE_ZONE, pointRect(h.exit.x, h.exit.y - h.exit.height)), `${h.id} exit`).toBe(true)
    }
  })

  it('hides the bees inside the body of the hive, out of the flight hole its slot shows', () => {
    const { cover } = HIDEOUTS.hive
    expect(contains(HIVE.body, cover)).toBe(true)
    expect(intersects(cover, HIVE.hole)).toBe(false)
    expect(cover.height).toBeGreaterThanOrEqual(-EXTENT_BUDGET.bee.top)
  })

  it('makes the flight hole wide enough for several heads, and tall enough for a whole bee', () => {
    const { rect, peeks, inside } = FLIGHT_HOLE
    expect(peeks.length).toBeGreaterThanOrEqual(2)
    for (const p of peeks) {
      expect(p.x).toBeGreaterThan(rect.x)
      expect(p.x).toBeLessThan(rect.x + rect.width)
      // Feet hidden below the sill, head in the hole.
      const feet = p.y - p.height
      expect(feet).toBeGreaterThan(rect.y + rect.height)
      expect(feet + EXTENT_BUDGET.bee.top).toBeLessThan(rect.y + rect.height)
    }
    const box = drawingBox({ extent: EXTENT_BUDGET.bee }, inside.x, inside.y, 1, inside.height)
    expect(contains(rect, box)).toBe(true)
  })

  it('hides the butterflies behind the leaves of the clump, and lets them out above it', () => {
    const { cover, exit, footprint } = HIDEOUTS.clump
    expect(insideEllipse(cover, CLUMP, 0.97)).toBe(true)
    expect(exit.y - exit.height).toBeLessThan(footprint.y)
  })

  it('keeps the hideouts and the comb apart, so that each one reads as a separate shape', () => {
    expect(intersects(HIVE_BOX, COMB_BOX)).toBe(false)
    expect(intersects(HIDEOUTS.hive.footprint, HIDEOUTS.clump.footprint)).toBe(false)
  })
})

describe('comb, drop and pot [SPEC-13.3] [SPEC-13.4]', () => {
  it('lays the cells inside the frame without overlap, some full and some empty', () => {
    for (const cell of CELLS) expect(contains(COMB_INNER, cellBox(cell))).toBe(true)
    for (const [i, a] of CELLS.entries()) {
      for (const b of CELLS.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(Math.sqrt(3) * COMB.cellRadius - 0.01)
    }
    const empty = CELLS.filter((c) => !c.full).length
    expect(empty).toBeGreaterThanOrEqual(6)
    expect(CELLS.length - empty).toBeGreaterThan(empty)
  })

  it('drips from the bottom of the frame into the pot', () => {
    expect(DRIP.y).toBe(COMB.frame.y + COMB.frame.height)
    expect(Math.abs(DRIP.x - POT.x)).toBeLessThan(POT.mouthRx)
    expect(DRIP.fallTo).toBeGreaterThan(POT.mouthY)
    expect(DRIP.x).toBeGreaterThan(COMB.frame.x)
    expect(DRIP.x).toBeLessThan(COMB.frame.x + COMB.frame.width)
  })
})

describe('ambient life [SPEC-8.5]', () => {
  it('moves slowly: every cycle lasts several seconds', () => {
    for (const motion of [AMBIENT.daisy, AMBIENT.clump, AMBIENT.tuft]) expect(motion.period).toBeGreaterThanOrEqual(5)
    expect(DRIP_PERIOD).toBeGreaterThanOrEqual(5)
    expect(SAFE_ZONE.width / AMBIENT.cloudSpeed.max).toBeGreaterThan(120)
  })

  it('never makes the drop appear or vanish at once: it grows from nothing and fades out', () => {
    const frame = 1 / 60
    let previous = dropAt(0)
    expect(previous.scale).toBe(0)
    for (let t = frame; t < 3 * DRIP_PERIOD; t += frame) {
      const drop = dropAt(t)
      const shown = (d: typeof drop) => d.scale * d.alpha
      expect(Math.abs(shown(drop) - shown(previous)), `t = ${t.toFixed(2)}`).toBeLessThan(0.05)
      previous = drop
    }
  })
})
