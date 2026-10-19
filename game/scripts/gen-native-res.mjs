// Writes Kickborn launcher icons + splash screens into the generated native
// projects (android/app/src/main/res and ios/App/App/Assets.xcassets).
// Run after `npx cap add android|ios`:  npm run icons:native
import sharp from 'sharp'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const res = join(root, 'android/app/src/main/res')

const NAVY = '#0B1220'
const svg = readFileSync(join(root, 'build-resources/icon.svg'), 'utf8')
const body = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')
const defs = body.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? ''
// Artwork only (no rounded background) for the adaptive-icon foreground layer.
const art = body.replace(/<rect width="512" height="512" rx="112"[^>]*\/>/, '')

const wrap = (inner, scale, bg) => {
  const off = (512 * (1 - scale)) / 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg ?? ''}<g transform="translate(${off} ${off}) scale(${scale})">${inner}</g></svg>`,
  )
}

if (existsSync(res)) {
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(DENS)) {
  const dir = join(res, `mipmap-${d}`)
  const legacy = Math.round(48 * k)
  const fg = Math.round(108 * k)
  await sharp(Buffer.from(svg), { density: 300 }).resize(legacy, legacy).png().toFile(join(dir, 'ic_launcher.png'))
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256"/></svg>`)
  await sharp(wrap(art, 0.86, `<rect width="512" height="512" fill="url(#bg)"/>`), { density: 300 })
    .resize(legacy, legacy)
    .composite([{ input: await sharp(circle).resize(legacy, legacy).png().toBuffer(), blend: 'dest-in' }])
    .png()
    .toFile(join(dir, 'ic_launcher_round.png'))
  // Adaptive foreground: 108dp canvas, keep artwork inside the 66dp safe circle.
  await sharp(wrap(art, 0.6), { density: 300 }).resize(fg, fg).png().toFile(join(dir, 'ic_launcher_foreground.png'))
}
writeFileSync(
  join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${NAVY}</color>\n</resources>\n`,
)

// Splash: every existing splash.png keeps its size; icon centred on navy.
for (const d of readdirSync(res).filter((x) => x.startsWith('drawable'))) {
  const f = join(res, d, 'splash.png')
  if (!existsSync(f)) continue
  const { width = 480, height = 320 } = await sharp(f).metadata()
  const s = Math.round(Math.min(width, height) * 0.36)
  const icon = await sharp(Buffer.from(svg), { density: 300 }).resize(s, s).png().toBuffer()
  const out = await sharp({ create: { width, height, channels: 4, background: NAVY } })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toBuffer()
  writeFileSync(f, out)
}
console.log('Android launcher icons + splash written to', res)
}

// iOS: 1024 opaque app icon (Apple rejects alpha) + 2732² splash.
const xc = join(root, 'ios/App/App/Assets.xcassets')
if (existsSync(xc)) {
  const bleed = wrap(art, 0.86, `<rect width="512" height="512" fill="${NAVY}"/><rect width="512" height="512" fill="url(#bg)"/>`)
  await sharp(bleed, { density: 300 }).resize(1024, 1024).flatten({ background: NAVY }).png().toFile(join(xc, 'AppIcon.appiconset/AppIcon-512@2x.png'))
  const icon = await sharp(Buffer.from(svg), { density: 600 }).resize(820, 820).png().toBuffer()
  const splash = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: NAVY } })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toBuffer()
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) writeFileSync(join(xc, 'Splash.imageset', f), splash)
  console.log('iOS app icon + splash written to', xc)
}
