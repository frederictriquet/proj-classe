// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-12.2] The rigs of the eight animals of the farm, drawn in
// code in the paper cut-out style of the farmyard with the shared builder (src/silence/rig.ts).
//
// Coordinates are world units, relative to the point between the feet, the animal facing right.
// Colours follow SPEC-12.5: the far legs are darkened with ink, the pig is pink only on the mud.
import { Container, Graphics } from 'pixi.js'
import { oval, type Builder, type Rig, type RigFactory } from '../../silence/rig'
import type { AnimalId } from './animal-data'
import { PALETTE } from './palette'

/** Puts the far legs (the first `far` of `legs`) behind the near ones, under the body. */
function farBehind(figure: Container, legs: Rig['legs'], far: number): void {
  const near = legs[far]!
  for (const leg of legs.slice(0, far)) figure.addChildAt(leg.node, figure.getChildIndex(near.node))
}

function hen(b: Builder, figure: Container): Rig {
  const c = PALETTE.cream
  const tail = b.joint(figure, -26, -58)
  b.cut(tail, (g) => g.moveTo(-22, -46).quadraticCurveTo(-52, -60, -46, -98).quadraticCurveTo(-34, -92, -30, -84).quadraticCurveTo(-22, -96, -12, -94).quadraticCurveTo(-14, -66, -6, -54).closePath(), c)
  const legs = [b.leg(figure, 8, -28, 7, PALETTE.straw, Math.PI, 0.55, { dim: 0.25 }), b.leg(figure, -4, -28, 7, PALETTE.straw, 0, 0.55)]
  farBehind(figure, legs, 1)
  const body = b.joint(figure, 0, -46)
  b.cut(body, oval(-2, -48, 34, 25), c)
  b.cut(body, (g) => g.moveTo(-26, -54).quadraticCurveTo(-4, -64, 14, -52).quadraticCurveTo(0, -34, -26, -54).closePath(), c)
  const head = b.joint(figure, 20, -64)
  const comb = b.joint(head, 26, -94)
  b.cut(comb, (g) => g.moveTo(16, -90).quadraticCurveTo(14, -102, 21, -100).quadraticCurveTo(25, -108, 30, -100).quadraticCurveTo(37, -104, 37, -90).closePath(), PALETTE.red)
  b.cut(head, (g) => g.moveTo(10, -60).quadraticCurveTo(8, -96, 28, -95).quadraticCurveTo(44, -94, 42, -74).quadraticCurveTo(40, -58, 26, -56).closePath(), c)
  b.cut(head, (g) => g.moveTo(40, -82).lineTo(52, -77).lineTo(40, -71).closePath(), PALETTE.straw)
  b.cut(head, oval(39, -64, 4, 7), PALETTE.red)
  const eyes = [b.eye(head, 30, -82, 6.5)]
  return {
    upper: [
      { node: tail, baseY: -58 },
      { node: body, baseY: -46 },
      { node: head, baseY: -64 },
    ],
    drop: 16,
    body,
    head: { node: head, gain: 1.2 },
    // The comb pricks up a little on alert.
    ears: [{ node: comb, rest: 0, up: -0.12, back: 0.25 }],
    eyes,
    legs: [
      { ...legs[0]!, follow: 0.4 },
      { ...legs[1]!, follow: 0.4 },
    ],
    tail: { node: tail, rest: 0 },
    // Scratching the ground with a foot.
    scratch: { node: legs[1]!.node, angle: -0.7 },
    scratchTilt: 0.25,
  }
}

