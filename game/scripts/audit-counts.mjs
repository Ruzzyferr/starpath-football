#!/usr/bin/env node
// Parses the per-row tables of docs/GAP-AUDIT.md (sections 2.1-2.12 plus the GDD table 2.13)
// and prints / regenerates the summary counts between the markers
//   <!-- counts:start -->  ...  <!-- counts:end -->
//
//   node scripts/audit-counts.mjs           print the counts (no write)
//   node scripts/audit-counts.mjs --write   regenerate the block in docs/GAP-AUDIT.md
//   node scripts/audit-counts.mjs --check   exit 1 if the committed block is stale
//
// Every row must carry exactly one status of STATUSES; anything else fails the run.
// No dependencies.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const DOC = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/GAP-AUDIT.md')
const START = '<!-- counts:start -->'
const END = '<!-- counts:end -->'
const STATUSES = ['TAMAM', 'KISMİ', 'EKSİK', 'ERTELENDİ-EXT', 'ERTELENDİ-INT', 'N/A']
const HEAD = ['TAMAM', 'KISMİ', 'EKSİK', 'ERTELENDİ (BLOCKED-EXT)', 'ERTELENDİ (iç)', 'N/A-süreç']
const TITLES = {
  1: 'Maç motoru', 2: 'Animasyon, kamera', 3: 'Kariyer', 4: 'Sosyal, olaylar', 5: 'Ekonomi', 6: 'Dünya',
  7: 'UI/UX', 8: 'Ses', 9: 'Platform', 10: 'Meta, online', 11: 'Erişilebilirlik', 12: 'Risk, mağaza, QA',
}

const raw = readFileSync(DOC, 'utf8')
const nl = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)

const errors = []
const perSection = {} // n -> {status: count}
const seen = new Set()
const gdd = {}
let section = null // '2.N' | '2.13' | null

lines.forEach((line, i) => {
  const h = line.match(/^#{2,3} (2\.\d+)(b?) /)
  if (h) section = h[2] ? null : h[1]
  else if (/^#{1,3} /.test(line)) section = null
  if (!section || !line.startsWith('|')) return
  const cells = line.split('|').slice(1, -1).map((c) => c.trim())
  if (cells.length < 4 || cells[0] === 'Madde' || cells[0] === 'GDD maddesi' || /^-+$/.test(cells[0].replace(/:/g, ''))) return
  const status = cells[1]
  if (section === '2.13') {
    if (!STATUSES.includes(status)) errors.push(`satır ${i + 1}: GDD "${cells[0]}" geçersiz durum "${status}"`)
    gdd[status] = (gdd[status] ?? 0) + 1
    return
  }
  const m = cells[0].match(/^(2\.(\d+))#(\d+)$/)
  if (!m || m[1] !== section) return
  if (seen.has(cells[0])) errors.push(`satır ${i + 1}: ${cells[0]} yinelenmiş`)
  seen.add(cells[0])
  if (!STATUSES.includes(status)) errors.push(`satır ${i + 1}: ${cells[0]} geçersiz durum "${status}"`)
  const s = (perSection[+m[2]] ??= {})
  s[status] = (s[status] ?? 0) + 1
})

if (errors.length) {
  console.error('audit-counts: ham tablolarda hata:\n' + errors.join('\n'))
  process.exit(1)
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
const total = {}
const rows = []
for (let n = 1; n <= 12; n++) {
  const s = perSection[n] ?? {}
  STATUSES.forEach((k) => (total[k] = (total[k] ?? 0) + (s[k] ?? 0)))
  rows.push(`| 2.${n} ${TITLES[n]} | ${STATUSES.map((k) => s[k] ?? 0).join(' | ')} | ${sum(s)} |`)
}
const grand = sum(total)
const pct = Math.round((total.TAMAM / grand) * 100)
const gTotal = sum(gdd)

const block = [
  START,
  '<!-- Otomatik üretilir: `npm run audit:counts` (game/scripts/audit-counts.mjs). Elle düzenlemeyin; ham tablo satırlarını düzeltin. -->',
  '',
  `### Analiz-ve-Plan §2 [v1][P0]: ${grand} madde`,
  '',
  `| Bölüm | ${HEAD.join(' | ')} | Toplam |`,
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...rows,
  `| **Toplam** | **${total.TAMAM} (%${pct})** | ${STATUSES.slice(1).map((k) => total[k]).join(' | ')} | **${grand}** |`,
  '',
  `### GDD [v1]: ${gTotal} madde`,
  '',
  `| ${HEAD.join(' | ')} | Toplam |`,
  '|---:|---:|---:|---:|---:|---:|---:|',
  `| ${STATUSES.map((k) => `**${gdd[k] ?? 0}**`).join(' | ')} | **${gTotal}** |`,
  END,
].join(nl)

const a = raw.indexOf(START)
const b = raw.indexOf(END)
if (a < 0 || b < a) {
  console.error(`audit-counts: ${DOC} içinde ${START} / ${END} işaretleri yok`)
  process.exit(1)
}
const next = raw.slice(0, a) + block + raw.slice(b + END.length)
const mode = process.argv[2]
if (mode === '--write') {
  if (next !== raw) writeFileSync(DOC, next)
  console.log(block.replace(/\r?\n/g, '\n'))
  console.log(next !== raw ? '\naudit-counts: GAP-AUDIT.md güncellendi.' : '\naudit-counts: zaten güncel.')
} else if (mode === '--check') {
  if (next !== raw) {
    console.error('audit-counts: docs/GAP-AUDIT.md sayım bloğu bayat. `npm run audit:counts` çalıştırıp commit edin.')
    process.exit(1)
  }
  console.log(`audit-counts: güncel (${grand} + ${gTotal} GDD satırı).`)
} else {
  console.log(block.replace(/\r?\n/g, '\n'))
}
