/**
 * Perk catalogue (GDD 2.3 "Yetenek Ağacı").
 *
 * A perk point is earned every {@link import('../sim/career/progression').PERK_OVR_STEP}
 * OVR (see career/progression.ts). Each perk carries ONE effect `{key, value}`;
 * systems read the summed value via `perkValue(hero, key)` (career/perks.ts),
 * so several perks may stack the same key (e.g. two `stamina_drain` perks).
 *
 * Effect key conventions (value semantics):
 *  - Fractions (`0.15`) are multiplicative bonuses/reductions: `x * (1 + value)` or `x * (1 - value)`.
 *  - Integers are flat additions on 0..100 meters.
 *  - Keys prefixed `match_` are consumed by the match engine / highlight scenes
 *    (integrator: map them into MatchPlayer modifiers). All others are consumed
 *    by career/life modules in this folder and are already wired.
 *
 * Groups `innate` perks are granted automatically (two-footed foot choice,
 * background) and do NOT cost perk points.
 */
import type { AttributeKey, LText, Position } from '../core/types'

export type PerkGroup =
  | 'finishing' | 'playmaking' | 'dribbling' | 'physical' | 'defending' | 'mental' | 'goalkeeping' | 'lifestyle' | 'innate'

export interface PerkRequirement {
  /** Minimum hero OVR to unlock. */
  minOvr?: number
  /** Minimum attribute values. */
  attrs?: Partial<Record<AttributeKey, number>>
  /** Restrict to these positions (omit = any). */
  positions?: readonly Position[]
  /** Prerequisite perk ids (tree edges). */
  perks?: readonly string[]
  /** Minimum reputation 0..100. */
  minReputation?: number
}

export interface PerkDef {
  id: string
  name: LText
  desc: LText
  group: PerkGroup
  icon: string
  requirement: PerkRequirement
  effect: { key: string; value: number }
  /** Perk point cost (1 by default; capstone perks cost 2). */
  cost: number
}

