/**
 * Exports the achievement catalogue for Game Center (docs/store/gamecenter/achievements.json):
 * id, names and descriptions (TR/EN), secret flag and Game Center points (sum ≤ 1000).
 * Casino achievements are left out: the iOS build has no casino.  npx vite-node scripts/gc-export.ts
 */
import { writeFileSync } from 'node:fs'
import { ACHIEVEMENTS } from '../src/sim/game/achievements'

const list = ACHIEVEMENTS.filter((a) => !/casino|gambl|jackpot|roulette|slot/i.test(`${a.id} ${a.name.en} ${a.desc.en}`))
// Harder (secret or legacy) achievements weigh double; the rest share what remains of 1000.
const weight = (a: (typeof list)[number]) => (a.secret || a.category === 'legacy' ? 2 : 1)
const unit = Math.floor(1000 / list.reduce((n, a) => n + weight(a), 0))
const out = list.map((a) => ({
  id: a.id,
  category: a.category,
  icon: a.icon,
  secret: Boolean(a.secret),
  points: Math.min(100, unit * weight(a)),
  name: a.name,
  desc: a.desc,
}))
writeFileSync(new URL('../../docs/store/gamecenter/achievements.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} achievements, ${out.reduce((n, a) => n + a.points, 0)} points (left out: ${ACHIEVEMENTS.length - out.length})`)
