/**
 * Achievements → the career (owner principle: everything is one whole). The
 * global achievement store (achievements.ts) is meta progress that survives
 * careers; this module keeps a SECOND, per-career store in the save so that a
 * feat earned in THIS career has a modest in-game echo:
 *
 *  - a one-off bump when it is earned: a little fame (with diminishing returns,
 *    {@link fameGain}), followers, press/fans goodwill, the manager's trust or
 *    morale, and for headline feats a few weeks of brand attention
 *    (`ach:spotlight`, read by life/echoes `echoSponsor`);
 *  - situational composure the hero has *proven* (a scored penalty steadies the
 *    next one, a final goal steadies big nights): +1..+4 composure points in
 *    that kind of moment only, far below one perk (+6);
 *  - Hall of Fame weight: 3 legacy points per career achievement (max 45).
 *
 * No power creep: no XP, no attributes, nothing that compounds; meta and
 * collection achievements (retire, dynasty, collector…) have no in-career
 * effect. Fed by the UI bridge (ui/backend/meta.ts) with the same events as the
 * global store; pure and deterministic given those events.
 */
import type { GameState, LText } from '../../core/types'
import type { HighlightKind } from '../match/types'
import { absWeek, clamp, fameGain, fill, lt, meter, pushLog } from '../career/common'
import { changeRelation } from '../life/relationships'
import { addStress } from '../life/wellbeing'
import { IN_CONTROL_RESIST, SPOTLIGHT_FLAG } from '../life/echoes'
import { ACHIEVEMENT_BY_ID, emptyAchStore, processAchievementEvent, type AchEvent, type AchStore, type AchievementDef } from './achievements'

/** life.flags key: JSON per-career achievement store. */
export const CAREER_ACH_FLAG = 'c:ach'
/** life.flags key prefix: `ach:<id>` = absolute week the achievement was earned in this career. */
export const ACH_PREFIX = 'ach:'

export interface AchEffect {
  /** Reputation (before diminishing returns). */
  rep?: number
  /** Followers, fraction. */
  followers?: number
  press?: number
  fans?: number
  /** Weeks of brand attention (sponsor offer chance +0.03). */
  spotlight?: number
  trust?: number
  morale?: number
  /** Negative = calmer. */
  stress?: number
  /** Composure points in that kind of moment for the rest of the career. */
  kinds?: Partial<Record<HighlightKind, number>>
  /** Composure points in big matches (importance ≥ 0.7). */
  bigGame?: number
  /** Gambling-urge gains × (1 − this). */
  addictionResist?: number
  /** What the player reads in the log. */
  note: LText
}

const E = (note: LText, e: Omit<AchEffect, 'note'>): AchEffect => ({ ...e, note })

