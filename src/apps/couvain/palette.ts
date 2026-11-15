// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-14.5] The palette of « Couvain du silence », shared by
// every picture of the brood (PixiJS drawings and the hand-written SVG thumbnail). No other colour
// is drawn: shadows, light and depth use these colours with transparency. The list is recorded in
// docs/SPEC.md, SPEC-14.5. Kept free of PixiJS imports, so the menu and the tests can read it.
//
// The straw is a deep golden ochre so that both the cream eggshells and the bright yellow chicks
// stand out clearly against the litter (see SPEC-14.5 and palette.test.ts).
export const PALETTE = {
  /** Pupils, cracks of the eggs, paper shadows (with transparency). */
  ink: '#1B1B1B',
  /** Eggshells, eye whites, down feathers, the mother hen, cream chicks. */
  cream: '#FBF6E9',
  /** Yellow chicks, bulbs of the heat lamps, light seeds. */
  yellow: '#FFE650',
  /** Warm glow of the heat lamps (with transparency), golden seeds, bright straw wisps. */
  amber: '#F7B93E',
  /** Light wood of the incubator crate, its rim, the feeder and the lamp cords. */
  wood: '#EBC088',
  /** Deep golden-ochre straw of the litter and of the nests. */
  straw: '#C48820',
  /** Lamp shades, beaks, legs, russet chicks, darker straw wisps. */
  terracotta: '#B24622',
  /** Lamp sockets, the mother hen's comb and wattle. */
  red: '#C82828',
  /** Dark wooden back of the crate, inside of the feeder, dark seeds, brown chicks. */
  brown: '#5C3418',
  /** Cool dark wall of the room behind the incubator crate. */
  slate: '#283848',
} as const
