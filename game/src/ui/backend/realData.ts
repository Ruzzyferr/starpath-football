/**
 * GameData over the real simulation: read-only selectors mapping GameState →
 * view types. Selectors read `gameState.value` (reactive during render) and
 * memoise expensive work per state object (see session.cached).
 */
import { Rng, clamp, hashString } from '../../core/rng'
import { casinoLimits } from '../../sim/game/casinoLimits'
import type {
  AttributeGroup, AttributeKey, Club, GameState, LText, NewsItem, SponsorDeal, TableRow,
} from '../../core/types'
import { SLOTS_PER_DAY } from '../../core/config'
import { lt as render } from '../../i18n'
import { ACTIVITIES, ACTIVITY_BY_ID, type ActivityDef } from '../../data/activities'
import { ASSETS } from '../../data/assets'
import { PERKS, PERK_BRANCH, perkTier, type PerkGroup } from '../../data/perks'
import { COUNTRY_DEFS } from '../../data/world/countries'
import { absWeek, heroAge } from '../../sim/career/common'
import { perkBlock } from '../../sim/career/perks'
import { heroOvr } from '../../sim/career/progression'
import { TRAINER_QUALITY_BONUS, TRAINING_TYPES, trainingEnergyCost, trainingXpTotal, type TrainingType } from '../../sim/career/training'
import { DRILL_FOR_TRAINING } from '../../game/training/scoring'
import { scoutInterest } from '../../sim/career/transfers'
import { activityBlock, activityEnergy, activityMoney, TRAINER_FEES, trainerName, type ActivityContext } from '../../sim/life/activities'
import { createRace, type RaceCard } from '../../sim/life/casino'
import { netWorth } from '../../sim/life/economy'
import { getEventDef, absoluteWeek } from '../../sim/life/events/engine'
import type { EventCategory as SimEventCategory } from '../../sim/life/events/types'
import { teammateId } from '../../sim/life/relationships'
import { getSponsorOffers, getOffers, nextHeroFixture, activityContext, heroClub, GFLAG, isHeroMatchday, type SeasonDigest } from '../../sim/game'
import { candidateClubs } from '../../sim/game/season'
import { absDayOf, fixtureSeason, readJson, type NotableTransfer } from '../../sim/game/internal'
import { sortTable } from '../../sim/world/table'
import { clubFixtures, playerDisplayName, seasonCompetitions, topScorers as worldTopScorers } from '../../sim/world/queries'
import { gameState } from '../store'
import type {
  ActivityCategory, ActivityView, CasinoStatus, DayPlanView, DaySlotView, Delta, EventCategory, EventView, FixtureView, GameData,
  HorseView, InterestView, PerkView, Risk, ScorerRow, SeasonSummaryView, SocialPostView, SquadMemberView, StatKey, TrainerOffer,
  TrainingSessionView,
} from '../store'
import { casinoAgeLock, slotRulesView } from './casinoView'
import { RELATION_LABEL, eventDeltas, fixtureView, teamView, teamViewOr } from './mapping'
import { doneSlots, plannedSlots } from './plan'
import { readHistory } from './history'
import { postMatchView, preMatchView } from './liveMatch'
import { slotInfos } from './persistence'
import { cached } from './session'
import { emptyObjectives, objectivesUi } from './objectivesFeed'
import { contentFlags } from '../../core/contentFlags'

const L = (tr: string, en: string): LText => ({ tr, en })
const S = (): GameState | null => gameState.value

// ───────────────────────── Activities ─────────────────────────

/** Activities handled elsewhere in the UI (trainer screen, social tab). */
const HIDDEN_ACTIVITIES = new Set(['hire_trainer', 'fire_trainer'])

const ACT_ICON: Record<string, string> = {
  rest: 'bed', sleep_in: 'bed', energy_drink: 'energy', train_shooting: 'target', train_passing: 'link', train_dribbling: 'run', train_physical: 'barbell',
  train_tactical: 'tactics', train_setPiece: 'flag', train_goalkeeping: 'shield-check', train_recovery: 'heartbeat', gym: 'barbell',
  train_crossing: 'crosshair', train_heading: 'goal', train_tackling: 'shield',
  video: 'eye', physio: 'first-aid', family_visit: 'house', friend_hangout: 'users', team_dinner: 'fork-knife', date_night: 'heart',
  party: 'party', casino: 'cards', charity: 'hand-heart', sponsor_shoot: 'camera', interview: 'megaphone', social_post: 'instagram',
  business_meeting: 'handshake', shopping: 'shopping-bag', hobby_gaming: 'laptop', hobby_golf: 'flag', hobby_music: 'music', travel: 'airplane',
}

function categoryOf(def: ActivityDef): ActivityCategory {
  if (def.id === 'charity') return 'charity'
  switch (def.category) {
    case 'training': return 'training'
    case 'rest': case 'health': case 'travel': return 'rest'
    case 'family': return 'family'
    case 'social': case 'romance': case 'leisure': return 'social'
    case 'nightlife': return 'nightlife'
    case 'media': return 'media'
    case 'work': case 'service': return 'business'
    case 'shopping': return 'shopping'
    case 'gambling': return 'casino'
  }
}

