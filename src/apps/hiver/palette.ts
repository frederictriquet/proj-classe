// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-16.5] The palette of « Hiver du silence », shared by every
// picture of the winter landscape (PixiJS drawings and the hand-written SVG thumbnail). No other
// colour is drawn: shadows, light and depth use these colours with transparency. The list is
// recorded in docs/SPEC.md, SPEC-16.5. Kept free of PixiJS imports, so the menu and the tests can
// read it.
//
// [SPEC-16.5.1] The snow on the ground is the blue of dusk, darker than the cream of the white
// characters (rabbit, white fox, snowman, snowy owl): none of them ever has cream snow behind it.
export const PALETTE = {
  /** Pupils, the snowman's coal eyes and hat, the dark doorway and cave, paper shadows. */
  ink: '#1B1B1B',
  /** Eye whites, the white characters, Santa's beard and trims, the gingerbread man's icing, snow
   *  caps, icicles, smoke, flakes. */
  cream: '#FBF6E9',
  /** Winter sky at dusk. */
  sky: '#5277B5',
  /** Snow on the ground, the drifts and the far hills, in the blue shade of dusk. */
  snow: '#9DB6D3',
  /** The Christmas tree, the bush, the far firs, the elf's tunic. */
  fir: '#1F5234',
  /** Wood of the house, trunk and branches, the rock, the reindeer, the robin's back. */
  brown: '#6B3F1F',
  /** Santa's coat and hat, the elf's hat, the snowman's scarf, ornaments, the house door. */
  red: '#B8302A',
  /** The red fox, the squirrel, the robin's breast, the snowman's nose, the gingerbread man,
   *  ornaments, the unlit star. */
  orange: '#D05A24',
  /** Lit windows, garland bulbs and star of the reward, the owl's eyes, the elf's bell. */
  yellow: '#F4C430',
  /** Faces of Santa and the elf, the elf's hands, inner ears of the rabbit and the white fox. */
  skin: '#F0B49A',
} as const
