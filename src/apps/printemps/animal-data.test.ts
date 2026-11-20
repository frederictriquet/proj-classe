import { describe, expect, it } from 'vitest'
import { liftOf } from '../../silence/animal'
import { contains, intersects, lobedBounds, SAFE_ZONE, type Rect } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import { ANIMAL_IDS, ANIMALS, PLANT_HEIGHTS, PLANT_IDS, type AnimalId } from './animal-data'
import { COVERS, domeTop, FAR_VALLEY, HIDEOUT_IDS, MOLEHILL, NEST, NEST_BOX, SKEP_HOLE, SUN, SUN_CLOUD, SWALLOW_CLOUD, tulipTop } from './layout'

/** Box of a character at a point of its path, facing `facing` (right for one seen from the front,
 *  drawn as it is); a plant is never lifted. */
const boxAt = (id: AnimalId, i: number, facing?: 1 | -1): Rect => {
  const spec = ANIMALS[id]
  const p = spec.path[i]!
  return drawingBox(spec, p.x, p.y, spec.frontal ? 1 : facing, liftOf(spec, p.height ?? 0))
}
const placeBox = (id: AnimalId): Rect => {
  const p = restingPoints(ANIMALS[id])[0]!
  return drawingBox(ANIMALS[id], p.x, p.y, p.facing, p.height)
}

