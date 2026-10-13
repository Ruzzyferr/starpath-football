/**
 * Old Android System WebView support (Galaxy A52 black-screen report): the production bundle must
 * parse at the target ECMAScript edition, the boot guard must parse as ES5, and the engine floor
 * must agree everywhere it is written down.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'acorn'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MIN_CHROME, TARGET_ECMA, chromeMajor, webViewTooOld } from './compat'

const ROOT = process.cwd()
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')

describe('engine floor (MIN_CHROME) is consistent', () => {
  it('boot guard, vite target and Capacitor minWebViewVersion agree', () => {
    expect(read('public/boot-guard.js')).toContain(`var MIN_CHROME = ${MIN_CHROME}`)
    expect(read('vite.config.ts')).toMatch(new RegExp(`target: \\['es${TARGET_ECMA}', 'chrome${MIN_CHROME}'`))
    expect(read('vite.config.ts')).toMatch(new RegExp(`cssTarget: \\['chrome${MIN_CHROME}'`))
    const cap = JSON.parse(read('capacitor.config.json')) as { android: { minWebViewVersion: number } }
    expect(cap.android.minWebViewVersion).toBe(MIN_CHROME)
  })

  it('index.html loads the boot guard as a classic script before the app module', () => {
    const html = read('index.html')
    const guard = html.indexOf('<script src="./boot-guard.js"></script>')
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(html.indexOf('type="module"'))
  })

  it('the boot guard is ES5 (it must run where the bundle cannot)', () => {
    expect(() => parse(read('public/boot-guard.js'), { ecmaVersion: 5, sourceType: 'script' })).not.toThrow()
  })

  it('parses WebView versions from user agents', () => {
    const a52Old = 'Mozilla/5.0 (Linux; Android 11; SM-A525F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36'
    expect(chromeMajor(a52Old)).toBe(83)
    expect(webViewTooOld(a52Old)).toBe(false)
    expect(webViewTooOld(a52Old.replace('Chrome/83', 'Chrome/79'))).toBe(true)
    expect(chromeMajor('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')).toBeNull()
    expect(webViewTooOld('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148')).toBe(false)
  })
})

describe(`production bundle parses at ES${TARGET_ECMA}`, () => {
  let out = ''
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'sp-compat-'))
    execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' })
  }, 240_000)
  afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true })
  })

  it('every emitted chunk is valid ES' + TARGET_ECMA, () => {
    const dir = join(out, 'assets')
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
    expect(files.length).toBeGreaterThan(5)
    const failures: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      try {
        parse(src, { ecmaVersion: TARGET_ECMA, sourceType: 'module' })
      } catch (e) {
        const pos = (e as { pos?: number }).pos ?? 0
        failures.push(`${f}: ${(e as Error).message} near ${JSON.stringify(src.slice(Math.max(0, pos - 40), pos + 20))}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('the shipped page keeps the boot guard', () => {
    const html = readFileSync(join(out, 'index.html'), 'utf8')
    expect(html).toContain('boot-guard.js')
    expect(() => parse(readFileSync(join(out, 'boot-guard.js'), 'utf8'), { ecmaVersion: 5 })).not.toThrow()
  })
})
