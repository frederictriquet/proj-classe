// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-17.5] The palette of « Printemps du silence », shared by
// every picture of the spring meadow (PixiJS drawings and the hand-written SVG thumbnail). No other
// colour is drawn: shadows, light and depth use these colours with transparency. The list is
// recorded in docs/SPEC.md, SPEC-17.5. Kept free of PixiJS imports, so the menu and the tests can
// read it.
//
// [SPEC-17.5.1] The sky is deeper than the farm's, so that the yellow sun and the bees in flight
// stand out of it.
export const PALETTE = {
  /** Pupils, the mole, the bees' stripes, the holes of the nest box and the skep, paper shadows. */
  ink: '#1B1B1B',
  /** Eye whites, clouds, bee wings, swallow bellies, the tit's cheeks, cherry blossoms, petals. */
  cream: '#FBF6E9',
  /** Spring sky. */
  sky: '#4A98D3',
  /** The meadow and the buds of the cherry tree. */
  grass: '#5AA545',
  /** The far hills, leaves and stems. */
  leaf: '#2E6B3F',
  /** Trunk and branches, the fence, the nest box, the nest, the nestlings, the molehill. */
  brown: '#6B3F1F',
  /** Tulips, the swallows' throats, the roof of the nest box. */
  red: '#B82E28',
  /** Sun, daffodils, bees, the nestlings' beaks, the tit's breast, the straw skep. */
  yellow: '#F4C430',
  /** The swallows' backs, the tit's cap and wings. */
  blue: '#2C5F9E',
  /** The mole's snout and hands, the nestlings' gapes, the hearts of the cherry blossoms. */
  pink: '#F2A2BC',
} as const
