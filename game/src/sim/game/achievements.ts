/**
 * Achievements (WP-7): ≥ 60 definitions and an EVENT-DRIVEN checker.
 *
 * The UI bridge (ui/backend/meta.ts) feeds {@link AchEvent}s: `match` (after
 * every hero match, from the `c:lastMatch` feats), `tick` (any other state
 * change: contract, money, awards…), `drill` (mini-game grades), `trial`,
 * `casinoLeave`, `retired`, `newCareer`, `records`. {@link processAchievementEvent}
 * updates the GLOBAL counters (they survive careers and deleted saves), then
 * re-evaluates every definition and returns the newly unlocked ones. Progress
 * is monotonic: the best progress ever reached is kept in `best`.
 *
 * Achievement ids double as Steam API names (`platform.achievements.unlock(id)`).
 */
import type { GameState, LText } from '../../core/types'
import { ASSET_BY_ID } from '../../data/assets'
import { PERK_BY_ID } from '../../data/perks'
import { heroAge, lt } from '../career/common'
import { heroOvr } from '../career/progression'
import { netWorth } from '../life/economy'
import type { CareerSummary } from './hallOfFame'
import type { MatchFeats } from './records'

export type AchCategory = 'career' | 'match' | 'goalkeeping' | 'life' | 'responsible' | 'training' | 'legacy'

export type AchEvent =
  | { type: 'tick' }
  | { type: 'match'; feats: MatchFeats }
  | { type: 'drill'; kind: string; grade: string; performance: number }
  | { type: 'trial'; kind: string; signed: boolean }
  | { type: 'casinoLeave'; net: number }
  | { type: 'records'; broken: number }
  | { type: 'retired'; summary: CareerSummary }
  | { type: 'newCareer'; legacy: boolean }

/** Global counters (persisted with the achievements, never reset). */
export interface AchCounters {
  hatTricks: number
  fourGoalGames: number
  freeKickGoals: number
  penaltyGoals: number
  headerGoals: number
  perfectGames: number
  threeAssistGames: number
  finalGoals: number
  giantKills: number
  gkCleanSheets: number
  gkBigSaveGames: number
  gkGoals: number
  veteranGames: number
  bestWinStreak: number
  winStreak: number
  streakCareer: string
  drillsPlayed: number
  drillsS: number
  drillKindsS: string[]
  openTrialsWon: number
  trialsSigned: number
  casinoWalkAways: number
  clubRecords: number
  careersStarted: number
  legacyCareers: number
  careersRetired: number
  testimonials: number
  oneClubLegends: number
  neverGambledRetirements: number
  bestLegacyScore: number
  dynasties: number
}

export interface AchStore {
  /** id → unlock timestamp (ms). */
  unlocked: Record<string, number>
  /** id → best progress ever reached. */
  best: Record<string, number>
  counters: AchCounters
}

export interface AchContext {
  state: GameState | null
  c: AchCounters
  /** Number of achievements unlocked so far (collector achievements). */
  unlockedCount: number
}

export interface AchievementDef {
  id: string
  category: AchCategory
  icon: string
  name: LText
  desc: LText
  target: number
  /** Shown as "???" until unlocked. */
  secret?: boolean
  progress: (ctx: AchContext) => number
}

export const emptyCounters = (): AchCounters => ({
  hatTricks: 0, fourGoalGames: 0, freeKickGoals: 0, penaltyGoals: 0, headerGoals: 0, perfectGames: 0, threeAssistGames: 0,
  finalGoals: 0, giantKills: 0, gkCleanSheets: 0, gkBigSaveGames: 0, gkGoals: 0, veteranGames: 0, bestWinStreak: 0, winStreak: 0,
  streakCareer: '', drillsPlayed: 0, drillsS: 0, drillKindsS: [], openTrialsWon: 0, trialsSigned: 0, casinoWalkAways: 0,
  clubRecords: 0, careersStarted: 0, legacyCareers: 0, careersRetired: 0, testimonials: 0, oneClubLegends: 0,
  neverGambledRetirements: 0, bestLegacyScore: 0, dynasties: 0,
})

export const emptyAchStore = (): AchStore => ({ unlocked: {}, best: {}, counters: emptyCounters() })

