import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OFFLINE_NOTICE, offlineLabel } from './offline-status'

describe('offline witness [SPEC-3.7] [SPEC-3.8]', () => {
  it('shows the notice of SPEC-3.8 word for word', () => {
    const spec = readFileSync(new URL('../../docs/SPEC.md', import.meta.url), 'utf8')
    const line = spec.split('\n').find((text) => text.startsWith('- 3.8 '))
    expect(line).toContain(`« ${OFFLINE_NOTICE} »`)
  })

  it('says « Prête hors ligne » only when every file is cached', () => {
    expect(offlineLabel({ kind: 'ready' })).toBe('Prête hors ligne')
    expect(offlineLabel({ kind: 'downloading' })).toBe('Téléchargement en cours')
  })
})
