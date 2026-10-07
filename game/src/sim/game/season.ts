/**
 * Hero-side season machinery: club relationship sync, national team,
 * transfer/renewal/sponsor offer generation, end-of-season (awards, history,
 * trophies) and the new-season rollover (contract expiry, loan end).
 */
import type { Award, GameState, LText, SeasonRecord, SeasonStats } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, emptyStats, fameGain, fill, fmtMoney, lt, meter } from '../career/common'
import { renewalOffer } from '../career/contract'
import { heroOvr } from '../career/progression'
import { endLoan, freeAgentOffers, generateLoanOffers, generateTransferOffers, TRANSFER_REQUEST_FLAG } from '../career/transfers'
import type { CandidateClub, TransferOffer } from '../career/transfers'
import { ensureRelation, ensureTeammates } from '../life/relationships'
import { sponsorOffers, type SponsorOffer } from '../life/sponsors'
import { clubStrength, leagueTableFor, playerDisplayName, squadPlayers } from '../world/queries'
import { endOfSeason, pruneCompetitions, simulateRemainingFixtures } from '../world/season'
import { GFLAG, clubContextOf, heroClub, log, readJson, recordTransfers, transferWindow, writeJson } from './internal'
import { checkNationalTrophies, evaluateCallupMeter, nationalThreshold } from './national'
import { grantSeasonAwards, heroAwardInput, preSeasonAwards } from './awards'

// ───────────────────────── Club relations ─────────────────────────

/** Sync teammate and manager relationships with the hero's current squad. */
export function syncClubRelations(state: GameState): void {
  const club = heroClub(state)
  const week = absWeek(state.calendar)
  if (!club) {
    ensureTeammates(state.life, [], week)
    return
  }
  const mates = squadPlayers(state.world, club.id).map((p) => ({ npcId: p.id, name: playerDisplayName(p, 'full') }))
  ensureTeammates(state.life, mates, week)
  ensureRelation(state.life, 'manager', 'manager', club.managerName, 0, week)
}

// ───────────────────────── National team ─────────────────────────

/**
 * Refresh the national call-up meter (see national.ts). Squads themselves are
 * picked at the announcement weeks; this only updates what Home/Profile show.
 */
export function evaluateNationalTeam(state: GameState, _rng: Rng, _out: LText[]): void {
  if (state.hero.retired) return
  evaluateCallupMeter(state)
}

export { nationalThreshold }

// ───────────────────────── Offers ─────────────────────────

export const getOffers = (state: GameState): TransferOffer[] => readJson<TransferOffer[]>(state.life, GFLAG.offers, [])
export const setOffers = (state: GameState, offers: TransferOffer[]): void => writeJson(state.life, GFLAG.offers, offers.length ? offers : null)
export const getSponsorOffers = (state: GameState): SponsorOffer[] => readJson<SponsorOffer[]>(state.life, GFLAG.sponsorOffers, [])
export const setSponsorOffers = (state: GameState, offers: SponsorOffer[]): void => writeJson(state.life, GFLAG.sponsorOffers, offers.length ? offers : null)

/** Max candidate clubs evaluated per offer roll (strength calc is the costly part). */
const MAX_CANDIDATES = 90

/** Candidate clubs around the hero's level (reputation band), with squad strength. */
export function candidateClubs(state: GameState, rng: Rng): CandidateClub[] {
  const cur = heroClub(state)
  const center = cur?.reputation ?? 25 + heroOvr(state.hero) * 0.3
  let pool = Object.values(state.world.clubs).filter((c) => c.id !== cur?.id && c.reputation >= center - 25 && c.reputation <= center + 35)
  if (pool.length > MAX_CANDIDATES) pool = rng.shuffle(pool).slice(0, MAX_CANDIDATES)
  return pool.map((c) => ({
    clubId: c.id, name: c.name, reputation: c.reputation, leagueTier: state.world.leagues[c.leagueId]?.tier,
    countryId: c.countryId, squadAvgOvr: clubStrength(state.world, c.id).overall, wageBudget: c.wageBudget, transferBudget: c.budget,
  }))
}