/** Drill kinds that count for the "all drills" collection. */
export const CORE_DRILL_KINDS = ['finishing', 'passing', 'dribbling', 'fitness', 'goalkeeping'] as const

// ───────────────────────── Context helpers ─────────────────────────

const hero = (x: AchContext) => x.state?.hero ?? null
const career = (x: AchContext, k: 'apps' | 'goals' | 'assists' | 'motm' | 'cleanSheets'): number => hero(x)?.careerStats[k] ?? 0
const ovr = (x: AchContext): number => (x.state ? heroOvr(x.state.hero) : 0)
const club = (x: AchContext) => {
  const id = x.state?.hero.contract?.clubId
  return id ? x.state?.world.clubs[id] ?? null : null
}
const role = (x: AchContext) => x.state?.hero.contract?.role ?? null
const worth = (x: AchContext): number => (x.state ? netWorth(x.state.life, x.state.calendar) : 0)
const followers = (x: AchContext): number => x.state?.life.followers ?? 0
const assetsOf = (x: AchContext, cat: string): number => (x.state?.life.assets ?? []).filter((a) => ASSET_BY_ID[a.defId]?.category === cat).length
const hasAward = (x: AchContext, pred: (key: string) => boolean): number => ((hero(x)?.awards ?? []).some((a) => pred(a.key)) ? 1 : 0)
const flag = (b: boolean): number => (b ? 1 : 0)
const distinctClubs = (x: AchContext): number => {
  const h = hero(x)
  if (!h) return 0
  const ids = new Set(h.history.map((r) => r.clubId))
  if (h.contract) ids.add(h.contract.clubId)
  return ids.size
}
const boughtPerks = (x: AchContext): number => (hero(x)?.perks ?? []).filter((p) => (PERK_BY_ID[p]?.cost ?? 0) > 0).length

const A = (
  id: string, category: AchCategory, icon: string, name: LText, desc: LText, target: number, progress: (x: AchContext) => number, secret = false,
): AchievementDef => ({ id, category, icon, name, desc, target, progress, ...(secret ? { secret: true } : {}) })

