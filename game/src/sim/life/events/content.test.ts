import { Rng } from '../../../core/rng'
import type { GameState, LText } from '../../../core/types'
import { ALL_EVENTS } from './content'
import { applyEffectResult, buildVars, formatBoth, placeholdersOf, STANDARD_VAR_KEYS } from './engine'
import { makeTestState } from './testFixture'
import { EVENT_CATEGORIES, type EventCtx, type EventDef, type EventVars } from './types'

const byId = new Map(ALL_EVENTS.map((e) => [e.id, e]))

const variants = (seed: number): GameState[] => [
  makeTestState({ seed }),
  makeTestState({ seed, partner: true, money: 5_000_000, reputation: 85 }),
  makeTestState({ seed, money: 0, reputation: 3 }),
]

function nonEmpty(t: LText | undefined, where: string): void {
  expect(t, where).toBeDefined()
  expect(t!.tr.trim().length, `${where} (tr)`).toBeGreaterThan(0)
  expect(t!.en.trim().length, `${where} (en)`).toBeGreaterThan(0)
}

function findBad(obj: unknown, path: string, out: string[]): void {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) out.push(path)
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) findBad(v, `${path}.${k}`, out)
  }
}

const UNRESOLVED = /\{\w+(?::\w+)?\}/

/** Run every choice of every event on several states/seeds; collect incoming chain vars. */
function exercise(): { incoming: Map<string, Set<string>>; edges: [string, string][]; errors: string[] } {
  const incoming = new Map<string, Set<string>>()
  const edges: [string, string][] = []
  const errors: string[] = []
  // Follow-up-only events are exercised through their parents (they rely on inherited vars).
  const queue: { def: EventDef; parentVars?: EventVars }[] = ALL_EVENTS.filter((e) => !e.followUpOnly).map((def) => ({ def }))
  const visitedChild = new Set<string>()
  while (queue.length) {
    const { def, parentVars } = queue.shift()!
    for (let seed = 1; seed <= 6; seed++) {
      for (const base of variants(seed)) {
        def.choices.forEach((choice, ci) => {
          const state = structuredClone(base)
          const rng = new Rng(seed * 97 + ci)
          const vars = buildVars(state, rng, def, [], parentVars)
          for (const tx of [def.title, def.text, choice.label, choice.hint]) {
            if (!tx) continue
            const f = formatBoth(tx, vars)
            if (UNRESOLVED.test(f.tr) || UNRESOLVED.test(f.en)) errors.push(`${def.id}: unresolved in "${f.en}"`)
          }
          const ctx: EventCtx = { state, vars, absWeek: 0, tags: [] }
          try {
            choice.requires?.(ctx)
            const res = choice.effects(ctx, rng)
            nonEmpty(res.text, `${def.id}#${ci} outcome`)
            const out = applyEffectResult(state, rng, def, vars, res)
            if (UNRESOLVED.test(out.text.tr) || UNRESOLVED.test(out.text.en)) errors.push(`${def.id}#${ci}: unresolved outcome "${out.text.en}"`)
            if (out.news && (UNRESOLVED.test(out.news.headline.en) || UNRESOLVED.test(out.news.headline.tr))) errors.push(`${def.id}#${ci}: unresolved news`)
            for (const d of res.deltas) {
              if ('amount' in d && !Number.isFinite(d.amount)) errors.push(`${def.id}#${ci}: NaN delta ${d.kind}`)
            }
            const bad: string[] = []
            findBad(state.life, 'life', bad)
            findBad(state.hero, 'hero', bad)
            if (bad.length) errors.push(`${def.id}#${ci}: non-finite ${bad.join(',')}`)
            for (const fu of res.followUps ?? []) {
              const child = byId.get(fu.eventId)
              if (!child) {
                errors.push(`${def.id}: unknown follow-up ${fu.eventId}`)
                continue
              }
              edges.push([def.id, child.id])
              const childVars = { ...vars, ...(fu.vars ?? {}) }
              const set = incoming.get(child.id) ?? new Set<string>()
              Object.keys(childVars).forEach((k) => set.add(k))
              incoming.set(child.id, set)
              const key = `${def.id}>${child.id}`
              if (!visitedChild.has(key)) {
                visitedChild.add(key)
                queue.push({ def: child, parentVars: childVars })
              }
            }
          } catch (e) {
            errors.push(`${def.id}#${ci}: threw ${(e as Error).message}`)
          }
        })
      }
    }
  }
  return { incoming, edges, errors }
}

