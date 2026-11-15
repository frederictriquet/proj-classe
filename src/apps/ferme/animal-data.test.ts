import { describe, expect, it } from 'vitest'
import { contains, SAFE_ZONE } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import { ANIMAL_IDS, ANIMALS, rampY } from './animal-data'
import { HIDEOUT_IDS } from './layout'

describe('animals [SPEC-12.2]', () => {
  it('come out from the least to the most timid [SPEC-9.4.1]', () => {
    expect(ANIMAL_IDS).toEqual(['hen', 'horse', 'rabbit', 'sheep', 'pig', 'cow', 'duck', 'goat'])
  })

  it('use the six hideouts; the barn and the haystack are shared', () => {
    const used = ANIMAL_IDS.map((id) => ANIMALS[id].hideout)
    expect(new Set(used)).toEqual(new Set(HIDEOUT_IDS))
    const shared = used.filter((h, i) => used.indexOf(h) !== i).sort()
    expect(shared).toEqual(['barn', 'haystack'])
  })

  it('hen walks down the ramp of the henhouse', () => {
    const { path, exitIndex } = ANIMALS.hen
    for (const p of path.slice(exitIndex, -1)) expect(p.y).toBeCloseTo(rampY(p.x), 6)
  })

  it('horse and cow settle at the back of the yard, behind every small animal', () => {
    const back = Math.max(...(['horse', 'cow'] as const).map((id) => ANIMALS[id].path.at(-1)!.y))
    for (const id of ['rabbit', 'sheep', 'pig', 'duck'] as const) expect(ANIMALS[id].path.at(-1)!.y, id).toBeGreaterThan(back)
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

  // Boxes are coarse (a horse's box covers the space under its head): the screenshots show the
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
