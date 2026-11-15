// [SPEC-8.1] [SPEC-8.2] [SPEC-8.3] [SPEC-9.3] [SPEC-9.8] [SPEC-13] [SPEC-14.2] [SPEC-14.5]
// The rigs of the twenty chicks of « Couvain du silence », drawn in code in the paper cut-out
// style of the incubator with the shared builder (src/silence/rig.ts): separate pieces (round body,
// head, beak, big eyes, wings, legs, tuft of down) animated by the shared animal model, in the four
// plumage variants of the brood palette (yellow, russet/terracotta, brown, cream).
//
// Coordinates are world units, relative to the point between the feet, the chick facing right.
import { Container, Graphics } from 'pixi.js'
import { oval, type Builder, type Rig, type RigFactory } from '../../silence/rig'
import { ANIMAL_IDS, CHICK_COLORS, type AnimalId, type ChickColor } from './animal-data'
import { PALETTE } from './palette'

/** Puts the far leg behind the near one, under the body. */
function farBehind(figure: Container, legs: Rig['legs'], far: number): void {
  const near = legs[far]!
  for (const leg of legs.slice(0, far)) figure.addChildAt(leg.node, figure.getChildIndex(near.node))
}

interface ChickStyle {
  coat: string
  belly: string
  beak: string
  legs: string
  eyeRim?: string
}

/** [SPEC-14.2] [SPEC-14.5] Palette colours of each chick variant, keeping beaks, legs and eyes
 *  clearly contrasted against the plumage and the straw (see `palette.test.ts`). */
const STYLES: Readonly<Record<ChickColor, ChickStyle>> = {
  yellow: {
    coat: PALETTE.yellow,
    belly: PALETTE.cream,
    beak: PALETTE.terracotta,
    legs: PALETTE.terracotta,
  },
  terracotta: {
    coat: PALETTE.terracotta,
    belly: PALETTE.amber,
    beak: PALETTE.yellow,
    legs: PALETTE.brown,
  },
  brown: {
    coat: PALETTE.brown,
    belly: PALETTE.wood,
    beak: PALETTE.amber,
    legs: PALETTE.terracotta,
  },
  cream: {
    coat: PALETTE.cream,
    belly: PALETTE.yellow,
    beak: PALETTE.terracotta,
    legs: PALETTE.terracotta,
    eyeRim: PALETTE.brown,
  },
}

/** Draws one chick in separate pieces (legs, tail puff, round body, wing, head, tuft of down,
 *  beak, big round eye) in the given `color` variant [SPEC-14.2]. */
