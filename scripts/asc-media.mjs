// Uploads store screenshots and app previews to an iOS version in App Store Connect.
// Media folder layout (built locally from KICKBORN/Kickborn-Store, shipped as a release asset):
//   screens/ios-iphone-69/<lang>/NN.png   -> APP_IPHONE_67 screenshot set
//   screens/ios-ipad-13/<lang>/NN.png     -> APP_IPAD_PRO_3GEN_129 screenshot set
//   previews/<lang>.mp4                   -> IPHONE_67 app preview set
// <lang> is a game language; LOCALES maps it to the App Store localizations that get it.
// A set that already holds media is replaced. Usage (CI):
//   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_P8=… node scripts/asc-media.mjs <version> <media dir> [--dry-run]
import { createHash, createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const APP_ID = '6820656851'
const [version, dir] = process.argv.slice(2)
const dry = process.argv.includes('--dry-run')
const repair = process.argv.includes('--repair')
const LOCALES = {
  tr: ['tr'], en: ['en-US', 'en-GB', 'en-AU', 'en-CA'], es: ['es-ES', 'es-MX'], pt: ['pt-BR', 'pt-PT'],
  de: ['de-DE'], fr: ['fr-FR', 'fr-CA'], it: ['it'], id: ['id'],
}
const SHOT_TYPES = { 'ios-iphone-69': 'APP_IPHONE_67', 'ios-ipad-13': 'APP_IPAD_PRO_3GEN_129' }

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
let jwt = ''
let jwtAt = 0
function token() {
  const now = Math.floor(Date.now() / 1000)
  if (jwt && now - jwtAt < 600) return jwt
  const head = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' })
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  jwt = `${head}.${body}.${sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(process.env.ASC_KEY_P8), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
  jwtAt = now
  return jwt
}
async function api(method, path, data) {
  if (dry && method !== 'GET') {
    console.log(`DRY ${method} ${path} ${JSON.stringify(data?.data?.attributes ?? {}).slice(0, 100)}`)
    return { data: { id: 'dry', attributes: { uploadOperations: [] } } }
  }
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined,
  })
  const t = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${t.slice(0, 600)}`)
  return t ? JSON.parse(t) : {}
}

/** Reserve, upload the parts, commit with the checksum (screenshots and previews work the same way). */
async function upload(kind, setRel, setId, file, extra = {}) {
  const bytes = readFileSync(file)
  const r = await api('POST', `/v1/${kind}`, {
    data: { type: kind, attributes: { fileName: file.split(/[\\/]/).pop(), fileSize: bytes.length, ...extra }, relationships: { [setRel]: { data: { type: `${setRel}s`, id: setId } } } },
  })
  if (dry) return r.data.id
  for (const op of r.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]))
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) })
    if (!res.ok) throw new Error(`upload ${file} -> ${res.status}`)
  }
  await api('PATCH', `/v1/${kind}/${r.data.id}`, { data: { type: kind, id: r.data.id, attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } } })
  return r.data.id
}

/** --repair: keep finished screenshots, re-upload only missing or stuck ones, then restore the file order. */
async function repairSet(locId, type, d, files) {
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=50`)).data
  const set = sets.find((s) => s.attributes.screenshotDisplayType === type)
  if (!set) return { set: await freshSet(locId, 'appScreenshotSets', 'screenshotDisplayType', type), redo: files }
  const items = (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data
  const ids = []
  let fixed = 0
  for (const f of files) {
    const it = items.find((x) => x.attributes.fileName === f)
    if (it && it.attributes.assetDeliveryState?.state === 'COMPLETE') { ids.push(it.id); continue }
    if (it) await api('DELETE', `/v1/appScreenshots/${it.id}`)
    ids.push(await upload('appScreenshots', 'appScreenshotSet', set.id, join(d, f)))
    fixed++
  }
  for (const x of items) if (!files.includes(x.attributes.fileName)) await api('DELETE', `/v1/appScreenshots/${x.id}`)
  if (fixed && !dry) await api('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: 'appScreenshots', id })) })
  return { fixed }
}

/** The set of `type` for a localization, emptied (created when missing). */
async function freshSet(locId, setKind, typeAttr, type) {
  const rel = setKind === 'appScreenshotSets' ? 'appScreenshotSets' : 'appPreviewSets'
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${locId}/${rel}?limit=50`)).data
  let set = sets.find((s) => s.attributes[typeAttr] === type)
  if (set) {
    const items = (await api('GET', `/v1/${setKind}/${set.id}/${setKind === 'appScreenshotSets' ? 'appScreenshots' : 'appPreviews'}?limit=50`)).data
    for (const it of items) await api('DELETE', `/v1/${setKind === 'appScreenshotSets' ? 'appScreenshots' : 'appPreviews'}/${it.id}`)
  } else {
    set = (await api('POST', `/v1/${setKind}`, { data: { type: setKind, attributes: { [typeAttr]: type }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } } })).data
  }
  return set.id
}

const ver = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${version}`)).data[0]
if (!ver) throw new Error(`version ${version} not found (create it first with store-metadata.yml)`)
const locs = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=200`)).data
const locId = (code) => locs.find((l) => l.attributes.locale === code)?.id
let n = 0
for (const [lang, codes] of Object.entries(LOCALES)) {
  for (const code of codes) {
    const id = locId(code)
    if (!id) continue
    for (const [folder, type] of Object.entries(SHOT_TYPES)) {
      const d = join(dir, 'screens', folder, lang)
      if (!existsSync(d)) continue
      const files = readdirSync(d).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort().slice(0, 10)
      if (repair) {
        const r = await repairSet(id, type, d, files)
        if (r.redo) for (const f of r.redo) await upload('appScreenshots', 'appScreenshotSet', r.set, join(d, f))
        const k = r.redo ? r.redo.length : r.fixed
        n += k
        if (k) console.log(`${code} ${type}: ${k} re-uploaded`)
        continue
      }
      const set = await freshSet(id, 'appScreenshotSets', 'screenshotDisplayType', type)
      for (const f of files) await upload('appScreenshots', 'appScreenshotSet', set, join(d, f))
      n += files.length
      console.log(`${code} ${type}: ${files.length} screenshots`)
    }
    const pv = join(dir, 'previews', `${lang}.mp4`)
    if (existsSync(pv) && !repair) {
      const set = await freshSet(id, 'appPreviewSets', 'previewType', 'IPHONE_67')
      await upload('appPreviews', 'appPreviewSet', set, pv, { mimeType: 'video/mp4', previewFrameTimeCode: '00:00:05:00' })
      console.log(`${code} IPHONE_67: preview`)
    }
  }
}
console.log(`done: ${n} screenshots`)