/**
 * Weekly offer generation. Transfer + loan bids during windows (stale ones
 * dropped when the window closes), free-agent offers whenever the hero has
 * no valid contract, club renewal offers every 4 weeks when due.
 * Returns the number of new offers.
 */
export function generateHeroOffers(state: GameState, rng: Rng, out: LText[]): number {
  const h = state.hero
  if (h.retired) return 0
  const cal = state.calendar
  const window = transferWindow(cal.week)
  let offers = getOffers(state).filter((o) => o.contract.kind === 'renewal' || o.contract.kind === 'freeAgent' || window !== null)
  const before = offers.length
  const agent = state.life.agent
  const cur = heroClub(state)
  const season = cal.week >= 42 ? cal.season + 1 : cal.season

  if (!h.contract || h.contract.untilSeason < season) {
    if (offers.filter((o) => o.contract.kind === 'freeAgent').length < 3) {
      const cands = candidateClubs(state, rng)
      offers = offers.concat(freeAgentOffers(rng, h, cands, { season, agent, life: state.life }).filter((o) => !offers.some((x) => x.clubId === o.clubId)))
    }
  } else if (window && cur) {
    const cands = candidateClubs(state, rng)
    const ctx = { window, season, agent, currentClub: { clubId: cur.id, name: cur.name, reputation: cur.reputation } }
    const fresh = [...generateTransferOffers(rng, h, state.life, cands, ctx), ...generateLoanOffers(rng, h, cands, ctx)]
    for (const o of fresh) if (!offers.some((x) => x.clubId === o.clubId)) offers.push(o)
    offers = offers.slice(0, 6)
  }

  // Renewal: every 4 weeks in season, not too soon after a decline.
  const declined = state.life.flags[GFLAG.renewalDeclined]
  if (cur && h.contract && !h.contract.loan && cal.week % 4 === 2 && !offers.some((o) => o.contract.kind === 'renewal') &&
      !(typeof declined === 'number' && absWeek(cal) - declined < 8)) {
    const r = renewalOffer(rng, h, { club: clubContextOf(state, cur.id), season: cal.season, agent })
    if (r.offer) {
      offers.push({ id: rng.id('rn'), clubId: cur.id, clubName: cur.name, fee: 0, isLoan: false, viaReleaseClause: false, contract: r.offer })
      for (const l of r.lines) log(state, out, l, 'career', '📝')
    }
  }
  setOffers(state, offers)
  const added = offers.length - before
  if (added > 0) log(state, out, fill(lt('{n} yeni teklif masanda.', '{n} new offer(s) on your desk.'), { n: added }), 'career', '📨')
  return Math.max(0, added)
}

/** Weekly sponsor offers (replace previous unanswered offers). */
export function generateSponsorOffers(state: GameState, rng: Rng, out: LText[]): number {
  if (state.hero.retired) return 0
  const offers = sponsorOffers(rng, state.hero, state.life, { season: state.calendar.season })
  if (offers.length === 0) return 0
  setSponsorOffers(state, offers)
  log(state, out, fill(lt('🤝 {n} sponsorluk teklifi aldın.', '🤝 You received {n} sponsorship offer(s).'), { n: offers.length }), 'money', '🤝')
  return offers.length
}

// ───────────────────────── Event flags ─────────────────────────

/**
 * Apply flags left by event cards to career state:
 *  - `contract_extension_agreed` (weekly raise) → wage + raise, +1 season;
 *  - `wants_out` → transfer listed (transfer-request flag without penalties);
 *  - `nt_called` → hero.nationalTeam.called (added or removed).
 */
