// [SPEC-8.5] [SPEC-12.3] Quiet permanent life of the farmyard: slow clouds, swaying reeds and
// cabbages. Only transforms change; nothing is redrawn. Free of PixiJS. The oscillations and the
// time step are shared (src/silence/ambient.ts).

export const AMBIENT = {
  /** The clump of reeds, rotating about its base. */
  reeds: { amplitude: 0.025, period: 6.5 },
  /** Cabbages of the garden, skewed from their base. */
  cabbage: { amplitude: 0.02, period: 7.5 },
  /** Cloud speeds, world units per second. Crossing the safe zone takes several minutes. */
  cloudSpeed: { min: 5, max: 9 },
} as const
