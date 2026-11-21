import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the spring palette only [SPEC-8.3]. */
const DRAWING_FOLDERS = ['.', '../printemps-galerie']

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('palette of spring [SPEC-8.3] [SPEC-17.5]', () => {
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

  // [SPEC-8.2] [SPEC-17.5.1] Pairs that sit next to each other in the spring meadow keep apart in
  // lightness, so they stay distinct on a washed-out projector and for colour-blind children.
  it('keeps neighbouring colours apart in lightness', () => {
    const pairs: [keyof typeof PALETTE, keyof typeof PALETTE][] = [
      // Decor.
      ['leaf', 'sky'], // far hills, leaves against the sky
      ['leaf', 'grass'], // far hills on the meadow, stems and leaves of the flowers
      ['brown', 'sky'], // branches of the cherry tree, nest box against the sky
      ['brown', 'grass'], // trunk, fence, molehill on the meadow
      ['cream', 'sky'], // clouds, cherry blossoms of the reward
      ['cream', 'brown'], // cherry blossoms on the branches
      ['yellow', 'sky'], // the sun
      ['yellow', 'grass'], // the straw skep and the daffodils on the meadow
      ['ink', 'yellow'], // the hole of the skep
      ['ink', 'brown'], // the hole of the nest box
      ['red', 'sky'], // roof of the nest box
      // Characters on what lies behind them.
      ['red', 'grass'], // tulips
      ['grass', 'brown'], // buds on the branches [SPEC-17.5.1]
      ['yellow', 'red'], // bees on the tulips
      ['ink', 'red'], // the bees' stripes on the tulips
      ['yellow', 'ink'], // a bee or the tit in its hole
      ['blue', 'ink'], // the tit's cap in the hole of the nest box
      ['blue', 'sky'], // tit on the roof, swallows on the fence and in flight [SPEC-17.5.1]
      ['blue', 'grass'], // swallows flying low over the meadow
      ['cream', 'blue'], // swallows' bellies, the tit's cheeks
      ['brown', 'yellow'], // nestlings' beaks
      ['pink', 'brown'], // nestlings' gapes
      ['ink', 'grass'], // the mole on the meadow
      ['pink', 'ink'], // the mole's snout and hands
      ['cream', 'grass'], // the hedgehog's face on the meadow
      ['yellow', 'brown'], // dead leaves on their pile
    ]
    for (const [a, b] of pairs) expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}`).toBeGreaterThanOrEqual(1.7)
  })
})
