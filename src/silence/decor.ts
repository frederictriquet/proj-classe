// [SPEC-8.6] [SPEC-9.2] [SPEC-9.8] What the shared code needs of the decor of an activity of
// silence: where the animals hide and where they show, and the quiet permanent life of the decor.
import type { Container } from 'pixi.js'

export interface Decor {
  /** Add this to the stage. */
  readonly root: Container
  /** Animals in the open, sorted by depth. */
  readonly actors: Container
  /** One container per hideout, right behind the shape that hides an animal, keyed by the
   *  `hideout` of the animals' specs. */
  readonly slots: Readonly<Record<string, Container>>
  /** [SPEC-8.6] Fits the decor to a screen of this size, in CSS pixels. */
  resize(width: number, height: number): void
  /** Advances the quiet life of the decor by `dt` seconds. */
  tick(dt: number): void
}
