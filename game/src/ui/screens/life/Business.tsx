/** Life → Business: own a restaurant, gym or clothing label; weekly P&L. */
import { useState } from 'preact/hooks'
import type { Business as Biz, BusinessKind, BusinessPnl } from '../../../core/types'
import { lt, t } from '../../../i18n'
import {
  BUSINESS_DEFS, BUSINESS_KINDS, businessValue, expectedRevenue, managerWage, upgradeCost,
} from '../../../sim/life/business'
import { Button, Card, EmptyState, Modal, Money, SectionTitle, Sparkline, TextField } from '../../components'
import { formatMoney } from '../../format'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import { lifePlus } from '../../backend/lifePlus'
import { businessHints, foundationView } from '../../../sim/game/uiViews'
import type { GameState } from '../../../core/types'

function PnlTable({ p }: { p: BusinessPnl | undefined }) {
  if (!p) return <p class="t-sm t-lo">{t('life.biz.noHistory')}</p>
  const rows: [string, number][] = [
    [t('life.biz.revenue'), p.revenue],
    [t('life.biz.rent'), -p.rent],
    [t('life.biz.staff'), -p.staff],
    [t('life.biz.manager'), -p.manager],
    [t('life.biz.stock'), -p.stock],
    [t('life.biz.incident'), -p.incident],
  ]
  return (
    <div class="biz-pnl">
      <h4 class="micro t-mid">{t('life.biz.pnl')}</h4>
      <table class="biz-pnl-table">
        <tbody>
          {rows.filter(([, v], i) => i === 0 || v !== 0).map(([k, v]) => (
            <tr key={k}><th scope="row">{k}</th><td class={`num ${v >= 0 ? '' : 't-neg'}`}>{formatMoney(v, { compact: true })}</td></tr>
          ))}
          <tr class="biz-pnl-net"><th scope="row">{t('life.biz.profit')}</th><td class={`num ${p.profit >= 0 ? 't-pos' : 't-neg'}`} data-testid="biz-profit">{formatMoney(p.profit, { compact: true, sign: true })}</td></tr>
        </tbody>
      </table>
      {p.note && <p class="biz-note t-sm"><Icon name="info" size={14} /> {lt(p.note)}</p>}
    </div>
  )
}

function OwnedCard({ b, reputation, money }: { b: Biz; reputation: number; money: number }) {
  const [sell, setSell] = useState(false)
  const def = BUSINESS_DEFS[b.kind]
  const up = upgradeCost(b)
  const series = [...b.history].reverse().map((p) => p.profit)
  return (
    <Card variant="raised" class="biz-card" data-kind={b.kind}>
      <div class="row-between">
        <div class="row">
          <span class="biz-icon" aria-hidden="true">{def.icon}</span>
          <div>
            <h3 class="h3 truncate">{b.name}</h3>
            <div class="t-xs t-mid">{lt(def.name)} · {t('life.biz.level', { n: b.level })}</div>
          </div>
        </div>
        <div class="t-right">
          <div class="micro t-mid">{t('life.biz.total')}</div>
          <Money value={b.totalProfit} compact sign animate={false} class={b.totalProfit >= 0 ? 't-pos' : 't-neg'} />
        </div>
      </div>
      <dl class="biz-stats">
        <div><dt>{t('life.biz.brand')}</dt><dd class="num">{Math.round(b.brand)}</dd></div>
        <div><dt>{t('life.biz.expected')}</dt><dd class="num">{formatMoney(expectedRevenue(b, reputation), { compact: true })}</dd></div>
        <div><dt>{t('life.biz.value')}</dt><dd class="num">{formatMoney(businessValue(b), { compact: true })}</dd></div>
      </dl>
      <PnlTable p={b.history[0]} key={b.history[0]?.w ?? -1} />
      {series.length > 1 && (
        <div class="biz-spark">
          <span class="micro t-mid">{t('life.biz.history')}</span>
          <Sparkline values={series} width={260} height={40} color="var(--accent-gold)" label={t('life.biz.history')} />
        </div>
      )}
      <p class="t-xs t-lo">{b.manager ? t('life.biz.managed') : t('life.biz.unmanaged')}</p>
      <div class="row wrap biz-actions">
        <Button size="sm" variant="secondary" icon="trend-up" disabled={up === null || money < (up ?? 0)} onClick={() => lifePlus.upgradeBusiness(b.id)}>
          {up === null ? t('life.biz.maxLevel') : t('life.biz.upgrade', { price: formatMoney(up, { compact: true }) })}
        </Button>
        <Button size="sm" variant="ghost" icon="user" onClick={() => lifePlus.setManager(b.id, !b.manager)}>
          {b.manager ? t('life.biz.fire') : t('life.biz.hire', { wage: formatMoney(managerWage(b), { compact: true }) })}
        </Button>
        <Button size="sm" variant="ghost" icon="coins" onClick={() => setSell(true)}>{t('life.biz.sell')}</Button>
      </div>
      <Modal
        open={sell}
        onClose={() => setSell(false)}
        title={t('life.biz.sellTitle', { name: b.name })}
        size="sm"
        footer={<Button variant="primary" onClick={() => { setSell(false); lifePlus.sellBusiness(b.id) }}>{t('life.biz.sell')}</Button>}
      >
        <p>{t('life.biz.sellBody', { amount: formatMoney(businessValue(b)) })}</p>
      </Modal>
    </Card>
  )
}

