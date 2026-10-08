/**
 * Late-game money goals ("legacy projects"): the answer to "money sits idle
 * after ~5 seasons" (playtest round 2). Four sinks, each with a real effect:
 *
 *  - Youth academy foundation (3 building stages): upkeep each week, graduates
 *    every half-year (fans, reputation, mentor cards) and a head start for the
 *    Legacy child (reputation bonus on the child's career).
 *  - Charity stadium / community pitch (2 stages): upkeep, steady happiness,
 *    fan love, press goodwill, a yearly reputation bump.
 *  - Club ownership stake (up to {@link STAKE_MAX_PCT} %): weekly dividend, chairman respect;
 *    resale at 90 % (it is a stake, not a lottery ticket). At {@link STAKE_CONTROL_PCT} %
 *    the hero is the majority owner: club chairman, a better dividend, a big Hall
 *    of Fame line and a post-retirement epilogue (see {@link clubOwnerOf}).
 *  - Legacy fund: cash locked away at 3.5 %/yr. When the career ends, a share
 *    of it lands in the Legacy child's pocket (hard-capped so the child never
 *    starts as a millionaire, see `legacyFundBonus`).
 *
 * State lives in `life.flags` (plain numbers), so the decision cards in
 * `events/content/projects.ts` can start a project with `money() + flags()`
 * and no engine changes. The weekly tick runs inside `weeklyEconomy`.
 */
import type { Calendar, Hero, LText, Life } from '../../core/types'
import { absWeek, clamp, fill, fmtMoney, lt, type Lines } from '../career/common'
import { assetEffectTotal } from './assetEffects'
import { addHappiness } from './wellbeing'
import { changeRelation } from './relationships'

export const PROJECT_FLAGS = {
  academy: 'proj:academy',
  stadium: 'proj:stadium',
  stake: 'proj:stake',
  stakeInvested: 'proj:stakeInvested',
  stakeClub: 'proj:stakeClub',
  fund: 'proj:fund',
  graduates: 'proj:grads',
  /** Set once the hero has crossed {@link STAKE_CONTROL_PCT} (marker only; ownership itself is read from the live share). */
  ownerSince: 'proj:ownerSince',
} as const

/** Price of building stage 1..3 (index = stage). */
export const ACADEMY_PRICE = [0, 1_500_000, 3_000_000, 6_000_000] as const
/** Weekly upkeep at each stage (cumulative, not per stage). */
export const ACADEMY_UPKEEP = [0, 2_000, 5_500, 12_000] as const
export const STADIUM_PRICE = [0, 1_200_000, 3_500_000] as const
export const STADIUM_UPKEEP = [0, 1_800, 6_000] as const
/** Stake: price per percent, max percent, yearly yield on the invested sum. */
export const STAKE_PRICE_PER_PCT = 400_000
export const STAKE_MAX_PCT = 75
/** From this share on the hero controls the club (chairman-owner). */
export const STAKE_CONTROL_PCT = 51
/** Yearly yield bonus for a controlling owner (a say in the commercial deals). */
export const STAKE_CONTROL_YIELD = 0.02
/** Hall of Fame points for owning a club outright (on top of the stake's own 6). */
export const OWNER_LEGACY_POINTS = 45
export const STAKE_YIELD = 0.07
export const STAKE_RESALE = 0.9
export const FUND_GROWTH = 0.035
/** Legacy child gets this share of the fund, at most {@link LEGACY_FUND_CAP}. */
export const LEGACY_FUND_SHARE = 0.25
export const LEGACY_FUND_CAP = 120_000
/** Hall of Fame points per million locked in the legacy fund (capped): the fund's main payoff is the name it leaves. */
export const FUND_POINTS_PER_M = 1
export const FUND_POINTS_MAX = 10

