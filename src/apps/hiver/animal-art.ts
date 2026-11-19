// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-16.2] The rigs of the ten characters of winter, drawn in
// code in the paper cut-out style of the landscape with the shared builder (src/silence/rig.ts):
// separate pieces moved by the shared animal model. The rabbit, the squirrel, the foxes and the
// snowy owl follow the drawings of the forest and the farm, in the winter palette.
//
// Coordinates are world units, relative to the point between the feet, the character facing right.
// Colours follow SPEC-16.5.
import { Container, Graphics } from 'pixi.js'
import { oval, type Builder, type Draw, type Rig, type RigFactory } from '../../silence/rig'
import { ROBIN_WINGS, SNOWMAN_HAT_TOP, type AnimalId } from './animal-data'
import { PALETTE } from './palette'

/** Puts the far legs (the first `far` of `legs`) behind the near ones, under the body. */
function farBehind(figure: Container, legs: Rig['legs'], far: number): void {
  const near = legs[far]!
  for (const leg of legs.slice(0, far)) figure.addChildAt(leg.node, figure.getChildIndex(near.node))
}

/** Ellipse turned by `angle` (radians) about its centre, as a polygon: a wing. */
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

/** The white rabbit, as the farm's: sitting, ears up. */
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
    node.addChild(new Graphics().ellipse(x, -138, 5, 21).fill(PALETTE.skin))
    return node
  }
  const earBack = ear(2)
  b.cut(head, oval(14, -94, 27, 24), c)
  const earFront = ear(22)
  head.addChild(new Graphics().ellipse(38, -91, 5, 4.5).fill(PALETTE.skin))
  const eyes = [b.eye(head, 6, -98, 9.5), b.eye(head, 26, -98, 9.5)]
  // Ink rims: the eye whites are the colour of the fur.
  for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(PALETTE.ink), 0)
  return {
    upper: [
      { node: tail, baseY: -26 },
      { node: body, baseY: -44 },
      { node: haunch, baseY: -30 },
      { node: head, baseY: -74 },
    ],
    // Low enough to lie unseen behind the small drift.
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
    scratch: { node: foot, angle: -2.3 },
    scratchTilt: 0.3,
  }
}

/** The red squirrel, as the forest's. */
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
    scratch: { node: arm, angle: -2.2 },
    scratchTilt: 0.18,
  }
}

interface FoxColors {
  fur: string
  /** Chest, muzzle and tail tip. */
  light: string
  nearLegs: string
  farLegs: string
  /** Inside of the ears. */
  ear: string
  /** Dims the far legs of a fox whose legs are the colour of its fur. */
  farDim: number
}

/** The fox of the forest, in the colours of the red fox or of the white fox. */
function fox(colors: FoxColors): RigFactory {
  return (b, figure) => {
    const { fur, light, ink } = { ...colors, ink: PALETTE.ink }
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
      fur,
    )
    b.cut(tail, (g) => g.moveTo(-110, -101).bezierCurveTo(-122, -96, -128, -86, -128, -74).bezierCurveTo(-128, -60, -118, -55, -106, -54).bezierCurveTo(-112, -68, -114, -88, -110, -101).closePath(), light, { shadow: false })
    const nearBack = b.leg(figure, -28, -62, 12, colors.nearLegs, 0, 0.45)
    const legs = [
      b.leg(figure, -40, -62, 12, colors.farLegs, Math.PI, 0.45, { dim: colors.farDim }),
      b.leg(figure, 44, -62, 12, colors.farLegs, 0, 0.45, { dim: colors.farDim }),
      nearBack,
      b.leg(figure, 32, -62, 12, colors.nearLegs, Math.PI, 0.45),
    ]
    farBehind(figure, legs, 2)
    const body = b.joint(figure, -4, -74)
    b.cut(body, oval(-4, -74, 62, 28), fur)
    b.cut(body, oval(40, -72, 17, 17), light)
    const head = b.joint(figure, 50, -88)
    const ear = (x: number, tip: number): Container => {
      const node = b.joint(head, x + 10, -124)
      b.cut(node, (g) => g.moveTo(x, -122).lineTo(x + 11, tip).lineTo(x + 24, -124).closePath(), fur)
      node.addChild(new Graphics().moveTo(x + 6, -124).lineTo(x + 11, tip + 12).lineTo(x + 18, -125).closePath().fill(colors.ear))
      return node
    }
    const earBack = ear(46, -150)
    b.cut(head, oval(68, -104, 29, 25), fur)
    const earFront = ear(70, -152)
    b.cut(head, (g) => g.moveTo(58, -96).quadraticCurveTo(84, -106, 104, -96).quadraticCurveTo(102, -84, 84, -83).quadraticCurveTo(64, -82, 58, -96).closePath(), light)
    head.addChild(new Graphics().circle(103, -96, 6).fill(ink))
    const eyes = [b.eye(head, 62, -108, 9), b.eye(head, 82, -108, 9)]
    if (fur === PALETTE.cream) for (const eye of eyes) eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 2).fill(ink), 0)
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
}