// ───────────────────────── Catalogue ─────────────────────────

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── Career ──
  A('first_contract', 'career', '✍️', lt('İlk İmza', 'First Signature'), lt('İlk profesyonel sözleşmeni imzala.', 'Sign your first professional contract.'), 1, (x) => flag(!!hero(x)?.contract || (hero(x)?.history.length ?? 0) > 0)),
  A('debut', 'career', '👟', lt('Profesyonel Çıkış', 'Professional Debut'), lt('İlk resmî maçına çık.', 'Play your first competitive match.'), 1, (x) => career(x, 'apps')),
  A('first_goal', 'career', '⚽', lt('İlk Gol', 'Off the Mark'), lt('Kariyerinin ilk golünü at.', 'Score your first career goal.'), 1, (x) => career(x, 'goals')),
  A('goals_50', 'career', '🎯', lt('Elli', 'Half a Century'), lt('Kariyerinde 50 gol at.', 'Score 50 career goals.'), 50, (x) => career(x, 'goals')),
  A('goals_100', 'career', '💯', lt('Yüzler Kulübü', 'Centurion'), lt('Kariyerinde 100 gol at.', 'Score 100 career goals.'), 100, (x) => career(x, 'goals')),
  A('goals_250', 'career', '🔥', lt('Gol Makinesi', 'Goal Machine'), lt('Kariyerinde 250 gol at.', 'Score 250 career goals.'), 250, (x) => career(x, 'goals')),
  A('goals_500', 'career', '👑', lt('Beş Yüz', 'Five Hundred'), lt('Kariyerinde 500 gol at.', 'Score 500 career goals.'), 500, (x) => career(x, 'goals'), true),
  A('assists_50', 'career', '🤝', lt('Servis Ustası', 'Provider'), lt('Kariyerinde 50 asist yap.', 'Make 50 career assists.'), 50, (x) => career(x, 'assists')),
  A('assists_150', 'career', '🪄', lt('Asist Kralı', 'King of Assists'), lt('Kariyerinde 150 asist yap.', 'Make 150 career assists.'), 150, (x) => career(x, 'assists')),
  A('apps_100', 'career', '📅', lt('Yüzüncü Maç', 'Hundred Club'), lt('100 maça çık.', 'Play 100 matches.'), 100, (x) => career(x, 'apps')),
  A('apps_300', 'career', '🏟️', lt('Demirbaş', 'Mainstay'), lt('300 maça çık.', 'Play 300 matches.'), 300, (x) => career(x, 'apps')),
  A('apps_500', 'career', '🗿', lt('Abide', 'Monument'), lt('500 maça çık.', 'Play 500 matches.'), 500, (x) => career(x, 'apps')),
  A('motm_10', 'career', '🌟', lt('Maçın Adamı', 'Man of the Match'), lt('10 kez maçın oyuncusu seçil.', 'Win 10 player-of-the-match awards.'), 10, (x) => career(x, 'motm')),
  A('ovr_70', 'career', '📈', lt('Kaliteli Oyuncu', 'Quality Player'), lt('70 genel reytinge ulaş.', 'Reach 70 OVR.'), 70, ovr),
  A('ovr_80', 'career', '🚀', lt('Dünya Klası', 'World Class'), lt('80 genel reytinge ulaş.', 'Reach 80 OVR.'), 80, ovr),
  A('ovr_90', 'career', '💎', lt('Fenomen', 'Phenomenon'), lt('90 genel reytinge ulaş.', 'Reach 90 OVR.'), 90, ovr, true),
  A('young_star', 'career', '🌱', lt('Harika Çocuk', 'Wonderkid'), lt('19 yaşında ya da daha genç 65 reytinge ulaş.', 'Reach 65 OVR aged 19 or younger.'), 1, (x) => flag(!!x.state && heroAge(x.state.hero, x.state.calendar.season) <= 19 && ovr(x) >= 65)),
  A('first_trophy', 'career', '🏆', lt('İlk Kupa', 'Silverware'), lt('İlk kupanı kazan.', 'Win your first trophy.'), 1, (x) => hero(x)?.trophies.length ?? 0),
  A('trophies_10', 'career', '🏛️', lt('Kupa Dolabı', 'Trophy Cabinet'), lt('10 kupa kazan.', 'Win 10 trophies.'), 10, (x) => hero(x)?.trophies.length ?? 0),
  A('first_award', 'career', '🏅', lt('Ödüllü', 'Decorated'), lt('Bireysel bir ödül kazan.', 'Win an individual award.'), 1, (x) => hero(x)?.awards.length ?? 0),
  A('golden_star', 'career', '⭐', lt('Altın Yıldız', 'Golden Star'), lt('Dünyanın en iyi oyuncusu seçil.', 'Be named the best player in the world.'), 1, (x) => hasAward(x, (k) => k === 'golden_star')),
  A('golden_boot', 'career', '👢', lt('Gol Kralı', 'Top Scorer'), lt("Bir sezonu ligin ya da tüm liglerin gol kralı olarak bitir.", "Finish a season as your league's or all leagues' top scorer."), 1, (x) => hasAward(x, (k) => k === 'top_scorer' || k === 'league_top_scorer')),
  A('national_call', 'career', '🎽', lt('Milli Forma', 'International'), lt('Milli takıma çağrıl.', 'Get called up by your national team.'), 1, (x) => flag(!!hero(x)?.nationalTeam.called || (hero(x)?.nationalTeam.caps ?? 0) > 0)),
  A('caps_50', 'career', '🎖️', lt('Milli Emektar', 'National Servant'), lt('50 milli maça çık.', 'Earn 50 caps.'), 50, (x) => hero(x)?.nationalTeam.caps ?? 0),
  A('int_goals_20', 'career', '🥇', lt('Milli Golcü', 'National Hero'), lt('Milli takımda 20 gol at.', 'Score 20 international goals.'), 20, (x) => hero(x)?.nationalTeam.goals ?? 0),
  A('star_role', 'career', '✨', lt('Takımın Yıldızı', 'Main Man'), lt('Takımında yıldız rolüne yüksel.', 'Earn the star role at your club.'), 1, (x) => flag(role(x) === 'star' || role(x) === 'captain')),
  A('captain', 'career', '©️', lt('Kaptan', 'Captain'), lt('Kaptanlık bandını tak.', 'Wear the captain armband.'), 1, (x) => flag(role(x) === 'captain')),
  A('big_club', 'career', '🏰', lt('Dev Kulüp', 'Big Club'), lt('İtibarı 80+ bir kulübe imza at.', 'Sign for a club with 80+ reputation.'), 1, (x) => flag((club(x)?.reputation ?? 0) >= 80)),
  A('abroad', 'career', '✈️', lt('Gurbetçi', 'Abroad'), lt('Yurt dışında bir kulüpte oyna.', 'Play for a club abroad.'), 1, (x) => flag(!!club(x) && club(x)?.countryId !== hero(x)?.nationality)),
  A('journeyman', 'career', '🧳', lt('Gezgin', 'Journeyman'), lt('3 farklı kulüpte oyna.', 'Play for 3 different clubs.'), 3, distinctClubs),
  A('seasons_10', 'career', '🗓️', lt('On Yıl', 'Decade'), lt('10 sezon oyna.', 'Complete 10 seasons.'), 10, (x) => hero(x)?.history.length ?? 0),
  A('perks_5', 'career', '🧠', lt('Yetenekli', 'Skilled'), lt('5 yetenek aç.', 'Unlock 5 perks.'), 5, boughtPerks),
  A('perk_capstone', 'career', '🌠', lt('Uzmanlık', 'Mastery'), lt('Bir ustalık (2 puanlık) yeteneği aç.', 'Unlock a capstone (2-point) perk.'), 1, (x) => flag((hero(x)?.perks ?? []).some((p) => (PERK_BY_ID[p]?.cost ?? 0) >= 2))),

  // ── Match feats ──
  A('hat_trick', 'match', '🎩', lt('Hat-trick', 'Hat-trick'), lt('Bir maçta 3 gol at.', 'Score 3 goals in a match.'), 1, (x) => x.c.hatTricks),
  A('hat_tricks_5', 'match', '🎩', lt('Hat-trick Ustası', 'Hat-trick Hero'), lt('5 hat-trick yap.', 'Score 5 hat-tricks.'), 5, (x) => x.c.hatTricks),
  A('four_goals', 'match', '4️⃣', lt('Dörtlük', 'Haul'), lt('Bir maçta 4 gol at.', 'Score 4 goals in a match.'), 1, (x) => x.c.fourGoalGames, true),
  A('free_kick_goal', 'match', '🌀', lt('Frikik Golü', 'Free-Kick Goal'), lt('Serbest vuruştan gol at.', 'Score from a free kick.'), 1, (x) => x.c.freeKickGoals),
  A('free_kicks_10', 'match', '🪄', lt('Frikik Uzmanı', 'Dead-Ball Specialist'), lt('10 serbest vuruş golü at.', 'Score 10 free-kick goals.'), 10, (x) => x.c.freeKickGoals),
  A('penalty_goal', 'match', '🧊', lt('Penaltı', 'From the Spot'), lt('Penaltıdan gol at.', 'Score a penalty.'), 1, (x) => x.c.penaltyGoals),
  A('header_goal', 'match', '🤕', lt('Kafa Golü', 'Header'), lt('Kafayla gol at.', 'Score with a header.'), 1, (x) => x.c.headerGoals),
  A('perfect_game', 'match', '💯', lt('Kusursuz', 'Perfect Game'), lt('Bir maçta 9,5+ reyting al.', 'Get a 9.5+ rating in a match.'), 1, (x) => x.c.perfectGames),
  A('three_assists', 'match', '🎁', lt('Cömert', 'Generous'), lt('Bir maçta 3 asist yap.', 'Make 3 assists in a match.'), 1, (x) => x.c.threeAssistGames),
  A('final_goal', 'match', '🏟️', lt('Final Golü', 'Cup Final Goal'), lt('Bir finalde gol at.', 'Score in a final.'), 1, (x) => x.c.finalGoals),
  A('giant_killer', 'match', '🗡️', lt('Dev Avcısı', 'Giant Killer'), lt('İtibarı 80+ bir rakibi yen.', 'Beat a club with 80+ reputation.'), 1, (x) => x.c.giantKills),
  A('win_streak_5', 'match', '📶', lt('Seri', 'On a Roll'), lt('Oynadığın 5 maçı üst üste kazan.', 'Win 5 matches you play in a row.'), 5, (x) => x.c.bestWinStreak),
  A('veteran', 'match', '🧓', lt('Yaşlı Kurt', 'Old Warhorse'), lt('36 yaşında ya da daha büyükken maç oyna.', 'Play a match aged 36 or older.'), 1, (x) => x.c.veteranGames),

  // ── Goalkeeping ──
  A('gk_clean_sheet', 'goalkeeping', '🧤', lt('Gol Yok', 'Clean Sheet'), lt('Kaleci olarak gol yemeden maç bitir.', 'Keep a clean sheet as a goalkeeper.'), 1, (x) => x.c.gkCleanSheets),
  A('gk_clean_sheets_25', 'goalkeeping', '🛡️', lt('Kilit', 'Lockdown'), lt('Kaleci olarak 25 maçta gol yeme.', 'Keep 25 clean sheets as a goalkeeper.'), 25, (x) => x.c.gkCleanSheets),
  A('gk_wall', 'goalkeeping', '🧱', lt('Aşılmaz Duvar', 'The Wall'), lt('Bir maçta 8 kurtarış yap.', 'Make 8 saves in a match.'), 1, (x) => x.c.gkBigSaveGames),
  A('gk_goal', 'goalkeeping', '😲', lt('Golcü Kaleci', 'Goalscoring Keeper'), lt('Kaleci olarak gol at.', 'Score as a goalkeeper.'), 1, (x) => x.c.gkGoals, true),

  // ── Life ──
  A('millionaire', 'life', '💰', lt('Milyoner', 'Millionaire'), lt('Net servetin 1 milyona ulaşsın.', 'Reach a net worth of 1 million.'), 1_000_000, worth),
  A('multi_millionaire', 'life', '🤑', lt('Servet', 'Fortune'), lt('Net servetin 10 milyona ulaşsın.', 'Reach a net worth of 10 million.'), 10_000_000, worth),
  A('followers_100k', 'life', '📱', lt('Fenomen', 'Influencer'), lt('100 bin takipçiye ulaş.', 'Reach 100K followers.'), 100_000, followers),
  A('followers_1m', 'life', '📣', lt('Milyonların Sevgilisi', 'Global Icon'), lt('1 milyon takipçiye ulaş.', 'Reach 1M followers.'), 1_000_000, followers),
  A('first_home', 'life', '🏠', lt('Ev Sahibi', 'Homeowner'), lt('Bir ev satın al.', 'Buy a house.'), 1, (x) => assetsOf(x, 'house')),
  A('car_collector', 'life', '🏎️', lt('Garaj', 'Car Collector'), lt('Aynı anda 3 araba sahibi ol.', 'Own 3 cars at once.'), 3, (x) => assetsOf(x, 'car')),
  A('sponsor', 'life', '👟', lt('Sponsorlu', 'Endorsed'), lt('Bir sponsorluk anlaşması imzala.', 'Sign a sponsorship deal.'), 1, (x) => x.state?.life.sponsors.length ?? 0),
  A('super_agent', 'life', '🕴️', lt('Süper Menajer', 'Super Agent'), lt('5 yıldızlı bir menajerle çalış.', 'Hire a 5-star agent.'), 1, (x) => flag((x.state?.life.agent?.quality ?? 0) >= 5)),
  A('happy_life', 'life', '😊', lt('Mutlu Hayat', 'Living the Dream'), lt('Mutluluğun 90\'a ulaşsın.', 'Reach 90 happiness.'), 90, (x) => x.state?.life.happiness ?? 0),
  A('saver', 'life', '🏦', lt('Tutumlu', 'Saver'), lt('Bankada 500 bin biriktir.', 'Save 500K in the bank.'), 500_000, (x) => x.state?.life.bank.savings ?? 0),

  // ── Responsible play ──
  A('walk_away', 'responsible', '🚪', lt('Kârdayken Kalk', 'Quit While Ahead'), lt('Kumarhaneden kârla ayrıl.', 'Leave the casino in profit.'), 1, (x) => x.c.casinoWalkAways),
  A('in_control', 'responsible', '🧘', lt('Kontrol Sende', 'In Control'), lt('30 yaşına kumar bağımlılığın 10\'un altında gir.', 'Reach age 30 with gambling addiction below 10.'), 1, (x) => flag(!!x.state && heroAge(x.state.hero, x.state.calendar.season) >= 30 && x.state.life.casino.addiction < 10)),
  A('never_gambled', 'responsible', '🙅', lt('Temiz Sayfa', 'Clean Slate'), lt('Hiç kumar oynamadan emekli ol.', 'Retire without ever gambling.'), 1, (x) => x.c.neverGambledRetirements),
  A('professional', 'responsible', '🎓', lt('Örnek Profesyonel', 'Model Professional'), lt('Disiplinin 95\'e ulaşsın.', 'Reach 95 discipline.'), 95, (x) => x.state?.life.discipline ?? 0),

  // ── Training ──
  A('drill_s', 'training', '🅢', lt('S Notu', 'Top Marks'), lt('Bir antrenman oyununda S notu al.', 'Get an S grade in a training drill.'), 1, (x) => x.c.drillsS),
  A('drill_s_10', 'training', '🏋️', lt('Antrenman Canavarı', 'Training Monster'), lt('10 kez S notu al.', 'Get 10 S grades.'), 10, (x) => x.c.drillsS),
  A('drill_all_s', 'training', '🗂️', lt('Çok Yönlü', 'All-Rounder'), lt('Her temel drilde en az bir S notu al.', 'Get an S grade in every core drill.'), CORE_DRILL_KINDS.length, (x) => CORE_DRILL_KINDS.filter((k) => x.c.drillKindsS.includes(k)).length),
  A('drills_100', 'training', '⏱️', lt('Ter Döken', 'Hard Worker'), lt('100 antrenman oyunu oyna.', 'Play 100 training drills.'), 100, (x) => x.c.drillsPlayed),

  // ── Legacy & meta ──
  A('trial_star', 'legacy', '🎟️', lt('Seçmeden Yıldız', 'Trial Triumph'), lt('Açık seçmeleri geçerek sözleşme kap.', 'Earn a contract through an open tryout.'), 1, (x) => x.c.openTrialsWon),
  A('record_breaker', 'legacy', '📈', lt('Rekortmen', 'Record Breaker'), lt('Bir kulüp rekoru kır.', 'Break a club record.'), 1, (x) => x.c.clubRecords),
  A('retired', 'legacy', '👋', lt('Veda', 'Farewell'), lt('Kariyerini noktala.', 'Retire from football.'), 1, (x) => x.c.careersRetired),
  A('testimonial', 'legacy', '🎉', lt('Jübile', 'Testimonial'), lt('Bir jübile maçıyla veda et.', 'Say goodbye with a testimonial match.'), 1, (x) => x.c.testimonials),
  A('one_club', 'legacy', '❤️', lt('Tek Kulüp Efsanesi', 'One-Club Legend'), lt('10+ sezonu tek kulüpte geçirip emekli ol.', 'Retire after 10+ seasons at a single club.'), 1, (x) => x.c.oneClubLegends),
  A('hall_of_fame', 'legacy', '🏛️', lt('Onur Listesi', 'Hall of Famer'), lt('1.500+ miras puanıyla emekli ol.', 'Retire with a 1,500+ legacy score.'), 1500, (x) => x.c.bestLegacyScore),
  A('legacy_start', 'legacy', '🧬', lt('Soyadın Gücü', 'In the Blood'), lt('Bir efsanenin çocuğu olarak kariyere başla.', 'Start a career as a legend\'s child.'), 1, (x) => x.c.legacyCareers),
  A('dynasty', 'legacy', '🌳', lt('Hanedan', 'Dynasty'), lt('Bir efsanenin çocuğuyla kariyeri tamamla.', 'Retire with a legend\'s child.'), 1, (x) => x.c.dynasties, true),
  A('three_careers', 'legacy', '🔁', lt('Üç Ömür', 'Three Lifetimes'), lt('3 kariyeri tamamla.', 'Complete 3 careers.'), 3, (x) => x.c.careersRetired),
  A('collector_30', 'legacy', '🏵️', lt('Koleksiyoncu', 'Collector'), lt('30 başarım aç.', 'Unlock 30 achievements.'), 30, (x) => x.unlockedCount),
  A('completionist', 'legacy', '🏆', lt('Tamamlayıcı', 'Completionist'), lt('60 başarım aç.', 'Unlock 60 achievements.'), 60, (x) => x.unlockedCount, true),
]

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, AchievementDef>> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

