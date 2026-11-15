import { describe, expect, it } from 'vitest'
import { AMBIENT, frameStep, oscillate, rayAlpha, wrap } from './ambient'
import {
  BRANCH_LEAVES,
  BURROW,
  BUSH,
  contains,
  DECOR_BOUNDS,
  HIDEOUT_IDS,
  HIDEOUTS,
  insideEllipse,
  intersects,
  LEFT_TREE,
  LOG,
  MEADOW,
  RIGHT_TREE,
  SAFE_ZONE,
  viewport,
  type Rect,
} from './layout'

/** [SPEC-8.6] Screens of the formats to support, in CSS pixels. */
const SCREENS = {
  '16:9': [1920, 1080],
  '16:10': [1280, 800],
  '4:3': [1024, 768],
  '16:10 MacBook Air': [1470, 956],
  '5:4': [1280, 1024],
  '21:9': [2560, 1080],
} as const

/** Margin kept between a hiding animal, or an exit, and the edge of the safe zone, in world units. */
const SAFE_MARGIN = 40
/** Margin kept between the drawing of a hideout and the edge of the safe zone. */
const DRAWING_MARGIN = 15

const pointRect = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })

describe('viewport [SPEC-8.6]', () => {
  for (const [name, [width, height]] of Object.entries(SCREENS)) {
    it(`${name}: shows the whole safe zone and fills the screen with decor`, () => {
      const { scale, offsetX, offsetY, visible } = viewport(width, height)
      // One scale for both axes: no deformation. The visible part matches the screen exactly.
      expect(visible.width * scale).toBeCloseTo(width, 6)
      expect(visible.height * scale).toBeCloseTo(height, 6)
      expect(contains(visible, SAFE_ZONE)).toBe(true)
      // The safe zone touches two opposite edges of the screen: it is as large as possible.
      expect(Math.min(visible.width - SAFE_ZONE.width, visible.height - SAFE_ZONE.height)).toBeCloseTo(0, 6)
      // Centred.
      expect(offsetX + (SAFE_ZONE.width / 2) * scale).toBeCloseTo(width / 2, 6)
      expect(offsetY + (SAFE_ZONE.height / 2) * scale).toBeCloseTo(height / 2, 6)
      // No band: the decor covers everything visible.
      expect(contains(DECOR_BOUNDS, visible)).toBe(true)
    })
  }

  it('covers screens from 1:2 to 4:1 with decor', () => {
    for (const [width, height] of [
      [1000, 2000],
      [4000, 1000],
    ] as const) {
      expect(contains(DECOR_BOUNDS, viewport(width, height).visible)).toBe(true)
    }
  })
})

