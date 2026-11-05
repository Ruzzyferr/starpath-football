// Sets up Game Center in App Store Connect from docs/store/gamecenter/:
//   Game Center capability on the bundle id, the app's Game Center detail, the career-goals
//   leaderboard ("kb.career_goals") and every achievement ("kb.<id>") with localizations and image.
// Idempotent: existing items (matched by vendor identifier / locale) are updated, not duplicated.
// Localizations: TR and EN from achievements.json, other languages from the game's translation
// overlays (game/src/i18n/overlay/<code>.json, keyed by the English text).
// Usage (CI): ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… node scripts/asc-gamecenter.mjs [--dry-run]
import { createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'

const APP_ID = '6820656851'
const BUNDLE = 'app.starpath.football'
const dry = process.argv.includes('--dry-run')
const root = new URL('../', import.meta.url)
const ach = JSON.parse(readFileSync(new URL('docs/store/gamecenter/achievements.json', root), 'utf8'))
const overlay = (code) => {
  const u = new URL(`game/src/i18n/overlay/${code}.json`, root)
  return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : null
}
// Game Center locale -> text source (tr/en from the catalogue, others through an overlay).
const LOCALES = [['tr', 'tr'], ['en-US', 'en'], ['en-GB', 'en'], ['es-ES', 'es'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['de-DE', 'de'], ['fr-FR', 'fr'], ['it', 'it'], ['id', 'id']]
const OV = Object.fromEntries(LOCALES.map(([, s]) => [s, s === 'tr' || s === 'en' ? null : overlay(s)]))
const text = (lt, src) => (src === 'tr' ? lt.tr : OV[src]?.[lt.en] ?? lt.en)
const usable = LOCALES.filter(([, s]) => s === 'tr' || s === 'en' || OV[s])

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })
const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
const jwt = `${head}.${body}.${sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(process.env.ASC_KEY_P8), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`

async function api(method, path, data) {
  if (dry && method !== 'GET') {
    console.log(`DRY ${method} ${path} ${JSON.stringify(data?.data?.attributes ?? {}).slice(0, 110)}`)
    return { data: { id: `dry-${Math.random().toString(36).slice(2, 8)}`, attributes: {} } }
  }
  const res = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const t = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${t.slice(0, 700)}`)
  return t ? JSON.parse(t) : {}
}
const all = async (path) => {
  const out = []
  for (let next = path; next; ) {
    const r = await api('GET', next)
    out.push(...(r.data ?? []))
    next = r.links?.next ?? null
  }
  return out
}
const isDry = (id) => String(id).startsWith('dry-')

// 1. Capability on the App ID (needed for the com.apple.developer.game-center entitlement).
const bundle = (await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}`)).data.find((b) => b.attributes.identifier === BUNDLE)
const caps = await all(`/v1/bundleIds/${bundle.id}/bundleIdCapabilities`)
if (!caps.some((c) => c.attributes.capabilityType === 'GAME_CENTER')) {
  await api('POST', '/v1/bundleIdCapabilities', { data: { type: 'bundleIdCapabilities', attributes: { capabilityType: 'GAME_CENTER' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } } } })
  console.log('capability GAME_CENTER: added')
} else console.log('capability GAME_CENTER: present')

// 2. The app's Game Center detail.
let detail = (await api('GET', `/v1/apps/${APP_ID}/gameCenterDetail`).catch(() => ({ data: null }))).data
if (!detail) {
  detail = (await api('POST', '/v1/gameCenterDetails', { data: { type: 'gameCenterDetails', relationships: { app: { data: { type: 'apps', id: APP_ID } } } } })).data
  console.log('game center detail: created')
}
console.log(`game center detail ${detail.id}`)

