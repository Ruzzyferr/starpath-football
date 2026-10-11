/**
 * Daily agenda (owner: "a footballer's every moment is planned").
 *
 * Every day has a program:
 *  - MANDATORY tasks (0–2 a day, ~4–6 a week in season — most days one, some
 *    days two, matchday and the day off none): team training before a match,
 *    the disciplinary hearing after a ban, a press conference around a big
 *    game, a doping test, the physio when injured or worn out, a sponsor
 *    shoot, an autograph session, the chairman's meeting in a contract year,
 *    national-team check-in, a date with the partner, the mother's birthday,
 *    captain's mentoring, a charity evening, the weekly team meeting, a
 *    fitness test, a compulsory gym block, club TV and community visits. The day cannot be advanced (UI)
 *    until they are done. Each resolves QUICKLY (one tap, average outcome) or
 *    PLAYED/decided for a better outcome (a drill or a choice); some can be
 *    SKIPPED as an explicit decision with real consequences.
 *  - OPTIONAL preparation goals (1–3 a day) read from the next opponent's real
 *    squad (their weak/strong lines) and the hero's own state; completing one
 *    (the matching training, rest, video) gives a shown benefit: a start-chance
 *    term and a +2 matchup buff on that attribute for the next club match.
 *
 * Generation is deterministic (career seed + absolute day, its own RNG fork —
 * the career stream is untouched) and stored in life.flags for the day. The
 * autopilot (advanceDay) quick-resolves whatever is left, so the sim never
 * stalls and the balance harness sees average outcomes.
 */
import type { AttributeKey, Club, GameState, LText, NpcPlayer, Position } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { DAYS_PER_WEEK } from '../../core/config'
import { absWeek, clamp, fill, lt, meter } from '../career/common'
import { MANAGER_REL, changeTrust, trainingTrustRaw } from '../career/squadRole'
import { applyXpBundle } from '../career/progression'
import { changeRelation } from '../life/relationships'
import { deriveAttributes, positionGroup } from '../world/attributes'
import { selectLineupFromPlayers } from '../world/formations'
import { squadPlayers } from '../world/queries'
import { absDayOf, heroClub, isInSeason, readJson, writeJson } from './internal'
import { daysUntil, nextClubFixture } from './selection'
import { applyNationalCamp, stat01, type SceneId, type SceneOutcome } from './scenes'

export const AGENDA_FLAG = 'c:agenda'
/** JSON Record<kind, absDay>: last day each mandatory kind was set (cooldowns). */
export const AGENDA_LAST_FLAG = 'c:agendaLast'
/** JSON {fixtureId, attrs: AttributeKey[], n}: preparation done for the next club match. */
export const PREP_FLAG = 'c:prep'
/** JSON {fixtureId}: compulsory training skipped before this match (selection term). */
export const SKIPPED_TRAINING_FLAG = 'c:skippedTraining'
/** JSON number[]: the absolute day of every mandatory task set in the last week (weekly budget). */
export const AGENDA_HIST_FLAG = 'c:agendaHist'
/** Max mandatory tasks a day; the weekly budget the generator aims at (owner: ~4–6 a week in season). */
export const MAX_MANDATORY_PER_DAY = 2
export const WEEKLY_MANDATORY_CAP = 6
/** Start-chance term per completed preparation goal (max 2 count) and for skipped compulsory training. */
export const PREP_SELECTION = 0.03
export const SKIPPED_TRAINING_SELECTION = -0.08
/** Matchup buff (attribute points) a completed preparation gives for the next club match. */
export const PREP_BUFF = 2

export type MandatoryKind =
  | 'teamTraining' | 'disciplinary' | 'pressConference' | 'dopingTest' | 'physio' | 'sponsorShoot' | 'autographs'
  | 'boardMeeting' | 'nationalCamp' | 'dateNight' | 'familyBirthday' | 'captainMentoring' | 'charity' | 'recoverySession' | 'devMeeting'
  | 'teamMeeting' | 'fitnessTest' | 'clubMedia' | 'gymBlock' | 'communityVisit'
export const MANDATORY_KINDS: readonly MandatoryKind[] = [
  'teamTraining', 'disciplinary', 'pressConference', 'dopingTest', 'physio', 'sponsorShoot', 'autographs', 'boardMeeting', 'nationalCamp', 'dateNight',
  'familyBirthday', 'captainMentoring', 'charity', 'recoverySession', 'devMeeting', 'teamMeeting', 'fitnessTest', 'clubMedia', 'gymBlock', 'communityVisit',
]
export type PrepKind = 'train' | 'rest' | 'video'

export interface TaskChoice {
  id: string
  label: LText
  /** One-line outcome hint shown under the choice. */
  hint: LText
}

export interface AgendaTask {
  id: string
  mandatory: boolean
  kind: MandatoryKind | PrepKind
  title: LText
  why: LText
  /** What the quick resolve does (mandatory) / what completing it gives (prep). */
  reward: LText
  /**
   * How the task is played for a better outcome: a drill (training type), a
   * choice, a dialogue scene (sim/game/scenes) or a small DOM mini-game.
   */
  play?: { drill?: string; choices?: TaskChoice[]; scene?: SceneId; game?: 'doping' }
  /** Skip consequence (only when skipping is allowed). */
  skip?: LText
  /** Prep: the training type / activity that completes it, and the attribute it buffs. */
  activity?: string
  attr?: AttributeKey
  done?: 'quick' | 'played' | 'skipped'
  /** Result line after it was resolved. */
  result?: LText
}

export interface Agenda {
  day: number
  tasks: AgendaTask[]
}

// ───────────────────────── Helpers ─────────────────────────

const today = (s: GameState): number => absDayOf(s)
const heroAgeNow = (s: GameState): number => s.calendar.season - s.hero.birthYear
const lastDays = (s: GameState): Partial<Record<MandatoryKind, number>> => readJson(s.life, AGENDA_LAST_FLAG, {})
const cooled = (s: GameState, k: MandatoryKind, days: number): boolean => {
  const l = lastDays(s)[k]
  return l === undefined || today(s) - l >= days
}

/** Mandatory tasks set in the last 6 days (weekly budget; every task counts, not just the last of each kind). */
function recentMandatory(s: GameState): number {
  const d = today(s)
  return readJson<number[]>(s.life, AGENDA_HIST_FLAG, []).filter((x) => typeof x === 'number' && d - x < DAYS_PER_WEEK && d - x > 0).length
}

/** Deterministic day of the year for a family birthday (week, day). */
function birthday(seed: number, who: string): { week: number; day: number } {
  const h = hashString(`${seed}:bday:${who}`)
  return { week: 2 + (h % 38), day: (h >>> 8) % DAYS_PER_WEEK }
}

const ATTR_TRAINING: Partial<Record<AttributeKey, string>> = {
  pace: 'sprint', acceleration: 'sprint', strength: 'core', balance: 'core', heading: 'heading', jumping: 'heading', crossing: 'crossing',
  dribbling: 'dribbling', shooting: 'shooting', passing: 'passing', longPassing: 'longPass', tackling: 'tackling', positioning: 'reading',
  anticipation: 'reading', reflexes: 'keeperDiving', diving: 'keeperDiving', handling: 'goalkeeping', stamina: 'physical',
} as Partial<Record<AttributeKey, string>>

