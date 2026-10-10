/**
 * Mapping between sim data and UI view types: stat snapshots → Delta chips,
 * event deltas → Delta chips, clubs/fixtures → TeamView/FixtureView.
 */
import { ATTRIBUTE_KEYS, type AttributeKey, type Competition, type Fixture, type GameState, type LText, type RelationKind } from '../../core/types'
import { DAYS_PER_WEEK } from '../../core/config'
import type { AppliedDelta } from '../../sim/life/events/types'
import { SEASON_WEEKS } from '../../sim/world/fixtures'
import type { Delta, FixtureView, StatKey, TeamView } from '../store'
import { nationTeamView } from './nationView'
import { parseTeamId, teamName } from '../../sim/world/national'
import { currentLang } from '../../i18n'

const L = (tr: string, en: string): LText => ({ tr, en })

export const RELATION_LABEL: Record<RelationKind, LText> = {
  mother: L('Annen', 'Mum'), father: L('Baban', 'Dad'), sibling: L('Kardeşin', 'Sibling'), partner: L('Sevgilin', 'Partner'),
  bestFriend: L('Kanka', 'Best mate'), manager: L('TD ilişkisi', 'Manager relation'), teammate: L('Takım', 'Squad'), agent: L('Menajerin', 'Agent'),
  fans: L('Taraftar', 'Fans'), press: L('Basın', 'Press'), chairman: L('Başkan', 'Chairman'),
}

// ───────────────────────── Stat snapshots ─────────────────────────

/** Numbers the UI shows as delta chips. */
export interface StatSnapshot {
  stats: Partial<Record<StatKey, number>>
  attrs: Record<AttributeKey, number>
  rel: Record<string, { v: number; kind: RelationKind; name: string }>
}

export function snapshot(s: GameState): StatSnapshot {
  const { hero: h, life: l } = s
  const rel: StatSnapshot['rel'] = {}
  for (const r of Object.values(l.relationships)) rel[r.id] = { v: r.value, kind: r.kind, name: r.name }
  return {
    stats: {
      money: l.money, energy: l.energy, happiness: l.happiness, health: l.health, stress: l.stress, discipline: l.discipline,
      reputation: h.reputation, followers: l.followers, form: h.form, morale: h.morale, fatigue: h.fatigue, sharpness: h.sharpness,
      managerTrust: h.managerTrust, addiction: l.casino.addiction, perkPoints: h.perkPoints,
    },
    attrs: { ...h.attrs },
    rel,
  }
}

const STAT_ORDER: StatKey[] = [
  'money', 'energy', 'happiness', 'stress', 'health', 'fatigue', 'form', 'morale', 'sharpness', 'managerTrust', 'reputation',
  'followers', 'discipline', 'addiction', 'perkPoints',
]

/**
 * Differences between two snapshots as chips. Rounds to whole units, drops
 * zeros; several teammates changing together collapse into one "Squad" chip.
 */
export function diffSnapshots(a: StatSnapshot, b: StatSnapshot): Delta[] {
  const out: Delta[] = []
  for (const k of STAT_ORDER) {
    const d = Math.round((b.stats[k] ?? 0) - (a.stats[k] ?? 0))
    if (d !== 0) out.push({ key: k, value: d })
  }
  for (const k of ATTRIBUTE_KEYS) {
    const d = Math.round(b.attrs[k] - a.attrs[k])
    if (d !== 0) out.push({ key: k, value: d })
  }
  let squadSum = 0
  let squadN = 0
  for (const [id, after] of Object.entries(b.rel)) {
    const before = a.rel[id]?.v ?? 0
    const d = Math.round(after.v - before)
    if (d === 0) continue
    if (after.kind === 'teammate') {
      squadSum += d
      squadN++
    } else out.push({ key: 'relation', value: d, rel: after.kind, label: after.kind === 'fans' || after.kind === 'press' || after.kind === 'manager' || after.kind === 'chairman' ? RELATION_LABEL[after.kind] : after.name })
  }
  if (squadN > 0) {
    const avg = Math.round(squadSum / squadN) || Math.sign(squadSum)
    if (avg !== 0) out.push({ key: 'relation', value: avg, rel: 'teammate', label: RELATION_LABEL.teammate })
  }
  return out
}

// ───────────────────────── Event deltas ─────────────────────────

