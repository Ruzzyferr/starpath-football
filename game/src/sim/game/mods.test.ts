import { describe, expect, it } from 'vitest'
import { COUNTRY_DEFS } from '../../data/world/countries'
import { canonicalJson, checkModSignature, installMod, isModded, isOfficialSigned, MOD_MAX_BYTES, MOD_MAX_INSTALLED, mergedNameList, modSignature, validateModPack, verifySignature } from './mods'

const cities = Array.from({ length: 12 }, (_, i) => `Town ${String.fromCharCode(65 + i)}`)
const good = {
  format: 'starpath-mod', id: 'northern-isles', version: '1.0.0', name: 'Northern Isles', author: 'Someone',
  countries: [{
    id: 'NIS', name: { tr: 'Kuzey Adaları', en: 'Northern Isles' }, adjective: { tr: 'Adalı', en: 'Islander' }, flag: ['#112233', '#FFFFFF', '#AA0000'],
    reputation: 40, nameStyle: 'english', leagueNames: ['Isles Premier', 'Isles Division One', 'Isles Division Two'],
    cupName: { tr: 'Ada Kupası', en: 'Isles Cup' }, cities,
  }],
  names: [{ style: 'english', last: ['Aberdeen', 'Brodie', 'Calder', 'Dunn', 'Elgin', 'Fraser', 'Gunn', 'Hay'] }],
}
const text = (o: unknown): string => JSON.stringify(o)

describe('validateModPack', () => {
  it('accepts a well formed data pack', () => {
    const r = validateModPack(text(good))
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.pack?.id).toBe('northern-isles')
  })
  it('rejects bad json, oversize files, wrong format and unknown fields (no code carriers)', () => {
    expect(validateModPack('{nope').ok).toBe(false)
    expect(validateModPack(' '.repeat(MOD_MAX_BYTES + 1)).errors[0]).toMatch(/too large/)
    expect(validateModPack(text({ ...good, format: 'x' })).ok).toBe(false)
    expect(validateModPack(text({ ...good, script: 'alert(1)' })).errors.join()).toMatch(/unknown field "script"/)
    expect(validateModPack(text({ ...good, countries: [{ ...good.countries[0], onload: 'x' }] })).errors.join()).toMatch(/unknown field "onload"/)
  })
  it('reuses the world-data rules and refuses duplicate or existing country ids', () => {
    const bad = { ...good, countries: [{ ...good.countries[0], reputation: 400, cities: cities.slice(0, 3), flag: ['red', '#fff', '#000'] }] }
    const errs = validateModPack(text(bad)).errors.join(' | ')
    expect(errs).toMatch(/reputation out of range/)
    expect(errs).toMatch(/needs >=12 unique cities/)
    expect(errs).toMatch(/flag must be 3 hex/)
    const taken = { ...good, countries: [{ ...good.countries[0], id: COUNTRY_DEFS[0].id }] }
    expect(validateModPack(text(taken), COUNTRY_DEFS.map((c) => c.id)).errors.join()).toMatch(/already exists/)
    expect(validateModPack(text({ ...good, names: [{ style: 'english', last: ['A', 'A', 'b', 'c', 'd', 'e', 'f', 'g'] }] })).errors.join()).toMatch(/duplicates/)
    expect(validateModPack(text({ format: 'starpath-mod', id: 'empty-one', version: '1.0.0', name: 'x' })).errors.join()).toMatch(/changes nothing/)
  })
})

describe('install, modded flag and save signature', () => {
  const pack = validateModPack(text(good)).pack!
  it('unofficial mods make a career modded; disabling clears it; the cap holds', () => {
    let list = installMod([], pack, false, 100, 1).list
    expect(isModded(list)).toBe(true)
    expect(modSignature(list)).toEqual(['northern-isles@1.0.0'])
    list = list.map((m) => ({ ...m, enabled: false }))
    expect(isModded(list)).toBe(false)
    const official = installMod([], pack, true, 100, 1).list
    expect(isModded(official)).toBe(false)
    let full = official
    for (let i = 0; i < MOD_MAX_INSTALLED; i++) full = installMod(full, { ...pack, id: `mod-${i}x` }, false, 1, 1).list
    expect(installMod(full, { ...pack, id: 'one-more' }, false, 1, 1).error).toBe('limit')
  })
  it('warns about missing or re-versioned mods before loading', () => {
    const list = installMod([], pack, false, 1, 1).list
    expect(checkModSignature(['northern-isles@1.0.0'], list)).toEqual({ missing: [], versionDiffers: [] })
    expect(checkModSignature(['northern-isles@0.9.0', 'gone@1.0.0'], list)).toEqual({ missing: ['gone'], versionDiffers: ['northern-isles'] })
  })
  it('merges mod names into a pool without duplicates', () => {
    const list = installMod([], pack, false, 1, 1).list
    expect(mergedNameList('english', 'last', ['Aberdeen', 'Zed'], list)).toEqual(['Aberdeen', 'Zed', 'Brodie', 'Calder', 'Dunn', 'Elgin', 'Fraser', 'Gunn', 'Hay'])
    expect(mergedNameList('turkish', 'last', ['Yılmaz'], list)).toEqual(['Yılmaz'])
  })
})

describe('Ed25519 pack signatures', () => {
  const toHex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
  it('canonical json is key-order independent', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }))
  })
  it('verifies a signed pack, and rejects tampered, unsigned or foreign-signed ones', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair
    const pub = toHex(await crypto.subtle.exportKey('raw', kp.publicKey))
    const sig = toHex(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, new TextEncoder().encode(canonicalJson(good))))
    expect(await verifySignature(good, sig, pub)).toBe(true)
    expect(await verifySignature({ ...good, version: '9.9.9' }, sig, pub)).toBe(false)
    expect(await verifySignature(good, 'zz', pub)).toBe(false)
    expect(await isOfficialSigned(text({ ...good, signature: sig }), [pub])).toBe(true)
    expect(await isOfficialSigned(text({ ...good, signature: sig }), [])).toBe(false)
    expect(await isOfficialSigned(text(good), [pub])).toBe(false)
    expect(await isOfficialSigned(text({ ...good, version: '2.0.0', signature: sig }), [pub])).toBe(false)
    const other = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair
    expect(await isOfficialSigned(text({ ...good, signature: sig }), [toHex(await crypto.subtle.exportKey('raw', other.publicKey))])).toBe(false)
  })
})
