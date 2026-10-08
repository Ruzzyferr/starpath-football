/** Shared helpers for the mock backend: state access, views, delta application. */
import { Rng, clamp } from '../../core/rng'
import { ATTRIBUTE_KEYS, type AttributeKey, type Club, type Competition, type Fixture, type GameState, type LText, type LogEntry, type NewsItem } from '../../core/types'
import { gameState, settings } from '../store'
import type { Delta, FixtureView, TeamView } from '../store'
import type { MDelta } from './mockContent'

export function get(): GameState {
  const s = gameState.value
  if (!s) throw new Error('mock backend: no career loaded')
  return s
}

/** Publish a mutated state as fresh objects so every signal/computed updates. */
export function commit(s: GameState): void {
  s.meta.updatedAt = Date.now()
  gameState.value = {
    ...s,
    calendar: { ...s.calendar },
    hero: { ...s.hero, attrs: { ...s.hero.attrs }, seasonStats: { ...s.hero.seasonStats } },
    life: {
      ...s.life,
      bank: { ...s.life.bank, investments: [...s.life.bank.investments] },
      assets: [...s.life.assets],
      relationships: { ...s.life.relationships },
      log: [...s.life.log],
      news: [...s.life.news],
      sponsors: [...s.life.sponsors],
      casino: { ...s.life.casino },
      flags: { ...s.life.flags },
    },
    world: { ...s.world },
    pendingEvents: [...s.pendingEvents],
  }
}

/** Run `fn` with a seeded RNG derived from (and written back to) state.rng. */
export function withRng<T>(s: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(s.rng)
  const out = fn(rng)
  s.rng = rng.state
  return out
}

export const lang = () => settings.value.lang
export const L = (tr: string, en: string): LText => ({ tr, en })

export function heroClubId(s: GameState): string | null {
  return s.hero.contract?.clubId ?? null
}

export function teamView(s: GameState, id: string): TeamView | null {
  const c = s.world.clubs[id]
  if (!c) return null
  return { id: c.id, name: c.name, shortName: c.shortName, crest: c.crest, kit: c.colors, reputation: c.reputation }
}

export const absDay = (week: number, day: number) => week * 7 + day

export function compOf(s: GameState, f: Fixture): Competition | undefined {
  return s.world.competitions[f.compId]
}

export function fixtureView(s: GameState, f: Fixture, heroId: string | null): FixtureView | null {
  const home = teamView(s, f.homeId)
  const away = teamView(s, f.awayId)
  if (!home || !away) return null
  const comp = compOf(s, f)
  const homeClub = s.world.clubs[f.homeId] as Club
  return {
    fixtureId: f.id,
    compName: comp?.name ?? L('Hazırlık', 'Friendly'),
    compType: comp?.type ?? 'friendly',
    home,
    away,
    week: f.week,
    day: f.day,
    isHome: f.homeId === heroId,
    venue: homeClub.stadium.name,
    daysUntil: absDay(f.week, f.day) - absDay(s.calendar.week, s.calendar.day),
    result: f.result,
  }
}

export function heroFixtures(s: GameState): Fixture[] {
  const id = heroClubId(s)
  if (!id) return []
  const out: Fixture[] = []
  for (const c of Object.values(s.world.competitions)) {
    if (c.season !== s.calendar.season) continue
    for (const f of c.fixtures) if (f.homeId === id || f.awayId === id) out.push(f)
  }
  return out.sort((a, b) => absDay(a.week, a.day) - absDay(b.week, b.day))
}

export function nextHeroFixture(s: GameState): Fixture | null {
  const today = absDay(s.calendar.week, s.calendar.day)
  return heroFixtures(s).find((f) => !f.result && absDay(f.week, f.day) >= today) ?? null
}

export function isMatchSlotNow(s: GameState): boolean {
  const f = nextHeroFixture(s)
  return !!f && absDay(f.week, f.day) === absDay(s.calendar.week, s.calendar.day) && s.calendar.slot === 2
}

