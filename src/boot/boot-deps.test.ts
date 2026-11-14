import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Modules outside src/boot/ that the bootstrap may load: leaves shared with the app and the
 *  service worker, which import nothing themselves. */
const ALLOWED_OUTSIDE_BOOT = ['errors.ts', 'version.ts', 'pwa/install.ts', 'pwa/precache-check.ts']
const ALLOWED_PACKAGES = ['virtual:pwa-register']

/** Static imports kept at run time. `import type` is erased (verbatimModuleSyntax); the dynamic
 *  import() of the app is not a static import. */
function runtimeImports(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(/^(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!match[1]) specifiers.push(match[2]!)
  }
  for (const match of source.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) specifiers.push(match[1]!)
  return specifiers
}

/** Every module the bootstrap loads before the app, as paths relative to src/. */
function bootGraph(): { files: string[]; packages: string[] } {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const specifier of runtimeImports(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier.endsWith('.ts') ? specifier : `${specifier}.ts`))
      else packages.add(specifier)
    }
  }
  visit(resolve(SRC, 'boot/boot.ts'))
  return { files: [...files].map((file) => relative(SRC, file)), packages: [...packages] }
}

describe('bootstrap independence [SPEC-3.9.2]', () => {
  it('loads no module of the app before the app itself', () => {
    const { files, packages } = bootGraph()
    const outside = files.filter((file) => !file.startsWith('boot/') && !ALLOWED_OUTSIDE_BOOT.includes(file))
    expect(outside).toEqual([])
    expect(packages.filter((name) => !ALLOWED_PACKAGES.includes(name))).toEqual([])
  })

  it('finds the imports of the bootstrap (the check above is not vacuous)', () => {
    expect(bootGraph().files).toEqual(
      expect.arrayContaining(['boot/boot.ts', 'boot/register.ts', 'boot/update.ts', 'boot/fallback.ts', 'version.ts']),
    )
  })

  it('treats a type-only import as no dependency, and an inline `type` specifier as one', () => {
    expect(runtimeImports("import type { A } from './a'\nimport { type B } from './b'\nimport './c'")).toEqual([
      './b',
      './c',
    ])
  })
})
