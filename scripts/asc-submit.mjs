// App Store review flow through the API (CI: .github/workflows/store-submit.yml).
//   node scripts/asc-submit.mjs status <version>
//   node scripts/asc-submit.mjs cancel                       withdraw the open review submission
//   node scripts/asc-submit.mjs retarget <from> <to>         rename an editable version (keeps its localizations)
//   node scripts/asc-submit.mjs submit <version> <build>     attach the build, enable Game Center, submit for review
// Add --dry-run to print the writes without sending them.
import { createPrivateKey, sign } from 'node:crypto'

const APP_ID = '6820656851'
const [cmd, a1, a2] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
const dry = process.argv.includes('--dry-run')

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
let jwt = ''
let jwtAt = 0
function token() {
  if (jwt && Date.now() - jwtAt < 600_000) return jwt
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  const key = createPrivateKey(process.env.ASC_KEY_P8)
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  jwt = `${head}.${body}.${sig}`
  jwtAt = Date.now()
  return jwt
}

async function api(method, path, data, { soft = false } = {}) {
  if (dry && method !== 'GET') {
    console.log(`DRY ${method} ${path} ${JSON.stringify(data ?? {}).slice(0, 200)}`)
    return { data: { id: 'dry-run', attributes: {} } }
  }
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    const msg = `${method} ${path} -> ${res.status}: ${text.slice(0, 800)}`
    if (soft) { console.log(`WARN ${msg}`); return null }
    throw new Error(msg)
  }
  return text ? JSON.parse(text) : {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function version(v) {
  const r = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${v}&include=build`)
  return r.data[0] ?? null
}
async function openSubmissions() {
  const r = await api('GET', `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=20`)
  return r.data.filter((s) => ['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES'].includes(s.attributes.state))
}

if (cmd === 'status') {
  const v = await version(a1)
  console.log(`version ${a1}: ${v ? `${v.id} ${v.attributes.appStoreState}` : 'none'}`)
  for (const s of await openSubmissions()) console.log(`submission ${s.id} ${s.attributes.state}`)
} else if (cmd === 'cancel') {
  const subs = (await openSubmissions()).filter((s) => s.attributes.state !== 'READY_FOR_REVIEW')
  if (!subs.length) console.log('no submission in review')
  for (const s of subs) {
    await api('PATCH', `/v1/reviewSubmissions/${s.id}`, { data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } })
    console.log(`canceled submission ${s.id} (was ${s.attributes.state})`)
  }
  // Apple takes a moment to move the version back to an editable state.
  for (let i = 0; i < 30 && !dry && subs.length; i++) {
    const left = (await openSubmissions()).filter((s) => subs.some((x) => x.id === s.id))
    if (!left.length) break
    console.log(`waiting: ${left.map((s) => s.attributes.state).join(', ')}`)
    await sleep(20_000)
  }
} else if (cmd === 'retarget') {
  const v = await version(a1)
  if (!v) throw new Error(`no version ${a1}`)
  console.log(`version ${a1}: ${v.attributes.appStoreState}`)
  await api('PATCH', `/v1/appStoreVersions/${v.id}`, { data: { type: 'appStoreVersions', id: v.id, attributes: { versionString: a2, releaseType: 'AFTER_APPROVAL' } } })
  console.log(`renamed ${a1} -> ${a2}`)
} else if (cmd === 'submit') {
  const v = await version(a1)
  if (!v) throw new Error(`no version ${a1}`)
  console.log(`version ${a1}: ${v.id} ${v.attributes.appStoreState}`)
  // 1. The build (must be processed).
  const builds = (await api('GET', `/v1/builds?filter[app]=${APP_ID}&filter[version]=${a2}&filter[preReleaseVersion.version]=${a1}&limit=5`)).data
  const build = builds[0]
  if (!build) throw new Error(`build ${a2} of ${a1} not found`)
  console.log(`build ${a2}: ${build.id} ${build.attributes.processingState}`)
  if (build.attributes.processingState !== 'VALID') throw new Error('build not processed yet')
  await api('PATCH', `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: 'builds', id: build.id } })
  console.log('build attached')
  // 2. Game Center on this version (best effort: the app-level setup is done by asc-gamecenter.mjs).
  const gc = await api('GET', `/v1/appStoreVersions/${v.id}/gameCenterAppVersion`, undefined, { soft: true })
  if (gc?.data) {
    if (!gc.data.attributes?.enabled) await api('PATCH', `/v1/gameCenterAppVersions/${gc.data.id}`, { data: { type: 'gameCenterAppVersions', id: gc.data.id, attributes: { enabled: true } } }, { soft: true })
    console.log('game center: on')
  } else {
    const made = await api('POST', '/v1/gameCenterAppVersions', { data: { type: 'gameCenterAppVersions', relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } }, { soft: true })
    console.log(made ? 'game center: enabled for this version' : 'game center: could not enable (check the version page)')
  }
  // 3. Review submission: reuse a draft one, else create; add the version; submit.
  let sub = (await openSubmissions()).find((s) => s.attributes.state === 'READY_FOR_REVIEW')
  if (!sub) {
    sub = (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } } })).data
    console.log(`created submission ${sub.id}`)
  }
  const items = dry ? { data: [] } : await api('GET', `/v1/reviewSubmissions/${sub.id}/items?include=appStoreVersion`)
  const has = items.data.some((it) => it.relationships?.appStoreVersion?.data?.id === v.id)
  if (!has) {
    await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } } } })
    console.log('version added to submission')
  }
  await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } })
  console.log(`submitted ${a1} (build ${a2}) for review`)
} else {
  throw new Error('usage: asc-submit.mjs status|cancel|retarget|submit …')
}