// 3. Leaderboard: best career goal total.
const boards = isDry(detail.id) ? [] : await all(`/v1/gameCenterDetails/${detail.id}/gameCenterLeaderboards?limit=200`)
let board = boards.find((b) => b.attributes.vendorIdentifier === 'kb.career_goals')
if (!board) {
  board = (await api('POST', '/v1/gameCenterLeaderboards', {
    data: {
      type: 'gameCenterLeaderboards',
      attributes: { referenceName: 'Career goals', vendorIdentifier: 'kb.career_goals', defaultFormatter: 'INTEGER', submissionType: 'BEST_SCORE', scoreSortType: 'DESC', scoreRangeStart: '0', scoreRangeEnd: '100000' },
      relationships: { gameCenterDetail: { data: { type: 'gameCenterDetails', id: detail.id } } },
    },
  })).data
  console.log('leaderboard kb.career_goals: created')
}
const BOARD = { tr: ['Kariyer golleri', ' gol', ' gol'], en: ['Career goals', ' goals', ' goal'] }
const boardLocs = isDry(board.id) ? [] : await all(`/v1/gameCenterLeaderboards/${board.id}/localizations?limit=200`)
for (const [locale, src] of usable) {
  const [name, suf, sufOne] = src === 'tr' ? BOARD.tr : [OV[src]?.[BOARD.en[0]] ?? BOARD.en[0], BOARD.en[1], BOARD.en[2]]
  const attributes = { name, formatterSuffix: suf, formatterSuffixSingular: sufOne }
  const have = boardLocs.find((l) => l.attributes.locale === locale)
  if (have) await api('PATCH', `/v1/gameCenterLeaderboardLocalizations/${have.id}`, { data: { type: 'gameCenterLeaderboardLocalizations', id: have.id, attributes } })
  else await api('POST', '/v1/gameCenterLeaderboardLocalizations', { data: { type: 'gameCenterLeaderboardLocalizations', attributes: { ...attributes, locale }, relationships: { gameCenterLeaderboard: { data: { type: 'gameCenterLeaderboards', id: board.id } } } } })
}
console.log(`leaderboard localizations: ${usable.length}`)

// 4. Achievements with localizations and image.
const existing = isDry(detail.id) ? [] : await all(`/v1/gameCenterDetails/${detail.id}/gameCenterAchievements?limit=200`)
let made = 0
for (const a of ach) {
  const vendor = `kb.${a.id}`
  let g = existing.find((x) => x.attributes.vendorIdentifier === vendor)
  const attrs = { referenceName: a.name.en.slice(0, 64), points: a.points, showBeforeEarned: !a.secret, repeatable: false }
  if (!g) {
    g = (await api('POST', '/v1/gameCenterAchievements', { data: { type: 'gameCenterAchievements', attributes: { ...attrs, vendorIdentifier: vendor }, relationships: { gameCenterDetail: { data: { type: 'gameCenterDetails', id: detail.id } } } } })).data
    made++
  }
  const locs = isDry(g.id) ? [] : await all(`/v1/gameCenterAchievements/${g.id}/localizations?limit=200`)
  for (const [locale, src] of usable) {
    const name = text(a.name, src).slice(0, 30)
    const desc = text(a.desc, src).slice(0, 200)
    const attributes = { name, beforeEarnedDescription: desc, afterEarnedDescription: desc }
    let loc = locs.find((l) => l.attributes.locale === locale)
    if (loc) await api('PATCH', `/v1/gameCenterAchievementLocalizations/${loc.id}`, { data: { type: 'gameCenterAchievementLocalizations', id: loc.id, attributes } })
    else loc = (await api('POST', '/v1/gameCenterAchievementLocalizations', { data: { type: 'gameCenterAchievementLocalizations', attributes: { ...attributes, locale }, relationships: { gameCenterAchievement: { data: { type: 'gameCenterAchievements', id: g.id } } } } })).data
    // Image, once per localization (skipped when one is already there).
    const hasImage = !isDry(loc.id) && (await api('GET', `/v1/gameCenterAchievementLocalizations/${loc.id}/gameCenterAchievementImage`).catch(() => ({ data: null }))).data
    if (!hasImage) await uploadImage(loc.id, new URL(`docs/store/gamecenter/img/${a.id}.png`, root))
  }
  console.log(`achievement ${vendor}: ok`)
}
console.log(`done: ${ach.length} achievements (${made} new), leaderboard kb.career_goals, ${usable.length} locales`)

async function uploadImage(locId, file) {
  const bytes = readFileSync(file)
  const r = await api('POST', '/v1/gameCenterAchievementImages', {
    data: { type: 'gameCenterAchievementImages', attributes: { fileName: file.pathname.split('/').pop(), fileSize: statSync(file).size }, relationships: { gameCenterAchievementLocalization: { data: { type: 'gameCenterAchievementLocalizations', id: locId } } } },
  })
  if (dry) return
  for (const op of r.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]))
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) })
    if (!res.ok) throw new Error(`image upload ${res.status}`)
  }
  await api('PATCH', `/v1/gameCenterAchievementImages/${r.data.id}`, { data: { type: 'gameCenterAchievementImages', id: r.data.id, attributes: { uploaded: true } } })
}
