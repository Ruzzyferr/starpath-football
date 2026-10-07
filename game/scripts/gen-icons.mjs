// Renders the app icon SVG (build-resources/icon.svg) into every PNG the PWA,
// Electron and Capacitor need. Run: npm run icons  (uses the `sharp` devDependency)
import sharp from 'sharp'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build-resources/icon.svg'))
const NAVY = '#0B1220'

// Full-bleed variant for maskable / apple-touch / Android adaptive: square navy
// background, artwork scaled into the 80% safe zone.
function bleed(scale) {
  const inner = svg.toString()
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '')
    .replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '')
  const off = (512 * (1 - scale)) / 2
  const defs = inner.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? ''
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="${NAVY}"/><rect width="512" height="512" fill="url(#bg)"/><g transform="translate(${off} ${off}) scale(${scale})">${inner}</g></svg>`)
}

async function png(src, size, out) {
  mkdirSync(dirname(out), { recursive: true })
  await sharp(src, { density: Math.max(72, Math.ceil((72 * size) / 512) * 2) }).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log('  ', out.replace(root, '.'), size)
}

const pub = join(root, 'public/icons')
for (const s of [48, 72, 96, 128, 144, 192, 256, 384, 512]) await png(svg, s, join(pub, `icon-${s}.png`))
for (const s of [192, 512]) await png(bleed(0.8), s, join(pub, `maskable-${s}.png`))
await png(bleed(0.9), 180, join(pub, 'apple-touch-icon.png'))
writeFileSync(join(root, 'public/favicon.svg'), svg)

// Electron (electron-builder converts the 1024 PNG to .ico / .icns).
await png(svg, 1024, join(root, 'build-resources/icon.png'))
await png(bleed(0.8), 1024, join(root, 'build-resources/icon-bleed.png'))
// Capacitor assets source (for `npx @capacitor/assets generate` if used later).
await png(bleed(0.62), 1024, join(root, 'build-resources/icon-foreground.png'))
