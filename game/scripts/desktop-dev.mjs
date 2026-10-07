// `npm run desktop:dev`: Vite dev server + Electron pointed at it (SP_DEV_URL), HMR included.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const electronBin = require('electron') // path to the Electron binary

const server = await createServer({ server: { port: 5173, strictPort: false, host: '127.0.0.1' } })
await server.listen()
const url = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:5173/'
console.log(`[desktop:dev] vite ready at ${url}, starting Electron`)

const child = spawn(electronBin, ['.'], { stdio: 'inherit', env: { ...process.env, SP_DEV_URL: url } })
child.on('exit', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill())