export function syncEventFlags(state: GameState): LText[] {
  const out: LText[] = []
  const f = state.life.flags
  const h = state.hero
  const raise = f.contract_extension_agreed
  if (raise !== undefined) {
    delete f.contract_extension_agreed
    const r = typeof raise === 'number' && Number.isFinite(raise) ? Math.max(0, raise) : 0
    if (h.contract && !h.contract.loan) {
      h.contract.wage = Math.round(h.contract.wage + r)
      h.contract.untilSeason += 1
      log(state, out, fill(lt('Sözleşmen uzatıldı: haftalık {w}, {s} sonuna kadar.', 'Contract extended: {w}/week until {s}.'), { w: fmtMoney(h.contract.wage), s: h.contract.untilSeason }), 'career', '✍️')
    }
  }
  if (f.wants_out !== undefined) {
    const v = f.wants_out
    delete f.wants_out
    if (v && h.contract && f[TRANSFER_REQUEST_FLAG] === undefined) {
      f[TRANSFER_REQUEST_FLAG] = absWeek(state.calendar)
      f.transfer_listed = true
      log(state, out, lt('Kulüp ayrılma isteğini kabul etti: transfer listesindesin.', 'The club accepted that you want out: you are transfer-listed.'), 'career', '📝')
    }
  }
  const nt = f.nt_called === true
  const seen = f[GFLAG.ntSeen] === true
  if (nt && !h.nationalTeam.called) h.nationalTeam.called = true
  else if (!nt && seen && h.nationalTeam.called) h.nationalTeam.called = false
  f[GFLAG.ntSeen] = h.nationalTeam.called
  if (h.nationalTeam.called) f.nt_called = true
  return out
}

// ───────────────────────── End of season ─────────────────────────

/** Compact record of the last finished season for the UI's season review. */
export interface SeasonDigest {
  season: number
  clubName: string
  leagueName: string
  leaguePosition: number | null
  stats: SeasonStats
  heroAwards: Award[]
  trophies: LText[]
  champions: { name: LText; winner: string }[]
  movement: 'promoted' | 'relegated' | null
  awardWinners: { topScorer: string | null; bestPlayer: string | null; youngPlayer: string | null }
}

/**
 * Season-end contract money (2.5#5): team bonus for each trophy (4 weeks of wage,
 * league title 6), promotion bonus clause, and the loyalty bonus when the
 * contract has run its full course at the club.
 */
function paySeasonEndBonuses(state: GameState, out: LText[], season: number, trophyCount: number, promoted: boolean): void {
  const c = state.hero.contract
  if (!c || state.hero.retired || c.loan) return
  const pay = (amount: number, text: LText): void => {
    if (amount <= 0) return
    state.life.money += amount
    log(state, out, fill(text, { m: fmtMoney(amount) }), 'money', '💰')
  }
  if (trophyCount > 0) pay(Math.round(c.wage * 4 * trophyCount), lt('Sezon sonu takım primi: {m}', 'End-of-season team bonus: {m}'))
  if (promoted && c.promotionBonus) pay(c.promotionBonus, lt('Yükselme primi: {m}', 'Promotion bonus: {m}'))
  if (c.untilSeason === season && c.loyaltyBonus) pay(c.loyaltyBonus, lt('Sadakat primi: {m}', 'Loyalty bonus: {m}'))
}

/**
 * Close the season for the hero (call when entering END_OF_SEASON_WEEK):
 * hero awards (moved to awards.ts: scoring titles vs. NPC stats, then the
 * world's Golden Star vote / Golden Glove / Young Player / Goal and Team of
 * the Season with the hero as a candidate), trophies, SeasonRecord history,
 * the world's endOfSeason (honours, promotion, ageing, transfers, next
 * season's competitions), call-up meter and relationship sync.
 */
