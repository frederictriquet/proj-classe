import { describe, expect, it } from 'vitest'
import { fadeLevel } from '../../silence/reward'
import { CELL_INNER_RADIUS, CELLS } from './layout'
import { cellFill, EMPTY_CELLS, hexagonPoints, honeyIn, REWARD, rewardClock, trickleLength } from './reward'

/** Area of a polygon. */
const area = (points: readonly { x: number; y: number }[]) =>
  Math.abs(
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length] ?? a
      return sum + a.x * b.y - b.x * a.y
    }, 0),
  ) / 2

describe('reward of the hive [SPEC-13.4]', () => {
  it('fills the empty cells of the decor, and only them', () => {
    expect(EMPTY_CELLS.length).toBeGreaterThan(0)
    expect(EMPTY_CELLS).toEqual(CELLS.filter((cell) => !cell.full))
  })

  it('fills the cells one by one, slowly [SPEC-8.5]', () => {
    for (let t = 0; t <= EMPTY_CELLS.length * REWARD.cellS + 1; t += 0.1) {
      const fills = EMPTY_CELLS.map((_, i) => cellFill(i, t))
      // At most one cell partly filled, all the ones before it full, all the ones after it empty.
      expect(fills.filter((f) => f > 0 && f < 1).length).toBeLessThanOrEqual(1)
      for (let i = 1; i < fills.length; i++) if ((fills[i] ?? 0) > 0) expect(fills[i - 1]).toBe(1)
    }
    expect(REWARD.cellS).toBeGreaterThanOrEqual(1)
    expect(EMPTY_CELLS.every((_, i) => cellFill(i, EMPTY_CELLS.length * REWARD.cellS + 0.01) === 1)).toBe(true)
    expect(cellFill(0, 0)).toBe(0)
  })

  it('runs the trickle into the pot, then keeps it', () => {
    expect(trickleLength(0)).toBe(0)
    expect(trickleLength(REWARD.trickleS / 2)).toBeCloseTo(0.5)
    expect(trickleLength(REWARD.trickleS)).toBe(1)
    expect(trickleLength(60)).toBe(1)
  })

  it('keeps the full cells while it fades out, and starts again from an empty comb', () => {
    let level = 0
    let clock = 0
    const frame = (active: boolean, dt = 1 / 60) => {
      level = fadeLevel(level, active, dt)
      clock = rewardClock(clock, active, level, dt)
    }
    for (let i = 0; i < 60 * 8; i++) frame(true)
    expect(clock).toBeCloseTo(8, 1)
    const filled = EMPTY_CELLS.filter((_, i) => cellFill(i, clock) === 1).length
    // The first flight: the reward fades out without emptying a cell.
    frame(false)
    expect(level).toBeGreaterThan(0)
    expect(EMPTY_CELLS.filter((_, i) => cellFill(i, clock) === 1).length).toBe(filled)
    for (let i = 0; i < 60 * 2; i++) frame(false)
    expect(level).toBe(0)
    expect(clock).toBe(0)
    frame(true)
    expect(cellFill(0, clock)).toBeLessThan(0.05)
  })

  it('raises the honey from the bottom of the cell to its top', () => {
    const cell = { x: 100, y: 200 }
    const whole = area(hexagonPoints(cell))
    expect(honeyIn(cell, 0)).toEqual([])
    expect(area(honeyIn(cell, 1))).toBeCloseTo(whole)
    let previous = 0
    for (let fill = 0.05; fill < 1; fill += 0.05) {
      const honey = honeyIn(cell, fill)
      const a = area(honey)
      expect(a).toBeGreaterThan(previous)
      previous = a
      // Under the surface, inside the cell.
      const surface = cell.y + CELL_INNER_RADIUS - 2 * CELL_INNER_RADIUS * fill
      for (const p of honey) {
        expect(p.y).toBeGreaterThanOrEqual(surface - 1e-9)
        expect(p.y).toBeLessThanOrEqual(cell.y + CELL_INNER_RADIUS + 1e-9)
      }
    }
    expect(area(honeyIn(cell, 0.5))).toBeCloseTo(whole / 2)
  })
})
