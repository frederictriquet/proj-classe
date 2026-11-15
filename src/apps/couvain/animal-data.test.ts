import { describe, expect, it } from 'vitest'
import { AnimalModel } from '../../silence/animal-model'
import { createAnimal } from '../../silence/animals'
import { contains, SAFE_ZONE } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import { drawAnimal } from '../../silence/rig'
import { RIGS } from './animal-art'
import {
  ANIMAL_IDS,
  ANIMALS,
  CHICK_COLORS,
  CHICK_EGGS,
  CHICK_PLACES,
  ZONE_ACTIVITIES,
} from './animal-data'
import { createIncubator, HATCH_TOTAL, HATCH_WOBBLE_END } from './incubator'
import { CHICK_EXTENT, EGG_IDS, HIDEOUTS, PLACES } from './layout'
import { PALETTE } from './palette'

const DT = 1 / 60

describe('twenty chicks of the brood [SPEC-9.4.1] [SPEC-14.2]', () => {
  it('has twenty chicks in come-out order, each with its own egg hideout', () => {
    expect(ANIMAL_IDS).toHaveLength(20)
    for (const id of ANIMAL_IDS) {
      expect(ANIMALS[id].id).toBe(id)
      expect(ANIMALS[id].hideout).toBe(CHICK_EGGS[id])
      expect(ANIMALS[id].usesSlot).toBe(true)
    }
    const eggsUsed = ANIMAL_IDS.map((id) => ANIMALS[id].hideout)
    expect(new Set(eggsUsed).size).toBe(20)
    expect([...eggsUsed].sort()).toEqual([...EGG_IDS].sort())
  })

  it('disperses the come-out order across the nests so consecutive hatchings are never neighbours [SPEC-14.2]', () => {
    for (let i = 1; i < ANIMAL_IDS.length; i++) {
      const prevEgg = HIDEOUTS[ANIMALS[ANIMAL_IDS[i - 1]!].hideout]
      const currEgg = HIDEOUTS[ANIMALS[ANIMAL_IDS[i]!].hideout]
      expect(currEgg.nest, `${ANIMAL_IDS[i - 1]} -> ${ANIMAL_IDS[i]}`).not.toBe(prevEgg.nest)
      expect(Math.hypot(currEgg.x - prevEgg.x, currEgg.y - prevEgg.y)).toBeGreaterThan(350)
    }
  })

  it('gives a golden-yellow majority with russet, brown and cream variants [SPEC-14.2] [SPEC-14.5]', () => {
    const counts = { yellow: 0, terracotta: 0, brown: 0, cream: 0 }
    for (const id of ANIMAL_IDS) counts[CHICK_COLORS[id]]++
    expect(counts.yellow).toBe(14)
    expect(counts.terracotta).toBe(3)
    expect(counts.brown + counts.cream).toBe(3)
    expect(counts.brown).toBeGreaterThanOrEqual(1)
    expect(counts.cream).toBeGreaterThanOrEqual(1)
  })

  it('stays within the size budget the places are spaced for [SPEC-14.2]', () => {
    for (const id of ANIMAL_IDS) {
      const { extent } = ANIMALS[id]
      expect(extent.left).toBeGreaterThanOrEqual(CHICK_EXTENT.left)
      expect(extent.right).toBeLessThanOrEqual(CHICK_EXTENT.right)
      expect(extent.top).toBeGreaterThanOrEqual(CHICK_EXTENT.top)
    }
  })
})