const ATTR_NAME: Partial<Record<AttributeKey, LText>> = {
  pace: lt('Hız', 'Pace'), acceleration: lt('Hızlanma', 'Acceleration'), strength: lt('Güç', 'Strength'), heading: lt('Kafa vuruşu', 'Heading'),
  crossing: lt('Orta', 'Crossing'), dribbling: lt('Top sürme', 'Dribbling'), shooting: lt('Şut', 'Shooting'), passing: lt('Pas', 'Passing'),
  tackling: lt('Top kapma', 'Tackling'), positioning: lt('Pozisyon alma', 'Positioning'), reflexes: lt('Refleks', 'Reflexes'), stamina: lt('Dayanıklılık', 'Stamina'),
}
const nameOf = (k: AttributeKey): LText => ATTR_NAME[k] ?? { tr: k, en: k }

/** Appeal against a ban: Composure in front of the committee and the club's view of your conduct. */
export const appealChance = (s: GameState): number => Math.round(clamp(0.15 + 0.4 * stat01(s.hero.attrs.composure) + 0.15 * (s.life.discipline - 50) / 50, 0.1, 0.65) * 100) / 100
/** How strongly the press-conference answers land: 0.7 at Composure 40 .. 1.4 at 90. */
export const pressFactor = (s: GameState): number => Math.round((0.6 + 0.8 * stat01(s.hero.attrs.composure)) * 100) / 100
const pressN = (s: GameState, base: number): number => Math.max(1, Math.round(base * pressFactor(s)))

const avg = (ps: NpcPlayer[], k: AttributeKey): number => (ps.length ? ps.reduce((a, p) => a + (deriveAttributes(p)[k] ?? 50), 0) / ps.length : 50)
const isPos = (set: readonly Position[]) => (p: NpcPlayer): boolean => set.includes(p.position)
const FWD: readonly Position[] = ['ST', 'LW', 'RW', 'AM']
const CB: readonly Position[] = ['CB']
const FB: readonly Position[] = ['LB', 'RB', 'LWB', 'RWB'] as unknown as Position[]
const MID: readonly Position[] = ['CM', 'DM', 'AM', 'LM', 'RM'] as unknown as Position[]

// ───────────────────────── Generation ─────────────────────────

interface Cand { kind: MandatoryKind; forced?: boolean; weight: number }

function mandatoryCandidates(s: GameState): Cand[] {
  const h = s.hero
  const club = heroClub(s)
  const cal = s.calendar
  const inSeason = isInSeason(cal.week)
  const next = nextClubFixture(s)
  const until = next ? daysUntil(s, next.fixture) : 99
  const out: Cand[] = []
  if (!club || !h.contract || h.retired) return out
  // Team training the day before a match (tactical session) — most weeks.
  if (inSeason && until === 1 && !h.injury && cooled(s, 'teamTraining', 3)) out.push({ kind: 'teamTraining', weight: 3 })
  // Disciplinary hearing right after a ban.
  if (h.suspendedMatches > 0 && cooled(s, 'disciplinary', 21)) out.push({ kind: 'disciplinary', forced: true, weight: 9 })
  // Press conference before a big match (cup late rounds, derbies) or a hero who is in the news.
  if (inSeason && until === 1 && next && !h.injury && (next.competition.type !== 'league' || h.reputation >= 45) && cooled(s, 'pressConference', 6)) out.push({ kind: 'pressConference', weight: 2 })
  // Physio when injured or exhausted.
  if ((h.injury || h.fatigue > 78) && cooled(s, 'physio', 4)) out.push({ kind: 'physio', forced: !!h.injury, weight: 4 })
  // Doping test: random, rare.
  if (inSeason && cooled(s, 'dopingTest', 60)) out.push({ kind: 'dopingTest', weight: 0.15 })
  // Recovery session the morning after a match the hero played in.
  const last = readJson<{ day: number; minutes: number } | null>(s.life, LAST_CLUB_MATCH_FLAG, null)
  if (last && last.minutes > 0 && today(s) - last.day === 1 && cooled(s, 'recoverySession', 3)) out.push({ kind: 'recoverySession', weight: 2.5 })
  // Development talk with the academy coordinator for young players.
  if (heroAgeNow(s) <= 21 && inSeason && until >= 2 && cooled(s, 'devMeeting', 14)) out.push({ kind: 'devMeeting', weight: 1.6 })
  if (s.life.sponsors.length > 0 && until >= 2 && cooled(s, 'sponsorShoot', 14)) out.push({ kind: 'sponsorShoot', weight: 1.2 })
  if (h.reputation >= 20 && until >= 2 && cooled(s, 'autographs', 18)) out.push({ kind: 'autographs', weight: 0.9 })
  if (h.contract.untilSeason <= cal.season && cooled(s, 'boardMeeting', 35)) out.push({ kind: 'boardMeeting', weight: 1.5 })
  if (s.world.national?.hero.teamId && cal.day === 0 && until >= 2 && cooled(s, 'nationalCamp', 30)) out.push({ kind: 'nationalCamp', weight: 0.8 })
  if (s.life.relationships.partner && until >= 2 && cooled(s, 'dateNight', 9)) out.push({ kind: 'dateNight', weight: 1 })
  const b = birthday(s.meta.seed, 'mother')
  if (s.life.relationships.mother && cal.week === b.week && cal.day === b.day) out.push({ kind: 'familyBirthday', forced: true, weight: 9 })
  if (h.contract.role === 'captain' && until >= 2 && cooled(s, 'captainMentoring', 7)) out.push({ kind: 'captainMentoring', weight: 1.4 })
  if (h.reputation >= 55 && until >= 2 && cooled(s, 'charity', 28)) out.push({ kind: 'charity', weight: 0.7 })
  // The ordinary club week (TestFlight build 4: "more mandatory tasks, most days one").
  if (inSeason && until >= 2 && until <= 5 && cooled(s, 'teamMeeting', 5)) out.push({ kind: 'teamMeeting', weight: 2.2 })
  if (inSeason && until >= 2 && !h.injury && cooled(s, 'gymBlock', 4)) out.push({ kind: 'gymBlock', weight: 1.8 })
  if (until >= 2 && !h.injury && cooled(s, 'fitnessTest', 12)) out.push({ kind: 'fitnessTest', weight: 1.3 })
  if (until >= 2 && cooled(s, 'clubMedia', 7)) out.push({ kind: 'clubMedia', weight: 1.2 })
  if (until >= 2 && cooled(s, 'communityVisit', 14)) out.push({ kind: 'communityVisit', weight: 0.8 })
  return out
}

/**
 * Today's mandatory kinds: forced ones first, then the club week kept inside
 * the weekly budget — team training the day before a match, recovery the
 * morning after, one ordinary duty on most other days and now and then a
 * second. Matchday and the day off (two days after a match) stay free.
 */