// ───────────────────────── Checker ─────────────────────────

/** Update the global counters for one event. */
export function applyEventToCounters(c: AchCounters, ev: AchEvent, state: GameState | null): void {
  switch (ev.type) {
    case 'match': {
      const f = ev.feats
      if (f.minutes <= 0) return
      const careerId = state?.meta.id ?? ''
      if (c.streakCareer !== careerId) {
        c.streakCareer = careerId
        c.winStreak = 0
      }
      if (f.goals >= 3) c.hatTricks++
      if (f.goals >= 4) c.fourGoalGames++
      c.freeKickGoals += f.freeKickGoals
      c.penaltyGoals += f.penaltyGoals
      c.headerGoals += f.headerGoals
      if (f.rating >= 9.5) c.perfectGames++
      if (f.assists >= 3) c.threeAssistGames++
      if (f.final && f.goals > 0) c.finalGoals++
      if (f.won && f.opponentReputation >= 80) c.giantKills++
      if (f.isKeeper && f.cleanSheet) c.gkCleanSheets++
      if (f.isKeeper && f.saves >= 8) c.gkBigSaveGames++
      if (f.isKeeper && f.goals > 0) c.gkGoals++
      if (state && heroAge(state.hero, state.calendar.season) >= 36) c.veteranGames++
      c.winStreak = f.won ? c.winStreak + 1 : 0
      c.bestWinStreak = Math.max(c.bestWinStreak, c.winStreak)
      return
    }
    case 'drill':
      c.drillsPlayed++
      if (ev.grade === 'S') {
        c.drillsS++
        if (!c.drillKindsS.includes(ev.kind)) c.drillKindsS = [...c.drillKindsS, ev.kind]
      }
      return
    case 'trial':
      if (ev.signed) c.trialsSigned++
      if (ev.signed && ev.kind === 'open') c.openTrialsWon++
      return
    case 'casinoLeave':
      if (ev.net > 0) c.casinoWalkAways++
      return
    case 'records':
      c.clubRecords += Math.max(0, ev.broken)
      return
    case 'newCareer':
      c.careersStarted++
      if (ev.legacy) c.legacyCareers++
      return
    case 'retired': {
      const s = ev.summary
      c.careersRetired++
      if (s.testimonial) c.testimonials++
      if (s.clubs.length === 1 && s.timeline.length >= 10) c.oneClubLegends++
      if (state && state.life.casino.won + state.life.casino.lost === 0) c.neverGambledRetirements++
      c.bestLegacyScore = Math.max(c.bestLegacyScore, s.legacyScore)
      if (s.parentCareerId) c.dynasties++
      return
    }
    case 'tick':
      return
  }
}