const OUTFIELD: readonly Position[] = ['CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
const ATTACKERS: readonly Position[] = ['AM', 'LW', 'RW', 'ST', 'CM']
const DEFENDERS: readonly Position[] = ['CB', 'LB', 'RB', 'DM']

export const PERKS: readonly PerkDef[] = [
  // ── Finishing ──────────────────────────────────────────────
  { id: 'finesse_master', group: 'finishing', icon: '🌀', cost: 1,
    name: { tr: 'Plase Uzmanı', en: 'Finesse Master' },
    desc: { tr: 'Plase şutlarda kavis ve isabet %15 artar.', en: 'Finesse shots curl and hit the target 15% more.' },
    requirement: { attrs: { shooting: 60 }, positions: OUTFIELD }, effect: { key: 'match_finesse', value: 0.15 } },
  { id: 'power_shot', group: 'finishing', icon: '💥', cost: 1,
    name: { tr: 'Füze', en: 'Rocket Shot' },
    desc: { tr: 'Uzaktan şutların gücü %12 artar.', en: 'Long-range shots gain 12% power.' },
    requirement: { attrs: { shooting: 62, strength: 55 }, positions: OUTFIELD }, effect: { key: 'match_shot_power', value: 0.12 } },
  { id: 'fox_in_box', group: 'finishing', icon: '🦊', cost: 1,
    name: { tr: 'Ceza Sahası Tilkisi', en: 'Fox in the Box' },
    desc: { tr: 'Ceza sahasında topu alma şansı %10 artar.', en: '10% more chances find you inside the box.' },
    requirement: { attrs: { positioning: 60, finishing: 60 }, positions: ATTACKERS }, effect: { key: 'match_box_presence', value: 0.1 } },
  { id: 'penalty_ice', group: 'finishing', icon: '🧊', cost: 1,
    name: { tr: 'Penaltı Buz Adam', en: 'Ice-Cold Penalties' },
    desc: { tr: 'Penaltıda nişan titremesi %40 azalır.', en: 'Penalty aim wobble reduced by 40%.' },
    requirement: { attrs: { composure: 60 } }, effect: { key: 'match_penalty_steady', value: 0.4 } },
  { id: 'header_king', group: 'finishing', icon: '👑', cost: 1,
    name: { tr: 'Kafa Kralı', en: 'Aerial King' },
    desc: { tr: 'Kafa vuruşlarında isabet %15 artar.', en: 'Headers are 15% more accurate.' },
    requirement: { attrs: { heading: 62, jumping: 58 } }, effect: { key: 'match_header', value: 0.15 } },
  { id: 'chip_artist', group: 'finishing', icon: '🎯', cost: 1,
    name: { tr: 'Aşırtma Sanatçısı', en: 'Chip Artist' },
    desc: { tr: 'Aşırtma vuruşlar kaleciyi daha kolay geçer.', en: 'Chips beat the keeper more easily.' },
    requirement: { attrs: { finishing: 65, composure: 60 }, perks: ['finesse_master'] }, effect: { key: 'match_chip', value: 0.2 } },
  { id: 'clinical', group: 'finishing', icon: '⭐', cost: 2,
    name: { tr: 'Acımasız Bitirici', en: 'Clinical Finisher' },
    desc: { tr: 'Tüm şutlarda ağır çekim nişan süresi %25 uzar.', en: 'Slow-mo aim window lasts 25% longer on every shot.' },
    requirement: { minOvr: 75, attrs: { finishing: 75 }, perks: ['fox_in_box'] }, effect: { key: 'match_aim_time', value: 0.25 } },

  // ── Playmaking ─────────────────────────────────────────────
  { id: 'through_ball', group: 'playmaking', icon: '🪡', cost: 1,
    name: { tr: 'Ara Pas Ustası', en: 'Through-Ball Maestro' },
    desc: { tr: 'Ara pasların isabeti %15 artar.', en: 'Through balls are 15% more accurate.' },
    requirement: { attrs: { passing: 60, vision: 58 } }, effect: { key: 'match_through_ball', value: 0.15 } },
  { id: 'cross_specialist', group: 'playmaking', icon: '🏹', cost: 1,
    name: { tr: 'Orta Uzmanı', en: 'Cross Specialist' },
    desc: { tr: 'Ortaların kafa vuruşuna dönüşme ihtimali artar.', en: 'Crosses find a head more often.' },
    requirement: { attrs: { crossing: 60 } }, effect: { key: 'match_cross', value: 0.15 } },
  { id: 'set_piece_wizard', group: 'playmaking', icon: '🪄', cost: 1,
    name: { tr: 'Duran Top Büyücüsü', en: 'Set-Piece Wizard' },
    desc: { tr: 'Serbest vuruşlarda falso %20 artar.', en: 'Free kicks curl 20% more.' },
    requirement: { attrs: { setPieces: 62 } }, effect: { key: 'match_free_kick', value: 0.2 } },
  { id: 'metronome', group: 'playmaking', icon: '🎼', cost: 1,
    name: { tr: 'Metronom', en: 'Metronome' },
    desc: { tr: 'Kısa pasların başarısı yorgunken düşmez.', en: 'Short passing stays sharp even when tired.' },
    requirement: { attrs: { passing: 65, composure: 55 }, positions: ['DM', 'CM', 'AM'] }, effect: { key: 'match_tired_passing', value: 0.5 } },
  { id: 'long_throw', group: 'playmaking', icon: '🤾', cost: 1,
    name: { tr: 'Uzun Taç', en: 'Long Throw' },
    desc: { tr: 'Taç atışları ceza sahasına kadar ulaşır.', en: 'Throw-ins reach the penalty box.' },
    requirement: { attrs: { strength: 60 }, positions: ['LB', 'RB', 'CB', 'DM'] }, effect: { key: 'match_long_throw', value: 1 } },
  { id: 'vision_genius', group: 'playmaking', icon: '🔭', cost: 2,
    name: { tr: 'Görüş Dehası', en: 'Visionary' },
    desc: { tr: 'Takım arkadaşlarının koşuları radarda gösterilir; asist primi +%10.', en: 'Teammate runs shown on radar; +10% assist chance.' },
    requirement: { minOvr: 75, attrs: { vision: 75 }, perks: ['through_ball'] }, effect: { key: 'match_assist', value: 0.1 } },

  // ── Dribbling ──────────────────────────────────────────────
  { id: 'rabona', group: 'dribbling', icon: '🦵', cost: 1,
    name: { tr: 'Rabona', en: 'Rabona' },
    desc: { tr: 'Zayıf ayakla pas yerine rabona hareketi açılır.', en: 'Unlocks the rabona move instead of weak-foot passes.' },
    requirement: { attrs: { dribbling: 60, agility: 55 } }, effect: { key: 'match_skill_rabona', value: 1 } },
  { id: 'elastico', group: 'dribbling', icon: '🐍', cost: 1,
    name: { tr: 'Elastico', en: 'Elastico' },
    desc: { tr: 'Elastico çalımı açılır; birebirde %10 üstünlük.', en: 'Unlocks the elastico; +10% in one-on-ones.' },
    requirement: { attrs: { dribbling: 65 }, perks: ['rabona'] }, effect: { key: 'match_one_on_one', value: 0.1 } },
  { id: 'close_control', group: 'dribbling', icon: '🧲', cost: 1,
    name: { tr: 'Yapışkan Top', en: 'Close Control' },
    desc: { tr: 'Top sürerken top kaybı %15 azalır.', en: 'Lose the ball 15% less while dribbling.' },
    requirement: { attrs: { firstTouch: 58, dribbling: 58 } }, effect: { key: 'match_ball_retention', value: 0.15 } },
  { id: 'speed_demon', group: 'dribbling', icon: '⚡', cost: 1,
    name: { tr: 'Hız Şeytanı', en: 'Speed Demon' },
    desc: { tr: 'Sprint sırasında top ile hız kaybı %10 azalır.', en: 'Lose 10% less pace when sprinting with the ball.' },
    requirement: { attrs: { pace: 70 } }, effect: { key: 'match_sprint_ball', value: 0.1 } },

  // ── Physical ───────────────────────────────────────────────
  { id: 'marathon', group: 'physical', icon: '🏃', cost: 1,
    name: { tr: 'Maraton', en: 'Marathon Man' },
    desc: { tr: 'Maç ve antrenmanda dayanıklılık kaybı %15 azalır.', en: 'Stamina drain in matches and training reduced by 15%.' },
    requirement: { attrs: { stamina: 60 } }, effect: { key: 'stamina_drain', value: 0.15 } },
  { id: 'iron_body', group: 'physical', icon: '🛡️', cost: 1,
    name: { tr: 'Demir Vücut', en: 'Iron Body' },
    desc: { tr: 'Sakatlanma riski %20 azalır.', en: 'Injury risk reduced by 20%.' },
    requirement: { attrs: { strength: 58 } }, effect: { key: 'injury_resist', value: 0.2 } },
  { id: 'quick_healer', group: 'physical', icon: '🩹', cost: 1,
    name: { tr: 'Çabuk İyileşen', en: 'Quick Healer' },
    desc: { tr: 'Yorgunluk %15 daha hızlı geçer.', en: 'Fatigue clears 15% faster.' },
    requirement: { minOvr: 55 }, effect: { key: 'recovery', value: 0.15 } },
  { id: 'gym_rat', group: 'physical', icon: '🏋️', cost: 1,
    name: { tr: 'Salon Faresi', en: 'Gym Rat' },
    desc: { tr: 'Fiziksel antrenmanlardan %15 fazla XP.', en: '+15% XP from physical training.' },
    requirement: { attrs: { workRate: 55 } }, effect: { key: 'xp_physical', value: 0.15 } },
  { id: 'ageless', group: 'physical', icon: '⏳', cost: 2,
    name: { tr: 'Yaşlanmayan', en: 'Ageless' },
    desc: { tr: '30 yaş sonrası fiziksel düşüş %30 yavaşlar.', en: 'Physical decline after 30 is 30% slower.' },
    requirement: { minOvr: 70, perks: ['iron_body'] }, effect: { key: 'aging_slow', value: 0.3 } },

  // ── Defending ──────────────────────────────────────────────
  { id: 'interceptor', group: 'defending', icon: '✋', cost: 1,
    name: { tr: 'Pas Arası Uzmanı', en: 'Interceptor' },
    desc: { tr: 'Pas arası denemeleri %15 daha başarılı.', en: 'Interceptions succeed 15% more.' },
    requirement: { attrs: { positioning: 58, tackling: 55 }, positions: DEFENDERS }, effect: { key: 'match_intercept', value: 0.15 } },
  { id: 'slide_tackle', group: 'defending', icon: '🛷', cost: 1,
    name: { tr: 'Temiz Kayarak Müdahale', en: 'Clean Slider' },
    desc: { tr: 'Kayarak müdahalelerde faul ihtimali %25 azalır.', en: '25% fewer fouls on slide tackles.' },
    requirement: { attrs: { tackling: 62 } }, effect: { key: 'match_clean_tackle', value: 0.25 } },
  { id: 'aerial_wall', group: 'defending', icon: '🧱', cost: 1,
    name: { tr: 'Hava Hakimi', en: 'Aerial Wall' },
    desc: { tr: 'Savunma kafa toplarında %15 üstünlük.', en: '+15% in defensive aerial duels.' },
    requirement: { attrs: { heading: 60, strength: 60 }, positions: DEFENDERS }, effect: { key: 'match_aerial_def', value: 0.15 } },

  // ── Mental ─────────────────────────────────────────────────
  { id: 'big_game', group: 'mental', icon: '🏟️', cost: 1,
    name: { tr: 'Büyük Maç Oyuncusu', en: 'Big Game Player' },
    desc: { tr: 'Önemli maçlarda soğukkanlılık +8.', en: '+8 composure in important matches.' },
    requirement: { attrs: { composure: 62 }, minReputation: 20 }, effect: { key: 'big_game', value: 8 } },
  { id: 'captain_spirit', group: 'mental', icon: '©️', cost: 1,
    name: { tr: 'Kaptan Ruhu', en: 'Captain Spirit' },
    desc: { tr: 'Takım arkadaşı ilişkileri %25 daha hızlı gelişir; TD güveni artar.', en: 'Teammate bonds grow 25% faster; manager trust rises.' },
    requirement: { attrs: { leadership: 60 } }, effect: { key: 'teammate_bond', value: 0.25 } },
  { id: 'cool_head', group: 'mental', icon: '😌', cost: 1,
    name: { tr: 'Serin Kafa', en: 'Cool Head' },
    desc: { tr: 'Stres artışı %20 azalır.', en: 'Stress gains reduced by 20%.' },
    requirement: { attrs: { composure: 55 } }, effect: { key: 'stress_resist', value: 0.2 } },
  { id: 'student', group: 'mental', icon: '📚', cost: 1,
    name: { tr: 'Taktik Öğrencisi', en: 'Tactics Student' },
    desc: { tr: 'Taktik antrenmanı ve video analizinden %20 fazla XP.', en: '+20% XP from tactical training and video study.' },
    requirement: { attrs: { vision: 50 } }, effect: { key: 'xp_tactical', value: 0.2 } },
  { id: 'fast_learner', group: 'mental', icon: '🧠', cost: 2,
    name: { tr: 'Hızlı Öğrenen', en: 'Fast Learner' },
    desc: { tr: 'Tüm antrenmanlardan %10 fazla XP.', en: '+10% XP from all training.' },
    requirement: { minOvr: 60, perks: ['student'] }, effect: { key: 'xp_all', value: 0.1 } },
  { id: 'managers_pet', group: 'mental', icon: '🤝', cost: 1,
    name: { tr: 'Hocanın Gözdesi', en: "Manager's Favourite" },
    desc: { tr: 'Teknik direktör güveni %20 daha hızlı artar.', en: 'Manager trust grows 20% faster.' },
    requirement: { attrs: { workRate: 60 } }, effect: { key: 'trust_gain', value: 0.2 } },

  // ── Goalkeeping ────────────────────────────────────────────
  { id: 'cat_reflexes', group: 'goalkeeping', icon: '🐈', cost: 1,
    name: { tr: 'Kedi Refleksi', en: 'Cat Reflexes' },
    desc: { tr: 'Refleks kurtarışlarında tepki süresi %12 kısalır.', en: 'Reaction time on reflex saves 12% faster.' },
    requirement: { attrs: { reflexes: 60 }, positions: ['GK'] }, effect: { key: 'match_gk_reaction', value: 0.12 } },
  { id: 'penalty_saver', group: 'goalkeeping', icon: '🧤', cost: 1,
    name: { tr: 'Penaltı Canavarı', en: 'Penalty Stopper' },
    desc: { tr: 'Penaltıda atıcının yönünü okuma şansı +%15.', en: '+15% chance to read the taker.' },
    requirement: { attrs: { reflexes: 62 }, positions: ['GK'] }, effect: { key: 'match_gk_penalty', value: 0.15 } },
  { id: 'sweeper_keeper', group: 'goalkeeping', icon: '🧹', cost: 1,
    name: { tr: 'Libero Kaleci', en: 'Sweeper Keeper' },
    desc: { tr: 'Kale çıkışları ve ayakla oyunda %15 üstünlük.', en: '+15% on rushing out and distribution.' },
    requirement: { attrs: { passing: 50, agility: 55 }, positions: ['GK'] }, effect: { key: 'match_gk_sweeper', value: 0.15 } },

  // ── Lifestyle ──────────────────────────────────────────────
  { id: 'media_darling', group: 'lifestyle', icon: '📸', cost: 1,
    name: { tr: 'Medyanın Gözbebeği', en: 'Media Darling' },
    desc: { tr: 'Takipçi artışı %25 hızlanır.', en: 'Follower growth +25%.' },
    requirement: { minReputation: 15 }, effect: { key: 'followers_gain', value: 0.25 } },
  { id: 'brand_magnet', group: 'lifestyle', icon: '💼', cost: 1,
    name: { tr: 'Marka Mıknatısı', en: 'Brand Magnet' },
    desc: { tr: 'Sponsor teklifleri %15 daha yüksek.', en: 'Sponsor offers 15% higher.' },
    requirement: { minReputation: 25, perks: ['media_darling'] }, effect: { key: 'sponsor_value', value: 0.15 } },
  { id: 'negotiator', group: 'lifestyle', icon: '🗣️', cost: 1,
    name: { tr: 'Sıkı Pazarlıkçı', en: 'Hard Bargainer' },
    desc: { tr: 'Sözleşme pazarlığında kulübün sabrı %25 daha uzun.', en: 'Clubs show 25% more patience in negotiations.' },
    requirement: { minOvr: 55 }, effect: { key: 'negotiation_patience', value: 0.25 } },
  { id: 'night_owl', group: 'lifestyle', icon: '🦉', cost: 1,
    name: { tr: 'Gece Kuşu', en: 'Night Owl' },
    desc: { tr: 'Gece hayatı aktivitelerinin enerji maliyeti %30 azalır.', en: 'Nightlife activities cost 30% less energy.' },
    requirement: {}, effect: { key: 'nightlife_energy', value: 0.3 } },
  { id: 'fan_favourite', group: 'lifestyle', icon: '📣', cost: 1,
    name: { tr: 'Taraftarın Sevgilisi', en: 'Fan Favourite' },
    desc: { tr: 'Taraftar ilişkisi kazanımları %30 artar.', en: 'Fan relationship gains +30%.' },
    requirement: { minReputation: 10 }, effect: { key: 'fan_gain', value: 0.3 } },
  { id: 'poker_face', group: 'lifestyle', icon: '🃏', cost: 1,
    name: { tr: 'Poker Yüzü', en: 'Poker Face' },
    desc: { tr: 'Kumar bağımlılığı %30 daha yavaş artar.', en: 'Gambling addiction builds 30% slower.' },
    requirement: { attrs: { composure: 55 } }, effect: { key: 'addiction_resist', value: 0.3 } },
  { id: 'family_first', group: 'lifestyle', icon: '🏡', cost: 1,
    name: { tr: 'Önce Aile', en: 'Family First' },
    desc: { tr: 'Aile ziyaretleri %30 daha fazla mutluluk verir; ilişkiler yavaş söner.', en: 'Family visits give 30% more happiness; bonds decay slower.' },
    requirement: {}, effect: { key: 'family_bond', value: 0.3 } },

  // ── Innate (free) ──────────────────────────────────────────
  { id: 'two_footed', group: 'innate', icon: '🦶', cost: 0,
    name: { tr: 'İki Ayaklı', en: 'Two-Footed' },
    desc: { tr: 'Zayıf ayak cezası yok.', en: 'No weak-foot penalty.' },
    requirement: {}, effect: { key: 'match_weak_foot', value: 1 } },
  { id: 'street_smart', group: 'innate', icon: '🏙️', cost: 0,
    name: { tr: 'Sokak Zekâsı', en: 'Street Smart' },
    desc: { tr: 'Sokak futbolundan gelen özgüven: stres artışı %10 azalır.', en: 'Street football swagger: stress gains 10% lower.' },
    requirement: {}, effect: { key: 'stress_resist', value: 0.1 } },
  { id: 'academy_discipline', group: 'innate', icon: '🎓', cost: 0,
    name: { tr: 'Akademi Disiplini', en: 'Academy Discipline' },
    desc: { tr: 'Taktik antrenmandan %10 fazla XP.', en: '+10% XP from tactical training.' },
    requirement: {}, effect: { key: 'xp_tactical', value: 0.1 } },
  { id: 'famous_name', group: 'innate', icon: '🧬', cost: 0,
    name: { tr: 'Ünlü Soyadı', en: 'Famous Surname' },
    desc: { tr: 'Futbolcu ailesinden gelirsin: sponsor teklifleri %10 yüksek.', en: 'Football family name: sponsor offers +10%.' },
    requirement: {}, effect: { key: 'sponsor_value', value: 0.1 } },
  { id: 'late_bloomer', group: 'innate', icon: '🌱', cost: 0,
    name: { tr: 'Geç Açan Çiçek', en: 'Late Bloomer' },
    desc: { tr: '25 yaşına kadar gelişim %15 daha hızlı.', en: '15% faster development until age 25.' },
    requirement: {}, effect: { key: 'late_growth', value: 0.15 } },
]

export const PERK_BY_ID: Readonly<Record<string, PerkDef>> = Object.fromEntries(PERKS.map((p) => [p.id, p]))
