import { describe, expect, it } from 'vitest'
import { contains, intersects, SAFE_ZONE, type Rect } from '../../silence/geometry'
import { depthCrossings, drawingBox, restingPoints } from '../../silence/overlap'
import { ANIMAL_IDS, ANIMALS, SNOWMAN_HAT_TOP, SNOWMAN_PLACE, type AnimalId } from './animal-data'
import { BIG_DRIFT, BUSH, DRIFT, firHalfWidth, HIDEOUT_IDS, HIDEOUTS, HOUSE, ROBIN_NEST, ROCK, TREE, trunkAt } from './layout'

/** Box of a character at a point of its path, facing `facing`. */
const boxAt = (id: AnimalId, i: number, facing?: 1 | -1): Rect => {
  const spec = ANIMALS[id]
  const p = spec.path[i]!
  return drawingBox(spec, p.x, p.y, facing, p.height ?? 0)
}
const placeBox = (id: AnimalId): Rect => {
  const p = restingPoints(ANIMALS[id])[0]!
  return drawingBox(ANIMALS[id], p.x, p.y, p.facing, p.height)
}
/** Top of a dome standing on its centre line at `x` (its base when `x` is off the dome). */
const domeTop = (d: { x: number; y: number; rx: number; ry: number }, x: number): number => d.y - d.ry * Math.sqrt(Math.max(0, 1 - ((x - d.x) / d.rx) ** 2))

