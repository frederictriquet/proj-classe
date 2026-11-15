// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] The palette shared by every picture shown to the children
// (PixiJS drawings and hand-written SVG thumbnails). No other colour is drawn: shadows, light and
// depth use these colours with transparency. The list is recorded in docs/SPEC.md, SPEC-8.3.
// Kept free of PixiJS imports, so the menu and the tests can read it.

export const PALETTE = {
  /** Pupils, holes, paper shadows (with transparency). */
  ink: '#1B1B1B',
  /** Clouds, eye whites, bellies, light rays (with transparency). */
  cream: '#FBF6E9',
  /** Sun, flowers, owl eyes, fireflies. */
  sun: '#F4C430',
  sky: '#8ED1F0',
  /** Far trees. */
  teal: '#5E9E9A',
  /** Floor of the clearing. */
  grass: '#7CC36A',
  /** Near foliage, bush, forest edge, foreground ferns. */
  forest: '#2E6B3F',
  /** Trunks, branches, earth, dark fur. */
  bark: '#7A4A26',
  /** Cut wood, light fur, faces. Too close to `grass` in lightness to stand on it alone. */
  tan: '#D9A066',
  /** Fox and squirrel fur. */
  orange: '#D9622B',
} as const

export type PaletteColor = keyof typeof PALETTE

/** Paper cut-outs cast a soft shadow on the layer below [SPEC-8.1]. */
export const PAPER_SHADOW = { color: PALETTE.ink, alpha: 0.18 } as const

/** WCAG relative luminance of a `#RRGGBB` colour, from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(value >> 16) + 0.7152 * channel((value >> 8) & 0xff) + 0.0722 * channel(value & 0xff)
}

/** WCAG contrast ratio between two `#RRGGBB` colours, from 1 (same lightness) to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}
