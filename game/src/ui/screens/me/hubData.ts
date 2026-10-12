/**
 * "Ben / Me" stats hub: pure data mapping (no Preact) so it can be unit tested.
 *  - Fame level ladder over `hero.reputation` (0..100) with the next threshold.
 *  - "What it affects" lines for every stat the hub shows, taken from docs/SYSTEMS-MAP.md (§1.1–1.3).
 *  - Recent attribute changes from the weekly attribute history.
 *  - Relationship summary per kind (family and teammates averaged).
 */
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes, type LText, type RelationKind, type Relationship } from '../../../core/types'
import type { AttrHistory } from '../../../sim/game/saveHistory'

const L = (tr: string, en: string): LText => ({ tr, en })

/** Avatar backdrop when the hero has no club (= --surface-3; the avatar SVG needs a literal colour). */
export const AVATAR_BG = '#24345a'

// ───────────────────────── Fame ladder ─────────────────────────

/** Lower bound of each fame level (reputation 0..100). Level index = position in this list. */
export const FAME_THRESHOLDS = [0, 15, 30, 45, 60, 75, 90] as const
export const FAME_MAX_LEVEL = FAME_THRESHOLDS.length - 1

export interface FameLevel {
  /** 0..6 */
  level: number
  /** Reputation rounded to an integer. */
  value: number
  /** Lower bound of the current level. */
  floor: number
  /** Reputation needed for the next level; null at the top. */
  next: number | null
  /** 0..1 progress from this level's floor to the next threshold (1 at the top). */
  progress: number
}

export function fameLevel(reputation: number): FameLevel {
  const value = Math.max(0, Math.min(100, Math.round(Number.isFinite(reputation) ? reputation : 0)))
  let level = 0
  for (let i = 0; i < FAME_THRESHOLDS.length; i++) if (value >= FAME_THRESHOLDS[i]!) level = i
  const floor = FAME_THRESHOLDS[level]!
  const next = level < FAME_MAX_LEVEL ? FAME_THRESHOLDS[level + 1]! : null
  const progress = next === null ? 1 : (value - floor) / (next - floor)
  return { level, value, floor, next, progress: Math.max(0, Math.min(1, progress)) }
}

// ───────────────────────── What each stat affects ─────────────────────────

export type HubStatKey =
  | 'reputation' | 'followers' | 'ovr' | 'potential' | 'marketValue' | 'wage' | 'contract' | 'squadRole' | 'awards'
  | 'energy' | 'health' | 'fatigue' | 'form' | 'morale' | 'happiness' | 'stress' | 'sharpness' | 'discipline'
  | 'injury' | 'suspension' | 'addiction' | 'managerTrust'
  | 'money' | 'savings' | 'loan' | 'netWorth' | 'income' | 'assets' | 'businesses' | 'sponsors' | 'trainer' | 'cosmetics'
  | 'achievements' | 'trophies' | 'perks' | 'background'
  | 'attrPhysical' | 'attrTechnical' | 'attrMental' | 'attrGoalkeeping'

