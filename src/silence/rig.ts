// [SPEC-8.1] [SPEC-8.2] [SPEC-9.3] [SPEC-9.8] Shared drawing of the animals of the activities of
// silence, in paper cut-out style: flat palette colours, round shapes, big eyes, a soft shadow
// under each piece. Each animal is made of separate pieces (body, head, ears, legs, tail, eyes)
// hung on joints by its rig, which each activity writes for its own animals; `apply(pose)` only
// changes their transforms and transparency, nothing is redrawn. No colour here: the rigs give
// theirs, and the shared pieces (pupils, eye whites, paper shadows) take the ink and the cream of
// the activity's palette [SPEC-8.3].
//
// Coordinates are world units, relative to the point between the feet, the animal facing right.
import { Container, Graphics } from 'pixi.js'
import { paperShadow, type PaperColors } from '../art/palette'
import type { AnimalSpec } from './animal'
import type { Pose } from './animal-model'

export type Draw = (g: Graphics) => Graphics

/** Offset of the paper shadow of a piece, smaller than the decor's: the pieces are smaller. */
const SHADOW = { x: 5, y: 7 }
/** Opacity of the shadow on the ground under an animal in the open. */
const GROUND_SHADOW_ALPHA = 0.16

export interface AnimalArt {
  /** Placed at the feet; added to a layer of the decor. Never made transparent: an animal
   *  disappears behind the decor, it does not fade. */
  readonly root: Container
  apply(pose: Pose): void
}

interface Eye {
  open: Container
  pupil: Container
  closed: Graphics
  radius: number
}

interface Ear {
  node: Container
  /** Rotation when relaxed, pricked up (ears = 1) and flat back (ears = -1). */
  rest: number
  up: number
  back: number
}

interface Leg {
  node: Container
  baseY: number
  /** Length from the joint to the ground. */
  length: number
  /** Phase offset in the gait, and largest swing, radians. */
  phase: number
  swing: number
  /** Share of the body's drop the joint follows when crouching: 1 for a hip, 0 for a foot that
   *  stays on the ground. */
  follow: number
  /** The leg gets shorter as the body goes down (long legs of the four-legged animals). */
  fold: boolean
}