function pickMandatory(s: GameState, rng: Rng): MandatoryKind[] {
  const c = mandatoryCandidates(s)
  const out: MandatoryKind[] = c.filter((x) => x.forced).map((x) => x.kind).slice(0, MAX_MANDATORY_PER_DAY)
  const next = nextClubFixture(s)
  const until = next ? daysUntil(s, next.fixture) : 99
  if (until === 0) return out // matchday: the match is the programme
  const last = readJson<{ day: number } | null>(s.life, LAST_CLUB_MATCH_FLAG, null)
  if (last && today(s) - last.day === 2 && until >= 2 && rng.chance(0.75)) return out // the day off
  const budget = WEEKLY_MANDATORY_CAP - recentMandatory(s)
  const room = (): boolean => out.length < MAX_MANDATORY_PER_DAY && budget - out.length > 0
  const pool = c.filter((x) => !x.forced && !out.includes(x.kind))
  // Team training before a match is the backbone of the week: in whenever the budget allows.
  if (pool.some((x) => x.kind === 'teamTraining') && room() && rng.chance(0.9)) out.push('teamTraining')
  if (pool.some((x) => x.kind === 'recoverySession') && room() && rng.chance(0.85)) out.push('recoverySession')
  const rest = (): Cand[] => pool.filter((x) => x.kind !== 'teamTraining' && x.kind !== 'recoverySession' && !out.includes(x.kind))
  // Most days carry one duty; some days a second one.
  if (!out.length && rest().length && room() && rng.chance(0.9)) out.push(rng.weighted(rest(), (x) => x.weight).kind)
  if (out.length === 1 && rest().length && room() && rng.chance(0.2)) out.push(rng.weighted(rest(), (x) => x.weight).kind)
  return out.slice(0, MAX_MANDATORY_PER_DAY)
}

