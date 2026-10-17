/**
 * Hang fuzz for everything a trial (and a training drill) runs on the main thread before and
 * just after the first frame: the intro card (matchup, opponent level, diagram), createDrill and
 * the first few seconds of updates. A loop that never ends here freezes the app with no error
 * (a player on an Android WebView saw exactly that: black overlay, Quit dead, no panel).
 *
 * Deterministic: every case is seeded. Each case must finish well inside its time budget.
 */
import { describe, expect, it } from 'vitest'
import { Rng, hashString } from '../../core/rng'
import { POSITIONS, type Attributes, type Position } from '../../core/types'
import { makeGame } from '../../sim/game/testHelpers'
import { COUNTRY_BY_ID } from '../../data/world/countries'
import { pendingTrials, trialDrillsFor } from '../../sim/game/trials'
import { drillOpponentFor } from '../../ui/screens/training/drillOpponent'
import { flatAttrs } from '../setup'
import { createDrill } from './drills'
import { drillMatchup } from './matchup'
import { BOTS, idle, type Bot, type Mem } from './drillBots'
import { DRILL_KINDS, type DrillInput, type DrillKind, type DrillVariant } from './types'
import type { HeroAction } from '../runtime'

/** One case (create + ticks) must stay far below this; a hang would never return at all. */
const CASE_BUDGET_MS = 1500
const ATTR_KEYS = Object.keys(flatAttrs(50, true)) as (keyof Attributes)[]
const EXTREMES = [0, 1, 99, 100]

function randomAttrs(rng: Rng): Attributes {
  const mode = rng.int(0, 4)
  const a = flatAttrs(50, true)
  for (const k of ATTR_KEYS) {
    if (mode === 0) a[k] = 0
    else if (mode === 1) a[k] = 100
    else if (mode === 2) a[k] = EXTREMES[rng.int(0, EXTREMES.length - 1)]!
    else a[k] = rng.chance(0.2) ? EXTREMES[rng.int(0, EXTREMES.length - 1)]! : rng.int(1, 99)
  }
  return a
}

const vec = (rng: Rng, span = 60) => ({ x: rng.range(-span, span), y: rng.range(-span, span) })

function randomAction(rng: Rng): HeroAction {
  switch (rng.int(0, 6)) {
    case 0: return { kind: 'shoot', target: vec(rng, 120), power: rng.range(0, 1.2), curl: rng.range(-1.5, 1.5), chip: rng.chance(0.3) }
    case 1: return { kind: 'pass', target: vec(rng, 120), lofted: rng.chance(0.4), through: rng.chance(0.3) }
    case 2: return { kind: 'pass', dir: vec(rng, 1) }
    case 3: return { kind: 'skill' }
    case 4: return { kind: 'action' }
    case 5: return { kind: 'dive', dir: vec(rng, 1) }
    default: return { kind: 'tapAt', at: vec(rng, 120) }
  }
}

/** A thumb mashing the screen: random moves, sprint and actions. */
const randomBot = (rng: Rng): Bot => () => {
  const input: DrillInput = { move: rng.chance(0.2) ? { x: 0, y: 0 } : vec(rng, 1), sprint: rng.chance(0.5), actions: [], aim: null }
  if (rng.chance(0.15)) input.actions.push(randomAction(rng))
  return input
}

/** Runs a fresh drill for `seconds` of 60 fps frames (with a few long and zero frames mixed in). */
function runCase(kind: DrillKind, cfg: Parameters<typeof createDrill>[1], bot: Bot, seconds: number, rng: Rng): number {
  const t0 = performance.now()
  const d = createDrill(kind, cfg)
  d.view()
  const mem: Mem = { t: 0, mem: {} }
  for (let i = 0; i < seconds * 60 && !d.finished; i++) {
    const dt = i % 97 === 0 ? 0.5 : i % 53 === 0 ? 0 : 1 / 60
    mem.t += dt
    d.update(dt, bot(d, mem))
    d.drainEvents()
    const v = d.view()
    if (!Number.isFinite(v.hero.x) || !Number.isFinite(v.hero.y) || !Number.isFinite(v.span) || !Number.isFinite(v.focus.x)) {
      throw new Error(`${kind}: non-finite view at frame ${i} (hero ${v.hero.x},${v.hero.y} span ${v.span})`)
    }
  }
  void rng
  return performance.now() - t0
}

