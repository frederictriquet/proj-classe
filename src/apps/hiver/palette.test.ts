import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the winter palette only [SPEC-8.3]. */
const DRAWING_FOLDERS = ['.', '../hiver-galerie']

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('palette of winter [SPEC-8.3] [SPEC-16.5]', () => {
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

  // [SPEC-8.2] [SPEC-16.5.1] Pairs that sit next to each other in the winter landscape keep apart
  // in lightness, so they stay distinct on a washed-out projector and for colour-blind children.
  it('keeps neighbouring colours apart in lightness', () => {
    const pairs: [keyof typeof PALETTE, keyof typeof PALETTE][] = [
      // Decor.
      ['snow', 'sky'], // far hills and roof line against the sky
      ['fir', 'sky'], // top of the Christmas tree and far firs against the sky
      ['fir', 'snow'], // Christmas tree, bush and far firs on the snow
      ['brown', 'sky'], // branches of the big tree, chimney against the sky
      ['brown', 'snow'], // trunk, rock and house on the snow
      ['cream', 'brown'], // snow caps on the branches, the rock and the roof
      ['cream', 'fir'], // snow caps on the bush
      ['ink', 'brown'], // doorway of the house, hollow of the trunk, mouth of the cave
      ['orange', 'fir'], // ornaments on the Christmas tree
      ['yellow', 'fir'], // lit bulbs and star of the reward
      ['yellow', 'brown'], // lit windows in the wooden wall
      // White characters [SPEC-16.5.1]: on the snow, in the cave, the hollow and the doorway,
      // against the sky and the Christmas tree.
      ['cream', 'snow'], // rabbit, white fox, snowman on the ground, peeking over the drifts
      ['cream', 'ink'], // white fox in the cave, the snowman's hat
      ['cream', 'sky'], // snowy owl on its branch
      // Coloured characters on what lies behind them.
      ['orange', 'snow'], // red fox, squirrel
      ['orange', 'brown'], // squirrel on the trunk, robin's breast against its back
      ['orange', 'ink'], // squirrel in the hollow, robin on the hat
      ['brown', 'ink'], // robin on the snowman's hat
      ['red', 'snow'], // Santa, the elf's hat
      ['red', 'ink'], // Santa in the doorway
      ['fir', 'ink'], // elf's tunic, by the dark doorway and the cave
      ['skin', 'red'], // faces under the red hats
    ]
    for (const [a, b] of pairs) expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}`).toBeGreaterThanOrEqual(1.7)
  })
})
