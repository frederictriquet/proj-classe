import { describe, expect, it } from 'vitest'
import { contains, insideEllipse, intersects, SAFE_ZONE, viewport, type Ellipse, type Rect } from '../../silence/geometry'
import { AMBIENT } from './ambient'
import { BARN, CABBAGES, DECOR_BOUNDS, HAYSTACK, HENHOUSE, HIDEOUT_IDS, HIDEOUTS, MUD, POND, REEDS, STY, YARD } from './layout'

/** Margin kept between a hiding animal, or an exit, and the edge of the safe zone, in world units. */
const SAFE_MARGIN = 20
/** Margin kept between the drawing of a hideout and the edge of the safe zone. */
const DRAWING_MARGIN = 0

const pointRect = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })

/** Top of a dome standing on its centre line at `x`, or the base when `x` is off the dome. */
const domeTop = (d: Ellipse, x: number): number => d.y - d.ry * Math.sqrt(Math.max(0, 1 - ((x - d.x) / d.rx) ** 2))

describe('farmyard on every screen [SPEC-8.6]', () => {
  it('covers screens from 1:2 to 4:1 with decor', () => {
    for (const [width, height] of [
      [1000, 2000],
      [4000, 1000],
      [1920, 1080],
      [1024, 768],
    ] as const) {
      expect(contains(DECOR_BOUNDS, viewport(width, height).visible)).toBe(true)
    }
  })
})

describe('hideouts and yard [SPEC-12.2] [SPEC-12.3] [SPEC-8.6]', () => {
  it('has the six hideouts of the spec', () => {
    expect(Object.keys(HIDEOUTS).sort()).toEqual([...HIDEOUT_IDS].sort())
    for (const id of HIDEOUT_IDS) expect(HIDEOUTS[id].id).toBe(id)
  })

  it('keeps every hideout, its cover and its exit inside the safe zone', () => {
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(contains(SAFE_ZONE, hideout.cover, SAFE_MARGIN), `${hideout.id} cover`).toBe(true)
      expect(contains(SAFE_ZONE, pointRect(hideout.exit.x, hideout.exit.y), SAFE_MARGIN), `${hideout.id} exit`).toBe(true)
    }
    // The barn and the haystack reach the left edge, the reeds the right one, the cabbages the
    // bottom one: they may overhang it, the covers stay inside.
    for (const hideout of Object.values(HIDEOUTS).filter((h) => !['barn', 'haystack', 'reeds', 'garden'].includes(h.id))) {
      expect(contains(SAFE_ZONE, hideout.footprint, DRAWING_MARGIN), `${hideout.id} footprint`).toBe(true)
    }
  })

  it('keeps the exits outside the hideouts', () => {
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(contains(hideout.footprint, pointRect(hideout.exit.x, hideout.exit.y)), hideout.id).toBe(false)
    }
  })

  it('keeps the yard free of hideouts, and the mud and the pond out of it', () => {
    expect(contains(SAFE_ZONE, YARD, SAFE_MARGIN)).toBe(true)
    for (const hideout of Object.values(HIDEOUTS)) expect(intersects(YARD, hideout.footprint), hideout.id).toBe(false)
    expect(intersects(YARD, { x: POND.x - POND.rx, y: POND.y - POND.ry, width: 2 * POND.rx, height: 2 * POND.ry })).toBe(false)
    expect(MUD.x - MUD.rx).toBeGreaterThan(YARD.x)
  })

  it('keeps hideouts apart, so that each one reads as a separate shape', () => {
    const all = Object.values(HIDEOUTS)
    for (const [i, a] of all.entries()) {
      for (const b of all.slice(i + 1)) expect(intersects(a.footprint, b.footprint), `${a.id} / ${b.id}`).toBe(false)
    }
  })

  it('covers the hiding animal with the shape of its hideout', () => {
    // Inside a building, out of the part its slot shows.
    const barn = HIDEOUTS.barn.cover
    expect(contains(BARN.wall, barn)).toBe(true)
    expect(barn.x + barn.width).toBeLessThanOrEqual(BARN.door.x)
    const hen = HIDEOUTS.henhouse.cover
    expect(contains(HENHOUSE.body, hen)).toBe(true)
    expect(hen.x).toBeGreaterThanOrEqual(HENHOUSE.door.x + HENHOUSE.door.width)
    // Behind the fence: below its notches, above its base.
    const pig = HIDEOUTS.sty.cover
    expect(pig.x).toBeGreaterThanOrEqual(STY.fence.x)
    expect(pig.x + pig.width).toBeLessThanOrEqual(STY.fence.x + STY.fence.width)
    expect(pig.y).toBeGreaterThanOrEqual(STY.fence.y + 30)
    expect(pig.y + pig.height).toBeLessThanOrEqual(STY.fence.y + STY.fence.height)
    // Behind the domes of the foreground: lobed shapes always cover their base ellipse.
    expect(insideEllipse(HIDEOUTS.haystack.cover, HAYSTACK, 0.97)).toBe(true)
    expect(insideEllipse(HIDEOUTS.reeds.cover, REEDS, 0.99)).toBe(true)
    const garden = HIDEOUTS.garden.cover
    for (let x = garden.x; x <= garden.x + garden.width; x += 2) {
      expect(Math.min(...CABBAGES.map((c) => domeTop(c, x))), `cabbages at ${x}`).toBeLessThanOrEqual(garden.y)
    }
  })
})

describe('ambient life [SPEC-8.5]', () => {
  it('moves slowly: every cycle lasts several seconds', () => {
    for (const motion of [AMBIENT.reeds, AMBIENT.cabbage]) expect(motion.period).toBeGreaterThanOrEqual(5)
    expect(SAFE_ZONE.width / AMBIENT.cloudSpeed.max).toBeGreaterThan(120)
  })
})
