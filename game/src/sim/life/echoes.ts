/**
 * Event echoes (owner principle: "even the smallest matter must have an
 * effect somewhere"). Thirty-two event flags used to be narrative memory only
 * (docs/SYSTEMS-MAP.md §3.3); each now has a small, real-life consequence:
 *
 *  - weekly drift and delayed outcomes ({@link weeklyEchoes}): a kept or broken
 *    promise, a secret that leaks, a habit that forms, a diet that pays off;
 *  - the manager's team sheet ({@link echoSelection}), the dressing room
 *    ({@link echoChemistry}), contract talks ({@link echoLeverage}) and the
 *    brands ({@link echoSponsor}), each with a cause line for the "why" panels;
 *  - the Hall of Fame and the documentary ({@link echoLegacy});
 *  - single actions: a family visit keeps grandma's promise
 *    ({@link activityEcho}), homework before the first business, fees asked
 *    before an investment.
 *
 * Bookkeeping lives in `life.flags` under `echo:*` (first week a flag was seen,
 * the club it belongs to). A resolved flag is overwritten with a string state
 * ('kept', 'broken', 'leaked'…) so it never fires twice. Pure and deterministic:
 * randomness only from the passed `Rng`, and only while a flag is pending.
 */
import type { Calendar, Hero, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fill, lt, meter, pushNews, type Lines } from '../career/common'
import { changeRelation } from './relationships'
import { addHappiness, addHealth, addStress } from './wellbeing'
import type { Cause } from './butterfly'

/** The 32 flags that were narrative-only before this pass (tests walk this list). */
export const ECHO_FLAGS = [
  'abroad_class', 'armband_passed', 'business_curious', 'cb_link_code', 'child_letter', 'curfew_breaker',
  'diet_plan', 'family_siblings', 'fixing_backed_out', 'fixing_buried', 'fixing_cleared', 'fixing_refused',
  'foundation_pitches', 'friend_entourage', 'grandma_promise', 'homecoming_plan', 'knew_mate_bets',
  'loan_spell', 'mental_health_voice', 'museum_lent', 'nemesis_award', 'partner_sacrificed', 'relapse',
  'renewal_push', 'secret_mascot', 'smart_saver', 'stand_in_captain', 'startup_face', 'tactics_voice',
  'ultras_friend', 'wants_home', 'wants_transfer_for_partner',
] as const
export type EchoFlag = (typeof ECHO_FLAGS)[number]

/** Flags tied to the club where they happened: they lapse when the hero moves on. */
const CLUB_BOUND: readonly string[] = ['armband_passed', 'cb_link_code', 'renewal_push', 'stand_in_captain', 'tactics_voice']
/** life.flags key: id of the hero's last club (club-change detection). */
export const ECHO_CLUB_FLAG = 'echo:club'

/** Still pending (set by the event, not yet resolved by an echo). */
export const pending = (life: Pick<Life, 'flags'>, key: string): boolean => life.flags[key] === true

/** Weeks since the flag was first seen by the weekly tick (records the week on first sight). */
function since(life: Life, key: string, week: number): number {
  const k = `echo:${key}`
  const v = life.flags[k]
  if (typeof v === 'number') return week - v
  life.flags[k] = week
  return 0
}

const opts = (week: number, why: LText) => ({ week, cause: 'event' as const, why })

export interface EchoClub {
  id: string
  countryId: string
}

// ───────────────────────── Weekly echoes ─────────────────────────

/**
 * The weekly weight of earlier choices. `club` is the hero's current club (null
 * when clubless). Every pressure logs at most one line when it starts and one
 * when it resolves, so the log tells the story without repeating itself.
 */
