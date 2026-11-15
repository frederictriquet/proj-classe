import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

type Color = keyof typeof PALETTE

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the hive palette only [SPEC-8.3]. */
const DRAWING_FOLDERS = ['.']

/** [SPEC-8.2] Smallest lightness ratio between two colours that touch, as for the farm. */
const MIN_RATIO = 1.7

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

const expectApart = (pairs: readonly (readonly [Color, Color, string])[]) => {
  for (const [a, b, where] of pairs) expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}: ${where}`).toBeGreaterThanOrEqual(MIN_RATIO)
}

describe('palette of the hive [SPEC-8.3] [SPEC-13.5]', () => {
  it('has 8 to 10 distinct colours, with the ink and the cream of every palette', () => {
    expect(colors.length).toBeGreaterThanOrEqual(8)
    expect(colors.length).toBeLessThanOrEqual(10)
    expect(known.size).toBe(colors.length)
    for (const color of colors) expect(color).toMatch(/^#[0-9A-F]{6}$/)
    expect(PALETTE).toHaveProperty('ink')
    expect(PALETTE).toHaveProperty('cream')
  })

  it('is the only source of colour of the drawings, SVG thumbnail included', () => {
    for (const folder of DRAWING_FOLDERS) {
      const paths = files(fileURLToPath(new URL(folder, import.meta.url)))
      expect(paths.length).toBeGreaterThan(0)
      for (const path of paths) {
        const literals = readFileSync(path, 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []
        const unknown = literals.filter((hex) => !known.has(hex.toUpperCase()))
        expect(unknown, path).toEqual([])
      }
    }
  })

  // [SPEC-8.2] [SPEC-13.5] Both colours of the bee stand out from everything it perches on or flies
  // past, so that a bee stays a yellow and black shape on a washed-out projector.
  it('keeps the yellow and the black of the bee apart from every background of the bee', () => {
    const backgrounds: [Color, string][] = [
      ['pink', 'pink flowers'],
      ['blue', 'cornflowers'],
      ['honey', 'honey of the comb, wood of the hive'],
      ['brown', 'empty cells, flight board'],
      ['grass', 'meadow'],
      ['sky', 'sky'],
      ['leaf', 'stems, hedge, clump'],
    ]
    expectApart(backgrounds.flatMap(([bg, where]) => [['yellow', bg, where] as const, ['ink', bg, where] as const]))
  })

  // [SPEC-13.5] The case of the pig on the grass (SPEC-12.5): the bee's yellow and the cream are
  // too close. No bee perches on cream: daisies and wax walls (see layout.test.ts).
  it('records that the yellow of the bee is too close to the cream', () => {
    expect(contrastRatio(PALETTE.yellow, PALETTE.cream)).toBeLessThan(MIN_RATIO)
  })

  it('keeps the comb readable: honey, empty cells and wax walls apart', () => {
    expectApart([
      ['honey', 'brown', 'full and empty cells'],
      ['honey', 'cream', 'full cell and wax wall'],
      ['brown', 'cream', 'empty cell and wax wall'],
    ])
  })

  it('keeps the wings and the butterflies apart from what lies behind them', () => {
    expectApart([
      ['cream', 'sky', 'wings against the sky'],
      ['cream', 'grass', 'wings over the meadow'],
      // [SPEC-13.2.2] Butterflies, cream or yellow, on the big pink flowers and by the clump.
      ['cream', 'pink', 'butterfly on a big flower'],
      ['yellow', 'pink', 'butterfly on a big flower'],
      ['cream', 'leaf', 'butterfly by the clump'],
      ['yellow', 'leaf', 'butterfly by the clump'],
    ])
  })

  // [SPEC-8.2] Pairs that touch in the decor.
  it('keeps neighbouring colours of the decor apart in lightness', () => {
    expectApart([
      ['sky', 'leaf', 'far hills and hedge'],
      ['leaf', 'grass', 'hedge, stems and clump on the meadow'],
      ['honey', 'sky', 'hive against the sky'],
      ['honey', 'grass', 'hive and comb over the meadow'],
      ['brown', 'sky', 'frame of the comb against the sky'],
      ['brown', 'grass', 'stand, legs and stump on the meadow'],
      ['brown', 'honey', 'flight board under the hive, stump and its cut'],
      ['blue', 'sky', 'roof of the hive'],
      ['ink', 'honey', 'flight hole in the hive'],
      ['pink', 'grass', 'pink flowers'],
      ['blue', 'grass', 'cornflowers'],
      ['cream', 'grass', 'daisies, the pot'],
      ['cream', 'brown', 'pot on the stump'],
      ['honey', 'cream', 'heart of a daisy, honey in the pot'],
      ['yellow', 'pink', 'heart of a pink flower'],
      ['yellow', 'blue', 'heart of a cornflower'],
      ['cream', 'sky', 'clouds'],
      ['yellow', 'sky', 'sun'],
    ])
  })
})