/** A mandatory task of a kind for a day (exported for the no-op audit test). */
export function mandatoryTask(s: GameState, kind: MandatoryKind, day: number): AgendaTask {
  const id = `m:${kind}:${day}`
  const T = (title: LText, why: LText, reward: LText, extra: Partial<AgendaTask> = {}): AgendaTask => ({ id, mandatory: true, kind, title, why, reward, ...extra })
  const next = nextClubFixture(s)
  const opp = next ? s.world.clubs[next.fixture.homeId === s.hero.contract?.clubId ? next.fixture.awayId : next.fixture.homeId]?.shortName ?? '' : ''
  const ch = (id2: string, l: LText, h: LText): TaskChoice => ({ id: id2, label: l, hint: h })
  switch (kind) {
    case 'teamTraining':
      return T(lt('Zorunlu takım antrenmanı', 'Compulsory team training'), fill(lt('{o} maçı öncesi taktik çalışma. Hoca herkesi izliyor.', 'Tactical session before {o}. The manager is watching everyone.'), { o: opp }),
        lt('Hızlı: ortalama antrenman', 'Quick: an average session'),
        { play: { drill: 'tactical' }, skip: lt('Disiplin −6, güven −3, ilk 11 şansı −%8', 'Discipline −6, trust −3, start chance −8%') })
    case 'disciplinary':
      return T(lt('Disiplin kurulu', 'Disciplinary hearing'), lt('Cezan için kurulun önüne çıkıyorsun.', 'You face the committee over your ban.'), lt('Hızlı: özür dile, disiplin +3', 'Quick: apologise, discipline +3'),
        { play: { choices: [ch('apologise', lt('Özür dile', 'Apologise'), lt('Disiplin +5, hoca +2', 'Discipline +5, manager +2')), ch('contest', lt('İtiraz et', 'Contest it'), fill(lt('%{p} ceza 1 maç azalır (Soğukkanlılık, disiplin); yoksa disiplin −4', '{p}%: ban cut by a match (Composure, discipline); else discipline −4'), { p: Math.round(appealChance(s) * 100) }))] } })
    case 'pressConference':
      return T(lt('Basın toplantısı', 'Press conference'), fill(lt('{o} maçı öncesi mikrofonlar senin için.', 'The microphones are yours before {o}.'), { o: opp }), lt('Hızlı: kalıp cevaplar, basın +1', 'Quick: stock answers, press +1'),
        { play: { choices: [
          ch('humble', lt('Alçakgönüllü', 'Humble'), fill(lt('Basın +{a}, hoca +{b} (Soğukkanlılık)', 'Press +{a}, manager +{b} (Composure)'), { a: pressN(s, 3), b: pressN(s, 2) })),
          ch('confident', lt('Kendinden emin', 'Confident'), fill(lt('Taraftar +{a}, moral +{b} (Soğukkanlılık)', 'Fans +{a}, morale +{b} (Composure)'), { a: pressN(s, 4), b: pressN(s, 3) })),
          ch('bold', lt('İddialı manşet', 'Bold headline'), fill(lt('Taraftar +{a}, basın −2, hoca −2 (Soğukkanlılık)', 'Fans +{a}, press −2, manager −2 (Composure)'), { a: pressN(s, 6) })),
        ] },
          skip: lt('Basın −5, kulüp sözcüsü kızar (disiplin −3)', 'Press −5, the club’s press officer is furious (discipline −3)') })
    case 'dopingTest':
      return T(lt('Doping testi', 'Doping test'), lt('Sürpriz kontrol: numune vermen gerekiyor.', 'A surprise control: you must give a sample.'), lt('Hızlı: test temiz, disiplin +1', 'Quick: clean test, discipline +1'),
        { play: { game: 'doping' }, skip: lt('Testi reddetmek: disiplin −15, itibar −2, hoca −6', 'Refusing the test: discipline −15, reputation −2, manager −6') })
    case 'physio':
      return T(lt('Fizyoterapi seansı', 'Physio session'), s.hero.injury ? lt('Sağlık ekibi tedavini takip ediyor.', 'The medical staff follow your treatment.') : lt('Yorgunluğun çok yüksek; sağlık ekibi seni çağırdı.', 'You are worn out; the medical staff called you in.'),
        lt('Hızlı: yorgunluk −10', 'Quick: fatigue −10'), { play: { choices: [ch('full', lt('Tam program (buz + masaj)', 'Full programme (ice + massage)'), lt('Yorgunluk −16, enerji −8', 'Fatigue −16, energy −8'))] }, skip: lt('Sağlık ekibi kızar: yorgunluk kalır, disiplin −3', 'The staff are annoyed: fatigue stays, discipline −3') })
    case 'sponsorShoot':
      return T(lt('Sponsor çekimi', 'Sponsor shoot'), lt('Sözleşmendeki çekim günü.', 'The shoot day in your sponsor contract.'), lt('Hızlı: çekim tamam, takipçi +', 'Quick: shoot done, followers +'),
        { play: { choices: [ch('extra', lt('Fazladan içerik çek', 'Shoot extra content'), lt('Takipçi ++, enerji −10', 'Followers ++, energy −10'))] }, skip: lt('Sponsor memnun değil: itibar −1, mutluluk −2', 'The sponsor is unhappy: reputation −1, happiness −2') })
    case 'autographs':
      return T(lt('İmza günü', 'Autograph session'), lt('Kulüp mağazasında taraftarlarla buluşma.', 'Meet the fans at the club shop.'), lt('Hızlı: taraftar +2', 'Quick: fans +2'),
        { play: { choices: [ch('stay', lt('Son taraftara kadar kal', 'Stay until the last fan'), lt('Taraftar +5, enerji −10', 'Fans +5, energy −10'))] }, skip: lt('Taraftar −3', 'Fans −3') })
    case 'boardMeeting':
      return T(lt('Başkanla görüşme', 'Meeting with the chairman'), lt('Sözleşmenin son yılı: başkan geleceğini konuşmak istiyor.', 'Final contract year: the chairman wants to talk about your future.'), lt('Hızlı: nazik görüşme, hoca +1', 'Quick: a polite chat, manager +1'),
        { play: { choices: [ch('loyal', lt('Kulübe bağlılığını göster', 'Show your loyalty'), lt('Hoca +3, taraftar +2', 'Manager +3, fans +2')), ch('ambitious', lt('Hedeflerini açıkça söyle', 'Speak your ambition'), lt('Moral +4, hoca −1', 'Morale +4, manager −1'))] } })
    case 'nationalCamp':
      return T(lt('Milli takım kampı', 'National team camp'), lt('Kampa katılım bildirimi ve sağlık kontrolü.', 'Camp check-in and medical.'), lt('Hızlı: kayıt tamam, moral +2', 'Quick: checked in, morale +2'),
        { play: { scene: 'nationalCamp' } })
    case 'dateNight':
      return T(lt('Sevgilinle akşam yemeği', 'Dinner date'), lt('Uzun zamandır söz verdiğin akşam.', 'The evening you promised long ago.'), lt('Hızlı: güzel bir akşam, sevgili +4', 'Quick: a nice evening, partner +4'),
        { play: { choices: [ch('special', lt('Sürpriz hazırla', 'Plan a surprise'), lt('Sevgili +8, mutluluk +4, para −', 'Partner +8, happiness +4, money −'))] }, skip: lt('İptal: sevgili −6, mutluluk −3', 'Cancel: partner −6, happiness −3') })
    case 'familyBirthday':
      return T(lt('Annenin doğum günü', 'Your mother’s birthday'), lt('Bugün annenin doğum günü; ailen seni bekliyor.', 'It is your mother’s birthday; the family expect you.'), lt('Hızlı: ara ve kutla, aile +3', 'Quick: call and celebrate, family +3'),
        { play: { choices: [ch('visit', lt('Hediyeyle git', 'Visit with a gift'), lt('Aile +8, mutluluk +4, enerji −8', 'Family +8, happiness +4, energy −8'))] }, skip: lt('Unuttun: anne −8, mutluluk −3', 'Forgot it: mother −8, happiness −3') })
    case 'captainMentoring':
      return T(lt('Kaptan görüşmesi', 'Captain’s one-to-ones'), lt('Kaptan olarak gençlerle konuşman bekleniyor.', 'As captain you are expected to talk to the youngsters.'), lt('Hızlı: kısa konuşma, takım +2', 'Quick: a short talk, teammates +2'),
        { play: { choices: [ch('deep', lt('Herkesle tek tek konuş', 'Talk to each of them'), lt('Takım +5, liderlik XP, enerji −8', 'Teammates +5, leadership XP, energy −8'))] }, skip: lt('Takım −2, hoca −2', 'Teammates −2, manager −2') })
    case 'recoverySession':
      return T(lt('Toparlanma antrenmanı', 'Recovery session'), lt('Maçın ertesi sabahı: hafif koşu, esneme, buz.', 'The morning after the match: a light jog, stretching, ice.'), lt('Hızlı: yorgunluk −6', 'Quick: fatigue −6'),
        { play: { choices: [ch('ice', lt('Buz banyosu da yap', 'Add an ice bath'), lt('Yorgunluk −12, enerji −5', 'Fatigue −12, energy −5'))] }, skip: lt('Yorgunluk kalır, disiplin −2', 'Fatigue stays, discipline −2') })
    case 'devMeeting':
      return T(lt('Gelişim görüşmesi', 'Development talk'), lt('Altyapı koordinatörü gelişimini konuşmak istiyor.', 'The academy coordinator wants to discuss your progress.'), lt('Hızlı: kısa görüşme, hoca +1', 'Quick: a short talk, manager +1'),
        { play: { choices: [ch('goals', lt('Hedeflerini birlikte koyun', 'Set goals together'), lt('Moral +3, hoca +2', 'Morale +3, manager +2')), ch('feedback', lt('Açık eleştiri iste', 'Ask for honest criticism'), lt('Güven +1.5', 'Trust +1.5'))] }, skip: lt('Hoca −2', 'Manager −2') })
    case 'teamMeeting':
      return T(lt('Takım toplantısı', 'Team meeting'), fill(lt('Hoca {o} maçı için planı anlatıyor.', 'The manager walks the squad through the plan for {o}.'), { o: opp }), lt('Hızlı: dinle, not al (pozisyon XP)', 'Quick: listen, take notes (positioning XP)'),
        { play: { choices: [ch('ask', lt('Soru sor', 'Ask a question'), lt('Hoca +2', 'Manager +2')), ch('team', lt('Takıma söz al', 'Speak to the group'), lt('Takım +3, moral +2', 'Teammates +3, morale +2'))] }, skip: lt('Hoca −3, disiplin −3', 'Manager −3, discipline −3') })
    case 'gymBlock':
      return T(lt('Zorunlu kuvvet çalışması', 'Compulsory gym block'), lt('Kondisyoner bu hafta herkesi salona çağırdı.', 'The fitness coach has called everyone into the gym this week.'), lt('Hızlı: programı bitir, enerji −6', 'Quick: finish the programme, energy −6'),
        { play: { drill: 'core' }, skip: lt('Kondisyoner kızar: disiplin −3', 'The fitness coach is annoyed: discipline −3') })
    case 'fitnessTest':
      return T(lt('Kondisyon testi', 'Fitness test'), lt('Sağlık ekibi koşu ve sıçrama testlerini yapıyor.', 'The medical staff run the sprint and jump tests.'), lt('Hızlı: testi geç, enerji −5', 'Quick: pass the test, energy −5'),
        { play: { drill: 'physical' } })
    case 'clubMedia':
      return T(lt('Kulüp TV röportajı', 'Club TV interview'), lt('Kulübün kanalı seninle kısa bir röportaj istiyor.', 'The club channel wants a short interview with you.'), lt('Hızlı: kısa röportaj, taraftar +1', 'Quick: a short interview, fans +1'),
        { play: { choices: [ch('fun', lt('Eğlenceli ol', 'Have some fun'), lt('Taraftar +3, takipçi +', 'Fans +3, followers +')), ch('serious', lt('Ciddi ve odaklı', 'Serious and focused'), lt('Basın +2, hoca +1', 'Press +2, manager +1'))] }, skip: lt('Basın −2', 'Press −2') })
    case 'communityVisit':
      return T(lt('Kulübün okul ziyareti', 'Club school visit'), lt('Kulüp oyuncularla bir okulu ziyaret ediyor.', 'The club is taking players to visit a school.'), lt('Hızlı: katıl, taraftar +1', 'Quick: attend, fans +1'),
        { play: { choices: [ch('play', lt('Çocuklarla top oyna', 'Play football with the kids'), lt('Taraftar +3, mutluluk +3, enerji −6', 'Fans +3, happiness +3, energy −6'))] }, skip: lt('Taraftar −2', 'Fans −2') })
    case 'charity':
      return T(lt('Hayır gecesi', 'Charity evening'), lt('Vakfın için düzenlenen gece.', 'An evening organised for your foundation.'), lt('Hızlı: katıl, taraftar +2', 'Quick: attend, fans +2'),
        { play: { choices: [ch('speech', lt('Konuşma yap', 'Give a speech'), lt('Taraftar +4, basın +3', 'Fans +4, press +3'))] }, skip: lt('Basın −3, taraftar −2', 'Press −3, fans −2') })
  }
}

