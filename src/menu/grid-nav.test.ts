import { describe, expect, it } from 'vitest'
import { moveInGrid } from './grid-nav'

describe('moveInGrid', () => {
  // 3 columns, 7 tiles:  0 1 2 / 3 4 5 / 6
  it('moves left, right, up and down', () => {
    expect(moveInGrid(4, 'ArrowLeft', 7, 3)).toBe(3)
    expect(moveInGrid(4, 'ArrowRight', 7, 3)).toBe(5)
    expect(moveInGrid(4, 'ArrowUp', 7, 3)).toBe(1)
    expect(moveInGrid(3, 'ArrowDown', 7, 3)).toBe(6)
    // No tile under 4 on the last, shorter row.
    expect(moveInGrid(4, 'ArrowDown', 7, 3)).toBe(4)
  })

  it('stays in place at the edges', () => {
    expect(moveInGrid(0, 'ArrowLeft', 7, 3)).toBe(0)
    expect(moveInGrid(6, 'ArrowRight', 7, 3)).toBe(6)
    expect(moveInGrid(1, 'ArrowUp', 7, 3)).toBe(1)
    expect(moveInGrid(5, 'ArrowDown', 7, 3)).toBe(5)
  })

  it('treats a zero column count as one column', () => {
    expect(moveInGrid(0, 'ArrowDown', 2, 0)).toBe(1)
  })
})