export function weeklyEchoes(rng: Rng, hero: Hero, life: Life, cal: Calendar, club: EchoClub | null): Lines {
  const lines: Lines = []
  const w = absWeek(cal)
  const abroad = !!club && club.countryId !== hero.nationality

  // ── Club change: promises about where to play are kept or broken ──
  const last = life.flags[ECHO_CLUB_FLAG]
  if (club && typeof last === 'string' && last !== club.id) lines.push(...onClubChange(hero, life, w, club))
  if (club) life.flags[ECHO_CLUB_FLAG] = club.id

  // ── Language classes: the dressing room's chat finally makes sense ──
  if (pending(life, 'abroad_class')) {
    if (!life.flags['echo:abroad_class:c'] && club) life.flags['echo:abroad_class:c'] = club.countryId
    const n = since(life, 'abroad_class', w)
    if (abroad && club?.countryId === life.flags['echo:abroad_class:c'] && n > 0 && n % 4 === 0 && n <= 24) {
      for (const r of Object.values(life.relationships)) if (r.kind === 'teammate' && r.value < 25) changeRelation(life, r.id, 1, opts(w, lt('Dil kursu: takımın sohbetine katılıyorsun', 'Language classes: you join the team chat')))
      addStress(life, hero, -1)
      if (n === 4) lines.push(lt('🗣️ Dil kursu işe yarıyor: soyunma odasındaki şakaları artık anlıyorsun.', '🗣️ The language classes pay off: you get the dressing-room jokes now.'))
    }
  }

  // ── Sneaking out after curfew becomes a habit ──
  if (pending(life, 'curfew_breaker')) {
    const n = since(life, 'curfew_breaker', w)
    if (n >= 1 && n <= 10) life.discipline = meter(life.discipline - 0.2)
    if (n === 1) lines.push(lt('🌙 Yakalanmadığın o gece bir alışkanlığa dönüşüyor: disiplinin yavaş yavaş gevşiyor.', '🌙 The night you got away with is becoming a habit: your discipline is slipping.'))
    if (n > 10) life.flags.curfew_breaker = 'faded'
  }

  // ── A season with a nutritionist ──
  if (pending(life, 'diet_plan')) {
    const n = since(life, 'diet_plan', w)
    if (n >= 1 && n <= 38 && life.health < 92) addHealth(life, 0.25)
    if (n >= 1 && n <= 38) hero.fatigue = Math.max(0, hero.fatigue - 0.5)
    if (n > 38) {
      life.flags.diet_plan = 'done'
      lines.push(lt('🥗 Diyetisyenle bir sezon bitti: vücudun hiç bu kadar fit olmamıştı.', '🥗 A season with the nutritionist is over: your body has never been fitter.'))
    }
  }

  // ── Siblings share the load of family worries ──
  const sib = life.flags.family_siblings
  if (typeof sib === 'number' && sib > 0 && life.stress > 55) addStress(life, hero, -0.15 * Math.min(2, sib))

  // ── Match-fixing aftermath ──
  if (pending(life, 'fixing_backed_out')) {
    const n = since(life, 'fixing_backed_out', w)
    const resolved = ['fixing_confessed', 'fixing_buried', 'fixing_cleared', 'fixing_closed', 'fixing_did'].some((k) => life.flags[k] !== undefined && life.flags[k] !== false)
    if (!resolved && n >= 1 && n <= 10) addStress(life, hero, 0.5)
    if (n === 1 && !resolved) lines.push(lt('📵 Bilinmeyen numaralar arıyor. Geri adım attığın adamlar unutmadı (stres).', '📵 Unknown numbers keep calling. The men you backed out on have not forgotten (stress).'))
    if (resolved || n > 10) life.flags.fixing_backed_out = 'over'
  }
  if (pending(life, 'fixing_buried')) {
    const n = since(life, 'fixing_buried', w)
    if (n >= 1 && n < 26) addStress(life, hero, 0.3)
    if (n >= 26) {
      if (rng.chance(0.35)) {
        life.flags.fixing_buried = 'leaked'
        hero.reputation = clamp(hero.reputation - 3, 0, 100)
        life.discipline = meter(life.discipline - 4)
        changeRelation(life, 'press', -6, opts(w, lt('Ödediğin sus payı ortaya çıktı', 'The hush money came out')))
        changeRelation(life, 'chairman', -5, opts(w, lt('Ödediğin sus payı ortaya çıktı', 'The hush money came out')))
        addStress(life, hero, 6)
        pushNews(life, rng, cal, fill(lt('{n} şike çetesine sus payı ödemiş', '{n} paid hush money to a fixing ring'), { n: hero.nickname || hero.lastName }), -1, 'Gece Bekçisi')
        lines.push(lt('📰 Gömdüğün sanılan hikâye su yüzüne çıktı: sus payı manşette. İtibar −3, disiplin −4, markalar temkinli.', '📰 The story you thought was buried surfaced: the hush money made the headlines. Reputation −3, discipline −4, the brands are wary.'))
      } else {
        life.flags.fixing_buried = 'quiet'
        addStress(life, hero, -3)
        lines.push(lt('🕊️ Aylar geçti, kimse kapını çalmadı. Omuzlarından bir yük kalktı.', '🕊️ Months went by and nobody knocked. A weight came off your shoulders.'))
      }
    }
  }
  if (pending(life, 'fixing_refused')) {
    const n = since(life, 'fixing_refused', w)
    if (n >= 1 && n <= 8) addStress(life, hero, 0.3)
    if (n > 8) {
      life.flags.fixing_refused = 'proud'
      life.discipline = meter(life.discipline + 2)
      lines.push(lt('🧭 O peçeteyi buruşturup çıktığın geceyi artık gururla hatırlıyorsun (disiplin +2).', '🧭 You now remember the night you crumpled that napkin with pride (discipline +2).'))
    }
  }
  if (pending(life, 'knew_mate_bets')) {
    const n = since(life, 'knew_mate_bets', w)
    // Knowing weighs more than not knowing.
    if (n >= 1 && n < 12) addStress(life, hero, 0.25)
    if (n >= 12) {
      if (rng.chance(0.4)) {
        life.flags.knew_mate_bets = 'exposed'
        life.discipline = meter(life.discipline - 4)
        changeRelation(life, 'chairman', -5, opts(w, lt('Takım arkadaşının bahislerini bildiğin ortaya çıktı', 'It came out that you knew about a teammate\'s bets')))
        changeRelation(life, 'press', -3, opts(w, lt('Bahis soruşturması', 'The betting inquiry')))
        addStress(life, hero, 4)
        pushNews(life, rng, cal, fill(lt('Bahis soruşturması: {n} biliyordu ama sustu', 'Betting inquiry: {n} knew and kept quiet'), { n: hero.nickname || hero.lastName }), -1)
        lines.push(lt('⚖️ Soruşturma senin de bildiğini ortaya çıkardı. Disiplin −4, başkan soğuk.', '⚖️ The inquiry found that you knew. Discipline −4, the chairman is cold.'))
      } else {
        life.flags.knew_mate_bets = 'quiet'
      }
    }
  }

  // ── The loan: playing every week keeps you sharp, the parent club notices ──
  if (pending(life, 'loan_spell')) {
    const n = since(life, 'loan_spell', w)
    if (n >= 1 && n <= 16) hero.sharpness = Math.max(hero.sharpness, 70)
    if (n > 16) {
      life.flags.loan_spell = 'back'
      hero.managerTrust = clamp(hero.managerTrust + 4, 0, 100)
      lines.push(lt('🚌 Kiralık dönemin bitti: teknik direktör "daha olgun dönmüşsün" dedi (güven +4).', '🚌 Your loan spell is over: the manager says you came back more mature (trust +4).'))
    }
  }

  // ── Causes and stands: slow drifts in how people see you ──
  driftEvery(life, 'mental_health_voice', w, 6, 52, 'press', 30, lt('Ruh sağlığı için verdiğin ses', 'Speaking up on mental health'))
  driftEvery(life, 'museum_lent', w, 6, 104, 'fans', 50, lt('Müzedeki koleksiyonun', 'Your collection at the museum'))
  driftEvery(life, 'foundation_pitches', w, 8, 104, 'fans', 40, lt('Vakfının sahaları', "Your foundation's pitches"))
  driftEvery(life, 'ultras_friend', w, 4, 52, 'fans', 50, lt('Tribünle bağın', 'Your bond with the stands'))
  driftEvery(life, 'nemesis_award', w, 5, 20, 'press', -10, lt('Göz devirme capsi', 'The eye-roll meme'))

  // ── An entourage on the payroll ──
  if (pending(life, 'friend_entourage')) {
    const n = since(life, 'friend_entourage', w)
    if (n >= 1 && n <= 52) {
      life.money -= Math.round(Math.max(150, (hero.contract?.wage ?? 400) * 0.03))
      if (n % 6 === 0) changeRelation(life, 'agent', -1, opts(w, lt('Ekibindeki arkadaşın işine karışıyor', 'Your friend on the payroll gets in the way')))
      if (n === 1) lines.push(lt('🕶️ Arkadaşın artık maaş bordronda: her hafta küçük bir masraf, menajerin de huzursuz.', '🕶️ Your friend is on the payroll now: a small cost every week, and your agent is uneasy.'))
    }
    if (n > 52) {
      life.flags.friend_entourage = 'ended'
      lines.push(lt('🕶️ Arkadaşınla bir yıllık iş birliği bitti; dostluk kaldı.', '🕶️ A year of working together is over; the friendship stays.'))
    }
  }

  // ── Promises at home ──
  if (pending(life, 'grandma_promise')) {
    const k = 'echo:grandma_promise:s'
    if (typeof life.flags[k] !== 'number') life.flags[k] = cal.season
    // Deadline: the first week of the next season, i.e. the summer has passed.
    if (cal.season > (life.flags[k] as number) && cal.week >= 1 && cal.week < 30) {
      life.flags.grandma_promise = 'broken'
      changeRelation(life, 'father', -6, opts(w, lt('Babaanneye verdiğin söz tutulmadı', 'The promise to grandma was not kept')))
      changeRelation(life, 'mother', -3, opts(w, lt('Babaanneye verdiğin söz tutulmadı', 'The promise to grandma was not kept')))
      addHappiness(life, -3)
      lines.push(lt('📓 Yaz geçti, köye gidemedin. Babaannenin defterindeki söz üzerine çizildi.', '📓 Summer went by without the village visit. The promise in grandma\'s notebook was crossed out.'))
    }
  }
  if (pending(life, 'partner_sacrificed')) {
    const n = since(life, 'partner_sacrificed', w)
    if (n >= 1 && n <= 26 && n % 4 === 0) changeRelation(life, 'partner', -1, opts(w, lt('Senin için kariyerinden vazgeçti', 'They gave up their career for you')))
    if (n === 4) lines.push(lt('🪟 Sevgilin senin için kaldı ama bazı akşamlar sessiz. Bu fedakârlık aranızda duruyor.', '🪟 Your partner stayed for you, but some evenings are quiet. The sacrifice sits between you.'))
    if (n > 26) life.flags.partner_sacrificed = 'settled'
  }
  if (pending(life, 'wants_transfer_for_partner')) {
    const n = since(life, 'wants_transfer_for_partner', w)
    if (n > 52) {
      life.flags.wants_transfer_for_partner = 'broken'
      changeRelation(life, 'partner', -6, opts(w, lt('Söz verdiğin transfer olmadı', 'The move you promised never happened')))
      lines.push(lt('💔 Bir yıl geçti, o şehre transfer olmadı. Sevgilin artık sormuyor.', '💔 A year on, the move to that city never happened. Your partner has stopped asking.'))
    }
  }
  if (pending(life, 'wants_home') && abroad && since(life, 'wants_home', w) % 4 === 0) addHappiness(life, -0.5)

  // ── A gambling relapse: the cravings come back for a while ──
  if (pending(life, 'relapse')) {
    const n = since(life, 'relapse', w)
    if (n >= 1 && n <= 8) {
      life.casino.addiction = meter(life.casino.addiction + 1.5, 0)
      addStress(life, hero, 0.3)
    }
    if (n === 1) lines.push(lt('🎰 "Bir tane" dediğin gece dürtüleri geri getirdi. Birkaç hafta zor geçecek.', '🎰 The "just one" night brought the urges back. The next few weeks will be hard.'))
    if (n > 8) life.flags.relapse = 'past'
  }

  // ── The mascot secret leaks ──
  if (pending(life, 'secret_mascot') && since(life, 'secret_mascot', w) >= 20) {
    life.flags.secret_mascot = 'revealed'
    changeRelation(life, 'fans', 4, opts(w, lt('Maskotun içinden sen çıktın', 'It was you inside the mascot')))
    changeRelation(life, 'press', 2, opts(w, lt('Maskot hikâyesi', 'The mascot story')))
    life.followers = Math.round(life.followers * 1.03)
    addHappiness(life, 2)
    pushNews(life, rng, cal, fill(lt('Sır çözüldü: maskotun içindeki {n} çıktı!', 'Mystery solved: it was {n} inside the mascot!'), { n: hero.nickname || hero.lastName }), 1)
    lines.push(lt('🦁 Maskot sırrın çözüldü: tribün sana yeni bir tezahürat besteledi (taraftar +4, takipçi +%3).', '🦁 Your mascot secret is out: the stands made up a new chant for you (fans +4, followers +3%).'))
  }

  // ── The brands' attention after a headline achievement wears off ──
  const spot = life.flags[SPOTLIGHT_FLAG]
  if (typeof spot === 'number' && spot > 0) life.flags[SPOTLIGHT_FLAG] = spot - 1

  // ── Club-bound flags: remember where they happened ──
  if (club) for (const f of CLUB_BOUND) if (pending(life, f) && !life.flags[`echo:${f}:club`]) life.flags[`echo:${f}:club`] = club.id
  return lines
}

