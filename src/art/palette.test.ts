import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance, PALETTE } from './palette'

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the palette only [SPEC-8.3]. */
const DRAWING_FOLDERS = ['../apps/foret', '../apps/foret-galerie']

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('palette [SPEC-8.3]', () => {
  it('has 8 to 10 distinct colours', () => {
    expect(colors.length).toBeGreaterThanOrEqual(8)
    expect(colors.length).toBeLessThanOrEqual(10)
    expect(known.size).toBe(colors.length)
    for (const color of colors) expect(color).toMatch(/^#[0-9A-F]{6}$/)
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

  // [SPEC-8.2] Pairs that sit next to each other in the forest keep apart in lightness, so they
  // stay distinct on a washed-out projector and for colour-blind children.
  it('keeps neighbouring colours apart in lightness', () => {
    const pairs: [keyof typeof PALETTE, keyof typeof PALETTE][] = [
      ['sky', 'teal'], // far trees against the sky
      ['teal', 'forest'], // forest edge in front of the far trees
      ['forest', 'grass'], // bush, forest edge and ferns on the grass
      ['forest', 'sky'], // crowns and branch leaves against the sky
      ['bark', 'grass'], // trunks, log and burrow on the grass
      ['bark', 'sky'], // branch against the sky
      ['bark', 'tan'], // cut wood of the log, dark and light fur
      ['ink', 'tan'], // opening of the log
      ['orange', 'grass'], // fox and squirrel on the grass
      ['cream', 'grass'], // light fur on the grass
      // Animals [SPEC-9.3] against what lies behind them.
      ['orange', 'bark'], // squirrel against the trunk, owl on the branch
      ['orange', 'sky'], // owl against the sky
      ['orange', 'forest'], // owl peeking out of the leaves
      ['cream', 'forest'], // owl's face, hedgehog's face peeking out of the leaves and the bush
      ['cream', 'ink'], // rabbit in its burrow
      ['bark', 'cream'], // hedgehog's spines and face, fawn's spots
      ['sun', 'bark'], // owl's feet on the branch
    ]
    for (const [a, b] of pairs) expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}`).toBeGreaterThanOrEqual(1.7)
  })

  it('computes the WCAG luminance and contrast', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#FFFFFF')).toBeCloseTo(1)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
    expect(contrastRatio(PALETTE.sky, PALETTE.sky)).toBe(1)
  })
})
