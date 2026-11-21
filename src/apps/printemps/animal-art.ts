// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-17.2] The rigs of the eleven characters of spring, drawn in
// code in the paper cut-out style of the meadow with the shared builder (src/silence/rig.ts):
// separate pieces moved by the shared animal model. The bees follow the drawing of the hive, the
// tit the robin of winter, the hedgehog the one of the forest, in the spring palette.
//
// [SPEC-17.2.1] The plants do not move: their rigs read how far they have opened from the pose's
// height (see `PLANT_HEIGHTS`), closing halfway as they sleep (the pose's crouch).
//
// Coordinates are world units, relative to the point between the feet, the character facing right.
// Colours follow SPEC-17.5.
import { Container, Graphics } from 'pixi.js'
import type { Pose } from '../../silence/animal-model'
import { oval, type Builder, type Draw, type Rig, type RigFactory } from '../../silence/rig'
import { BEE_WINGS, BIRD_WINGS, BUDS_ROOT, PLANT_HEIGHTS, type AnimalId } from './animal-data'
import { BUD_POINTS, DAFFODILS, TULIPS, type Clump } from './layout'
import { PALETTE } from './palette'

/** Ellipse turned by `angle` (radians) about its centre, as a polygon: a wing, a leaf, a petal. */
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
/** 0 below `a`, 1 above `b`, smooth in between. */
const smooth = (value: number, a: number, b: number) => {
  const t = clamp01((value - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** [SPEC-17.2.1] How far a plant has opened: 0 closed, 1 open; asleep, it closes halfway. */
function opening(pose: Pose): number {
  return clamp01(pose.height / PLANT_HEIGHTS.open) * (1 - pose.crouch)
}

/** What a plant's rig gives the shared drawing: no piece of an animal moves; only `extra` acts. */
function plantRig(extra: (pose: Pose) => void): Rig {
  const still = new Container()
  return { upper: [], drop: 0, body: still, head: { node: still, gain: 0 }, ears: [], eyes: [], legs: [], scratchTilt: 0, extra }
}

/** A stem from the root, leaning to the head at `(dx, -height)`, `width` wide. */
const stem =
  (dx: number, height: number, width: number): Draw =>
  (g) =>
    g
      .moveTo(dx * 0.3 - width / 2, 0)
      .quadraticCurveTo(dx * 0.2 - width / 2, -height * 0.5, dx - width / 2, -height)
      .lineTo(dx + width / 2, -height)
      .quadraticCurveTo(dx * 0.2 + width / 2, -height * 0.5, dx * 0.3 + width / 2, 0)
      .closePath()

/** Long leaves at the foot of a clump, leaf green with a lighter midrib. */
function footLeaves(b: Builder, figure: Container, leaves: readonly [number, number, number, number][]): void {
  for (const [x, length, width, angle] of leaves) {
    b.cut(figure, turnedOval(x + Math.sin(angle) * length * 0.5, -length * 0.5 * Math.cos(angle), width, length / 2, angle), PALETTE.leaf)
    figure.addChild(
      new Graphics()
        .moveTo(x, -4)
        .lineTo(x + Math.sin(angle) * length * 0.8, -length * 0.8 * Math.cos(angle))
        .stroke({ width: 3, color: PALETTE.grass, cap: 'round' }),
    )
  }
}

/** [SPEC-17.2.1] Red tulips: three stems with a green bud each, which swells, shows its red and opens
 *  into a cup. The bees land on the rims of the first and the last [SPEC-17.2.2]. */
function tulips(clump: Clump): RigFactory {
  return (b, figure) => {
    const { red, leaf } = PALETTE
    const heads = clump.stems.map(({ dx, height }) => {
      b.cut(figure, stem(dx, height, 9), leaf)
      const head = b.joint(figure, dx, -height)
      const petals = b.joint(head, dx, -height)
      const side = (s: 1 | -1) => {
        const node = b.joint(petals, dx + 4 * s, -height)
        b.cut(node, turnedOval(dx + 11 * s, -height - 24, 14, 26, 0.12 * s), red)
        return node
      }
      const left = side(-1)
      const right = side(1)
      b.cut(petals, oval(dx, -height - 25, 17, 26), red)
      // Shade between the petals.
      petals.addChild(new Graphics().moveTo(dx - 9, -height - 8).quadraticCurveTo(dx - 12, -height - 30, dx - 7, -height - 44).stroke({ width: 3, color: PALETTE.ink, alpha: 0.2, cap: 'round' }))
      petals.addChild(new Graphics().moveTo(dx + 9, -height - 8).quadraticCurveTo(dx + 12, -height - 30, dx + 7, -height - 44).stroke({ width: 3, color: PALETTE.ink, alpha: 0.2, cap: 'round' }))
      // The green bud, which withdraws into the top of the stem as the flower opens.
      const bud = b.joint(head, dx, -height + 2)
      b.cut(bud, (g) => g.moveTo(dx, -height + 2).quadraticCurveTo(dx - 22, -height - 18, dx, -height - 46).quadraticCurveTo(dx + 22, -height - 18, dx, -height + 2).closePath(), leaf)
      return { petals, left, right, bud }
    })
    footLeaves(b, figure, [
      [-14, 120, 15, -0.42],
      [10, 130, 15, 0.38],
      [0, 92, 13, 0.06],
    ])
    return plantRig((pose) => {
      const o = opening(pose)
      heads.forEach(({ petals, left, right, bud }, i) => {
        petals.scale.set(0.35 + 0.65 * smooth(o, 0, 0.6))
        const open = smooth(o, 0.45, 1)
        left.rotation = -0.3 * open
        right.rotation = 0.3 * open
        bud.scale.set(1 - smooth(o, 0.05, 0.55))
        // The middle one, without a bee, nods as it looks around.
        if (i === 1) petals.rotation = 0.08 * pose.look * open
      })
    })
  }
}

/** [SPEC-17.2.1] Daffodils: three stems, each with a closed green sheath that shows its yellow, then
 *  a star of petals around a trumpet, seen from the front. */
function daffodils(clump: Clump): RigFactory {
  return (b, figure) => {
    const { yellow, leaf, brown } = PALETTE
    const heads = clump.stems.map(({ dx, height }) => {
      b.cut(figure, stem(dx, height, 8), leaf)
      const head = b.joint(figure, dx, -height)
      const star = b.joint(head, dx, -height - 6)
      const cy = -height - 6
      b.cut(
        star,
        (g) => {
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * 2 * Math.PI
            const pts: number[] = []
            for (let i = 0; i < 16; i++) {
              const t = (i / 16) * 2 * Math.PI
              const x = 12 * Math.cos(t)
              const y = 22 * Math.sin(t)
              pts.push(dx + Math.sin(a) * 20 + x * Math.cos(a) - y * Math.sin(a), cy - Math.cos(a) * 20 + x * Math.sin(a) + y * Math.cos(a))
            }
            g.poly(pts)
          }
          return g
        },
        yellow,
        { shadow: false },
      )
      star.addChild(new Graphics().circle(dx, cy, 16).fill({ color: brown, alpha: 0.35 }))
      star.addChild(new Graphics().circle(dx, cy, 13).fill(yellow))
      star.addChild(new Graphics().circle(dx, cy, 7).fill({ color: brown, alpha: 0.3 }))
      const sheath = b.joint(head, dx, -height + 2)
      b.cut(sheath, (g) => g.moveTo(dx - 4, -height + 2).quadraticCurveTo(dx - 20, -height - 14, dx + 2, -height - 34).quadraticCurveTo(dx + 18, -height - 14, dx + 4, -height + 2).closePath(), yellow)
      b.cut(sheath, (g) => g.moveTo(dx - 4, -height + 2).quadraticCurveTo(dx - 18, -height - 10, dx - 6, -height - 26).quadraticCurveTo(dx + 6, -height - 8, dx + 4, -height + 2).closePath(), leaf, { shadow: false })
      return { head, star, sheath, phase: dx / 40 }
    })
    footLeaves(b, figure, [
      [-12, 110, 12, -0.35],
      [12, 120, 12, 0.32],
    ])
    return plantRig((pose) => {
      const o = opening(pose)
      for (const { head, star, sheath, phase } of heads) {
        star.scale.set(smooth(o, 0.35, 1))
        // The sheath swells while peeking, then withdraws as the flower opens.
        sheath.scale.set((0.8 + 0.3 * smooth(o, 0, 0.3)) * (1 - smooth(o, 0.5, 0.95)))
        head.rotation = 0.06 * pose.look * o + 0.02 * Math.sin(pose.tail * 10 + phase) * o
      }
    })
  }
}

/** [SPEC-17.2.1] The buds of the cherry tree: none on the bare branches, small buds of grass green
 *  that swell, then open into two leaves of leaf green [SPEC-17.5.1]. */
function buds(b: Builder, figure: Container): Rig {
  const { grass, leaf } = PALETTE
  const nodes = BUD_POINTS.map((p, i) => {
    const node = new Container()
    node.position.set(p.x - BUDS_ROOT.x, p.y - BUDS_ROOT.y)
    node.rotation = p.angle
    figure.addChild(node)
    const leaves = new Container()
    node.addChild(leaves)
    b.cut(leaves, turnedOval(18, -6, 16, 7, -0.45), leaf)
    b.cut(leaves, turnedOval(18, 6, 16, 7, 0.45), leaf)
    const bud = new Container()
    node.addChild(bud)
    b.cut(bud, oval(9, 0, 11, 7), grass)
    return { bud, leaves, delay: 0.08 * (i % 4) }
  })
  return plantRig((pose) => {
    const o = opening(pose)
    for (const { bud, leaves, delay } of nodes) {
      bud.scale.set(smooth(o, 0.02 + delay * 0.5, 0.3))
      leaves.scale.set(smooth(o, 0.45 + delay, 0.92 + delay * 0.1))
    }
  })
}

/** An antenna standing on `(x, y)`: a stalk and a round tip, hung on its root so that it moves like
 *  an ear [SPEC-13.2.3]. */
function antenna(b: Builder, parent: Container, x: number, y: number, length: number, tip: string): Container {
  const node = b.joint(parent, x, y)
  b.cut(node, (g) => g.roundRect(x - 2.75, y - length, 5.5, length + 2, 2.75), PALETTE.ink)
  b.cut(node, (g) => g.circle(x, y - length, 5), tip)
  return node
}

/** [SPEC-17.2] [SPEC-13.2.4] A bee, as the hive's: a round striped body, a big yellow head with two
 *  big eyes and two antennae, three short legs, two cream wings on its back. */
function bee(b: Builder, figure: Container): Rig {
  const { yellow, ink, cream } = PALETTE
  const wing = (x: number, y: number, dim: number): Container => {
    const node = b.joint(figure, x, y)
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
  for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(ink), 0)
  head.addChild(new Graphics().moveTo(33, -31).quadraticCurveTo(38, -27, 43, -32).stroke({ width: 3.5, color: ink, cap: 'round' }))
  const nearWing = wing(-4, -50, 0)
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
    ears: [
      { node: antennae[0]!, rest: -0.35, up: -0.05, back: -1.1 },
      { node: antennae[1]!, rest: 0.2, up: 0.5, back: -0.8 },
    ],
    wings: [wingOf(farWing), wingOf(nearWing)],
    eyes,
    legs: legs.map((leg) => ({ ...leg, follow: 0.5 })),
    scratch: { node: legs[2]!.node, angle: -2.1 },
    scratchTilt: 0.25,
    extra: (pose) => {
      const rub = 0.3 * pose.scratch * Math.sin(pose.scratchPhase)
      for (const node of antennae) node.rotation += rub
    },
  }
}

/** [SPEC-17.2.3] Three nestlings seen from the front, side by side in the nest: brown down, big eyes
 *  and yellow beaks that open wide on their pink gape (« broute »). */
function nestlings(b: Builder, figure: Container): Rig {
  const { brown, yellow, pink, ink } = PALETTE
  const group = b.joint(figure, 0, 0)
  const chicks = [-40, 0, 40].map((x, i) => {
    const chick = b.joint(group, x, -10)
    b.cut(chick, oval(x, -12, 21, 14), brown)
    b.cut(chick, (g) => g.circle(x, -35, 18), brown)
    // Two wisps of down on the head.
    chick.addChild(new Graphics().moveTo(x - 3, -51).quadraticCurveTo(x - 8, -56, x - 12, -52).moveTo(x + 2, -51).quadraticCurveTo(x + 6, -57, x + 10, -53).stroke({ width: 3, color: brown, cap: 'round' }))
    const eyes = [b.eye(chick, x - 8, -39, 6.5), b.eye(chick, x + 8, -39, 6.5)]
    // Hung under the upper beak, so that opening the beak stretches it downwards.
    const gape = new Graphics().ellipse(0, 4, 9, 4).fill(pink)
    gape.position.set(x, -28)
    chick.addChild(gape)
    const lower = b.joint(chick, x, -27)
    b.cut(lower, (g) => g.moveTo(x - 11, -27).lineTo(x + 11, -27).lineTo(x, -19).closePath(), yellow, { shadow: false })
    b.cut(chick, (g) => g.moveTo(x - 12, -29).lineTo(x + 12, -29).lineTo(x, -22).closePath(), yellow, { shadow: false })
    chick.addChild(new Graphics().moveTo(x - 11, -29).lineTo(x + 11, -29).stroke({ width: 2, color: ink, alpha: 0.35 }))
    return { chick, eyes, gape, lower, phase: i * 2.1 }
  })
  return {
    upper: [{ node: group, baseY: 0 }],
    drop: 12,
    body: new Container(),
    head: { node: group, gain: 0 },
    ears: [],
    eyes: chicks.flatMap((c) => c.eyes),
    legs: [],
    scratchTilt: 0,
    extra: (pose) => {
      // « Broute » (head pitch 0.55): beaks wide open; asleep (0.3) or otherwise, closed.
      const open = clamp01((pose.headPitch - 0.32) / 0.2)
      for (const { chick, gape, lower, phase } of chicks) {
        // The joint sits at the hinge of the beak: it moves down from there.
        lower.y = -27 + 9 * open
        gape.scale.y = 0.4 + 2 * open
        chick.rotation = 0.6 * pose.tail * Math.sin(phase + 1) + 0.12 * pose.look * Math.cos(phase)
      }
    },
  }
}

/** [SPEC-17.2] The mole, side view, sitting: a round ink body, a pink pointed snout, small eyes and
 *  big pink digging hands. */
function mole(b: Builder, figure: Container): Rig {
  const { ink, pink } = PALETTE
  const tail = b.joint(figure, -40, -16)
  b.cut(tail, (g) => g.roundRect(-52, -20, 18, 7, 3.5), pink)
  const farHand = b.joint(figure, 18, -36)
  b.cut(farHand, turnedOval(30, -30, 13, 9, 0.5), pink, { dim: 0.25 })
  const feet = [-14, 8].map((x, i) => {
    const foot = b.joint(figure, x, -8)
    b.cut(foot, oval(x + 4, -5, 12, 6), pink, { dim: i === 0 ? 0.25 : 0 })
    return { node: foot, baseY: -8, length: 8, phase: i * Math.PI, swing: 0.4, follow: 0, fold: false }
  })
  const body = b.joint(figure, -4, -36)
  b.cut(body, oval(-4, -34, 40, 34), ink)
  // A soft sheen of the fur.
  body.addChild(new Graphics().ellipse(-14, -46, 16, 10).fill({ color: PALETTE.cream, alpha: 0.1 }))
  const head = b.joint(figure, 18, -48)
  b.cut(head, (g) => g.moveTo(-2, -70).quadraticCurveTo(30, -76, 42, -56).lineTo(58, -50).quadraticCurveTo(60, -44, 54, -42).lineTo(30, -38).quadraticCurveTo(2, -36, -2, -56).closePath(), ink)
  b.cut(head, (g) => g.moveTo(40, -56).lineTo(58, -50).quadraticCurveTo(60, -44, 54, -42).lineTo(38, -44).closePath(), pink, { shadow: false })
  head.addChild(new Graphics().circle(56, -47, 3.5).fill(ink))
  const eyes = [b.eye(head, 26, -58, 7)]
  const hand = b.joint(figure, 20, -32)
  b.cut(hand, turnedOval(34, -24, 15, 10, 0.4), pink)
  hand.addChild(
    new Graphics()
      .moveTo(44, -22)
      .lineTo(50, -18)
      .moveTo(42, -16)
      .lineTo(47, -11)
      .stroke({ width: 2.5, color: PALETTE.ink, alpha: 0.4, cap: 'round' }),
  )
  return {
    upper: [
      { node: tail, baseY: -16 },
      { node: body, baseY: -36 },
      { node: head, baseY: -48 },
      { node: farHand, baseY: -36 },
      { node: hand, baseY: -32 },
    ],
    drop: 18,
    body,
    head: { node: head, gain: 0.7 },
    ears: [],
    eyes,
    legs: [...feet, { node: hand, baseY: -32, length: 32, phase: 0, swing: 0.3, follow: 1, fold: false }],
    tail: { node: tail, rest: 0 },
    // Scratching is digging: the near hand paddles.
    scratch: { node: hand, angle: -0.9 },
    scratchTilt: 0.15,
  }
}

/** [SPEC-17.2] The hedgehog, side view, as the one of the forest: a dome of brown spines, a cream
 *  pointed face with an ink nose and button eyes. */
function hedgehog(b: Builder, figure: Container): Rig {
  const { brown, cream, ink } = PALETTE
  const tail = b.joint(figure, -72, -18)
  b.cut(tail, oval(-75, -16, 8, 7), brown)
  const farBack = b.leg(figure, -42, -16, 14, brown, Math.PI, 0.5, { dim: 0.25 })
  const farFront = b.leg(figure, 14, -16, 14, brown, 0, 0.5, { dim: 0.25 })
  const body = b.joint(figure, -10, -40)
  // Spines: a dome with triangular teeth, closed along the belly.
  b.cut(
    body,
    (g) => {
      const teeth = 12
      const from = -0.25
      const to = Math.PI + 0.35
      for (let i = 0; i <= 2 * teeth; i++) {
        const angle = from + ((to - from) * i) / (2 * teeth)
        const radius = i % 2 ? 1.12 : 0.92
        const x = -10 + 64 * radius * Math.cos(angle)
        const y = -36 - 54 * radius * Math.sin(angle)
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      return g.lineTo(-66, -8).quadraticCurveTo(-14, -2, 38, -10).closePath()
    },
    brown,
  )
  // A few lighter tips of spines, in rows along the back.
  const tips = new Graphics()
  for (const [x, y, angle] of [
    [-48, -62, 2.3],
    [-30, -76, 1.9],
    [-8, -80, 1.6],
    [14, -74, 1.2],
    [-38, -44, 2.4],
    [-18, -58, 1.9],
    [4, -60, 1.4],
  ] as const)
    tips.moveTo(x, y).lineTo(x + 14 * Math.cos(angle), y - 14 * Math.sin(angle))
  body.addChild(tips.stroke({ width: 3, color: cream, alpha: 0.35, cap: 'round' }))
  const nearBack = b.leg(figure, -30, -16, 14, brown, 0, 0.5)
  const nearFront = b.leg(figure, 26, -16, 14, brown, Math.PI, 0.5)
  const head = b.joint(figure, 30, -34)
  const ear = b.joint(head, 26, -58)
  b.cut(ear, oval(24, -62, 9, 9), cream)
  b.cut(
    head,
    (g) =>
      g
        .moveTo(14, -60)
        .bezierCurveTo(40, -70, 72, -48, 88, -26)
        .quadraticCurveTo(92, -15, 79, -13)
        .bezierCurveTo(60, -9, 30, -5, 14, -12)
        .quadraticCurveTo(0, -36, 14, -60)
        .closePath(),
    cream,
  )
  head.addChild(new Graphics().circle(87, -22, 7).fill(ink))
  const eyes = [b.eye(head, 44, -42, 8, ink, 8), b.eye(head, 62, -40, 7.5, ink, 7.5)]
  return {
    upper: [
      { node: tail, baseY: -18 },
      { node: body, baseY: -40 },
      { node: head, baseY: -34 },
    ],
    drop: 8,
    body,
    head: { node: head, gain: 0.6 },
    ears: [{ node: ear, rest: 0, up: -0.3, back: 0.5 }],
    eyes,
    legs: [
      { ...farBack, phase: Math.PI },
      { ...farFront, phase: 0 },
      { ...nearBack, phase: 0 },
      { ...nearFront, phase: Math.PI },
    ],
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -1.3 },
    scratchTilt: 0.15,
    // Curled up, the head draws back into the spines.
    extra: (pose) => {
      head.x = 30 - 10 * pose.crouch
    },
  }
}

/** [SPEC-17.2] The blue tit, side view, as the robin of winter: a blue cap and wings, a white face
 *  with an ink stripe through the eye, a yellow breast and a green back. */
function tit(b: Builder, figure: Container): Rig {
  const { blue, yellow, cream, ink, leaf } = PALETTE
  const wing = (dim: number): Container => {
    const node = b.joint(figure, -2, -42)
    b.cut(node, turnedOval(-14, -38, 20, 10, 0.35), blue, { dim })
    return node
  }
  const farWing = wing(0.22)
  const tail = b.joint(figure, -24, -34)
  b.cut(tail, (g) => g.moveTo(-20, -38).lineTo(-44, -46).lineTo(-42, -30).lineTo(-18, -28).closePath(), blue)
  const legs = [-2, 8].map((x, i) => b.leg(figure, x, -14, 4, ink, i * Math.PI, 0))
  const body = b.joint(figure, 0, -32)
  b.cut(body, oval(-2, -32, 26, 20), leaf)
  b.cut(body, oval(8, -27, 18, 16), yellow)
  body.addChild(new Graphics().roundRect(6, -36, 5, 18, 2.5).fill(ink))
  const head = b.joint(figure, 16, -46)
  b.cut(head, (g) => g.circle(18, -49, 15), cream)
  b.cut(head, (g) => g.moveTo(3, -50).quadraticCurveTo(6, -66, 20, -64).quadraticCurveTo(34, -62, 33, -51).quadraticCurveTo(18, -56, 3, -50).closePath(), blue, { shadow: false })
  head.addChild(new Graphics().moveTo(8, -47).lineTo(31, -49).stroke({ width: 4, color: ink, cap: 'round' }))
  head.addChild(new Graphics().moveTo(6, -40).quadraticCurveTo(18, -33, 28, -40).stroke({ width: 4, color: blue, cap: 'round' }))
  head.addChild(new Graphics().moveTo(31, -50).lineTo(41, -48).lineTo(31, -44).closePath().fill(ink))
  const eyes = [b.eye(head, 21, -50, 5.5, cream, 4)]
  for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(ink), 0)
  const nearWing = wing(0)
  const wingOf = (node: Container) => ({ node, folded: BIRD_WINGS.folded, up: BIRD_WINGS.up, down: BIRD_WINGS.down })
  return {
    upper: [
      { node: tail, baseY: -34 },
      { node: body, baseY: -32 },
      { node: head, baseY: -46 },
      { node: farWing, baseY: -42 },
      { node: nearWing, baseY: -42 },
    ],
    drop: 8,
    body,
    head: { node: head, gain: 0.9 },
    ears: [],
    wings: [wingOf(farWing), wingOf(nearWing)],
    eyes,
    legs: legs.map((leg) => ({ ...leg, follow: 0.5 })),
    tail: { node: tail, rest: 0 },
    scratch: { node: legs[1]!.node, angle: -1.4 },
    scratchTilt: 0.3,
  }
}

