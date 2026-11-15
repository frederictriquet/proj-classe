import { describe, expect, it } from 'vitest'
import { errorMessage, ExplainedError } from './errors'

describe('errorMessage', () => {
  it('shows an explained error as is, and the name of any other one', () => {
    expect(errorMessage(new ExplainedError('Autorisez le micro.'))).toBe('Autorisez le micro.')
    expect(errorMessage(new TypeError('boom'))).toBe('TypeError : boom')
    expect(errorMessage('texte')).toBe('texte')
  })

  it('gives the name alone when the message is empty, as for OverconstrainedError', () => {
    const error = new Error('')
    error.name = 'OverconstrainedError'
    expect(errorMessage(error)).toBe('OverconstrainedError')
  })
})