/** Event-engine applied/preview deltas → UI chips. */
export function eventDeltas(s: GameState, deltas: readonly AppliedDelta[], uncertain?: (i: number) => boolean): Delta[] {
  const out: Delta[] = []
  deltas.forEach((d, i) => {
    const u = uncertain?.(i) ? { uncertain: true } : {}
    switch (d.kind) {
      case 'money': out.push({ key: 'money', value: Math.round(d.amount), ...u }); break
      case 'relation': {
        const r = d.npcId ? Object.values(s.life.relationships).find((x) => x.npcId === d.npcId) : undefined
        const label: LText | string = d.label ?? (d.target === 'manager' ? RELATION_LABEL.manager : undefined) ?? d.name ?? r?.name ?? (d.target === 'teammate' && !d.npcId ? RELATION_LABEL.teammate : RELATION_LABEL[d.target])
        out.push({ key: 'relation', value: Math.round(d.amount), rel: d.target, label, ...u })
        break
      }
      case 'stat': out.push({ key: d.key, value: Math.round(d.amount), ...u }); break
      case 'attr': out.push({ key: d.key, value: Math.round(d.amount), ...u }); break
      case 'reputation': out.push({ key: 'reputation', value: Math.round(d.amount * 10) / 10, ...u }); break
      case 'followers': out.push({ key: 'followers', value: Math.round(d.amount), ...u }); break
      case 'discipline': out.push({ key: 'discipline', value: Math.round(d.amount), ...u }); break
      case 'injury': out.push({ key: 'health', value: -Math.max(1, Math.round(d.weeks)), label: { tr: `Sakatlık (${d.weeks} hf)`, en: `Injury (${d.weeks} wk)` }, ...u }); break
      case 'suspension': out.push({ key: 'discipline', value: -d.matches, label: { tr: `Ceza (${d.matches} maç)`, en: `Ban (${d.matches} match)` }, ...u }); break
      case 'objective': out.push({ key: 'reputation', value: 0, label: d.preset === 'dev_focus' ? { tr: 'Yeni hedef: gelişim planı', en: 'New objective: development plan' } : { tr: 'Yeni hedef: kendini kanıtla', en: 'New objective: prove yourself' }, ...u }); break
      case 'sponsorLoss': out.push({ key: 'reputation', value: 0, label: { tr: `Sponsor feshi: ${d.label ?? ''}`, en: `Sponsors out: ${d.label ?? ''}` }, ...u }); break
      case 'endRelation': out.push({ key: 'relation', value: -100, rel: d.target, label: RELATION_LABEL[d.target], ...u }); break
      case 'brand': out.push({ key: 'reputation', value: Math.round(d.amount), label: { tr: `Marka${d.label ? `: ${d.label}` : ''}`, en: `Brand${d.label ? `: ${d.label}` : ''}` }, ...u }); break
    }
  })
  return out.filter((d) => d.value !== 0)
}

// ───────────────────────── Clubs & fixtures ─────────────────────────

export function teamView(s: GameState, id: string): TeamView | null {
  const c = s.world.clubs[id]
  if (!c) return nationTeamView(id)
  return { id: c.id, name: c.name, shortName: c.shortName, crest: c.crest, kit: c.colors, altKit: c.awayColors, reputation: c.reputation }
}

/** Placeholder for a vanished club id (never shown as "undefined"). */
export function teamViewOr(s: GameState, id: string): TeamView {
  return teamView(s, id) ?? {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    crest: { shape: 'shield', symbol: 0, colors: ['#24345a', '#f2f5fa', '#1fd47a'], initials: id.slice(0, 2).toUpperCase() },
    kit: { primary: '#24345a', secondary: '#f2f5fa', pattern: 'plain' },
  }
}

/** Absolute day for daysUntil maths across a season boundary. */
const dayIndex = (season: number, week: number, day: number): number => (season * SEASON_WEEKS + week) * DAYS_PER_WEEK + day

export function fixtureView(s: GameState, comp: Competition, f: Fixture, heroClubId: string | null): FixtureView {
  const cal = s.calendar
  const home = s.world.clubs[f.homeId]
  // Internationals: the hero's side is his nation (not his club), the ground is the home nation's.
  const homeNation = comp.type === 'international' ? parseTeamId(f.homeId)?.nationId : undefined
  const isHome = homeNation ? homeNation === s.hero.nationality : f.homeId === heroClubId
  const venue = home?.stadium.name
    ?? (homeNation ? (currentLang.value === 'tr' ? `${teamName(homeNation).tr} Ulusal Stadyumu` : `${teamName(homeNation).en} National Stadium`) : '—')
  return {
    fixtureId: f.id,
    compName: comp.name,
    compType: comp.type,
    home: teamViewOr(s, f.homeId),
    away: teamViewOr(s, f.awayId),
    week: f.week,
    day: f.day,
    isHome,
    venue,
    daysUntil: dayIndex(comp.season, f.week, f.day) - dayIndex(cal.season, cal.week, cal.day),
    result: f.result,
  }
}
