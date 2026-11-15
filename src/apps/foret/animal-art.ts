// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-9.3] The rigs of the six animals of the forest, drawn in
// code in the paper cut-out style of the clearing with the shared builder (src/silence/rig.ts).
//
// Coordinates are world units, relative to the point between the feet, the animal facing right.
// Colours follow SPEC-8.3.1: no tan piece stands alone on the grass.
import { Container, Graphics } from 'pixi.js'
import { PALETTE } from './palette'
import { oval, type Builder, type Rig, type RigFactory } from '../../silence/rig'
import type { AnimalId } from './animal-data'

function squirrel(b: Builder, figure: Container): Rig {
  const o = PALETTE.orange
  const tail = b.joint(figure, -20, -30)
  b.cut(
    tail,
    (g) =>
      g
        .moveTo(-12, -22)
        .bezierCurveTo(-58, -14, -76, -68, -62, -100)
        .bezierCurveTo(-50, -128, -18, -142, 4, -132)
        .bezierCurveTo(14, -126, 10, -112, -2, -112)
        .bezierCurveTo(-24, -112, -34, -94, -34, -76)
        .bezierCurveTo(-34, -56, -22, -40, -4, -34)
        .closePath(),
    o,
  )
  const body = b.joint(figure, 0, -46)
  b.cut(body, oval(2, -48, 30, 38), o)
  b.cut(body, oval(13, -44, 14, 24), PALETTE.cream)
  const haunch = b.joint(figure, -8, -24)
  b.cut(haunch, oval(-6, -22, 22, 19), o)
  b.cut(haunch, oval(12, -5, 17, 6), o)
  const arm = b.joint(figure, 18, -64)
  b.cut(arm, oval(24, -50, 7, 13), o)
  const head = b.joint(figure, 12, -78)
  const earBack = b.joint(head, 2, -120)
  b.cut(earBack, (g) => g.moveTo(-8, -116).quadraticCurveTo(-8, -144, 4, -148).quadraticCurveTo(13, -138, 12, -118).closePath(), o)
  b.cut(head, oval(14, -100, 28, 26), o)
  const earFront = b.joint(head, 24, -122)
  b.cut(earFront, (g) => g.moveTo(14, -118).quadraticCurveTo(14, -146, 26, -150).quadraticCurveTo(35, -140, 34, -120).closePath(), o)
  b.cut(head, oval(27, -90, 13, 9), PALETTE.cream)
  head.addChild(new Graphics().circle(40, -96, 5).fill(PALETTE.ink))
  const eyes = [b.eye(head, 5, -104, 10), b.eye(head, 26, -104, 9.5)]
  // The paw in front of the head, so that grooming shows.
  figure.addChild(arm)
  return {
    upper: [
      { node: tail, baseY: -30 },
      { node: body, baseY: -46 },
      { node: head, baseY: -78 },
    ],
    drop: 12,
    body,
    head: { node: head, gain: 1 },
    ears: [
      { node: earBack, rest: -0.15, up: 0.05, back: -0.9 },
      { node: earFront, rest: 0, up: 0.12, back: -0.9 },
    ],
    eyes,
    legs: [
      { node: haunch, baseY: -24, length: 24, phase: 0, swing: 0.35, follow: 0, fold: false },
      { node: arm, baseY: -64, length: 64, phase: Math.PI, swing: 0.5, follow: 1, fold: false },
    ],
    tail: { node: tail, rest: 0 },
    // Grooming: the front paw rubs the cheek.
    scratch: { node: arm, angle: -2.2 },
    scratchTilt: 0.18,
  }
}

