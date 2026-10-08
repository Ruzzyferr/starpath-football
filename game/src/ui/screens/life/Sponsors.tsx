import type { SponsorDeal } from '../../../core/types'
import { hashString } from '../../../core/rng'
import { t } from '../../../i18n'
import { Button, Chip, EmptyState, SectionTitle, WhyList, toast } from '../../components'
import { dealStrictness } from '../../../sim/life/sponsors'
import { whySponsors } from '../../../sim/game/whyMore'
import { formatMoney, initials, seasonLabel } from '../../format'
import { actions, data, gameState } from '../../store'

const HUES = ['var(--accent-blue)', 'var(--accent-violet)', 'var(--accent-gold)', 'var(--brand-pitch)', 'var(--state-danger)']

/** Conduct clause strength from the brand's strictness: 1 relaxed, 2 standard, 3 strict. */
const strictLevel = (d: SponsorDeal): 1 | 2 | 3 => { const s = dealStrictness(d); return s < 0.4 ? 1 : s < 0.7 ? 2 : 3 }

function Deal({ d, offer, rep }: { d: SponsorDeal; offer?: boolean; rep: number }) {
  const locked = offer && d.minReputation > rep
  const color = HUES[hashString(d.brand) % HUES.length]
  return (
    <article class={`life-deal card card-default pad-md${offer ? ' is-offer' : ''}`}>
      <div class="life-deal-head">
        <span class="life-deal-mono" style={{ ['--brand' as string]: color }} aria-hidden="true">{initials(d.brand)}</span>
        <div class="grow">
          <h3 class="h3 truncate">{d.brand}</h3>
          <div class="micro t-lo">{t(`data.sponsorCat.${d.category}`)}</div>
        </div>
        <div class="life-deal-pay">
          <span class="money num">{formatMoney(d.weekly, { compact: true })}</span>
          <span class="t-xs t-lo">{t('life.sponsors.weekly')}</span>
        </div>
      </div>
      <dl class="life-terms" data-testid="sponsor-terms">
        <div><dt>{t('life.sponsors.terms.duration')}</dt><dd>{t('life.sponsors.until', { season: seasonLabel(d.untilSeason) })}</dd></div>
        <div><dt>{t('life.sponsors.terms.fee')}</dt><dd class="num">{formatMoney(d.weekly, { compact: true })}{t('common.perWeek')}</dd></div>
        <div><dt>{t('life.sponsors.terms.bonus')}</dt><dd class="num">{d.perfBonus ? formatMoney(d.perfBonus, { compact: true }) : t('life.sponsors.terms.none')}</dd></div>
        <div><dt>{t('life.sponsors.terms.fame')}</dt><dd class="num">{d.minReputation}</dd></div>
        <div><dt>{t('life.sponsors.terms.conduct')}</dt><dd>{t(`life.sponsors.terms.conduct${strictLevel(d)}`)}</dd></div>
        <div><dt>{t('life.sponsors.terms.exclusive')}</dt><dd>{t('life.sponsors.terms.exclusiveYes', { cat: t(`data.sponsorCat.${d.category}`) })}</dd></div>
      </dl>
      <div class="row wrap">
        <Chip tone="info" icon="calendar">{t('life.sponsors.until', { season: seasonLabel(d.untilSeason) })}</Chip>
        {offer && <Chip tone={locked ? 'neg' : 'neutral'} icon="star">{t('life.sponsors.minRep', { n: d.minReputation })}</Chip>}
      </div>
      {offer && (
        <div class="row life-deal-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              actions.declineSponsor(d.id)
              toast(t('life.sponsors.declined', { brand: d.brand }), 'info')
            }}
          >
            {t('life.sponsors.decline')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="handshake"
            disabled={locked}
            onClick={() => {
              actions.acceptSponsor(d.id)
              toast(t('life.sponsors.accepted', { brand: d.brand }), 'reward', 'handshake')
            }}
          >
            {t('life.sponsors.accept')}
          </Button>
        </div>
      )}
    </article>
  )
}

export function Sponsors() {
  const s = gameState.value
  if (!s) return null
  const active = s.life.sponsors
  const offers = data.sponsorOffers()
  const total = active.reduce((a, d) => a + d.weekly, 0)
  return (
    <div class="stack" style={{ ['--gap' as string]: 'var(--sp-6)' }}>
      <section class="stack">
        <SectionTitle action={active.length ? <span class="t-sm t-mid">{t('life.sponsors.total')}: <span class="money num">{formatMoney(total)}{t('common.perWeek')}</span></span> : undefined}>
          {t('life.sponsors.active')}
        </SectionTitle>
        {active.length === 0 ? <EmptyState compact icon="handshake" text={t('life.sponsors.noActive')} /> : (
          <div class="life-deals">{active.map((d) => <Deal key={d.id} d={d} rep={s.hero.reputation} />)}</div>
        )}
      </section>
      <section class="stack">
        <SectionTitle>{t('life.sponsors.offers')}</SectionTitle>
        <WhyList why={whySponsors(s)} id="why-sponsors" testId="why-sponsors" />
        {offers.length === 0 ? <EmptyState icon="handshake" text={t('life.sponsors.noOffers')} /> : (
          <div class="life-deals">{offers.map((d) => <Deal key={d.id} d={d} offer rep={s.hero.reputation} />)}</div>
        )}
      </section>
    </div>
  )
}