describe('places and activity weights [SPEC-14.2.3]', () => {
  it('assigns one distinct place of the incubator to each of the twenty chicks', () => {
    const settled = ANIMAL_IDS.map((id) => ANIMALS[id].path.at(-1)!)
    const keys = settled.map((p) => `${p.x},${p.y}`)
    expect(new Set(keys).size).toBe(20)
    for (const [i, id] of ANIMAL_IDS.entries()) {
      const p = settled[i]!
      const match = PLACES.filter((q) => q.x === p.x && q.y === p.y)
      expect(match, id).toHaveLength(1)
      expect(match[0]).toEqual(CHICK_PLACES[id])
      expect(ANIMALS[id].spotFacing).toBe(match[0]!.facing)
      expect(ANIMALS[id].activities).toEqual(ZONE_ACTIVITIES[match[0]!.zone])
    }
  })

  it('specialises the activity weights according to the chick place zone [SPEC-14.2.3]', () => {
    expect(ZONE_ACTIVITIES.feeder.graze).toBeGreaterThan(ZONE_ACTIVITIES.feeder.sleep)
    expect(ZONE_ACTIVITIES.feeder.rest).toBeGreaterThan(ZONE_ACTIVITIES.feeder.scratch)
    expect(ZONE_ACTIVITIES.feeder.look).toBeGreaterThan(ZONE_ACTIVITIES.feeder.scratch)

    expect(ZONE_ACTIVITIES.lamp.sleep).toBeGreaterThan(ZONE_ACTIVITIES.lamp.graze)
    expect(ZONE_ACTIVITIES.lamp.rest).toBeGreaterThan(ZONE_ACTIVITIES.lamp.scratch)
    expect(ZONE_ACTIVITIES.lamp.rest).toBeGreaterThan(ZONE_ACTIVITIES.lamp.look)

    expect(ZONE_ACTIVITIES.straw.scratch).toBeGreaterThan(ZONE_ACTIVITIES.straw.sleep)
    expect(ZONE_ACTIVITIES.straw.look).toBeGreaterThan(ZONE_ACTIVITIES.straw.rest)
    expect(ZONE_ACTIVITIES.straw.graze).toBeGreaterThan(ZONE_ACTIVITIES.straw.sleep)
  })

  it('keeps settled chicks apart so every settled chick remains clearly visible', () => {
    for (const [i, a] of ANIMAL_IDS.entries()) {
      for (const b of ANIMAL_IDS.slice(i + 1)) {
        const [pa, pb] = [restingPoints(ANIMALS[a])[0]!, restingPoints(ANIMALS[b])[0]!]
        const ra = drawingBox(ANIMALS[a], pa.x, pa.y, pa.facing)
        const rb = drawingBox(ANIMALS[b], pb.x, pb.y, pb.facing)
        const overlap =
          Math.max(0, Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) *
          Math.max(0, Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap, `${a} / ${b}`).toBe(0)
      }
    }
  })
})

