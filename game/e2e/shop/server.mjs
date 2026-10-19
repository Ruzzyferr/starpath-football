// e2e: start the real shop server (repo server/) with a fixed TEST grant key, so the app built for
// e2e (VITE_SHOP_PUBKEY = e2e/shop/test-grant-pub.txt) can verify the grants it receives.
// This key is for local tests only; production signs with its own key on the droplet.
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
const dir = process.env.DATA_DIR
mkdirSync(dir, { recursive: true })
copyFileSync(new URL('./test-grant-key.pem', import.meta.url), join(dir, 'grant-key.pem'))
await import('../../../server/src/main.mjs')
