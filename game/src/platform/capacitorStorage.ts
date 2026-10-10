/**
 * Capacitor (Android/iOS) SaveStorage on @capacitor/filesystem: app-private
 * Directory.Data/saves/<key>.json.
 *
 * Atomic write: write <key>.json.tmp → verify its size → rename over the live
 * file. If the platform's rename refuses to overwrite, the live file is removed
 * first; a crash in that window leaves the verified .tmp, which get() falls back to.
 *
 * iOS (TestFlight build 4, "manual save broken"): the Filesystem plugin's
 * Directory-scoped paths go through a containment check that canonicalises
 * symlinks (/var → /private/var) only for files that already exist, so creating
 * a NEW file (the `saves` folder, every `.tmp`) can be rejected as "escaping"
 * Documents and every save fails. We therefore resolve the Documents URI once
 * (an existing directory, which passes the check) and address files by absolute
 * `file://` URI without a `directory`, which skips that check entirely.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { SaveStorage } from '../state/save'
import { assertKey } from './keys'

const DIR = Directory.Data
const ROOT = 'saves'

/** Where files live: either Directory-relative paths or absolute file:// URIs. */
interface Loc {
  file(key: string): string
  root: string
  opts: { directory?: Directory }
}

const relLoc: Loc = { file: (key) => `${ROOT}/${assertKey(key)}.json`, root: ROOT, opts: { directory: DIR } }

/** UTF-8 byte length (what the file size must be after a UTF-8 write). */
export function utf8Length(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4
      i++
    } else n += 3
  }
  return n
}

export interface CapacitorStorageOptions {
  /** Address files by absolute URI (iOS: avoids the plugin's containment check on new files). */
  absolute?: boolean
}

export class CapacitorFileStorage implements SaveStorage {
  private ready: Promise<Loc> | null = null

  private readonly options: CapacitorStorageOptions

  constructor(options: CapacitorStorageOptions = {}) {
    this.options = options
  }

  private async resolveLoc(): Promise<Loc> {
    if (!this.options.absolute) return relLoc
    try {
      const { uri } = await Filesystem.getUri({ path: '', directory: DIR })
      if (!uri) return relLoc
      const base = uri.endsWith('/') ? uri : `${uri}/`
      const root = `${base}${ROOT}`
      return { file: (key) => `${root}/${assertKey(key)}.json`, root, opts: {} }
    } catch {
      return relLoc
    }
  }

  private loc(): Promise<Loc> {
    this.ready ??= this.resolveLoc().then(async (loc) => {
      await Filesystem.mkdir({ path: loc.root, ...loc.opts, recursive: true }).catch(() => undefined) // already exists
      return loc
    })
    return this.ready
  }

  private async readOrNull(loc: Loc, p: string): Promise<string | null> {
    try {
      const r = await Filesystem.readFile({ path: p, ...loc.opts, encoding: Encoding.UTF8 })
      return typeof r.data === 'string' ? r.data : null
    } catch {
      return null
    }
  }

  private async removeQuiet(loc: Loc, p: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: p, ...loc.opts })
    } catch {
      /* missing */
    }
  }

  /** Cheap verification (no 2 MB read-back over the bridge): size check, read-back only when stat is unavailable. */
  private async verify(loc: Loc, p: string, value: string): Promise<boolean> {
    try {
      const st = await Filesystem.stat({ path: p, ...loc.opts })
      if (typeof st.size === 'number' && st.size > 0) return st.size === utf8Length(value)
    } catch {
      /* fall through */
    }
    return (await this.readOrNull(loc, p)) === value
  }

  async get(key: string): Promise<string | null> {
    const loc = await this.loc()
    const p = loc.file(key)
    return (await this.readOrNull(loc, p)) ?? (await this.readOrNull(loc, `${p}.tmp`))
  }

  async set(key: string, value: string): Promise<void> {
    const loc = await this.loc()
    const p = loc.file(key)
    const tmp = `${p}.tmp`
    await Filesystem.writeFile({ path: tmp, ...loc.opts, data: value, encoding: Encoding.UTF8, recursive: true })
    if (!(await this.verify(loc, tmp, value))) throw new Error('Save write verification failed')
    try {
      await Filesystem.rename({ from: tmp, to: p, ...(loc.opts.directory ? { directory: DIR, toDirectory: DIR } : {}) })
    } catch {
      await this.removeQuiet(loc, p)
      await Filesystem.rename({ from: tmp, to: p, ...(loc.opts.directory ? { directory: DIR, toDirectory: DIR } : {}) })
    }
  }

  async remove(key: string): Promise<void> {
    const loc = await this.loc()
    const p = loc.file(key)
    await this.removeQuiet(loc, p)
    await this.removeQuiet(loc, `${p}.tmp`)
  }
}