export interface Rig {
  /** Pieces lowered with the body when crouching, with their rest height. */
  upper: { node: Container; baseY: number }[]
  /** Height the body goes down at full crouch. */
  drop: number
  body: Container
  neck?: { node: Container; gain: number }
  head: { node: Container; gain: number }
  ears: Ear[]
  eyes: Eye[]
  legs: Leg[]
  tail?: { node: Container; rest: number }
  /** Leg (one of `legs`) raised to scratch, and how far (radians, negative: forwards and up). */
  scratch?: { node: Container; angle: number }
  /** Head tilt while scratching. */
  scratchTilt: number
  /** Animal-specific moves, after the common ones. */
  extra?: (pose: Pose) => void
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export class Builder {
  readonly shades: Graphics[] = []
  private readonly shadow: { color: string; alpha: number }

  /** @param colors ink and cream of the activity's palette [SPEC-8.3]. */
  constructor(private readonly colors: PaperColors) {
    this.shadow = paperShadow(colors.ink)
  }

  /** A joint: rotates and scales about (x, y), given in the animal's coordinates. */
  joint(parent: Container, x: number, y: number): Container {
    const node = new Container()
    node.pivot.set(x, y)
    node.position.set(x, y)
    parent.addChild(node)
    return node
  }

  /** A paper piece: the shape filled with a palette colour, over its shadow. `dim` darkens it
   *  with ink, for the far legs. The shape must be one outline, or its shadow would darken where
   *  parts overlap. */
  cut(parent: Container, draw: Draw, color: string, options: { shadow?: boolean; dim?: number } = {}): void {
    if (options.shadow ?? true) {
      const shade = draw(new Graphics()).fill(this.shadow)
      shade.position.set(SHADOW.x, SHADOW.y)
      this.shades.push(shade)
      parent.addChild(shade)
    }
    parent.addChild(draw(new Graphics()).fill(color))
    if (options.dim) parent.addChild(draw(new Graphics()).fill({ color: this.colors.ink, alpha: options.dim }))
  }

  /** A big round eye: white (or coloured) disc, pupil with a highlight, and a closed eye drawn
   *  as a curved line, shown when the eye shuts [SPEC-8.1]. */
  eye(parent: Container, x: number, y: number, radius: number, white: string = this.colors.cream, pupilRadius = radius * 0.6): Eye {
    const open = new Container()
    open.position.set(x, y)
    open.addChild(new Graphics().ellipse(0, 0, radius, radius).fill(white))
    const pupil = new Container()
    pupil.addChild(new Graphics().circle(0, 0, pupilRadius).fill(this.colors.ink))
    pupil.addChild(new Graphics().circle(-pupilRadius * 0.35, -pupilRadius * 0.4, Math.max(2.5, pupilRadius * 0.32)).fill(this.colors.cream))
    pupil.x = radius * 0.15
    open.addChild(pupil)
    const width = Math.max(4, radius * 0.4)
    const closed = new Graphics()
      .moveTo(x - radius * 0.85, y)
      .quadraticCurveTo(x, y + radius * 0.7, x + radius * 0.85, y)
      .stroke({ width, color: this.colors.ink, cap: 'round' })
    closed.alpha = 0
    parent.addChild(open, closed)
    return { open, pupil, closed, radius }
  }

  leg(parent: Container, x: number, top: number, width: number, color: string, phase: number, swing: number, options: { dim?: number; hoof?: boolean } = {}): Leg {
    const node = this.joint(parent, x, top)
    this.cut(node, (g) => g.roundRect(x - width / 2, top - 2, width, -top + 2, width / 2), color, { dim: options.dim })
    if (options.hoof) node.addChild(new Graphics().roundRect(x - width / 2, -12, width, 12, 4).fill(this.colors.ink))
    return { node, baseY: top, length: -top, phase, swing, follow: 1, fold: true }
  }
}

/** Ellipse outline, as a path builder. */
export const oval =
  (x: number, y: number, rx: number, ry: number): Draw =>
  (g) =>
    g.ellipse(x, y, rx, ry)

/** Builds the pieces of one animal into `figure`, facing right. */
export type RigFactory = (b: Builder, figure: Container) => Rig

function applyEye(eye: Eye, open: number, wide: number, look: number): void {
  const k = 1 + 0.28 * wide
  eye.open.scale.set(k, k * Math.max(0.06, open))
  const shut = clamp01((0.3 - open) / 0.2)
  eye.open.alpha = 1 - shut
  eye.closed.alpha = shut
  eye.pupil.scale.set(1 - 0.22 * wide)
  eye.pupil.x = eye.radius * (0.15 + 0.22 * look)
}

/** Draws the pieces of an animal of an activity: one of its rigs, in the colours of its palette
 *  [SPEC-9.3] [SPEC-9.8]. */
export function drawAnimal(spec: AnimalSpec, rig: RigFactory, colors: PaperColors): AnimalArt {
  const root = new Container({ label: `animal:${spec.id}` })
  const { left, right } = spec.extent
  const ground = new Graphics().ellipse(0, 0, (right - left) * 0.36, 9).fill({ color: colors.ink, alpha: 1 })
  ground.alpha = 0
  root.addChild(ground)
  const figure = new Container()
  root.addChild(figure)
  const b = new Builder(colors)
  const pieces = rig(b, figure)
  let side = 1

  return {
    root,
    apply(pose) {
      root.position.set(pose.x, pose.y)
      const facing = spec.frontal ? 1 : pose.facing
      // The shadow on the ground stays on the ground: it does not hop.
      ground.alpha = spec.frontal ? 0 : GROUND_SHADOW_ALPHA * pose.shadow
      ground.x = ((left + right) / 2) * facing
      figure.scale.x = facing
      figure.y = pose.bob
      // Light comes from the top left whatever the facing: the paper shadows change side while
      // the animal is seen edge-on.
      const now = facing < 0 ? -1 : 1
      if (now !== side) {
        side = now
        for (const shade of b.shades) shade.x = side * SHADOW.x
      }

      const drop = pose.crouch * pieces.drop
      for (const { node, baseY } of pieces.upper) node.y = baseY + drop
      pieces.body.scale.set(2 - pose.breath, pose.breath)
      pieces.body.rotation = pose.lean
      for (const leg of pieces.legs) {
        leg.node.y = leg.baseY + drop * leg.follow
        leg.node.scale.y = leg.fold ? Math.max(0.2, (leg.length - drop) / leg.length) : 1
        let rotation = pose.stride * leg.swing * Math.sin(pose.gait + leg.phase)
        if (pieces.scratch?.node === leg.node) rotation += pose.scratch * (pieces.scratch.angle + 0.25 * Math.sin(pose.scratchPhase))
        leg.node.rotation = rotation
      }
      if (pieces.neck) pieces.neck.node.rotation = pose.headPitch * pieces.neck.gain + pose.lean
      pieces.head.node.rotation = pose.headPitch * pieces.head.gain + pose.chew + pose.scratch * pieces.scratchTilt + (pieces.neck ? 0 : pose.lean)
      for (const ear of pieces.ears) {
        ear.node.rotation = pose.ears >= 0 ? ear.rest + pose.ears * (ear.up - ear.rest) : ear.rest - pose.ears * (ear.back - ear.rest)
        ear.node.scale.y = 1 + 0.12 * Math.max(0, pose.ears)
      }
      for (const eye of pieces.eyes) applyEye(eye, pose.eyeOpen, pose.eyeWide, pose.look)
      if (pieces.tail) pieces.tail.node.rotation = pieces.tail.rest + pose.tail
      pieces.extra?.(pose)
    },
  }
}
