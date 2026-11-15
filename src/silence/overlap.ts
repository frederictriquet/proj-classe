// [SPEC-9.3] [SPEC-9.8] [SPEC-13.2.3] Where the drawing of an animal lies on the screen, free of
// PixiJS so that each activity tests its paths with it. Animals in the open are drawn in the order
// of their ground point (`y`, see animals.ts). If an animal moving along its path passed the depth
// of a still one while their drawings overlap, one would jump in front of the other at sight:
// `depthCrossings` lists the places where this happens. A flying animal is drawn `height` above its
// ground point, so its drawing overlaps others higher on the screen than its depth says.
import { pathLengths, pointAt, type AnimalSpec } from './animal'
import { intersects, type Rect } from './geometry'

/** Offset of the paper shadow of a piece of an animal (see rig.ts), smaller than the decor's: the
 *  pieces are smaller. */
export const PAPER_SHADOW = { x: 5, y: 7 } as const

/** Box of the drawing with its ground point at (x, y) and its feet `height` above it, facing one
 *  way or, if unknown, either way, paper shadow included. `margin` widens it on every side. */
export function drawingBox(spec: AnimalSpec, x: number, y: number, facing?: 1 | -1, height = 0, margin = 0): Rect {
  const { left, right, top } = spec.extent
  const l = facing === 1 ? left : facing === -1 ? -right : Math.min(left, -right)
  const r = facing === 1 ? right : facing === -1 ? -left : Math.max(right, -left)
  return {
    x: x + l - margin,
    y: y - height + top - margin,
    width: r - l + PAPER_SHADOW.x + 2 * margin,
    height: -top + PAPER_SHADOW.y + 2 * margin,
  }
}

export interface RestingPoint {
  x: number
  y: number
  height: number
  facing: 1 | -1
}

/** Where an animal stays still and is sorted with the others: its place and, when it hides in the
 *  actors layer (`usesSlot` false), its hiding and peeking points. */
export function restingPoints(spec: AnimalSpec): RestingPoint[] {
  const place = spec.path[spec.path.length - 1]!
  const points = [{ x: place.x, y: place.y, height: place.height ?? 0, facing: spec.spotFacing }]
  if (!spec.usesSlot) {
    for (const i of [0, spec.peekIndex]) {
      const p = spec.path[i]!
      points.push({ x: p.x, y: p.y, height: p.height ?? 0, facing: spec.hideFacing })
    }
  }
  return points
}

/** Places, one sentence each, where the animal `id` walking or flying its path crosses the depth
 *  of another animal of `animals` standing still, while their drawings overlap on the screen.
 *  Empty: the drawing order never changes at sight. The path is sampled every world unit from the
 *  exit point (before it, the animal is in its hideout's slot) or, for an animal hidden in the
 *  actors layer, from the hiding point. A flying animal's box is widened by its weave. */
export function depthCrossings<Id extends string>(animals: Readonly<Record<Id, AnimalSpec>>, id: NoInfer<Id>): string[] {
  const spec = animals[id]
  const lengths = pathLengths(spec.path)
  const end = lengths[lengths.length - 1]!
  const weave = spec.gait === 'fly' ? (spec.flight?.weave ?? 0) : 0
  const samples = []
  for (let s = spec.usesSlot ? lengths[spec.exitIndex]! : 0; s <= end; s += 1) samples.push(pointAt(spec.path, lengths, s))
  const problems: string[] = []
  for (const other of Object.keys(animals) as Id[]) {
    if (other === id) continue
    for (const still of restingPoints(animals[other])) {
      const stillBox = drawingBox(animals[other], still.x, still.y, still.facing, still.height)
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1]!
        const b = samples[i]!
        if (Math.sign(a.y - still.y) === Math.sign(b.y - still.y)) continue
        const facing = Math.abs(b.dx) > 0.25 ? (Math.sign(b.dx) as 1 | -1) : undefined
        if (intersects(drawingBox(spec, b.x, b.y, facing, b.height, weave), stillBox)) {
          problems.push(`${id} at ${b.x.toFixed(0)},${b.y.toFixed(0)} / ${other}`)
        }
      }
    }
  }
  return problems
}
