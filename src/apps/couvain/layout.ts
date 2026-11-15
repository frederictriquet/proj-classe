// [SPEC-8.6] [SPEC-14.2] [SPEC-14.3] Geometry of the incubator (« Couvain du silence »), in world
// units, free of PixiJS so it can be tested. `incubator.ts` draws from these values; the world is
// drawn once and a screen only changes its scale and position (see src/silence/geometry.ts).
import type { Extent } from '../../silence/animal'
import type { Ellipse, Point, Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** [SPEC-14.3] The planes of the incubator, back to front. Chicks in the open (`decor.actors`) are
 *  drawn in front of `eggs` and behind `lamps` and `foreground`. */
export const PLANES = ['back', 'straw', 'feeder', 'eggs', 'lamps', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

/** [SPEC-14.3] [SPEC-14.4] The wooden brooder crate seen from the front: top rim over which the
 *  mother hen peeks during the reward, inner side walls, top of the straw bed, and front lip. */
export const CRATE = {
  rimY: 150,
  rimHeight: 36,
  wallLeft: 48,
  wallRight: 1392,
  postWidth: 38,
  strawTopY: 470,
  frontLipY: 1046,
} as const

/** [SPEC-14.3] Hanging heat lamps suspended above the straw, and the warm zones their halos bathe
 *  on the straw below [SPEC-14.2.3]. The space between them at the top rim stays clear for the
 *  mother hen of the reward [SPEC-14.4]. */
export interface HeatLamp {
  id: 'left' | 'right'
  x: number
  /** Pivot of the cord at the top of the safe zone. */
  cordTopY: number
  socketTopY: number
  shadeTopY: number
  shadeBottomY: number
  shadeTopRx: number
  shadeBottomRx: number
  /** Center and radii of the warm pool on the straw floor. */
  haloFloor: Ellipse
  /** [SPEC-14.2.3] [SPEC-14.3] Warm zone under the lamp where chicks settle to sleep and rest. */
  warmZone: Rect
}

export const LAMPS: readonly HeatLamp[] = [
  {
    id: 'left',
    x: 500,
    cordTopY: 0,
    socketTopY: 132,
    shadeTopY: 166,
    shadeBottomY: 256,
    shadeTopRx: 34,
    shadeBottomRx: 108,
    haloFloor: { x: 495, y: 695, rx: 162, ry: 76 },
    warmZone: { x: 335, y: 605, width: 330, height: 195 },
  },
  {
    id: 'right',
    x: 940,
    cordTopY: 0,
    socketTopY: 132,
    shadeTopY: 166,
    shadeBottomY: 256,
    shadeTopRx: 34,
    shadeBottomRx: 108,
    haloFloor: { x: 945, y: 695, rx: 162, ry: 76 },
    warmZone: { x: 775, y: 605, width: 330, height: 195 },
  },
]

/** [SPEC-14.3] Small wooden feeder filled with seeds in the front middle of the incubator, and the
 *  zone around it where chicks gather to peck [SPEC-14.2.3]. */
export const FEEDER = {
  body: { x: 600, y: 815, width: 240, height: 60 },
  rim: 10,
  zone: { x: 485, y: 755, width: 470, height: 265 },
} as const

/** [SPEC-14.3] The four cosy straw nests in the corners of the safe zone, leaving the warm zones
 *  under the lamps and the area in front of the feeder completely clear. */
export interface StrawNest extends Ellipse {
  id: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
}

export const NESTS: readonly StrawNest[] = [
  { id: 'topLeft', x: 248, y: 555, rx: 196, ry: 62 },
  { id: 'topRight', x: 1192, y: 555, rx: 196, ry: 62 },
  { id: 'bottomLeft', x: 248, y: 960, rx: 196, ry: 62 },
  { id: 'bottomRight', x: 1192, y: 960, rx: 196, ry: 62 },
]

/** [SPEC-14.2] [SPEC-14.3] Radii of an egg: width 72, height 92 in world units (~8.5% of the safe
 *  zone height), large enough to read from the back of the classroom [SPEC-8.2]. */
export const EGG_SIZE = { rx: 36, ry: 46 } as const

export const EGG_IDS = [
  'egg1',
  'egg2',
  'egg3',
  'egg4',
  'egg5',
  'egg6',
  'egg7',
  'egg8',
  'egg9',
  'egg10',
  'egg11',
  'egg12',
  'egg13',
  'egg14',
  'egg15',
  'egg16',
  'egg17',
  'egg18',
  'egg19',
  'egg20',
] as const
export type EggId = (typeof EGG_IDS)[number]

/** [SPEC-14.2.2] How the egg's cap and shell behave after the first hatching. */
export type CapVariant = 'lid' | 'hat' | 'cartoon'

export interface EggHideout {
  id: EggId
  /** Index of the nest in `NESTS` (0 to 3). */
  nest: number
  /** Base point of the egg in the straw (bottom of the shell). */
  x: number
  y: number
  /** Bounding box of the whole egg shell. */
  footprint: Rect
  /** Where the crouched hidden chick sits inside the egg, between the back and front of the shell. */
  cover: Rect
  /** Spot just outside the egg where a chick coming out steps onto the straw. */
  exit: Point
  /** [SPEC-14.2.2] One of the three cap behaviours after hatching. */
  variant: CapVariant
}

/** Bounding box of an egg standing on `(x, y)`. */
export function eggBox(pos: Point): Rect {
  return {
    x: pos.x - EGG_SIZE.rx,
    y: pos.y - 2 * EGG_SIZE.ry,
    width: 2 * EGG_SIZE.rx,
    height: 2 * EGG_SIZE.ry,
  }
}

const NEST_EGG_OFFSETS: readonly (readonly [number, number])[] = [
  [-152, -16],
  [-76, 20],
  [0, -20],
  [76, 20],
  [152, -14],
]

const VARIANTS: readonly CapVariant[] = ['lid', 'hat', 'cartoon']

/** [SPEC-14.2] [SPEC-14.3] The twenty eggs, five in each of the four nests. Within a nest, horizontal
 *  spacing is 76 units (> 2 * EGG_SIZE.rx = 72) so no two eggs ever overlap. */
export const EGGS: readonly EggHideout[] = NESTS.flatMap((nest, nestIndex) =>
  NEST_EGG_OFFSETS.map(([dx, dy], i): EggHideout => {
    const index = nestIndex * 5 + i
    const id = EGG_IDS[index]!
    const x = nest.x + dx
    const y = nest.y + dy
    const footprint = eggBox({ x, y })
    // Top nests exit downwards into the incubator floor; bottom nests exit upwards.
    const exitY = nestIndex < 2 ? y + 28 : y - 2 * EGG_SIZE.ry - 14
    return {
      id,
      nest: nestIndex,
      x,
      y,
      footprint,
      cover: { x: x - 28, y: y - 74, width: 56, height: 68 },
      exit: { x, y: exitY },
      variant: VARIANTS[index % VARIANTS.length]!,
    }
  }),
)

/** Keyed by `EggId` for quick lookup, as in `ferme/layout.ts` and `ruche/layout.ts`. */
export const HIDEOUTS: Readonly<Record<EggId, EggHideout>> = Object.fromEntries(
  EGGS.map((egg) => [egg.id, egg]),
) as Record<EggId, EggHideout>

/** [SPEC-14.2] Size budget of a standing chick around its feet, facing right, paper shadow excluded. */
export const CHICK_EXTENT: Extent = { left: -38, right: 42, top: -78 }

export type PlaceZone = 'lamp' | 'feeder' | 'straw'

export interface Place extends Point {
  /** [SPEC-14.2.3] Where the chick settles: under a heat lamp, by the feeder, or in the straw. */
  zone: PlaceZone
  /** Facing once settled: towards the middle of its group or of the incubator. */
  facing: 1 | -1
}

/**
 * [SPEC-14.2.3] [SPEC-14.3] Twenty places where the chicks settle: eight in the warm zones under
 * the two heat lamps, six around the feeder, and six in the open straw between the nests.
 */
export const PLACES: readonly Place[] = [
  // 8 places under the two heat lamps (4 under the left lamp, 4 under the right lamp)
  { zone: 'lamp', x: 385, y: 695, facing: 1 },
  { zone: 'lamp', x: 485, y: 688, facing: 1 },
  { zone: 'lamp', x: 585, y: 695, facing: -1 },
  { zone: 'lamp', x: 440, y: 788, facing: 1 },
  { zone: 'lamp', x: 855, y: 695, facing: 1 },
  { zone: 'lamp', x: 955, y: 688, facing: -1 },
  { zone: 'lamp', x: 1055, y: 695, facing: -1 },
  { zone: 'lamp', x: 1000, y: 788, facing: -1 },
  // 6 places around the feeder
  { zone: 'feeder', x: 540, y: 875, facing: 1 },
  { zone: 'feeder', x: 900, y: 875, facing: -1 },
  { zone: 'feeder', x: 600, y: 975, facing: 1 },
  { zone: 'feeder', x: 685, y: 990, facing: 1 },
  { zone: 'feeder', x: 775, y: 990, facing: -1 },
  { zone: 'feeder', x: 860, y: 975, facing: -1 },
  // 6 places in the open straw around the eggs
  { zone: 'straw', x: 525, y: 565, facing: 1 },
  { zone: 'straw', x: 650, y: 555, facing: 1 },
  { zone: 'straw', x: 790, y: 555, facing: -1 },
  { zone: 'straw', x: 915, y: 565, facing: -1 },
  { zone: 'straw', x: 160, y: 770, facing: 1 },
  { zone: 'straw', x: 1280, y: 770, facing: -1 },
]
