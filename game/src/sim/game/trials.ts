/**
 * Starting-club trials (GDD 2.3#7, WP-8). A career started with
 * `newGame({ trials: true })` begins unattached with three invitations:
 *
 *  - **academy**: a top-tier club's academy. Always signs (youth role, small
 *    wage) — the safety net, so a career can never soft-lock.
 *  - **trial**: a lowest-tier club at the hero's level. The trial drill score
 *    decides the deal: ≥ 0.75 rotation & +15% wage, ≥ 0.5 the merit role,
 *    ≥ 0.3 reserve & −15%, below that no offer.
 *  - **open**: an open tryout at a stronger club one tier up. Needs ≥ 0.65.
 *
 * The UI plays one training drill (the "trial match" moment pack) or lets the
 * sim estimate the performance from the hero's attributes, then calls
 * {@link resolveTrial}. Invitations live in `life.flags['c:trials']`.
 */
import type { GameState, LText, Position, Role, SquadRole } from '../../core/types'
import { normalizeRole } from '../../core/roles'
import type { Rng } from '../../core/rng'
import { clamp, hashString } from '../../core/rng'
import { fill, lt } from '../career/common'
import { heroOvr } from '../career/progression'
import { clubStrength } from '../world/queries'
import { log, readJson, withRng, writeJson } from './internal'
import { pickStartingClub, signFirstClub } from './newGame'

export type TrialKind = 'academy' | 'trial' | 'open'
/** Drill used for the trial (same ids as game/training DrillKind). */
export type TrialDrill =
  | 'finishing' | 'passing' | 'dribbling' | 'goalkeeping' | 'fitness' | 'crossing' | 'heading' | 'tackling'
  | 'distribution' | 'sprint' | 'interception'

export interface TrialInvite {
  id: string
  clubId: string
  clubName: string
  kind: TrialKind
  drill: TrialDrill
  /** Performance (0..1) needed for a contract (0 = always). */
  target: number
  /** Club league tier (1 = top). */
  tier: number
}

export interface TrialOutcome {
  signed: boolean
  clubId: string | null
  role: SquadRole | null
  lines: LText[]
}

export const TRIALS_FLAG = 'c:trials'

/**
 * The three trial drills for a starting role, most telling first (owner, 2026-10-17: the trials must fit the chosen
 * position AND the role picked at the start — a centre-back was shooting at every club). The open tryout asks for the
 * role's signature skill, the trial club for its second, the academy for its third.
 */
export const ROLE_TRIAL_DRILLS: Readonly<Record<Role, readonly [TrialDrill, TrialDrill, TrialDrill]>> = {
  reflexKeeper: ['goalkeeping', 'distribution', 'goalkeeping'],
  shotStopper: ['goalkeeping', 'goalkeeping', 'distribution'],
  sweeperKeeper: ['distribution', 'goalkeeping', 'sprint'],
  attackingFullBack: ['crossing', 'sprint', 'tackling'],
  defensiveFullBack: ['tackling', 'interception', 'sprint'],
  balancedFullBack: ['tackling', 'crossing', 'interception'],
  stopper: ['tackling', 'interception', 'heading'],
  aerialDefender: ['heading', 'tackling', 'interception'],
  ballPlayingDefender: ['passing', 'interception', 'tackling'],
  anchor: ['interception', 'tackling', 'passing'],
  boxToBox: ['fitness', 'passing', 'tackling'],
  playmaker: ['passing', 'dribbling', 'interception'],
  touchlineWinger: ['crossing', 'sprint', 'dribbling'],
  invertedWinger: ['dribbling', 'finishing', 'crossing'],
  freeWinger: ['dribbling', 'crossing', 'finishing'],
  dribbler: ['dribbling', 'sprint', 'finishing'],
  targetForward: ['heading', 'finishing', 'passing'],
  runner: ['sprint', 'finishing', 'dribbling'],
  pivot: ['finishing', 'passing', 'heading'],
}

/** The trial drills for a position and role (an attacking midfield playmaker finishes instead of intercepting). */
export function trialDrillsFor(position: Position, role?: Role | null): readonly [TrialDrill, TrialDrill, TrialDrill] {
  const r = normalizeRole(position, role)
  const d = ROLE_TRIAL_DRILLS[r]
  if (position === 'AM' && r === 'playmaker') return ['passing', 'dribbling', 'finishing']
  if (position === 'AM' && r === 'boxToBox') return ['passing', 'finishing', 'fitness']
  return d
}

/** The signature trial drill for a position and role. */
export function trialDrillFor(position: Position, role?: Role | null): TrialDrill {
  return trialDrillsFor(position, role)[0]
}

export const pendingTrials = (state: GameState): TrialInvite[] => readJson<TrialInvite[]>(state.life, TRIALS_FLAG, [])
export const writeTrialInvites = (state: GameState, invites: TrialInvite[]): void => writeJson(state.life, TRIALS_FLAG, invites.length ? invites : null)
export const hasPendingTrials = (state: GameState): boolean => !state.hero.contract && pendingTrials(state).length > 0

