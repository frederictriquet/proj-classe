// [SPEC-10 V9] Frames-per-second measurement for the diagnostic test animation.

export interface FpsStats {
  /** Average over the last complete window, or undefined before the first one. */
  current: number | undefined
  /** Lowest window average since the start, warm-up window excluded. */
  min: number | undefined
  /** Number of complete windows measured, warm-up included. */
  windows: number
}

export class FpsMeter {
  private windowStart: number | undefined
  private frames = 0
  private stats: FpsStats = { current: undefined, min: undefined, windows: 0 }

  constructor(private readonly windowMs = 1000) {}

  /** Records one rendered frame at time `now` (ms) and returns the updated stats. */
  frame(now: number): FpsStats {
    if (this.windowStart === undefined) {
      this.windowStart = now
      return this.stats
    }
    this.frames++
    const elapsed = now - this.windowStart
    if (elapsed >= this.windowMs) {
      const fps = (this.frames * 1000) / elapsed
      const windows = this.stats.windows + 1
      // The first window includes start-up work (shader compilation, first layout): not counted in min.
      const min = windows === 1 ? undefined : Math.min(this.stats.min ?? Infinity, fps)
      this.stats = { current: fps, min, windows }
      this.windowStart = now
      this.frames = 0
    }
    return this.stats
  }

  get value(): FpsStats {
    return this.stats
  }
}
