// [SPEC-8.6] [SPEC-9.8] World geometry shared by the activities of silence, free of PixiJS so it
// can be tested. A world is drawn once in world units; a screen only changes its scale and
// position.
//
// World origin: top-left corner of the safe zone. y grows downwards.

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** An ellipse, or the upper half of one when it is a dome standing on its centre line. */
export interface Ellipse {
  x: number
  y: number
  rx: number
  ry: number
}

/** [SPEC-8.6] 4:3 central zone, always fully visible: the hideouts and the open meadow lie in it. */
export const SAFE_ZONE: Rect = { x: 0, y: 0, width: 1440, height: 1080 }

/** Leafy shapes are lobed: each lobe bulges out of the base ellipse by up to this fraction of
 *  its radius. The base ellipse itself is always covered (see `lobed` in paper.ts). */
export const LOBE_BULGE = 0.1

/** Extent of a lobed ellipse, lobes included; a dome is the upper half, standing on `e.y`. */
export function lobedBounds(e: Ellipse, dome: boolean): Rect {
  const rx = e.rx * (1 + LOBE_BULGE)
  const ry = e.ry * (1 + LOBE_BULGE)
  return { x: e.x - rx, y: e.y - ry, width: 2 * rx, height: dome ? ry : 2 * ry }
}

export interface Viewport {
  /** World units to screen pixels, the same on both axes: no deformation. */
  scale: number
  /** Screen position of the world origin. */
  offsetX: number
  offsetY: number
  /** Part of the world visible on the screen. */
  visible: Rect
}

/**
 * [SPEC-8.6] Fits the safe zone in a screen of the given size, centred, and lets the decor fill
 * the rest. Wider screens show more decor on the sides, taller ones above and below.
 */
export function viewport(screenWidth: number, screenHeight: number): Viewport {
  const scale = Math.min(screenWidth / SAFE_ZONE.width, screenHeight / SAFE_ZONE.height)
  const width = screenWidth / scale
  const height = screenHeight / scale
  const visible: Rect = {
    x: SAFE_ZONE.x + (SAFE_ZONE.width - width) / 2,
    y: SAFE_ZONE.y + (SAFE_ZONE.height - height) / 2,
    width,
    height,
  }
  return { scale, offsetX: -visible.x * scale, offsetY: -visible.y * scale, visible }
}

/** True when `inner` lies inside `outer`, `margin` away from its edges. */
export function contains(outer: Rect, inner: Rect, margin = 0): boolean {
  return (
    inner.x >= outer.x + margin &&
    inner.y >= outer.y + margin &&
    inner.x + inner.width <= outer.x + outer.width - margin &&
    inner.y + inner.height <= outer.y + outer.height - margin
  )
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** True when the four corners of `rect` lie inside the ellipse, scaled by `fraction`. */
export function insideEllipse(rect: Rect, e: Ellipse, fraction = 1): boolean {
  return [rect.x, rect.x + rect.width].every((x) =>
    [rect.y, rect.y + rect.height].every((y) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= fraction ** 2),
  )
}
