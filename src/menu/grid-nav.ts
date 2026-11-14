// [SPEC-4.5] Arrow-key moves between the menu tiles, laid out in rows of `columns`.

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

export function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown'
}

/** Index of the tile to focus. Stays in place at the edges (no wrap-around). */
export function moveInGrid(index: number, key: ArrowKey, count: number, columns: number): number {
  const cols = Math.max(1, columns)
  let next = index
  if (key === 'ArrowLeft') next = index - 1
  else if (key === 'ArrowRight') next = index + 1
  else if (key === 'ArrowUp') next = index - cols
  else next = index + cols
  if (next < 0 || next >= count) return index
  return next
}
