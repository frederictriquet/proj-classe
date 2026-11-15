import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../art/palette'
import { PALETTE } from './palette'

type Color = keyof typeof PALETTE

const colors = Object.values(PALETTE)
const known = new Set(colors.map((c) => c.toUpperCase()))

/** [SPEC-8.2] Smallest lightness ratio between two colours that touch, as for the other activities. */
const MIN_RATIO = 1.7

/** [SPEC-15.5] Stricter lightness ratio for the big bubble against the sky it travels over. */
const BUBBLE_MIN_RATIO = 2

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

describe('palette of the cardiac coherence [SPEC-8.3] [SPEC-8.3.2] [SPEC-15.5]', () => {
  it('has 8 to 10 distinct colours, with the ink and the cream of every palette', () => {
    expect(colors.length).toBeGreaterThanOrEqual(8)
    expect(colors.length).toBeLessThanOrEqual(10)
    expect(known.size).toBe(colors.length)
    for (const color of colors) expect(color).toMatch(/^#[0-9A-F]{6}$/)
    expect(PALETTE).toHaveProperty('ink')
    expect(PALETTE).toHaveProperty('cream')
  })

  it('is the only source of colour of the drawings, SVG thumbnail included [SPEC-8.3.2]', () => {
    const paths = files(fileURLToPath(new URL('.', import.meta.url)))
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      const literals = readFileSync(path, 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []
      const unknown = literals.filter((hex) => !known.has(hex.toUpperCase()))
      expect(unknown, path).toEqual([])
    }
  })

  it('keeps the bubble well apart from both bands of the sky [SPEC-8.2] [SPEC-15.5]', () => {
    expectApart(
      [
        ['pink', 'dusk', 'bubble at the top of its path'],
        ['pink', 'lavender', 'bubble at the bottom of its path'],
      ],
      BUBBLE_MIN_RATIO,
    )
  })

  it('keeps neighbouring colours of the decor apart in lightness [SPEC-8.2]', () => {
    expectApart([
      ['mint', 'lavender', 'hills against the lower sky'],
      ['butter', 'dusk', 'stars in the upper sky'],
      ['cream', 'dusk', 'small bubbles in the upper sky'],
      ['cream', 'lavender', 'small bubbles in the lower sky'],
      ['ink', 'pink', 'eyes and smile of the face on the bubble [SPEC-15.6]'],
    ])
  })
})
