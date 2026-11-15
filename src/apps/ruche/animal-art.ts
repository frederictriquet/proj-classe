// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-9.3] [SPEC-13.2] The rigs of the bee and of the butterflies
// of the hive, drawn in code in the paper cut-out style of the apiary with the shared builder
// (src/silence/rig.ts): separate pieces moved by the shared animal model.
//
// Coordinates are world units, relative to the point between the feet. Colours follow SPEC-13.5:
// a round yellow bee with ink stripes and no sting, its head yellow so that it shows in the dark
// flight hole [SPEC-13.5.3], cream wings; a yellow butterfly and a cream one, never blue nor pink
// [SPEC-13.5.4].
import { Graphics, type Container } from 'pixi.js'
import type { Builder, Draw, RigFactory } from '../../silence/rig'
import { BEE_IDS, BEE_WINGS, BUTTERFLY_IDS, type AnimalId, type ButterflyId } from './animal-data'
import { PALETTE } from './palette'

/** Ellipse turned by `angle` (radians) about its centre, as a polygon: a wing or a leaf. */
const turnedOval =
  (cx: number, cy: number, rx: number, ry: number, angle: number): Draw =>
  (g: Graphics) => {
    const points: number[] = []
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * 2 * Math.PI
      const x = rx * Math.cos(t)
      const y = ry * Math.sin(t)
      points.push(cx + x * cos - y * sin, cy + x * sin + y * cos)
    }
    return g.poly(points)
  }

/** The part of the ellipse (cx, cy, rx, ry) between the verticals `x1` and `x2`: a stripe across a
 *  round body, one outline. */
const band =
  (cx: number, cy: number, rx: number, ry: number, x1: number, x2: number): Draw =>
  (g: Graphics) => {
    const half = (x: number) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))
    const points: number[] = []
    const steps = 8
    for (let i = 0; i <= steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps
      points.push(x, cy - half(x))
    }
    for (let i = steps; i >= 0; i--) {
      const x = x1 + ((x2 - x1) * i) / steps
      points.push(x, cy + half(x))
    }
    return g.poly(points)
  }

/** An antenna standing on `(x, y)`: a stalk and a round tip, hung on its root so that it moves like
 *  an ear [SPEC-13.2.3]. */
function antenna(b: Builder, parent: Container, x: number, y: number, length: number, tip: string): Container {
  const node = b.joint(parent, x, y)
  b.cut(node, (g) => g.roundRect(x - 2.75, y - length, 5.5, length + 2, 2.75), PALETTE.ink)
  b.cut(node, (g) => g.circle(x, y - length, 5), tip)
  return node
}

/** [SPEC-13.2.1] [SPEC-13.2.4] The bee, side view, facing right: a round striped body, a big yellow
 *  head with two big eyes and two antennae, three short legs, two cream wings on its back. */
function bee(): RigFactory {
  return (b, figure) => {
    const { yellow, ink, cream } = PALETTE
    const wing = (x: number, y: number, dim: number): Container => {
      const node = b.joint(figure, x, y)
      // Standing up on the back, leaning backwards, at rotation 0.
      b.cut(node, turnedOval(x - 6, y - 15, 9.5, 17, -0.35), cream, { dim })
      return node
    }
    const farWing = wing(-12, -48, 0.12)
    const legs = [-18, -4, 10].map((x, i) => b.leg(figure, x, -12, 5.5, ink, i * 2, 0))
    const body = b.joint(figure, -12, -32)
    const abdomen = { cx: -12, cy: -32, rx: 30, ry: 22 }
    b.cut(body, (g) => g.ellipse(abdomen.cx, abdomen.cy, abdomen.rx, abdomen.ry), yellow)
    for (const [x1, x2] of [
      [-36, -28],
      [-21, -13],
      [-6, 2],
    ] as const) {
      body.addChild(band(abdomen.cx, abdomen.cy, abdomen.rx, abdomen.ry, x1, x2)(new Graphics()).fill(ink))
    }
    const head = b.joint(figure, 12, -38)
    const antennae = [antenna(b, head, 22, -56, 17, yellow), antenna(b, head, 32, -57, 17, yellow)]
    b.cut(head, (g) => g.circle(27, -41, 19), yellow)
    const eyes = [b.eye(head, 22, -46, 8.5, cream, 5.5), b.eye(head, 36, -45, 8, cream, 5.2)]
    // Ink rims, which close with the eyes: the cream of the eyes is close to the yellow of the head
    // [SPEC-13.5.2].
    for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(ink), 0)
    head.addChild(new Graphics().moveTo(33, -31).quadraticCurveTo(38, -27, 43, -32).stroke({ width: 3.5, color: ink, cap: 'round' }))
    const nearWing = wing(-4, -50, 0)
    // The front leg in front of the head: it rises to clean the antennae [SPEC-13.2.3].
    figure.addChild(legs[2]!.node)
    const wingOf = (node: Container) => ({ node, folded: BEE_WINGS.folded, up: BEE_WINGS.up, down: BEE_WINGS.down })
    return {
      upper: [
        { node: body, baseY: -32 },
        { node: head, baseY: -38 },
        { node: farWing, baseY: -48 },
        { node: nearWing, baseY: -50 },
      ],
      drop: 8,
      body,
      head: { node: head, gain: 0.9 },
      // Antennae: pricked forward on alert, flat back when fleeing.
      ears: [
        { node: antennae[0]!, rest: -0.35, up: -0.05, back: -1.1 },
        { node: antennae[1]!, rest: 0.2, up: 0.5, back: -0.8 },
      ],
      wings: [wingOf(farWing), wingOf(nearWing)],
      eyes,
      legs: legs.map((leg) => ({ ...leg, follow: 0.5 })),
      // [SPEC-13.2.3] Cleaning its antennae: the front leg up to the head, the antennae rubbed.
      scratch: { node: legs[2]!.node, angle: -2.1 },
      scratchTilt: 0.25,
      extra: (pose) => {
        const rub = 0.3 * pose.scratch * Math.sin(pose.scratchPhase)
        for (const node of antennae) node.rotation += rub
      },
    }
  }
}

