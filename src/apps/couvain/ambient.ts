// [SPEC-8.5] [SPEC-14.3] Quiet permanent life of the incubator: heat lamps swaying very slowly at
// the end of their cord, their warm glow breathing gently in size and intensity without ever
// flickering, and straw wisps moving slightly. Only transforms and alpha change; nothing is
// redrawn. Free of PixiJS. The oscillations and the time step are shared (src/silence/ambient.ts).

export const AMBIENT = {
  /** Hanging heat lamps, rotating gently around their cord anchor at the top. */
  lampSway: { amplitude: 0.022, period: 8.5 },
  /** Warm glow of the heat lamps, breathing slowly in scale and alpha (no flicker [SPEC-8.5]). */
  haloPulse: { amplitude: 0.06, period: 7.0 },
  /** Straw wisps in the litter and along the front edge, rotating gently about their root. */
  straw: { amplitude: 0.03, period: 6.5 },
} as const
