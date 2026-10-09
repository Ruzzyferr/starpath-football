/**
 * Live-moment attribute sensitivity (mental group; the rest in the sibling attrSensitivity.*.test.ts files): for
 * every attribute, the moment that exercises it is played with the attribute low (40) and high (85), everything
 * else equal, and the mechanical metric must move by a meaningful amount in the right direction (MOMENT_PROBES).
 * Report (etki tablosu): ATTR_REPORT=1 npx vitest run src/game/attrSensitivity   (ATTR_N_SCALE=2 doubles samples)
 */
import { describe, expect, it } from 'vitest'
import type { AttributeKey } from '../core/types'
import { MOMENT_PROBES, probePasses, probeTableRow, runMomentProbe } from './attrSensitivity'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const SCALE = Number(ENV.ATTR_N_SCALE ?? 1)
const GROUP: readonly AttributeKey[] = ['vision', 'composure', 'positioning', 'anticipation', 'aggression', 'leadership', 'reflexes', 'diving', 'handling', 'gkPositioning', 'gkDistribution']

describe('live moments: every mental attribute changes the mechanics', () => {
  for (const p of MOMENT_PROBES.filter((q) => GROUP.includes(q.attr))) {
    it(`${p.attr} → ${p.kind}: ${p.metric}`, () => {
      const row = runMomentProbe(p, Math.round(p.n * SCALE))
      if (ENV.ATTR_REPORT === '1') console.log(`ROW ${probeTableRow(row)}`)
      expect(row.effect).toBeGreaterThanOrEqual(p.min)
      expect(probePasses(row)).toBe(true)
    }, 600_000)
  }
})