function ShopCard({ kind, owned, reputation, money }: { kind: BusinessKind; owned: boolean; reputation: number; money: number }) {
  const def = BUSINESS_DEFS[kind]
  const [name, setName] = useState('')
  const locked = reputation < def.minReputation
  const preview = expectedRevenue({ kind, level: 1, brand: 40, manager: false }, reputation)
  return (
    <Card class="biz-shop" data-kind={kind}>
      <div class="row">
        <span class="biz-icon" aria-hidden="true">{def.icon}</span>
        <div class="grow">
          <h3 class="h3">{lt(def.name)}</h3>
          <p class="t-sm t-mid">{lt(def.desc)}</p>
        </div>
      </div>
      <div class="t-xs t-lo">{t('life.biz.expected')}: <span class="num">{formatMoney(preview, { compact: true })}</span></div>
      {!owned && (
        <TextField label={t('life.biz.namePh')} value={name} maxLength={28} placeholder={lt(def.name)} onInput={setName} />
      )}
      <Button
        variant={locked ? 'secondary' : 'primary'}
        block
        icon="storefront"
        disabled={owned || locked || money < def.price}
        onClick={() => lifePlus.openBusiness(kind, name)}
      >
        {owned ? t('life.biz.owned') : locked ? t('life.biz.minRep', { n: def.minReputation }) : t('life.biz.open', { price: formatMoney(def.price, { compact: true }) })}
      </Button>
    </Card>
  )
}

function FoundationCard({ s }: { s: GameState }) {
  const f = foundationView(s)
  const hints = businessHints(s)
  const money = s.life.money
  const kindName = (k: string) => lt(BUSINESS_DEFS[k as BusinessKind].name)
  const tips: string[] = []
  const up = hints.upgrades[0]
  if (up) {
    tips.push(up.affordable
      ? t('life.biz.foundation.upgradeNow', { kind: kindName(up.kind), price: formatMoney(up.cost, { compact: true }) })
      : t('life.biz.foundation.upgradeSoon', { kind: kindName(up.kind), price: formatMoney(up.cost, { compact: true }), missing: formatMoney(up.cost - money, { compact: true }) }))
  }
  const next = hints.unopened.filter((u) => !u.locked).sort((a, b) => a.price - b.price)[0]
  if (next) tips.push(t('life.biz.foundation.openKind', { kind: kindName(next.kind), price: formatMoney(next.price, { compact: true }) }))
  return (
    <Card variant="raised" class="biz-foundation" data-testid="foundation-card">
      <div class="row">
        <span class="biz-icon" aria-hidden="true">🤝</span>
        <div class="grow">
          <h3 class="h3">{f.founded ? t('life.biz.foundation.founded', { n: f.name }) : t('life.biz.foundation.title')}</h3>
          <p class="t-sm t-mid">
            {f.founded
              ? t('life.biz.foundation.active', { f: f.funds })
              : f.repOk ? t('life.biz.foundation.almost', { r: f.needRep }) : t('life.biz.foundation.notYet', { r: f.needRep })}
          </p>
        </div>
      </div>
      <h4 class="micro t-mid">{t('life.biz.foundation.tipTitle')}</h4>
      {tips.length === 0
        ? <p class="t-sm t-lo">{t('life.biz.foundation.none')}</p>
        : <ul class="biz-tips t-sm">{tips.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Card>
  )
}

export function Business() {
  const s = gameState.value
  if (!s) return null
  const list = s.life.businesses ?? []
  const rep = s.hero.reputation
  return (
    <div class="stack biz" style={{ ['--gap' as string]: 'var(--sp-6)' }}>
      <section class="stack">
        <SectionTitle>{t('life.biz.title')}</SectionTitle>
        {list.length === 0
          ? <EmptyState icon="storefront" text={t('life.biz.empty')} />
          : <div class="biz-grid">{list.map((b) => <OwnedCard key={b.id} b={b} reputation={rep} money={s.life.money} />)}</div>}
      </section>
      <section class="stack">
        <FoundationCard s={s} />
      </section>
      <section class="stack">
        <SectionTitle>{t('life.biz.shop')}</SectionTitle>
        <div class="biz-grid">
          {BUSINESS_KINDS.map((k) => <ShopCard key={k} kind={k} owned={list.some((b) => b.kind === k)} reputation={rep} money={s.life.money} />)}
        </div>
      </section>
    </div>
  )
}
