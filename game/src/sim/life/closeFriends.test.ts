import { describe, expect, it } from 'vitest'
import { makeHeroLife } from '../career/testFixtures'
import {
  CLOSE_FRIEND_MIN, CLOSE_FRIEND_PASS_BONUS, MAX_CLOSE_FRIENDS, closeFriendMatchBonus, closeFriends, toggleCloseFriend, weeklyCloseFriendSupport,
} from './closeFriends'
import { ensureTeammates, passFactor, weeklyRelationDecay } from './relationships'

function setup() {
  const { life, hero } = makeHeroLife()
  ensureTeammates(life, [1, 2, 3, 4].map((i) => ({ npcId: `n${i}`, name: `Mate ${i}` })))
  for (const r of Object.values(life.relationships)) if (r.kind === 'teammate') r.value = 40
  return { life, hero }
}

describe('close friends (2.4#37)', () => {
  it('caps the list at three and only allows people', () => {
    const { life } = setup()
    const ids = Object.values(life.relationships).filter((r) => r.kind === 'teammate').map((r) => r.id)
    for (const id of ids.slice(0, 3)) expect(toggleCloseFriend(life, id)).toBe('added')
    expect(toggleCloseFriend(life, ids[3])).toBe('full')
    expect(closeFriends(life)).toHaveLength(MAX_CLOSE_FRIENDS)
    expect(toggleCloseFriend(life, ids[0])).toBe('removed')
    expect(toggleCloseFriend(life, 'fans')).toBe('invalid')
  })

  it('a warm teammate friend gets about +10 % pass chance, a cold one nothing', () => {
    const { life } = setup()
    const r = Object.values(life.relationships).find((x) => x.kind === 'teammate')!
    toggleCloseFriend(life, r.id)
    const bonus = closeFriendMatchBonus(r)
    expect(bonus).toBe(CLOSE_FRIEND_PASS_BONUS)
    expect(passFactor(r.value + bonus) / passFactor(r.value)).toBeGreaterThan(1.07)
    expect(passFactor(r.value + bonus) / passFactor(r.value)).toBeLessThan(1.12)
    r.value = CLOSE_FRIEND_MIN - 5
    expect(closeFriendMatchBonus(r)).toBe(0)
  })

  it('stands by the hero in a crisis, at most once per four weeks', () => {
    const { life, hero } = setup()
    const r = Object.values(life.relationships).find((x) => x.kind === 'teammate')!
    expect(weeklyCloseFriendSupport(life, hero, 10)).toHaveLength(0) // no friend yet
    toggleCloseFriend(life, r.id)
    life.happiness = 20
    life.stress = 60
    expect(weeklyCloseFriendSupport(life, hero, 10)).toHaveLength(1)
    expect(life.happiness).toBe(26)
    expect(life.stress).toBe(55)
    expect(weeklyCloseFriendSupport(life, hero, 12)).toHaveLength(0)
    expect(weeklyCloseFriendSupport(life, hero, 14)).toHaveLength(1)
    life.happiness = 80
    life.stress = 20
    expect(weeklyCloseFriendSupport(life, hero, 30)).toHaveLength(0) // no crisis
  })

  it('neglect fades a close friend at half speed', () => {
    const a = setup(); const b = setup()
    const [ra] = Object.values(a.life.relationships).filter((x) => x.kind === 'teammate')
    const rb = b.life.relationships[ra.id]
    ra.value = rb.value = 60
    toggleCloseFriend(b.life, rb.id)
    for (let w = 10; w < 20; w++) { weeklyRelationDecay(a.life, w); weeklyRelationDecay(b.life, w) }
    expect(60 - rb.value).toBeLessThan((60 - ra.value) * 0.7)
  })
})