describe('characters [SPEC-16.2]', () => {
  it('come out from the least to the most timid, the robin right after the snowman [SPEC-9.4.1] [SPEC-16.2.2]', () => {
    expect(ANIMAL_IDS).toEqual(['rabbit', 'squirrel', 'redFox', 'whiteFox', 'snowman', 'robin', 'elf', 'reindeer', 'owl', 'gingerbread', 'santa'])
  })

  it('use the nine hideouts; the Christmas tree is shared by the robin and the elf, the house by the gingerbread man and Santa', () => {
    const used = ANIMAL_IDS.map((id) => ANIMALS[id].hideout)
    expect(new Set(used)).toEqual(new Set(HIDEOUT_IDS))
    expect(used.filter((h, i) => used.indexOf(h) !== i)).toEqual(['fir', 'house'])
  })

  it.each(ANIMAL_IDS)('%s: path and place lie in the safe zone [SPEC-8.6]', (id) => {
    const spec = ANIMALS[id]
    expect(spec.id).toBe(id)
    expect(0 < spec.peekIndex && spec.peekIndex < spec.exitIndex && spec.exitIndex < spec.path.length).toBe(true)
    for (const [i, p] of spec.path.entries()) expect(contains(SAFE_ZONE, boxAt(id, i), 0), `${p.x},${p.y}`).toBe(true)
    expect(contains(SAFE_ZONE, placeBox(id), 20)).toBe(true)
    for (const p of spec.path) {
      expect(p.crouch).toBeGreaterThanOrEqual(0)
      expect(p.crouch).toBeLessThanOrEqual(1)
    }
  })

  it.each(ANIMAL_IDS)('%s: hides inside the cover of its hideout', (id) => {
    const spec = ANIMALS[id]
    // The robin hides higher in the Christmas tree than the elf.
    const cover = id === 'robin' ? ROBIN_NEST : HIDEOUTS[spec.hideout].cover
    const hidden = spec.path[0]!
    // Lying characters are lower than their standing extent: the shared model lowers their upper
    // pieces by their rig's drop (checked on screen in the gallery); here only their feet and width.
    const box = drawingBox(spec, hidden.x, hidden.y, spec.hideFacing, hidden.height ?? 0)
    expect(box.x, 'left').toBeGreaterThanOrEqual(cover.x)
    expect(box.x + box.width, 'right').toBeLessThanOrEqual(cover.x + cover.width)
    expect(hidden.y - (hidden.height ?? 0), 'feet').toBeLessThanOrEqual(cover.y + cover.height)
    if (hidden.crouch === 0) expect(box.y, 'top').toBeGreaterThanOrEqual(cover.y)
  })

  // [SPEC-16.2.2] The robin perches on the top of the snowman's hat, drawn in front of him.
  it('robin perches on the hat of the snowman, just in front of him', () => {
    const place = ANIMALS.robin.path.at(-1)!
    expect(place.x).toBe(SNOWMAN_PLACE.x)
    expect(place.y).toBeGreaterThan(SNOWMAN_PLACE.y)
    expect(place.y - (place.height ?? 0)).toBe(SNOWMAN_PLACE.y - SNOWMAN_HAT_TOP)
    expect(ANIMALS.snowman.path.at(-1)).toMatchObject(SNOWMAN_PLACE)
    expect(ANIMALS.snowman.sleepCrouch + ANIMALS.snowman.grazeCrouch).toBe(0)
  })

  // [SPEC-16.3] Slot hideouts: at the exit point the character lies clear of the shape that hid
  // it, or inside the opening its slot shows, so that changing layer shows no jump (the gallery
  // measures it on screen).
  it('peeks and exits where the slot shows the character', () => {
    // Squirrel: wholly inside the hollow at the exit.
    expect(contains(TREE.hollow, boxAt('squirrel', ANIMALS.squirrel.exitIndex, 1))).toBe(true)
    // Santa and the gingerbread man: inside the door or below the wall at the exit.
    for (const id of ['santa', 'gingerbread'] as const) {
      const box = boxAt(id, ANIMALS[id].exitIndex, -1)
      expect(box.x, id).toBeGreaterThanOrEqual(HOUSE.door.x)
      expect(box.x + box.width, id).toBeLessThanOrEqual(HOUSE.door.x + HOUSE.door.width)
      expect(box.y, id).toBeGreaterThanOrEqual(HOUSE.door.y)
    }
    // White fox: clear of the rock body, the slab and the icicles at the exit; at the peek, below
    // the icicles [SPEC-16.5.1].
    const fox = boxAt('whiteFox', ANIMALS.whiteFox.exitIndex, 1)
    expect(fox.x).toBeGreaterThan(ROCK.body.x + ROCK.body.width)
    expect(fox.y).toBeGreaterThan(ROCK.icicles.bottom)
    expect(boxAt('whiteFox', ANIMALS.whiteFox.peekIndex, 1).y).toBeGreaterThan(ROCK.icicles.bottom)
    // Snowy owl: clear of the trunk at the exit.
    const owl = boxAt('owl', ANIMALS.owl.exitIndex)
    expect(owl.x).toBeGreaterThan(trunkAt(owl.y + owl.height).right)
    // Elf and robin: clear of the Christmas tree at the exit.
    for (const id of ['elf', 'robin'] as const) {
      const box = boxAt(id, ANIMALS[id].exitIndex, -1)
      for (let y = box.y; y <= box.y + box.height; y += 2) expect(box.x + box.width, `${id} at ${y}`).toBeLessThan(1260 - firHalfWidth(y))
    }
  })

  it('peek out of their foreground hideout with their eyes over it', () => {
    // The snowman's eyes (about 150 above his feet) rise over the big drift.
    const snowman = ANIMALS.snowman.path[1]!
    expect(snowman.y - 150).toBeLessThan(domeTop(BIG_DRIFT, snowman.x))
    // The rabbit's eyes (about 100 above its feet) over the small drift.
    const rabbit = ANIMALS.rabbit.path[1]!
    expect(rabbit.y - 100).toBeLessThan(domeTop(DRIFT, rabbit.x))
    // The red fox's head past the right edge of the bush.
    const fox = ANIMALS.redFox.path[1]!
    expect(fox.x + 100).toBeGreaterThan(BUSH.x + BUSH.rx * 0.9)
  })

  // [SPEC-16.2] The gingerbread man peeks into the doorway, then settles on the snow below the wall,
  // right of Santa's doorstep, clear of Santa's way out, his hand at most over the edge of the
  // Christmas tree.
  it('gingerbread man: peeks into the doorway, settles between the doorstep and the Christmas tree', () => {
    const peek = boxAt('gingerbread', ANIMALS.gingerbread.peekIndex, -1)
    expect(peek.x).toBeLessThan(HOUSE.door.x + HOUSE.door.width - 40)
    const place = placeBox('gingerbread')
    expect(place.y + place.height).toBeGreaterThan(HOUSE.wall.y + HOUSE.wall.height)
    // Santa walks out at x 955 and stays on his doorstep.
    for (const p of ANIMALS.santa.path.slice(ANIMALS.santa.exitIndex)) expect(intersects(place, drawingBox(ANIMALS.santa, p.x, p.y, -1))).toBe(false)
    for (let y = place.y; y <= place.y + place.height; y += 2) expect(place.x + place.width, `at ${y}`).toBeLessThan(1260 - firHalfWidth(y) + 30)
  })

  // [SPEC-16.5.1] [SPEC-16.5.2] Places: Santa on his doorstep, against the dark doorway, not in
  // front of the wall; nobody in front of a foreground hideout.
  it('settle where they stand out', () => {
    const santa = placeBox('santa')
    expect(santa.x).toBeGreaterThanOrEqual(HOUSE.door.x)
    expect(santa.x + santa.width).toBeLessThanOrEqual(HOUSE.door.x + HOUSE.door.width)
    for (const id of ANIMAL_IDS) {
      const box = placeBox(id)
      // The bush is lobed: its lobes bulge up to a tenth out of its ellipse.
      for (const dome of [{ ...BUSH, ry: BUSH.ry * 1.1, rx: BUSH.rx * 1.1 }, DRIFT, BIG_DRIFT]) {
        for (let x = box.x; x <= box.x + box.width; x += 2) expect(box.y + box.height, `${id} at ${x}`).toBeLessThanOrEqual(domeTop(dome, x) + 0.5)
      }
    }
  })

  // Boxes are coarse: the screenshots show the drawings themselves apart. The robin perches on the
  // snowman's hat by design [SPEC-16.2.2].
  it('places keep the characters apart: their boxes overlap little', () => {
    for (const [i, a] of ANIMAL_IDS.entries()) {
      for (const b of ANIMAL_IDS.slice(i + 1)) {
        if (a === 'snowman' && b === 'robin') continue
        const ra = placeBox(a)
        const rb = placeBox(b)
        if (!intersects(ra, rb)) continue
        const overlap = (Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)) * (Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y))
        expect(overlap / Math.min(ra.width * ra.height, rb.width * rb.height), `${a} / ${b}`).toBeLessThan(0.2)
      }
    }
  })

  // Characters in the open are drawn in the order of their feet on the screen: see overlap.ts.
  it.each(ANIMAL_IDS)('%s: never crosses the depth of a still character while overlapping it', (id) => {
    expect(depthCrossings(ANIMALS, id)).toEqual([])
  })
})
