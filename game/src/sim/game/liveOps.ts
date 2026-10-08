/**
 * Local live-ops (GAP 2.10 live-ops / community rows, no backend): a seasonal
 * content calendar with rotating events, a login-free "news of the day" derived
 * from the in-game week, and a milestone timeline merged from the player's own
 * meta. Everything is a pure, seeded function of (season, week) so it is
 * identical on every device and never needs a server or a clock.
 */
import type { LText } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { lt } from '../career/common'
import type { LocalMeta } from './localMeta'
import { CHALLENGES } from './localMeta'
import type { CareerSummary } from './hallOfFame'

export type OpsIcon = 'ball' | 'boot' | 'star' | 'trophy' | 'shield' | 'target' | 'stopwatch' | 'medal' | 'flag' | 'sparkle' | 'crown' | 'history'

export interface SeasonEventDef {
  id: string
  icon: OpsIcon
  title: LText
  desc: LText
}

/** The pool a season draws its calendar from; each season picks {@link EVENT_SLOTS}.length of them. */
export const EVENT_POOL: readonly SeasonEventDef[] = [
  { id: 'openingDay', icon: 'flag', title: lt('Sezon açılışı', 'Opening stretch'), desc: lt('Yeni sezonun ilk haftaları: ilk izlenimi sen bırak.', 'The first weeks of the season: make the first impression.') },
  { id: 'derbyMonth', icon: 'shield', title: lt('Derbi ayı', 'Derby month'), desc: lt('Rakipler sertleşir; kazanılan her görev ekstra damga getirir.', 'Rivals bite harder; every challenge you clear earns a stamp.') },
  { id: 'goalFest', icon: 'ball', title: lt('Gol şöleni', 'Goal feast'), desc: lt('Skorerler ön planda. Gol ve asist görevlerine odaklan.', 'Scorers take the spotlight. Chase goals and assists.') },
  { id: 'ironDefence', icon: 'shield', title: lt('Demir savunma', 'Iron defence'), desc: lt('Kale kapalı tut, kurtarışlar ve temiz sayfalar öne çıkar.', 'Keep it tight: clean sheets and saves matter most.') },
  { id: 'youthWeek', icon: 'sparkle', title: lt('Genç yetenekler', 'Young talent'), desc: lt('Genç oyuncular vitrinde; puan kırarak adını duyur.', 'Youngsters in the window; stand out and be noticed.') },
  { id: 'winterGrind', icon: 'stopwatch', title: lt('Kış maratonu', 'Winter grind'), desc: lt('Yoğun fikstür. Tam 90 dakika oynamak her şeydir.', 'A packed fixture list. Full ninety minutes is everything.') },
  { id: 'cupFever', icon: 'trophy', title: lt('Kupa ateşi', 'Cup fever'), desc: lt('Eleme heyecanı: büyük rakipleri devir.', 'Knockout nerves: topple the big names.') },
  { id: 'springRun', icon: 'boot', title: lt('Bahar koşusu', 'Spring run'), desc: lt('Form zirvesi: seri yakala ve sürdür.', 'Peak form: build a streak and keep it.') },
  { id: 'titleRace', icon: 'crown', title: lt('Şampiyonluk yarışı', 'Title race'), desc: lt('Son düzlüğe girildi; her puan altın değerinde.', 'Final straight: every point is gold.') },
  { id: 'finale', icon: 'medal', title: lt('Sezon finali', 'Season finale'), desc: lt('Son haftalar. Sezonu yüksek notla kapat.', 'The closing weeks. Finish the season on a high.') },
]

/** Inclusive week windows of the calendar (the season has 44 weeks). */
export const EVENT_SLOTS: readonly { start: number; end: number }[] = [
  { start: 0, end: 4 }, { start: 6, end: 10 }, { start: 12, end: 16 }, { start: 18, end: 22 },
  { start: 24, end: 28 }, { start: 30, end: 34 }, { start: 36, end: 40 },
]

export interface SeasonEvent extends SeasonEventDef {
  start: number
  end: number
}

/** The event calendar of one season: a seeded pick and order from the pool, so every season feels different. */
export function seasonCalendar(season: number): SeasonEvent[] {
  const order = new Rng(hashString(`ev|${season}`)).shuffle([...EVENT_POOL])
  return EVENT_SLOTS.map((slot, i) => ({ ...order[i], ...slot }))
}

