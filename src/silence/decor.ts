// [SPEC-8.6] [SPEC-9.2] [SPEC-9.3] [SPEC-9.8] [SPEC-14.2.1] [SPEC-14.2.2] What the shared code
// needs of the decor of an activity of silence: where the animals hide and where they show, and the
// quiet permanent life of the decor.
import type { Container } from 'pixi.js'
import type { AnimalState } from './animal'
import type { Pose } from './animal-model'

/** [SPEC-9.3] [SPEC-14.2.1] [SPEC-14.2.2] State and pose of an animal given to `Decor.tick` at
 *  every frame so a decor whose hideouts follow their animal (the eggs of the brood) can animate
 *  them without adding states to the shared model. */
export interface DecorAnimal<Id extends string = string> {
  readonly id: Id
  readonly state: AnimalState
  readonly pose: Readonly<Pose>
}

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
  /** Advances the quiet life of the decor by `dt` seconds. `animals` gives the state and pose of
   *  each animal for a decor that animates its hideouts from them [SPEC-14.2.1] [SPEC-14.2.2]. */
  tick(dt: number, animals?: readonly DecorAnimal[]): void
}