describe('event content', () => {
  const run = exercise()

  it('has at least 160 events with unique, category-prefixed ids', () => {
    expect(ALL_EVENTS.length).toBeGreaterThanOrEqual(160)
    const ids = new Set<string>()
    for (const e of ALL_EVENTS) {
      expect(ids.has(e.id), `duplicate ${e.id}`).toBe(false)
      ids.add(e.id)
      expect(e.id.startsWith(`${e.category}.`), e.id).toBe(true)
    }
  })

  it('spreads events across categories', () => {
    const counts = new Map<string, number>()
    for (const e of ALL_EVENTS) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    for (const c of EVENT_CATEGORIES) expect(counts.get(c) ?? 0, c).toBeGreaterThanOrEqual(5)
    for (const [c, n] of counts) expect(n / ALL_EVENTS.length, c).toBeLessThan(0.12)
  })

  it('has bilingual, non-empty texts and 2–4 choices with one always available', () => {
    for (const e of ALL_EVENTS) {
      nonEmpty(e.title, `${e.id} title`)
      nonEmpty(e.text, `${e.id} text`)
      expect(e.icon.length, e.id).toBeGreaterThan(0)
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2)
      expect(e.choices.length, e.id).toBeLessThanOrEqual(4)
      expect(e.choices.some((c) => !c.requires), `${e.id} needs an ungated choice`).toBe(true)
      e.choices.forEach((c, i) => {
        nonEmpty(c.label, `${e.id}#${i} label`)
        if (c.hint) nonEmpty(c.hint, `${e.id}#${i} hint`)
      })
      expect(e.cooldownWeeks, e.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('only uses placeholders that are provided', () => {
    const std = new Set<string>(STANDARD_VAR_KEYS)
    for (const e of ALL_EVENTS) {
      const own = new Set(Object.keys(e.vars ? e.vars({ state: makeTestState(), vars: {}, absWeek: 0, tags: [] }, new Rng(1)) : {}))
      const inc = run.incoming.get(e.id) ?? new Set<string>()
      const texts = [e.title, e.text, ...e.choices.flatMap((c) => [c.label, c.hint].filter((x): x is LText => !!x))]
      for (const tx of texts)
        for (const p of placeholdersOf(tx)) expect(std.has(p) || own.has(p) || inc.has(p), `${e.id}: {${p}}`).toBe(true)
    }
  })

  it('runs every effect on sample states without throwing, NaN or unresolved text', () => {
    expect(run.errors.slice(0, 20)).toEqual([])
  })

  it('follow-up-only events are reachable and chains are plentiful', () => {
    const targets = new Set(run.edges.map(([, b]) => b))
    for (const e of ALL_EVENTS) if (e.followUpOnly) expect(targets.has(e.id), `${e.id} unreachable`).toBe(true)
    // Count chains as connected components of the follow-up graph (≥2 events).
    const parent = new Map<string, string>()
    const find = (x: string): string => {
      let r = x
      while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!
      return r
    }
    for (const [a, b] of run.edges) {
      if (!parent.has(a)) parent.set(a, a)
      if (!parent.has(b)) parent.set(b, b)
      parent.set(find(a), find(b))
    }
    const roots = new Set([...parent.keys()].map(find))
    expect(roots.size).toBeGreaterThanOrEqual(12)
  })
})