function riskOf(def: ActivityDef): Risk {
  if (def.id === 'party' || def.id === 'casino') return 'high'
  if (def.id === 'business_meeting') return 'medium'
  if (def.special === 'train') {
    const r = TRAINING_TYPES[def.trainingType ?? 'tactical'].injuryRisk
    return r >= 0.007 ? 'medium' : r > 0.003 ? 'low' : 'safe'
  }
  if (def.id === 'interview' || def.id === 'social_post' || (def.disciplineInSeason ?? 0) < 0) return 'low'
  return 'safe'
}

const TARGET_LABEL: Record<string, LText> = {
  family: L('Ailen', 'Family'), partner: RELATION_LABEL.partner, bestFriend: RELATION_LABEL.bestFriend, teammates: RELATION_LABEL.teammate,
  fans: RELATION_LABEL.fans, press: RELATION_LABEL.press, manager: RELATION_LABEL.manager,
}

function activityEffects(s: GameState, def: ActivityDef, ctx: ActivityContext): Delta[] {
  const out: Delta[] = []
  const money = activityMoney(def, s.hero, s.life)
  if (money > 0) out.push({ key: 'money', value: money })
  if (def.special === 'train') {
    const t = TRAINING_TYPES[def.trainingType ?? 'tactical']
    const keys = Object.entries(t.attrs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 2).map(([k]) => k as AttributeKey)
    out.push({ key: 'xp', value: t.baseXp })
    for (const k of keys) out.push({ key: k, value: 1, uncertain: true })
    if (t.fatigue) out.push({ key: 'fatigue', value: t.fatigue })
    if (t.sharpness) out.push({ key: 'sharpness', value: t.sharpness })
    return out
  }
  if (def.special === 'gym') out.push({ key: 'strength', value: 1, uncertain: true }, { key: 'stamina', value: 1, uncertain: true })
  if (def.special === 'video') out.push({ key: 'positioning', value: 1, uncertain: true }, { key: 'vision', value: 1, uncertain: true })
  const push = (key: StatKey, v: number | undefined, uncertain = false) => {
    if (v && Math.round(v) !== 0) out.push(uncertain ? { key, value: Math.round(v), uncertain } : { key, value: Math.round(v) })
  }
  push('happiness', def.happiness)
  push('stress', def.stress)
  push('health', def.health)
  push('fatigue', def.fatigue)
  push('reputation', def.reputation && def.reputation < 1 ? 1 : def.reputation, !!def.reputation && def.reputation < 1)
  if (def.followersPct) push('followers', s.life.followers * def.followersPct + 2)
  const disc = (def.discipline ?? 0) + (ctx.inSeason ? def.disciplineInSeason ?? 0 : 0) + (ctx.matchTomorrow ? def.disciplineBeforeMatch ?? 0 : 0)
  push('discipline', disc)
  for (const r of def.relations ?? []) {
    if (r.target === 'manager' && !ctx.inSeason) continue
    out.push({ key: 'relation', value: r.delta, label: TARGET_LABEL[r.target] ?? r.target })
  }
  if (def.special === 'casino') out.push({ key: 'addiction', value: 2, uncertain: true })
  if (def.special === 'post') out.push({ key: 'followers', value: Math.round(s.life.followers * 0.004 + 5 + s.hero.reputation * 2), uncertain: true })
  if (def.special === 'physio' && s.hero.injury) out.push({ key: 'health', value: 2 })
  return out
}

function activitiesView(s: GameState): ActivityView[] {
  return cached(s, 'activities', () => {
    const base = activityContext(s)
    const cur = s.calendar.slot
    return ACTIVITIES.filter((d) => !HIDDEN_ACTIVITIES.has(d.id) && !(contentFlags.hideCasino && d.special === 'casino')).map((def): ActivityView => {
      // Available if it fits any remaining slot of today; the reason shown is for the current slot.
      let reason: LText | null = null
      let ok = false
      for (let slot = cur; slot < SLOTS_PER_DAY; slot++) {
        const r = activityBlock(s.hero, s.life, def, { ...base, calendar: { ...base.calendar, slot } })
        if (r === null) { ok = true; break }
        if (slot === cur) reason = r
      }
      const money = activityMoney(def, s.hero, s.life)
      const energy = def.special === 'train' ? trainingEnergyCost(def.trainingType ?? 'tactical') : activityEnergy(def, s.hero)
      const v: ActivityView = {
        id: def.id, category: categoryOf(def), name: def.name, desc: def.desc, icon: ACT_ICON[def.id] ?? 'star',
        slots: def.slots >= 2 ? 2 : 1, energy, cost: Math.max(0, -money), effects: activityEffects(s, def, base),
        available: ok, risk: riskOf(def),
      }
      if (!ok && reason) v.lockedReason = reason
      return v
    })
  })
}

