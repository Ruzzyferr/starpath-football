/**
 * Moment matchup (owner, build 8: "the opponent's strengths are known, the matchup is fair, the user SEES it").
 *
 * For a highlight, picks the key opponent the moment is about (the keeper you shoot past, the man marking you,
 * the carrier you must stop, the striker bearing down on your goal) from the REAL players of the scenario
 * (sim/match/highlightGen: the two on-pitch lineups with their own attributes), and the 3–4 attribute pairs that
 * decide that moment kind, hero vs opponent, side by side. Pure: the UI (moment card, in-moment label) and the
 * tests read the same thing the runtime plays with.
 */
import type { AttributeKey, Attributes, Position } from '../core/types'
import { ovrFor } from '../sim/career/progression'
import { KEEPER_KINDS, type Highlight, type HighlightKind, type ScenarioPlayer } from '../sim/match/types'

/** What the key opponent is to the hero in this moment. */
export type MatchupRole = 'keeper' | 'marker' | 'carrier' | 'attacker' | 'aerial'

export interface MatchupSide {
  id: string
  /** Display name (from `names`, else the shirt number). */
  name: string
  number: number
  role: Position
  ovr: number
}

export interface MatchupRow {
  hero: AttributeKey
  opp: AttributeKey
  heroV: number
  oppV: number
  /** +1 hero ahead (≥ {@link EDGE_MARGIN}), −1 opponent ahead, 0 level. */
  edge: -1 | 0 | 1
}

export interface Matchup {
  kind: HighlightKind
  role: MatchupRole
  hero: MatchupSide
  opp: MatchupSide
  rows: MatchupRow[]
  /** Mean (hero − opponent) over the rows: who has the edge overall. */
  diff: number
  edge: -1 | 0 | 1
}

/** Attribute gap (points) that counts as an edge. */
export const EDGE_MARGIN = 4

type Pair = readonly [AttributeKey, AttributeKey]

/** Finishing past the keeper: the striker's finish against the keeper's reach and read. */
const FINISH: readonly Pair[] = [['finishing', 'reflexes'], ['composure', 'gkPositioning'], ['shooting', 'diving'], ['curve', 'handling']]
const LONG_RANGE: readonly Pair[] = [['shooting', 'reflexes'], ['curve', 'diving'], ['composure', 'gkPositioning'], ['finishing', 'handling']]
const SET_PIECE: readonly Pair[] = [['setPieces', 'reflexes'], ['curve', 'diving'], ['shooting', 'gkPositioning'], ['composure', 'handling']]
/** Aerial contest (runtime headerContest: Heading, Jumping, Strength, Balance). */
const AERIAL: readonly Pair[] = [['heading', 'heading'], ['jumping', 'jumping'], ['strength', 'strength'], ['balance', 'balance']]
/** On the ball against the man marking him. */
const CARRY: readonly Pair[] = [['dribbling', 'tackling'], ['pace', 'pace'], ['acceleration', 'acceleration'], ['balance', 'aggression']]
const PASSING: readonly Pair[] = [['passing', 'anticipation'], ['vision', 'positioning'], ['firstTouch', 'aggression'], ['composure', 'tackling']]
const HOLD: readonly Pair[] = [['strength', 'strength'], ['balance', 'aggression'], ['firstTouch', 'tackling'], ['passing', 'anticipation']]
const CROSSING: readonly Pair[] = [['crossing', 'tackling'], ['pace', 'pace'], ['dribbling', 'positioning'], ['curve', 'anticipation']]
const RUN: readonly Pair[] = [['positioning', 'positioning'], ['anticipation', 'anticipation'], ['pace', 'pace'], ['finishing', 'reflexes']]
/** Stopping a carrier. */
/** The standing tackle (momentSkill tackle: Tackling, Anticipation, Aggression…) against the carrier's ride (ai.tackleOdds). */
const DEFEND: readonly Pair[] = [['tackling', 'dribbling'], ['anticipation', 'agility'], ['aggression', 'balance'], ['pace', 'pace']]
const READ: readonly Pair[] = [['anticipation', 'passing'], ['positioning', 'vision'], ['acceleration', 'pace'], ['tackling', 'firstTouch']]
const RECOVER: readonly Pair[] = [['pace', 'pace'], ['acceleration', 'acceleration'], ['tackling', 'dribbling'], ['stamina', 'stamina']]
/** In goal against the striker. */
const KEEP: readonly Pair[] = [['reflexes', 'finishing'], ['diving', 'shooting'], ['gkPositioning', 'composure'], ['handling', 'curve']]
const KEEP_HIGH: readonly Pair[] = [['handling', 'crossing'], ['jumping', 'heading'], ['gkPositioning', 'jumping'], ['reflexes', 'strength']]
const DISTRIBUTE: readonly Pair[] = [['gkDistribution', 'anticipation'], ['composure', 'aggression'], ['vision', 'positioning'], ['passing', 'pace']]