/** Slow relation drift: +/-1 every `every` weeks toward `target`, for `weeks` weeks. */
function driftEvery(life: Life, flag: string, w: number, every: number, weeks: number, id: string, target: number, why: LText): void {
  if (!pending(life, flag)) return
  const n = since(life, flag, w)
  if (n > weeks) return
  if (n <= 0 || n % every !== 0) return
  const v = life.relationships[id]?.value
  if (v === undefined || v === target) return
  changeRelation(life, id, v < target ? 1 : -1, opts(w, why))
}

/** The hero moved clubs: promises about where to play resolve, club-bound bonds lapse. */
function onClubChange(hero: Hero, life: Life, w: number, club: EchoClub): Lines {
  const lines: Lines = []
  const home = club.countryId === hero.nationality
  if (pending(life, 'homecoming_plan')) {
    if (home) {
      life.flags.homecoming_plan = 'kept'
      changeRelation(life, 'partner', 10, opts(w, lt('Memlekete dönme sözünü tuttun', 'You kept the promise to go home')))
      addHappiness(life, 6)
      lines.push(lt('🧭 Takvimdeki tarih geldi: memlekete döndünüz. Evde huzur var.', '🧭 The date in the calendar came: you are home. There is peace in the house.'))
    } else {
      life.flags.homecoming_plan = 'broken'
      changeRelation(life, 'partner', -10, opts(w, lt('Memlekete dönme sözü bozuldu', 'The promise to go home was broken')))
      addStress(life, hero, 3)
      lines.push(lt('🧭 Memleket yerine yine başka bir şehir. Sevgilin bavulları sessizce topladı.', '🧭 Another city instead of home. Your partner packed the suitcases in silence.'))
    }
  }
  if (pending(life, 'wants_home') && home) {
    life.flags.wants_home = 'kept'
    addHappiness(life, 6)
    lines.push(lt('🏡 Sonunda memlekete yakınsın: ailenin sofrasına bir saatte varıyorsun.', '🏡 Home at last: your family\'s table is an hour away.'))
  }
  if (pending(life, 'wants_transfer_for_partner')) {
    life.flags.wants_transfer_for_partner = 'kept'
    changeRelation(life, 'partner', 8, opts(w, lt('Onun için kulüp değiştirdin', 'You changed clubs for them')))
    lines.push(lt('💞 Transfer gerçek oldu: artık aynı şehirdesiniz.', '💞 The move happened: you live in the same city now.'))
  }
  for (const f of CLUB_BOUND) if (pending(life, f)) life.flags[f] = 'past'
  return lines
}

