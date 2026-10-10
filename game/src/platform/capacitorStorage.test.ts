/**
 * CapacitorFileStorage against a fake @capacitor/filesystem that reproduces the iOS
 * build-4 failure: Directory-scoped paths to files that do not exist yet are
 * rejected ("escapes directory"), absolute file:// URIs are not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const DOCS = 'file:///var/mobile/Containers/Data/Application/X/Documents/'
const files = new Map<string, string>()
const dirs = new Set<string>()
let strictDirectory = true

type Opts = { path: string; directory?: string }

function resolve(o: Opts): string {
  if (!o.directory) {
    if (!o.path.startsWith('file://')) throw new Error('raw path without scheme')
    return o.path.replace(/\/$/, '')
  }
  const full = (DOCS + o.path).replace(/\/$/, '')
  // iOS containment check: only existing items canonicalise like the Documents directory.
  if (strictDirectory && o.path !== '' && !files.has(full) && !dirs.has(full)) throw new Error('Invalid path: escapes directory')
  return full
}

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    getUri: async (o: Opts) => ({ uri: o.path === '' ? DOCS : resolve(o) }),
    mkdir: async (o: Opts) => {
      const p = resolve(o)
      if (dirs.has(p)) throw new Error('exists')
      dirs.add(p)
    },
    writeFile: async (o: Opts & { data: string }) => {
      const p = resolve(o)
      files.set(p, o.data)
      return { uri: p }
    },
    readFile: async (o: Opts) => {
      const p = resolve(o)
      if (!files.has(p)) throw new Error('missing')
      return { data: files.get(p) }
    },
    stat: async (o: Opts) => {
      const p = resolve(o)
      if (!files.has(p)) throw new Error('missing')
      return { size: new TextEncoder().encode(files.get(p)).length }
    },
    deleteFile: async (o: Opts) => {
      if (!files.delete(resolve(o))) throw new Error('missing')
    },
    rename: async (o: { from: string; to: string; directory?: string }) => {
      const from = resolve({ path: o.from, directory: o.directory })
      const to = o.directory ? DOCS + o.to : o.to
      if (!files.has(from)) throw new Error('missing')
      files.set(to, files.get(from) as string)
      files.delete(from)
    },
  },
}))

const { CapacitorFileStorage, utf8Length } = await import('./capacitorStorage')

beforeEach(() => {
  files.clear()
  dirs.clear()
  dirs.add(DOCS.replace(/\/$/, ''))
  strictDirectory = true
})

describe('CapacitorFileStorage', () => {
  it('reproduces the build-4 bug: Directory-relative writes of new files fail on iOS', async () => {
    const st = new CapacitorFileStorage()
    await expect(st.set('sp.save.0', 'x')).rejects.toThrow(/escapes/)
  })

  it('absolute mode (iOS) writes, verifies and reads back atomically', async () => {
    const st = new CapacitorFileStorage({ absolute: true })
    await st.set('sp.save.0', 'héllo ⚽')
    expect(await st.get('sp.save.0')).toBe('héllo ⚽')
    expect([...files.keys()]).toEqual([`${DOCS}saves/sp.save.0.json`])
    await st.set('sp.save.0', 'second')
    expect(await st.get('sp.save.0')).toBe('second')
    await st.remove('sp.save.0')
    expect(await st.get('sp.save.0')).toBeNull()
  })

  it('relative mode still works where the platform allows it (Android)', async () => {
    strictDirectory = false
    const st = new CapacitorFileStorage()
    await st.set('sp.save.2', 'android')
    expect(await st.get('sp.save.2')).toBe('android')
  })

  it('utf8Length matches TextEncoder', () => {
    for (const s of ['', 'abc', 'ğüşİ', '⚽🏆', 'x'.repeat(1000)]) expect(utf8Length(s)).toBe(new TextEncoder().encode(s).length)
  })
})
