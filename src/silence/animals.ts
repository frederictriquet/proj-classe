// [SPEC-9.3] [SPEC-9.8] An animal of an activity of silence: its behaviour (animal-model.ts)
// drawn by its pieces (rig.ts), in the right layer of the decor. Inside its hideout it lives in
// the hideout's slot, right behind the shape that hides it; past the exit point of its path it is
// in the actors layer, sorted by depth with the other animals.
import type { Container } from 'pixi.js'
import type { Activity, AnimalSpec, AnimalState } from './animal'
import { AnimalModel, type Pose } from './animal-model'
import type { Decor, DecorAnimal } from './decor'
import type { AnimalArt } from './rig'

/** [SPEC-9.3] Common interface of the animals: set the target state, advance by a time step. */
export interface Animal<Id extends string = string> extends DecorAnimal<Id> {
  readonly id: Id
  /** What the animal is doing now. */
  readonly state: AnimalState
  /** Current pose of its pieces [SPEC-9.3] [SPEC-14.2.1]. */
  readonly pose: Readonly<Pose>
  setTarget(state: AnimalState): void
  /** Advances by `dt` seconds (see `frameStep` in ambient.ts). */
  update(dt: number): void
}

/** What the development gallery needs on top of the common interface. */
export interface GalleryAnimal<Id extends string = string> extends Animal<Id> {
  readonly view: Container
  readonly model: AnimalModel
  forceActivity(activity: Activity): void
  forceBlink(): void
  /** Draws the animal in this layer whatever its position, to check that changing layer does
   *  not change the image. `undefined` gives the layer back to the path. */
  forceLayer(layer: 'hideout' | 'open' | undefined): void
}

/** Puts an animal, drawn by `art`, in its hideout of the decor. `seed` sets its small activities. */
export function createAnimal<Id extends string>(spec: AnimalSpec<Id>, art: AnimalArt, decor: Decor, seed = 1): GalleryAnimal<Id> {
  const model = new AnimalModel(spec, seed)
  const slot = decor.slots[spec.hideout]
  if (spec.usesSlot && !slot) throw new Error(`Le décor n'a pas de cachette « ${spec.hideout} » pour « ${spec.id} »`)
  const hideoutLayer = spec.usesSlot && slot ? slot : decor.actors
  // Depth: the lower the feet on the screen, the closer the animal.
  decor.actors.sortableChildren = true
  let forced: 'hideout' | 'open' | undefined

  const place = () => {
    const inside = forced ? forced === 'hideout' : model.inHideout
    const layer = inside ? hideoutLayer : decor.actors
    if (art.root.parent !== layer) layer.addChild(art.root)
    art.apply(model.pose)
    art.root.zIndex = model.pose.y
  }
  place()

  return {
    id: spec.id,
    view: art.root,
    model,
    get state() {
      return model.state
    },
    get pose() {
      return model.pose
    },
    setTarget(state) {
      model.setTarget(state)
    },
    update(dt) {
      model.step(dt)
      place()
    },
    forceActivity(activity) {
      model.forceActivity(activity)
    },
    forceBlink() {
      model.forceBlink()
    },
    forceLayer(layer) {
      forced = layer
      place()
    },
  }
}