/** Preparation goals: the next opponent's real squad vs the hero's line, plus the body. */
function prepTasks(s: GameState, day: number, rng: Rng): AgendaTask[] {
  const h = s.hero
  const club = heroClub(s)
  const next = nextClubFixture(s)
  const out: AgendaTask[] = []
  if (!club || !h.contract || h.retired) return out
  const until = next ? daysUntil(s, next.fixture) : 99
  if (next && until >= 1 && until <= 5 && !h.injury) {
    const oppClub: Club | undefined = s.world.clubs[next.fixture.homeId === club.id ? next.fixture.awayId : next.fixture.homeId]
    if (oppClub) {
      const squad = squadPlayers(s.world, oppClub.id)
      const xi = new Set(selectLineupFromPlayers(squad, oppClub.formation).playerIds)
      const opp = squad.filter((p) => xi.has(p.id))
      const grp = positionGroup(h.position)
      type Read = { attr: AttributeKey; text: LText; target: number }
      const reads: Read[] = []
      const name = oppClub.shortName
      if (grp === 'FWD' || h.position === 'AM') {
        const cbs = opp.filter(isPos(CB))
        const fbs = opp.filter(isPos(FB))
        const pace = avg(cbs, 'pace')
        const air = avg(cbs, 'heading')
        const fbPace = avg(fbs, 'pace')
        if (pace <= air) reads.push({ attr: 'acceleration', target: Math.round(pace + 12), text: fill(lt('{c} stoperleri yavaş (Hız {v}): arkaya koşularla yıkarsın.', '{c}’s centre-backs are slow (Pace {v}): runs in behind will hurt them.'), { c: name, v: Math.round(pace) }) })
        else reads.push({ attr: 'dribbling', target: Math.round(air + 8), text: fill(lt('{c} stoperleri havada güçlü (Kafa {v}): topu yerde tut, çalımla geç.', '{c}’s centre-backs win in the air (Heading {v}): keep it on the floor and dribble.'), { c: name, v: Math.round(air) }) })
        if ((h.position === 'LW' || h.position === 'RW') && fbs.length) reads.push({ attr: 'crossing', target: Math.round(fbPace + 14), text: fill(lt('{c} kanat bekleri yavaş (Hız {v}): onları geçip orta açacaksın.', '{c}’s full-backs are slow (Pace {v}): beat them and cross.'), { c: name, v: Math.round(fbPace) }) })
        else reads.push({ attr: 'shooting', target: Math.round(avg(opp.filter((p) => p.position === 'GK'), 'reflexes') + 8), text: fill(lt('{c} kalecisinin refleksleri {v}: şut kalitesi fark yaratır.', '{c}’s keeper has {v} reflexes: shot quality makes the difference.'), { c: name, v: Math.round(avg(opp.filter((p) => p.position === 'GK'), 'reflexes')) }) })
      } else if (grp === 'DEF') {
        const fw = opp.filter(isPos(FWD))
        const pace = avg(fw, 'pace')
        const air = avg(fw, 'heading')
        if (pace >= air) reads.push({ attr: 'pace', target: Math.round(pace), text: fill(lt('{c} forvetleri hızlı (Hız {v}): geride kalmamak için çabukluk çalış.', '{c}’s forwards are quick (Pace {v}): work on your speed so they don’t run off you.'), { c: name, v: Math.round(pace) }) })
        else reads.push({ attr: 'heading', target: Math.round(air), text: fill(lt('{c} forvetleri hava toplarında güçlü (Kafa {v}): kafa vuruşu çalış.', '{c}’s forwards are strong in the air (Heading {v}): work on your heading.'), { c: name, v: Math.round(air) }) })
        reads.push({ attr: 'tackling', target: Math.round(avg(fw, 'dribbling') + 4), text: fill(lt('{c} hücumcuları çalım seviyor (Top sürme {v}): top kapma zamanlamanı çalış.', '{c}’s attackers love to dribble (Dribbling {v}): sharpen your tackle timing.'), { c: name, v: Math.round(avg(fw, 'dribbling')) }) })
      } else if (grp === 'GK') {
        const fw = opp.filter(isPos(FWD))
        reads.push({ attr: 'reflexes', target: Math.round(avg(fw, 'shooting') + 4), text: fill(lt('{c} forvetleri sert vuruyor (Şut {v}): refleks istasyonu.', '{c}’s forwards strike it hard (Shooting {v}): reflex station.'), { c: name, v: Math.round(avg(fw, 'shooting')) }) })
      } else {
        const mids = opp.filter(isPos(MID))
        const pass = avg(mids, 'passing')
        reads.push(pass >= 62
          ? { attr: 'tackling', target: Math.round(pass), text: fill(lt('{c} orta sahası pası iyi yapıyor (Pas {v}): pres ve top kapma çalış.', '{c}’s midfield pass it well (Passing {v}): work on pressing and tackling.'), { c: name, v: Math.round(pass) }) }
          : { attr: 'passing', target: Math.round(pass + 12), text: fill(lt('{c} orta sahası top kaybediyor (Pas {v}): hızlı pasla cezalandır.', '{c}’s midfield gives the ball away (Passing {v}): punish them with quick passing.'), { c: name, v: Math.round(pass) }) })
      }
      for (const r of reads.slice(0, 2)) {
        const act = ATTR_TRAINING[r.attr]
        if (!act) continue
        const cur = h.attrs[r.attr] ?? 50
        const target = clamp(r.target, 40, 95)
        out.push({
          id: `p:${r.attr}:${day}`, mandatory: false, kind: 'train', attr: r.attr, activity: `train_${act}`,
          title: fill(lt('{a} antrenmanı yap', 'Do a {a} session'), { a: nameOf(r.attr) }),
          why: { tr: `${r.text.tr} ${nameOf(r.attr).tr} puanının ${target} olması önerilir (şu an ${cur}).`, en: `${r.text.en} A ${nameOf(r.attr).en} of ${target} is recommended (now ${cur}).` },
          reward: fill(lt('Maçta {a} +{b} · ilk 11 şansı +%{p}', 'Match {a} +{b} · start chance +{p}%'), { a: nameOf(r.attr), b: PREP_BUFF, p: Math.round(PREP_SELECTION * 100) }),
        })
      }
    }
  }
  if (h.fatigue > 55 && until >= 1) {
    out.push({
      id: `p:rest:${day}`, mandatory: false, kind: 'rest', activity: 'rest',
      title: lt('Dinlen', 'Rest'), why: fill(lt('Yorgunluğun {f}: dinlenmek sakatlık riskini düşürür.', 'Fatigue {f}: resting lowers your injury risk.'), { f: Math.round(h.fatigue) }),
      reward: lt('Yorgunluk −8 · sakatlık riski ↓', 'Fatigue −8 · injury risk ↓'),
    })
  }
  if (next && until >= 1 && until <= 2 && out.length < 3 && rng.chance(0.7)) {
    out.push({
      id: `p:video:${day}`, mandatory: false, kind: 'video', activity: 'video',
      title: lt('Rakip videosu izle', 'Study the opponent'), why: lt('Video analiz: rakibin alışkanlıklarını öğren.', 'Video analysis: learn the opponent’s habits.'),
      reward: fill(lt('İlk 11 şansı +%{p} · klipleri oku: maçta önsezi/pozisyon +4’e kadar', 'Start chance +{p}% · read the clips: up to +4 anticipation/positioning in the match'), { p: Math.round(PREP_SELECTION * 100) }),
    })
  }
  return out.slice(0, 3)
}