const KIND_PAIRS: Record<HighlightKind, { role: MatchupRole; pairs: readonly Pair[] }> = {
  one_on_one: { role: 'keeper', pairs: FINISH },
  counter_2v1: { role: 'keeper', pairs: FINISH },
  rebound: { role: 'keeper', pairs: FINISH },
  timed_run: { role: 'marker', pairs: RUN },
  edge_of_box: { role: 'keeper', pairs: LONG_RANGE },
  long_shot: { role: 'keeper', pairs: LONG_RANGE },
  freekick: { role: 'keeper', pairs: SET_PIECE },
  // kick.kickSkill('penalty'): Finishing / Composure / Shooting; the keeper's read (GK Positioning) and reach.
  penalty: { role: 'keeper', pairs: [['finishing', 'reflexes'], ['composure', 'gkPositioning'], ['shooting', 'diving']] },
  corner: { role: 'aerial', pairs: AERIAL },
  header: { role: 'aerial', pairs: AERIAL },
  // The delivery (kick.kickSkill('cross'): Crossing / Curve / Passing) against the man attacking it.
  corner_kick: { role: 'aerial', pairs: [['crossing', 'heading'], ['curve', 'jumping'], ['passing', 'positioning']] },
  build_up: { role: 'marker', pairs: PASSING },
  // kick.kickSkill('lofted'): Long Passing / Vision; Composure buys the time to pick it.
  switch_play: { role: 'marker', pairs: [['longPassing', 'anticipation'], ['vision', 'positioning'], ['composure', 'aggression']] },
  counter: { role: 'marker', pairs: CARRY },
  dribble: { role: 'marker', pairs: [['dribbling', 'tackling'], ['agility', 'agility'], ['acceleration', 'acceleration'], ['balance', 'aggression']] },
  hold_up: { role: 'marker', pairs: HOLD },
  shoulder_duel: { role: 'marker', pairs: [['strength', 'strength'], ['balance', 'balance'], ['pace', 'pace'], ['firstTouch', 'aggression']] },
  long_ball_control: { role: 'marker', pairs: [['firstTouch', 'anticipation'], ['strength', 'strength'], ['jumping', 'jumping'], ['balance', 'aggression']] },
  cross: { role: 'marker', pairs: CROSSING },
  defend: { role: 'carrier', pairs: DEFEND },
  defend_1v1: { role: 'carrier', pairs: [['tackling', 'dribbling'], ['positioning', 'agility'], ['pace', 'pace'], ['anticipation', 'acceleration']] },
  interception: { role: 'carrier', pairs: READ },
  press_trap: { role: 'carrier', pairs: [['anticipation', 'passing'], ['workRate', 'composure'], ['aggression', 'firstTouch'], ['acceleration', 'pace']] },
  block: { role: 'carrier', pairs: [['positioning', 'shooting'], ['aggression', 'composure'], ['anticipation', 'finishing'], ['acceleration', 'curve']] },
  recovery_run: { role: 'carrier', pairs: RECOVER },
  back_post: { role: 'attacker', pairs: AERIAL },
  fk_wall: { role: 'attacker', pairs: [['gkPositioning', 'setPieces'], ['reflexes', 'curve'], ['diving', 'shooting'], ['handling', 'composure']] },
  gk_save: { role: 'attacker', pairs: KEEP },
  gk_penalty: { role: 'attacker', pairs: [['reflexes', 'setPieces'], ['diving', 'shooting'], ['gkPositioning', 'composure'], ['handling', 'curve']] },
  gk_1v1: { role: 'attacker', pairs: KEEP },
  gk_sweep: { role: 'attacker', pairs: [['acceleration', 'pace'], ['gkPositioning', 'anticipation'], ['pace', 'acceleration'], ['handling', 'firstTouch']] },
  gk_claim: { role: 'attacker', pairs: KEEP_HIGH },
  gk_distribution: { role: 'attacker', pairs: DISTRIBUTE },
}

