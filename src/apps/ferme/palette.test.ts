import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the farm palette only [SPEC-8.3]. */
const DRAWING_FOLDERS = ['.', '../ferme-galerie']

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('palette of the farm [SPEC-8.3] [SPEC-12.5]', () => {
  it('has 8 to 10 distinct colours, with the ink and the cream of every palette', () => {
    expect(colors.length).toBeGreaterThanOrEqual(8)
    expect(colors.length).toBeLessThanOrEqual(10)
    expect(known.size).toBe(colors.length)
    for (const color of colors) expect(color).toMatch(/^#[0-9A-F]{6}$/)
    expect(PALETTE).toHaveProperty('ink')
    expect(PALETTE).toHaveProperty('cream')
  })

  it('is the only source of colour of the drawings, SVG thumbnails included', () => {
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

  // [SPEC-8.2] Pairs that sit next to each other on the farm keep apart in lightness, so they stay
  // distinct on a washed-out projector and for colour-blind children.
  it('keeps neighbouring colours apart in lightness', () => {
    const pairs: [keyof typeof PALETTE, keyof typeof PALETTE][] = [
      ['sky', 'leaf'], // hills, hedges and far trees against the sky
      ['leaf', 'grass'], // hedges, cabbages and reeds on the grass
      ['straw', 'grass'], // haystack and wheat on the grass
      ['red', 'grass'], // barn on the grass
      ['red', 'sky'], // barn and roofs against the sky
      ['ink', 'red'], // doorway of the barn
      ['brown', 'grass'], // fence, henhouse, mud on the grass
      ['blue', 'grass'], // pond on the grass
      // Animals [SPEC-12.2] against what lies behind them.
      ['cream', 'grass'], // hen, sheep, rabbit, cow on the grass
      ['cream', 'leaf'], // rabbit among the cabbages
      ['cream', 'brown'], // hen on the ramp
      ['cream', 'ink'], // horse and cow in the dark doorway, sheep's face
      ['brown', 'ink'], // horse in the doorway
      ['brown', 'straw'], // goat on the haystack
      ['pink', 'brown'], // pig on the mud and by the fence
      ['straw', 'blue'], // duck on the pond
      ['straw', 'leaf'], // duck by the reeds
      ['red', 'straw'], // duck's beak
    ]
    for (const [a, b] of pairs) expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}`).toBeGreaterThanOrEqual(1.7)
  })
})
