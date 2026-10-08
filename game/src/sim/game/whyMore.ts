/**
 * More "Why?" panels (2.7#83): why a club's interest is where it is (a refusal
 * to bid included), why sponsor offers are what they are, and why the Golden
 * Star went elsewhere. Every panel lists the three biggest factors with a
 * percentage share; shares always sum to 100 over the listed factors.
 */
import type { GameState, LText } from '../../core/types'
import { clamp, lt } from '../career/common'
import { heroOvr, potentialStars } from '../career/progression'
import { TRANSFER_REQUEST_FLAG } from '../career/transfers'
import { MAX_ACTIVE_SPONSORS, BRANDS } from '../life/sponsors'
import { perkValue } from '../career/perks'
import type { GoldenStarResult } from '../world/worldTypes'
import { clubContextOf } from './internal'

export interface WhyRow {
  key: string
  label: LText
  /** Share of the total effect, 0..100 (rows sum to 100). */
  share: number
  /** Direction for the hero: helps, hurts, or neutral. */
  tone: 'pos' | 'neg' | 'neutral'
  /** The player can change this within a few weeks. */
  actionable: boolean
}

export interface Why {
  title: LText
  rows: WhyRow[]
}

type Raw = { key: string; label: LText; value: number; actionable: boolean }

/** Top `n` factors by magnitude, with integer shares that sum to 100. */
export function topShares(raw: Raw[], n = 3): WhyRow[] {
  const top = raw.filter((r) => Math.abs(r.value) > 1e-9).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, n)
  const total = top.reduce((s, r) => s + Math.abs(r.value), 0)
  if (total === 0) return []
  const shares = top.map((r) => Math.floor((Math.abs(r.value) / total) * 100))
  let left = 100 - shares.reduce((a, b) => a + b, 0)
  for (let i = 0; left > 0; i = (i + 1) % shares.length, left--) shares[i]++
  return top.map((r, i) => ({ key: r.key, label: r.label, share: shares[i], tone: r.value > 0 ? 'pos' : 'neg', actionable: r.actionable }))
}

/** Why `clubId` watches the hero at the level it does (same terms as the scouting model, without the noise). */
export function whyInterest(state: GameState, clubId: string): Why | null {
  if (!state.world.clubs[clubId]) return null
  const h = state.hero
  const ctx = clubContextOf(state, clubId)
  const ovr = heroOvr(h)
  const d = ovr - (ctx.squadAvgOvr - 1)
  const fit = d >= 0 ? Math.min(25, d * 2) : d * 8
  const fame = clamp((h.reputation - 0.6 * ctx.reputation) * 0.3, -15, 15)
  const age = state.calendar.season - h.birthYear
  const youth = age <= 21 ? (potentialStars(h.potential) - 2.5) * 8 : 0
  const form = (h.form - 50) * 0.3
  const requested = state.life.flags[TRANSFER_REQUEST_FLAG] !== undefined ? 10 : 0
  const raw: Raw[] = [
    { key: 'fit', label: lt(`Seviye uyumu (GEN ${Math.round(ovr)}, kadro ort. ${Math.round(ctx.squadAvgOvr)})`, `Level fit (OVR ${Math.round(ovr)}, squad avg ${Math.round(ctx.squadAvgOvr)})`), value: fit, actionable: false },
    { key: 'fame', label: lt('Şöhret ve kulüp büyüklüğü', 'Fame versus club size'), value: fame, actionable: false },
    { key: 'youth', label: lt('Genç yetenek primi', 'Young-talent premium'), value: youth, actionable: false },
    { key: 'form', label: lt('Son haftaların formu', 'Recent form'), value: form, actionable: true },
    { key: 'request', label: lt('Transfer talebin', 'Your transfer request'), value: requested, actionable: true },
  ]
  return { title: lt('Bu ilgi neden bu düzeyde?', 'Why is the interest at this level?'), rows: topShares(raw) }
}

/** Why the sponsor market looks the way it does for the hero. */
export function whySponsors(state: GameState): Why {
  const h = state.hero
  const l = state.life
  const unlocked = BRANDS.filter((b) => b.minReputation <= h.reputation).length
  const slotsFull = l.sponsors.length >= MAX_ACTIVE_SPONSORS
  const raw: Raw[] = [
    { key: 'rep', label: lt(`İtibar ${Math.round(h.reputation)}: ${unlocked}/${BRANDS.length} marka kilidi açık`, `Reputation ${Math.round(h.reputation)}: ${unlocked}/${BRANDS.length} brands unlocked`), value: 0.055 * clamp(h.reputation, 0, 100), actionable: false },
    { key: 'followers', label: lt(`Takipçi ${Math.round(l.followers).toLocaleString('tr-TR')}`, `Followers ${Math.round(l.followers).toLocaleString('en-GB')}`), value: Math.log(1 + clamp(Math.log10(Math.max(1, l.followers) / 10000), 0, 3) * 0.25), actionable: true },
    { key: 'perks', label: lt('Sponsor yeteneği', 'Sponsor perk'), value: Math.log(1 + perkValue(h, 'sponsor_value')), actionable: true },
    { key: 'slots', label: slotsFull ? lt('Tüm sponsor yuvaları dolu', 'All sponsor slots are full') : lt('Boş yuva var', 'Open sponsor slots'), value: slotsFull ? -0.5 : 0, actionable: true },
  ]
  return { title: lt('Sponsor teklifleri neden böyle?', 'Why are sponsor offers like this?'), rows: topShares(raw) }
}

/** Why the Golden Star went to someone else: the biggest score-part gaps to the winner. */
export function whyAward(star: GoldenStarResult): Why | null {
  const winner = star.ranking[0]
  const me = star.ranking.find((c) => c.isHero)
  if (!winner || winner.isHero) return null
  const mine = me?.parts ?? { league: 0, continental: 0, international: 0, trophies: 0 }
  const gap = (k: keyof typeof mine): number => mine[k] - winner.parts[k]
  const raw: Raw[] = [
    { key: 'league', label: lt('Lig performansı', 'League performance'), value: gap('league'), actionable: true },
    { key: 'continental', label: lt('Kıtasal turnuvalar', 'Continental competitions'), value: gap('continental'), actionable: true },
    { key: 'international', label: lt('Milli takım', 'International duty'), value: gap('international'), actionable: true },
    { key: 'trophies', label: lt('Kupalar', 'Trophies'), value: gap('trophies'), actionable: true },
  ]
  return { title: lt(`${winner.name} neden öne geçti?`, `Why did ${winner.name} come out ahead?`), rows: topShares(raw) }
}