/** The event running in `week`, or null between events. */
export function eventForWeek(season: number, week: number): SeasonEvent | null {
  return seasonCalendar(season).find((e) => week >= e.start && week <= e.end) ?? null
}

/** The next event that starts after `week` (for the "coming up" row). */
export function nextEvent(season: number, week: number): SeasonEvent | null {
  return seasonCalendar(season).find((e) => e.start > week) ?? null
}

// ───────────────────────── News of the day ─────────────────────────

export interface NewsItem {
  id: string
  icon: OpsIcon
  title: LText
  text: LText
}

const TIPS: readonly { title: LText; text: LText }[] = [
  { title: lt('Dinlenmek de antrenmandır', 'Rest is training too'), text: lt('Yorgun bacaklarla maça çıkmak reytingini düşürür; kondisyon düşükse bir gün dinlen.', 'Tired legs cost rating; if your fitness is low, take a day off.') },
  { title: lt('Menajerin ne ister?', 'What the manager wants'), text: lt('Teknik direktörün güveni, forma süreni belirler. Antrenmanda dişini göster.', 'The manager\'s trust decides your minutes. Impress in training.') },
  { title: lt('Sözleşmeni takip et', 'Watch your contract'), text: lt('Sözleşmenin son yılında teklifler daha cömert gelir ama kulüp seni kaybetmemek için de zorlanır.', 'In the last contract year offers get generous, and your club gets nervous.') },
  { title: lt('Duran toplar fark yaratır', 'Set pieces decide games'), text: lt('Frikik ve penaltı pratiği, kapalı savunmaları açmanın en güvenli yoludur.', 'Free-kick and penalty practice is the surest way to crack a deep defence.') },
  { title: lt('Medya seni izliyor', 'The press is watching'), text: lt('Röportajda söylediğin söz kulübe ve taraftara yansır; sakin kal.', 'What you say in interviews reaches the club and fans. Stay calm.') },
  { title: lt('Gençken potansiyel, yaşlıyken tecrübe', 'Potential when young, craft when old'), text: lt('Gelişim yaşla yavaşlar; kariyerin ikinci yarısında zekâ ve pozisyon bilgisi öne çıkar.', 'Growth slows with age; in your later years, vision and positioning carry you.') },
  { title: lt('Bütçeni tut', 'Mind the budget'), text: lt('Maaşın büyük kısmını harcamak kolay; emeklilik için her sezon küçük bir pay ayır.', 'Spending a big wage is easy; set a little aside every season for retirement.') },
  { title: lt('Kaleci için sabır', 'Patience for keepers'), text: lt('Kalecilik geç olgunlaşır; otuzlu yaşlarda zirve yapabilirsin.', 'Goalkeepers mature late; your peak can come in your thirties.') },
  { title: lt('Takım arkadaşlığı', 'Team chemistry'), text: lt('Soyunma odasında sevilen oyuncu zor haftaları daha kolay atlatır.', 'A well-liked player rides out the rough weeks more easily.') },
  { title: lt('Sakatlık riski', 'Injury risk'), text: lt('Yoğun fikstürde antrenman yükünü azaltmak sakatlık riskini düşürür.', 'Easing the training load in a packed run lowers your injury risk.') },
  { title: lt('Rakibi tanı', 'Know your opponent'), text: lt('Maç öncesi rakibin zayıf yönünü okumak, görev reytingi için en ucuz avantajdır.', 'Reading the opponent\'s weak side before kickoff is the cheapest edge.') },
  { title: lt('Milli takım kapısı', 'The national call'), text: lt('Ligdeki istikrar, milli takım davetinin en güçlü habercisidir.', 'Consistency in the league is the best predictor of a national call-up.') },
]

export interface NewsContext {
  streak: number
  challengeDone: boolean
  challengeId: string
}

