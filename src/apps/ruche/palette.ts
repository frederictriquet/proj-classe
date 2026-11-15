// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-13.5] The palette of « Ruche du silence », shared by every
// picture of the apiary (PixiJS drawings and the hand-written SVG thumbnail). No other colour is
// drawn: shadows, light and depth use these colours with transparency. The list is recorded in
// docs/SPEC.md, SPEC-13.5. Kept free of PixiJS imports, so the menu and the tests can read it.
//
// The bee's yellow is lighter than the grass and the sky and darker than the cream: no bee
// perches on cream (daisies, wax walls of the comb), see SPEC-13.5 and palette.test.ts.
export const PALETTE = {
  /** Pupils, the bees' stripes, the inside of the hive, paper shadows (with transparency). */
  ink: '#1B1B1B',
  /** Clouds, eye whites, wings, daisies, wax walls of the comb, the honey pot. */
  cream: '#FBF6E9',
  /** A deep summer sky: the yellow bees and the cream wings stand out against it. */
  sky: '#55A8DC',
  /** Grass of the meadow. */
  grass: '#66B356',
  /** Far hills, the hedge, stems and leaves, the clump of the butterflies. */
  leaf: '#2E6B3F',
  /** The bees, the sun, the hearts of the pink flowers. */
  yellow: '#FFD43B',
  /** Honey (full cells, the drop, the pot's content) and the wood of the hive. */
  honey: '#B4601C',
  /** Frame of the comb, empty cells, the flight board, the stump, the stand of the hive. */
  brown: '#6B3F1F',
  /** The roof of the hive, cornflowers. */
  blue: '#2C5F9E',
  /** Flowers of the meadow, the two big flowers of the butterflies. */
  pink: '#B8336A',
} as const
