import { useState } from 'preact/hooks'
import type { AssetCategory, AssetDef } from '../../../core/types'
import { lt, t, tx } from '../../../i18n'
import { Button, Chip, EmptyState, Modal, Money, SectionTitle, Tabs, toast, toastUndo } from '../../components'
import { formatMoney, formatSigned } from '../../format'
import { Icon } from '../../icons'
import { actions, data, gameState } from '../../store'
import { assetIcon, categoryIcon } from './util'
import { shelfInfo } from '../../../sim/game/assetView'
import { INCOME_TAX, weeklyIncome } from '../../../sim/life/economy'
import { NewTag, UnlockGate } from '../../tutorial/UnlockGate'
import { features } from '../../tutorial/unlocks'

type Cat = AssetCategory | 'all'

function effectLabel(a: AssetDef): string | null {
  if (!a.effect) return null
  const name = tx(`life.assets.effect.${a.effect.key}`, undefined, t('life.assets.effect.generic'))
  const v = a.effect.value
  const pct = Math.abs(v) < 1 ? `${formatSigned(Math.round(v * 100))}%` : formatSigned(v)
  return `${name} ${pct}`
}

function AssetCard({ a, owned, locked, onBuy }: { a: AssetDef; owned: boolean; locked: boolean; onBuy: () => void }) {
  const eff = effectLabel(a)
  return (
    <article class={`life-asset card card-default pad-md${owned ? ' is-owned' : ''}${locked ? ' is-locked' : ''}`}>
      <div class="life-asset-top">
        <span class={`life-asset-badge cat-${a.category}`}><Icon name={assetIcon(a.icon, a.category)} size={26} /></span>
        {owned && <Chip tone="pos" icon="check" solid>{t('common.owned')}</Chip>}
        {!owned && locked && <Chip tone="neutral" icon="lock">{t('life.assets.minRep', { n: a.minReputation ?? 0 })}</Chip>}
      </div>
      <h3 class="h3 life-asset-name">{lt(a.name)}</h3>
      <div class="life-asset-cat micro t-lo">{t(`data.assetCat.${a.category}`)}</div>
      <div class="life-asset-specs" data-testid="asset-chips">
        <Chip tone="neutral" icon="gear">{t('life.assets.weeklyUpkeep', { amount: formatMoney(a.upkeep, { compact: true }) })}</Chip>
        <Chip tone="pos" icon="smile">{formatSigned(a.happiness)}</Chip>
        <Chip tone="gold" icon="star">{formatSigned(a.fame)}</Chip>
      </div>
      {eff && <Chip tone="violet" icon="sparkle">{eff}</Chip>}
      <div class="life-asset-foot">
        <span class="life-asset-price money num">{formatMoney(a.price, { compact: true })}</span>
        <Button size="sm" variant={owned ? 'ghost' : 'secondary'} disabled={owned || locked} onClick={onBuy} icon={owned ? 'check' : locked ? 'lock' : 'shopping-bag'}>
          {owned ? t('common.owned') : t('common.buy')}
        </Button>
      </div>
    </article>
  )
}