export function addLog(s: GameState, text: LText, kind: LogEntry['kind'], icon?: string): void {
  s.life.log = [{ season: s.calendar.season, week: s.calendar.week, day: s.calendar.day, text, kind, icon }, ...s.life.log].slice(0, 200)
}

export function addNews(s: GameState, headline: LText, sentiment: -1 | 0 | 1, source = 'Yıldız Spor'): void {
  const item: NewsItem = { id: `n${Date.now().toString(36)}${s.life.news.length}`, season: s.calendar.season, week: s.calendar.week, headline, source, sentiment }
  s.life.news = [item, ...s.life.news].slice(0, 80)
}

const ATTR_SET = new Set<string>(ATTRIBUTE_KEYS)

/** Apply deltas to the state. Uncertain deltas are rolled (60% applied). */
export function applyDeltas(s: GameState, deltas: MDelta[], rng?: Rng): Delta[] {
  const applied: Delta[] = []
  for (const dl of deltas) {
    if (dl.uncertain && rng && !rng.chance(0.6)) continue
    const v = dl.value
    const { life, hero } = s
    switch (dl.key) {
      case 'money': life.money += v; break
      case 'energy': life.energy = clamp(life.energy + v, 0, 100); break
      case 'happiness': life.happiness = clamp(life.happiness + v, 0, 100); break
      case 'health': life.health = clamp(life.health + v, 0, 100); break
      case 'stress': life.stress = clamp(life.stress + v, 0, 100); break
      case 'discipline': life.discipline = clamp(life.discipline + v, 0, 100); break
      case 'reputation': hero.reputation = clamp(hero.reputation + v, 0, 100); break
      case 'followers': life.followers = Math.max(0, life.followers + v); break
      case 'form': hero.form = clamp(hero.form + v, 0, 100); break
      case 'morale': hero.morale = clamp(hero.morale + v, 0, 100); break
      case 'fatigue': hero.fatigue = clamp(hero.fatigue + v, 0, 100); break
      case 'sharpness': hero.sharpness = clamp(hero.sharpness + v, 0, 100); break
      case 'managerTrust': hero.managerTrust = clamp(hero.managerTrust + v, 0, 100); break
      case 'addiction': life.casino = { ...life.casino, addiction: clamp(life.casino.addiction + v, 0, 100) }; break
      case 'perkPoints': hero.perkPoints = Math.max(0, hero.perkPoints + v); break
      case 'xp': break
      case 'relation': {
        const targets = Object.values(life.relationships).filter((r) => (dl.rel ? r.kind === dl.rel : false))
        const list = dl.rel === 'teammate' ? targets : targets.slice(0, 1)
        for (const r of list) {
          life.relationships[r.id] = { ...r, value: clamp(r.value + v, -100, 100), lastContactWeek: s.calendar.week }
        }
        break
      }
      default:
        if (ATTR_SET.has(dl.key)) {
          const k = dl.key as AttributeKey
          hero.attrs = { ...hero.attrs, [k]: clamp(hero.attrs[k] + v, 1, 99) }
        }
    }
    const { rel: _rel, ...plain } = dl
    void _rel
    applied.push(plain)
  }
  return applied
}

export function netWorth(s: GameState): number {
  return s.life.money + s.life.bank.savings + s.life.bank.investments.reduce((a, i) => a + i.value, 0) - (s.life.bank.loan?.remaining ?? 0)
}

/** Deterministic random walk ending at `end`. */
export function series(seedStr: string, n: number, end: number, vol: number, drift = 0): number[] {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0
  const rng = new Rng(h)
  const out: number[] = new Array(n)
  out[n - 1] = end
  for (let i = n - 2; i >= 0; i--) out[i] = Math.max(0, out[i + 1]! * (1 - drift + (rng.next() - 0.5) * vol))
  return out.map((v) => Math.round(v))
}