/** Achievement id → its in-career echo. Missing ids are meta-only. */
export const ACHIEVEMENT_EFFECTS: Readonly<Record<string, AchEffect>> = {
  first_goal: E(lt('İlk golün sosyal medyada dolaştı.', 'Your first goal went round social media.'), { followers: 0.01 }),
  goals_50: E(lt('Elli gol: adın gol listelerinde.', 'Fifty goals: your name is on the scoring lists.'), { rep: 0.5, followers: 0.02 }),
  goals_100: E(lt('Yüzüncü gol manşetlerde; markalar arıyor.', 'Your hundredth goal made the headlines; brands are calling.'), { rep: 1, followers: 0.03, press: 1, spotlight: 4 }),
  goals_250: E(lt('250 gol: bir dönemin golcüsü.', '250 goals: the striker of an era.'), { rep: 1.5, followers: 0.04, spotlight: 6 }),
  goals_500: E(lt('500 gol: tarih kitaplarında.', '500 goals: in the history books.'), { rep: 2, followers: 0.05, spotlight: 8 }),
  assists_50: E(lt('Elli asist: takım arkadaşların sana borçlu.', 'Fifty assists: your teammates owe you.'), { rep: 0.5 }),
  assists_150: E(lt('Asist kralı: oyun kurucuların arasında anılıyorsun.', 'King of assists: you are named among the great creators.'), { rep: 1, spotlight: 4 }),
  apps_100: E(lt('Yüzüncü maç: tribün adını biliyor.', 'Your hundredth match: the stands know your name.'), { fans: 1 }),
  apps_300: E(lt('300 maç: hoca sana güveniyor, tribün de.', '300 matches: the manager trusts you, so do the stands.'), { fans: 2, trust: 2 }),
  apps_500: E(lt('500 maç: yaşayan bir abide.', '500 matches: a living monument.'), { fans: 3, press: 2 }),
  motm_10: E(lt('On kez maçın adamı: markalar fark etti.', 'Ten player-of-the-match awards: the brands noticed.'), { rep: 0.5, spotlight: 4 }),
  ovr_80: E(lt('Dünya klası: gazeteler seni yazıyor.', 'World class: the papers are writing about you.'), { rep: 0.5, spotlight: 4 }),
  ovr_90: E(lt('Fenomen: herkes seni konuşuyor.', 'Phenomenon: everyone is talking about you.'), { rep: 1, spotlight: 8 }),
  young_star: E(lt('Harika çocuk: basın gözünü sana dikti.', 'Wonderkid: the press has its eye on you.'), { press: 2, spotlight: 4 }),
  first_trophy: E(lt('İlk kupa: soyunma odasında moral tavan.', 'First trophy: morale through the roof.'), { fans: 2, morale: 3 }),
  trophies_10: E(lt('On kupa: kazanan oyuncu imajı.', 'Ten trophies: the image of a winner.'), { rep: 1, spotlight: 6 }),
  first_award: E(lt('İlk bireysel ödülün: adın konuşuluyor.', 'Your first individual award: people are talking.'), { press: 1, spotlight: 4 }),
  golden_star: E(lt('Altın Yıldız: dünya seni konuşuyor, markalar sırada.', 'Golden Star: the world talks about you, brands queue up.'), { rep: 2, followers: 0.05, press: 3, spotlight: 8 }),
  golden_boot: E(lt('Gol kralı: kalecilerin kâbusu, markaların gözdesi.', 'Golden Boot: keepers fear you, brands want you.'), { rep: 1, press: 2, spotlight: 6 }),
  national_call: E(lt('Milli forma: memleket seninle gurur duyuyor.', 'The national shirt: the country is proud of you.'), { fans: 2 }),
  caps_50: E(lt('Elli milli maç: milli takımın emektarı.', 'Fifty caps: a servant of the national team.'), { rep: 1, fans: 2 }),
  int_goals_20: E(lt('Milli takımda 20 gol: millî kahraman.', 'Twenty international goals: a national hero.'), { rep: 1, fans: 3 }),
  star_role: E(lt('Takımın yıldızısın: özgüvenin yerinde.', 'You are the main man: your confidence is high.'), { morale: 2 }),
  big_club: E(lt('Dev kulübe imza: takipçin patladı.', 'Signing for a giant: your followers exploded.'), { followers: 0.02 }),
  seasons_10: E(lt('On sezon: tribün seni ailesinden sayıyor.', 'Ten seasons: the stands treat you as family.'), { fans: 2 }),
  hat_trick: E(lt('Hat-trick: kalecinin karşısında artık daha sakinsin.', 'Hat-trick: you are calmer one-on-one with the keeper now.'), { followers: 0.02, press: 1, morale: 3, kinds: { one_on_one: 1 } }),
  hat_tricks_5: E(lt('Beş hat-trick: markalar seni seviyor.', 'Five hat-tricks: the brands love you.'), { rep: 0.5, spotlight: 4 }),
  four_goals: E(lt('Bir maçta dört gol: herkes o maçı konuşuyor.', 'Four in one match: everyone is talking about it.'), { followers: 0.03, press: 2, spotlight: 4 }),
  free_kick_goal: E(lt('İlk frikik golün: topun başına daha sakin geçiyorsun.', 'Your first free-kick goal: you step up calmer now.'), { kinds: { freekick: 1 } }),
  free_kicks_10: E(lt('Frikik uzmanı: duvarın karşısında soğukkanlısın.', 'Dead-ball specialist: ice-cool in front of the wall.'), { spotlight: 4, kinds: { freekick: 3 } }),
  penalty_goal: E(lt('Penaltıdan gol attın: bir sonrakinde elin titremeyecek.', 'You scored from the spot: your nerve will hold next time.'), { kinds: { penalty: 2 } }),
  header_goal: E(lt('Kafa golü: havadaki toplara daha cesur gidiyorsun.', 'A headed goal: you attack the high balls more boldly.'), { kinds: { header: 1 } }),
  perfect_game: E(lt('Kusursuz maç: basın övgü yağdırıyor.', 'A perfect game: the press is full of praise.'), { press: 2, spotlight: 4 }),
  three_assists: E(lt('Bir maçta üç asist: takım arkadaşların sana pas için yarışıyor.', 'Three assists in a match: your teammates fight to give you the ball.'), { press: 1, morale: 2 }),
  final_goal: E(lt('Finalde gol: büyük gecelerde elin titremiyor.', 'A goal in a final: your nerve holds on big nights.'), { bigGame: 1 }),
  giant_killer: E(lt('Dev avcısı: büyük rakipler gözünü korkutmuyor.', 'Giant killer: big opponents don\'t scare you.'), { fans: 2, bigGame: 1 }),
  win_streak_5: E(lt('Beş maçlık galibiyet serisi: moral yüksek.', 'A five-match winning run: spirits are high.'), { morale: 3 }),
  veteran: E(lt('36 yaşında sahada: basın saygıyla yazıyor.', 'On the pitch at 36: the press writes with respect.'), { press: 1 }),
  gk_clean_sheet: E(lt('İlk gol yemediğin maç: birebirlerde daha sakinsin.', 'Your first clean sheet: calmer in one-on-ones.'), { kinds: { gk_1v1: 1 } }),
  gk_clean_sheets_25: E(lt('25 maçta gol yok: hoca kaleyi sana emanet ediyor.', 'Twenty-five clean sheets: the manager trusts you with the goal.'), { trust: 2 }),
  gk_wall: E(lt('Aşılmaz duvar: forvetler karşında tereddüt ediyor.', 'The wall: strikers hesitate against you.'), { press: 1, spotlight: 4, kinds: { gk_1v1: 2 } }),
  gk_goal: E(lt('Golcü kaleci: video dünyayı dolaştı.', 'The goalscoring keeper: the clip went round the world.'), { followers: 0.05, press: 3, spotlight: 6 }),
  followers_100k: E(lt('100 bin takipçi: markalar DM kutunda.', '100K followers: brands are in your DMs.'), { spotlight: 4 }),
  followers_1m: E(lt('1 milyon takipçi: küresel bir yüz oldun.', 'A million followers: you are a global face.'), { spotlight: 6 }),
  first_home: E(lt('Kendi evin: kafan daha rahat.', 'A home of your own: your mind is at ease.'), { stress: -2 }),
  walk_away: E(lt('Kârdayken kalktın: kendine güvenin arttı.', 'You quit while ahead: your self-control grew.'), { stress: -1 }),
  in_control: E(lt('Kontrol sende: kumar dürtüleri sana daha az işliyor.', 'In control: gambling urges get to you less.'), { addictionResist: IN_CONTROL_RESIST }),
  professional: E(lt('Örnek profesyonel: hoca da markalar da fark etti.', 'Model professional: the manager and the brands noticed.'), { trust: 3, spotlight: 6 }),
  drill_s: E(lt('Antrenmanda S notu: hoca not aldı.', 'An S grade in training: the manager took note.'), { trust: 1 }),
  drill_s_10: E(lt('Antrenman canavarı: hoca sana güveniyor.', 'Training monster: the manager trusts you.'), { trust: 2 }),
  drill_all_s: E(lt('Çok yönlü: her drilde en iyisi.', 'All-rounder: the best in every drill.'), { trust: 2 }),
  drills_100: E(lt('Ter döken: yüz antrenman oyunu.', 'Hard worker: a hundred training drills.'), { trust: 2 }),
  trial_star: E(lt('Seçmeden yıldız: tribün hikâyeni seviyor.', 'From trial to star: the stands love your story.'), { fans: 2 }),
  record_breaker: E(lt('Kulüp rekoru: tarih yazdın.', 'A club record: you made history.'), { rep: 0.5, press: 2, fans: 2 }),
}