function dayPlanView(s: GameState): DayPlanView {
  return cached(s, 'dayPlan', () => {
    const planned = plannedSlots(s)
    const done = doneSlots(s)
    const acts = new Map(activitiesView(s).map((a) => [a.id, a]))
    const cur = s.calendar.slot
    const matchToday = isHeroMatchday(s) || !!s.activeMatchId
    let projected = s.life.energy
    const slots: DaySlotView[] = ([0, 1, 2] as const).map((slot) => {
      let state: DaySlotView['state'] = slot < cur ? 'done' : slot === cur ? 'current' : 'upcoming'
      if (matchToday && slot === 1 && slot >= cur) state = 'match'
      const id = state === 'done' ? done[slot] ?? null : planned[slot]
      if ((state === 'current' || state === 'upcoming') && id) projected -= acts.get(id)?.energy ?? 0
      return { slot, state, activityId: state === 'match' ? null : id }
    })
    return { slots, energyBudget: Math.round(s.life.energy), projectedEnergy: clamp(Math.round(projected), 0, 100) }
  })
}

// ───────────────────────── Events ─────────────────────────

const EVENT_CAT: Record<SimEventCategory, EventCategory> = {
  teammates: 'team', manager: 'team', club: 'team', family: 'family', romance: 'love', friends: 'social', press: 'press',
  social: 'social', fans: 'fans', nightlife: 'nightlife', money: 'business', casino: 'nightlife', health: 'health',
  national: 'national', awards: 'awards', rivals: 'rival', community: 'charity', transfer: 'transfer', milestone: 'awards', weird: 'scam',
  legal: 'legal', scam: 'scam', rumour: 'transfer', business: 'business', charity: 'charity', mentor: 'team',
}

const fillVars = (text: LText, vars: Record<string, string | number>): LText => {
  const sub = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m))
  return { tr: sub(text.tr), en: sub(text.en) }
}