describe('paths and speeds [SPEC-8.5] [SPEC-8.6] [SPEC-14.2.1]', () => {
  it.each(ANIMAL_IDS)('%s: starts in its egg and keeps its whole path and place inside SAFE_ZONE [SPEC-8.6]', (id) => {
    const spec = ANIMALS[id]
    const egg = HIDEOUTS[spec.hideout]
    const { path, peekIndex, exitIndex } = spec
    expect(0 < peekIndex && peekIndex < exitIndex && exitIndex < path.length).toBe(true)

    // Starts crouched inside its egg footprint.
    const start = path[0]!
    expect(start.x).toBe(egg.x)
    expect(start.crouch).toBe(1)
    expect(contains(egg.footprint, { x: start.x, y: start.y, width: 0, height: 0 })).toBe(true)

    for (const p of path) {
      expect(p.crouch).toBeGreaterThanOrEqual(0)
      expect(p.crouch).toBeLessThanOrEqual(1)
      expect(contains(SAFE_ZONE, drawingBox(spec, p.x, p.y), 0), `${p.x},${p.y}`).toBe(true)
    }
    const place = path.at(-1)!
    expect(contains(SAFE_ZONE, drawingBox(spec, place.x, place.y, spec.spotFacing), 15)).toBe(true)
  })

  it.each(ANIMAL_IDS)('%s: never crosses the depth of a settled chick while overlapping it', (id) => {
    expect(depthCrossings(ANIMALS, id)).toEqual([])
  })

  it.each(ANIMAL_IDS)('%s: flees back into its egg in less than one second [SPEC-8.5] [SPEC-14.2.1]', (id) => {
    const model = new AnimalModel(ANIMALS[id], 1)
    model.setTarget('settled')
    for (let t = 0; t < 30 && model.state !== 'settled'; t += DT) model.step(DT)
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
})

describe('hatching and egg cap variants [SPEC-14.2.1] [SPEC-14.2.2]', () => {
  it('hatches on the first exit (wobble + crack, then cap lift), follows the three variants and never re-hatches on flight', () => {
    const incubator = createIncubator()
    const animals = ANIMAL_IDS.map((id, i) =>
      createAnimal(ANIMALS[id], drawAnimal(ANIMALS[id], RIGS[id], PALETTE), incubator, i + 1),
    )

    // 1. At launch, all twenty eggs are whole.
    incubator.tick(0, animals)
    for (const id of EGG_IDS) {
      const egg = incubator.eggs[id]
      expect(egg.hatched).toBe(false)
      expect(egg.whole.visible).toBe(true)
      expect(egg.crack.visible).toBe(false)
      expect(egg.cap.visible).toBe(false)
      expect(egg.node.rotation).toBe(0)
    }

    // 2. Trigger the first exit on the first three chicks (covering lid, hat and cartoon variants).
    const sampleIds = ['chick1', 'chick2', 'chick3'] as const
    const sampleVariants = sampleIds.map((id) => incubator.eggs[CHICK_EGGS[id]].variant)
    expect(new Set(sampleVariants)).toEqual(new Set(['lid', 'hat', 'cartoon']))

    for (const id of sampleIds) {
      const chick = animals.find((a) => a.id === id)!
      chick.setTarget('peeking')
    }

    // Advance into the middle of the hatching wobble phase.
    const wobbleSteps = Math.round((HATCH_WOBBLE_END * 0.25) / DT)
    for (let i = 0; i < wobbleSteps; i++) {
      for (const a of animals) a.update(DT)
      incubator.tick(DT, animals)
    }
    for (const id of sampleIds) {
      const egg = incubator.eggs[CHICK_EGGS[id]]
      expect(egg.hatched, id).toBe(false)
      expect(egg.whole.visible, id).toBe(true)
      expect(egg.crack.visible, id).toBe(true)
      expect(egg.cap.visible, id).toBe(false)
      expect(Math.abs(egg.node.rotation), id).toBeGreaterThan(0.02)
    }

    // 3. Advance past HATCH_TOTAL into the peeking pose: cap is lifted, oscillation stopped.
    const peekSteps = Math.round(HATCH_TOTAL / DT)
    for (let i = 0; i < peekSteps; i++) {
      for (const a of animals) a.update(DT)
      incubator.tick(DT, animals)
    }
    for (const id of sampleIds) {
      const egg = incubator.eggs[CHICK_EGGS[id]]
      expect(egg.hatched, id).toBe(true)
      expect(egg.node.rotation, id).toBe(0)
      expect(egg.whole.visible, id).toBe(false)
      expect(egg.lower.visible, id).toBe(true)
      expect(egg.cap.visible, id).toBe(true)
    }

    // 4. Send them back to hide and check the three post-hatching hidden variants [SPEC-14.2.2].
    for (const id of sampleIds) {
      const chick = animals.find((a) => a.id === id)!
      chick.setTarget('hidden')
    }
    for (let i = 0; i < 90; i++) {
      for (const a of animals) a.update(DT)
      incubator.tick(DT, animals)
    }

    const lidEgg = incubator.eggs[CHICK_EGGS.chick1]
    expect(lidEgg.variant).toBe('lid')
    expect(lidEgg.whole.visible).toBe(false)
    expect(lidEgg.lower.visible).toBe(true)
    expect(lidEgg.cap.visible).toBe(true)
    expect(lidEgg.crack.visible).toBe(true)
    expect(Math.abs(lidEgg.cap.rotation)).toBeGreaterThan(0.1)

    const hatEgg = incubator.eggs[CHICK_EGGS.chick2]
    expect(hatEgg.variant).toBe('hat')
    expect(hatEgg.whole.visible).toBe(false)
    expect(hatEgg.lower.visible).toBe(true)
    expect(hatEgg.cap.visible).toBe(true)
    expect(hatEgg.crack.visible).toBe(true)
    expect(hatEgg.cap.rotation).toBe(0)

    const cartoonEgg = incubator.eggs[CHICK_EGGS.chick3]
    expect(cartoonEgg.variant).toBe('cartoon')
    expect(cartoonEgg.whole.visible).toBe(true)
    expect(cartoonEgg.cap.visible).toBe(false)
    expect(cartoonEgg.crack.visible).toBe(true)

    // 5. Second exit: no new hatching wobble, opens directly.
    for (const id of sampleIds) {
      const chick = animals.find((a) => a.id === id)!
      chick.setTarget('peeking')
    }
    for (let i = 0; i < wobbleSteps; i++) {
      for (const a of animals) a.update(DT)
      incubator.tick(DT, animals)
    }
    for (const id of sampleIds) {
      const egg = incubator.eggs[CHICK_EGGS[id]]
      expect(egg.node.rotation, id).toBe(0)
    }

    // 6. Fresh launch of the incubator: all twenty eggs are whole again [SPEC-14.2.1].
    const fresh = createIncubator()
    for (const id of EGG_IDS) {
      expect(fresh.eggs[id].hatched).toBe(false)
      expect(fresh.eggs[id].whole.visible).toBe(true)
      expect(fresh.eggs[id].crack.visible).toBe(false)
      expect(fresh.eggs[id].cap.visible).toBe(false)
    }
  })
})
