/**
 * "Ben / Me" stats hub (playtest: "I want to see my stats, fame level is important but I can't find it").
 * One tap from anywhere: the avatar button in the top bar (phone) / the hero button in the sidebar
 * (desktop), and the fame chip on Home. A sticky summary (avatar, OVR, fame level + progress, money)
 * sits over six tabs: career, attributes, condition, relationships, money & items, honours.
 * Every stat carries a short "what it affects" line (hubData.STAT_EFFECTS, from docs/SYSTEMS-MAP.md).
 */
import '../../../styles/screens/me.css'
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { ATTRIBUTE_KEYS, type AttributeGroup, type AttributeKey, type GameState } from '../../../core/types'
import { currentLang, lt, t, tx } from '../../../i18n'
import { Avatar, Button, Card, CardHeader, Chip, EmptyState, Money, Page, StatBar } from '../../components'
import { formatMoney, formatNumber, formatRating, formatSigned, seasonLabel } from '../../format'
import { Icon, type IconName } from '../../icons'
import { haptic } from '../../haptics'
import { data, gameState, heroClub, navigate, screen } from '../../store'
import { ROLE_ICON } from '../../roleView'
import { heroHeight } from '../../../core/roles'
import { heroMarketValue } from '../../../sim/career/contract'
import { netWorth, weeklyIncome } from '../../../sim/life/economy'
import { PERK_BY_ID } from '../../../data/perks'
import { PRODUCTS, entitlements } from '../../../store-iap'
import { achievementsView, potential } from '../../backend/meta'
import { GROUPS, keysOf } from '../career/attrs'
import { assetIcon } from '../life/util'
import { effectLabel } from '../life/Assets'
import { REL_ICONS } from '../../components/Chip'
import {
  AVATAR_BG, RELATION_EFFECTS, STAT_EFFECTS, fameLevel, recentAttrDeltas, relationRows, type FameLevel, type HubStatKey,
} from './hubData'

export type MeTab = 'career' | 'attrs' | 'condition' | 'relations' | 'items' | 'honours'
export const ME_TABS: { id: MeTab; icon: IconName }[] = [
  { id: 'career', icon: 'career' },
  { id: 'attrs', icon: 'radar' },
  { id: 'condition', icon: 'heartbeat' },
  { id: 'relations', icon: 'users' },
  { id: 'items', icon: 'wallet' },
  { id: 'honours', icon: 'trophy' },
]
const isTab = (v: unknown): v is MeTab => ME_TABS.some((x) => x.id === v)

/** "What it affects" line under a stat. */
function Affects({ k }: { k: HubStatKey }) {
  return <p class="me-affects t-xs"><Icon name="link" size={12} /><span>{lt(STAT_EFFECTS[k])}</span></p>
}

/** Label / value row with its effect line. */
function Fact({ label, value, k, testid }: { label: ComponentChildren; value: ComponentChildren; k?: HubStatKey; testid?: string }) {
  return (
    <div class="me-fact" data-testid={testid}>
      <div class="me-fact-row"><span class="t-mid">{label}</span><span class="me-fact-val num">{value}</span></div>
      {k && <Affects k={k} />}
    </div>
  )
}

