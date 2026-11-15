// [SPEC-8.6] [SPEC-9.2] Geometry of the clearing, in world units, free of PixiJS so it can be
// tested. `clearing.ts` draws from these values; the world is drawn once and a screen only
// changes its scale and position (see src/silence/geometry.ts).
import { lobedBounds, type Ellipse, type Point, type Rect } from '../../silence/geometry'

/** [SPEC-8.6] Area the decor covers. It extends the safe zone on every side, so that any screen
 *  from 1:2 (portrait) to 4:1 shows decor and never an empty band. */
export const DECOR_BOUNDS: Rect = { x: -1500, y: -900, width: 4440, height: 2880 }

/** Top edge of the grass of the clearing. */
export const HORIZON_Y = 620

/** [SPEC-9.2] The five planes, back to front. Animals in the open are drawn between `nearTrees`
 *  and `foreground` (see `clearing.ts`). */
export const PLANES = ['sky', 'farTrees', 'ground', 'nearTrees', 'foreground'] as const
export type PlaneId = (typeof PLANES)[number]

export interface Tree {
  /** The trunk, from above the top of the screen down to its base on the grass. */
  trunk: Rect
  /** Base ellipse of the crown. */
  crown: Ellipse
}

/** Big tree on the left: the « arrière d'un arbre » hideout is behind its trunk. */
export const LEFT_TREE: Tree = {
  trunk: { x: 90, y: -300, width: 170, height: 1000 },
  crown: { x: 150, y: 30, rx: 280, ry: 250 },
}

/** Big tree on the right: it carries the high branch. Its base is further away than the left
 *  tree's, which leaves a strip of grass between it and the hollow log. */
export const RIGHT_TREE: Tree = {
  trunk: { x: 1250, y: -300, width: 150, height: 950 },
  crown: { x: 1340, y: 10, rx: 280, ry: 250 },
}

/** Width added on each side of a trunk at its base. */
export const ROOT_FLARE = 30

/** High branch of the right tree: centre line from the trunk to the tip, and its thickness. */
export const BRANCH = {
  from: { x: 1300, y: 406 },
  to: { x: 770, y: 392 },
  baseThickness: 48,
  tipThickness: 30,
} as const

/** Leaves at the tip of the high branch. */
export const BRANCH_LEAVES: Ellipse = { x: 800, y: 290, rx: 165, ry: 150 }

/** The bush: a dome standing on the grass at (x, y). */
export const BUSH: Ellipse = { x: 240, y: 1030, rx: 200, ry: 290 }

/** Mound of the burrow (a dome standing at (x, y)), its hole, and the rim of the hole: the
 *  burrow's slot shows only what is above the rim. */
export const BURROW = {
  mound: { x: 620, y: 762, rx: 150, ry: 128 },
  hole: { x: 620, y: 690, rx: 72, ry: 52 },
  rimY: 740,
} as const

/** Hollow log lying on the grass, its open end on the left, turned to the meadow: centre of the
 *  cut face, radii of the face and of the opening, length of the body. */
export const LOG = { x: 1080, y: 778, faceRx: 52, faceRy: 86, holeRx: 36, holeRy: 62, length: 290 } as const

export const SUN = { x: 530, y: 135, radius: 66 } as const

/** [SPEC-9.2] The five hideouts. */
export const HIDEOUT_IDS = ['bush', 'hollowLog', 'burrow', 'behindTree', 'highBranch'] as const
export type HideoutId = (typeof HIDEOUT_IDS)[number]

export interface Hideout {
  id: HideoutId
  /** Plane whose shape hides the animal. */
  plane: PlaneId
  /** Visible extent of the hideout's drawing. */
  footprint: Rect
  /**
   * Where a hidden animal stands. An animal added to the hideout's slot (see `clearing.ts`) and
   * lying entirely inside this rectangle is invisible. Its feet are on the bottom edge.
   */
  cover: Rect
  /** Spot just outside the hideout, on the side of the meadow, where an animal that comes out
   *  stands (feet position). An animal moves from the slot to the actors layer once it is clear
   *  of the hideout's shape. */
  exit: Point
}

/**
 * Covers are sized for the largest animal that may hide there, in world units: a lying fawn or
 * a hedgehog about 220×170 (bush), fox 230×150 (log), rabbit 110×150 (burrow), squirrel 120×140
 * (tree), owl 110×150 (branch).
 */
export const HIDEOUTS: Readonly<Record<HideoutId, Hideout>> = {
  // In front of everything, at the bottom left: the bush is the closest hideout.
  bush: {
    id: 'bush',
    plane: 'foreground',
    footprint: lobedBounds(BUSH, true),
    cover: { x: 110, y: 830, width: 260, height: 190 },
    exit: { x: 500, y: 1000 },
  },
  // The slot is masked to the opening and to what lies left of the cut face: an animal inside
  // the log, right of the opening, is invisible.
  hollowLog: {
    id: 'hollowLog',
    plane: 'ground',
    footprint: { x: LOG.x - LOG.faceRx, y: LOG.y - LOG.faceRy, width: LOG.faceRx + LOG.length + 40, height: 2 * LOG.faceRy },
    cover: { x: LOG.x + LOG.holeRx, y: 705, width: 250, height: 150 },
    exit: { x: 960, y: 865 },
  },
  // The slot is masked above the rim of the hole: an animal entirely below the rim is
  // underground, hence invisible.
  burrow: {
    id: 'burrow',
    plane: 'ground',
    footprint: { x: BURROW.mound.x - BURROW.mound.rx, y: BURROW.mound.y - BURROW.mound.ry, width: 2 * BURROW.mound.rx, height: BURROW.mound.ry },
    cover: { x: BURROW.hole.x - BURROW.hole.rx, y: BURROW.rimY, width: 2 * BURROW.hole.rx, height: 200 },
    exit: { x: BURROW.hole.x, y: 805 },
  },
  // Behind the trunk of the left tree, at its base.
  behindTree: {
    id: 'behindTree',
    plane: 'nearTrees',
    footprint: { x: 60, y: 300, width: 230, height: 400 },
    cover: { x: 105, y: 520, width: 140, height: 170 },
    exit: { x: 320, y: 705 },
  },
  // In the leaves at the tip of the high branch. The animal stands on the branch, inside the
  // leaves; it comes out along the branch, towards the trunk.
  highBranch: {
    id: 'highBranch',
    plane: 'nearTrees',
    footprint: lobedBounds(BRANCH_LEAVES, false),
    cover: { x: 700, y: 200, width: 200, height: 177 },
    exit: { x: 1010, y: 378 },
  },
}

/** Open grass in the middle of the safe zone, kept free of hideouts: the animals settle here
 *  (feet positions) [SPEC-9.3]. */
export const MEADOW: Rect = { x: 520, y: 800, width: 490, height: 240 }
