/**
 * Cross-engine determinism (GAP-AUDIT 2.9#29): the simulation must produce byte-identical results in
 * the browser's JS engine and in Node. The same digest is computed in this Node process and inside the
 * page (dev server modules, so it exercises the exact code the game ships); any divergence in Math,
 * float formatting or iteration order fails here before it can desync two players' careers.
 * Firefox/WebKit join automatically when a project for them is added to playwright.config.ts.
 */
import { test, expect } from './fixtures'
import { hashString } from '../src/core/rng'
import { MatchSim } from '../src/sim/match/engine'
import { makeSetup } from '../src/sim/match/testFixtures'
import { makeGame } from '../src/sim/game/testHelpers'

const hex = (s: string): string => hashString(s).toString(16).padStart(8, '0')

function nodeDigest(): { matches: string; career: string } {
  let acc = ''
  for (let i = 0; i < 120; i++) {
    const s = new MatchSim(makeSetup({ seed: 70_000 + i }), 'en').simulateToEnd()
    acc += `${s.score[0]}-${s.score[1]}:${s.shots[0]}/${s.shots[1]};`
  }
  const g = makeGame(7)
  g.meta.createdAt = g.meta.updatedAt = 0
  return { matches: hex(acc), career: hex(JSON.stringify(g)) }
}

test('simulation digests match between Node and the browser engine', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'engine check runs once')
  test.setTimeout(240_000)
  const expected = nodeDigest()
  await page.goto('/match-demo.html?kind=counter&seed=5&q=low') // any page on the dev server origin
  const actual = await page.evaluate(async () => {
    const [{ hashString }, { MatchSim }, { makeSetup }, { makeGame }] = await Promise.all([
      import('/src/core/rng.ts'),
      import('/src/sim/match/engine.ts'),
      import('/src/sim/match/testFixtures.ts'),
      import('/src/sim/game/testHelpers.ts'),
    ])
    const hexOf = (s: string): string => hashString(s).toString(16).padStart(8, '0')
    let acc = ''
    for (let i = 0; i < 120; i++) {
      const s = new MatchSim(makeSetup({ seed: 70_000 + i }), 'en').simulateToEnd()
      acc += `${s.score[0]}-${s.score[1]}:${s.shots[0]}/${s.shots[1]};`
    }
    const g = makeGame(7)
    g.meta.createdAt = g.meta.updatedAt = 0
    return { matches: hexOf(acc), career: hexOf(JSON.stringify(g)) }
  })
  expect(actual).toEqual(expected)
})