const v = (a: Attributes, k: AttributeKey): number => a[k] ?? 50

const d2 = (p: ScenarioPlayer, q: { x: number; y: number }) => Math.hypot(p.pos.x - q.x, p.pos.y - q.y)

/** The opponent the moment is about (see the module comment). */
export function keyOpponent(hl: Highlight): ScenarioPlayer | null {
  const sc = hl.scenario
  const kind = sc.kind ?? hl.kind
  const hero = sc.players.find((p) => p.isHero)
  const opps = sc.players.filter((p) => p.side !== hl.side)
  if (!hero || !opps.length) return null
  const outfield = opps.filter((p) => p.role !== 'GK')
  const role = KIND_PAIRS[kind].role
  if (role === 'keeper') return opps.find((p) => p.role === 'GK') ?? outfield[0] ?? null
  const ball = sc.ball.pos
  const owner = sc.ball.ownerId ? opps.find((p) => p.id === sc.ball.ownerId) : undefined
  const near = (to: { x: number; y: number }) => [...outfield].sort((a, b) => d2(a, to) - d2(b, to))[0] ?? null
  if (role === 'carrier' || role === 'attacker') {
    if (owner && owner.role !== 'GK') return owner
    // The striker nearest our goal (the hero's team defends x = 0 in the scenario frame).
    if (role === 'attacker') return [...outfield].sort((a, b) => a.pos.x - b.pos.x)[0] ?? null
    return near(ball)
  }
  // marker / aerial: the man nearest the hero (an aerial duel: nearest to the hero in the box).
  return near(hero.pos)
}

/** Builds the matchup card data for a highlight (null when the scenario has no hero or no opponent). */
export function momentMatchup(hl: Highlight, names: Record<string, string> = {}): Matchup | null {
  const sc = hl.scenario
  const kind = sc.kind ?? hl.kind
  const hero = sc.players.find((p) => p.isHero)
  const opp = keyOpponent(hl)
  if (!hero || !opp) return null
  const spec = KIND_PAIRS[kind]
  const side = (p: ScenarioPlayer): MatchupSide => ({
    id: p.id,
    name: names[p.id] ?? `#${p.number}`,
    number: p.number,
    role: p.role,
    // A keeper-hero is rated as a keeper in a keeper moment, whatever his registered position.
    ovr: ovrFor(p.attrs, p.isHero && KEEPER_KINDS.has(kind) ? 'GK' : p.role),
  })
  const rows: MatchupRow[] = spec.pairs.map(([h, o]) => {
    const heroV = v(hero.attrs, h)
    const oppV = v(opp.attrs, o)
    const d = heroV - oppV
    return { hero: h, opp: o, heroV, oppV, edge: d >= EDGE_MARGIN ? 1 : d <= -EDGE_MARGIN ? -1 : 0 }
  })
  const diff = rows.reduce((s, r) => s + r.heroV - r.oppV, 0) / Math.max(1, rows.length)
  return { kind, role: spec.role, hero: side(hero), opp: side(opp), rows, diff, edge: diff >= EDGE_MARGIN ? 1 : diff <= -EDGE_MARGIN ? -1 : 0 }
}

/** The hero's attributes that decide a moment kind (the matchup rows' hero side). */
export const kindHeroAttrs = (kind: HighlightKind): readonly AttributeKey[] => [...new Set(KIND_PAIRS[kind].pairs.map((p) => p[0]))]
/** The key opponent's attributes that decide a moment kind (the matchup rows' opponent side). */
export const kindOppAttrs = (kind: HighlightKind): readonly AttributeKey[] => [...new Set(KIND_PAIRS[kind].pairs.map((p) => p[1]))]