function horse(b: Builder, figure: Container): Rig {
  const brown = PALETTE.brown
  const ink = PALETTE.ink
  const tail = b.joint(figure, -92, -168)
  b.cut(tail, (g) => g.moveTo(-90, -176).quadraticCurveTo(-130, -150, -122, -76).lineTo(-104, -84).quadraticCurveTo(-108, -140, -82, -160).closePath(), ink)
  const nearBack = b.leg(figure, -58, -116, 22, brown, 0, 0.35, { hoof: true })
  const legs = [
    b.leg(figure, -70, -116, 20, brown, Math.PI, 0.35, { dim: 0.25, hoof: true }),
    b.leg(figure, 62, -116, 20, brown, 0, 0.35, { dim: 0.25, hoof: true }),
    nearBack,
    b.leg(figure, 74, -116, 22, brown, Math.PI, 0.35, { hoof: true }),
  ]
  farBehind(figure, legs, 2)
  const body = b.joint(figure, 0, -146)
  b.cut(body, oval(-4, -148, 92, 44), brown)
  const neck = b.joint(figure, 60, -160)
  b.cut(neck, (g) => g.moveTo(40, -152).quadraticCurveTo(52, -206, 84, -232).lineTo(112, -214).quadraticCurveTo(92, -190, 94, -140).closePath(), brown)
  neck.addChild(new Graphics().moveTo(42, -160).quadraticCurveTo(50, -212, 80, -240).lineTo(90, -232).quadraticCurveTo(64, -204, 58, -152).closePath().fill(ink))
  const head = b.joint(neck, 98, -222)
  const ear = (x: number): Container => {
    const node = b.joint(head, x, -234)
    b.cut(node, (g) => g.moveTo(x - 7, -232).quadraticCurveTo(x - 4, -252, x + 1, -256).quadraticCurveTo(x + 8, -246, x + 7, -232).closePath(), brown)
    return node
  }
  const earBack = ear(92)
  b.cut(head, (g) => g.moveTo(88, -236).bezierCurveTo(114, -248, 140, -218, 138, -196).quadraticCurveTo(137, -180, 120, -182).bezierCurveTo(102, -186, 86, -204, 88, -236).closePath(), brown)
  const earFront = ear(104)
  head.addChild(new Graphics().moveTo(108, -236).quadraticCurveTo(120, -224, 124, -204).lineTo(116, -206).quadraticCurveTo(112, -222, 102, -232).closePath().fill(PALETTE.cream))
  head.addChild(new Graphics().ellipse(130, -192, 4, 3.5).fill(ink))
  const eyes = [b.eye(head, 106, -220, 8.5)]
  return {
    upper: [
      { node: tail, baseY: -168 },
      { node: body, baseY: -146 },
      { node: neck, baseY: -160 },
    ],
    drop: 70,
    body,
    neck: { node: neck, gain: 1.6 },
    head: { node: head, gain: 0.6 },
    ears: [
      { node: earBack, rest: -0.2, up: 0.05, back: -0.9 },
      { node: earFront, rest: 0, up: 0.15, back: -0.8 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.6 },
    scratchTilt: 0.3,
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
    node.addChild(new Graphics().ellipse(x, -138, 5, 21).fill(PALETTE.pink))
    return node
  }
  const earBack = ear(2)
  b.cut(head, oval(14, -94, 27, 24), c)
  const earFront = ear(22)
  head.addChild(new Graphics().ellipse(38, -91, 5, 4.5).fill(PALETTE.pink))
  const eyes = [b.eye(head, 6, -98, 9.5), b.eye(head, 26, -98, 9.5)]
  return {
    upper: [
      { node: tail, baseY: -26 },
      { node: body, baseY: -44 },
      { node: haunch, baseY: -30 },
      { node: head, baseY: -74 },
    ],
    // Low enough to lie unseen behind the big cabbage.
    drop: 46,
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

function sheep(b: Builder, figure: Container): Rig {
  const ink = PALETTE.ink
  const c = PALETTE.cream
  const nearBack = b.leg(figure, -36, -44, 13, ink, 0, 0.45)
  const legs = [
    b.leg(figure, -46, -44, 12, ink, Math.PI, 0.45, { dim: 0.2 }),
    b.leg(figure, 30, -44, 12, ink, 0, 0.45, { dim: 0.2 }),
    nearBack,
    b.leg(figure, 40, -44, 13, ink, Math.PI, 0.45),
  ]
  farBehind(figure, legs, 2)
  const tail = b.joint(figure, -62, -78)
  b.cut(tail, oval(-66, -76, 12, 13), c)
  const body = b.joint(figure, 0, -72)
  // Wool: lobes all around, one outline.
  b.cut(
    body,
    (g) => {
      const lobes = 11
      const at = (angle: number, k: number): [number, number] => [-8 + 60 * k * Math.cos(angle), -74 + 40 * k * Math.sin(angle)]
      g.moveTo(...at(0, 1))
      for (let i = 0; i < lobes; i++) {
        const a = (i * 2 * Math.PI) / lobes
        g.quadraticCurveTo(...at(a + Math.PI / lobes, 1.24), ...at(a + (2 * Math.PI) / lobes, 1))
      }
      return g.closePath()
    },
    c,
  )
  const head = b.joint(figure, 46, -84)
  const ear = b.joint(head, 50, -94)
  b.cut(ear, oval(40, -94, 13, 6), ink)
  b.cut(head, (g) => g.moveTo(46, -102).bezierCurveTo(68, -112, 86, -90, 82, -70).quadraticCurveTo(78, -58, 66, -60).bezierCurveTo(52, -64, 42, -84, 46, -102).closePath(), ink)
  b.cut(head, oval(56, -104, 15, 10), c)
  const eyes = [b.eye(head, 64, -88, 7)]
  return {
    upper: [
      { node: tail, baseY: -78 },
      { node: body, baseY: -72 },
      { node: head, baseY: -84 },
    ],
    drop: 40,
    body,
    head: { node: head, gain: 0.9 },
    ears: [{ node: ear, rest: 0.25, up: -0.1, back: 0.7 }],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.8 },
    scratchTilt: 0.25,
  }
}

function pig(b: Builder, figure: Container): Rig {
  const p = PALETTE.pink
  const nearBack = b.leg(figure, -40, -30, 17, p, 0, 0.5)
  const legs = [
    b.leg(figure, -50, -30, 16, p, Math.PI, 0.5, { dim: 0.2 }),
    b.leg(figure, 36, -30, 16, p, 0, 0.5, { dim: 0.2 }),
    nearBack,
    b.leg(figure, 46, -30, 17, p, Math.PI, 0.5),
  ]
  farBehind(figure, legs, 2)
  const tail = b.joint(figure, -72, -64)
  tail.addChild(
    new Graphics()
      .moveTo(-72, -64)
      .bezierCurveTo(-90, -68, -94, -86, -84, -88)
      .bezierCurveTo(-74, -90, -74, -76, -84, -76)
      .stroke({ width: 5, color: p, cap: 'round' }),
  )
  const body = b.joint(figure, 0, -56)
  b.cut(body, oval(-4, -58, 72, 38), p)
  const head = b.joint(figure, 52, -64)
  const ear = (x: number): Container => {
    const node = b.joint(head, x, -84)
    b.cut(node, (g) => g.moveTo(x - 10, -84).lineTo(x - 2, -102).lineTo(x + 10, -84).closePath(), p)
    return node
  }
  const earBack = ear(54)
  b.cut(head, oval(64, -64, 28, 26), p)
  const earFront = ear(70)
  b.cut(head, oval(90, -60, 11, 14), p)
  head.addChild(new Graphics().ellipse(92, -60, 7, 10).fill({ color: PALETTE.ink, alpha: 0.12 }))
  head.addChild(new Graphics().ellipse(91, -65, 2.5, 3.5).ellipse(92, -55, 2.5, 3.5).fill(PALETTE.ink))
  const eyes = [b.eye(head, 70, -72, 6.5)]
  return {
    upper: [
      { node: tail, baseY: -64 },
      { node: body, baseY: -56 },
      { node: head, baseY: -64 },
    ],
    drop: 24,
    body,
    head: { node: head, gain: 0.6 },
    ears: [
      { node: earBack, rest: -0.2, up: -0.4, back: 0.3 },
      { node: earFront, rest: 0.1, up: -0.25, back: 0.5 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.8 },
    scratchTilt: 0.2,
  }
}

function cow(b: Builder, figure: Container): Rig {
  const c = PALETTE.cream
  const ink = PALETTE.ink
  const tail = b.joint(figure, -100, -158)
  b.cut(tail, (g) => g.moveTo(-100, -162).quadraticCurveTo(-118, -130, -114, -80).lineTo(-106, -80).quadraticCurveTo(-110, -128, -94, -156).closePath(), c)
  b.cut(tail, oval(-110, -74, 9, 14), ink)
  const nearBack = b.leg(figure, -64, -100, 24, c, 0, 0.35, { hoof: true })
  const legs = [
    b.leg(figure, -76, -100, 22, c, Math.PI, 0.35, { dim: 0.25, hoof: true }),
    b.leg(figure, 56, -100, 22, c, 0, 0.35, { dim: 0.25, hoof: true }),
    nearBack,
    b.leg(figure, 68, -100, 24, c, Math.PI, 0.35, { hoof: true }),
  ]
  farBehind(figure, legs, 2)
  const body = b.joint(figure, 0, -136)
  b.cut(body, (g) => g.roundRect(-104, -184, 196, 96, 44), c)
  const spots = new Graphics()
  for (const [x, y, rx, ry] of [
    [-62, -150, 24, 18],
    [-6, -118, 20, 14],
    [36, -160, 16, 12],
    [-30, -170, 10, 8],
  ] as const)
    spots.ellipse(x, y, rx, ry)
  body.addChild(spots.fill(ink))
  body.addChild(new Graphics().ellipse(-26, -92, 18, 10).fill(PALETTE.pink))
  const head = b.joint(figure, 84, -156)
  const ear = (x: number, y: number, rotation: number): Container => {
    const node = b.joint(head, x, y)
    b.cut(node, oval(x + 12 * Math.cos(rotation), y + 12 * Math.sin(rotation), 15, 8), c)
    return node
  }
  const earBack = ear(84, -184, Math.PI)
  head.addChild(
    new Graphics()
      .moveTo(88, -192)
      .quadraticCurveTo(84, -212, 94, -214)
      .quadraticCurveTo(92, -202, 96, -192)
      .closePath()
      .moveTo(104, -194)
      .quadraticCurveTo(104, -214, 114, -214)
      .quadraticCurveTo(110, -202, 112, -192)
      .closePath()
      .fill(PALETTE.straw),
  )
  b.cut(head, (g) => g.moveTo(80, -190).bezierCurveTo(108, -206, 132, -176, 128, -148).quadraticCurveTo(124, -134, 110, -136).bezierCurveTo(90, -140, 76, -164, 80, -190).closePath(), c)
  const earFront = ear(118, -186, 0)
  b.cut(head, oval(120, -138, 20, 15), PALETTE.pink)
  head.addChild(new Graphics().ellipse(114, -140, 3.5, 3).ellipse(126, -140, 3.5, 3).fill(ink))
  const eyes = [b.eye(head, 98, -170, 8.5), b.eye(head, 114, -170, 8.5)]
  return {
    upper: [
      { node: tail, baseY: -158 },
      { node: body, baseY: -136 },
      { node: head, baseY: -156 },
    ],
    drop: 60,
    body,
    head: { node: head, gain: 0.9 },
    ears: [
      { node: earBack, rest: 0.2, up: -0.15, back: 0.6 },
      { node: earFront, rest: -0.2, up: 0.15, back: -0.6 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.5 },
    scratchTilt: 0.3,
  }
}

function duck(b: Builder, figure: Container): Rig {
  const y = PALETTE.straw
  const legs = [b.leg(figure, 4, -18, 6, PALETTE.red, Math.PI, 0.6, { dim: 0.2 }), b.leg(figure, -6, -18, 6, PALETTE.red, 0, 0.6)]
  farBehind(figure, legs, 1)
  const body = b.joint(figure, 0, -40)
  b.cut(body, (g) => g.moveTo(-52, -60).quadraticCurveTo(-44, -20, 4, -16).quadraticCurveTo(44, -16, 42, -44).quadraticCurveTo(30, -60, 0, -58).quadraticCurveTo(-30, -56, -52, -60).closePath(), y)
  const wing = b.joint(body, -6, -44)
  b.cut(wing, (g) => g.moveTo(-34, -48).quadraticCurveTo(-8, -64, 14, -44).quadraticCurveTo(-6, -30, -34, -48).closePath(), y)
  const head = b.joint(figure, 26, -56)
  b.cut(head, (g) => g.moveTo(20, -50).lineTo(20, -70).quadraticCurveTo(22, -96, 38, -96).quadraticCurveTo(54, -96, 52, -76).quadraticCurveTo(50, -64, 38, -58).lineTo(38, -46).closePath(), y)
  b.cut(head, (g) => g.roundRect(44, -82, 18, 10, 5), PALETTE.red)
  const eyes = [b.eye(head, 38, -82, 6)]
  return {
    upper: [
      { node: body, baseY: -40 },
      { node: head, baseY: -56 },
    ],
    drop: 12,
    body,
    head: { node: head, gain: 1.1 },
    ears: [],
    eyes,
    legs: [
      { ...legs[0]!, follow: 0.5 },
      { ...legs[1]!, follow: 0.5 },
    ],
    // The tail end of the body wags; the wing lifts a little to preen.
    tail: { node: wing, rest: 0 },
    scratch: { node: wing, angle: -0.35 },
    scratchTilt: 0.6,
  }
}

function goat(b: Builder, figure: Container): Rig {
  const brown = PALETTE.brown
  const c = PALETTE.cream
  const nearBack = b.leg(figure, -34, -64, 14, brown, 0, 0.45, { hoof: true })
  const legs = [
    b.leg(figure, -44, -64, 13, brown, Math.PI, 0.45, { dim: 0.25, hoof: true }),
    b.leg(figure, 30, -64, 13, brown, 0, 0.45, { dim: 0.25, hoof: true }),
    nearBack,
    b.leg(figure, 40, -64, 14, brown, Math.PI, 0.45, { hoof: true }),
  ]
  farBehind(figure, legs, 2)
  const tail = b.joint(figure, -58, -104)
  b.cut(tail, (g) => g.moveTo(-58, -102).quadraticCurveTo(-74, -114, -68, -126).quadraticCurveTo(-60, -116, -52, -106).closePath(), brown)
  const body = b.joint(figure, 0, -90)
  b.cut(body, oval(-6, -92, 60, 30), brown)
  body.addChild(new Graphics().ellipse(-4, -72, 40, 9).fill(c))
  const neck = b.joint(figure, 38, -104)
  b.cut(neck, (g) => g.moveTo(28, -106).quadraticCurveTo(34, -130, 48, -142).lineTo(66, -134).quadraticCurveTo(56, -118, 58, -92).closePath(), brown)
  const head = b.joint(neck, 56, -138)
  head.addChild(
    new Graphics()
      .moveTo(50, -150)
      .quadraticCurveTo(42, -174, 26, -172)
      .lineTo(30, -164)
      .quadraticCurveTo(40, -164, 44, -148)
      .closePath()
      .moveTo(60, -152)
      .quadraticCurveTo(54, -176, 38, -176)
      .lineTo(42, -168)
      .quadraticCurveTo(50, -166, 54, -150)
      .closePath()
      .fill(PALETTE.straw),
  )
  const ear = b.joint(head, 52, -142)
  b.cut(ear, oval(40, -140, 12, 5), brown)
  b.cut(head, (g) => g.moveTo(46, -152).bezierCurveTo(66, -162, 84, -140, 82, -124).quadraticCurveTo(80, -112, 70, -114).bezierCurveTo(56, -118, 44, -134, 46, -152).closePath(), brown)
  b.cut(head, (g) => g.moveTo(64, -116).lineTo(68, -96).lineTo(76, -114).closePath(), c)
  head.addChild(new Graphics().ellipse(76, -122, 6, 5).fill(c))
  const eyes = [b.eye(head, 64, -140, 7)]
  return {
    upper: [
      { node: tail, baseY: -104 },
      { node: body, baseY: -90 },
      { node: neck, baseY: -104 },
    ],
    drop: 40,
    body,
    neck: { node: neck, gain: 1.4 },
    head: { node: head, gain: 0.6 },
    ears: [{ node: ear, rest: 0.2, up: -0.15, back: 0.6 }],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.9 },
    scratchTilt: 0.3,
  }
}

/** [SPEC-12.2] How to draw each farm animal. */
export const RIGS: Readonly<Record<AnimalId, RigFactory>> = { hen, horse, rabbit, sheep, pig, cow, duck, goat }