function rabbit(b: Builder, figure: Container): Rig {
  const c = PALETTE.cream
  const tail = b.joint(figure, -34, -26)
  b.cut(tail, oval(-38, -26, 12, 12), c)
  const body = b.joint(figure, 0, -44)
  b.cut(body, oval(0, -44, 34, 36), c)
  const haunch = b.joint(figure, -12, -30)
  b.cut(haunch, oval(-12, -28, 22, 21), c)
  const foot = b.joint(figure, -6, -12)
  b.cut(foot, oval(6, -6, 24, 7), c)
  const front = b.joint(figure, 18, -32)
  b.cut(front, (g) => g.roundRect(13, -34, 12, 33, 6), c)
  const head = b.joint(figure, 12, -74)
  const ear = (x: number): Container => {
    const node = b.joint(head, x, -112)
    b.cut(node, oval(x, -140, 10, 30), c)
    node.addChild(new Graphics().ellipse(x, -138, 5, 21).fill(PALETTE.tan))
    return node
  }
  const earBack = ear(2)
  b.cut(head, oval(14, -94, 27, 24), c)
  const earFront = ear(22)
  head.addChild(new Graphics().ellipse(38, -91, 5, 4.5).fill(PALETTE.ink))
  const eyes = [b.eye(head, 6, -98, 9.5), b.eye(head, 26, -98, 9.5)]
  return {
    upper: [
      { node: tail, baseY: -26 },
      { node: body, baseY: -44 },
      { node: haunch, baseY: -30 },
      { node: head, baseY: -74 },
    ],
    drop: 8,
    body,
    head: { node: head, gain: 1 },
    ears: [
      { node: earBack, rest: -0.35, up: -0.05, back: -1.25 },
      { node: earFront, rest: -0.1, up: 0.08, back: -1.2 },
    ],
    eyes,
    legs: [
      { node: foot, baseY: -12, length: 12, phase: 0, swing: 0.5, follow: 0, fold: false },
      { node: front, baseY: -32, length: 32, phase: Math.PI, swing: 0.6, follow: 1, fold: true },
    ],
    tail: { node: tail, rest: 0 },
    // The hind foot comes up behind the head.
    scratch: { node: foot, angle: -2.3 },
    scratchTilt: 0.3,
  }
}

function hedgehog(b: Builder, figure: Container): Rig {
  const bark = PALETTE.bark
  const tail = b.joint(figure, -72, -18)
  b.cut(tail, oval(-75, -16, 8, 7), bark)
  const farBack = b.leg(figure, -42, -16, 14, bark, Math.PI, 0.5, { dim: 0.25 })
  const farFront = b.leg(figure, 14, -16, 14, bark, 0, 0.5, { dim: 0.25 })
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
    bark,
  )
  const nearBack = b.leg(figure, -30, -16, 14, bark, 0, 0.5)
  const nearFront = b.leg(figure, 26, -16, 14, bark, Math.PI, 0.5)
  const head = b.joint(figure, 30, -34)
  const ear = b.joint(head, 26, -58)
  b.cut(ear, oval(24, -62, 9, 9), PALETTE.cream)
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
    PALETTE.cream,
  )
  head.addChild(new Graphics().circle(87, -22, 7).fill(PALETTE.ink))
  // Black button eyes with a highlight.
  const eyes = [b.eye(head, 44, -42, 8, PALETTE.ink, 8), b.eye(head, 62, -40, 7.5, PALETTE.ink, 7.5)]
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

