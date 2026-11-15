import { describe, expect, it } from 'vitest'
import { contains, intersects, SAFE_ZONE, viewport, type Rect } from '../../silence/geometry'
import { drawingBox } from '../../silence/overlap'
import { AMBIENT } from './ambient'
import { createIncubator } from './incubator'
import {
  CHICK_EXTENT,
  CRATE,
  DECOR_BOUNDS,
  EGG_IDS,
  EGGS,
  FEEDER,
  HIDEOUTS,
  LAMPS,
  NESTS,
  PLACES,
  type Place,
} from './layout'

/** Margin kept between an egg, a hiding cover, or a settled chick and the edge of the safe zone. */
const SAFE_MARGIN = 15

const pointRect = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })

/** Drawing box of a chick of the size budget settled at its place, paper shadow included. */
const placeBox = (p: Place): Rect => drawingBox({ extent: CHICK_EXTENT }, p.x, p.y, p.facing)

describe('incubator on every screen [SPEC-8.6]', () => {
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

  it('keeps the crate walls, lamps, feeder, nests, twenty eggs and twenty places inside the safe zone [SPEC-8.6] [SPEC-14.3]', () => {
    expect(CRATE.wallLeft).toBeGreaterThanOrEqual(SAFE_ZONE.x)
    expect(CRATE.wallRight).toBeLessThanOrEqual(SAFE_ZONE.x + SAFE_ZONE.width)
    expect(contains(SAFE_ZONE, FEEDER.body, SAFE_MARGIN), 'feeder body').toBe(true)
    expect(contains(SAFE_ZONE, FEEDER.zone, SAFE_MARGIN), 'feeder zone').toBe(true)
    for (const lamp of LAMPS) {
      const shadeBox: Rect = {
        x: lamp.x - lamp.shadeBottomRx,
        y: lamp.socketTopY,
        width: 2 * lamp.shadeBottomRx,
        height: lamp.shadeBottomY - lamp.socketTopY,
      }
      expect(contains(SAFE_ZONE, shadeBox, SAFE_MARGIN), `lamp ${lamp.id} shade`).toBe(true)
      expect(contains(SAFE_ZONE, lamp.warmZone, SAFE_MARGIN), `lamp ${lamp.id} warmZone`).toBe(true)
    }
    for (const egg of EGGS) {
      expect(contains(SAFE_ZONE, egg.footprint, SAFE_MARGIN), `${egg.id} footprint`).toBe(true)
      expect(contains(SAFE_ZONE, egg.cover, SAFE_MARGIN), `${egg.id} cover`).toBe(true)
      expect(contains(SAFE_ZONE, pointRect(egg.exit.x, egg.exit.y), SAFE_MARGIN), `${egg.id} exit`).toBe(true)
    }
    for (const [i, place] of PLACES.entries()) {
      expect(contains(SAFE_ZONE, placeBox(place), SAFE_MARGIN), `place ${i} (${place.zone})`).toBe(true)
    }
  })
})

describe('twenty eggs in four nests [SPEC-14.2] [SPEC-14.3]', () => {
  it('has twenty eggs across four nests, each keyed in HIDEOUTS with one of the three cap variants [SPEC-14.2.2]', () => {
    expect(EGGS).toHaveLength(20)
    expect(NESTS).toHaveLength(4)
    expect(Object.keys(HIDEOUTS).sort()).toEqual([...EGG_IDS].sort())
    for (const variant of ['lid', 'hat', 'cartoon'] as const) {
      expect(EGGS.filter((e) => e.variant === variant).length).toBeGreaterThanOrEqual(6)
    }
  })

  it('keeps the twenty eggs completely free of overlap with one another', () => {
    for (const [i, a] of EGGS.entries()) {
      for (const b of EGGS.slice(i + 1)) {
        expect(intersects(a.footprint, b.footprint), `${a.id} / ${b.id}`).toBe(false)
      }
    }
  })

  it('covers each hiding chick inside its egg footprint and places its exit outside the egg', () => {
    for (const egg of EGGS) {
      expect(contains(egg.footprint, egg.cover), `${egg.id} cover inside footprint`).toBe(true)
      expect(contains(egg.footprint, pointRect(egg.exit.x, egg.exit.y)), `${egg.id} exit outside footprint`).toBe(false)
    }
  })

  it('leaves the warm zones under the lamps and the feeder zone clear of eggs [SPEC-14.3]', () => {
    for (const egg of EGGS) {
      expect(intersects(egg.footprint, FEEDER.body), `${egg.id} / feeder body`).toBe(false)
      expect(intersects(egg.footprint, FEEDER.zone), `${egg.id} / feeder zone`).toBe(false)
      for (const lamp of LAMPS) {
        expect(intersects(egg.footprint, lamp.warmZone), `${egg.id} / lamp ${lamp.id} warmZone`).toBe(false)
      }
    }
  })
})

