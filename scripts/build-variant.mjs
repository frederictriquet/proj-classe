// Builds a variant of the app, for instance a faulty one to check that the start-up test rejects
// it [SPEC-3.9.1]. Usage: node scripts/build-variant.mjs <outDir> <commit label> [app|menu|boot]
import { resolve } from 'node:path'
import { buildVariant, ROOT } from './pwa-harness.mjs'

const [outDir, commit, fault] = process.argv.slice(2)
if (!outDir || !commit) {
  console.error('Usage: node scripts/build-variant.mjs <outDir> <commit label> [app|menu|boot]')
  process.exit(2)
}
await buildVariant(resolve(ROOT, outDir), commit, fault)
console.log(`Built ${commit}${fault ? ` with the "${fault}" fault` : ''} into ${outDir}`)
