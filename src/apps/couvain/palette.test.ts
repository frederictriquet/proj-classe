import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

type Color = keyof typeof PALETTE

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** Folders whose drawings must use the brood palette only [SPEC-8.3] [SPEC-8.3.2]. */
const DRAWING_FOLDERS = ['.', '../couvain-galerie']

/** [SPEC-8.2] Smallest lightness ratio between two colours that touch, as for the farm and the hive. */
const MIN_RATIO = 1.7

/** [SPEC-8.2] [SPEC-14.5] Stricter lightness ratio for the eggs and the yellow chicks against the straw. */
const STRAW_CONTRAST_MIN = 2.2

function files(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.(ts|svg)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

const expectApart = (pairs: readonly (readonly [Color, Color, string])[], minRatio = MIN_RATIO) => {
  for (const [a, b, where] of pairs) {
    expect(contrastRatio(PALETTE[a], PALETTE[b]), `${a} / ${b}: ${where}`).toBeGreaterThanOrEqual(minRatio)
  }
}

describe('palette of the brood [SPEC-8.3] [SPEC-8.3.2] [SPEC-14.5]', () => {
  it('has 8 to 10 distinct colours, with the ink and the cream of every palette', () => {
    expect(colors.length).toBeGreaterThanOrEqual(8)
    expect(colors.length).toBeLessThanOrEqual(10)
    expect(known.size).toBe(colors.length)
    for (const color of colors) expect(color).toMatch(/^#[0-9A-F]{6}$/)
    expect(PALETTE).toHaveProperty('ink')
    expect(PALETTE).toHaveProperty('cream')
  })

  it('is the only source of colour of the drawings, SVG thumbnail included [SPEC-8.3.2]', () => {
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

  // [SPEC-8.2] [SPEC-14.5] The cream eggshells and the yellow chicks must stand out clearly from
  // the straw litter on a washed-out classroom projector.
  it('keeps the yellow of the chicks and the cream of the eggs well apart from the straw [SPEC-8.2] [SPEC-14.5]', () => {
    expectApart(
      [
        ['yellow', 'straw', 'yellow chick on the straw litter'],
        ['cream', 'straw', 'egg and cream chick on the straw litter'],
      ],
      STRAW_CONTRAST_MIN,
    )
  })

  // [SPEC-8.2] [SPEC-14.2] Every chick variant and its features stand out from the straw and the crate back.
  it('keeps every chick variant and feature apart from what lies behind it', () => {
    expectApart([
      ['terracotta', 'straw', 'russet chick, beak and legs on the straw'],
      ['brown', 'straw', 'brown chick on the straw'],
      ['yellow', 'brown', 'yellow chick against the back of the crate or feeder'],
      ['cream', 'brown', 'egg and cream chick against the back of the crate'],
      ['terracotta', 'brown', 'russet chick against the back of the crate'],
      ['terracotta', 'yellow', 'beak and legs on a yellow chick'],
      ['terracotta', 'cream', 'beak and legs on a cream chick'],
      ['ink', 'cream', 'pupil in the eye and zigzag crack on the eggshell'],
    ])
  })

  // [SPEC-8.2] Pairs that touch in the incubator decor.
  it('keeps neighbouring colours of the decor apart in lightness', () => {
    expectApart([
      ['wood', 'slate', 'incubator crate against the dark room wall'],
      ['wood', 'brown', 'crate planks and feeder rim against the dark wood inside'],
      ['wood', 'straw', 'crate walls and feeder body on the straw'],
      ['terracotta', 'brown', 'heat lamp shades against the back of the crate'],
      ['terracotta', 'slate', 'heat lamp shades against the room wall'],
      ['red', 'brown', 'lamp sockets against the back of the crate'],
      ['red', 'slate', 'hen comb and lamp sockets against the room wall'],
      ['red', 'cream', 'comb and wattle on the mother hen'],
      ['red', 'wood', 'comb over the wooden rim of the crate'],
      ['yellow', 'terracotta', 'lamp bulb under the terracotta shade'],
      ['amber', 'brown', 'lamp glow and golden seeds against the dark wood'],
      ['amber', 'straw', 'lamp glow and bright wisps on the straw'],
      ['yellow', 'brown', 'light seeds in the dark feeder trough'],
    ])
  })
})
