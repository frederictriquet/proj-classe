import { describe, expect, it } from 'vitest'
import { contains, SAFE_ZONE } from '../../silence/geometry'
import { createIncubator } from './incubator'
import { MOTHER_HEN } from './layout'
import {
  createFeathers,
  featherAlpha,
  featherPose,
  haloScale,
  henPose,
  REWARD,
} from './reward'
import { createReward } from './reward-art'

describe('reward of the brood [SPEC-9.5] [SPEC-8.5] [SPEC-13] [SPEC-14.4]', () => {
  const feathers = createFeathers()

  it('floats down feathers slowly inside their safe-zone area without flickering [SPEC-8.5] [SPEC-8.6]', () => {
    expect(contains(SAFE_ZONE, REWARD.area, 15)).toBe(true)
    expect(feathers).toHaveLength(REWARD.feathers)
    for (const f of feathers) {
      expect(f.px).toBeGreaterThanOrEqual(8)
      expect(f.py).toBeGreaterThanOrEqual(8)
      expect(f.swayPeriod).toBeGreaterThanOrEqual(5)
      for (let t = 0; t < 60; t += 0.25) {
        const { x, y, rotation } = featherPose(f, t)
        expect(contains(REWARD.area, { x, y, width: 0, height: 0 }), `${x}, ${y}`).toBe(true)
        expect(Math.abs(rotation)).toBeLessThanOrEqual(REWARD.sway.amplitude[1])
      }
      // Fastest drift speed in world units per second: slow gentle float.
      const speed = Math.hypot((2 * Math.PI * f.ax) / f.px, (2 * Math.PI * f.ay) / f.py)
      expect(speed).toBeLessThan(65)
    }
  })

  it('keeps the down feathers invisible without reward and all shown at full reward', () => {
    for (const f of feathers) {
      expect(featherAlpha(f, 0)).toBe(0)
      expect(featherAlpha(f, 1)).toBe(1)
    }
  })

  it('rises the mother hen over the crate rim and sways her head gently [SPEC-8.5] [SPEC-14.4]', () => {
    const hidden = henPose(0, 0)
    const full = henPose(0, 1)
    expect(hidden.x).toBe(MOTHER_HEN.x)
    expect(full.x).toBe(MOTHER_HEN.x)
    expect(hidden.y).toBeGreaterThan(full.y)
    expect(full.y).toBe(MOTHER_HEN.rimY)
    expect(REWARD.henSway.period).toBeGreaterThanOrEqual(5)
    expect(REWARD.henBob.period).toBeGreaterThanOrEqual(5)
    const swayed = henPose(REWARD.henSway.period / 4, 1)
    expect(swayed.headRotation).toBeCloseTo(REWARD.henSway.amplitude, 5)
  })

  it('widens the heat lamp halos as the reward fades in [SPEC-14.4]', () => {
    expect(haloScale(0)).toBe(1)
    expect(haloScale(0.5)).toBeGreaterThan(1)
    expect(haloScale(1)).toBeCloseTo(1 + REWARD.haloExpand, 5)
  })

  it('fades in on the incubator while active and fades out at the first flight [SPEC-9.5] [SPEC-14.4]', () => {
    const incubator = createIncubator()
    const reward = createReward(incubator)
    const henNode = incubator.root.children.find((c) => c.label === 'mother-hen')!
    const featherLayer = incubator.root.children.find((c) => c.label === 'reward')!
    const warmLight = incubator.root.children.find((c) => c.label === 'warm-light')!
    const haloCones = incubator.planes.lamps.children.find((c) => c.label === 'reward-lamp-cones')!
    const haloFloors = incubator.planes.straw.children.find((c) => c.label === 'reward-lamp-floors')!

    expect(reward.level).toBe(0)
    expect(henNode.visible).toBe(false)
    expect(featherLayer.visible).toBe(false)
    expect(warmLight.visible).toBe(false)
    expect(haloCones.visible).toBe(false)
    expect(haloFloors.visible).toBe(false)

    // Fade in to full reward (5 seconds).
    reward.update(5, true)
    expect(reward.level).toBe(1)
    expect(henNode.visible).toBe(true)
    expect(featherLayer.visible).toBe(true)
    expect(warmLight.visible).toBe(true)
    expect(haloCones.visible).toBe(true)
    expect(haloFloors.visible).toBe(true)

    // First flight: fades out in 1.2 seconds.
    reward.update(0.6, false)
    expect(reward.level).toBeGreaterThan(0)
    expect(reward.level).toBeLessThan(1)
    reward.update(0.8, false)
    expect(reward.level).toBe(0)
    expect(henNode.visible).toBe(false)
    expect(featherLayer.visible).toBe(false)
    expect(warmLight.visible).toBe(false)
    expect(haloCones.visible).toBe(false)
    expect(haloFloors.visible).toBe(false)
  })
})