function FameBar({ f, compact }: { f: FameLevel; compact?: boolean }) {
  return (
    <div class={`me-fame-bar${compact ? ' is-compact' : ''}`} role="meter" aria-label={t('hub.fame.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.value}>
      <span style={{ transform: `scaleX(${f.progress})` }} />
    </div>
  )
}

const fameName = (lvl: number): string => t(`hub.fame.levels.${lvl}` as 'hub.fame.levels.0')

/** Fame chip for Home: level name + mini bar, opens the hub. */
export function FameChip() {
  const s = gameState.value
  if (!s) return null
  const f = fameLevel(s.hero.reputation)
  return (
    <button type="button" class="me-fame-chip" data-testid="home-fame-chip" onClick={() => { haptic('select'); navigate('me', { tab: 'career' }) }}>
      <span class={`me-fame-star lvl-${f.level}`}><Icon name="star-fill" size={18} /></span>
      <span class="grow me-fame-chip-text">
        <span class="me-fame-chip-title">{t('hub.fame.chip', { name: fameName(f.level) })}</span>
        <span class="t-xs t-mid num">{t('hub.fame.level', { n: f.level })} · {t('hub.fame.points', { v: f.value })}{f.next !== null ? ` · ${t('hub.fame.toGo', { n: f.next - f.value })}` : ''}</span>
        <FameBar f={f} compact />
      </span>
      <Icon name="chevron-right" size={18} />
    </button>
  )
}

// ───────────────────────── Tabs ─────────────────────────

function CareerTab({ s }: { s: GameState }) {
  const h = s.hero
  const club = heroClub.value
  const c = h.contract
  const f = fameLevel(h.reputation)
  const pot = potential()
  const ovr = data.heroOvr()
  const value = heroMarketValue(h, s.calendar.season)
  const ss = h.seasonStats
  const cs = h.careerStats
  const avg = (x: typeof ss) => (x.apps ? formatRating(x.ratingSum / x.apps) : '—')
  const innate = h.perks.map((id) => PERK_BY_ID[id]).filter((p) => !!p)
  return (
    <div class="me-stack">
      <Card pad="md" class="me-fame-card" data-testid="hub-fame">
        <CardHeader title={t('hub.fame.title')} icon="star" />
        <div class="me-fame-main">
          <span class={`me-fame-star is-big lvl-${f.level}`}><Icon name="star-fill" size={28} /></span>
          <div class="grow">
            <div class="me-fame-level">{fameName(f.level)}</div>
            <div class="t-sm t-mid num" data-testid="hub-fame-value">{t('hub.fame.level', { n: f.level })} · {t('hub.fame.points', { v: f.value })}</div>
          </div>
        </div>
        <FameBar f={f} />
        <p class="t-sm t-mid num" data-testid="hub-fame-next">
          {f.next !== null ? `${t('hub.fame.next', { n: f.next, name: fameName(f.level + 1) })} · ${t('hub.fame.toGo', { n: f.next - f.value })}` : t('hub.fame.max')}
        </p>
        <Affects k="reputation" />
        <Fact label={t('hub.career.followers')} value={formatNumber(s.life.followers)} k="followers" />
      </Card>

      <Card pad="md">
        <CardHeader title={t('nav.career')} icon="shirt" action={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('profile')}>{t('hub.career.fullProfile')}</Button>} />
        <Fact label={t('hub.career.ovr')} value={<strong class="score-font me-big-num">{ovr}</strong>} k="ovr" />
        <Fact label={t('hub.career.potential')} value={pot ? t('hub.career.potentialBand', { a: pot.low, b: pot.high }) : '—'} k="potential" />
        <Fact label={t('hub.career.position')} value={t(`data.posLong.${h.position}`)} />
        {h.role && <Fact label={t('hub.career.role')} value={<span class="me-inline"><Icon name={ROLE_ICON[h.role]} size={14} />{t(`data.playRole.${h.role}`)}</span>} />}
        <Fact label={t('hub.career.club')} value={club ? club.name : t('hub.career.freeAgent')} />
        <Fact label={t('hub.career.squadRole')} value={c ? t(`data.role.${c.role}`) : '—'} k="squadRole" />
        <Fact label={t('hub.career.contract')} value={c ? t('hub.career.until', { s: seasonLabel(c.untilSeason) }) : t('hub.career.noContract')} k="contract" />
        <Fact label={t('hub.career.wage')} value={c ? `${formatMoney(c.wage)}${t('common.perWeek')}` : '—'} k="wage" />
        <Fact label={t('hub.career.marketValue')} value={formatMoney(value, { compact: true })} k="marketValue" testid="hub-market-value" />
      </Card>

      <Card pad="md">
        <CardHeader title={t('hub.career.numbers')} icon="chart-bar" />
        <table class="me-table">
          <thead><tr><th scope="col"><span class="sr-only">{t('hub.career.numbers')}</span></th><th scope="col">{t('hub.career.season')}</th><th scope="col">{t('hub.career.total')}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t('hub.career.apps')}</th><td class="num">{ss.apps}</td><td class="num">{cs.apps}</td></tr>
            <tr><th scope="row">{t('hub.career.goals')}</th><td class="num">{ss.goals}</td><td class="num">{cs.goals}</td></tr>
            <tr><th scope="row">{t('hub.career.assists')}</th><td class="num">{ss.assists}</td><td class="num">{cs.assists}</td></tr>
            <tr><th scope="row">{t('hub.career.rating')}</th><td class="num">{avg(ss)}</td><td class="num">{avg(cs)}</td></tr>
            <tr><th scope="row">{t('hub.career.motm')}</th><td class="num">{ss.motm}</td><td class="num">{cs.motm}</td></tr>
            <tr><th scope="row">{t('hub.career.caps')}</th><td class="num">—</td><td class="num">{h.nationalTeam.caps}</td></tr>
          </tbody>
        </table>
      </Card>

      <Card pad="md" data-testid="hub-traits">
        <CardHeader title={t('hub.career.traits')} icon="sparkle" />
        <Fact label={t('hub.career.background')} value={t(`data.background.${h.background}`)} />
        <p class="t-xs t-lo me-desc">{tx(`data.backgroundDesc.${h.background}`, undefined, '')}</p>
        <Affects k="background" />
        <Fact label={t('hub.career.foot')} value={t(`data.foot.${h.foot}`)} />
        {h.role && <Fact label={t('hub.career.height')} value={t('wizard.heightValue', { n: heroHeight(h) })} />}
        {h.nickname && <Fact label={t('hub.career.nickname')} value={h.nickname} />}
        <div class="me-subhead micro t-mid">{t('hub.career.perks')}</div>
        {innate.length === 0 ? (
          <p class="t-sm t-lo">{t('hub.career.noPerks')}</p>
        ) : (
          <ul class="me-list">
            {innate.map((p) => (
              <li key={p.id} class="me-list-item">
                <span class="me-emoji" aria-hidden="true">{p.icon}</span>
                <span class="grow"><span class="me-list-name">{lt(p.name)}</span><span class="t-xs t-mid">{lt(p.desc)}</span></span>
              </li>
            ))}
          </ul>
        )}
        <Affects k="perks" />
        <Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('training', { tab: 'perks' })}>{t('hub.career.perkTree')}</Button>
      </Card>
    </div>
  )
}

