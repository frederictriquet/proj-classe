import { describe, expect, it } from 'vitest'
import { findMissing } from './precache-check'

describe('findMissing', () => {
  it('returns an empty list when every expected key is cached', () => {
    expect(findMissing(['a', 'b'], ['b', 'a', 'c'])).toEqual([])
  })

  it('returns the expected keys absent from the cache, in manifest order', () => {
    expect(findMissing(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
  })
})