/** Up to four items for the current week: event headline, a challenge nudge, a streak line and a seeded tip. */
export function newsOfTheDay(season: number, week: number, ctx: NewsContext): NewsItem[] {
  const out: NewsItem[] = []
  const ev = eventForWeek(season, week)
  const up = nextEvent(season, week)
  if (ev) out.push({ id: `ev:${ev.id}`, icon: ev.icon, title: ev.title, text: lt(`${ev.desc.tr} (${ev.end - week + 1}. hafta sonuna kadar)`, `${ev.desc.en} (${ev.end - week + 1} week(s) left)`) })
  else if (up) out.push({ id: `soon:${up.id}`, icon: 'history', title: lt('Sıradaki etkinlik', 'Coming up'), text: lt(`${up.title.tr}, ${up.start - week} hafta sonra başlıyor.`, `${up.title.en} starts in ${up.start - week} week(s).`) })
  const def = CHALLENGES.find((c) => c.id === ctx.challengeId)
  if (def) {
    out.push(ctx.challengeDone
      ? { id: 'ch:done', icon: 'medal', title: lt('Haftalık görev tamam', 'Weekly challenge cleared'), text: lt('Bu haftanın görevini bitirdin; yeni görev hafta değişince gelir.', 'You cleared this week\'s challenge; the next one lands with the new week.') }
      : { id: 'ch:open', icon: def.icon, title: lt('Bu haftanın görevi', 'This week\'s challenge'), text: lt(`${def.title.tr}: ${def.desc.tr}`, `${def.title.en}: ${def.desc.en}`) })
  }
  if (ctx.streak >= 2) out.push({ id: 'streak', icon: 'star', title: lt('Seri devam ediyor', 'Streak alive'), text: lt(`${ctx.streak} haftalık serindesin; kopmaması için bu hafta da görevi bitir.`, `You are on a ${ctx.streak}-week streak. Clear this week to keep it.`) })
  const tip = TIPS[new Rng(hashString(`news|${season}|${week}`)).int(0, TIPS.length - 1)]
  out.push({ id: `tip:${season}:${week}`, icon: 'sparkle', title: tip.title, text: tip.text })
  return out
}

// ───────────────────────── Milestone timeline ─────────────────────────

export interface Milestone {
  id: string
  /** Sort key: season then week (careers use the last week of their end season). */
  season: number
  week: number
  kind: 'challenge' | 'career' | 'stamps' | 'streak'
  icon: OpsIcon
  title: LText
  detail: LText
}

const STREAK_STEPS = [3, 5, 10, 20] as const

/** The player's own story: cleared challenges, retired careers, event stamps and streak badges, newest first. */
export function milestoneTimeline(m: LocalMeta, careers: readonly CareerSummary[]): Milestone[] {
  const out: Milestone[] = []
  for (const [key, d] of Object.entries(m.challenges)) {
    const [season, week] = key.split(':').map(Number)
    const def = CHALLENGES.find((c) => c.id === d.id)
    out.push({
      id: `ch:${key}`, season, week, kind: 'challenge', icon: def?.icon ?? 'medal',
      title: def?.title ?? lt(d.id, d.id), detail: lt(`${d.opponent} maçında ${d.rating.toFixed(1)}`, `${d.rating.toFixed(1)} vs ${d.opponent}`),
    })
  }
  for (const c of careers) {
    out.push({
      id: `ca:${c.careerId}`, season: c.endSeason, week: 99, kind: 'career', icon: 'crown',
      title: lt(`${c.name} emekli oldu`, `${c.name} retired`), detail: lt(`${c.totals.apps} maç, ${c.totals.goals} gol, ${c.trophies.length} kupa`, `${c.totals.apps} apps, ${c.totals.goals} goals, ${c.trophies.length} trophies`),
    })
  }
  for (const [key, n] of Object.entries(m.stamps)) {
    const [seasonS, id] = key.split(':')
    const season = Number(seasonS)
    const ev = EVENT_POOL.find((e) => e.id === id)
    if (!ev || n < 1) continue
    const slot = seasonCalendar(season).find((e) => e.id === id)
    out.push({
      id: `st:${key}`, season, week: slot?.end ?? 0, kind: 'stamps', icon: ev.icon,
      title: lt(`${ev.title.tr} damgası`, `${ev.title.en} stamp`), detail: lt(`${n} görev etkinlik sırasında tamamlandı`, `${n} challenge(s) cleared during the event`),
    })
  }
  for (const step of STREAK_STEPS) {
    if (m.bestStreak >= step) out.push({ id: `sk:${step}`, season: 0, week: step, kind: 'streak', icon: 'star', title: lt(`${step} haftalık seri`, `${step}-week streak`), detail: lt('En iyi serin bu eşiği aştı', 'Your best streak passed this mark') })
  }
  return out.sort((a, b) => b.season - a.season || b.week - a.week)
}