/** Colours of a butterfly: its wings and the dots on them [SPEC-13.5.4]. */
const BUTTERFLY_COLORS: Readonly<Record<ButterflyId, { wing: string; dot: string }>> = {
  butterfly1: { wing: PALETTE.yellow, dot: PALETTE.ink },
  butterfly2: { wing: PALETTE.cream, dot: PALETTE.honey },
}

/** [SPEC-13.2.2] A butterfly seen from above, the same whatever its direction: an ink body, a round
 *  head with two big eyes and two antennae, and two pairs of wings that open and close. */
function butterfly(id: ButterflyId): RigFactory {
  const { wing: color, dot } = BUTTERFLY_COLORS[id]
  return (b, figure) => {
    const { ink, cream } = PALETTE
    /** One side (1 right, -1 left): fore and hind wing on one root, open flat at rotation 0. */
    const wing = (side: 1 | -1): Container => {
      const node = b.joint(figure, 3 * side, -44)
      b.cut(node, turnedOval(20 * side, -30, 20, 14, 0.45 * side), color)
      b.cut(node, turnedOval(30 * side, -60, 30, 19, -0.5 * side), color)
      node.addChild(new Graphics().circle(37 * side, -64, 7.5).circle(21 * side, -28, 5).fill(dot))
      return node
    }
    const right = wing(1)
    const left = wing(-1)
    const legs = [-6, 6].map((x, i) => b.leg(figure, x, -14, 4.5, ink, i * Math.PI, 0))
    const body = b.joint(figure, 0, -38)
    b.cut(body, (g) => g.ellipse(0, -38, 7, 24), ink)
    const head = b.joint(figure, 0, -62)
    const antennae = [antenna(b, head, -5, -80, 15, ink), antenna(b, head, 5, -80, 15, ink)]
    // Head of the colour of the wings, so that closed eyes still show [SPEC-8.1].
    b.cut(head, (g) => g.circle(0, -68, 15), color)
    const eyes = [b.eye(head, -7, -69, 7.5, cream, 4.8), b.eye(head, 7, -69, 7.5, cream, 4.8)]
    for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(ink), 0)
    return {
      upper: [
        { node: body, baseY: -38 },
        { node: head, baseY: -62 },
        { node: right, baseY: -44 },
        { node: left, baseY: -44 },
      ],
      drop: 10,
      body,
      head: { node: head, gain: 0.25 },
      ears: [
        { node: antennae[0]!, rest: -0.4, up: -0.15, back: -1 },
        { node: antennae[1]!, rest: 0.4, up: 0.15, back: 1 },
      ],
      // Open flat at 0; raised towards each other above the body, closing.
      wings: [
        { node: right, folded: 0, down: 0.12, up: -0.85 },
        { node: left, folded: 0, down: -0.12, up: 0.85 },
      ],
      eyes,
      legs: legs.map((leg) => ({ ...leg, follow: 0.5 })),
      scratch: { node: legs[1]!.node, angle: -1.6 },
      scratchTilt: 0.12,
      extra: (pose) => {
        const rub = 0.35 * pose.scratch * Math.sin(pose.scratchPhase)
        antennae[0]!.rotation -= rub
        antennae[1]!.rotation += rub
      },
    }
  }
}

/** [SPEC-13.2] How to draw each animal of the hive: every bee shares one drawing. */
const SHARED_BEE = bee()
export const RIGS = Object.fromEntries([
  ...BEE_IDS.map((id) => [id, SHARED_BEE] as const),
  ...BUTTERFLY_IDS.map((id) => [id, butterfly(id)] as const),
]) as Readonly<Record<AnimalId, RigFactory>>