function eventView(s: GameState, index: number): EventView | null {
  const pe = s.pendingEvents[index]
  if (!pe) return null
  return cached(s, `event:${index}:${pe.defId}`, () => {
    const def = getEventDef(pe.defId)
    if (!def) return null
    const ctx = { state: s, vars: pe.vars, absWeek: absoluteWeek(s.calendar), tags: [] as string[] }
    const money = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} €`
    const vars: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(pe.vars)) vars[k] = typeof v === 'number' && /amount|money|fee|price|cost|sum/i.test(k) ? money(v) : v
    return {
      index,
      defId: def.id,
      category: EVENT_CAT[def.category] ?? 'social',
      title: fillVars(def.title, vars),
      body: fillVars(def.text, vars),
      choices: def.choices.map((c) => {
        let met = true
        try { met = c.requires ? c.requires(ctx) : true } catch { met = false }
        // Preview: dry-run the effect function with two seeds (it never mutates); differing deltas are "uncertain".
        let preview: Delta[] = []
        try {
          const a = c.effects(ctx, new Rng(hashString(`${def.id}:a`)))
          const b = c.effects(ctx, new Rng(hashString(`${def.id}:b`)))
          const sig = (x: (typeof a.deltas)[number]) => JSON.stringify(x)
          preview = eventDeltas(s, a.deltas, (i) => !b.deltas[i] || sig(a.deltas[i]!) !== sig(b.deltas[i]))
        } catch {
          preview = []
        }
        const risk: Risk = c.risk ?? 'safe'
        return {
          label: fillVars(c.label, vars),
          risk,
          ...(c.requires ? { requirement: { text: c.lockedHint ? fillVars(c.lockedHint, vars) : L('Şart gerekli', 'Requirement'), met } } : {}),
          preview: preview.slice(0, 6),
        }
      }),
    }
  })
}

// ───────────────────────── Fixtures ─────────────────────────

function heroFixtures(s: GameState): FixtureView[] {
  return cached(s, 'fixtures', () => {
    const club = heroClub(s)
    if (!club) return []
    return clubFixtures(s.world, club.id, fixtureSeason(s)).map((r) => fixtureView(s, r.competition, r.fixture, club.id))
  })
}

function nextFixtureView(s: GameState): FixtureView | null {
  return cached(s, 'nextFixture', () => {
    const n = nextHeroFixture(s)
    if (!n) return null
    const comp = s.world.competitions[n.compId]
    const f = comp?.fixtures.find((x) => x.id === n.fixtureId)
    return comp && f ? fixtureView(s, comp, f, heroClub(s)?.id ?? null) : null
  })
}

function formHistory(s: GameState): number[] {
  return cached(s, 'formHistory', () => {
    const club = heroClub(s)
    const out: { t: number; r: number }[] = []
    for (const season of [s.calendar.season - 1, s.calendar.season, s.calendar.season + 1]) {
      for (const comp of seasonCompetitions(s.world, season)) {
        for (const f of comp.fixtures) {
          const r = f.result?.heroRating
          if (r === undefined || !Number.isFinite(r) || r <= 0) continue
          if (club && f.homeId !== club.id && f.awayId !== club.id && s.hero.history.length === 0) continue
          out.push({ t: (season * 100 + f.week) * 10 + f.day, r: Math.round(r * 10) / 10 })
        }
      }
    }
    return out.sort((a, b) => a.t - b.t).slice(-10).map((x) => x.r)
  })
}

// ───────────────────────── Training & perks ─────────────────────────

const TRAINING_GROUP: Record<TrainingType, TrainingSessionView['group']> = {
  shooting: 'technical', passing: 'technical', dribbling: 'technical', physical: 'physical', tactical: 'tactical',
  setPiece: 'technical', goalkeeping: 'goalkeeping', recovery: 'recovery',
  crossing: 'technical', heading: 'technical', tackling: 'technical', distribution: 'goalkeeping',
}
const TRAINING_DESC: Record<TrainingType, LText> = {
  shooting: L('Bitiricilik ve şut tekniği. Kaleye yüzlerce vuruş.', 'Finishing and shooting technique. Hundreds of strikes on goal.'),
  passing: L('Kısa-uzun pas, ilk dokunuş ve oyun görüşü.', 'Short and long passing, first touch and vision.'),
  dribbling: L('Top sürme parkuru: çeviklik ve top kontrolü.', 'Dribbling course: agility and close control.'),
  physical: L('Kondisyon, güç ve sürat. Yorucu ama etkili.', 'Stamina, strength and pace. Tiring but effective.'),
  tactical: L('Pozisyon alma, oyun okuma ve takım uyumu.', 'Positioning, reading the game and team shape.'),
  setPiece: L('Serbest vuruş, korner ve penaltı çalışması.', 'Free kicks, corners and penalties.'),
  goalkeeping: L('Refleks, top tutma ve çıkışlar.', 'Reflexes, handling and coming off the line.'),
  recovery: L('Yoga ve esneme: yorgunluğu atar, stresi azaltır.', 'Yoga and stretching: clears fatigue and stress.'),
  crossing: L('Kanattan ceza sahasındaki hedef bölgelere ve koşan arkadaşına orta.', 'Wing crosses into target zones in the box, timed for a runner.'),
  heading: L('Makine topu yollar: doğru anda zıpla, kafayla kaleciyi geç.', 'The machine fires balls in: time your jump and head past the keeper.'),
  tackling: L('Bire bir gelen driplingcilerden faul yapmadan topu kap.', 'One-on-one dribblers come at you: win the ball without fouling.'),
  distribution: L('Ortaları havada kap, sonra koşan takım arkadaşlarına elle ya da ayakla çıkış yap.', 'Claim crosses out of the air, then throw or kick it out to team-mates on the run.'),
}

function trainingSessions(s: GameState): TrainingSessionView[] {
  return cached(s, 'trainingSessions', () => {
    const ctx = activityContext(s)
    return (Object.keys(TRAINING_TYPES) as TrainingType[])
      .filter((t) => (s.hero.position === 'GK' ? true : t !== 'goalkeeping' && t !== 'distribution'))
      .map((t): TrainingSessionView => {
        const d = TRAINING_TYPES[t]
        const focus = Object.entries(d.attrs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k]) => k as AttributeKey).slice(0, 4)
        const def = ACTIVITY_BY_ID[`train_${t}`]
        const block = def ? activityBlock(s.hero, s.life, def, ctx) : L('Bilinmeyen seans.', 'Unknown session.')
        return {
          id: t, name: d.name, desc: TRAINING_DESC[t], group: TRAINING_GROUP[t], icon: ACT_ICON[`train_${t}`] ?? 'barbell',
          energy: trainingEnergyCost(t), focus,
          xp: Math.round(trainingXpTotal(s.hero, s.life, t)),
          xpMax: Math.round(trainingXpTotal(s.hero, s.life, t, 1)),
          injuryRisk: d.injuryRisk >= 0.007 ? 'medium' : d.injuryRisk > 0.003 ? 'low' : 'safe',
          available: block === null,
          ...(block ? { lockedReason: block } : {}),
          drill: DRILL_FOR_TRAINING[t],
        }
      })
  })
}

const PERK_GROUP_ICON: Record<PerkGroup, string> = {
  finishing: 'target', playmaking: 'tactics', dribbling: 'run', physical: 'barbell', defending: 'shield', mental: 'brain',
  goalkeeping: 'shield-check', lifestyle: 'star', innate: 'sparkle',
}
const PERK_GROUPS: PerkGroup[] = ['finishing', 'playmaking', 'dribbling', 'physical', 'defending', 'mental', 'goalkeeping', 'lifestyle', 'innate']

function perksView(s: GameState): PerkView[] {
  return cached(s, 'perks', () => {
    const h = s.hero
    const groups = PERK_GROUPS.filter((g) => {
      if (g === 'innate') return PERKS.some((p) => p.group === g && h.perks.includes(p.id))
      if (g === 'goalkeeping') return h.position === 'GK'
      return true
    })
    const out: PerkView[] = []
    groups.forEach((g, col) => {
      const list = PERKS.filter((p) => p.group === g && (g !== 'innate' || h.perks.includes(p.id)))
      const depth = (id: string, seen = new Set<string>()): number => {
        const p = list.find((x) => x.id === id)
        if (!p || seen.has(id)) return 0
        seen.add(id)
        return 1 + Math.max(0, ...(p.requirement.perks ?? []).map((r) => depth(r, seen)))
      }
      const sorted = [...list].sort((a, b) => depth(a.id) - depth(b.id) || a.cost - b.cost || (a.id < b.id ? -1 : 1))
      sorted.forEach((p, row) => {
        const owned = h.perks.includes(p.id)
        out.push({
          id: p.id, name: p.name, desc: p.desc, icon: PERK_GROUP_ICON[g], row, col, requires: [...(p.requirement.perks ?? [])],
          cost: p.cost, owned, available: !owned && perkBlock(h, p.id) === null,
          ...(PERK_BRANCH[p.group] ? { branch: PERK_BRANCH[p.group]!, tier: perkTier(p) } : {}),
        })
      })
    })
    return out
  })
}

const TRAINER_GROUPS: AttributeGroup[] = ['technical', 'physical', 'mental', 'goalkeeping']
const TRAINER_STARS: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 5 }

/**
 * Trainers for hire: one per speciality and tier. The name, fee and XP bonus
 * shown are exactly what hiring gives (activities.trainerName / TRAINER_FEES /
 * TRAINER_QUALITY_BONUS). Availability mirrors the hire activity's rules.
 */
export function trainerOffers(s: GameState | null): TrainerOffer[] {
  const gk = s?.hero.position === 'GK'
  const out: TrainerOffer[] = []
  const ctx = s ? activityContext(s) : null
  const def = ACTIVITY_BY_ID.hire_trainer
  for (const g of TRAINER_GROUPS) {
    if (g === 'goalkeeping' && !gk) continue
    for (const q of [1, 2, 3] as const) {
      const name = trainerName(g, q)
      const cur = s?.life.trainer
      const current = !!cur && cur.group === g && cur.name === name
      const block = current ? L('Zaten antrenörün.', 'Already your trainer.') : s && ctx && def ? activityBlock(s.hero, s.life, def, ctx, { trainerGroup: g, trainerQuality: q }) : null
      out.push({
        id: `${g}:${q}`, name, group: g, quality: TRAINER_STARS[q], weeklyFee: TRAINER_FEES[q], bonus: TRAINER_QUALITY_BONUS[q],
        current, available: !!s && block === null, ...(block ? { lockedReason: block } : {}),
      })
    }
  }
  return out
}

// ───────────────────────── Club & world ─────────────────────────

function squadView(s: GameState): SquadMemberView[] {
  return cached(s, 'squad', () => {
    const club = heroClub(s)
    if (!club) return []
    return club.squad.map((id) => s.world.players[id]).filter(Boolean).map((p) => {
      const rel = s.life.relationships[teammateId(p!.id)]
      return { player: p!, relation: rel ? Math.round(rel.value) : null, relationId: rel?.id ?? null }
    })
  })
}

/** Scouting interest is costly (club strength for ~90 clubs): cache per career-week. */
const scoutCache = new Map<string, { clubId: string; level: number; label: LText; reason: LText }[]>()

function interestView(s: GameState): InterestView[] {
  return cached(s, 'interest', () => {
    const own = heroClub(s)
    const out: InterestView[] = []
    const seen = new Set<string>()
    const leagueName = (c: Club | undefined) => (c ? s.world.leagues[c.leagueId]?.name ?? '' : '')
    for (const o of getOffers(s)) {
      const c = s.world.clubs[o.clubId]
      if (!c || seen.has(c.id)) continue
      seen.add(c.id)
      const kind = o.contract.kind
      const note: LText = kind === 'renewal'
        ? L(`Sözleşme yenileme teklifi: haftalık ${o.contract.terms.wage.toLocaleString('tr-TR')} €.`, `Renewal offer: €${o.contract.terms.wage.toLocaleString('en-GB')} a week.`)
        : o.isLoan
          ? L('Kiralık teklifi masada.', 'Loan offer on the table.')
          : kind === 'freeAgent'
            ? L(`Serbest oyuncu teklifi: haftalık ${o.contract.terms.wage.toLocaleString('tr-TR')} €.`, `Free-agent offer: €${o.contract.terms.wage.toLocaleString('en-GB')} a week.`)
            : L(`Resmî teklif: ${Math.round(o.fee).toLocaleString('tr-TR')} € bonservis.`, `Official bid: €${Math.round(o.fee).toLocaleString('en-GB')} fee.`)
      out.push({ club: teamViewOr(s, c.id), level: kind === 'renewal' ? 70 : 85 + (hashString(o.id) % 11), note, leagueName: leagueName(c) })
    }
    const key = `${s.meta.id}:${absWeek(s.calendar)}:${own?.id ?? '-'}:${Math.round(heroOvr(s.hero))}`
    let scouts = scoutCache.get(key)
    if (!scouts) {
      const rng = new Rng(hashString(key))
      const cands = candidateClubs(s, rng)
      scouts = scoutInterest(rng, s.hero, cands, { season: s.calendar.season, currentClubId: own?.id ?? null, life: s.life })
        .slice(0, 6).map((x) => ({ clubId: x.clubId, level: x.level, label: x.label, reason: x.reason }))
      if (scoutCache.size > 20) scoutCache.clear()
      scoutCache.set(key, scouts)
    }
    for (const x of scouts) {
      if (seen.has(x.clubId)) continue
      const c = s.world.clubs[x.clubId]
      if (!c) continue
      seen.add(c.id)
      out.push({ club: teamViewOr(s, c.id), level: Math.min(80, x.level), note: x.reason, leagueName: leagueName(c) })
    }
    return out
  })
}

function transferNews(s: GameState): NewsItem[] {
  return cached(s, 'transferNews', () => {
    const list = readJson<NotableTransfer[]>(s.life, GFLAG.transfers, [])
    const out: NewsItem[] = list.map((t, i) => {
      const from = t.fromClubId ? s.world.clubs[t.fromClubId]?.name : null
      const to = s.world.clubs[t.toClubId]?.name ?? t.toClubId
      const fee = t.fee >= 1_000_000 ? `${(t.fee / 1_000_000).toFixed(1)}M` : `${Math.round(t.fee / 1000)}K`
      return {
        id: `tr${i}-${t.playerId}`, season: t.season, week: t.week,
        headline: from
          ? { tr: `${t.name}, ${from} → ${to} (${fee} €)`, en: `${t.name} joins ${to} from ${from} (€${fee})` }
          : { tr: `${t.name} serbest olarak ${to}'a imza attı`, en: `${t.name} signs for ${to} on a free` },
        source: 'Transfer Radar', sentiment: 0,
      }
    })
    // Hero-related transfer headlines from the news feed.
    const kw = /transfer|imza|sign|teklif|bid|offer|kirala|loan/i
    for (const n of [...s.life.news].reverse()) if (kw.test(n.headline.en) || kw.test(n.headline.tr)) out.push(n)
    return out.slice(0, 30)
  })
}

