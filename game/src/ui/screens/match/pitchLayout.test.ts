import { describe, expect, it } from 'vitest'
import { FORMATIONS } from '../../../sim/world/formations'
import { formationSlots } from '../../../sim/match/formations'
import { BOX_H, NOM_H, NOM_W, layoutTeam, type LayoutIn, type LayoutOut } from './pitchLayout'

const NAMES = ['Albayrak', 'Bozkurt', 'Karadeniz', 'Yıldırım', 'Çalışkan', 'Seyim', 'Ünal', 'Demir', 'Özer', 'Aydın', 'Çelik', 'Tunç']
function team(f: (typeof FORMATIONS)[number], off: number): LayoutIn[] {
  return formationSlots(f).map((s, i) => ({
    id: `p${off}${i}`, label: NAMES[(i + off) % NAMES.length]!, isHero: off === 0 && i === 10,
    x: Math.min(1, Math.max(0.03, s.x / 52.5)), y: Math.min(0.95, Math.max(0.05, s.y / 68)),
  }))
}
const rect = (o: LayoutOut) => ({
  l: (o.leftPct / 100) * NOM_W - o.boxW / 2, r: (o.leftPct / 100) * NOM_W + o.boxW / 2,
  t: (o.topPct / 100) * NOM_H - BOX_H / 2, b: (o.topPct / 100) * NOM_H + BOX_H / 2,
})

describe('pre-match pitch layout', () => {
  for (const hf of FORMATIONS) for (const af of FORMATIONS) {
    it(`no overlapping label boxes ${hf} vs ${af}`, () => {
      const all = [...layoutTeam(team(hf, 0), 'home'), ...layoutTeam(team(af, 3), 'away')]
      expect(all).toHaveLength(22)
      for (const o of all) {
        const r = rect(o)
        expect(r.l).toBeGreaterThanOrEqual(-0.5)
        expect(r.r).toBeLessThanOrEqual(NOM_W + 0.5)
        expect(r.t).toBeGreaterThanOrEqual(0)
        expect(r.b).toBeLessThanOrEqual(NOM_H)
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = rect(all[i]!), b = rect(all[j]!)
        const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
        expect(overlap, `${all[i]!.id} x ${all[j]!.id}`).toBe(false)
      }
    })
  }
})
