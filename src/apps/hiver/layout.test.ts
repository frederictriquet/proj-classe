import { describe, expect, it } from 'vitest'
import { contains, insideEllipse, intersects, SAFE_ZONE, viewport, type Rect } from '../../silence/geometry'
import { AMBIENT, puff } from './ambient'
import { BIG_DRIFT, BUSH, DECOR_BOUNDS, DRIFT, firHalfWidth, FIR, HIDEOUT_IDS, HIDEOUTS, HILL, HOUSE, ROBIN_NEST, ROCK, TREE, trunkAt } from './layout'

/** Margin kept between a hiding character, or an exit, and the edge of the safe zone. */
const SAFE_MARGIN = 20

const pointRect = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })

/** True when the rectangle lies inside the Christmas tree's cone. */
const insideFir = (r: Rect): boolean =>
  [r.y, r.y + r.height].every((y) => r.x >= FIR.x - firHalfWidth(y) && r.x + r.width <= FIR.x + firHalfWidth(y)) && r.y + r.height <= FIR.base

/** True when the rectangle lies inside the trunk. */
const insideTrunk = (r: Rect): boolean =>
  [r.y, r.y + r.height].every((y) => r.x >= trunkAt(y).left && r.x + r.width <= trunkAt(y).right) && r.y >= TREE.top.y && r.y + r.height <= TREE.base.y

describe('winter landscape on every screen [SPEC-8.6]', () => {
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

describe('hideouts [SPEC-16.2] [SPEC-16.3] [SPEC-8.6]', () => {
  it('has the nine hideouts of the spec', () => {
    expect(Object.keys(HIDEOUTS).sort()).toEqual([...HIDEOUT_IDS].sort())
    for (const id of HIDEOUT_IDS) expect(HIDEOUTS[id].id).toBe(id)
  })

  it('keeps every cover and every exit inside the safe zone', () => {
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(contains(SAFE_ZONE, hideout.cover, SAFE_MARGIN), `${hideout.id} cover`).toBe(true)
      expect(contains(SAFE_ZONE, pointRect(hideout.exit.x, hideout.exit.y), SAFE_MARGIN), `${hideout.id} exit`).toBe(true)
    }
  })

  it('keeps the exits outside the shapes that hide, except where a slot shows them', () => {
    for (const id of ['drift', 'bush', 'bigDrift', 'rock', 'fir'] as const) {
      const { footprint, exit } = HIDEOUTS[id]
      expect(contains(footprint, pointRect(exit.x, exit.y)), id).toBe(false)
    }
  })

  // The tree holds two hideouts (hollow and trunk); the rock stands in front of the hill and of the
  // foot of the trunk, the hill touches the trunk; the house and the big drift overlap the
  // Christmas tree. Every other pair reads as
  // separate shapes.
  it('keeps the other hideouts apart', () => {
    const together = new Set(['hollow/trunk', 'hollow/rock', 'rock/trunk', 'hill/rock', 'hill/hollow', 'hill/trunk', 'fir/house', 'bigDrift/fir'])
    const all = Object.values(HIDEOUTS)
    for (const [i, a] of all.entries()) {
      for (const b of all.slice(i + 1)) {
        if (together.has([a.id, b.id].sort().join('/'))) continue
        expect(intersects(a.footprint, b.footprint), `${a.id} / ${b.id}`).toBe(false)
      }
    }
  })

  it('covers the hiding character with the shape of its hideout', () => {
    expect(insideEllipse(HIDEOUTS.drift.cover, DRIFT, 0.99)).toBe(true)
    expect(insideEllipse(HIDEOUTS.bush.cover, BUSH, 0.995)).toBe(true)
    expect(insideEllipse(HIDEOUTS.bigDrift.cover, BIG_DRIFT, 0.99)).toBe(true)
    expect(insideEllipse(HIDEOUTS.hill.cover, HILL, 0.99)).toBe(true)
    expect(insideFir(HIDEOUTS.fir.cover)).toBe(true)
    expect(insideFir(ROBIN_NEST)).toBe(true)
    expect(insideTrunk(HIDEOUTS.trunk.cover)).toBe(true)
    // Below the sill of the hollow, inside the trunk.
    const squirrel = HIDEOUTS.hollow.cover
    expect(insideTrunk(squirrel)).toBe(true)
    expect(squirrel.y).toBeGreaterThanOrEqual(TREE.hollow.y + TREE.hollow.height)
    expect(contains(TREE.hollow, pointRect(HIDEOUTS.hollow.exit.x, HIDEOUTS.hollow.exit.y))).toBe(true)
    // Behind the body of the rock.
    expect(contains(ROCK.body, HIDEOUTS.rock.cover)).toBe(true)
    // Inside the wall, right of the door.
    const santa = HIDEOUTS.house.cover
    expect(contains(HOUSE.wall, santa)).toBe(true)
    expect(santa.x).toBeGreaterThanOrEqual(HOUSE.door.x + HOUSE.door.width)
  })
})

describe('ambient life [SPEC-8.5] [SPEC-16.3.3]', () => {
  it('moves slowly: every cycle lasts several seconds', () => {
    expect(AMBIENT.bush.period).toBeGreaterThanOrEqual(5)
    expect(AMBIENT.smoke.life).toBeGreaterThanOrEqual(5)
    expect(AMBIENT.flakes.swayPeriod[0]).toBeGreaterThanOrEqual(5)
    // A flake takes about a minute to cross the safe zone.
    expect(SAFE_ZONE.height / AMBIENT.flakes.speed[1]).toBeGreaterThan(40)
  })

  it('lets a puff of smoke appear and fade without a jump', () => {
    expect(puff(0).alpha).toBe(0)
    expect(puff(AMBIENT.smoke.life).alpha).toBe(0)
    let previous = 0
    for (let age = 0.05; age <= AMBIENT.smoke.life; age += 0.05) {
      const { alpha } = puff(age)
      expect(Math.abs(alpha - previous)).toBeLessThan(0.02)
      previous = alpha
    }
  })
})