function owl(b: Builder, figure: Container): Rig {
  const o = PALETTE.orange
  const bark = PALETTE.bark
  const tail = b.joint(figure, 0, -10)
  b.cut(tail, (g) => g.moveTo(-12, -14).lineTo(12, -14).lineTo(9, 6).quadraticCurveTo(0, 10, -9, 6).closePath(), bark)
  const body = b.joint(figure, 0, -54)
  b.cut(body, oval(0, -54, 44, 50), o)
  b.cut(body, oval(0, -42, 24, 28), PALETTE.cream)
  const wing = (side: 1 | -1): Container => {
    const node = b.joint(figure, 34 * side, -82)
    b.cut(
      node,
      (g) =>
        g
          .moveTo(34 * side, -88)
          .bezierCurveTo(58 * side, -78, 58 * side, -30, 40 * side, -12)
          .bezierCurveTo(28 * side, -30, 25 * side, -62, 34 * side, -88)
          .closePath(),
      bark,
    )
    return node
  }
  const wingLeft = wing(-1)
  const wingRight = wing(1)
  b.cut(figure, (g) => g.ellipse(-15, -3, 11, 6).ellipse(15, -3, 11, 6), PALETTE.sun)
  const head = b.joint(figure, 0, -96)
  const tuft = (side: 1 | -1): Container => {
    const node = b.joint(head, 30 * side, -128)
    b.cut(node, (g) => g.moveTo(44 * side, -126).lineTo(38 * side, -152).lineTo(20 * side, -134).closePath(), bark)
    return node
  }
  const tuftLeft = tuft(-1)
  const tuftRight = tuft(1)
  b.cut(head, oval(0, -108, 46, 34), o)
  // Face disc: two circles joined in one outline.
  const r = 22
  const half = Math.sqrt(r * r - 17 * 17)
  const meet = Math.atan2(half, 17)
  b.cut(
    head,
    (g) =>
      g
        .moveTo(0, -108 - half)
        .arc(-17, -108, r, -meet, meet, true)
        .arc(17, -108, r, Math.PI - meet, Math.PI + meet, true)
        .closePath(),
    PALETTE.cream,
  )
  const eyes = [b.eye(head, -17, -108, 15, PALETTE.sun, 8), b.eye(head, 17, -108, 15, PALETTE.sun, 8)]
  head.addChild(new Graphics().moveTo(-6, -97).lineTo(6, -97).lineTo(0, -85).closePath().fill(bark))
  return {
    upper: [
      { node: tail, baseY: -10 },
      { node: body, baseY: -54 },
      { node: wingLeft, baseY: -82 },
      { node: wingRight, baseY: -82 },
      { node: head, baseY: -96 },
    ],
    drop: 8,
    body,
    head: { node: head, gain: 0.5 },
    ears: [
      { node: tuftLeft, rest: 0, up: 0.25, back: -0.5 },
      { node: tuftRight, rest: 0, up: -0.25, back: 0.5 },
    ],
    eyes,
    legs: [],
    tail: { node: tail, rest: 0 },
    scratchTilt: 0.35,
    // Seen from the front: looking turns the head, preening lifts a wing, a hop opens the wings.
    extra: (pose) => {
      head.rotation += pose.look * 0.12
      const lift = 0.5 * pose.scratch * (1 + 0.3 * Math.sin(pose.scratchPhase))
      const flap = 0.5 * Math.min(1, pose.stride) * Math.abs(Math.sin(pose.gait / 2))
      wingLeft.rotation = flap
      wingRight.rotation = -flap - lift
    },
  }
}