export function chickRig(color: ChickColor): RigFactory {
  const style = STYLES[color]
  return (b: Builder, figure: Container): Rig => {
    const { coat, belly, beak: beakColor, legs: legColor, eyeRim } = style

    // 1. Two short legs with little toes, far leg slightly darkened with ink.
    const makeLeg = (x: number, phase: number, dim?: number) => {
      const leg = b.leg(figure, x, -18, 5.5, legColor, phase, 0.6, { dim })
      b.cut(leg.node, oval(x + 2, -2.5, 6, 2.8), legColor, { shadow: false, dim })
      return leg
    }
    const legs = [makeLeg(5, Math.PI, 0.22), makeLeg(-4, 0)]
    farBehind(figure, legs, 1)

    // 2. Small fluffy tail puff at the back of the body.
    const tail = b.joint(figure, -18, -35)
    b.cut(
      tail,
      (g) =>
        g
          .moveTo(-14, -30)
          .quadraticCurveTo(-28, -32, -26, -41)
          .quadraticCurveTo(-21, -46, -15, -42)
          .quadraticCurveTo(-22, -50, -14, -50)
          .quadraticCurveTo(-8, -45, -10, -34)
          .closePath(),
      coat,
    )

    // 3. Plump round baby-chick body with a soft warm breast patch.
    const body = b.joint(figure, -1, -33)
    b.cut(body, oval(-1, -33, 21, 18), coat)
    body.addChild(new Graphics().ellipse(4, -30, 13, 11).fill({ color: belly, alpha: 0.38 }))

    // 4. Separate small round wing hung on the side of the body.
    const wing = b.joint(body, -4, -36)
    b.cut(
      wing,
      (g) =>
        g
          .moveTo(-4, -43)
          .quadraticCurveTo(10, -41, 8, -30)
          .quadraticCurveTo(4, -22, -12, -26)
          .quadraticCurveTo(-20, -30, -15, -39)
          .quadraticCurveTo(-11, -44, -4, -43)
          .closePath(),
      coat,
    )
    wing.addChild(
      new Graphics()
        .moveTo(-12, -29)
        .quadraticCurveTo(-2, -26, 5, -31)
        .stroke({ width: 2.5, color: PALETTE.ink, alpha: 0.16, cap: 'round' }),
    )

    // 5. Big round head, with its tuft of down, beak and big eye.
    const head = b.joint(figure, 9, -51)

    // Tuft of down (`touffe de duvet`) on top of the head, moved like ears on alert / peeking / sleep.
    const tuft = b.joint(head, 9, -65)
    b.cut(
      tuft,
      (g) =>
        g
          .moveTo(4, -63)
          .quadraticCurveTo(1, -73, 7, -74)
          .quadraticCurveTo(10, -70, 10, -65)
          .quadraticCurveTo(14, -74, 19, -72)
          .quadraticCurveTo(18, -65, 13, -63)
          .closePath(),
      coat,
    )

    // Short triangular beak (`bec`) on its own joint so it nods slightly when pecking seeds.
    const beak = b.joint(head, 22, -51)
    b.cut(
      beak,
      (g) =>
        g
          .moveTo(21, -56)
          .quadraticCurveTo(29, -54, 32, -50)
          .quadraticCurveTo(28, -46, 21, -46)
          .closePath(),
      beakColor,
    )

    // Round head shape.
    b.cut(head, oval(9, -52, 16, 15), coat)
    head.addChild(new Graphics().ellipse(15, -47, 4.5, 3).fill({ color: belly, alpha: 0.45 }))

    // Big expressive round eye (`yeux`).
    const eye = b.eye(head, 14, -54, 6.2)
    if (eyeRim) {
      eye.open.addChildAt(new Graphics().circle(0, 0, eye.radius + 1.5).fill(eyeRim), 0)
    }

    return {
      upper: [
        { node: tail, baseY: -35 },
        { node: body, baseY: -33 },
        { node: head, baseY: -51 },
      ],
      drop: 12,
      body,
      head: { node: head, gain: 1.15 },
      ears: [{ node: tuft, rest: 0, up: -0.18, back: 0.35 }],
      eyes: [eye],
      legs: [
        { ...legs[0]!, follow: 0 },
        { ...legs[1]!, follow: 0 },
      ],
      tail: { node: tail, rest: 0 },
      // Scratching the straw with the near foot.
      scratch: { node: legs[1]!.node, angle: -0.75 },
      scratchTilt: 0.25,
      extra(pose) {
        // When crouched inside the egg (`pose.shadow === 0`), tuck the head and tail in slightly so
        // the whole chick and its paper shadows sit well inside the closed eggshell silhouette.
        const eggTuck = (1 - pose.shadow) * Math.max(0, (pose.crouch - 0.3) / 0.7)
        tail.x = -18 + 6 * eggTuck
        head.x = 9 - 6 * eggTuck
        // Little wing flutters slightly when walking/fleeing or scratching, and lifts on alert.
        wing.rotation =
          -0.12 * pose.eyeWide -
          0.18 * pose.scratch * (0.5 + 0.5 * Math.sin(pose.scratchPhase)) -
          0.1 * pose.stride * Math.abs(Math.sin(pose.gait))
        // Beak twitches slightly when pecking seeds (`chew`).
        beak.rotation = pose.chew * 1.4
      },
    }
  }
}

/** [SPEC-14.2] How to draw each of the twenty chicks of the brood. */
export const RIGS: Readonly<Record<AnimalId, RigFactory>> = Object.fromEntries(
  ANIMAL_IDS.map((id) => [id, chickRig(CHICK_COLORS[id])]),
) as Record<AnimalId, RigFactory>