export function Assets() {
  const s = gameState.value
  const [cat, setCat] = useState<Cat>('all')
  const [buying, setBuying] = useState<AssetDef | null>(null)
  if (!s) return null
  const catalog = data.assetCatalog()
  const byId = new Map(catalog.map((a) => [a.id, a]))
  const cats = Array.from(new Set(catalog.map((a) => a.category)))
  const ownedIds = new Set(s.life.assets.map((o) => o.defId))
  const bizOpen = features.value.business.unlocked
  const list = (cat === 'all' ? catalog.filter((a) => bizOpen || a.category !== 'business') : catalog.filter((a) => a.category === cat)).slice().sort((a, b) => a.price - b.price)
  const rep = s.hero.reputation
  const money = s.life.money

  const confirmBuy = () => {
    if (!buying) return
    const ok = actions.buy(buying.id)
    if (ok) toast(t('life.assets.bought', { name: lt(buying.name) }), 'reward', assetIcon(buying.icon, buying.category))
    else toast(t('life.assets.failed'), 'error')
    setBuying(null)
  }
  const sellNow = (i: number) => {
    const o = s.life.assets[i]
    const d = o ? byId.get(o.defId) : undefined
    if (!o || !d) return
    const got = actions.sell(i)
    toastUndo(t('life.assets.sold', { name: lt(d.name), amount: formatMoney(got) }), () => {
      if (actions.undoSell()) toast(t('life.assets.restored', { name: lt(d.name) }), 'success', 'history')
      else toast(t('life.assets.undoFailed'), 'error')
    })
  }

  return (
    <div class="stack" style={{ ['--gap' as string]: 'var(--sp-6)' }}>
      <section class="stack">
        <SectionTitle>{t('life.assets.collection')}</SectionTitle>
        {s.life.assets.length === 0 ? (
          <EmptyState compact icon="house" text={t('life.assets.emptyCollection')} />
        ) : (
          <div class="life-shelf" role="list">
            {s.life.assets.map((o, i) => {
              const d = byId.get(o.defId)
              if (!d) return null
              const info = shelfInfo(o, d, s.calendar)
              return (
                <div key={`${o.defId}-${i}`} class="life-shelf-item" role="listitem">
                  <span class={`life-asset-badge cat-${d.category}`}><Icon name={assetIcon(d.icon, d.category)} size={22} /></span>
                  <div class="grow">
                    <div class="life-shelf-name truncate">{lt(d.name)}</div>
                    <div class="t-xs t-lo">{t('life.assets.boughtOn', { season: o.boughtSeason, week: o.boughtWeek + 1 })}</div>
                    <div class="life-shelf-stats" data-testid="shelf-stats">
                      <Chip tone={info.condition >= 70 ? 'pos' : info.condition >= 50 ? 'warning' : 'neg'}>{t('life.assets.condition', { n: info.condition })}</Chip>
                      <Chip tone="gold" icon="coins">{t('life.assets.secondHand', { amount: formatMoney(info.resale, { compact: true }) })}</Chip>
                    </div>
                  </div>
                  <Button size="sm" variant="danger" icon="coins" onClick={() => sellNow(i)}>{t('life.assets.sell')}</Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section class="stack">
        <SectionTitle action={<span class="t-sm t-mid row"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
          {t('life.assets.shop')}
        </SectionTitle>
        <Tabs
          variant="pill"
          label={t('life.assets.categories')}
          idPrefix="asset-cat"
          value={cat}
          onChange={setCat}
          items={[
            { id: 'all' as Cat, label: t('life.assets.all'), icon: 'grid' },
            ...cats.map((c) => ({ id: c as Cat, label: t(`data.assetCat.${c}`), icon: c === 'business' && !bizOpen ? 'lock' : categoryIcon(c), extra: c === 'business' ? <NewTag feature="business" /> : undefined })),
          ]}
        />
        {cat === 'business' && !bizOpen ? (
          <UnlockGate feature="business" compact>{null}</UnlockGate>
        ) : list.length === 0 ? (
          <EmptyState icon="shopping-bag" text={t('life.assets.emptyShop')} />
        ) : (
          <>
          {cat === 'business' && <UnlockGate feature="business" compact>{null}</UnlockGate>}
          <div class="life-assets-grid">
            {list.map((a) => (
              <AssetCard
                key={a.id}
                a={a}
                owned={ownedIds.has(a.id)}
                locked={(a.minReputation ?? 0) > rep}
                onBuy={() => setBuying(a)}
              />
            ))}
          </div>
          </>
        )}
      </section>

      <Modal
        open={!!buying}
        onClose={() => setBuying(null)}
        title={t('life.assets.buyTitle')}
        size="sm"
        footer={buying && (
          <>
            <Button variant="ghost" onClick={() => setBuying(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" icon="shopping-bag" disabled={money < buying.price} onClick={confirmBuy}>
              {t('life.assets.buyFor', { price: formatMoney(buying.price, { compact: true }) })}
            </Button>
          </>
        )}
      >
        {buying && (
          <div class="stack">
            <div class="row">
              <span class={`life-asset-badge cat-${buying.category}`}><Icon name={assetIcon(buying.icon, buying.category)} size={26} /></span>
              <h3 class="h3">{lt(buying.name)}</h3>
            </div>
            <p class="t-mid">{t('life.assets.buyBody', { name: lt(buying.name), upkeep: formatMoney(buying.upkeep) })}</p>
            {(() => {
              const net = weeklyIncome(s.life, s.hero) * (1 - INCOME_TAX)
              return net > 0 ? <p class="t-sm t-lo" data-testid="asset-weeks">{t('life.assets.weeksOfPay', { n: Math.max(1, Math.round(buying.price / net)) })}</p> : null
            })()}
            {money < buying.price && <Chip tone="neg" icon="warning">{t('common.notEnoughMoney')}</Chip>}
          </div>
        )}
      </Modal>

    </div>
  )
}