const GROUP_EFFECT: Record<AttributeGroup, HubStatKey> = {
  physical: 'attrPhysical', technical: 'attrTechnical', mental: 'attrMental', goalkeeping: 'attrGoalkeeping',
}

function AttrsTab({ s }: { s: GameState }) {
  const h = s.hero
  const deltas = recentAttrDeltas(s.attrHistory, h.attrs)
  const hasHistory = (s.attrHistory?.rows.length ?? 0) >= 2
  const gk = h.position === 'GK'
  return (
    <div class="me-stack" data-testid="hub-attrs">
      <p class="t-sm t-mid">{t('hub.attrs.count', { n: ATTRIBUTE_KEYS.length })} · {hasHistory ? t('hub.attrs.recent') : t('hub.attrs.noHistory')}</p>
      {GROUPS.map((g) => {
        const keys = keysOf(g)
        const avg = Math.round(keys.reduce((n, k) => n + h.attrs[k], 0) / keys.length)
        return (
          <details key={g} class="me-group card card-default" open={g !== 'goalkeeping' || gk} data-testid={`hub-group-${g}`}>
            <summary class="me-group-head">
              <span class="h3 grow">{t(`data.group.${g}`)}</span>
              <span class="t-sm t-mid num">{t('hub.attrs.avg', { n: avg })}</span>
              <Icon name="chevron-down" size={18} class="me-chev" />
            </summary>
            <Affects k={GROUP_EFFECT[g]} />
            <ul class="me-attrs">
              {keys.map((k) => <AttrRow key={k} k={k} value={h.attrs[k]} delta={deltas[k]} />)}
            </ul>
          </details>
        )
      })}
    </div>
  )
}