/**
 * [SPEC-16.2] [SPEC-16.2.2] The snowman: two balls of snow, coal eyes and buttons, a carrot nose, a
 * red scarf, twig arms and an ink top hat. The hat hangs on the figure, not on the head nor the
 * body: breathing, turning the head or sleeping never moves it, so the robin stays on it.
 */
function snowman(b: Builder, figure: Container): Rig {
  const { cream, ink, brown } = PALETTE
  const twig = (side: 1 | -1, dim: number): Container => {
    const node = b.joint(figure, 34 * side, -96)
    b.cut(
      node,
      (g) =>
        g
          .moveTo(34 * side, -100)
          .lineTo(72 * side, -136)
          .lineTo(66 * side, -150)
          .lineTo(76 * side, -140)
          .lineTo(82 * side, -146)
          .lineTo(78 * side, -132)
          .lineTo(38 * side, -92)
          .closePath(),
      brown,
      { dim },
    )
    return node
  }
  const backArm = twig(-1, 0.2)
  const body = b.joint(figure, 0, -62)
  b.cut(body, oval(0, -62, 62, 60), cream)
  body.addChild(new Graphics().circle(14, -44, 6).circle(16, -74, 6).fill(ink))
  const head = b.joint(figure, 0, -150)
  b.cut(head, oval(0, -150, 42, 40), cream)
  const eyes = [b.eye(head, 4, -162, 7, ink, 7), b.eye(head, 26, -160, 6.5, ink, 6.5)]
  head.addChild(new Graphics().circle(6, -130, 3.5).circle(16, -126, 3.5).circle(27, -128, 3.5).fill(ink))
  b.cut(head, (g) => g.moveTo(26, -152).lineTo(64, -146).lineTo(26, -140).closePath(), PALETTE.orange)
  // The scarf between the two balls, its end hanging in front.
  const scarf = b.joint(figure, 0, -112)
  b.cut(scarf, (g) => g.roundRect(-38, -122, 76, 18, 9), PALETTE.red)
  b.cut(scarf, (g) => g.moveTo(14, -112).lineTo(34, -112).lineTo(40, -70).lineTo(24, -70).closePath(), PALETTE.red)
  const frontArm = twig(1, 0)
  const hat = new Container()
  figure.addChild(hat)
  b.cut(hat, (g) => g.roundRect(-40, -192, 80, 10, 5), ink)
  b.cut(hat, (g) => g.roundRect(-27, -SNOWMAN_HAT_TOP, 54, 36, 4), ink)
  hat.addChild(new Graphics().rect(-27, -194, 54, 8).fill(PALETTE.red))
  return {
    upper: [
      { node: body, baseY: -62 },
      { node: scarf, baseY: -112 },
      { node: head, baseY: -150 },
      { node: hat, baseY: 0 },
      { node: backArm, baseY: -96 },
      { node: frontArm, baseY: -96 },
    ],
    drop: 4,
    body,
    head: { node: head, gain: 0.3 },
    ears: [],
    eyes,
    legs: [],
    scratchTilt: 0.12,
    // The twigs swing as he hops; the front one waves outwards while he « scratches », away from
    // his face.
    extra: (pose) => {
      const swing = 0.15 * Math.min(1, pose.stride) * Math.sin(pose.gait)
      backArm.rotation = -swing
      frontArm.rotation = swing + pose.scratch * (0.3 + 0.2 * Math.sin(pose.scratchPhase / 2))
    },
  }
}

/** [SPEC-16.2] [SPEC-13.2.4] The robin, side view: brown back, wings and tail, orange breast and
 *  face, cream belly, two slow wide wings. */