/** Short "what it affects" line per stat (docs/SYSTEMS-MAP.md "Okuyanlar → sonuç"). */
export const STAT_EFFECTS: Record<HubStatKey, LText> = {
  reputation: L('Maaş ve piyasa değeri, sponsor teklifleri, takipçi tavanı, transfer ilgisi, milli takım çağrısı.', 'Wage and market value, sponsor offers, follower ceiling, transfer interest, national call-ups.'),
  followers: L('Sponsor imajı ve teklif sıklığı; çok takipçi basın baskısını ve nefret yorumlarını da artırır.', 'Sponsor image and offer frequency; more followers also mean more press pressure and hate comments.'),
  ovr: L('Takımdaki rolün ve ilk 11 şansın, transfer ilgisi, maaş, milli çağrı.', 'Your squad role and starting chance, transfer interest, wage, national call-ups.'),
  potential: L('Gelişiminin tavanı: OVR\'ın en fazla nereye çıkabileceğinin gözlemci tahmini.', 'Your growth ceiling: the scouts\' estimate of how high your OVR can climb.'),
  marketValue: L('Transfer bedeli ve sözleşme pazarlığındaki gücün.', 'Your transfer fee and your leverage in contract talks.'),
  wage: L('Haftalık gelirin; borç ve birikim üzerinden mutluluk ve stresi etkiler.', 'Your weekly income; through debt and savings it moves happiness and stress.'),
  contract: L('Maaş, ilk 11 tabanı ve maddeler (form, süre, sigorta).', 'Wage, starting-XI floor and clauses (form, minutes, insurance).'),
  squadRole: L('İlk 11 tabanı; kaptanlık liderlik XP\'si ve takım uyumu getirir.', 'Your starting-XI floor; the captaincy adds leadership XP and team cohesion.'),
  awards: L('Şöhret, sözleşme pazarlığı (ödül başına +%3) ve sponsor teklifleri.', 'Fame, contract talks (+3% per award) and sponsor offers.'),
  energy: L('Aktivite kilidi; maç günü 40\'ın altındaysa maça yorgun başlarsın.', 'Locks activities; below 40 on match day you start the match tired.'),
  health: L('Enerji tavanı, antrenman ve maç sakatlık riski.', 'Energy ceiling, training and match injury risk.'),
  fatigue: L('60 üstü rotasyon, antrenman XP verimi, sakatlık riski; 40 üstü maça yorgun başlama.', 'Above 60 you get rotated; training XP, injury risk; above 40 you start matches tired.'),
  form: L('İlk 11 şansı (±%12), maç anı sayısı, piyasa değeri, transfer ilgisi, milli çağrı.', 'Starting chance (±12%), number of match moments, market value, transfer interest, call-ups.'),
  morale: L('Mutluluk hedefi ve maç içi kararlar.', 'Your happiness target and in-match decisions.'),
  happiness: L('Maçta soğukkanlılık, stres ve antrenman XP\'si.', 'Composure in matches, stress and training XP.'),
  stress: L('Soğukkanlılık, tükenmişlik, sağlık erimesi, antrenman ve maç sakatlık riski.', 'Composure, burnout, health decay, training and match injury risk.'),
  sharpness: L('İlk 11 (40 altı −%10); 55 altı maçta özelliklerin %6\'ya kadar düşer.', 'Starting XI (below 40: −10%); below 55 your attributes drop up to 6% in matches.'),
  discipline: L('Hoca güveni, sponsorlar, taraftar; 40 altı ilk 11 ve milli çağrı şansı düşer.', 'Coach trust, sponsors, fans; below 40 your starting and call-up chances drop.'),
  injury: L('Oynayamazsın; mutluluk, moral ve sağlık düşer, özellikler erir, milli çağrı zorlaşır.', 'You cannot play; happiness, morale and health fall, attributes decay, call-ups get harder.'),
  suspension: L('Ceza bitene kadar maçlarda oynayamazsın.', 'You sit out matches until the ban is served.'),
  addiction: L('Stres, form, disiplin ve yakınlarınla ilişkiler; maç öncesi gece seçilme şansını düşürür.', 'Stress, form, discipline and your loved ones; a night out before a match costs selection.'),
  managerTrust: L('Rol merdiveni, ilk 11 (±%8), kenara alınma riski, sözleşme yenileme (30 altı yok).', 'Role ladder, starting XI (±8%), being dropped, renewals (none below 30).'),
  money: L('Satın alma kilitleri; borç mutluluğu düşürür, stresi artırır.', 'Purchase locks; debt lowers happiness and raises stress.'),
  savings: L('Faiz kazandırır; iflas koruması ve net servet.', 'Earns interest; bankruptcy cushion and net worth.'),
  loan: L('Haftalık taksit; borç stresi artırır, mutluluğu düşürür.', 'Weekly repayments; debt raises stress and lowers happiness.'),
  netWorth: L('Varlıkların toplamı: emeklilik ve Onur Listesi için birikimin.', 'Everything you own: your nest egg for retirement and the Hall of Fame.'),
  income: L('Maaş ve sponsorlardan haftalık giriş.', 'Weekly money in from wages and sponsors.'),
  assets: L('Pasif mutluluk, bakım gideri, sponsor imajı, uyku kalitesi; ev aileyi, gösteriş takipçiyi artırır.', 'Passive happiness, upkeep, sponsor image, sleep quality; a home pleases family, luxury brings followers.'),
  businesses: L('Haftalık gelir ve net servet; zarar haftası stres getirir.', 'Weekly income and net worth; a losing week brings stress.'),
  sponsors: L('Haftalık gelir ve performans primi; ahlak maddesi disiplini izler.', 'Weekly income and performance bonus; the morals clause watches your discipline.'),
  trainer: L('Seçtiği özellik grubunda ekstra antrenman XP\'si.', 'Extra training XP in the chosen attribute group.'),
  cosmetics: L('Yalnızca görünüm: istatistik ya da sonuç değiştirmez.', 'Looks only: never changes stats or results.'),
  achievements: L('Kariyerler arası meta ilerleme; dünyada sonucu yoktur.', 'Meta progress across careers; no effect inside the world.'),
  trophies: L('Şöhret, Onur Listesi ve Legacy.', 'Fame, the Hall of Fame and your Legacy.'),
  perks: L('Kalıcı bonuslar: maç, antrenman ve yaşamda.', 'Permanent bonuses on the pitch, in training and in life.'),
  background: L('Başlangıç özellikleri ve doğuştan gelen yetenek.', 'Starting attributes and your innate trait.'),
  attrPhysical: L('Sakatlık direnci, toparlanma, ikili mücadele ve hız koşuları.', 'Injury resistance, recovery, duels and sprints.'),
  attrTechnical: L('Pas, şut, dribbling: maç anlarının sonucu ve OVR.', 'Passing, shooting, dribbling: how match moments turn out, and OVR.'),
  attrMental: L('Karar anları, pozisyon, kaptanlık şartı ve OVR.', 'Decision moments, positioning, captaincy and OVR.'),
  attrGoalkeeping: L('Kalecilerde kurtarış ve oyun kurma; diğer mevkilerde etkisi yok.', 'Saves and distribution for keepers; no effect at other positions.'),
}

