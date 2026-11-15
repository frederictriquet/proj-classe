// [SPEC-8.1] [SPEC-8.4] [SPEC-9.8] Paper cut-out pieces shared by the decors of the activities of
// silence: a shape filled with a palette colour over its soft shadow, lobed outlines (leaves,
// bushes, clouds, hay), and containers that sway about a point. The colours come from the
// activity's palette.
import { Container, Graphics } from 'pixi.js'
import { paperShadow } from '../art/palette'
import { LOBE_BULGE, type Ellipse, type Point } from './geometry'
import { seededRandom } from './random'

export type PathBuilder = (g: Graphics) => Graphics

/** Offset of the paper shadow of a decor piece, in world units: light comes from the top left. */
export const SHADOW: Readonly<Point> = { x: 7, y: 9 }
export const BIG_SHADOW: Readonly<Point> = { x: 12, y: 16 }

/** A paper piece: one shape filled with a palette colour, over its shadow cast in `ink`. */
export type PieceMaker = (path: PathBuilder, color: string, shadow?: Readonly<Point> | null) => Container

/** Paper pieces whose shadow is the ink of a palette. The shape must be a single outline, or
 *  overlapping parts would darken its shadow. */
export function paperPieces(ink: string): PieceMaker {
  const fill = paperShadow(ink)
  return (path, color, shadow = SHADOW) => {
    const container = new Container()
    if (shadow) {
      const shade = path(new Graphics()).fill(fill)
      shade.position.set(shadow.x, shadow.y)
      container.addChild(shade)
    }
    container.addChild(path(new Graphics()).fill(color))
    return container
  }
}

/**
 * Lobed outline around an ellipse, as one path: leaves, bushes, clouds. With `dome`, only the
 * upper half, standing on a flat base at `e.y`. Each lobe bulges out of the ellipse by
 * `LOBE_BULGE / 2` to `LOBE_BULGE`, so the ellipse itself is always covered.
 */
export function lobed(e: Ellipse, lobes: number, seed: number, dome = false): PathBuilder {
  return (g) => {
    const rand = seededRandom(seed)
    const start = dome ? Math.PI : 0
    const step = (dome ? -Math.PI : 2 * Math.PI) / lobes
    // A dome runs from its left end over the top to its right end; y grows downwards.
    const at = (angle: number, factor: number): [number, number] => [
      e.x + e.rx * factor * Math.cos(angle),
      e.y + (dome ? -1 : 1) * e.ry * factor * Math.sin(angle),
    ]
    g.moveTo(...at(start, 1))
    for (let i = 0; i < lobes; i++) {
      const bulge = LOBE_BULGE * (0.5 + rand() / 2)
      // The middle of a quadratic curve lies halfway between its chord and its control point.
      const control = 2 * (1 + bulge) - Math.cos(step / 2)
      g.quadraticCurveTo(...at(start + (i + 0.5) * step, control), ...at(start + (i + 1) * step, 1))
    }
    return g.closePath()
  }
}

/** A container that sways about `pivot`, drawn in world coordinates. */
export function pivoted(pivot: Point): Container {
  const container = new Container()
  container.pivot.set(pivot.x, pivot.y)
  container.position.set(pivot.x, pivot.y)
  return container
}

/** A swaying part of a decor and its phase (0 to 1), which keeps neighbours apart. */
export interface Swaying {
  node: Container
  phase: number
}