function robin(b: Builder, figure: Container): Rig {
  const { brown, orange, cream, ink } = PALETTE
  const wing = (dim: number): Container => {
    const node = b.joint(figure, -2, -42)
    b.cut(node, turnedOval(-14, -38, 20, 10, 0.35), brown, { dim })
    return node
  }
  const farWing = wing(0.22)
  const tail = b.joint(figure, -24, -34)
  b.cut(tail, (g) => g.moveTo(-20, -38).lineTo(-44, -46).lineTo(-42, -30).lineTo(-18, -28).closePath(), brown)
  const legs = [-2, 8].map((x, i) => b.leg(figure, x, -14, 4, ink, i * Math.PI, 0))
  const body = b.joint(figure, 0, -32)
  b.cut(body, oval(-2, -32, 26, 20), brown)
  b.cut(body, oval(10, -27, 15, 15), orange)
  body.addChild(new Graphics().ellipse(0, -16, 14, 6).fill(cream))
  const head = b.joint(figure, 16, -46)
  b.cut(head, (g) => g.circle(18, -49, 15), brown)
  b.cut(head, oval(25, -44, 10, 10), orange, { shadow: false })
  head.addChild(new Graphics().moveTo(31, -50).lineTo(43, -47).lineTo(31, -43).closePath().fill(ink))
  const eyes = [b.eye(head, 20, -53, 6, cream, 4)]
  const nearWing = wing(0)
  const wingOf = (node: Container) => ({ node, folded: ROBIN_WINGS.folded, up: ROBIN_WINGS.up, down: ROBIN_WINGS.down })
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

/** [SPEC-16.2] The elf: green tunic with a belt, green tights, brown curled boots, a skin face with
 *  a pointed ear and a red pointed hat with a yellow bell. */
function elf(b: Builder, figure: Container): Rig {
  const { fir, red, skin, ink, brown, yellow } = PALETTE
  const leg = (x: number, phase: number, dim: number) => {
    const l = b.leg(figure, x, -42, 13, fir, phase, 0.5, { dim })
    b.cut(l.node, (g) => g.moveTo(x - 8, 0).lineTo(x - 8, -12).lineTo(x + 10, -12).quadraticCurveTo(x + 22, -12, x + 22, -22).quadraticCurveTo(x + 26, -4, x + 12, 0).closePath(), brown, { dim })
    return l
  }
  const backArm = b.joint(figure, -12, -86)
  b.cut(backArm, (g) => g.roundRect(-20, -90, 14, 40, 7), fir, { dim: 0.22 })
  b.cut(backArm, (g) => g.circle(-13, -50, 7), skin, { dim: 0.22 })
  const nearBack = leg(-6, 0, 0)
  const legs = [leg(8, Math.PI, 0.22), nearBack]
  farBehind(figure, legs, 1)
  const body = b.joint(figure, 0, -64)
  b.cut(
    body,
    (g) => {
      g.moveTo(-22, -96).lineTo(22, -96).lineTo(32, -40)
      // Zigzag hem.
      for (let i = 0; i < 4; i++) g.lineTo(32 - 16 * i - 8, -32).lineTo(32 - 16 * (i + 1), -40)
      return g.closePath()
    },
    fir,
  )
  body.addChild(new Graphics().rect(-27, -66, 54, 10).fill(ink).rect(-6, -68, 12, 14).fill(yellow))
  body.addChild(new Graphics().moveTo(-22, -96).lineTo(22, -96).lineTo(14, -84).lineTo(6, -94).lineTo(-2, -84).lineTo(-10, -94).lineTo(-18, -84).closePath().fill(red))
  const head = b.joint(figure, 6, -104)
  const ear = b.joint(head, -14, -118)
  b.cut(ear, (g) => g.moveTo(-14, -112).lineTo(-40, -132).lineTo(-12, -124).closePath(), skin)
  b.cut(head, oval(8, -118, 26, 24), skin)
  const eyes = [b.eye(head, 2, -120, 7.5), b.eye(head, 20, -120, 7.5)]
  head.addChild(new Graphics().circle(30, -108, 5).fill({ color: red, alpha: 0.55 }))
  head.addChild(new Graphics().moveTo(8, -104).quadraticCurveTo(16, -98, 24, -104).stroke({ width: 3, color: ink, cap: 'round' }))
  // The hat, its tip bent back, a bell at the end: it nods like an ear.
  const hatTip = b.joint(head, -6, -138)
  b.cut(hatTip, (g) => g.moveTo(-14, -136).quadraticCurveTo(-6, -158, -26, -158).quadraticCurveTo(-8, -150, 4, -138).closePath(), red)
  b.cut(hatTip, (g) => g.circle(-27, -159, 6), yellow)
  b.cut(head, (g) => g.moveTo(-20, -128).quadraticCurveTo(4, -150, 36, -128).quadraticCurveTo(10, -122, -20, -128).closePath(), red)
  const frontArm = b.joint(figure, 14, -88)
  b.cut(frontArm, (g) => g.roundRect(8, -92, 14, 40, 7), fir)
  b.cut(frontArm, (g) => g.circle(15, -52, 7.5), skin)
  return {
    upper: [
      { node: backArm, baseY: -86 },
      { node: body, baseY: -64 },
      { node: head, baseY: -104 },
      { node: frontArm, baseY: -88 },
    ],
    drop: 24,
    body,
    head: { node: head, gain: 0.7 },
    ears: [
      { node: ear, rest: 0, up: 0.25, back: -0.35 },
      { node: hatTip, rest: 0, up: 0.15, back: -0.3 },
    ],
    eyes,
    legs,
    scratch: { node: nearBack.node, angle: -0.8 },
    scratchTilt: 0.2,
    // Arms swing as he walks; scratching, he scratches his head with the front hand.
    extra: (pose) => {
      const swing = 0.4 * Math.min(1, pose.stride) * Math.sin(pose.gait)
      backArm.rotation = -swing
      frontArm.rotation = swing - pose.scratch * (2.2 + 0.2 * Math.sin(pose.scratchPhase))
    },
  }
}

/** [SPEC-16.2] The reindeer, like the forest's fawn: brown, cream belly, neck and tail, a cream
 *  muzzle and wide brown antlers. */
function reindeer(b: Builder, figure: Container): Rig {
  const { brown, cream, ink } = PALETTE
  const tail = b.joint(figure, -76, -132)
  b.cut(tail, oval(-82, -134, 10, 14), cream)
  const nearBack = b.leg(figure, -46, -108, 16, brown, 0, 0.4, { hoof: true })
  const legs = [
    b.leg(figure, -58, -108, 15, brown, Math.PI, 0.4, { dim: 0.25, hoof: true }),
    b.leg(figure, 56, -106, 15, brown, 0, 0.4, { dim: 0.25, hoof: true }),
    nearBack,
    b.leg(figure, 44, -106, 16, brown, Math.PI, 0.4, { hoof: true }),
  ]
  farBehind(figure, legs, 2)
  const body = b.joint(figure, 0, -122)
  b.cut(body, oval(-6, -124, 80, 36), brown)
  body.addChild(new Graphics().ellipse(-4, -98, 54, 10).fill(cream))
  const neck = b.joint(figure, 44, -134)
  b.cut(neck, (g) => g.moveTo(30, -140).quadraticCurveTo(40, -176, 60, -190).lineTo(86, -180).quadraticCurveTo(70, -156, 74, -122).closePath(), brown)
  neck.addChild(new Graphics().moveTo(70, -176).quadraticCurveTo(62, -150, 70, -120).lineTo(80, -128).quadraticCurveTo(74, -150, 84, -174).closePath().fill(cream))
  const head = b.joint(neck, 72, -186)
  const antler = (x: number, dim: number): Container => {
    const node = b.joint(head, x, -200)
    const stroke = { width: 7, color: brown, cap: 'round', join: 'round' } as const
    node.addChild(
      new Graphics()
        .moveTo(x, -200)
        .quadraticCurveTo(x - 14, -228, x - 36, -244)
        .moveTo(x - 10, -222)
        .lineTo(x - 2, -246)
        .moveTo(x - 24, -236)
        .lineTo(x - 22, -250)
        .moveTo(x - 4, -210)
        .lineTo(x + 12, -222)
        .stroke(stroke),
    )
    if (dim) node.addChild(new Graphics().moveTo(x, -200).quadraticCurveTo(x - 14, -228, x - 36, -244).stroke({ ...stroke, color: ink, alpha: dim }))
    return node
  }
  const antlerBack = antler(68, 0.25)
  const ear = b.joint(head, 64, -198)
  b.cut(ear, oval(54, -200, 13, 6), brown)
  b.cut(head, oval(80, -192, 27, 21), brown)
  const antlerFront = antler(84, 0)
  b.cut(head, oval(100, -184, 14, 11), cream)
  head.addChild(new Graphics().circle(111, -187, 5.5).fill(ink))
  const eyes = [b.eye(head, 74, -198, 8.5), b.eye(head, 92, -197, 8.5)]
  return {
    upper: [
      { node: tail, baseY: -132 },
      { node: body, baseY: -122 },
      { node: neck, baseY: -134 },
    ],
    drop: 72,
    body,
    neck: { node: neck, gain: 1.8 },
    head: { node: head, gain: 0.6 },
    ears: [
      { node: ear, rest: 0.25, up: -0.15, back: 0.7 },
      { node: antlerBack, rest: 0, up: -0.04, back: 0.06 },
      { node: antlerFront, rest: 0, up: -0.04, back: 0.06 },
    ],
    eyes,
    legs,
    tail: { node: tail, rest: 0 },
    scratch: { node: nearBack.node, angle: -0.9 },
    scratchTilt: 0.35,
  }
}

/** [SPEC-16.2.1] The snowy owl, seen from the front like the forest's owl: cream with ink specks,
 *  yellow eyes, an ink beak, cream feathered feet. */
function owl(b: Builder, figure: Container): Rig {
  const { cream, ink, yellow } = PALETTE
  const specks = (g: Graphics, spots: readonly [number, number][]): Graphics => {
    for (const [x, y] of spots) g.moveTo(x - 5, y - 2).quadraticCurveTo(x, y + 3, x + 5, y - 2)
    return g.stroke({ width: 3, color: ink, alpha: 0.75, cap: 'round' })
  }
  const tail = b.joint(figure, 0, -10)
  b.cut(tail, (g) => g.moveTo(-12, -14).lineTo(12, -14).lineTo(9, 6).quadraticCurveTo(0, 10, -9, 6).closePath(), cream)
  const body = b.joint(figure, 0, -54)
  b.cut(body, oval(0, -54, 44, 50), cream)
  body.addChild(
    specks(new Graphics(), [
      [-18, -70],
      [8, -76],
      [-4, -56],
      [20, -50],
      [-22, -38],
      [4, -32],
    ]),
  )
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
      cream,
    )
    node.addChild(
      specks(new Graphics(), [
        [42 * side, -68],
        [46 * side, -48],
        [40 * side, -30],
      ]),
    )
    return node
  }
  const wingLeft = wing(-1)
  const wingRight = wing(1)
  b.cut(figure, (g) => g.ellipse(-15, -3, 11, 6).ellipse(15, -3, 11, 6), cream)
  const head = b.joint(figure, 0, -96)
  // Small rounded tufts, which rise on alert.
  const tuft = (side: 1 | -1): Container => {
    const node = b.joint(head, 30 * side, -128)
    b.cut(node, (g) => g.moveTo(40 * side, -128).quadraticCurveTo(36 * side, -144, 22 * side, -134).closePath(), cream)
    return node
  }
  const tuftLeft = tuft(-1)
  const tuftRight = tuft(1)
  b.cut(head, oval(0, -108, 46, 34), cream)
  // Face disc: a faint ink ring around two circles.
  const r = 22
  const half = Math.sqrt(r * r - 17 * 17)
  const meet = Math.atan2(half, 17)
  head.addChild(
    new Graphics()
      .moveTo(0, -108 - half)
      .arc(-17, -108, r, -meet, meet, true)
      .arc(17, -108, r, Math.PI - meet, Math.PI + meet, true)
      .closePath()
      .stroke({ width: 3, color: ink, alpha: 0.2 }),
  )
  head.addChild(specks(new Graphics(), [[-26, -132], [24, -134], [0, -138]]))
  const eyes = [b.eye(head, -17, -108, 15, yellow, 8), b.eye(head, 17, -108, 15, yellow, 8)]
  head.addChild(new Graphics().moveTo(-6, -97).lineTo(6, -97).lineTo(0, -85).closePath().fill(ink))
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