function topScorersView(s: GameState, leagueId: string): ScorerRow[] {
  return cached(s, `scorers:${leagueId}`, () => {
    const rows: ScorerRow[] = worldTopScorers(s.world, { leagueId, limit: 20 }).map((p) => ({
      playerId: p.id, name: playerDisplayName(p, 'full'), clubId: p.clubId ?? '', goals: p.stats.goals, assists: p.stats.assists, isHero: false,
    }))
    const club = heroClub(s)
    if (club && club.leagueId === leagueId && s.hero.seasonStats.goals > 0) {
      rows.push({ playerId: 'hero', name: `${s.hero.firstName} ${s.hero.lastName}`, clubId: club.id, goals: s.hero.seasonStats.goals, assists: s.hero.seasonStats.assists, isHero: true })
    }
    return rows.sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 20)
  })
}

function leagueTable(s: GameState, leagueId: string): TableRow[] | null {
  return cached(s, `table:${leagueId}`, () => {
    for (const season of [fixtureSeason(s), s.calendar.season]) {
      const comp = seasonCompetitions(s.world, season).find((c) => c.type === 'league' && c.leagueId === leagueId)
      if (comp?.table) return sortTable(comp.table, comp.fixtures)
    }
    return null
  })
}

// ───────────────────────── Social ─────────────────────────