// ───────────────────────── Selection, dressing room, talks, brands ─────────────────────────

/** True when a club-bound flag still applies at `clubId` (bound lazily to the first club it was seen at). */
function atClub(life: Pick<Life, 'flags'>, flag: string, clubId: string | undefined): boolean {
  if (!pending(life, flag) || !clubId) return false
  const bound = life.flags[`echo:${flag}:club`]
  return bound === undefined || bound === clubId
}

/** Start-chance bonus from what the manager has seen of the hero (tactical voice, stand-in captaincy). */
export function echoSelection(hero: Pick<Hero, 'contract'>, life: Pick<Life, 'flags'>): { value: number; causes: Cause[] } {
  const causes: Cause[] = []
  let value = 0
  const id = hero.contract?.clubId
  if (atClub(life, 'tactics_voice', id)) {
    value += 0.02
    causes.push({ key: 'tactics', tone: 'pos', label: lt('Teknik direktör taktik fikirlerine değer veriyor.', 'The manager values your tactical ideas.') })
  }
  if (atClub(life, 'stand_in_captain', id)) {
    value += 0.02
    causes.push({ key: 'standin', tone: 'pos', label: lt('Pazubendi taşıdığın haftaları hoca unutmadı.', 'The manager remembers the weeks you wore the armband.') })
  }
  return { value, causes }
}

