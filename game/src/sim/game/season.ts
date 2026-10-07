/**
 * Hero-side season machinery: club relationship sync, national team,
 * transfer/renewal/sponsor offer generation, end-of-season (awards, history,
 * trophies) and the new-season rollover (contract expiry, loan end).
 */
import type { Award, GameState, LText, SeasonRecord, SeasonStats } from '../../core/types'
import type { Rng } from '../../core/rng'
import { COUNTRY_BY_ID } from '../../data/world/countries'
import { NEWS_SOURCES, absWeek, emptyStats, fill, fmtMoney, heroAge, lt, meter, pushNews } from '../career/common'
import { renewalOffer } from '../career/contract'
import { heroOvr } from '../career/progression'
import { endLoan, freeAgentOffers, generateLoanOffers, generateTransferOffers, TRANSFER_REQUEST_FLAG } from '../career/transfers'
import type { CandidateClub, TransferOffer } from '../career/transfers'
import { ensureRelation, ensureTeammates } from '../life/relationships'
import { sponsorOffers, type SponsorOffer } from '../life/sponsors'
import { clubStrength, leagueTableFor, playerDisplayName, squadPlayers } from '../world/queries'
import { endOfSeason, playerSeasonScore, pruneCompetitions, seasonAwards, MIN_AWARD_APPS, YOUNG_PLAYER_MAX_AGE } from '../world/season'
import { GFLAG, clubContextOf, heroClub, log, readJson, transferWindow, writeJson } from './internal'

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

/** OVR needed for a call-up: 45 + 0.35 × country reputation (TR 74 → 71, EN 92 → 77). */
export function nationalThreshold(countryId: string): number {
  return Math.round(45 + (COUNTRY_BY_ID[countryId]?.reputation ?? 60) * 0.35)
}

/** Re-evaluate the call-up from OVR, reputation and form. */
export function evaluateNationalTeam(state: GameState, _rng: Rng, out: LText[]): void {
  const h = state.hero
  if (h.retired) return
  const need = nationalThreshold(h.nationality)
  const score = heroOvr(h) + (h.reputation - 30) * 0.1 + (h.form - 50) * 0.05
  const was = h.nationalTeam.called
  const called = score >= need && h.reputation >= 20 && !h.injury
  h.nationalTeam.called = called
  if (called) state.life.flags.nt_called = true
  else delete state.life.flags.nt_called
  state.life.flags[GFLAG.ntSeen] = called
  const country = COUNTRY_BY_ID[h.nationality]
  if (called && !was) {
    log(state, out, fill(lt('🇺🇳 Milli takım kadrosuna çağrıldın: {c}!', '🇺🇳 You have been called up by {c}!'), { c: country?.name ?? lt('?', '?') }), 'career', '🎽')
  } else if (!called && was) {
    log(state, out, lt('Milli takım kadrosunda adın yok.', 'You were left out of the national squad.'), 'career', '🎽')
  }
}

/** International break: called-up heroes win caps (and maybe score). */
export function playInternationalBreak(state: GameState, rng: Rng, out: LText[]): void {
  const h = state.hero
  if (!h.nationalTeam.called || h.injury || h.retired) return
  const games = rng.int(1, 2)
  const ovr = heroOvr(h)
  const scoring = h.position === 'ST' ? 0.35 : ['LW', 'RW', 'AM'].includes(h.position) ? 0.2 : h.position === 'GK' ? 0 : 0.07
  let goals = 0
  for (let i = 0; i < games; i++) if (rng.chance(scoring * (0.6 + ovr / 100))) goals++
  h.nationalTeam.caps += games
  h.nationalTeam.goals += goals
  h.reputation = meter(h.reputation + 0.5 * games + goals)
  h.fatigue = meter(h.fatigue + 8 * games)
  log(state, out, fill(lt('Milli takımla {n} maç oynadın ({g} gol). Toplam: {c} maç.', 'You played {n} international(s) ({g} goals). Caps: {c}.'), { n: games, g: goals, c: h.nationalTeam.caps }), 'career', '🎽')
}

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
  if (added > 0) log(state, out, fill(lt('📨 {n} yeni teklif masanda.', '📨 {n} new offer(s) on your desk.'), { n: added }), 'career', '📨')
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