export const POSTS_FLAG = 'g:posts'
export interface StoredPost extends Omit<SocialPostView, 'weekAgo'> {
  w: number
}

export const handleOf = (first: string, last: string): string =>
  (first + last).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9ğüşöç]/g, '').slice(0, 18) || 'player'

function socialFeed(s: GameState): SocialPostView[] {
  return cached(s, 'social', () => {
    const h = s.hero
    const wk = absWeek(s.calendar)
    const name = `${h.firstName} ${h.lastName}`
    const own: SocialPostView[] = readJson<StoredPost[]>(s.life, POSTS_FLAG, []).map(({ w, ...p }) => ({ ...p, weekAgo: Math.max(0, wk - w) }))
    const rng = new Rng(hashString(`${s.meta.id}:${wk}`))
    const fans = s.life.relationships.fans?.value ?? 0
    const club = heroClub(s)
    const form = formHistory(s)
    const last = form[form.length - 1]
    const feed: SocialPostView[] = []
    const reach = Math.max(50, s.life.followers)
    const fanLines: LText[] = last !== undefined && last >= 7.5
      ? [L(`${name} bu sezon başka bir seviyede! 🔥`, `${name} is on another level this season! 🔥`), L('Bu çocuğa milli takım formasını verin artık.', 'Give this kid a national team shirt already.')]
      : last !== undefined && last < 6
        ? [L(`${name} biraz kendine gelmeli. Bu formla olmaz.`, `${name} needs to wake up. Not good enough.`), L('Hocam neden hâlâ oynuyor?', s.hero.gender === 'female' ? 'Why does she keep playing?' : 'Why does he keep playing?')]
        : [L(`${club?.name ?? 'Takım'} formasıyla sahaya çıkışını izlemek güzel.`, `Love watching ${s.hero.gender === 'female' ? 'her' : 'him'} in the ${club?.name ?? 'team'} shirt.`), L('Potansiyel çok yüksek, sabır.', 'Huge potential. Patience.')]
    feed.push({
      id: `fan${wk}`, author: fans >= 0 ? 'Tribün Sesi' : 'kararsiz_taraftar', handle: fans >= 0 ? 'tribunsesi' : 'kararsiz', isHero: false,
      kind: fans >= 0 || (last ?? 6.5) >= 6 ? 'fan' : 'hater', text: rng.pick(fanLines),
      likes: Math.round(reach * 0.03 + rng.int(20, 400)), comments: rng.int(5, 90), weekAgo: 0,
    })
    for (const n of [...s.life.news].reverse().slice(0, 4)) {
      feed.push({
        id: `nw-${n.id}`, author: n.source, handle: n.source.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '').slice(0, 14) || 'news',
        isHero: false, verified: true, kind: 'press', text: n.headline,
        likes: Math.round(reach * 0.02 + (hashString(n.id) % 900)), comments: hashString(n.id) % 120, weekAgo: Math.max(0, wk - absWeek({ season: n.season, week: n.week })),
      })
    }
    for (const sp of s.life.sponsors.slice(0, 2)) {
      feed.push({
        id: `br-${sp.id}`, author: sp.brand, handle: sp.brand.toLowerCase().replace(/[^a-z0-9]/g, ''), isHero: false, verified: true, kind: 'brand',
        text: L(`${name} ile yeni sezon, yeni hedefler. ⚡`, `New season, new goals with ${name}. ⚡`), likes: Math.round(reach * 0.05) + 100, comments: 40, weekAgo: 1,
      })
    }
    return [...own, ...feed].sort((a, b) => a.weekAgo - b.weekAgo)
  })
}