/** [SPEC-16.2] Santa: red coat with cream fur and an ink belt, red trousers and ink boots, a cream
 *  beard, a skin face and a red hat with a cream pompom, its tip nodding like an ear. */
function santa(b: Builder, figure: Container): Rig {
  const { red, cream, ink, skin, yellow, brown } = PALETTE
  const backArm = b.joint(figure, -22, -146)
  b.cut(backArm, (g) => g.roundRect(-34, -150, 22, 62, 11), red, { dim: 0.22 })
  b.cut(backArm, (g) => g.circle(-23, -86, 11), brown, { dim: 0.22 })
  const nearBack = b.leg(figure, -14, -52, 24, red, 0, 0.4, { hoof: true })
  const legs = [b.leg(figure, 16, -52, 24, red, Math.PI, 0.4, { dim: 0.22, hoof: true }), nearBack]
  farBehind(figure, legs, 1)
  const body = b.joint(figure, 0, -100)
  b.cut(body, oval(0, -102, 56, 58), red)
  body.addChild(new Graphics().roundRect(-50, -60, 100, 18, 9).fill(cream))
  body.addChild(new Graphics().roundRect(30, -150, 14, 92, 7).fill(cream))
  body.addChild(new Graphics().rect(-56, -110, 112, 15).fill(ink).roundRect(22, -113, 20, 21, 4).fill(yellow))
  body.addChild(new Graphics().roundRect(26, -109, 12, 13, 3).fill(ink))
  const head = b.joint(figure, 20, -164)
  const hatTip = b.joint(head, -2, -200)
  b.cut(hatTip, (g) => g.moveTo(-4, -192).quadraticCurveTo(-20, -214, -40, -196).lineTo(-30, -186).closePath(), red)
  b.cut(hatTip, (g) => g.circle(-40, -196, 11), cream)
  b.cut(head, (g) => g.moveTo(-4, -186).quadraticCurveTo(20, -214, 50, -186).closePath(), red)
  b.cut(head, oval(24, -170, 26, 24), skin)
  // Beard and moustache, cream, in one outline under the face.
  b.cut(head, (g) => g.moveTo(2, -170).quadraticCurveTo(0, -130, 30, -118).quadraticCurveTo(52, -128, 50, -164).quadraticCurveTo(40, -150, 26, -150).quadraticCurveTo(10, -152, 2, -170).closePath(), cream)
  b.cut(head, (g) => g.roundRect(18, -162, 32, 11, 5.5), cream)
  b.cut(head, (g) => g.roundRect(-6, -194, 60, 14, 7), cream)
  head.addChild(new Graphics().circle(44, -164, 6).fill({ color: red, alpha: 0.65 }))
  const eyes = [b.eye(head, 18, -174, 7.5), b.eye(head, 36, -174, 7.5)]
  const frontArm = b.joint(figure, 26, -144)
  b.cut(frontArm, (g) => g.roundRect(16, -150, 24, 62, 12), red)
  b.cut(frontArm, (g) => g.roundRect(14, -98, 28, 12, 6), cream, { shadow: false })
  b.cut(frontArm, (g) => g.circle(28, -82, 12), brown)
  return {
    upper: [
      { node: backArm, baseY: -146 },
      { node: body, baseY: -100 },
      { node: head, baseY: -164 },
      { node: frontArm, baseY: -144 },
    ],
    drop: 30,
    body,
    head: { node: head, gain: 0.6 },
    ears: [{ node: hatTip, rest: 0, up: -0.15, back: 0.3 }],
    eyes,
    legs,
    scratch: { node: nearBack.node, angle: -0.5 },
    scratchTilt: 0.2,
    // Arms swing as he walks; « scratching », he strokes his beard.
    extra: (pose) => {
      const swing = 0.35 * Math.min(1, pose.stride) * Math.sin(pose.gait)
      backArm.rotation = -swing
      frontArm.rotation = swing - pose.scratch * (1.3 + 0.15 * Math.sin(pose.scratchPhase))
    },
  }
}

/** [SPEC-16.2] How to draw each character of winter. */
export const RIGS: Readonly<Record<AnimalId, RigFactory>> = {
  rabbit,
  squirrel,
  redFox: fox({ fur: PALETTE.orange, light: PALETTE.cream, nearLegs: PALETTE.ink, farLegs: PALETTE.brown, ear: PALETTE.ink, farDim: 0 }),
  whiteFox: fox({ fur: PALETTE.cream, light: PALETTE.cream, nearLegs: PALETTE.cream, farLegs: PALETTE.cream, ear: PALETTE.skin, farDim: 0.18 }),
  snowman,
  robin,
  elf,
  reindeer,
  owl,
  santa,
}
