import { describe, expect, it } from 'vitest'
import { contains, insideEllipse, SAFE_ZONE, viewport, type Rect } from '../../silence/geometry'
import { AMBIENT } from './ambient'
import { COVERS, DECOR_BOUNDS, LEAF_PILE, MOLEHILL, NEST, NEST_BOX, nestHalfWidth, SKEP, SKEP_HOLE, skepHalfWidth, SWALLOW_CLOUD } from './layout'

/** True when the rectangle lies inside the front of the nest. */
const insideNest = (r: Rect): boolean =>
  [r.y, r.y + r.height].every((y) => r.x >= NEST.x - nestHalfWidth(y) && r.x + r.width <= NEST.x + nestHalfWidth(y))

/** True when the rectangle lies inside the skep. */
const insideSkep = (r: Rect): boolean => [r.y, r.y + r.height].every((y) => r.x >= SKEP.x - skepHalfWidth(y) && r.x + r.width <= SKEP.x + skepHalfWidth(y))

describe('spring meadow on every screen [SPEC-8.6]', () => {
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

describe('hideouts [SPEC-17.2] [SPEC-17.3] [SPEC-8.6]', () => {
  it('keeps every cover inside the safe zone', () => {
    for (const [id, cover] of Object.entries(COVERS)) expect(contains(SAFE_ZONE, cover, 20), id).toBe(true)
  })

  it('covers the hiding character with the shape of its hideout', () => {
    expect(insideEllipse(COVERS.cloud, SWALLOW_CLOUD, 0.99)).toBe(true)
    expect(insideEllipse(COVERS.molehill, MOLEHILL, 0.99)).toBe(true)
    expect(insideEllipse(COVERS.leafPile, LEAF_PILE, 0.99)).toBe(true)
    // The pile stands on a base below the feet of the hidden hedgehog: it hides their shadow.
    expect(LEAF_PILE.y).toBeGreaterThan(COVERS.leafPile.y + COVERS.leafPile.height + 8)
    expect(insideNest(COVERS.nest)).toBe(true)
    expect(COVERS.nest.y).toBeGreaterThanOrEqual(NEST.rim)
    // Inside the skep and the nest box, below the sill of their hole: their slot, shown only
    // through the hole, shows nothing of a hidden character.
    expect(insideSkep(COVERS.skep)).toBe(true)
    expect(COVERS.skep.y).toBeGreaterThanOrEqual(SKEP_HOLE.y + SKEP_HOLE.height)
    expect(contains(NEST_BOX.front, COVERS.nestBox)).toBe(true)
    expect(COVERS.nestBox.y).toBeGreaterThanOrEqual(NEST_BOX.hole.y + NEST_BOX.hole.height)
  })

  it('cuts the holes inside the skep and the nest box', () => {
    expect(insideSkep(SKEP_HOLE)).toBe(true)
    expect(contains(NEST_BOX.front, NEST_BOX.hole, 10)).toBe(true)
  })
})

describe('ambient life [SPEC-8.5] [SPEC-17.3]', () => {
  it('moves slowly: every cycle lasts several seconds', () => {
    expect(AMBIENT.tufts.period).toBeGreaterThanOrEqual(5)
    expect(AMBIENT.petals.swayPeriod[0]).toBeGreaterThanOrEqual(5)
    // A petal takes about half a minute to cross the safe zone, the far cloud minutes.
    expect(SAFE_ZONE.height / AMBIENT.petals.speed[1]).toBeGreaterThan(20)
    expect(SAFE_ZONE.width / AMBIENT.cloud.speed).toBeGreaterThan(120)
  })
})
