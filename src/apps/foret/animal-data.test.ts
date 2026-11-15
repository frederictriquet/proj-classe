import { describe, expect, it } from 'vitest'
import { contains, SAFE_ZONE } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import { ANIMAL_IDS, ANIMALS, branchTopY } from './animal-data'
import { HIDEOUT_IDS } from './layout'

describe('animals [SPEC-9.3]', () => {
  it('come out from the least to the most timid [SPEC-9.4.1]', () => {
    expect(ANIMAL_IDS).toEqual(['squirrel', 'rabbit', 'hedgehog', 'owl', 'fox', 'fawn'])
  })

  it('use the five hideouts; only the bush, the largest, is shared', () => {
    const used = ANIMAL_IDS.map((id) => ANIMALS[id].hideout)
    expect(new Set(used)).toEqual(new Set(HIDEOUT_IDS))
    const shared = used.filter((h, i) => used.indexOf(h) !== i)
    expect(shared).toEqual(['bush'])
    // Animals of the bush come out at different heights.
    const [a, b] = ANIMAL_IDS.filter((id) => ANIMALS[id].hideout === 'bush').map((id) => ANIMALS[id])
    expect(Math.abs(a!.path[a!.peekIndex]!.y + a!.extent.top - (b!.path[b!.peekIndex]!.y + b!.extent.top))).toBeGreaterThan(100)
  })

  it.each(ANIMAL_IDS)('%s: path and place lie in the safe zone [SPEC-8.6]', (id) => {
    const spec = ANIMALS[id]
    expect(spec.id).toBe(id)
    expect(0 < spec.peekIndex && spec.peekIndex < spec.exitIndex && spec.exitIndex < spec.path.length).toBe(true)
    for (const p of spec.path) expect(contains(SAFE_ZONE, drawingBox(spec, p.x, p.y), 0), `${p.x},${p.y}`).toBe(true)
    const place = spec.path[spec.path.length - 1]!
    expect(contains(SAFE_ZONE, drawingBox(spec, place.x, place.y, spec.spotFacing), 20)).toBe(true)
    expect(Math.min(...spec.path.map((p) => p.crouch))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...spec.path.map((p) => p.crouch))).toBeLessThanOrEqual(1)
  })

  it('owl stands on the high branch', () => {
    for (const p of ANIMALS.owl.path) expect(p.y).toBeCloseTo(branchTopY(p.x), 6)
  })

  // Boxes are coarse (a fawn's box covers the space under its head): the screenshots show the
  // drawings themselves apart.
  it('places keep the animals apart: their boxes overlap little', () => {
    for (const [i, a] of ANIMAL_IDS.entries()) {
      for (const b of ANIMAL_IDS.slice(i + 1)) {
        const pa = restingPoints(ANIMALS[a])[0]!
        const pb = restingPoints(ANIMALS[b])[0]!
        const ra = drawingBox(ANIMALS[a], pa.x, pa.y, pa.facing)
        const rb = drawingBox(ANIMALS[b], pb.x, pb.y, pb.facing)
        const overlap =
          Math.max(0, Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) *
          Math.max(0, Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap / Math.min(ra.width * ra.height, rb.width * rb.height), `${a} / ${b}`).toBeLessThan(0.2)
      }
    }
  })

  // Animals in the open are drawn in the order of their feet on the screen: see overlap.ts.
  it.each(ANIMAL_IDS)('%s: never crosses the depth of a still animal while overlapping it', (id) => {
    expect(depthCrossings(ANIMALS, id)).toEqual([])
  })
})