/** Dressing-room bonus (team-morale multiplier points) from a mentor's handover or a shared routine. */
export function echoChemistry(hero: Pick<Hero, 'contract'>, life: Pick<Life, 'flags'>): { value: number; cause: Cause | null } {
  const id = hero.contract?.clubId
  let value = 0
  let cause: Cause | null = null
  if (atClub(life, 'armband_passed', id)) {
    value += 0.01
    cause = { key: 'mentor', tone: 'pos', label: lt('Pazubendi devrettiğin genç kaptan seni dinliyor: oda bir arada.', 'The young captain you handed the armband to listens to you: the room holds together.') }
  }
  if (atClub(life, 'cb_link_code', id)) {
    value += 0.005
    cause ??= { key: 'duo', tone: 'pos', label: lt('Savunmadaki ortak kodlarınız takıma güven veriyor.', 'Your shared codes at the back give the team confidence.') }
  }
  return { value, cause }
}

/** Contract-talk modifiers from earlier stands (renewal push, a clouded investigation). */
export function echoLeverage(life: Pick<Life, 'flags'>, sameClub: boolean, clubId?: string): { headroom: number; patience: number; causes: Cause[] } {
  let headroom = 0
  let patience = 0
  const causes: Cause[] = []
  if (sameClub && atClub(life, 'renewal_push', clubId)) {
    headroom += 0.03
    patience += 5
    causes.push({ key: 'push', tone: 'pos', label: lt('Başkan "pazarlığı öğrenmişsin" demişti: yeni sözleşme için hazırlıklı.', 'The chairman said you had learned to negotiate: he came prepared for a new deal.') })
  }
  if (life.flags.fixing_cleared === true) {
    headroom -= sameClub ? 0.03 : 0.01
    causes.push({ key: 'inquiry', tone: 'neg', label: lt('Kapanan soruşturmanın gölgesi masada.', 'The closed investigation still casts a shadow over the table.') })
  }
  return { headroom, patience, causes }
}