function AttrRow({ k, value, delta }: { k: AttributeKey; value: number; delta: number }) {
  const v = Math.round(value)
  const band = Math.min(6, Math.max(1, Math.ceil(v / 16.7)))
  return (
    <li class="me-attr" data-testid="hub-attr" data-attr={k}>
      <div class="me-attr-row">
        <span class="me-attr-name">{t(`data.attr.${k}`)}</span>
        {delta !== 0 && (
          <span class={`me-delta num ${delta > 0 ? 't-pos' : 't-neg'}`} title={delta > 0 ? t('hub.attrs.up', { n: delta }) : t('hub.attrs.down', { n: -delta })}>
            <span aria-hidden="true">{delta > 0 ? '↑' : '↓'}</span>{Math.abs(delta)}
            <span class="sr-only">{delta > 0 ? t('hub.attrs.up', { n: delta }) : t('hub.attrs.down', { n: -delta })}</span>
          </span>
        )}
        <span class="me-attr-val num" style={{ color: `var(--attr-${band})` }}>{v}</span>
      </div>
      <div class="me-attr-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, v / 100))})`, background: `var(--attr-${band})` }} /></div>
      <p class="t-xs t-lo me-desc">{tx(`data.attrDesc.${k}`, undefined, '')}</p>
    </li>
  )
}

function CondBar({ k, label, value, bad }: { k: HubStatKey; label: string; value: number; bad?: boolean }) {
  const high = value >= 60
  const color = bad ? (high ? 'var(--state-danger)' : 'var(--state-warning)') : value < 35 ? 'var(--state-warning)' : 'var(--brand-pitch)'
  return (
    <div class="me-fact" data-testid={`hub-cond-${k}`}>
      <StatBar label={label} value={value} size="sm" color={color} />
      <Affects k={k} />
    </div>
  )
}

function ConditionTab({ s }: { s: GameState }) {
  const h = s.hero
  const l = s.life
  return (
    <div class="me-stack" data-testid="hub-condition">
      <Card pad="md">
        <CardHeader title={t('hub.condition.fitness')} icon="heartbeat" />
        <CondBar k="energy" label={t('data.stat.energy')} value={l.energy} />
        <CondBar k="health" label={t('data.stat.health')} value={l.health} />
        <CondBar k="fatigue" label={t('data.stat.fatigue')} value={h.fatigue} bad />
        <CondBar k="sharpness" label={t('data.stat.sharpness')} value={h.sharpness} />
        <Fact label={t('hub.condition.injuryLabel')} value={h.injury ? t('hub.condition.injury', { name: lt(h.injury.name), n: h.injury.weeksLeft }) : t('hub.condition.injuryNone')} k="injury" />
      </Card>
      <Card pad="md">
        <CardHeader title={t('hub.condition.mind')} icon="brain" />
        <CondBar k="form" label={t('data.stat.form')} value={h.form} />
        <CondBar k="morale" label={t('data.stat.morale')} value={h.morale} />
        <CondBar k="happiness" label={t('data.stat.happiness')} value={l.happiness} />
        <CondBar k="stress" label={t('data.stat.stress')} value={l.stress} bad />
      </Card>
      <Card pad="md">
        <CardHeader title={t('hub.condition.conduct')} icon="shield" />
        <CondBar k="discipline" label={t('data.stat.discipline')} value={l.discipline} />
        <Fact label={t('hub.condition.suspensionLabel')} value={h.suspendedMatches > 0 ? t('hub.condition.suspension', { n: h.suspendedMatches }) : t('hub.condition.suspensionNone')} k="suspension" />
        {l.casino.addiction > 0 && <CondBar k="addiction" label={t('data.stat.addiction')} value={l.casino.addiction} bad />}
      </Card>
    </div>
  )
}

