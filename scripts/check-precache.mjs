// [SPEC-3.1] [SPEC-10 V7] Fails the build if a file of dist/ is missing from the precache manifest.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const sw = readFileSync(join(dist, 'sw.js'), 'utf8')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [relative(dist, path)]
  })
}

const files = walk(dist).filter((file) => file !== 'sw.js')
const missing = files.filter((file) => !sw.includes(`"${file}"`) && !sw.includes(`'${file}'`))
if (missing.length > 0) {
  console.error(`Precache incomplete: ${missing.length} file(s) of dist/ not in sw.js:\n${missing.join('\n')}`)
  process.exit(1)
}
console.log(`Precache complete: ${files.length} files of dist/ listed in sw.js.`)
