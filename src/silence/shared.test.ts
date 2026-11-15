import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const folder = dirname(fileURLToPath(import.meta.url))
const sources = readdirSync(folder)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, source: readFileSync(join(folder, name), 'utf8') }))

describe('shared code of the activities of silence [SPEC-9.8]', () => {
  it('holds no colour: every colour comes from the palette of the activity [SPEC-8.3]', () => {
    for (const { name, source } of sources.filter((s) => !s.name.endsWith('.test.ts'))) {
      expect(source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [], name).toEqual([])
    }
  })

  it('depends on no activity: the activities depend on it', () => {
    for (const { name, source } of sources) {
      const fromApps = [...source.matchAll(/\bfrom\s+['"](\.\.\/apps\/[^'"]+)['"]/g)].map((m) => m[1])
      expect(fromApps.filter((path) => path !== '../apps/types'), name).toEqual([])
    }
  })
})