describe('characters [SPEC-17.2]', () => {
  it('come out from the least to the most timid, the bees after the tulips [SPEC-9.4.1] [SPEC-17.2.2]', () => {
    expect(ANIMAL_IDS).toEqual(['tulips', 'buds', 'bee1', 'nestlings', 'daffodils', 'tit', 'mole', 'bee2', 'swallow1', 'swallow2'])
  })

  it('use the eight hideouts; the bees share the skep, the swallows the cloud', () => {
    const used = ANIMAL_IDS.map((id) => ANIMALS[id].hideout)
    expect(new Set(used)).toEqual(new Set(HIDEOUT_IDS))
    expect(used.filter((h, i) => used.indexOf(h) !== i)).toEqual(['skep', 'cloud'])
  })

  it.each(ANIMAL_IDS)('%s: path and place lie in the safe zone [SPEC-8.6]', (id) => {
    const spec = ANIMALS[id]
    expect(spec.id).toBe(id)
    expect(0 < spec.peekIndex && spec.peekIndex < spec.exitIndex && spec.exitIndex < spec.path.length).toBe(true)
    for (const [i, p] of spec.path.entries()) expect(contains(SAFE_ZONE, boxAt(id, i), 0), `${p.x},${p.y}`).toBe(true)
    expect(contains(SAFE_ZONE, placeBox(id), 10)).toBe(true)
  })

  // [SPEC-17.2.1] A plant stays where it grows; its path only measures how far it opens.
  it.each(PLANT_IDS)('%s: grows in place, from closed to open', (id) => {
    const spec = ANIMALS[id]
    expect(spec.gait).toBe('grow')
    expect(spec.frontal).toBe(true)
    expect(spec.usesSlot).toBe(false)
    expect(new Set(spec.path.map((p) => `${p.x},${p.y}`)).size).toBe(1)
    expect(spec.path.map((p) => p.height)).toEqual([PLANT_HEIGHTS.hidden, PLANT_HEIGHTS.peek, PLANT_HEIGHTS.exit, PLANT_HEIGHTS.open])
    // Closes in under a second [SPEC-8.5].
    expect(PLANT_HEIGHTS.open / spec.speed.flee).toBeLessThan(1)
  })

  it.each(['bee1', 'bee2', 'tit', 'swallow1', 'swallow2', 'nestlings'] as const)('%s: hides inside the cover of its hideout', (id) => {
    const spec = ANIMALS[id]
    const cover = COVERS[spec.hideout as keyof typeof COVERS]
    const box = boxAt(id, 0, spec.hideFacing)
    expect(contains(cover, { ...box, height: box.height - 7 }), JSON.stringify(box)).toBe(true)
  })

  it('mole: hides behind the molehill, peeks with its eyes over it, settles beside it', () => {
    const { path } = ANIMALS.mole
    const hidden = boxAt('mole', 0, -1)
    for (let x = hidden.x; x <= hidden.x + hidden.width; x += 2) expect(hidden.y, `at ${x}`).toBeGreaterThanOrEqual(domeTop(MOLEHILL, x))
    // Its eyes, about 58 above its feet.
    const peek = path[1]!
    expect(peek.y - (peek.height ?? 0) - 58).toBeLessThan(domeTop(MOLEHILL, peek.x))
    // Clear of the molehill, which would hide it.
    const place = placeBox('mole')
    expect(place.x + place.width).toBeLessThan(MOLEHILL.x - MOLEHILL.rx)
  })

  it('nestlings: below the rim of the nest when hidden, their heads over it once out [SPEC-17.2.3]', () => {
    expect(boxAt('nestlings', 0).y).toBeGreaterThanOrEqual(NEST.rim)
    expect(boxAt('nestlings', 1).y).toBeLessThan(NEST.rim - 20)
    // Their bodies stay in the nest.
    const place = placeBox('nestlings')
    expect(place.y + place.height - 7).toBeGreaterThan(NEST.rim)
  })

  // [SPEC-17.2.2] On the rims of the first and the last tulip; none on the daffodils.
  it('bees land on the tulips, in front of them', () => {
    for (const [id, tulip] of [
      ['bee1', 0],
      ['bee2', 2],
    ] as const) {
      const place = ANIMALS[id].path.at(-1)!
      const top = tulipTop(tulip)
      expect(place.x).toBe(top.x)
      expect(place.y - (place.height ?? 0)).toBe(top.y)
      expect(place.y).toBeGreaterThan(ANIMALS.tulips.path[0]!.y)
      expect(ANIMAL_IDS.indexOf(id)).toBeGreaterThan(ANIMAL_IDS.indexOf('tulips'))
    }
  })

  // Slot hideouts: at the exit point the character lies inside the hole its slot shows, or clear of
  // the cloud, so that changing layer shows no jump (the gallery measures it on screen).
  it('exit where the slot shows the whole character', () => {
    for (const id of ['bee1', 'bee2'] as const) expect(contains(SKEP_HOLE, boxAt(id, ANIMALS[id].exitIndex)), id).toBe(true)
    expect(contains(NEST_BOX.hole, boxAt('tit', ANIMALS.tit.exitIndex))).toBe(true)
    for (const id of ['swallow1', 'swallow2'] as const) {
      const box = boxAt(id, ANIMALS[id].exitIndex, -1)
      // The cloud is lobed: its lobes bulge up to a tenth out of its ellipse.
      expect(box.x + box.width, id).toBeLessThan(SWALLOW_CLOUD.x - SWALLOW_CLOUD.rx * 1.1)
    }
  })

  // [SPEC-17.5.1] The blue of the birds is too close to the leaf green of the hills and to the
  // red of the roof; the cream and yellow of the tit too close to the cream of the clouds.
  it('perch the tit on the ridge of the nest box and the swallows on the fence, the sky behind them', () => {
    const tit = ANIMALS.tit.path.at(-1)!
    expect(tit.y - (tit.height ?? 0)).toBe(NEST_BOX.roofTop + 4)
    const titBox = placeBox('tit')
    expect(intersects(titBox, lobedBounds(SUN_CLOUD, false))).toBe(false)
    expect(intersects(titBox, { x: SUN.x - SUN.radius, y: SUN.y - SUN.radius, width: 2 * SUN.radius, height: 2 * SUN.radius })).toBe(false)
    for (const id of ['swallow1', 'swallow2'] as const) {
      const box = placeBox(id)
      expect(box.x, id).toBeGreaterThanOrEqual(FAR_VALLEY.from)
      expect(box.x + box.width, id).toBeLessThanOrEqual(FAR_VALLEY.to)
    }
  })

  // Boxes are coarse: the screenshots show the drawings themselves apart. The bees land on the
  // tulips by design [SPEC-17.2.2]; the nest sits in the cherry tree among the buds.
  it('places keep the characters apart: their boxes overlap little', () => {
    const together = new Set(['bee1/tulips', 'bee2/tulips', 'buds/nestlings'])
    for (const [i, a] of ANIMAL_IDS.entries()) {
      for (const b of ANIMAL_IDS.slice(i + 1)) {
        if (together.has([a, b].sort().join('/'))) continue
        const ra = placeBox(a)
        const rb = placeBox(b)
        if (!intersects(ra, rb)) continue
        const overlap = (Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) * (Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap / Math.min(ra.width * ra.height, rb.width * rb.height), `${a} / ${b}`).toBeLessThan(0.2)
      }
    }
  })

  // Characters in the open are drawn in the order of their feet on the screen: see overlap.ts.
  it.each(ANIMAL_IDS)('%s: never crosses the depth of a still character while overlapping it', (id) => {
    expect(depthCrossings(ANIMALS, id)).toEqual([])
  })
})