/** Build today's agenda (deterministic; does not touch the career RNG). */
export function generateAgenda(s: GameState): Agenda {
  const day = today(s)
  const rng = new Rng(s.meta.seed).fork(`agenda:${day}`)
  const kinds = pickMandatory(s, rng)
  return { day, tasks: [...kinds.map((k) => mandatoryTask(s, k, day)), ...prepTasks(s, day, rng)] }
}

/** Today's agenda, generated and stored on first read of the day. */
export function ensureAgenda(s: GameState): Agenda {
  const cur = readJson<Agenda | null>(s.life, AGENDA_FLAG, null)
  if (cur && cur.day === today(s)) return cur
  const a = generateAgenda(s)
  writeJson(s.life, AGENDA_FLAG, a)
  if (a.tasks.some((t) => t.mandatory)) {
    const l = lastDays(s)
    for (const t of a.tasks) if (t.mandatory) l[t.kind as MandatoryKind] = a.day
    writeJson(s.life, AGENDA_LAST_FLAG, l)
    const hist = readJson<number[]>(s.life, AGENDA_HIST_FLAG, []).filter((x) => a.day - x < DAYS_PER_WEEK)
    for (const t of a.tasks) if (t.mandatory) hist.push(a.day)
    writeJson(s.life, AGENDA_HIST_FLAG, hist)
  }
  return a
}

/** Mandatory tasks still open today (empty when retired / no club). */
export function pendingMandatory(s: GameState): AgendaTask[] {
  if (s.hero.retired) return []
  return ensureAgenda(s).tasks.filter((t) => t.mandatory && !t.done)
}

/** Why the day cannot be advanced (null = it can). */
export function agendaBlock(s: GameState): LText | null {
  const p = pendingMandatory(s)
  if (!p.length) return null
  return { tr: `Önce zorunlu görevleri tamamla: ${p.map((t) => t.title.tr).join(', ')}`, en: `Finish your mandatory tasks first: ${p.map((t) => t.title.en).join(', ')}` }
}

// ───────────────────────── Resolution ─────────────────────────

export type ResolveMode = 'quick' | 'played' | 'skip'

function save(s: GameState, a: Agenda): void {
  writeJson(s.life, AGENDA_FLAG, a)
}

const rel = (s: GameState, id: string, d: number, why?: LText): number => changeRelation(s.life, id, d, { hero: s.hero, cause: 'activity', week: absWeek(s.calendar), ...(why ? { why } : {}) })
const family = (s: GameState, d: number): void => { for (const id of ['mother', 'father', 'sibling']) rel(s, id, d) }
/** The whole dressing room: every current teammate's bond (there is no single 'teammates' relationship). */
const squad = (s: GameState, d: number): void => {
  for (const r of Object.values(s.life.relationships)) if (r.kind === 'teammate') rel(s, r.id, d)
}

/**
 * Resolve a mandatory task. `quick` = the average outcome, `played` = a better
 * outcome (drill performance or a choice id), `skip` = the explicit decision to
 * skip with its consequences (only where allowed).
 */
