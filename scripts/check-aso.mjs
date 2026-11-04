// Checks docs/store/aso-locales.json against App Store limits:
// name and subtitle <= 30 characters, keywords <= 100 bytes, no spaces after commas,
// no keyword that repeats a word of the name or subtitle. Exit 1 on any problem.
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../docs/store/aso-locales.json', import.meta.url), 'utf8'))
const words = (s) => s.toLocaleLowerCase().split(/[\s:：,'’\-]+/u).filter(Boolean)
let bad = 0
for (const [loc, m] of Object.entries(data)) {
  if (loc.startsWith('_')) continue
  const problems = []
  const nameLen = [...m.name].length
  const subLen = [...m.subtitle].length
  const kwBytes = Buffer.byteLength(m.keywords, 'utf8')
  if (nameLen > 30) problems.push(`name ${nameLen} chars`)
  if (subLen > 30) problems.push(`subtitle ${subLen} chars`)
  if (kwBytes > 100) problems.push(`keywords ${kwBytes} bytes`)
  if (/,\s/.test(m.keywords)) problems.push('space after comma')
  const used = new Set([...words(m.name), ...words(m.subtitle)])
  const kws = m.keywords.split(',').map((k) => k.toLocaleLowerCase())
  const dup = kws.filter((k) => used.has(k))
  if (dup.length) problems.push(`repeats name/subtitle: ${dup.join(' ')}`)
  const twice = kws.filter((k, i) => kws.indexOf(k) !== i)
  if (twice.length) problems.push(`keyword twice: ${twice.join(' ')}`)
  if (problems.length) bad++
  console.log(`${loc.padEnd(8)} name ${String(nameLen).padStart(2)}  sub ${String(subLen).padStart(2)}  kw ${String(kwBytes).padStart(3)}B  ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'}`)
}
process.exit(bad ? 1 : 0)