/** Per relationship kind (SYSTEMS-MAP §1.3). */
export const RELATION_EFFECTS: Record<RelationKind | 'family', LText> = {
  manager: L('Hoca güveninin sürüklenmesi, kaptanlık şartı, röportaj tonu.', 'Drift of coach trust, captaincy, interview tone.'),
  teammate: L('Pas ağı ve asistler, takım uyumu ve morali; yalnızlık stresi.', 'Passing network and assists, team cohesion and morale; loneliness stress.'),
  fans: L('Nefret yorumları, kriz haftası, transfer tepkisi.', 'Hate comments, crisis weeks, reaction to transfers.'),
  family: L('Yakın çevre ruh hali → mutluluk → maçta soğukkanlılık.', 'Inner-circle mood → happiness → composure on the pitch.'),
  mother: L('Yakın çevre ruh hali → mutluluk.', 'Inner-circle mood → happiness.'),
  father: L('Yakın çevre ruh hali → mutluluk.', 'Inner-circle mood → happiness.'),
  sibling: L('Yakın çevre ruh hali → mutluluk.', 'Inner-circle mood → happiness.'),
  partner: L('Yakın çevre (×2 ağırlık); −30 altı kriz haftalık stres getirir.', 'Inner circle (×2 weight); a crisis below −30 adds weekly stress.'),
  bestFriend: L('Yakın çevre, kriz haftası desteği, takım arkadaşıysa pas bonusu.', 'Inner circle, crisis support, a passing bonus if he is a teammate.'),
  agent: L('Sözleşme pazarlık marjı (±%4) ve kulübün sabrı.', 'Contract bargaining margin (±4%) and the club\'s patience.'),
  press: L('−30 altı haftalık stres; 40 üstü az da olsa şöhret.', 'Below −30 weekly stress; above 40 a little fame.'),
  chairman: L('Olaylar ve sözleşme yenilemede pazarlık marjı (±%5).', 'Events and the renewal bargaining margin (±5%).'),
}

// ───────────────────────── Attributes ─────────────────────────

/**
 * Change per attribute over the last `weeks` weekly samples (current value minus the sample `weeks` back,
 * or the oldest sample when the history is shorter). All zero without at least one earlier sample.
 */
export function recentAttrDeltas(hist: AttrHistory | undefined, now: Attributes, weeks = 4): Record<AttributeKey, number> {
  const out = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Record<AttributeKey, number>
  if (!hist || hist.rows.length < 2) return out
  const row = hist.rows[Math.max(0, hist.rows.length - 1 - weeks)]!
  hist.keys.forEach((k, i) => {
    const then = row[2 + i]
    if (ATTRIBUTE_KEYS.includes(k) && typeof then === 'number' && Number.isFinite(then)) out[k] = Math.round(now[k] - then)
  })
  return out
}

// ───────────────────────── Relationships ─────────────────────────

export type RelationRowKind = 'manager' | 'teammate' | 'fans' | 'family' | 'partner' | 'bestFriend' | 'agent' | 'press' | 'chairman'
export const RELATION_ROWS: readonly RelationRowKind[] = ['manager', 'teammate', 'fans', 'family', 'partner', 'bestFriend', 'agent', 'press', 'chairman']

export interface RelationRow {
  kind: RelationRowKind
  /** -100..100 (rounded mean for grouped kinds); null when nobody of that kind exists. */
  value: number | null
  /** People behind the row (teammates, family members). */
  count: number
  /** Single person's name (partner, agent…), when there is exactly one. */
  name: string | null
}

const FAMILY: ReadonlySet<RelationKind> = new Set<RelationKind>(['mother', 'father', 'sibling'])

export function relationRows(rels: Record<string, Relationship> | undefined): RelationRow[] {
  const list = Object.values(rels ?? {})
  return RELATION_ROWS.map((kind) => {
    const people = list.filter((r) => (kind === 'family' ? FAMILY.has(r.kind) : r.kind === kind))
    const value = people.length ? Math.round(people.reduce((s, r) => s + r.value, 0) / people.length) : null
    return { kind, value, count: people.length, name: people.length === 1 ? people[0]!.name : null }
  })
}