describe('feeder, heat lamps and places of the chicks [SPEC-14.2.3] [SPEC-14.3]', () => {
  it('has twenty places shared between the warm zones under the lamps, the feeder and the straw', () => {
    expect(PLACES).toHaveLength(20)
    const count = (zone: Place['zone']) => PLACES.filter((p) => p.zone === zone).length
    expect(count('lamp')).toBe(8)
    expect(count('feeder')).toBe(6)
    expect(count('straw')).toBe(6)
  })

  it('makes the warm zones under the lamps and the feeder zone large enough to hold all their chicks', () => {
    for (const [i, place] of PLACES.entries()) {
      const box = placeBox(place)
      if (place.zone === 'lamp') {
        expect(LAMPS.some((lamp) => contains(lamp.warmZone, box)), `lamp place ${i}`).toBe(true)
      }
      if (place.zone === 'feeder') {
        expect(contains(FEEDER.zone, box), `feeder place ${i}`).toBe(true)
      }
    }
  })

  it('keeps settled chicks free of overlap with one another, with the eggs and with the feeder trough', () => {
    for (const [i, a] of PLACES.entries()) {
      const boxA = placeBox(a)
      expect(intersects(boxA, FEEDER.body), `place ${i} / feeder`).toBe(false)
      for (const egg of EGGS) {
        expect(intersects(boxA, egg.footprint), `place ${i} / ${egg.id}`).toBe(false)
      }
      for (const [j, b] of PLACES.entries()) {
        if (j <= i) continue
        expect(intersects(boxA, placeBox(b)), `place ${i} / place ${j}`).toBe(false)
      }
    }
  })
})

describe('ambient life [SPEC-8.5] [SPEC-14.3]', () => {
  it('moves slowly without flickering: every oscillation period lasts several seconds', () => {
    for (const motion of [AMBIENT.lampSway, AMBIENT.haloPulse, AMBIENT.straw]) {
      expect(motion.period).toBeGreaterThanOrEqual(5)
    }
  })

  it('builds twenty egg slots between the back and the front of each shell, with separate pieces [SPEC-14.2.1] [SPEC-14.2.2]', () => {
    const incubator = createIncubator()
    expect(Object.keys(incubator.slots).sort()).toEqual([...EGG_IDS].sort())
    for (const id of EGG_IDS) {
      const egg = incubator.eggs[id]
      const slot = incubator.slots[id]
      expect(egg.slot).toBe(slot)
      expect(slot.parent).toBe(egg.node)
      const children = egg.node.children
      const slotIndex = children.indexOf(slot)
      const lowerIndex = children.indexOf(egg.lower)
      const wholeIndex = children.indexOf(egg.whole)
      const crackIndex = children.indexOf(egg.crack)
      const capIndex = children.indexOf(egg.cap)
      // The slot is in front of the back interior of the shell and behind lower, whole, crack and cap.
      expect(slotIndex).toBeGreaterThan(0)
      expect(lowerIndex).toBeGreaterThan(slotIndex)
      expect(wholeIndex).toBeGreaterThan(slotIndex)
      expect(crackIndex).toBeGreaterThan(wholeIndex)
      expect(capIndex).toBeGreaterThan(slotIndex)
      // At launch, all twenty eggs are whole [SPEC-14.2.1].
      expect(egg.whole.visible).toBe(true)
      expect(egg.crack.visible).toBe(false)
      expect(egg.cap.visible).toBe(false)
    }
  })
})