const VARIANTS: Partial<Record<DrillKind, DrillVariant[]>> = {
  finishing: ['standard', 'setPiece'],
  passing: ['standard', 'rondo'],
}

describe('trial / drill start hang fuzz', () => {
  it('a new career’s trials: intro data, createDrill and the first seconds finish fast for every position', () => {
    let worst = 0
    // Every position × several seeds, nationalities, genders and aim assists (the save decides the drill and its seed).
    const nations = Object.keys(COUNTRY_BY_ID)
    for (let seed = 1; seed <= 30; seed++) {
      const position: Position = POSITIONS[seed % POSITIONS.length]!
      const difficulty = (['easy', 'normal', 'hard', 'legend'] as const)[seed % 4]!
      const nationality = nations[(seed * 31) % nations.length]!
      const s = makeGame(seed * 7919, { trials: true, position, difficulty, nationality, gender: seed % 3 === 0 ? 'female' : 'male' })
      const invites = pendingTrials(s)
      expect(invites.length).toBeGreaterThan(0)
      for (const inv of invites) {
        expect(trialDrillsFor(position, s.hero.role)).toContain(inv.drill)
        const t0 = performance.now()
        const opp = drillOpponentFor(s, inv.clubId)
        expect(Number.isFinite(opp)).toBe(true)
        drillMatchup(inv.drill, 'standard', s.hero.attrs, opp)
        const rng = new Rng(seed)
        const cfg = { attrs: s.hero.attrs, seed: hashString(`${s.meta.seed}|trial|${inv.id}`), aimAssist: (['manual', 'half', 'full'] as const)[seed % 3], difficulty: 1, opponent: opp }
        runCase(inv.drill, cfg, () => idle, 4, rng)
        runCase(inv.drill, cfg, randomBot(rng), 6, rng)
        const ms = performance.now() - t0
        worst = Math.max(worst, ms)
        expect(ms, `seed ${seed} ${position} ${inv.drill}`).toBeLessThan(CASE_BUDGET_MS)
      }
    }
    expect(worst).toBeLessThan(CASE_BUDGET_MS)
  }, 60_000)

  for (const kind of DRILL_KINDS) {
    it(`${kind}: random / extreme attributes, opponents and inputs never hang`, () => {
      const rng = new Rng(hashString(`fuzz|${kind}`))
      const variants = VARIANTS[kind] ?? ['standard']
      for (let i = 0; i < 60; i++) {
        const attrs = randomAttrs(rng)
        const variant = variants[i % variants.length]!
        const opponent = i % 3 === 0 ? undefined : rng.chance(0.3) ? EXTREMES[rng.int(0, 3)]! : rng.int(25, 99)
        const difficulty = rng.chance(0.2) ? undefined : rng.range(0.8, 1.3)
        drillMatchup(kind, variant, attrs, opponent ?? 60)
        const cfg = {
          attrs, seed: rng.chance(0.5) ? rng.int(0, 2 ** 31) : `s${i}`,
          aimAssist: (['manual', 'half', 'full'] as const)[i % 3],
          ...(difficulty !== undefined ? { difficulty } : {}),
          ...(opponent !== undefined ? { opponent } : {}),
          ...(variant !== 'standard' ? { variant } : {}),
        }
        const bot = variant !== 'standard' ? randomBot(rng) : i % 4 === 0 ? BOTS[kind].good : i % 4 === 1 ? BOTS[kind].meh : randomBot(rng)
        const ms = runCase(kind, cfg, bot, 5, rng)
        expect(ms, `${kind} #${i} ${JSON.stringify({ opponent, difficulty, variant })}`).toBeLessThan(CASE_BUDGET_MS)
      }
    }, 60_000)
  }
})