const num = (life: Life, k: string): number => {
  const v = life.flags[k]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export const academyLevel = (life: Life): number => clamp(Math.round(num(life, PROJECT_FLAGS.academy)), 0, 3)
export const stadiumLevel = (life: Life): number => clamp(Math.round(num(life, PROJECT_FLAGS.stadium)), 0, 2)
export const stakePct = (life: Life): number => clamp(Math.round(num(life, PROJECT_FLAGS.stake)), 0, STAKE_MAX_PCT)
export const legacyFund = (life: Life): number => Math.max(0, num(life, PROJECT_FLAGS.fund))
export const academyGraduates = (life: Life): number => Math.max(0, Math.round(num(life, PROJECT_FLAGS.graduates)))
/** Money tied up in the stake at resale value (net worth). */
export const stakeValue = (life: Life): number => Math.round(num(life, PROJECT_FLAGS.stakeInvested) * STAKE_RESALE)
/** All project holdings that count towards net worth (fund + stake). */
export const projectsValue = (life: Life): number => Math.round(legacyFund(life) + stakeValue(life))
/** Next academy / stadium stage price (null when finished). */
export const nextAcademyPrice = (life: Life): number | null => (academyLevel(life) >= 3 ? null : ACADEMY_PRICE[academyLevel(life) + 1]!)
export const nextStadiumPrice = (life: Life): number | null => (stadiumLevel(life) >= 2 ? null : STADIUM_PRICE[stadiumLevel(life) + 1]!)
/** Weekly dividend of the club stake. */
export const stakeDividend = (life: Life): number =>
  Math.round((num(life, PROJECT_FLAGS.stakeInvested) * (STAKE_YIELD + (isClubOwner(life) ? STAKE_CONTROL_YIELD : 0))) / 52)
/** Majority owner: holds {@link STAKE_CONTROL_PCT} % or more of one club. */
export const isClubOwner = (life: Life): boolean => stakePct(life) >= STAKE_CONTROL_PCT
/** Weekly running cost of the academy and the stadium. */
export const projectUpkeep = (life: Life): number => ACADEMY_UPKEEP[academyLevel(life)]! + STADIUM_UPKEEP[stadiumLevel(life)]!

export interface ProjectResult {
  ok: boolean
  lines: Lines
}
const fail = (text: LText): ProjectResult => ({ ok: false, lines: [text] })

/** Build the next academy stage (the decision cards do the same through flags). */
export function buildAcademyStage(life: Life): ProjectResult {
  const price = nextAcademyPrice(life)
  if (price === null) return fail(lt('Akademin zaten tamamlandı.', 'Your academy is already complete.'))
  if (life.money < price) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= price
  life.flags[PROJECT_FLAGS.academy] = academyLevel(life) + 1
  return { ok: true, lines: [fill(lt('Akademi aşama {n} tamamlandı.', 'Academy stage {n} complete.'), { n: academyLevel(life) })] }
}

export function buildStadiumStage(life: Life): ProjectResult {
  const price = nextStadiumPrice(life)
  if (price === null) return fail(lt('Mahalle stadyumun zaten tamamlandı.', 'Your community stadium is already complete.'))
  if (life.money < price) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= price
  life.flags[PROJECT_FLAGS.stadium] = stadiumLevel(life) + 1
  return { ok: true, lines: [fill(lt('Hayır stadyumu aşama {n} tamamlandı.', 'Charity stadium stage {n} complete.'), { n: stadiumLevel(life) })] }
}

/** Put cash into the legacy fund (locked until the career ends). */
export function contributeLegacyFund(life: Life, amount: number): ProjectResult {
  const a = Math.round(amount)
  if (!(a > 0)) return fail(lt('Geçersiz tutar.', 'Invalid amount.'))
  if (life.money < a) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= a
  life.flags[PROJECT_FLAGS.fund] = legacyFund(life) + a
  return { ok: true, lines: [fill(lt('{m} miras fonuna yatırıldı.', '{m} moved into the legacy fund.'), { m: fmtMoney(a) })] }
}

/** Buy `pct` percent of a club. One club at a time; max {@link STAKE_MAX_PCT} percent. */
export function buyClubStake(life: Life, clubId: string, pct: number): ProjectResult {
  const p = Math.round(pct)
  const owned = stakePct(life)
  const club = life.flags[PROJECT_FLAGS.stakeClub]
  if (!(p > 0)) return fail(lt('Geçersiz yüzde.', 'Invalid share.'))
  if (owned > 0 && club !== clubId) return fail(lt('Aynı anda tek bir kulübe ortak olabilirsin.', 'You can co-own only one club at a time.'))
  if (owned + p > STAKE_MAX_PCT) return fail(fill(lt('En fazla %{n} hisse alabilirsin.', 'You can hold at most {n}%.'), { n: STAKE_MAX_PCT }))
  const cost = p * STAKE_PRICE_PER_PCT
  if (life.money < cost) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= cost
  life.flags[PROJECT_FLAGS.stake] = owned + p
  life.flags[PROJECT_FLAGS.stakeInvested] = num(life, PROJECT_FLAGS.stakeInvested) + cost
  life.flags[PROJECT_FLAGS.stakeClub] = clubId
  const lines: Lines = [fill(lt('Kulübün %{n} hissesini aldın.', 'You bought {n}% of the club.'), { n: owned + p })]
  if (owned < STAKE_CONTROL_PCT && owned + p >= STAKE_CONTROL_PCT) {
    life.flags[PROJECT_FLAGS.ownerSince] = 1
    const chairman = life.relationships.chairman
    if (chairman) changeRelation(life, chairman.id, 10)
    lines.push(lt('👔 Çoğunluk hissesi sende: artık kulübün sahibi ve başkanısın. Yönetim kurulu sana bakıyor.', '👔 You hold the majority: you are the club’s owner and chairman now. The board looks to you.'))
  }
  return { ok: true, lines }
}

export function sellClubStake(life: Life): ProjectResult & { amount: number } {
  const amount = stakeValue(life)
  if (amount <= 0) return { ...fail(lt('Satacak hissen yok.', 'You hold no stake.')), amount: 0 }
  life.money += amount
  life.flags[PROJECT_FLAGS.stake] = 0
  life.flags[PROJECT_FLAGS.stakeInvested] = 0
  delete life.flags[PROJECT_FLAGS.stakeClub]
  return { ok: true, amount, lines: [fill(lt('Hisseni sattın: {m}.', 'You sold your stake: {m}.'), { m: fmtMoney(amount) })] }
}

/** Legacy score points the hero's projects and collection add to the Hall of Fame entry. */
export const projectsLegacyPoints = (life: Life): number =>
  academyLevel(life) * 12 + stadiumLevel(life) * 10 + (stakePct(life) > 0 ? 6 : 0) + (isClubOwner(life) ? OWNER_LEGACY_POINTS : 0) + Math.round(assetEffectTotal(life, 'collector')) * 3
  + Math.min(FUND_POINTS_MAX, Math.floor((legacyFund(life) / 1_000_000) * FUND_POINTS_PER_M))

/** What the Legacy child receives from this career's fund. */
export const legacyFundBonus = (fund: number): number => Math.round(clamp(Math.max(0, fund) * LEGACY_FUND_SHARE, 0, LEGACY_FUND_CAP))
/** Reputation head start for the child from the parent's academy (0..3). */
export const legacyAcademyBonus = (level: number): number => clamp(Math.round(level), 0, 3)

export interface ProjectTick {
  /** Dividend income this week (taxed as passive income). */
  income: number
  /** Running costs this week (positive number). */
  upkeep: number
  lines: Lines
}

/** Weekly tick (called from `weeklyEconomy`): upkeep, dividend, fund growth, periodic benefits. */
export function weeklyProjectsTick(life: Life, hero: Pick<Hero, 'reputation'>, cal: Calendar): ProjectTick {
  const lines: Lines = []
  const acad = academyLevel(life)
  const stad = stadiumLevel(life)
  const w = absWeek(cal)
  const income = stakePct(life) > 0 ? stakeDividend(life) : 0
  const upkeep = projectUpkeep(life)
  if (legacyFund(life) > 0) life.flags[PROJECT_FLAGS.fund] = legacyFund(life) * (1 + FUND_GROWTH / 52)
  const fans = Object.values(life.relationships).find((r) => r.kind === 'fans')
  if (acad > 0 && w % 26 === 0) {
    life.flags[PROJECT_FLAGS.graduates] = academyGraduates(life) + acad
    if (fans) changeRelation(life, fans.id, acad)
    hero.reputation = clamp(hero.reputation + Math.ceil(acad / 2), 0, 100)
    lines.push(fill(lt('🎓 Akademinden {n} genç mezun oldu. Mahalle seninle gurur duyuyor.', '🎓 {n} young players graduated from your academy. The neighbourhood is proud.'), { n: acad }))
  }
  if (stad > 0) {
    addHappiness(life, 0.2 * stad)
    if (w % 13 === 0 && fans) changeRelation(life, fans.id, 2 * stad)
    if (w % 52 === 0) hero.reputation = clamp(hero.reputation + stad, 0, 100)
  }
  return { income, upkeep, lines }
}

/** What a controlling owner becomes once the boots are hung up: feeds the documentary, the Hall of Fame and the epilogue. */
export interface ClubOwnerInfo {
  clubId: string
  pct: number
  /** Short line for the Hall of Fame / best moments. */
  headline: LText
  /** Post-retirement epilogue paragraph. */
  epilogue: LText
}

/** The hero's club ownership at this moment (null when below {@link STAKE_CONTROL_PCT}). `clubName` is resolved by the caller. */
export function clubOwnerOf(life: Life, clubName: string): ClubOwnerInfo | null {
  if (!isClubOwner(life)) return null
  const pct = stakePct(life)
  const clubId = String(life.flags[PROJECT_FLAGS.stakeClub] ?? '')
  return {
    clubId,
    pct,
    headline: fill(lt('👔 {c} kulübünün çoğunluk sahibi (%{n})', '👔 Majority owner of {c} ({n}%)'), { c: clubName, n: pct }),
    epilogue: fill(lt(
      'Kramponları astıktan sonra {c} yönetim kurulunun başına geçti: hissenin %{n}’i onun. İlk iş olarak altyapıya yatırım yaptı, tribünde ilk maçı ayakta izledi. Bir zamanlar forma giydiği kulübü artık kendi vizyonuyla yönetiyor.',
      'After hanging up his boots he took the chair at {c}: he owns {n}% of the shares. His first move was to invest in the academy, and he watched his first match as owner standing in the stands. He now runs the club he once played for.'),
    { c: clubName, n: pct }),
  }
}
