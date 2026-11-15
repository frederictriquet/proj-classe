// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-15.5] The pastel palette of « Cohérence cardiaque », shared
// by every picture of the activity (PixiJS drawings and the hand-written SVG thumbnail). No other
// colour is drawn: shadows, light and halo use these colours with transparency. The list is
// recorded in docs/SPEC.md, SPEC-15.5. Kept free of PixiJS imports, so the menu and the tests can
// read it.
//
// The bubble is a very light pink, the sky behind it a deeper lavender, so that the bubble keeps a
// clear lightness gap on a washed-out projector (see palette.test.ts).
export const PALETTE = {
  /** Paper shadows (with transparency). */
  ink: '#3A3255',
  /** Highlights and halo of the bubble, small rising bubbles. */
  cream: '#FFF8EE',
  /** Upper band of the evening sky. */
  dusk: '#7E79C4',
  /** Lower band of the evening sky. */
  lavender: '#9C94D8',
  /** The big breathing bubble. */
  pink: '#FFD3E1',
  /** Rim of the big bubble. */
  rose: '#F4A7BF',
  /** Hills at the bottom. */
  mint: '#9ED9C0',
  /** Still stars in the upper band. */
  butter: '#FFF0A8',
} as const