function RelationsTab({ s }: { s: GameState }) {
  const rows = relationRows(s.life.relationships)
  return (
    <div class="me-stack" data-testid="hub-relations">
      <Card pad="md">
        <CondBar k="managerTrust" label={t('hub.relations.trust')} value={s.hero.managerTrust} />
      </Card>
      <Card pad="md">
        <ul class="me-list">
          {rows.map((r) => {
            const label = r.kind === 'family' ? t('hub.relations.family') : r.kind === 'teammate' ? t('hub.relations.teammates') : t(`data.relation.${r.kind}`)
            const sub = r.count > 1 ? t('hub.relations.countPeople', { n: r.count }) : r.name ?? (r.value === null ? t('hub.relations.nobody') : '')
            const pct = r.value === null ? 0 : (r.value + 100) / 200
            return (
              <li key={r.kind} class="me-rel" data-testid={`hub-rel-${r.kind}`}>
                <div class="me-rel-row">
                  <span class="me-rel-icon"><Icon name={REL_ICONS[r.kind] ?? 'heart'} size={18} /></span>
                  <span class="grow"><span class="me-list-name">{label}</span>{sub && <span class="t-xs t-lo"> · {sub}</span>}</span>
                  <span class={`num me-rel-val ${r.value === null ? 't-lo' : r.value >= 0 ? 't-pos' : 't-neg'}`}>{r.value === null ? '—' : formatSigned(r.value)}</span>
                </div>
                {r.value !== null && <div class="me-rel-bar" aria-hidden="true"><span style={{ transform: `scaleX(${pct})` }} class={r.value >= 0 ? 'is-pos' : 'is-neg'} /></div>}
                <p class="me-affects t-xs"><Icon name="link" size={12} /><span>{lt(RELATION_EFFECTS[r.kind])}</span></p>
              </li>
            )
          })}
        </ul>
        <Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('life', { tab: 'relations' })}>{t('hub.relations.open')}</Button>
      </Card>
    </div>
  )
}

