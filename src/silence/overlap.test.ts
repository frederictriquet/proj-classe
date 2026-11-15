import { describe, expect, it } from 'vitest'
import type { AnimalSpec } from './animal'
import { depthCrossings, drawingBox, PAPER_SHADOW, restingPoints } from './overlap'

const BASE: AnimalSpec = {
  id: 'still',
  hideout: 'h',
  usesSlot: true,
  path: [
    { x: 500, y: 760, crouch: 0 },
    { x: 500, y: 780, crouch: 0 },
    { x: 500, y: 790, crouch: 0 },
    { x: 500, y: 800, crouch: 0 },
  ],
  peekIndex: 1,
  exitIndex: 2,
  hideFacing: 1,
  spotFacing: 1,
  frontal: false,
  extent: { left: -40, right: 40, top: -80 },
  speed: { peek: 40, walk: 160, flee: 900 },
  peekPause: 1,
  gait: 'walk',
  strideLength: 40,
  bounce: 8,
  sleepCrouch: 0,
  grazeCrouch: 0,
  activities: { rest: 1, graze: 1, scratch: 1, sleep: 1, look: 1 },
}

/** Crosses the depth of `still` (y = 800) at x = 500, right on it, `height` above the ground. */
const crossing = (height: number, weave = 0): AnimalSpec => ({
  ...BASE,
  id: 'mover',
  path: [
    { x: 300, y: 700, crouch: 0, height },
    { x: 310, y: 705, crouch: 0, height },
    { x: 320, y: 710, crouch: 0, height },
    { x: 700, y: 900, crouch: 0, height },
  ],
  ...(height > 0 ? { gait: 'fly' as const, flight: { wingRate: 2, weave, weaveLength: 100, restBeat: 0, restRate: 1 } } : {}),
})

describe('drawing order on the screen [SPEC-9.8] [SPEC-13.2.3]', () => {
  it('puts the box of the drawing above its ground point by its height', () => {
    expect(drawingBox(BASE, 500, 800, 1)).toEqual({ x: 460, y: 720, width: 80 + PAPER_SHADOW.x, height: 80 + PAPER_SHADOW.y })
    expect(drawingBox(BASE, 500, 800, 1, 300).y).toBe(420)
    expect(restingPoints({ ...BASE, path: [...BASE.path.slice(0, -1), { x: 500, y: 800, crouch: 0, height: 300 }] })).toEqual([
      { x: 500, y: 800, height: 300, facing: 1 },
    ])
  })

  it('finds an animal that crosses the depth of a still one while overlapping it', () => {
    expect(depthCrossings({ still: BASE, mover: crossing(0) }, 'mover')).not.toEqual([])
  })

  it('lets an animal fly over a still one: the drawings do not overlap', () => {
    expect(depthCrossings({ still: BASE, mover: crossing(300) }, 'mover')).toEqual([])
  })

  it('lets a walker pass under an animal perched high up', () => {
    const perched = { ...BASE, path: [...BASE.path.slice(0, -1), { x: 500, y: 800, crouch: 0, height: 300 }] }
    expect(depthCrossings({ still: perched, mover: crossing(0) }, 'mover')).toEqual([])
  })

  it('widens the box of a flying animal by its weave', () => {
    // The still drawing goes 80 units up from its ground point, the moving one 7 units down
    // (paper shadow): they overlap while flying lower than 87 units, or higher with a weave.
    expect(depthCrossings({ still: BASE, mover: crossing(80, 0) }, 'mover')).not.toEqual([])
    expect(depthCrossings({ still: BASE, mover: crossing(100, 0) }, 'mover')).toEqual([])
    expect(depthCrossings({ still: BASE, mover: crossing(100, 20) }, 'mover')).not.toEqual([])
  })
})
