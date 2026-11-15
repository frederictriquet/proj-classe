import { describe, expect, it } from 'vitest'
import { MAX_WING_RATE } from '../../silence/animal'
import { AnimalModel } from '../../silence/animal-model'
import { contains, intersects, SAFE_ZONE } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import {
  ANIMAL_IDS,
  ANIMALS,
  BEE_IDS,
  BEE_WINGS,
  BUTTERFLY_EXTENT,
  BUTTERFLY_IDS,
  isBee,
  rucheAnimals,
  type BeeWingStyle,
} from './animal-data'
import { EXTENT_BUDGET, FLIGHT_HOLE, HIDEOUTS, PLACES } from './layout'

const DT = 1 / 60
const STYLES = Object.keys(BEE_WINGS) as BeeWingStyle[]

describe('animals [SPEC-13.2]', () => {
  it('come out bees first, fifteen of them, then the two butterflies [SPEC-9.4.1]', () => {
    expect(ANIMAL_IDS).toHaveLength(17)
    expect(ANIMAL_IDS.slice(0, 15)).toEqual([...BEE_IDS])
    expect(ANIMAL_IDS.slice(15)).toEqual([...BUTTERFLY_IDS])
    for (const id of ANIMAL_IDS) expect(ANIMALS[id].id).toBe(id)
  })

  it('hide the bees in the hive and the butterflies behind the clump', () => {
    for (const id of ANIMAL_IDS) expect(ANIMALS[id].hideout).toBe(isBee(id) ? 'hive' : 'clump')
  })

  it('all fly [SPEC-13.2.3], wings beating a few times per second at most [SPEC-13.2.4]', () => {
    for (const style of STYLES) {
      const animals = rucheAnimals(style)
      for (const id of ANIMAL_IDS) {
        const { gait, flight } = animals[id]
        expect(gait).toBe('fly')
        expect(Math.max(flight!.wingRate, flight!.restRate), `${style} ${id}`).toBeLessThanOrEqual(MAX_WING_RATE)
      }
    }
  })

  it('give the butterflies, settled, a slow opening and closing of the wings; the bees fold theirs [SPEC-13.2.2]', () => {
    for (const id of ANIMAL_IDS) {
      const { restBeat, restRate } = ANIMALS[id].flight!
      if (isBee(id)) expect(restBeat).toBe(0)
      else {
        expect(restBeat).toBeGreaterThan(0)
        expect(restRate).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('stay within the size budget the places are spaced for [SPEC-13.2.1]', () => {
    for (const id of ANIMAL_IDS) {
      const { extent } = ANIMALS[id]
      const budget = EXTENT_BUDGET[isBee(id) ? 'bee' : 'butterfly']
      expect(extent.left).toBeGreaterThanOrEqual(budget.left)
      expect(extent.right).toBeLessThanOrEqual(budget.right)
      expect(extent.top).toBeGreaterThanOrEqual(budget.top)
    }
  })
})

describe('places [SPEC-13.2.1] [SPEC-13.2.2]', () => {
  const places = ANIMAL_IDS.map((id) => ANIMALS[id].path.at(-1)!)

  it('give one place of the decor to each animal, bees to bee places, butterflies to the big flowers', () => {
    const keys = places.map((p) => `${p.x},${p.y},${p.height}`)
    expect(new Set(keys).size).toBe(17)
    for (const [i, id] of ANIMAL_IDS.entries()) {
      const p = places[i]!
      const match = PLACES.filter((q) => q.x === p.x && q.y === p.y && q.height === p.height)
      expect(match, id).toHaveLength(1)
      expect(match[0]!.animal).toBe(isBee(id) ? 'bee' : 'butterfly')
      expect(ANIMALS[id].spotFacing).toBe(isBee(id) ? match[0]!.facing : 1)
    }
  })

  // As for the farm: settled animals overlap little, so that each one reads on its own.
  it('keep the animals apart: their boxes overlap little', () => {
    for (const [i, a] of ANIMAL_IDS.entries()) {
      for (const b of ANIMAL_IDS.slice(i + 1)) {
        const [pa, pb] = [restingPoints(ANIMALS[a])[0]!, restingPoints(ANIMALS[b])[0]!]
        const ra = drawingBox(ANIMALS[a], pa.x, pa.y, pa.facing, pa.height)
        const rb = drawingBox(ANIMALS[b], pb.x, pb.y, pb.facing, pb.height)
        const overlap =
          Math.max(0, Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) *
          Math.max(0, Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap / Math.min(ra.width * ra.height, rb.width * rb.height), `${a} / ${b}`).toBeLessThan(0.2)
      }
    }
  })
})

describe('paths [SPEC-13.2.1] [SPEC-13.2.3]', () => {
  it.each(ANIMAL_IDS)('%s: valid, in the safe zone, weave included [SPEC-8.6]', (id) => {
    const spec = ANIMALS[id]
    const { path, peekIndex, exitIndex } = spec
    expect(0 < peekIndex && peekIndex < exitIndex && exitIndex < path.length).toBe(true)
    // The weave is zero at the peek point and at the place, and grows in between.
    for (const [i, p] of path.entries()) {
      const weave = i > peekIndex && i < path.length - 1 ? spec.flight!.weave : 0
      expect(p.height ?? 0, `${p.x},${p.y}`).toBeGreaterThanOrEqual(0)
      expect(p.crouch).toBeGreaterThanOrEqual(0)
      expect(p.crouch).toBeLessThanOrEqual(1)
      expect(contains(SAFE_ZONE, drawingBox(spec, p.x, p.y, undefined, p.height, weave), 0), `${p.x},${p.y},${p.height}`).toBe(true)
    }
    const place = path.at(-1)!
    expect(contains(SAFE_ZONE, drawingBox(spec, place.x, place.y, spec.spotFacing, place.height), 20)).toBe(true)
  })

  it.each(BEE_IDS)('%s: hidden out of the flight hole, head in it to peek, whole in it at the exit', (id) => {
    const { path, peekIndex, exitIndex, extent } = ANIMALS[id]
    const hole = FLIGHT_HOLE.rect
    const [hidden, peek, exit] = [path[0]!, path[peekIndex]!, path[exitIndex]!]
    // The hive's slot shows only the hole.
    expect(intersects(drawingBox({ extent }, hidden.x, hidden.y, undefined, hidden.height), hole)).toBe(false)
    expect(FLIGHT_HOLE.peeks.some((p) => p.x === peek.x && p.y === peek.y && p.height === peek.height)).toBe(true)
    expect(exit).toMatchObject(FLIGHT_HOLE.inside)
    expect(contains(hole, drawingBox({ extent }, exit.x, exit.y, undefined, exit.height))).toBe(true)
    // Under the sill, straight up into the hole: nothing of it shows on the way.
    expect(hidden.x).toBe(peek.x)
  })

  it('show several heads at the flight hole when the bees follow each other closely [SPEC-13.2.1]', () => {
    const spots = BEE_IDS.map((id) => ANIMALS[id].path[ANIMALS[id].peekIndex]!.x)
    for (let i = 1; i < spots.length; i++) expect(spots[i], BEE_IDS[i]).not.toBe(spots[i - 1])
  })

  // [SPEC-13.2.3] [SPEC-8.5] The weave swings once between the peek point and the exit point, so that
  // it is zero at the exit: it must not be a quick wiggle.
  it.each(BEE_IDS)('%s: weaves slowly, under one swing per second', (id) => {
    const { flight, speed } = ANIMALS[id]
    expect(speed.walk / flight!.weaveLength).toBeLessThan(1)
  })

  it.each(BUTTERFLY_IDS)('%s: hidden behind the leaves of the clump, at a constant depth', (id) => {
    const spec = ANIMALS[id]
    const hidden = spec.path[0]!
    expect(contains(HIDEOUTS.clump.cover, drawingBox(spec, hidden.x, hidden.y, 1, hidden.height))).toBe(true)
    for (const p of spec.path) expect(p.y).toBe(hidden.y)
  })

  // The wings of one butterfly reach `extent.right` from its middle; the head of the other, about 25.
  it('peek the two butterflies apart, so that the wings of one do not hide the head of the other [SPEC-13.2.2]', () => {
    const [a, b] = BUTTERFLY_IDS.map((id) => ANIMALS[id].path[ANIMALS[id].peekIndex]!)
    expect(Math.abs(a!.x - b!.x)).toBeGreaterThanOrEqual(BUTTERFLY_EXTENT.right + 25)
  })

  // Animals in the open are drawn in the order of their ground point: see overlap.ts.
  it.each(ANIMAL_IDS)('%s: never crosses the depth of a still animal while overlapping it', (id) => {
    for (const style of STYLES) expect(depthCrossings(rucheAnimals(style), id), style).toEqual([])
  })

  it.each(ANIMAL_IDS)('%s: flies back to its hideout in less than a second [SPEC-13.2.3]', (id) => {
    const model = new AnimalModel(ANIMALS[id], 1)
    model.setTarget('settled')
    for (let t = 0; t < 60 && model.state !== 'settled'; t += DT) model.step(DT)
    expect(model.state).toBe('settled')
    model.setTarget('fleeing')
    let t = 0
    while (model.state !== 'hidden' && t < 5) {
      model.step(DT)
      t += DT
    }
    expect(model.state).toBe('hidden')
    expect(t).toBeLessThan(1)
  })

  it('takes a bee from the hive to its place in a slow flight, a few seconds long', () => {
    for (const id of BEE_IDS) {
      const model = new AnimalModel(ANIMALS[id], 1)
      model.setTarget('settled')
      let t = 0
      while (model.state !== 'settled' && t < 60) {
        model.step(DT)
        t += DT
      }
      expect(t, id).toBeGreaterThan(3)
      expect(t, id).toBeLessThan(20)
    }
  })
})