export function resolveTask(s: GameState, id: string, mode: ResolveMode, opts: { performance?: number; choice?: string; picks?: readonly string[] } = {}): { ok: boolean; lines: LText[]; outcome?: SceneOutcome } {
  const a = ensureAgenda(s)
  const t = a.tasks.find((x) => x.id === id)
  if (!t) return { ok: false, lines: [lt('Görev bulunamadı.', 'Task not found.')] }
  if (t.done) return { ok: false, lines: [lt('Bu görev tamamlandı.', 'This task is done.')] }
  if (!t.mandatory) return completePrep(s, a, t)
  if (mode === 'skip' && !t.skip) return { ok: false, lines: [lt('Bu görev atlanamaz.', 'This task cannot be skipped.')] }
  if (mode === 'played' && !t.play) mode = 'quick'
  const h = s.hero
  const life = s.life
  const rng = new Rng(s.meta.seed).fork(`task:${id}`)
  let line: LText = lt('Tamamlandı.', 'Done.')
  let outcome: SceneOutcome | undefined
  const choice = opts.choice ?? t.play?.choices?.[0]?.id
  switch (t.kind as MandatoryKind) {
    case 'teamTraining':
      if (mode === 'skip') {
        life.discipline = meter(life.discipline - 6)
        changeTrust(h, -3)
        rel(s, MANAGER_REL, -3, lt('Zorunlu antrenmanı kaçırdın.', 'You skipped compulsory training.'))
        const next = nextClubFixture(s)
        if (next) writeJson(life, SKIPPED_TRAINING_FLAG, { fixtureId: next.fixture.id })
        line = lt('Antrenmana gitmedin. Hoca not etti.', 'You skipped training. The manager noticed.')
      } else {
        const perf = mode === 'played' ? clamp(opts.performance ?? 0.6, 0, 1) : 0.6
        changeTrust(h, Math.max(0, trainingTrustRaw(h, perf)) + 0.5)
        // The played drill already ran as a training session (energy, XP); the quick one costs its share here.
        if (mode === 'quick') { h.fatigue = meter(h.fatigue + 4); life.energy = meter(life.energy - 10) }
        line = perf >= 0.78 ? lt('Taktik çalışmada parladın; hoca memnun.', 'You shone in the tactical session; the manager is pleased.') : lt('Takım antrenmanını tamamladın.', 'You completed team training.')
      }
      break
    case 'disciplinary':
      if (mode === 'played' && choice === 'contest') {
        if (rng.chance(appealChance(s)) && h.suspendedMatches > 1) { h.suspendedMatches--; line = lt('İtirazın kabul edildi: ceza 1 maç azaldı.', 'Appeal upheld: the ban is cut by a match.') }
        else { life.discipline = meter(life.discipline - 4); line = lt('İtirazın reddedildi.', 'Appeal rejected.') }
      } else {
        life.discipline = meter(life.discipline + (mode === 'played' ? 5 : 3))
        if (mode === 'played') rel(s, MANAGER_REL, 2)
        line = lt('Kurulun önünde özür diledin.', 'You apologised to the committee.')
      }
      break
    case 'pressConference':
      if (mode === 'skip') { rel(s, 'press', -5); life.discipline = meter(life.discipline - 3); line = lt('Basın toplantısına çıkmadın.', 'You skipped the press conference.') }
      else if (mode === 'quick') { rel(s, 'press', 1); line = lt('Kalıp cevaplar verdin.', 'You gave stock answers.') }
      else if (choice === 'humble') { rel(s, 'press', pressN(s, 3)); rel(s, MANAGER_REL, pressN(s, 2)); line = lt('Alçakgönüllü cevapların beğenildi.', 'Your humble answers went down well.') }
      else if (choice === 'confident') { rel(s, 'fans', pressN(s, 4)); h.morale = meter(h.morale + pressN(s, 3)); line = lt('Kendinden emin konuştun; taraftar coştu.', 'You spoke with confidence; the fans loved it.') }
      else { rel(s, 'fans', pressN(s, 6)); rel(s, 'press', -2); rel(s, MANAGER_REL, -2); line = lt('İddialı manşetler attırdın.', 'You made bold headlines.') }
      break
    case 'dopingTest':
      if (mode === 'skip') { life.discipline = meter(life.discipline - 15); h.reputation = clamp(h.reputation - 2, 0, 100); rel(s, MANAGER_REL, -6); line = lt('Testi reddettin. Bu iş büyüyecek.', 'You refused the test. This will grow.') }
      else if (mode === 'played') {
        // The calm mini-game (breathing + forms in order): composure XP, and nerves or calm show in the morale and the club's view.
        const perf = clamp(opts.performance ?? 0.6, 0, 1)
        life.discipline = meter(life.discipline + (perf >= 0.6 ? 2 : perf < 0.35 ? 0 : 1))
        applyXpBundle(h, { composure: Math.round(2 + perf * 6) }, s.calendar.season)
        h.morale = meter(h.morale + (perf >= 0.75 ? 2 : perf < 0.35 ? -1 : 1))
        line = perf >= 0.75 ? lt('Sakin kaldın, formlar eksiksiz: test temiz çıktı.', 'Calm and every form in order: the test came back clean.') : perf < 0.35 ? lt('Gergin anlar yaşadın ama test temiz çıktı.', 'A nervy wait, but the test came back clean.') : lt('Doping testi temiz çıktı.', 'The doping test came back clean.')
      } else { life.discipline = meter(life.discipline + 1); line = lt('Doping testi temiz çıktı.', 'The doping test came back clean.') }
      break
    case 'physio':
      if (mode === 'skip') { life.discipline = meter(life.discipline - 3); line = lt('Fizyoterapiye gitmedin.', 'You skipped the physio.') }
      else { const full = mode === 'played'; h.fatigue = meter(h.fatigue - (full ? 16 : 10)); if (full) life.energy = meter(life.energy - 8); line = lt('Fizyoterapi seansı tamam.', 'Physio session done.') }
      break
    case 'sponsorShoot':
      if (mode === 'skip') { h.reputation = clamp(h.reputation - 1, 0, 100); life.happiness = meter(life.happiness - 2); line = lt('Çekimi iptal ettin; sponsor memnun değil.', 'You cancelled the shoot; the sponsor is unhappy.') }
      else { const extra = mode === 'played'; life.followers = Math.round(life.followers * (extra ? 1.006 : 1.003)) + (extra ? 60 : 30); life.energy = meter(life.energy - (extra ? 15 : 8)); line = lt('Sponsor çekimi tamam.', 'Sponsor shoot done.') }
      break
    case 'autographs':
      if (mode === 'skip') { rel(s, 'fans', -3); line = lt('İmza gününe gitmedin.', 'You missed the autograph session.') }
      else { const stay = mode === 'played'; rel(s, 'fans', stay ? 5 : 2); if (stay) life.energy = meter(life.energy - 10); line = lt('Taraftarlarla buluştun.', 'You met the fans.') }
      break
    case 'boardMeeting':
      if (mode === 'played' && choice === 'ambitious') { h.morale = meter(h.morale + 4); rel(s, MANAGER_REL, -1); line = lt('Başkana hedeflerini anlattın.', 'You told the chairman your ambitions.') }
      else if (mode === 'played') { rel(s, MANAGER_REL, 3); rel(s, 'fans', 2); line = lt('Kulübe bağlılığını gösterdin.', 'You showed your loyalty.') }
      else { rel(s, MANAGER_REL, 1); line = lt('Başkanla nazik bir görüşme yaptın.', 'A polite chat with the chairman.') }
      break
    case 'nationalCamp':
      if (mode === 'played') {
        outcome = applyNationalCamp(s, opts.picks ?? [])
        line = outcome.lines[0] ?? line
      } else {
        h.morale = meter(h.morale + 2)
        line = lt('Milli takım kampına katılımını bildirdin.', 'You checked in for the national camp.')
      }
      break
    case 'dateNight':
      if (mode === 'skip') { rel(s, 'partner', -6); life.happiness = meter(life.happiness - 3); line = lt('Akşam yemeğini iptal ettin.', 'You cancelled the dinner.') }
      else { const sp = mode === 'played'; rel(s, 'partner', sp ? 8 : 4); life.happiness = meter(life.happiness + (sp ? 4 : 2)); if (sp) life.money -= 150; line = lt('Güzel bir akşam geçirdiniz.', 'You had a lovely evening.') }
      break
    case 'familyBirthday':
      if (mode === 'skip') { rel(s, 'mother', -8); life.happiness = meter(life.happiness - 3); line = lt('Annenin doğum gününü unuttun.', 'You forgot your mother’s birthday.') }
      else { const v = mode === 'played'; family(s, v ? 8 : 3); if (v) { life.happiness = meter(life.happiness + 4); life.energy = meter(life.energy - 8) } line = lt('Annenin doğum gününü kutladın.', 'You celebrated your mother’s birthday.') }
      break
    case 'captainMentoring':
      if (mode === 'skip') { squad(s, -2); rel(s, MANAGER_REL, -2); line = lt('Gençlerle konuşmadın.', 'You did not talk to the youngsters.') }
      else { const d = mode === 'played'; squad(s, d ? 5 : 2); if (d) { life.energy = meter(life.energy - 8); applyXpBundle(h, { leadership: 6 }, s.calendar.season) } line = lt('Kaptan olarak gençlerle konuştun.', 'You talked to the youngsters as captain.') }
      break
    case 'recoverySession':
      if (mode === 'skip') { life.discipline = meter(life.discipline - 2); line = lt('Toparlanmaya gitmedin.', 'You skipped recovery.') }
      else { const ice = mode === 'played'; h.fatigue = meter(h.fatigue - (ice ? 12 : 6)); if (ice) life.energy = meter(life.energy - 5); line = lt('Toparlanma antrenmanı tamam.', 'Recovery session done.') }
      break
    case 'devMeeting':
      if (mode === 'skip') { rel(s, MANAGER_REL, -2); line = lt('Gelişim görüşmesine gitmedin.', 'You skipped the development talk.') }
      else if (mode === 'played' && choice === 'feedback') { changeTrust(h, 1.5); line = lt('Açık eleştiriyi dinledin; hoca bunu sevdi.', 'You took the honest criticism; the manager liked that.') }
      else if (mode === 'played') { h.morale = meter(h.morale + 3); rel(s, MANAGER_REL, 2); line = lt('Birlikte hedefler koydunuz.', 'You set goals together.') }
      else { rel(s, MANAGER_REL, 1); line = lt('Kısa bir gelişim görüşmesi yaptın.', 'A short development talk.') }
      break
    case 'teamMeeting':
      if (mode === 'skip') { rel(s, MANAGER_REL, -3); life.discipline = meter(life.discipline - 3); line = lt('Takım toplantısına gitmedin.', 'You skipped the team meeting.') }
      else if (mode === 'played' && choice === 'team') { squad(s, 3); h.morale = meter(h.morale + 2); line = lt('Takıma konuştun; soyunma odası dinledi.', 'You spoke to the group; the dressing room listened.') }
      else if (mode === 'played') { rel(s, MANAGER_REL, 2); line = lt('Sorduğun soru hocanın hoşuna gitti.', 'The manager liked your question.') }
      else { applyXpBundle(h, { positioning: 1 }, s.calendar.season); line = lt('Toplantıyı dinledin, notlarını aldın.', 'You listened and took notes.') }
      break
    case 'gymBlock':
      if (mode === 'skip') { life.discipline = meter(life.discipline - 3); line = lt('Kuvvet çalışmasına gitmedin.', 'You skipped the gym block.') }
      else if (mode === 'played') { changeTrust(h, Math.max(0, trainingTrustRaw(h, clamp(opts.performance ?? 0.6, 0, 1))) * 0.5); line = lt('Kuvvet çalışmasını bitirdin.', 'You finished the gym block.') }
      else { life.energy = meter(life.energy - 6); line = lt('Kuvvet programını tamamladın.', 'You completed the strength programme.') }
      break
    case 'fitnessTest':
      if (mode === 'played') {
        const perf = clamp(opts.performance ?? 0.6, 0, 1)
        // Trust scales with the drill: nothing below a C, +1 for a perfect test.
        if (perf > 0.4) changeTrust(h, Math.round(((perf - 0.4) / 0.6) * 10) / 10)
        line = perf >= 0.75 ? lt('Testte takımın en iyileri arasındaydın.', 'You were among the best in the squad in the test.') : lt('Kondisyon testini geçtin.', 'You passed the fitness test.')
      } else { life.energy = meter(life.energy - 5); line = lt('Kondisyon testini geçtin.', 'You passed the fitness test.') }
      break
    case 'clubMedia':
      if (mode === 'skip') { rel(s, 'press', -2); line = lt('Kulüp TV röportajını kaçırdın.', 'You missed the club TV interview.') }
      else if (mode === 'played' && choice === 'serious') { rel(s, 'press', 2); rel(s, MANAGER_REL, 1); line = lt('Ciddi ve odaklı göründün.', 'You came across serious and focused.') }
      else if (mode === 'played') { rel(s, 'fans', 3); life.followers = Math.round(life.followers * 1.002) + 20; line = lt('Röportaj sosyal medyada çok paylaşıldı.', 'The interview was shared widely online.') }
      else { rel(s, 'fans', 1); line = lt('Kulüp TV için kısa bir röportaj verdin.', 'You gave club TV a short interview.') }
      break
    case 'communityVisit':
      if (mode === 'skip') { rel(s, 'fans', -2); line = lt('Okul ziyaretine katılmadın.', 'You skipped the school visit.') }
      else if (mode === 'played') { rel(s, 'fans', 3); life.happiness = meter(life.happiness + 3); life.energy = meter(life.energy - 6); line = lt('Çocuklarla top oynadın; günün en güzel anı.', 'You played football with the kids; the best moment of the day.') }
      else { rel(s, 'fans', 1); line = lt('Okul ziyaretine katıldın.', 'You joined the school visit.') }
      break
    case 'charity':
      if (mode === 'skip') { rel(s, 'press', -3); rel(s, 'fans', -2); line = lt('Hayır gecesine gitmedin.', 'You skipped the charity evening.') }
      else if (mode === 'played') { rel(s, 'fans', 4); rel(s, 'press', 3); line = lt('Hayır gecesinde konuşma yaptın.', 'You gave a speech at the charity evening.') }
      else { rel(s, 'fans', 2); line = lt('Hayır gecesine katıldın.', 'You attended the charity evening.') }
      break
  }
  t.done = mode === 'skip' ? 'skipped' : mode
  t.result = line
  save(s, a)
  return { ok: true, lines: [line], ...(outcome ? { outcome } : {}) }
}