/** life.flags key: weeks left of the brands' attention after a headline achievement (achievementEffects). */
export const SPOTLIGHT_FLAG = 'ach:spotlight'

/** Gambling-urge resistance earned by the "In Control" achievement in this career (achievementEffects). */
export const IN_CONTROL_RESIST = 0.1
export const achievementAddictionResist = (life: Pick<Life, 'flags'>): number => (life.flags?.['ach:in_control'] !== undefined ? IN_CONTROL_RESIST : 0)

/** Sponsor offer-chance terms from the hero's public stands and scandals. */
export function echoSponsor(life: Pick<Life, 'flags'>): { value: number; causes: (Cause & { value: number })[] } {
  const f = life.flags ?? {}
  const causes: (Cause & { value: number })[] = []
  let value = 0
  const add = (v: number, key: string, label: LText): void => {
    value += v
    causes.push({ key, tone: v > 0 ? 'pos' : 'neg', label, value: v })
  }
  if (f.mental_health_voice === true) add(0.02, 'voice', lt('Ruh sağlığı için verdiğin ses markalara güven veriyor.', 'Speaking up on mental health makes brands trust you.'))
  if (f.startup_face === true) {
    if (f.startup_flop === true) add(-0.02, 'startup', lt('Reklam yüzü olduğun girişim battı.', 'The startup you fronted went bust.'))
    else add(0.02, 'startup', lt('Girişim reklamındaki rövaşatan hâlâ izleniyor.', 'Your bicycle kick in the startup ad is still being watched.'))
  }
  if (f.ultras_friend === true) add(-0.02, 'ultras', lt('Ultras grubuyla yakınlığın markaları tedirgin ediyor.', 'Your closeness to the ultras makes brands nervous.'))
  if (f.fixing_cleared === true) add(-0.02, 'inquiry', lt('Kapanan şike soruşturması hâlâ konuşuluyor.', 'The closed match-fixing inquiry is still talked about.'))
  if (f.fixing_buried === 'leaked') add(-0.04, 'hush', lt('Sus payı skandalı markaları uzak tutuyor.', 'The hush-money scandal keeps brands away.'))
  if (f.knew_mate_bets === 'exposed') add(-0.02, 'bets', lt('Bahis soruşturmasında adın geçti.', 'Your name came up in the betting inquiry.'))
  const spot = f[SPOTLIGHT_FLAG]
  if (typeof spot === 'number' && spot > 0) add(0.03, 'spotlight', lt('Son başarın markaların dikkatini çekti.', 'Your latest feat caught the brands\' eye.'))
  return { value: Math.round(value * 1000) / 1000, causes }
}

