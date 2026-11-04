// Pushes store metadata for every localization to App Store Connect:
//   app info (name, subtitle, privacy URL) from docs/store/aso-locales.json
//   version (description, keywords, support URL) from aso-locales.json + description-ios.json
// Usage (CI, see .github/workflows/store-metadata.yml):
//   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8="$(cat AuthKey.p8)" node scripts/asc-metadata.mjs 1.0.1 [--dry-run]
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const APP_ID = '6820656851'
const SITE = 'https://kickborn.swiip.app'
const version = process.argv[2]
const dry = process.argv.includes('--dry-run')
if (!/^\d+\.\d+(\.\d+)?$/.test(version ?? '')) throw new Error('usage: asc-metadata.mjs <version> [--dry-run]')

const read = (p) => JSON.parse(readFileSync(new URL(`../docs/store/${p}`, import.meta.url), 'utf8'))
const aso = read('aso-locales.json')
const desc = read('description-ios.json')
// What's New is required on every update (not on a first release); missing file = not sent.
let whatsNew = {}
try { whatsNew = read('whats-new-ios.json') } catch {}
const locales = Object.keys(aso).filter((l) => !l.startsWith('_'))
for (const l of locales) if (!desc[l]) throw new Error(`description-ios.json: missing ${l}`)

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  const key = createPrivateKey(process.env.ASC_KEY_P8)
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${head}.${body}.${sig}`
}
const jwt = token()

async function api(method, path, data) {
  if (dry && method !== 'GET') {
    console.log(`DRY ${method} ${path} ${JSON.stringify(data?.data?.attributes ?? {}).slice(0, 120)}`)
    return { data: { id: 'dry-run' } }
  }
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : {}
}

// 1. The iOS version (created if it does not exist yet).
let ver = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${version}`)).data[0]
if (!ver) {
  ver = (await api('POST', '/v1/appStoreVersions', {
    data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: version, releaseType: 'AFTER_APPROVAL' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
  })).data
  console.log(`created version ${version}`)
}
console.log(`version ${version}: ${ver.id} ${ver.attributes?.appStoreState ?? ''}`)

// 2. Version localizations: description, keywords, support URL.
const verLocs = dry && ver.id === 'dry-run' ? [] : (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=200`)).data
for (const l of locales) {
  const attributes = { description: desc[l], keywords: aso[l].keywords, supportUrl: `${SITE}/support`, marketingUrl: SITE, ...(whatsNew[l] ? { whatsNew: whatsNew[l] } : {}) }
  const have = verLocs.find((x) => x.attributes.locale === l)
  if (have) await api('PATCH', `/v1/appStoreVersionLocalizations/${have.id}`, { data: { type: 'appStoreVersionLocalizations', id: have.id, attributes } })
  else await api('POST', '/v1/appStoreVersionLocalizations', {
    data: { type: 'appStoreVersionLocalizations', attributes: { ...attributes, locale: l }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } },
  })
  console.log(`version ${l}: ${have ? 'updated' : 'added'}`)
}

// 3. App info localizations (name, subtitle): only the editable app info takes changes.
const infos = (await api('GET', `/v1/apps/${APP_ID}/appInfos`)).data
const info = infos.find((i) => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO'].includes(i.attributes.appStoreState ?? i.attributes.state)) ?? infos[0]
console.log(`app info ${info.id} ${info.attributes.appStoreState ?? info.attributes.state}`)
const infoLocs = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations?limit=200`)).data
for (const l of locales) {
  const attributes = { name: aso[l].name, subtitle: aso[l].subtitle, privacyPolicyUrl: `${SITE}/legal/privacy-${l === 'tr' ? 'tr' : 'en'}.html` }
  const have = infoLocs.find((x) => x.attributes.locale === l)
  if (have) await api('PATCH', `/v1/appInfoLocalizations/${have.id}`, { data: { type: 'appInfoLocalizations', id: have.id, attributes } })
  else await api('POST', '/v1/appInfoLocalizations', {
    data: { type: 'appInfoLocalizations', attributes: { ...attributes, locale: l }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } },
  })
  console.log(`app info ${l}: ${have ? 'updated' : 'added'}`)
}
console.log(`done: ${locales.length} localizations`)