/** Three invitations: academy (top tier), trial (lowest tier, at level), open tryout (one tier up). */
export function generateTrialInvites(state: GameState, rng: Rng): TrialInvite[] {
  const w = state.world
  const leagues = Object.values(w.leagues).filter((l) => l.countryId === state.hero.nationality).sort((a, b) => a.tier - b.tier)
  if (leagues.length === 0) return []
  const top = leagues[0]!
  const lowest = leagues[leagues.length - 1]!
  const upper = (leagues.length > 1 ? leagues[leagues.length - 2] : lowest)!
  const ovr = heroOvr(state.hero)
  const [first, second, third] = trialDrillsFor(state.hero.position, state.hero.role)
  const used = new Set<string>()
  const nearest = (ids: readonly string[], want: number): string => {
    const ranked = ids.filter((id) => !used.has(id)).map((id) => ({ id, d: Math.abs(clubStrength(w, id).overall - want) })).sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    return rng.pick(ranked.slice(0, 3)).id
  }
  const academyId = [...top.clubIds].filter((id) => !used.has(id)).sort((a, b) => w.clubs[b]!.reputation - w.clubs[a]!.reputation || (a < b ? -1 : 1)).slice(0, 4)
  const academy = rng.pick(academyId)
  used.add(academy)
  const trial = nearest(lowest.clubIds, ovr + 4)
  used.add(trial)
  const open = nearest(upper.clubIds, ovr + 8)
  const make = (clubId: string, kind: TrialKind, drill: TrialDrill, target: number, tier: number): TrialInvite => ({
    id: `tr-${kind}-${clubId}`, clubId, clubName: w.clubs[clubId]!.name, kind, drill, target, tier,
  })
  return [make(open, 'open', first, 0.65, upper.tier), make(trial, 'trial', second, 0.3, lowest.tier), make(academy, 'academy', third, 0, top.tier)]
}

/** Deterministic simulated trial performance from the hero's attributes (0.3..0.85). */
export function autoTrialPerformance(state: GameState, inviteId: string): number {
  const ovr = heroOvr(state.hero)
  const jitter = ((hashString(`${state.meta.seed}|${inviteId}`) % 1000) / 1000 - 0.5) * 0.2
  return clamp(0.3 + (ovr - 40) * 0.02 + jitter, 0.3, 0.85)
}

/** Contract terms a performance earns (null = no offer). */
export function trialTerms(kind: TrialKind, performance: number): { role?: SquadRole; wageMul: number } | null {
  const p = clamp(performance, 0, 1)
  if (kind === 'academy') return { role: 'youth', wageMul: 0.7 }
  if (kind === 'open') return p >= 0.65 ? { wageMul: p >= 0.85 ? 1.2 : 1.05 } : null
  if (p >= 0.75) return { role: 'rotation', wageMul: 1.15 }
  if (p >= 0.5) return { wageMul: 1 }
  if (p >= 0.3) return { role: 'reserve', wageMul: 0.85 }
  return null
}

/**
 * Apply a trial result. Signing ends the trials; a failed trial removes that
 * invitation (and, if none remain, a lowest-tier club offers a reserve deal).
 */
export function resolveTrial(state: GameState, inviteId: string, performance: number): TrialOutcome {
  const invites = pendingTrials(state)
  const inv = invites.find((x) => x.id === inviteId)
  if (!inv || state.hero.contract) return { signed: false, clubId: null, role: null, lines: [lt('Bu deneme daveti artık geçerli değil.', 'This trial invitation is no longer valid.')] }
  const lines: LText[] = []
  const pct = Math.round(clamp(performance, 0, 1) * 100)
  const terms = trialTerms(inv.kind, performance)
  return withRng(state, (rng) => {
    if (!terms) {
      const rest = invites.filter((x) => x.id !== inviteId)
      log(state, lines, fill(lt('{c} denemesi olmadı (%{p}). Teşekkür edip yollarınızı ayırdınız.', 'The {c} trial did not work out ({p}%). They thanked you and let you go.'), { c: inv.clubName, p: pct }), 'career', '📋')
      if (rest.length > 0) {
        writeTrialInvites(state, rest)
        return { signed: false, clubId: null, role: null, lines }
      }
      writeTrialInvites(state, [])
      const fallback = pickStartingClub(state, rng)
      signFirstClub(state, rng, fallback, { role: 'reserve', wageMul: 0.85 })
      return { signed: true, clubId: fallback, role: state.hero.contract?.role ?? 'reserve', lines }
    }
    log(state, lines, fill(lt('{c} denemesinde %{p} performans! Sözleşme teklifi geldi.', '{p}% in the {c} trial! They offered you a contract.'), { c: inv.clubName, p: pct }), 'career', '✍️')
    writeTrialInvites(state, [])
    signFirstClub(state, rng, inv.clubId, terms)
    return { signed: true, clubId: inv.clubId, role: state.hero.contract?.role ?? null, lines }
  })
}
