// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-12.5] The palette of « Ferme du silence », shared by every
// picture of the farm (PixiJS drawings and the hand-written SVG thumbnail). No other colour is
// drawn: shadows, light and depth use these colours with transparency. The list is recorded in
// docs/SPEC.md, SPEC-12.5. Kept free of PixiJS imports, so the menu and the tests can read it.
export const PALETTE = {
  /** Pupils, doorways, paper shadows (with transparency), the sheep's face and legs. */
  ink: '#1B1B1B',
  /** Clouds, eye whites, wool, the hen, the cow, trim of the barn. */
  cream: '#FBF6E9',
  sky: '#8ED1F0',
  /** Grass of the yard and of the hills. */
  grass: '#5FAA4D',
  /** Hedges, far trees, cabbages, reeds. */
  leaf: '#2E6B3F',
  /** The barn, the roofs, the hen's comb, the duck's beak. */
  red: '#B23828',
  /** Hay, wheat, the sun, the duck, beaks and hooves. */
  straw: '#F8D45A',
  /** Wood, mud, the horse, the goat. */
  brown: '#7A4A26',
  /** The pig, muzzles and inner ears. */
  pink: '#EE9AAE',
  /** The pond. */
  blue: '#24689A',
} as const