export function endSeasonForHero(state: GameState, rng: Rng, out: LText[]): SeasonDigest {
  const w = state.world
  const h = state.hero
  const season = state.calendar.season
  const club = heroClub(state)
  const league = club ? w.leagues[club.leagueId] : null
  const table = club ? leagueTableFor(w, club.id, season) : null
  const s = h.seasonStats

  // ── Awards that need NPC stats (endOfSeason resets them) ──
  const pre = preSeasonAwards(state)
  const heroInput = heroAwardInput(state)

  // ── World rollover ──
  const leagueBefore = club?.leagueId ?? null
  const { summary } = endOfSeason(w, rng, season, { hero: h.retired ? undefined : heroInput, totsLeagueId: leagueBefore })
  const heroAwards: Award[] = h.retired ? [] : grantSeasonAwards(state, rng, out, season, pre, summary)
  recordTransfers(state, summary.transfers)
  const trophies: LText[] = []
  if (club) {
    for (const c of summary.champions) {
      if (c.winnerId !== club.id) continue
      trophies.push(c.name)
      h.trophies.push({ season, name: c.name })
      h.reputation = meter(h.reputation + fameGain(h.reputation, c.type === 'continental' ? 6 : c.type === 'league' ? 3 : 2))
      log(state, out, fill(lt('🏆 {c} şampiyonu oldunuz!', '🏆 You won the {c}!'), { c: c.name }), 'award', '🏆')
    }
  }
  const mv = club ? summary.movements.find((m) => m.clubId === club.id) : undefined
  paySeasonEndBonuses(state, out, season, trophies.length, mv?.kind === 'promoted')
  if (mv) {
    log(state, out, mv.kind === 'promoted'
      ? fill(lt('⬆️ {c} bir üst lige yükseldi!', '⬆️ {c} won promotion!'), { c: club?.name ?? '' })
      : fill(lt('⬇️ {c} küme düştü.', '⬇️ {c} were relegated.'), { c: club?.name ?? '' }), 'career', mv.kind === 'promoted' ? '⬆️' : '⬇️')
  }

  const record: SeasonRecord = {
    season, clubId: club?.id ?? '', clubName: club?.name ?? '—', leagueName: (leagueBefore && w.leagues[leagueBefore]?.name) || league?.name || '—',
    stats: { ...s }, leaguePosition: table?.position ?? null, trophies: trophies.map((t) => t.en),
  }
  h.history.push(record)
  const name = (id: string | undefined): string => (id ? playerDisplayName(w.players[id], 'full') : '—')
  const digest: SeasonDigest = {
    season, clubName: record.clubName, leagueName: record.leagueName, leaguePosition: record.leaguePosition, stats: record.stats,
    heroAwards, trophies,
    champions: summary.champions.filter((c) => c.type !== 'league' || c.compKey === leagueBefore || w.leagues[c.compKey]?.tier === 1)
      .slice(0, 12).map((c) => ({ name: c.name, winner: w.clubs[c.winnerId]?.name ?? c.winnerId })),
    movement: mv?.kind ?? null,
    awardWinners: { topScorer: summary.awards.topScorer ? name(summary.awards.topScorer.playerId) : null, bestPlayer: summary.awards.bestPlayer ? name(summary.awards.bestPlayer.playerId) : null, youngPlayer: summary.awards.youngPlayer ? name(summary.awards.youngPlayer.playerId) : null },
  }
  writeJson(state.life, GFLAG.lastSeason, digest)
  log(state, out, fill(lt('Sezon {s} bitti: {a} maç, {g} gol, {as} asist.', 'Season {s} is over: {a} apps, {g} goals, {as} assists.'), { s: season, a: s.apps, g: s.goals, as: s.assists }), 'career', '📅')

  evaluateNationalTeam(state, rng, out)
  syncClubRelations(state)
  return digest
}

/**
 * New season (call when the week counter wraps): season++, stats reset,
 * contract expiry (free agency) and loan returns.
 */
export function newSeasonRollover(state: GameState, _rng: Rng, out: LText[]): void {
  const cal = state.calendar
  cal.season += 1
  cal.week = 0
  // Finish anything left of last season (the national finals normally end in week 43).
  simulateRemainingFixtures(state.world, _rng, cal.season - 1)
  checkNationalTrophies({ ...state, calendar: { ...cal, season: cal.season - 1 } }, _rng, out)
  // Last season's fixtures/tables are no longer needed (honours + hero history keep the record).
  pruneCompetitions(state.world, cal.season)
  const h = state.hero
  h.seasonStats = emptyStats()
  if (h.contract && h.contract.untilSeason < cal.season) {
    if (h.contract.loan) {
      for (const l of endLoan(h, state.life, cal)) out.push(l)
    } else {
      h.contract = null
      log(state, out, lt('Sözleşmen sona erdi: artık serbest oyuncusun.', 'Your contract has expired: you are a free agent.'), 'career', '🆓')
    }
  }
  delete state.life.flags.transfer_listed
  setOffers(state, getOffers(state).filter((o) => o.contract.kind === 'freeAgent'))
  syncClubRelations(state)
}