function seriesFrom(arr: number[], now: number, min = 2): number[] {
  const out = [...arr]
  if (out[out.length - 1] !== Math.round(now)) out.push(Math.round(now))
  while (out.length < min) out.unshift(out[0] ?? Math.round(now))
  return out
}

// ───────────────────────── Casino ─────────────────────────

const HORSE_COLORS = ['#ff4d5e', '#3da5ff', '#ffc83d', '#1fd47a', '#8e5cff', '#ff8a3d', '#3de0e0', '#f2f5fa']

/** Today's race card: the stored one, else the deterministic card that a bet will store. */
export function raceCardFor(s: GameState): RaceCard {
  const stored = readJson<RaceCard | null>(s.life, GFLAG.race, null)
  if (stored) return stored
  return cached(s, 'raceCard', () => createRace(new Rng(hashString(`race:${s.meta.id}:${absDayOf(s)}`))))
}

function horsesView(s: GameState): HorseView[] {
  const card = raceCardFor(s)
  return card.horses.map((h, i) => {
    const rng = new Rng(hashString(`${render(h.name)}:${i}`))
    const pos = () => clamp(Math.round(7 - h.formStars * 1.2 + rng.int(-1, 2)), 1, 8)
    return { index: i, name: render(h.name), odds: Math.round(h.odds * 100) / 100, color: HORSE_COLORS[i % HORSE_COLORS.length]!, form: `${pos()}-${pos()}-${pos()}` }
  })
}

// ───────────────────────── Season ─────────────────────────

export const REVIEW_FLAG = 'g:review'
export interface ReviewExtras {
  season: number
  ovrStart: number
  ovrEnd: number
  moneyEarned: number
  followersGained: number
}

const AWARD_KEYS: { key: string; name: LText }[] = [
  { key: 'golden_star', name: L('Altın Yıldız', 'Golden Star') },
  { key: 'player_of_season', name: L('Ligin En İyi Oyuncusu', 'League Player of the Season') },
  { key: 'league_top_scorer', name: L('Lig Gol Kralı', 'League Top Scorer') },
  { key: 'top_scorer', name: L('Gol Kralı', 'Golden Boot') },
  { key: 'young_player', name: L('Yılın Genç Oyuncusu', 'Young Player of the Year') },
]

function seasonSummary(s: GameState): SeasonSummaryView | null {
  const d = readJson<SeasonDigest | null>(s.life, GFLAG.lastSeason, null)
  if (!d) return null
  const ex = readJson<ReviewExtras | null>(s.life, REVIEW_FLAG, null)
  const rec = s.hero.history.find((r) => r.season === d.season)
  const club = (rec && s.world.clubs[rec.clubId]) || heroClub(s)
  const st = d.stats
  const ovr = heroOvr(s.hero)
  const highlights: LText[] = []
  if (d.movement === 'promoted') highlights.push(L(`${d.clubName} bir üst lige yükseldi!`, `${d.clubName} won promotion!`))
  if (d.movement === 'relegated') highlights.push(L(`${d.clubName} küme düştü.`, `${d.clubName} were relegated.`))
  if (st.goals >= 10) highlights.push(L(`${st.goals} golle sezonu tamamladın`, `Finished the season with ${st.goals} goals`))
  if (st.motm > 0) highlights.push(L(`${st.motm} kez maçın oyuncusu`, `${st.motm} man-of-the-match awards`))
  if (d.awardWinners.topScorer) highlights.push(L(`Gol kralı: ${d.awardWinners.topScorer}`, `Golden Boot: ${d.awardWinners.topScorer}`))
  if (s.hero.nationalTeam.caps > 0) highlights.push(L(`Milli takımda ${s.hero.nationalTeam.caps} maç`, `${s.hero.nationalTeam.caps} international caps`))
  return {
    season: d.season,
    club: club ? teamViewOr(s, club.id) : teamViewOr(s, '—'),
    leaguePosition: d.leaguePosition ?? 0,
    leagueName: d.leagueName,
    stats: { apps: st.apps, goals: st.goals, assists: st.assists, avgRating: st.apps ? Math.round((st.ratingSum / st.apps) * 100) / 100 : 0, motm: st.motm },
    trophies: d.trophies,
    awards: AWARD_KEYS.map((a) => ({ key: a.key, name: a.name, won: d.heroAwards.some((x) => x.key === a.key) })),
    ovrStart: ex?.season === d.season ? ex.ovrStart : ovr,
    ovrEnd: ex?.season === d.season ? ex.ovrEnd : ovr,
    moneyEarned: ex?.season === d.season ? ex.moneyEarned : 0,
    followersGained: ex?.season === d.season ? ex.followersGained : 0,
    highlights: highlights.slice(0, 5),
  }
}

