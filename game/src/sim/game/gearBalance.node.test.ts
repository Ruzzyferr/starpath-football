/**
 * Pay-to-win guard (docs/MONETIZASYON.md §6.3): diamond gear only speeds up training. Over five
 * seasons a player who wears the Golden Boots the whole time must not out-progress a free player by
 * more than 25 %, and the free player still breaks into the side.
 */
import { describe, expect, it } from 'vitest'
import { runCareer, standardMix, type CareerConfig } from './balanceSim'

function cohort(gear: CareerConfig['gear'], n: number, cashPerSeason = false) {
  return standardMix(n, 5, 7100).map((c) => runCareer({ ...c, gear, cashPerSeason }))
}

describe('gear balance (5 seasons, same seeds)', () => {
  it('Golden Boots all career: OVR growth ≤ +25% over a free player; free players still play', () => {
    const n = 12
    const free = cohort('none', n)
    const paid = cohort('always', n)
    const starter = cohort('starter', n)
    const growth = (t: ReturnType<typeof runCareer>) => (t.samples.at(-1)?.ovr ?? t.startOvr) - t.startOvr
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const gFree = avg(free.map(growth))
    const gPaid = avg(paid.map(growth))
    const gStarter = avg(starter.map(growth))
    const appsS3 = avg(free.map((t) => t.samples[2]?.apps ?? 0))
    console.log(`[gear balance] OVR growth free ${gFree.toFixed(2)} · starter ${gStarter.toFixed(2)} · always ${gPaid.toFixed(2)} (×${(gPaid / gFree).toFixed(3)}); free apps in season 3: ${appsS3.toFixed(1)}`)
    expect(gPaid).toBeGreaterThanOrEqual(gFree)
    expect(gPaid / gFree).toBeLessThanOrEqual(1.25)
    expect(gStarter / gFree).toBeLessThanOrEqual(1.1)
    expect(appsS3).toBeGreaterThanOrEqual(10)
  }, 600_000)

  it('the biggest spender (every gear slot, an ad boost every session, the largest cash pack each season): ≤ +25% growth, same milestones', () => {
    const n = 12
    const free = cohort('none', n)
    const whale = cohort('max', n, true)
    const growth = (t: ReturnType<typeof runCareer>) => (t.samples.at(-1)?.ovr ?? t.startOvr) - t.startOvr
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const gFree = avg(free.map(growth))
    const gWhale = avg(whale.map(growth))
    const topFree = free.filter((t) => t.firstTopTierAge !== null).length
    const topWhale = whale.filter((t) => t.firstTopTierAge !== null).length
    console.log(`[gear balance] biggest spender: OVR growth ${gWhale.toFixed(2)} vs free ${gFree.toFixed(2)} (×${(gWhale / gFree).toFixed(3)}); reached a top tier ${topWhale}/${n} vs ${topFree}/${n}`)
    expect(gWhale / gFree).toBeLessThanOrEqual(1.25)
    expect(topWhale - topFree).toBeLessThanOrEqual(3)
  }, 900_000)
})
