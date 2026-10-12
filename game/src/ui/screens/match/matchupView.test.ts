import { describe, expect, it } from 'vitest'
import { t } from '../../../i18n'
import { ALL_KINDS, generatedHighlight } from '../../../game/demoHighlights'
import { matchupViewOf } from '../../backend/matchupView'
import type { Lang } from '../../../core/types'

const LANGS: Lang[] = ['tr', 'en']
const KEYS = [
  'title', 'you', 'edgeHero', 'edgeOpp', 'edgeEven', 'roleKeeper', 'roleMarker', 'roleCarrier', 'roleAttacker', 'roleAerial', 'ovr', 'label',
] as const

describe('moment matchup card: the chance line (owner, build 9: +1 point = +1 %)', () => {
  it('shows the deciding chance as the game rolls it, in both languages', async () => {
    const { statChancePct } = await import('../../../game/statChance')
    for (const kind of ['defend', 'dribble', 'header', 'gk_1v1', 'interception'] as const) {
      const mu = matchupViewOf(generatedHighlight(kind, 3), {}, 'Test')
      expect(mu?.chance, kind).toBeTruthy()
      const c = mu!.chance!
      expect(c.pct).toBe(statChancePct(c.heroV, c.oppV))
      for (const lang of LANGS) {
        const line = t('match.live.matchup.chance', { e: t(`match.live.matchup.events.${c.event}`, undefined, lang), p: c.pct, a: 'A', c: c.heroV, b: 'B', d: c.oppV ?? 0 }, lang)
        expect(line).toContain(String(c.pct))
        expect(t(`match.live.matchup.events.${c.event}`, undefined, lang)).not.toMatch(/^match\./)
      }
    }
    // Shots and saves are physics and aim, not a roll: no chance line.
    expect(matchupViewOf(generatedHighlight('long_shot', 3), {}, 'Test')?.chance).toBeUndefined()
  })
})

describe('moment matchup card', () => {
  it('every card string exists, non-empty, in TR and EN', () => {
    for (const lang of LANGS) {
      for (const k of KEYS) {
        const key = `match.live.matchup.${k}` as const
        const v = t(key, { n: 70, a: 'a', b: 'b', c: 1, d: 2 }, lang)
        expect(v, `${lang} ${key}`).not.toBe(key)
        expect(v.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('every kind builds a view whose role, edge and attribute labels resolve in both languages', () => {
    const roleKey = { keeper: 'roleKeeper', marker: 'roleMarker', carrier: 'roleCarrier', attacker: 'roleAttacker', aerial: 'roleAerial' } as const
    for (const kind of ALL_KINDS) {
      const mu = matchupViewOf(generatedHighlight(kind, 3), {}, 'Test')
      expect(mu, kind).toBeTruthy()
      if (!mu) continue
      expect(mu.hero.name).toBe('Test')
      expect(mu.rows.length).toBeGreaterThanOrEqual(3)
      for (const lang of LANGS) {
        expect(t(`match.live.matchup.${roleKey[mu.role]}`, undefined, lang)).not.toMatch(/^match\./)
        for (const r of mu.rows) {
          expect(t(`data.attr.${r.heroKey}`, undefined, lang), `${lang} ${r.heroKey}`).not.toMatch(/^data\./)
          expect(t(`data.attr.${r.oppKey}`, undefined, lang)).not.toMatch(/^data\./)
          expect(t(`data.attrShort.${r.oppKey}`, undefined, lang)).not.toMatch(/^data\./)
        }
      }
    }
  })
})