const AWARD_NAMES: Record<string, LText> = {
  golden_star: lt('Altın Yıldız', 'Golden Star'),
  player_of_season: lt('Ligin En İyi Oyuncusu', 'League Player of the Season'),
  top_scorer: lt('Gol Kralı', 'Golden Boot'),
  league_top_scorer: lt('Lig Gol Kralı', 'League Top Scorer'),
  young_player: lt('Yılın Genç Oyuncusu', 'Young Player of the Year'),
}

/**
 * Close the season for the hero (call when entering END_OF_SEASON_WEEK):
 * hero awards vs NPC award winners, trophies, SeasonRecord history, then the
 * world's endOfSeason (honours, promotion, ageing, transfers, next season's
 * competitions), call-ups and relationship sync.
 */
export function endSeasonForHero(state: GameState, rng: Rng, out: LText[]): SeasonDigest {
  const w = state.world
  const h = state.hero
  const season = state.calendar.season
  const club = heroClub(state)
  const league = club ? w.leagues[club.leagueId] : null
  const table = club ? leagueTableFor(w, club.id, season) : null
  const ovr = heroOvr(h)
  const s = h.seasonStats

  // ── Awards (NPC stats are reset by endOfSeason, so compare first) ──
  const awards = seasonAwards(w, season)
  const heroAwards: Award[] = []
  const give = (key: string): void => {
    heroAwards.push({ season, key, name: AWARD_NAMES[key] })
  }
  const score = playerSeasonScore(s, ovr, h.position)
  const weighted = score === null ? null : Math.round((score + (club?.reputation ?? 30) * 0.1) * 100) / 100
  if (weighted !== null) {
    if (!awards.bestPlayer || weighted > awards.bestPlayer.value) give('golden_star')
    if (league) {
      let bestInLeague = 0
      for (const cid of league.clubIds) {
        for (const p of squadPlayers(w, cid)) {
          const sc = playerSeasonScore(p.stats, p.ovr, p.position)
          if (sc !== null) bestInLeague = Math.max(bestInLeague, sc + (w.clubs[cid]?.reputation ?? 30) * 0.1)
        }
      }
      if (weighted > bestInLeague) give('player_of_season')
    }
    if (heroAge(h, season) <= YOUNG_PLAYER_MAX_AGE && (!awards.youngPlayer || weighted > awards.youngPlayer.value)) give('young_player')
  }
  if (s.goals > 0 && s.apps >= MIN_AWARD_APPS / 2) {
    if (!awards.topScorer || s.goals > awards.topScorer.value) give('top_scorer')
    const lts = league ? awards.leagueTopScorers[league.id] : undefined
    if (league && (!lts || s.goals > lts.value)) give('league_top_scorer')
  }
  for (const a of heroAwards) {
    h.awards.push(a)
    h.reputation = meter(h.reputation + (a.key === 'golden_star' ? 8 : 3))
    log(state, out, fill(lt('🏆 Ödül: {a}!', '🏆 Award: {a}!'), { a: a.name }), 'award', '🏆')
    pushNews(state.life, rng, state.calendar, fill(lt('{n} {a} ödülünü kazandı', '{n} wins the {a}'), { n: `${h.firstName} ${h.lastName}`, a: a.name }), 1, rng.pick(NEWS_SOURCES))
  }

  // ── World rollover ──
  const leagueBefore = club?.leagueId ?? null
  const { summary } = endOfSeason(w, rng, season)
  const trophies: LText[] = []
  if (club) {
    for (const c of summary.champions) {
      if (c.winnerId !== club.id) continue
      trophies.push(c.name)
      h.trophies.push({ season, name: c.name })
      h.reputation = meter(h.reputation + (c.type === 'continental' ? 6 : c.type === 'league' ? 3 : 2))
      log(state, out, fill(lt('🏆 {c} şampiyonu oldunuz!', '🏆 You won the {c}!'), { c: c.name }), 'award', '🏆')
    }
  }
  const mv = club ? summary.movements.find((m) => m.clubId === club.id) : undefined
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
