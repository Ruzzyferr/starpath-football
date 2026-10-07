/**
 * Capacitor (Android/iOS) SaveStorage on @capacitor/filesystem: app-private
 * Directory.Data/saves/<key>.json.
 *
 * Atomic write: write <key>.json.tmp → read back + compare → rename over the
 * live file. If the platform's rename refuses to overwrite, the live file is
 * removed first; a crash in that window leaves the verified .tmp, which get()
 * falls back to.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { SaveStorage } from '../state/save'
import { assertKey } from './keys'

const DIR = Directory.Data
const ROOT = 'saves'
const path = (key: string) => `${ROOT}/${assertKey(key)}.json`

async function readOrNull(p: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path: p, directory: DIR, encoding: Encoding.UTF8 })
    return typeof r.data === 'string' ? r.data : null
  } catch {
    return null
  }
}

async function removeQuiet(p: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: p, directory: DIR })
  } catch {
    /* missing */
  }
}

export class CapacitorFileStorage implements SaveStorage {
  private ready: Promise<void> | null = null

  private ensureDir(): Promise<void> {
    this.ready ??= Filesystem.mkdir({ path: ROOT, directory: DIR, recursive: true }).then(
      () => undefined,
      () => undefined, // already exists
    )
    return this.ready
  }

  async get(key: string): Promise<string | null> {
    await this.ensureDir()
    const p = path(key)
    return (await readOrNull(p)) ?? (await readOrNull(`${p}.tmp`))
  }

  async set(key: string, value: string): Promise<void> {
    await this.ensureDir()
    const p = path(key)
    const tmp = `${p}.tmp`
    await Filesystem.writeFile({ path: tmp, directory: DIR, data: value, encoding: Encoding.UTF8, recursive: true })
    if ((await readOrNull(tmp)) !== value) throw new Error('Save write verification failed')
    try {
      await Filesystem.rename({ from: tmp, to: p, directory: DIR, toDirectory: DIR })
    } catch {
      await removeQuiet(p)
      await Filesystem.rename({ from: tmp, to: p, directory: DIR, toDirectory: DIR })
    }
  }

  async remove(key: string): Promise<void> {
    await this.ensureDir()
    const p = path(key)
    await removeQuiet(p)
    await removeQuiet(`${p}.tmp`)
  }
}
