import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import type { AnimalSpec } from './animal'
import { createAnimal } from './animals'
import type { Decor, DecorAnimal } from './decor'
import { cycleGallerySelection, selectGalleryAnimal } from './gallery'

const TWENTY = Array.from({ length: 20 }, (_, i) => `chick${i + 1}`)

describe('gallery animal selection [SPEC-9.3] [SPEC-13.2] [SPEC-14.2]', () => {
  it('selects animals 1 to 6 in the forest and 1 to 8 in the farm, 0 for all, ignoring higher digits', () => {
    const forest = ['squirrel', 'rabbit', 'hedgehog', 'owl', 'fox', 'fawn'] as const
    expect(selectGalleryAnimal(forest, 'all', '1')).toBe('squirrel')
    expect(selectGalleryAnimal(forest, 'all', '6')).toBe('fawn')
    expect(selectGalleryAnimal(forest, 'squirrel', '0')).toBe('all')
    expect(selectGalleryAnimal(forest, 'all', '7')).toBeUndefined()
    expect(selectGalleryAnimal(forest, 'all', '9')).toBeUndefined()

    const farm = ['hen', 'horse', 'rabbit', 'sheep', 'pig', 'cow', 'duck', 'goat'] as const
    expect(selectGalleryAnimal(farm, 'all', '8')).toBe('goat')
    expect(selectGalleryAnimal(farm, 'all', '9')).toBeUndefined()
    expect(selectGalleryAnimal(farm, 'goat', '0')).toBe('all')
  })

  it('cycles through all twenty animals with Tab and Shift+Tab as well as the left and right arrows [SPEC-14.2]', () => {
    expect(selectGalleryAnimal(TWENTY, 'all', '1')).toBe('chick1')
    expect(selectGalleryAnimal(TWENTY, 'all', '9')).toBe('chick9')
    expect(selectGalleryAnimal(TWENTY, 'chick9', '0')).toBe('all')

    // Forward with Tab through all twenty chicks and back to 'all'.
    let current: string | 'all' = 'all'
    const visitedForward: (string | 'all')[] = []
    for (let i = 0; i < TWENTY.length + 1; i++) {
      current = selectGalleryAnimal(TWENTY, current, 'Tab', false)!
      visitedForward.push(current)
    }
    expect(visitedForward).toEqual([...TWENTY, 'all'])

    // Backward with Shift+Tab from 'all' to chick20, down to chick1, and back to 'all'.
    const visitedBackward: (string | 'all')[] = []
    for (let i = 0; i < TWENTY.length + 1; i++) {
      current = selectGalleryAnimal(TWENTY, current, 'Tab', true)!
      visitedBackward.push(current)
    }
    expect(visitedBackward).toEqual([...[...TWENTY].reverse(), 'all'])

    // Left and right arrows step identically past the ninth animal.
    expect(selectGalleryAnimal(TWENTY, 'chick9', 'ArrowRight')).toBe('chick10')
    expect(selectGalleryAnimal(TWENTY, 'chick20', 'ArrowRight')).toBe('all')
    expect(selectGalleryAnimal(TWENTY, 'all', 'ArrowLeft')).toBe('chick20')
    expect(selectGalleryAnimal(TWENTY, 'chick10', 'ArrowLeft')).toBe('chick9')
    expect(cycleGallerySelection(TWENTY, 'chick14', 1)).toBe('chick15')
    expect(cycleGallerySelection(TWENTY, 'chick15', -1)).toBe('chick14')
    expect(selectGalleryAnimal(TWENTY, 'all', 'c')).toBeUndefined()
  })
})

describe('animal state and pose given to the decor [SPEC-9.3] [SPEC-14.2.1] [SPEC-14.2.2]', () => {
  const SPEC: AnimalSpec<'chick1', 'egg1'> = {
    id: 'chick1',
    hideout: 'egg1',
    usesSlot: true,
    path: [
      { x: 400, y: 800, crouch: 0.6 },
      { x: 400, y: 780, crouch: 0.2 },
      { x: 420, y: 790, crouch: 0 },
      { x: 520, y: 820, crouch: 0 },
    ],
    peekIndex: 1,
    exitIndex: 2,
    hideFacing: 1,
    spotFacing: 1,
    frontal: false,
    extent: { left: -30, right: 30, top: -60 },
    speed: { peek: 60, walk: 140, flee: 400 },
    peekPause: 0.4,
    gait: 'walk',
    strideLength: 40,
    bounce: 5,
    sleepCrouch: 0.35,
    grazeCrouch: 0.15,
    activities: { rest: 1, graze: 2, scratch: 1, sleep: 1, look: 1 },
  }

  it('exposes each animal state and pose to Decor.tick as the animal peeks, comes out and flees', () => {
    const snapshots: { state: string; x: number; y: number; crouch: number }[] = []
    const decor: Decor = {
      root: new Container(),
      actors: new Container(),
      slots: { egg1: new Container() },
      resize() {},
      tick(_dt: number, animals?: readonly DecorAnimal[]) {
        const first = animals?.[0]
        if (first) snapshots.push({ state: first.state, x: first.pose.x, y: first.pose.y, crouch: first.pose.crouch })
      },
    }
    const animal = createAnimal(SPEC, { root: new Container(), apply() {} }, decor, 1)
    expect(animal.state).toBe('hidden')
    expect(animal.pose.x).toBe(400)
    expect(animal.pose.y).toBe(800)

    animal.setTarget('settled')
    for (let i = 0; i < 240; i++) {
      animal.update(1 / 60)
      decor.tick(1 / 60, [animal])
    }
    expect(snapshots.some((s) => s.state === 'peeking')).toBe(true)
    expect(snapshots.some((s) => s.state === 'approaching')).toBe(true)
    expect(snapshots.at(-1)?.state).toBe('settled')
    expect(snapshots.at(-1)?.x).toBe(520)
    expect(snapshots.at(-1)?.y).toBe(820)

    animal.setTarget('hidden')
    for (let i = 0; i < 60; i++) {
      animal.update(1 / 60)
      decor.tick(1 / 60, [animal])
    }
    expect(snapshots.some((s) => s.state === 'fleeing')).toBe(true)
    expect(snapshots.at(-1)?.state).toBe('hidden')
    expect(snapshots.at(-1)?.x).toBe(400)
    expect(snapshots.at(-1)?.y).toBe(800)
  })
})
