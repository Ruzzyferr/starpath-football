// noUncheckedIndexedAccess ratchet (ADR-007, GAP 2.9#2): the flag is enforced for
// src/core, src/state, src/platform. Imported sim/ui files are checked by the same
// program but are not yet clean, so only errors inside the enforced dirs fail.
import { spawnSync } from 'node:child_process'

const SCOPE = /^src\/(core|state|platform)\//
const r = spawnSync('npx tsc --noEmit -p tsconfig.strict-index.json', { encoding: 'utf8', shell: true })
const bad = `${r.stdout}${r.stderr}`.split(/\r?\n/).filter((l) => SCOPE.test(l.replaceAll(String.fromCharCode(92), '/')))
if (bad.length) {
  console.error(bad.join('\n'))
  console.error(`\nstrict-index: ${bad.length} error(s) in core/state/platform`)
  process.exit(1)
}
console.log('strict-index: core/state/platform clean under noUncheckedIndexedAccess')