/** [SPEC-17.2] A swallow, side view: a blue back and head, a red throat and forehead, a cream
 *  belly, long pointed wings and a forked tail. */
function swallow(b: Builder, figure: Container): Rig {
  const { blue, red, cream, ink } = PALETTE
  const wing = (dim: number): Container => {
    const node = b.joint(figure, 4, -30)
    b.cut(node, (g) => g.moveTo(10, -32).quadraticCurveTo(-14, -42, -46, -34).quadraticCurveTo(-16, -26, 10, -26).closePath(), blue, { dim })
    return node
  }
  const farWing = wing(0.22)
  const tail = b.joint(figure, -22, -24)
  b.cut(tail, (g) => g.moveTo(-18, -30).lineTo(-58, -40).lineTo(-34, -24).lineTo(-56, -10).lineTo(-18, -18).closePath(), blue)
  const legs = [-2, 6].map((x, i) => b.leg(figure, x, -10, 3.5, ink, i * Math.PI, 0))
  const body = b.joint(figure, 0, -24)
  b.cut(body, oval(-2, -24, 28, 12), blue)
  b.cut(body, oval(4, -19, 20, 8), cream, { shadow: false })
  const head = b.joint(figure, 22, -30)
  b.cut(head, (g) => g.circle(28, -32, 13), blue)
  b.cut(head, oval(35, -26, 7, 7), red, { shadow: false })
  head.addChild(new Graphics().ellipse(38, -38, 4, 3).fill(red))
  head.addChild(new Graphics().moveTo(40, -32).lineTo(50, -30).lineTo(40, -28).closePath().fill(ink))
  const eyes = [b.eye(head, 30, -35, 5, cream, 3.6)]
  const nearWing = wing(0)
  const wingOf = (node: Container) => ({ node, folded: BIRD_WINGS.folded, up: BIRD_WINGS.up, down: BIRD_WINGS.down })
  return {
    upper: [
      { node: tail, baseY: -24 },
      { node: body, baseY: -24 },
      { node: head, baseY: -30 },
      { node: farWing, baseY: -30 },
      { node: nearWing, baseY: -30 },
    ],
    drop: 6,
    body,
    head: { node: head, gain: 0.9 },
    ears: [],
    wings: [wingOf(farWing), wingOf(nearWing)],
    eyes,
    legs: legs.map((leg) => ({ ...leg, follow: 0.5 })),
    tail: { node: tail, rest: 0 },
    scratch: { node: legs[1]!.node, angle: -1.4 },
    scratchTilt: 0.3,
  }
}

export const RIGS: Readonly<Record<AnimalId, RigFactory>> = {
  tulips: tulips(TULIPS),
  buds,
  bee1: bee,
  nestlings,
  daffodils: daffodils(DAFFODILS),
  tit,
  mole,
  hedgehog,
  bee2: bee,
  swallow1: swallow,
  swallow2: swallow,
}