// ───────────────────────── Single actions ─────────────────────────

/** A family visit keeps grandma's promise (call after an activity is performed). */
export function activityEcho(hero: Hero, life: Life, activityId: string, cal: Calendar): Lines {
  if (activityId !== 'family_visit' || !pending(life, 'grandma_promise')) return []
  const w = absWeek(cal)
  life.flags.grandma_promise = 'kept'
  changeRelation(life, 'father', 6, { ...opts(w, lt('Babaanneye verdiğin sözü tuttun', 'You kept your promise to grandma')), hero })
  addHappiness(life, 4)
  return [lt('📓 Babaannenin defterindeki söze bir tik atıldı: sözünü tuttun. Baban gururlu.', '📓 A tick went next to the promise in grandma\'s notebook: you kept your word. Your father is proud.')]
}

/** Opening a business after doing the homework: the brand starts a little stronger (consumes the flag). */
export function businessHomework(life: Life): number {
  if (!pending(life, 'business_curious')) return 0
  life.flags.business_curious = 'used'
  return 6
}

/** Asking about fees once halves investment sale fees for good. */
export const feeWise = (life: Pick<Life, 'flags'>): number => (life.flags?.smart_saver === true ? 0.5 : 1)

// ───────────────────────── Legacy ─────────────────────────

/** Character points for the Hall of Fame and documentary lines from the life the hero led. */
export function echoLegacy(life: Pick<Life, 'flags'>): { points: number; moments: LText[] } {
  const f = life.flags
  let points = 0
  const moments: LText[] = []
  const add = (p: number, m: LText): void => {
    points += p
    moments.push(m)
  }
  if (f.museum_lent !== undefined && f.museum_lent !== false) add(15, lt('🏛️ Kupaları şehir müzesinde sergilendi', 'Their trophies were exhibited at the city museum'))
  if (f.foundation_pitches !== undefined && f.foundation_pitches !== false) add(15, lt('🏟️ Vakfı mahallelere futbol sahaları kazandırdı', 'Their foundation built pitches for the neighbourhoods'))
  if (f.armband_passed !== undefined && f.armband_passed !== false) add(10, lt('🎗️ Pazubendi kendi eliyle yeni nesle devretti', 'Handed the armband to the next generation themself'))
  if (f.mental_health_voice !== undefined && f.mental_health_voice !== false) add(10, lt('🌱 Ruh sağlığı hakkında konuşan ilk futbolculardan', 'One of the first footballers to speak about mental health'))
  if (f.child_letter !== undefined && f.child_letter !== false) add(5, lt('📔 Gelecekteki çocuğuna bir mektup bıraktı', 'Left a letter for a future child'))
  if (f.fixing_refused === 'proud' || f.fixing_reported === true) add(10, lt('🧭 Şike teklifine "hayır" dedi', 'Said no to match-fixing'))
  if (f.fixing_buried === 'leaked') add(-20, lt('📰 Sus payı skandalı kariyerine gölge düşürdü', 'A hush-money scandal clouded the career'))
  return { points, moments }
}