function ItemsTab({ s }: { s: GameState }) {
  const l = s.life
  const byId = new Map(data.assetCatalog().map((a) => [a.id, a]))
  const owned = l.assets.map((o) => ({ o, d: byId.get(o.defId) })).filter((x) => !!x.d)
  const packs = PRODUCTS.filter((p) => p.id in entitlements.value.owned)
  const biz = l.businesses ?? []
  return (
    <div class="me-stack" data-testid="hub-items">
      <Card pad="md">
        <CardHeader title={t('hub.items.money')} icon="coins" />
        <Fact label={t('hub.items.cash')} value={<Money value={l.money} />} k="money" testid="hub-money" />
        <Fact label={t('hub.items.savings')} value={formatMoney(l.bank.savings)} k="savings" />
        {l.bank.loan && <Fact label={t('hub.items.loan')} value={formatMoney(l.bank.loan.remaining)} k="loan" />}
        <Fact label={t('hub.items.income')} value={t('hub.items.weekly', { x: formatMoney(weeklyIncome(l, s.hero)) })} k="income" />
        <Fact label={t('hub.items.netWorth')} value={formatMoney(netWorth(l, s.calendar), { compact: true })} k="netWorth" />
        <Fact label={t('hub.items.creditScore')} value={Math.round(l.bank.creditScore)} />
      </Card>

      <Card pad="md" data-testid="hub-assets">
        <CardHeader title={t('hub.items.assets')} icon="shopping-bag" action={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('life', { tab: 'assets' })}>{t('hub.items.shop')}</Button>} />
        <Affects k="assets" />
        {owned.length === 0 ? (
          <p class="t-sm t-lo">{t('hub.items.noAssets')}</p>
        ) : (
          <ul class="me-list">
            {owned.map(({ o, d }, i) => {
              const eff = effectLabel(d!)
              return (
                <li key={`${o.defId}-${i}`} class="me-list-item" data-testid="hub-asset">
                  <span class="me-rel-icon"><Icon name={assetIcon(d!.icon, d!.category)} size={18} /></span>
                  <span class="grow">
                    <span class="me-list-name">{lt(d!.name)}</span>
                    <span class="me-chips">
                      <Chip tone="pos" icon="smile">{formatSigned(d!.happiness)}</Chip>
                      <Chip tone="neutral" icon="gear">{t('hub.items.upkeep', { x: formatMoney(d!.upkeep, { compact: true }) })}</Chip>
                      {eff && <Chip tone="violet" icon="sparkle">{eff}</Chip>}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card pad="md">
        <CardHeader title={t('hub.items.sponsors')} icon="handshake" />
        {l.sponsors.length === 0 ? <p class="t-sm t-lo">{t('hub.items.none')}</p> : (
          <ul class="me-list">
            {l.sponsors.map((sp) => (
              <li key={sp.id} class="me-list-item"><span class="grow me-list-name">{sp.brand}</span><span class="num t-gold">{t('hub.items.weekly', { x: formatMoney(sp.weekly, { compact: true }) })}</span></li>
            ))}
          </ul>
        )}
        <Affects k="sponsors" />
        <div class="me-subhead micro t-mid">{t('hub.items.businesses')}</div>
        {biz.length === 0 ? <p class="t-sm t-lo">{t('hub.items.none')}</p> : (
          <ul class="me-list">
            {biz.map((b) => (
              <li key={b.id} class="me-list-item"><span class="grow"><span class="me-list-name">{b.name}</span><span class="t-xs t-mid">{t('hub.items.level', { n: b.level })} · {t('hub.items.profit', { x: formatMoney(b.totalProfit, { compact: true }) })}</span></span></li>
            ))}
          </ul>
        )}
        <Affects k="businesses" />
        <div class="me-subhead micro t-mid">{t('hub.items.trainer')}</div>
        <p class="t-sm">{l.trainer ? `${l.trainer.name} · ${t(`data.group.${l.trainer.group}`)}` : <span class="t-lo">{t('hub.items.none')}</span>}</p>
        <Affects k="trainer" />
        <div class="me-subhead micro t-mid">{t('hub.items.cosmetics')}</div>
        <p class="t-sm">{packs.length ? packs.map((p) => lt(p.name)).join(', ') : <span class="t-lo">{t('hub.items.none')}</span>}</p>
        <Affects k="cosmetics" />
      </Card>
    </div>
  )
}

function HonoursTab({ s }: { s: GameState }) {
  void currentLang.value
  const h = s.hero
  const v = achievementsView()
  const latest = v.rows.filter((r) => r.unlocked).sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)).slice(0, 5)
  return (
    <div class="me-stack" data-testid="hub-honours">
      <Card pad="md">
        <CardHeader title={t('hub.honours.achievements')} icon="medal" action={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('achievements')}>{t('hub.honours.seeAll')}</Button>} />
        <p class="t-sm num">{t('hub.honours.achCount', { u: v.unlocked, n: v.total })}</p>
        {latest.length === 0 ? <p class="t-sm t-lo">{t('hub.honours.noAch')}</p> : (
          <ul class="me-list">
            {latest.map((r) => (
              <li key={r.def.id} class="me-list-item"><Icon name="medal" size={18} class="t-gold" /><span class="grow"><span class="me-list-name">{lt(r.def.name)}</span><span class="t-xs t-mid">{lt(r.def.desc)}</span></span></li>
            ))}
          </ul>
        )}
        <Affects k="achievements" />
      </Card>
      <Card pad="md">
        <CardHeader title={t('hub.honours.trophies')} icon="trophy" action={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('trophies')}>{t('hub.honours.cabinet')}</Button>} />
        {h.trophies.length === 0 && h.awards.length === 0 ? <p class="t-sm t-lo">{t('hub.honours.none')}</p> : (
          <ul class="me-list">
            {h.trophies.map((tr, i) => (
              <li key={`t${i}`} class="me-list-item"><Icon name="trophy" size={18} class="t-gold" /><span class="grow me-list-name">{lt(tr.name)}</span><span class="t-xs t-lo">{seasonLabel(tr.season)}</span></li>
            ))}
            {h.awards.map((a, i) => (
              <li key={`a${i}`} class="me-list-item"><Icon name="medal" size={18} /><span class="grow me-list-name">{lt(a.name)}</span><span class="t-xs t-lo">{seasonLabel(a.season)}</span></li>
            ))}
          </ul>
        )}
        <Affects k="trophies" />
        <Affects k="awards" />
      </Card>
    </div>
  )
}

// ───────────────────────── Screen ─────────────────────────

export function MeScreen() {
  void currentLang.value
  const param = screen.value.params?.tab
  const [tab, setTab] = useState<MeTab>(isTab(param) ? param : 'career')
  const s = gameState.value
  if (!s) return <Page title={t('hub.title')}><EmptyState /></Page>
  const h = s.hero
  const club = heroClub.value
  const f = fameLevel(h.reputation)
  const ovr = data.heroOvr()
  const pick = (id: MeTab) => {
    haptic('select')
    setTab(id)
    navigate('me', { tab: id }, { replace: true })
  }
  return (
    <Page title={t('hub.title')} sub={t('hub.sub')} class="me-page" wide>
      <div class="me-head" data-testid="hub-head" style={{ ['--club' as string]: club?.colors.primary ?? 'var(--brand-pitch)' }}>
        <Avatar appearance={h.appearance} size={48} background={club?.colors.primary ?? AVATAR_BG} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} />
        <div class="me-head-main">
          <div class="me-head-name truncate">{h.firstName} {h.lastName}</div>
          <div class="me-head-fame">
            <span class={`me-fame-star lvl-${f.level}`}><Icon name="star-fill" size={14} /></span>
            <span class="truncate t-sm" data-testid="hub-head-fame">{fameName(f.level)} · {t('hub.fame.level', { n: f.level })}</span>
          </div>
          <FameBar f={f} compact />
        </div>
        <div class="me-head-side">
          <span class="me-head-ovr score-font" aria-label={t('hub.career.ovr')}>{ovr}</span>
          <span class="me-head-money"><Money value={s.life.money} compact /></span>
        </div>
      </div>

      <div class="me-tabs" role="tablist" aria-label={t('hub.tabsLabel')}>
        {ME_TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`me-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls="me-panel"
            class={`me-tab${tab === x.id ? ' is-active' : ''}`}
            data-testid={`hub-tab-${x.id}`}
            onClick={() => pick(x.id)}
          >
            <Icon name={x.icon} size={18} />
            <span class="me-tab-label">{t(`hub.tabs.${x.id}`)}</span>
          </button>
        ))}
      </div>

      <div id="me-panel" role="tabpanel" aria-labelledby={`me-tab-${tab}`} class="me-panel">
        {tab === 'career' && <CareerTab s={s} />}
        {tab === 'attrs' && <AttrsTab s={s} />}
        {tab === 'condition' && <ConditionTab s={s} />}
        {tab === 'relations' && <RelationsTab s={s} />}
        {tab === 'items' && <ItemsTab s={s} />}
        {tab === 'honours' && <HonoursTab s={s} />}
      </div>
    </Page>
  )
}
