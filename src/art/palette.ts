// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] What every palette shares: each activity defines its own
// palette in its folder (8 to 10 colours, recorded in docs/SPEC.md, SPEC-8.3), with an ink and a
// cream that the shared code draws with. Also the contrast measures the palette tests use. Kept
// free of PixiJS imports, so the menu and the tests can read it.

/** [SPEC-8.3] The two colours every palette has: the shared code of the activities of silence
 *  draws pupils, eye whites and paper shadows with them [SPEC-9.8]. */
export interface PaperColors {
  ink: string
  cream: string
}

/** Paper cut-outs cast a soft shadow on the layer below [SPEC-8.1]: the palette's ink, see-through. */
export function paperShadow(ink: string): { color: string; alpha: number } {
  return { color: ink, alpha: 0.18 }
}

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
