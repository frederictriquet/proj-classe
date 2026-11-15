import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance, paperShadow } from './palette'

describe('palette measures [SPEC-8.2] [SPEC-8.3]', () => {
  it('computes the WCAG luminance and contrast', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#FFFFFF')).toBeCloseTo(1)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
    expect(contrastRatio('#8ED1F0', '#8ED1F0')).toBe(1)
  })

  it('casts the paper shadow in the ink of the palette, see-through [SPEC-8.1]', () => {
    expect(paperShadow('#123456')).toEqual({ color: '#123456', alpha: 0.18 })
  })
})