function fox(b: Builder, figure: Container): Rig {
  const o = PALETTE.orange
  const ink = PALETTE.ink
  const tail = b.joint(figure, -58, -80)
  b.cut(
    tail,
    (g) =>
      g
        .moveTo(-56, -88)
        .bezierCurveTo(-86, -112, -128, -104, -128, -74)
        .bezierCurveTo(-128, -52, -100, -50, -80, -60)
        .bezierCurveTo(-70, -66, -62, -70, -54, -72)
        .closePath(),
    o,
  )
  b.cut(tail, (g) => g.moveTo(-110, -101).bezierCurveTo(-122, -96, -128, -86, -128, -74).bezierCurveTo(-128, -60, -118, -55, -106, -54).bezierCurveTo(-112, -68, -114, -88, -110, -101).closePath(), PALETTE.cream, { shadow: false })
  // Legs behind the body, which hides their tops: the far ones bark, the near ones ink.
  const nearBack = b.leg(figure, -28, -62, 12, ink, 0, 0.45)
  const legs = [
    b.leg(figure, -40, -62, 12, PALETTE.bark, Math.PI, 0.45),
    b.leg(figure, 44, -62, 12, PALETTE.bark, 0, 0.45),
    nearBack,
    b.leg(figure, 32, -62, 12, ink, Math.PI, 0.45),
  ]
  // `leg` adds the joint to the figure: reorder so the far legs are drawn first.
  for (const leg of legs.slice(0, 2)) figure.addChildAt(leg.node, figure.getChildIndex(nearBack.node))
  const body = b.joint(figure, -4, -74)
  b.cut(body, oval(-4, -74, 62, 28), o)
  b.cut(body, oval(40, -72, 17, 17), PALETTE.cream)
  const head = b.joint(figure, 50, -88)
  const ear = (x: number, tip: number): Container => {
    const node = b.joint(head, x + 10, -124)
    b.cut(node, (g) => g.moveTo(x, -122).lineTo(x + 11, tip).lineTo(x + 24, -124).closePath(), o)
    node.addChild(new Graphics().moveTo(x + 6, -124).lineTo(x + 11, tip + 12).lineTo(x + 18, -125).closePath().fill(ink))
    return node
  }
  const earBack = ear(46, -150)
  b.cut(head, oval(68, -104, 29, 25), o)
  const earFront = ear(70, -152)
  b.cut(head, (g) => g.moveTo(58, -96).quadraticCurveTo(84, -106, 104, -96).quadraticCurveTo(102, -84, 84, -83).quadraticCurveTo(64, -82, 58, -96).closePath(), PALETTE.cream)
  head.addChild(new Graphics().circle(103, -96, 6).fill(ink))
  const eyes = [b.eye(head, 62, -108, 9), b.eye(head, 82, -108, 9)]
  return {
    upper: [
      { node: tail, baseY: -80 },
      { node: body, baseY: -74 },
      { node: head, baseY: -88 },
    ],
    drop: 36,
    body,
    head: { node: head, gain: 1.1 },
    ears: [
      { node: earBack, rest: -0.12, up: 0.05, back: -0.9 },
      { node: earFront, rest: 0, up: 0.12, back: -0.9 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -1.5 },
    scratchTilt: 0.3,
  }
}

function fawn(b: Builder, figure: Container): Rig {
  const bark = PALETTE.bark
  const tail = b.joint(figure, -68, -132)
  b.cut(tail, oval(-76, -136, 9, 15), bark)
  tail.addChild(new Graphics().ellipse(-79, -130, 5, 9).fill(PALETTE.cream))
  // Legs behind the body, which hides their tops; the far ones darker.
  const nearBack = b.leg(figure, -38, -108, 15, bark, 0, 0.4, { hoof: true })
  const legs = [
    b.leg(figure, -48, -108, 14, bark, Math.PI, 0.4, { dim: 0.25, hoof: true }),
    b.leg(figure, 58, -106, 14, bark, 0, 0.4, { dim: 0.25, hoof: true }),
    nearBack,
    b.leg(figure, 48, -106, 15, bark, Math.PI, 0.4, { hoof: true }),
  ]
  for (const leg of legs.slice(0, 2)) figure.addChildAt(leg.node, figure.getChildIndex(nearBack.node))
  const body = b.joint(figure, 0, -122)
  b.cut(body, oval(0, -122, 72, 34), bark)
  const spots = new Graphics()
  for (const [x, y, r] of [
    [-40, -134, 7],
    [-17, -141, 8],
    [6, -136, 7],
    [28, -142, 6.5],
    [-28, -114, 6],
    [14, -117, 6],
    [-52, -114, 5.5],
  ] as const)
    spots.circle(x, y, r)
  body.addChild(spots.fill(PALETTE.cream))
  const neck = b.joint(figure, 44, -132)
  b.cut(neck, (g) => g.moveTo(32, -136).quadraticCurveTo(42, -174, 60, -190).lineTo(84, -182).quadraticCurveTo(68, -158, 70, -124).closePath(), bark)
  const head = b.joint(neck, 70, -186)
  const ear = (x: number): Container => {
    const node = b.joint(head, x, -202)
    b.cut(node, oval(x, -224, 10, 23), bark)
    node.addChild(new Graphics().ellipse(x, -222, 5, 15).fill(PALETTE.tan))
    return node
  }
  const earBack = ear(62)
  b.cut(head, oval(78, -192, 27, 22), bark)
  const earFront = ear(88)
  b.cut(head, oval(97, -185, 14, 11), PALETTE.tan)
  head.addChild(new Graphics().circle(108, -187, 5).fill(PALETTE.ink))
  const eyes = [b.eye(head, 72, -196, 8.5), b.eye(head, 90, -195, 8.5)]
  return {
    upper: [
      { node: tail, baseY: -132 },
      { node: body, baseY: -122 },
      { node: neck, baseY: -132 },
    ],
    drop: 72,
    body,
    neck: { node: neck, gain: 1.9 },
    head: { node: head, gain: 0.6 },
    ears: [
      { node: earBack, rest: -0.85, up: -0.3, back: -1.4 },
      { node: earFront, rest: 0.75, up: 0.3, back: -0.4 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.9 },
    scratchTilt: 0.35,
  }
}

/** [SPEC-9.3] How to draw each forest animal. */
export const RIGS: Readonly<Record<AnimalId, RigFactory>> = { squirrel, rabbit, hedgehog, owl, fox, fawn }
