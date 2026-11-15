// [SPEC-9.3] An animal of the clearing: its behaviour (animal-model.ts) drawn by its pieces
// (animal-art.ts), in the right layer of the decor. Inside its hideout it lives in the hideout's
// slot, right behind the shape that hides it; past the exit point of its path it is in the
// actors layer, sorted by depth with the other animals.
import type { Container } from 'pixi.js'
import { drawAnimal } from './animal-art'
import { ANIMALS, type Activity, type AnimalId, type AnimalState } from './animal-data'
import { AnimalModel } from './animal-model'
import type { Clearing } from './clearing'

/** [SPEC-9.3] Common interface of the six animals: set the target state, advance by a time step. */
export interface Animal {
  readonly id: AnimalId
  /** What the animal is doing now. */
  readonly state: AnimalState
  setTarget(state: AnimalState): void
  /** Advances by `dt` seconds (see `frameStep` in ambient.ts). */
  update(dt: number): void
}

/** What the development gallery needs on top of the common interface. */
export interface GalleryAnimal extends Animal {
  readonly view: Container
  readonly model: AnimalModel
  forceActivity(activity: Activity): void
  forceBlink(): void
  /** Draws the animal in this layer whatever its position, to check that changing layer does
   *  not change the image. `undefined` gives the layer back to the path. */
  forceLayer(layer: 'hideout' | 'open' | undefined): void
}

export function createAnimal(id: AnimalId, clearing: Clearing, seed = 1): GalleryAnimal {
  const spec = ANIMALS[id]
  const model = new AnimalModel(spec, seed)
  const art = drawAnimal(id)
  const hideoutLayer = spec.usesSlot ? clearing.slots[spec.hideout] : clearing.actors
  // Depth: the lower the feet on the screen, the closer the animal.
  clearing.actors.sortableChildren = true
  let forced: 'hideout' | 'open' | undefined

  const place = () => {
    const inside = forced ? forced === 'hideout' : model.inHideout
    const layer = inside ? hideoutLayer : clearing.actors
    if (art.root.parent !== layer) layer.addChild(art.root)
    art.apply(model.pose)
    art.root.zIndex = model.pose.y
  }
  place()

  return {
    id,
    view: art.root,
    model,
    get state() {
      return model.state
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