/** Mark a preparation goal done and store its matchup buff for the next club match. */
function completePrep(s: GameState, a: Agenda, t: AgendaTask): { ok: boolean; lines: LText[] } {
  t.done = 'played'
  t.result = lt('Hazırlık tamam.', 'Preparation done.')
  save(s, a)
  const next = nextClubFixture(s)
  if (next) {
    const cur = readJson<{ fixtureId: string; attrs: AttributeKey[]; n: number } | null>(s.life, PREP_FLAG, null)
    const base = cur && cur.fixtureId === next.fixture.id ? cur : { fixtureId: next.fixture.id, attrs: [], n: 0 }
    if (t.attr && !base.attrs.includes(t.attr)) base.attrs.push(t.attr)
    if (t.kind !== 'rest') base.n++
    writeJson(s.life, PREP_FLAG, base)
  }
  return { ok: true, lines: [t.result] }
}

/** After an activity: a matching preparation goal of today is completed. */
export function agendaAfterActivity(s: GameState, activityId: string): LText | null {
  const a = readJson<Agenda | null>(s.life, AGENDA_FLAG, null)
  if (!a || a.day !== today(s)) return null
  const t = a.tasks.find((x) => !x.mandatory && !x.done && x.activity === activityId)
  if (!t) return null
  completePrep(s, a, t)
  return fill(lt('Hazırlık tamam: {t}', 'Preparation done: {t}'), { t: t.title })
}

/** Autopilot / end of day: quick-resolve what is left (the sim never stalls). Returns the number resolved. */
export function autoResolveAgenda(s: GameState): number {
  const a = readJson<Agenda | null>(s.life, AGENDA_FLAG, null)
  if (!a || a.day !== today(s)) return 0
  let n = 0
  for (const t of a.tasks) if (t.mandatory && !t.done && resolveTask(s, t.id, 'quick').ok) n++
  return n
}

/** Selection term from preparation and skipped training for a fixture (sim/game/selection). */
export function agendaSelection(s: GameState, fixtureId: string | undefined): { prep: number; skipped: boolean } {
  if (!fixtureId) return { prep: 0, skipped: false }
  const p = readJson<{ fixtureId: string; n: number } | null>(s.life, PREP_FLAG, null)
  const k = readJson<{ fixtureId: string } | null>(s.life, SKIPPED_TRAINING_FLAG, null)
  return { prep: p && p.fixtureId === fixtureId ? Math.min(2, p.n) : 0, skipped: !!k && k.fixtureId === fixtureId }
}

/** Matchup buffs for a fixture (attributes +PREP_BUFF), read when the hero's team is built. */
export function prepBuffs(s: GameState, fixtureId: string): AttributeKey[] {
  const p = readJson<{ fixtureId: string; attrs: AttributeKey[] } | null>(s.life, PREP_FLAG, null)
  return p && p.fixtureId === fixtureId ? p.attrs : []
}

/** life.flags (JSON {day, minutes}): the hero's last club match (recovery session the morning after). */
export const LAST_CLUB_MATCH_FLAG = 'c:lastClubMatch'

/** After a club match the preparation and the skipped-training mark expire. */
export function agendaAfterMatch(s: GameState, minutes = 0): void {
  writeJson(s.life, LAST_CLUB_MATCH_FLAG, { day: today(s), minutes })
  writeJson(s.life, PREP_FLAG, null)
  writeJson(s.life, SKIPPED_TRAINING_FLAG, null)
}
