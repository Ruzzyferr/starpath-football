// After `vite build`: drop dev-only files and list what will be deployed.
import { rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
rmSync(resolve(dist, 'dev'), { recursive: true, force: true })
let total = 0
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'play') walk(p) } else total += statSync(p).size } }
walk(dist)
console.log(`site dist (without /play): ${(total / 1024).toFixed(0)} KB`)