/**
 * Process one event: update counters, re-evaluate every achievement and
 * return the ids unlocked by this event (mutates `store`).
 */
export function processAchievementEvent(store: AchStore, ev: AchEvent, state: GameState | null, now = 0): AchievementDef[] {
  store.counters = { ...emptyCounters(), ...store.counters }
  applyEventToCounters(store.counters, ev, state)
  const unlocked: AchievementDef[] = []
  // Two passes so collector achievements see unlocks made in this same event.
  for (let pass = 0; pass < 2; pass++) {
    const ctx: AchContext = { state, c: store.counters, unlockedCount: Object.keys(store.unlocked).length }
    for (const def of ACHIEVEMENTS) {
      let p = 0
      try {
        p = def.progress(ctx)
      } catch {
        p = 0
      }
      if (!Number.isFinite(p)) p = 0
      if (p > (store.best[def.id] ?? 0)) store.best[def.id] = Math.min(p, def.target)
      if (store.unlocked[def.id] === undefined && p >= def.target) {
        store.unlocked[def.id] = now
        unlocked.push(def)
      }
    }
  }
  return unlocked
}

/** View row for the achievements screen. */
export interface AchievementProgress {
  def: AchievementDef
  unlocked: boolean
  unlockedAt: number | null
  progress: number
  /** 0..1 */
  ratio: number
}

export function achievementProgress(store: AchStore): AchievementProgress[] {
  return ACHIEVEMENTS.map((def) => {
    const at = store.unlocked[def.id]
    const progress = at !== undefined ? def.target : Math.min(def.target, store.best[def.id] ?? 0)
    return { def, unlocked: at !== undefined, unlockedAt: at ?? null, progress, ratio: def.target > 0 ? progress / def.target : 0 }
  })
}