describe('hideouts and meadow [SPEC-9.2] [SPEC-8.6]', () => {
  it('has the five hideouts of the spec', () => {
    expect(Object.keys(HIDEOUTS).sort()).toEqual([...HIDEOUT_IDS].sort())
    for (const id of HIDEOUT_IDS) expect(HIDEOUTS[id].id).toBe(id)
  })

  it('keeps every hideout, its cover and its exit inside the safe zone, away from the edges', () => {
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(contains(SAFE_ZONE, hideout.footprint, DRAWING_MARGIN), `${hideout.id} footprint`).toBe(true)
      expect(contains(SAFE_ZONE, hideout.cover, SAFE_MARGIN), `${hideout.id} cover`).toBe(true)
      expect(contains(SAFE_ZONE, pointRect(hideout.exit.x, hideout.exit.y), SAFE_MARGIN), `${hideout.id} exit`).toBe(true)
    }
    // The burrow's cover is underground, below the visible drawing; the others are inside it.
    for (const hideout of Object.values(HIDEOUTS).filter((h) => h.id !== 'burrow')) {
      expect(contains(hideout.footprint, hideout.cover), `${hideout.id} cover`).toBe(true)
    }
  })

  it('keeps the exits outside the hideouts', () => {
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(contains(hideout.footprint, pointRect(hideout.exit.x, hideout.exit.y)), hideout.id).toBe(false)
    }
  })

  it('keeps the meadow free of hideouts and of the big trunks', () => {
    expect(contains(SAFE_ZONE, MEADOW, SAFE_MARGIN)).toBe(true)
    for (const hideout of Object.values(HIDEOUTS)) {
      expect(intersects(MEADOW, hideout.footprint), hideout.id).toBe(false)
    }
    expect(intersects(MEADOW, LEFT_TREE.trunk)).toBe(false)
    expect(intersects(MEADOW, RIGHT_TREE.trunk)).toBe(false)
  })

  it('keeps hideouts apart, so that each one reads as a separate shape', () => {
    const all = Object.values(HIDEOUTS)
    for (const [i, a] of all.entries()) {
      for (const b of all.slice(i + 1)) expect(intersects(a.footprint, b.footprint), `${a.id} / ${b.id}`).toBe(false)
    }
  })

  it('keeps the ground hideouts off the trunks, which are drawn over the ground plane', () => {
    for (const hideout of Object.values(HIDEOUTS).filter((h) => h.plane === 'ground')) {
      expect(intersects(hideout.footprint, LEFT_TREE.trunk), hideout.id).toBe(false)
      expect(intersects(hideout.footprint, RIGHT_TREE.trunk), hideout.id).toBe(false)
    }
  })

  it('covers the hiding animal with the shape of its hideout', () => {
    // Lobed shapes always cover their base ellipse; 0.97 leaves room for the straight edges
    // between lobes.
    const bush = HIDEOUTS.bush.cover
    expect(insideEllipse(bush, BUSH, 0.97)).toBe(true)
    expect(bush.y + bush.height).toBeLessThanOrEqual(BUSH.y)
    expect(insideEllipse(HIDEOUTS.highBranch.cover, BRANCH_LEAVES, 0.97)).toBe(true)
    expect(contains(LEFT_TREE.trunk, HIDEOUTS.behindTree.cover)).toBe(true)
    // Burrow: below the rim, under the hole. Log: inside the body, right of the opening.
    const burrow = HIDEOUTS.burrow.cover
    expect(burrow.y).toBeGreaterThanOrEqual(BURROW.rimY)
    expect(burrow.x).toBeGreaterThanOrEqual(BURROW.hole.x - BURROW.hole.rx)
    expect(burrow.x + burrow.width).toBeLessThanOrEqual(BURROW.hole.x + BURROW.hole.rx)
    const logBody = { x: LOG.x, y: LOG.y - LOG.faceRy, width: LOG.length, height: 2 * LOG.faceRy }
    expect(contains(logBody, HIDEOUTS.hollowLog.cover)).toBe(true)
    expect(HIDEOUTS.hollowLog.cover.x).toBeGreaterThanOrEqual(LOG.x + LOG.holeRx)
  })
})

describe('ambient life [SPEC-8.5]', () => {
  it('moves slowly: every cycle lasts several seconds', () => {
    for (const motion of [AMBIENT.crown, AMBIENT.branchLeaves, AMBIENT.bush, AMBIENT.fern, AMBIENT.rays]) {
      expect(motion.period).toBeGreaterThanOrEqual(5)
    }
    expect(AMBIENT.rays.max - AMBIENT.rays.min).toBeLessThanOrEqual(0.15)
    // A cloud takes more than two minutes to cross the safe zone.
    expect(SAFE_ZONE.width / AMBIENT.cloudSpeed.max).toBeGreaterThan(120)
  })

  it('oscillates within its amplitude and transparency range', () => {
    for (let t = 0; t < 20; t += 0.37) {
      expect(Math.abs(oscillate(AMBIENT.crown, t, 0.3))).toBeLessThanOrEqual(AMBIENT.crown.amplitude)
      const alpha = rayAlpha(t, 0.6)
      expect(alpha).toBeGreaterThanOrEqual(AMBIENT.rays.min)
      expect(alpha).toBeLessThanOrEqual(AMBIENT.rays.max)
    }
  })

  it('wraps a cloud back to the other side', () => {
    expect(wrap(1050, 0, 1000)).toBeCloseTo(50)
    expect(wrap(-30, 0, 1000)).toBeCloseTo(970)
    expect(wrap(400, 0, 1000)).toBe(400)
  })

  it('caps the time step after a pause', () => {
    expect(frameStep(16)).toBeCloseTo(0.016)
    expect(frameStep(5000)).toBe(AMBIENT.maxStep)
    expect(frameStep(-3)).toBe(0)
  })
})
