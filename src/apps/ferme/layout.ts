// [SPEC-8.6] [SPEC-12.3] Geometry of the farmyard, in world units, free of PixiJS so it can be
// tested. `farmyard.ts` draws from these values; the world is drawn once and a screen only
// changes its scale and position (see src/silence/geometry.ts).
import { lobedBounds, type Ellipse, type Point, type Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** Top edge of the grass of the yard, at the foot of the hills. */
export const HORIZON_Y = 520

/** [SPEC-12.3] The five planes, back to front. Animals in the open are drawn between `buildings`
 *  and `foreground` (see `farmyard.ts`). */
export const PLANES = ['sky', 'hills', 'ground', 'buildings', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

export const SUN = { x: 1270, y: 110, radius: 58 } as const

/** [SPEC-12.4] Centre and radii of the rainbow: it rises over the hills, behind the buildings. */
export const RAINBOW = { x: 720, y: 600, inner: 430, band: 34 } as const

/** Red barn on the left, facing the yard: its wall, the top of its gable roof and its big door,
 *  open on a dark inside. The horse and the cow wait inside, left of the door. */
export const BARN = {
  wall: { x: 20, y: 330, width: 600, height: 330 },
  roofTop: 150,
  /** Roof overhang beyond the wall on each side. */
  eaves: 30,
  door: { x: 310, y: 400, width: 290, height: 260 },
} as const

/** Henhouse on stilts, at the back on the right: body, roof top, small door on the left side of
 *  its front, stilts down to the grass, and the ramp from the door sill down to the yard. */
export const HENHOUSE = {
  body: { x: 960, y: 320, width: 200, height: 140 },
  roofTop: 252,
  door: { x: 980, y: 348, width: 64, height: 112 },
  stiltBase: 580,
  ramp: { from: { x: 982, y: 460 }, to: { x: 850, y: 582 } },
} as const

/** Pigsty on the right: a hut with a red roof behind a fence of planks. The pig waits behind the
 *  fence and comes out by its left end. */
export const STY = {
  fence: { x: 1185, y: 565, width: 255, height: 140 },
  hut: { x: 1235, y: 470, width: 200, height: 130 },
} as const

/** Mud in front of the pigsty: the pig settles on it, not on the grass [SPEC-12.5]. */
export const MUD: Ellipse = { x: 1050, y: 815, rx: 135, ry: 42 }

/** The pond, at the front on the right; the duck settles on it. */
export const POND: Ellipse = { x: 1160, y: 992, rx: 240, ry: 70 }

/** [SPEC-12.2] Foreground hideouts, closest to the children: the haystack (a dome of lobed hay),
 *  the cabbages of the vegetable garden (domes) and the clump of reeds by the pond (a dome). */
export const HAYSTACK: Ellipse = { x: 215, y: 1078, rx: 215, ry: 300 }
export const CABBAGES: readonly Ellipse[] = [
  { x: 690, y: 1088, rx: 80, ry: 150 },
  { x: 800, y: 1092, rx: 94, ry: 200 },
  { x: 910, y: 1088, rx: 78, ry: 140 },
]
export const REEDS: Ellipse = { x: 1380, y: 1080, rx: 128, ry: 165 }

/** [SPEC-12.2] The six hideouts. */
export const HIDEOUT_IDS = ['henhouse', 'barn', 'garden', 'haystack', 'sty', 'reeds'] as const
export type HideoutId = (typeof HIDEOUT_IDS)[number]

/** The hideouts of the buildings, which have a slot: the others hide the animals of the actors
 *  layer behind a shape of the foreground. */
export const SLOT_HIDEOUT_IDS = ['henhouse', 'barn', 'sty'] as const satisfies readonly HideoutId[]
export type SlotHideoutId = (typeof SLOT_HIDEOUT_IDS)[number]

export interface Hideout {
  id: HideoutId
  /** Plane whose shape hides the animal. */
  plane: PlaneId
  /** Visible extent of the hideout's drawing. */
  footprint: Rect
  /**
   * Where a hidden animal stands. An animal lying entirely inside this rectangle is invisible,
   * in the hideout's slot or behind a shape of the foreground. Its feet are on the bottom edge.
   */
  cover: Rect
  /** Spot just outside the hideout, on the side of the yard, where an animal that comes out
   *  stands (feet position). An animal moves from the slot to the actors layer once it is clear
   *  of the hideout's shape. */
  exit: Point
}

/** Extent of a group of domes standing on their centre lines, lobes included. */
function domesBounds(domes: readonly Ellipse[]): Rect {
  const boxes = domes.map((d) => lobedBounds(d, true))
  const left = Math.min(...boxes.map((b) => b.x))
  const top = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Covers are sized for the largest animal that may hide there, in world units: horse and cow
 * about 270×255 (barn), hen 100×100 (henhouse), lying rabbit 95×125 (garden), sheep 160×115
 * and goat 155×160 (haystack), pig 195×95 (sty), duck 115×95 (reeds).
 */
export const HIDEOUTS: Readonly<Record<HideoutId, Hideout>> = {
  // Inside the body, right of the door. The slot is masked to the door, to what lies left of it
  // and to what lies below the body: an animal inside, right of the door, is invisible.
  henhouse: {
    id: 'henhouse',
    plane: 'buildings',
    footprint: { x: HENHOUSE.ramp.to.x, y: HENHOUSE.roofTop, width: HENHOUSE.body.x + HENHOUSE.body.width + 20 - HENHOUSE.ramp.to.x, height: HENHOUSE.stiltBase - HENHOUSE.roofTop },
    cover: { x: 1052, y: 342, width: 104, height: 110 },
    exit: { x: 850, y: 595 },
  },
  // Inside the barn, left of the door. The slot is masked to the door and to what lies below the
  // wall: an animal inside, left of the door, is invisible.
  barn: {
    id: 'barn',
    plane: 'buildings',
    footprint: { x: BARN.wall.x - BARN.eaves, y: BARN.roofTop, width: BARN.wall.width + 2 * BARN.eaves, height: BARN.wall.y + BARN.wall.height - BARN.roofTop },
    cover: { x: 20, y: 398, width: 285, height: 254 },
    exit: { x: 445, y: 745 },
  },
  // Behind the cabbages of the foreground, lying.
  garden: {
    id: 'garden',
    plane: 'foreground',
    footprint: domesBounds(CABBAGES),
    cover: { x: 745, y: 950, width: 100, height: 98 },
    exit: { x: 760, y: 865 },
  },
  // Behind the haystack of the foreground.
  haystack: {
    id: 'haystack',
    plane: 'foreground',
    footprint: domesBounds([HAYSTACK]),
    cover: { x: 105, y: 860, width: 230, height: 187 },
    exit: { x: 470, y: 1000 },
  },
  // Behind the fence of the pigsty, in front of the hut.
  sty: {
    id: 'sty',
    plane: 'buildings',
    footprint: { x: STY.fence.x, y: STY.hut.y - 60, width: STY.fence.width, height: STY.fence.y + STY.fence.height - (STY.hut.y - 60) },
    cover: { x: 1225, y: 600, width: 190, height: 96 },
    exit: { x: 1080, y: 760 },
  },
  // Behind the clump of reeds of the foreground, by the pond.
  reeds: {
    id: 'reeds',
    plane: 'foreground',
    footprint: domesBounds([REEDS]),
    cover: { x: 1305, y: 950, width: 113, height: 98 },
    exit: { x: 1235, y: 1012 },
  },
}

/** Grass of the yard kept free of hideouts and buildings: most animals settle here (feet
 *  positions) [SPEC-12.3]. The pig settles on the mud, the duck on the pond, the goat on top of
 *  the haystack. */
export const YARD: Rect = { x: 460, y: 680, width: 520, height: 190 }
