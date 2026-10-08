/**
 * Synthetic teams for match-engine tests and tuning. Not used by the game.
 */
import { clamp, Rng } from '../../core/rng'
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes, type Formation, type Position, type TacticStyle } from '../../core/types'
import { formationSlots } from './formations'
import type { MatchPlayer, MatchSetup, MatchTeam, Side, Weather } from './types'

/** Attributes a position is strong / weak in (relative to its overall). */
const PROFILE: Record<Position, { hi: AttributeKey[]; lo: AttributeKey[] }> = {
  GK: { hi: ['reflexes', 'handling', 'gkPositioning', 'gkDistribution', 'gkPositioning', 'gkDistribution', 'positioning', 'jumping'], lo: ['finishing', 'dribbling', 'shooting', 'crossing', 'tackling'] },
  CB: { hi: ['tackling', 'heading', 'strength', 'positioning', 'jumping'], lo: ['finishing', 'dribbling', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution'] },
  LB: { hi: ['pace', 'tackling', 'crossing', 'stamina'], lo: ['finishing', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution'] },
  RB: { hi: ['pace', 'tackling', 'crossing', 'stamina'], lo: ['finishing', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution'] },
  DM: { hi: ['tackling', 'passing', 'positioning', 'workRate'], lo: ['finishing', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution'] },
  CM: { hi: ['passing', 'vision', 'stamina', 'firstTouch'], lo: ['reflexes', 'handling', 'gkPositioning', 'gkDistribution', 'heading'] },
  AM: { hi: ['vision', 'dribbling', 'passing', 'shooting'], lo: ['tackling', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution', 'strength'] },
  LW: { hi: ['pace', 'dribbling', 'crossing', 'agility'], lo: ['tackling', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution', 'heading'] },
  RW: { hi: ['pace', 'dribbling', 'crossing', 'agility'], lo: ['tackling', 'reflexes', 'handling', 'gkPositioning', 'gkDistribution', 'heading'] },
  ST: { hi: ['finishing', 'shooting', 'composure', 'heading'], lo: ['tackling', 'reflexes', 'handling'] },
}

/** Generates plausible attributes for a position around an overall rating. */
export function makeAttributes(rng: Rng, pos: Position, ovr: number): Attributes {
  const prof = PROFILE[pos]
  const a = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) {
    const bias = prof.hi.includes(k) ? 6 : prof.lo.includes(k) ? -30 : -6
    // The v4 goalkeeping pair takes no draw, so every fixture rolled before it keeps its stream.
    const v4 = k === 'gkPositioning' || k === 'gkDistribution'
    a[k] = Math.round(clamp(ovr + bias + (v4 ? 0 : rng.normal(0, 5)), 5, 99))
  }
  return a
}

/** Options for {@link makeTeam}. */
export interface TeamOptions {
  ovr?: number
  formation?: Formation
  style?: TacticStyle
  morale?: number
  /** Put the hero in this position in the starting XI. */
  heroPosition?: Position
  /** Hero sits on the bench instead. */
  heroOnBench?: boolean
  /** relationToHero of every teammate. */
  relation?: number
  /** Hero overall (defaults to team ovr). */
  heroOvr?: number
}

const BENCH: Position[] = ['GK', 'CB', 'LB', 'CM', 'AM', 'LW', 'ST']

/** Builds a team with an 11-man XI matching the formation plus 7 subs. */
export function makeTeam(rng: Rng, id: string, opts: TeamOptions = {}): MatchTeam {
  const ovr = opts.ovr ?? 65
  const formation = opts.formation ?? '4-4-2'
  const mk = (pos: Position, i: number, isHero: boolean): MatchPlayer => {
    const o = isHero ? opts.heroOvr ?? ovr : Math.round(clamp(ovr + rng.normal(0, 4), 30, 95))
    return {
      id: isHero ? 'hero' : `${id}-${i}`,
      name: isHero ? 'Arda' : `${id.toUpperCase()}${i}`,
      number: i + 1,
      position: pos,
      ovr: o,
      attrs: makeAttributes(rng, pos, o),
      isHero,
      relationToHero: isHero ? 0 : opts.relation ?? 0,
    }
  }
  const slots = formationSlots(formation)
  let heroPlaced = false
  const lineup = slots.map((s, i) => {
    const isHero = !heroPlaced && !opts.heroOnBench && opts.heroPosition === s.role
    if (isHero) heroPlaced = true
    return mk(s.role, i, isHero)
  })
  if (opts.heroPosition && !opts.heroOnBench && !heroPlaced) {
    lineup[lineup.length - 1] = mk(opts.heroPosition, 10, true)
  }
  const bench = BENCH.map((p, i) => mk(p, 11 + i, false))
  if (opts.heroOnBench && opts.heroPosition) bench[bench.length - 1] = mk(opts.heroPosition, 17, true)
  return {
    id,
    name: id === 'h' ? 'Yıldızspor' : id === 'a' ? 'Kartal FK' : id,
    shortName: id.toUpperCase().slice(0, 3),
    colors: { primary: '#ff0000', secondary: '#ffffff', pattern: 'plain' },
    formation,
    style: opts.style ?? 'balanced',
    lineup,
    bench,
    morale: opts.morale ?? 1,
  }
}

/** Options for {@link makeSetup}. */
export interface SetupOptions {
  seed: number
  home?: TeamOptions
  away?: TeamOptions
  heroSide?: Side | null
  knockout?: boolean
  weather?: Weather
  difficulty?: number
  neutralVenue?: boolean
}

/** Builds a complete MatchSetup; team generation is seeded from `seed`. */
export function makeSetup(o: SetupOptions): MatchSetup {
  const rng = new Rng(`teams-${o.seed}`)
  const heroSide = o.heroSide ?? null
  const home = makeTeam(rng, 'h', o.home)
  const away = makeTeam(rng, 'a', o.away)
  const heroTeam = heroSide ? (heroSide === 'home' ? o.home : o.away) : undefined
  return {
    home,
    away,
    seed: o.seed,
    competitionName: 'Test League',
    weather: o.weather ?? 'clear',
    heroSide,
    heroOnBench: !!heroTeam?.heroOnBench,
    knockout: !!o.knockout,
    neutralVenue: !!o.neutralVenue,
    importance: 0.5,
    difficulty: o.difficulty ?? 1,
  }
}