/** Per-career store (parsed from the save). */
export function careerAchStore(state: GameState): AchStore {
  const raw = state.life.flags[CAREER_ACH_FLAG]
  if (typeof raw !== 'string') return emptyAchStore()
  try {
    const v = JSON.parse(raw) as AchStore
    return { ...emptyAchStore(), ...v, counters: { ...emptyAchStore().counters, ...v.counters } }
  } catch {
    return emptyAchStore()
  }
}

/**
 * Feed one achievement event into the per-career store (same events as the
 * global one). Newly earned achievements apply their echo; returns them.
 */
export function careerAchievementEvent(state: GameState, ev: AchEvent): AchievementDef[] {
  if (state.hero.retired && ev.type !== 'retired') return []
  // A save from before this system: what was already earned is recorded quietly (no burst of bumps).
  const silent = typeof state.life.flags[CAREER_ACH_FLAG] !== 'string' && state.hero.careerStats.apps > 0
  const store = careerAchStore(state)
  const fresh = processAchievementEvent(store, ev, state, 0)
  state.life.flags[CAREER_ACH_FLAG] = JSON.stringify(store)
  for (const d of fresh) applyAchievementEcho(state, d.id, silent)
  return fresh
}

/** Apply the one-off part of an achievement's echo and remember it (idempotent). */
export function applyAchievementEcho(state: GameState, id: string, silent = false): boolean {
  const { hero, life, calendar: cal } = state
  const key = `${ACH_PREFIX}${id}`
  if (life.flags[key] !== undefined) return false
  const w = absWeek(cal)
  life.flags[key] = w
  const e = ACHIEVEMENT_EFFECTS[id]
  if (!e || silent) return true
  const def = ACHIEVEMENT_BY_ID[id]
  const why = def ? fill(lt('Başarım: {n}', 'Achievement: {n}'), { n: def.name }) : lt('Başarım', 'Achievement')
  const o = { week: w, cause: 'other' as const, why }
  if (e.rep) hero.reputation = clamp(hero.reputation + fameGain(hero.reputation, e.rep), 0, 100)
  if (e.followers) life.followers = Math.round(life.followers * (1 + e.followers))
  if (e.press) changeRelation(life, 'press', e.press, o)
  if (e.fans) changeRelation(life, 'fans', e.fans, { ...o, hero })
  if (e.trust && !hero.retired) hero.managerTrust = clamp(hero.managerTrust + e.trust, 0, 100)
  if (e.morale) hero.morale = meter(hero.morale + e.morale)
  if (e.stress) addStress(life, hero, e.stress)
  if (e.spotlight) {
    const cur = life.flags[SPOTLIGHT_FLAG]
    life.flags[SPOTLIGHT_FLAG] = Math.max(typeof cur === 'number' ? cur : 0, e.spotlight)
  }
  if (def) pushLog(life, cal, fill(lt('🏵️ {n}: {t}', '🏵️ {n}: {t}'), { n: def.name, t: e.note }), 'career', '🏵️')
  return true
}

/** Achievement ids earned in this career. */
export function careerAchievements(life: GameState['life']): string[] {
  return Object.keys(life.flags).filter((k) => k.startsWith(ACH_PREFIX)).map((k) => k.slice(ACH_PREFIX.length))
}

/** Situational composure the hero has proven in this career (match setup). */
export function achievementMatchBonus(life: GameState['life'], importance = 0): { composure: number; kinds: Partial<Record<HighlightKind, number>> } {
  let composure = 0
  const kinds: Partial<Record<HighlightKind, number>> = {}
  for (const id of careerAchievements(life)) {
    const e = ACHIEVEMENT_EFFECTS[id]
    if (!e) continue
    if (e.bigGame && importance >= 0.7) composure += e.bigGame
    for (const [k, v] of Object.entries(e.kinds ?? {}) as [HighlightKind, number][]) kinds[k] = (kinds[k] ?? 0) + v
  }
  return { composure, kinds }
}

/** Hall of Fame weight of the career's achievements: 3 each, at most 45. */
export const careerAchievementLegacy = (life: GameState['life']): number => Math.min(45, careerAchievements(life).length * 3)
