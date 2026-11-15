import { describe, expect, it } from 'vitest'
import { pathLengths, pointAt, type AnimalSpec } from '../../silence/animal'
import { contains, intersects, SAFE_ZONE, type Rect } from '../../silence/geometry'
import { ANIMAL_IDS, ANIMALS, branchTopY } from './animal-data'
import { HIDEOUT_IDS } from './layout'

/** Paper shadow of a piece, added to the extent of a drawing (see src/silence/rig.ts). */
const SHADOW = { x: 5, y: 7 }

/** Box of the drawing with its feet at (x, y), facing one way or, if unknown, either way. */
function box(spec: AnimalSpec, x: number, y: number, facing?: 1 | -1): Rect {
  const { left, right, top } = spec.extent
  const l = facing === 1 ? left : facing === -1 ? -right : Math.min(left, -right)
  const r = facing === 1 ? right : facing === -1 ? -left : Math.max(right, -left)
  return { x: x + l, y: y + top, width: r - l + SHADOW.x, height: -top + SHADOW.y }
}

/** Where an animal stays still and is sorted with the others: its place and, when it hides in the
 *  actors layer (the bush), its hiding and peeking points. */
function restingPoints(spec: AnimalSpec): { x: number; y: number; facing: 1 | -1 }[] {
  const place = spec.path[spec.path.length - 1]!
  const points = [{ x: place.x, y: place.y, facing: spec.spotFacing }]
  if (!spec.usesSlot) {
    for (const i of [0, spec.peekIndex]) points.push({ x: spec.path[i]!.x, y: spec.path[i]!.y, facing: spec.hideFacing })
  }
  return points
}

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
    for (const p of spec.path) expect(contains(SAFE_ZONE, box(spec, p.x, p.y), 0), `${p.x},${p.y}`).toBe(true)
    const place = spec.path[spec.path.length - 1]!
    expect(contains(SAFE_ZONE, box(spec, place.x, place.y, spec.spotFacing), 20)).toBe(true)
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
        const ra = box(ANIMALS[a], pa.x, pa.y, pa.facing)
        const rb = box(ANIMALS[b], pb.x, pb.y, pb.facing)
        const overlap =
          Math.max(0, Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) *
          Math.max(0, Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap / Math.min(ra.width * ra.height, rb.width * rb.height), `${a} / ${b}`).toBeLessThan(0.2)
      }
    }
  })

  // Animals in the open are drawn in the order of their feet on the screen. If an animal walking
  // its path passed the depth of a still one while overlapping it, one would jump in front of
  // the other.
  it.each(ANIMAL_IDS)('%s: never crosses the depth of a still animal while overlapping it', (id) => {
    const spec = ANIMALS[id]
    const lengths = pathLengths(spec.path)
    const end = lengths[lengths.length - 1]!
    const samples = []
    // From the exit point: before it, the animal is in its hideout's slot (or hidden by the bush).
    for (let s = spec.usesSlot ? lengths[spec.exitIndex]! : 0; s <= end; s += 1) samples.push(pointAt(spec.path, lengths, s))
    for (const other of ANIMAL_IDS) {
      if (other === id) continue
      for (const still of restingPoints(ANIMALS[other])) {
        const stillBox = box(ANIMALS[other], still.x, still.y, still.facing)
        for (let i = 1; i < samples.length; i++) {
          const a = samples[i - 1]!
          const b = samples[i]!
          if (Math.sign(a.y - still.y) === Math.sign(b.y - still.y)) continue
          const facing = Math.abs(b.dx) > 0.25 ? (Math.sign(b.dx) as 1 | -1) : undefined
          expect(intersects(box(spec, b.x, b.y, facing), stillBox), `${id} at ${b.x.toFixed(0)},${b.y.toFixed(0)} / ${other}`).toBe(false)
        }
      }
    }
  })
})
