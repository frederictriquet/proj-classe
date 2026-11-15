// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-8.3.1] The palette of « Forêt du silence », shared by every
// picture of the forest (PixiJS drawings and the hand-written SVG thumbnail). No other colour is
// drawn: shadows, light and depth use these colours with transparency. The list is recorded in
// docs/SPEC.md, SPEC-8.3.1. Kept free of PixiJS imports, so the menu and the tests can read it.
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