// ───────────────────────── GameData ─────────────────────────

export const realData: GameData = {
  countries: () => [...COUNTRY_DEFS],
  heroOvr() {
    const s = S()
    return s ? heroOvr(s.hero) : 0
  },
  heroAge() {
    const s = S()
    return s ? heroAge(s.hero, s.calendar.season) : 0
  },
  ovrHistory() {
    const s = S()
    return s ? cached(s, 'ovrHist', () => seriesFrom(readHistory(s).ovr, heroOvr(s.hero))) : []
  },
  formHistory() {
    const s = S()
    return s ? formHistory(s) : []
  },
  activities() {
    const s = S()
    return s ? activitiesView(s) : []
  },
  dayPlan() {
    const s = S()
    return s ? dayPlanView(s) : { slots: [], energyBudget: 0, projectedEnergy: 0 }
  },
  eventView(i) {
    const s = S()
    return s ? eventView(s, i) : null
  },
  nextFixture() {
    const s = S()
    return s ? nextFixtureView(s) : null
  },
  fixtures() {
    const s = S()
    return s ? heroFixtures(s) : []
  },
  preMatch() {
    const s = S()
    return s ? cached(s, 'pre', () => preMatchView(s)) : null
  },
  postMatch() {
    const s = S()
    return s ? cached(s, 'post', () => postMatchView(s)) : null
  },
  trainingSessions() {
    const s = S()
    return s ? trainingSessions(s) : []
  },
  perks() {
    const s = S()
    return s ? perksView(s) : []
  },
  trainerOffers: () => trainerOffers(S()),
  assetCatalog: () => [...ASSETS],
  squad() {
    const s = S()
    return s ? squadView(s) : []
  },
  interest() {
    const s = S()
    return s ? interestView(s) : []
  },
  transferNews() {
    const s = S()
    return s ? transferNews(s) : []
  },
  topScorers(leagueId) {
    const s = S()
    return s ? topScorersView(s, leagueId) : []
  },
  socialFeed() {
    const s = S()
    return s ? socialFeed(s) : []
  },
  followerHistory() {
    const s = S()
    return s ? seriesFrom(readHistory(s).fol, s.life.followers) : []
  },
  sponsorOffers() {
    const s = S()
    return s ? getSponsorOffers(s).map((o): SponsorDeal => ({ ...o.deal })) : []
  },
  investmentHistory(id) {
    const s = S()
    const inv = s?.life.bank.investments.find((i) => i.id === id)
    if (!s || !inv) return []
    return seriesFrom([inv.amount, ...(readHistory(s).inv[id] ?? [])], inv.value)
  },
  netWorthHistory() {
    const s = S()
    return s ? seriesFrom(readHistory(s).nw, netWorth(s.life, s.calendar)) : []
  },
  casinoStatus(): CasinoStatus {
    const s = S()
    const c = s?.life.casino ?? { addiction: 0, won: 0, lost: 0, visitsThisWeek: 0 }
    const lim = s ? casinoLimits(s.life) : { lossLimit: 0, lostToday: 0, maxStake: 0 }
    return {
      addiction: Math.round(c.addiction), won: Math.round(c.won), lost: Math.round(c.lost), visitsThisWeek: c.visitsThisWeek,
      minBet: 50, maxBet: Math.floor(lim.maxStake / 50) * 50, lossLimit: lim.lossLimit, lostToday: Math.round(lim.lostToday),
      ageLock: s ? casinoAgeLock(s.hero, s.calendar.season) : null,
      slots: slotRulesView(),
    }
  },
  horses() {
    const s = S()
    return s ? horsesView(s) : []
  },
  objectives() {
    const s = S()
    return s ? cached(s, 'objectives', () => objectivesUi(s)) : emptyObjectives()
  },
  seasonSummary() {
    const s = S()
    return s ? seasonSummary(s) : null
  },
  saveSlots: () => slotInfos.value,
  team(id) {
    const s = S()
    return s ? teamView(s, id) : null
  },
  leagueTable(leagueId) {
    const s = S()
    return s ? leagueTable(s, leagueId) : null
  },
}
