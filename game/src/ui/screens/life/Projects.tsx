/** Life → Projects: late-game money goals (academy, charity stadium, club stake, legacy fund, collection). */
import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { GameState } from '../../../core/types'
import { lt, t } from '../../../i18n'
import { ownedAssetDefs } from '../../../sim/life/assetEffects'
import {
  ACADEMY_UPKEEP, FUND_GROWTH, LEGACY_FUND_CAP, LEGACY_FUND_SHARE, STADIUM_UPKEEP, STAKE_MAX_PCT, STAKE_PRICE_PER_PCT, STAKE_YIELD,
  PROJECT_FLAGS, academyGraduates, academyLevel, legacyAcademyBonus, legacyFund, legacyFundBonus, nextAcademyPrice, nextStadiumPrice,
  projectUpkeep, projectsLegacyPoints, stadiumLevel, stakeDividend, stakePct, stakeValue,
} from '../../../sim/life/projects'
import { Button, Card, Chip, EmptyState, Money, SectionTitle, Slider } from '../../components'
import { formatMoney } from '../../format'
import { Icon, type IconName } from '../../icons'
import { gameState } from '../../store'
import { lifePlus } from '../../backend/lifePlus'

const money = (n: number) => formatMoney(n, { compact: true })

function Stages({ level, total }: { level: number; total: number }) {
  return (
    <div class="prj-stages" role="img" aria-label={t('life.projects.stageOf', { n: level, total })}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} class={`prj-stage${i < level ? ' is-done' : i === level ? ' is-next' : ''}`}>{i + 1}</span>
      ))}
      <span class="t-xs t-mid prj-stage-text">{t('life.projects.stageOf', { n: level, total })}</span>
    </div>
  )
}

function ProjectCard({ id, icon, title, children }: { id: string; icon: IconName; title: string; children: ComponentChildren }) {
  return (
    <Card variant="raised" class="prj-card" data-testid={`prj-${id}`}>
      <div class="row">
        <span class="biz-icon is-glyph" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <h3 class="h3 grow">{title}</h3>
      </div>
      {children}
    </Card>
  )
}

function Academy({ s }: { s: GameState }) {
  const lvl = academyLevel(s.life)
  const next = nextAcademyPrice(s.life)
  return (
    <ProjectCard id="academy" icon="ball" title={t('life.projects.academy.title')}>
      <p class="t-sm t-mid">{t('life.projects.academy.body')}</p>
      <Stages level={lvl} total={3} />
      <dl class="biz-stats">
        <div><dt>{t('life.projects.cost')}</dt><dd class="num">{next === null ? '-' : money(next)}</dd></div>
        <div><dt>{t('life.projects.upkeep')}</dt><dd class="num">{money(ACADEMY_UPKEEP[lvl]!)}{t('common.perWeek')}</dd></div>
        <div><dt>{t('life.projects.academy.grads')}</dt><dd class="num">{academyGraduates(s.life)}</dd></div>
      </dl>
      <p class="t-xs t-lo">{t('life.projects.academy.effect', { n: Math.max(1, lvl) })}</p>
      <Button variant="primary" icon="trend-up" block disabled={next === null || s.life.money < next} onClick={() => lifePlus.buildAcademy()}>
        {next === null ? t('life.projects.complete') : lvl === 0 ? t('life.projects.build', { price: money(next) }) : t('life.projects.upgrade', { price: money(next) })}
      </Button>
      {next !== null && s.life.money < next && <p class="t-xs t-lo">{t('life.projects.missing', { n: money(next - s.life.money) })}</p>}
    </ProjectCard>
  )
}

function Stadium({ s }: { s: GameState }) {
  const lvl = stadiumLevel(s.life)
  const next = nextStadiumPrice(s.life)
  return (
    <ProjectCard id="stadium" icon="building" title={t('life.projects.stadium.title')}>
      <p class="t-sm t-mid">{t('life.projects.stadium.body')}</p>
      <Stages level={lvl} total={2} />
      <dl class="biz-stats">
        <div><dt>{t('life.projects.cost')}</dt><dd class="num">{next === null ? '-' : money(next)}</dd></div>
        <div><dt>{t('life.projects.upkeep')}</dt><dd class="num">{money(STADIUM_UPKEEP[lvl]!)}{t('common.perWeek')}</dd></div>
        <div><dt>{t('life.projects.legacyPts')}</dt><dd class="num">+{lvl * 10}</dd></div>
      </dl>
      <p class="t-xs t-lo">{t('life.projects.stadium.effect')}</p>
      <Button variant="primary" icon="trend-up" block disabled={next === null || s.life.money < next} onClick={() => lifePlus.buildStadium()}>
        {next === null ? t('life.projects.complete') : lvl === 0 ? t('life.projects.build', { price: money(next) }) : t('life.projects.upgrade', { price: money(next) })}
      </Button>
      {next !== null && s.life.money < next && <p class="t-xs t-lo">{t('life.projects.missing', { n: money(next - s.life.money) })}</p>}
    </ProjectCard>
  )
}

function Stake({ s }: { s: GameState }) {
  const owned = stakePct(s.life)
  const room = STAKE_MAX_PCT - owned
  const [pct, setPct] = useState(5)
  const stakeClubId = String(s.life.flags[PROJECT_FLAGS.stakeClub] ?? '')
  const clubId = owned > 0 ? stakeClubId : (s.hero.contract?.clubId ?? null)
  const clubName = clubId ? s.world.clubs[clubId]?.name : undefined
  const p = Math.max(1, Math.min(pct, room))
  const cost = p * STAKE_PRICE_PER_PCT
  const blocked = !clubId || room <= 0 || s.life.money < cost
  return (
    <ProjectCard id="stake" icon="trend-up" title={t('life.projects.stake.title')}>
      <p class="t-sm t-mid">{t('life.projects.stake.body', { max: STAKE_MAX_PCT, yield: Math.round(STAKE_YIELD * 100) })}</p>
      <dl class="biz-stats">
        <div><dt>{t('life.projects.stake.owned')}</dt><dd class="num" data-testid="prj-stake-pct">{owned}%</dd></div>
        <div><dt>{t('life.projects.stake.dividend')}</dt><dd class="num t-pos" data-testid="prj-dividend">{money(stakeDividend(s.life))}{t('common.perWeek')}</dd></div>
        <div><dt>{t('life.projects.stake.value')}</dt><dd class="num">{money(stakeValue(s.life))}</dd></div>
      </dl>
      {clubName && <p class="t-xs t-mid row"><Icon name="shield" size={14} /> {t('life.projects.stake.club', { club: clubName })}</p>}
      {room > 0 && clubId ? (
        <Slider label={t('life.projects.stake.pick')} value={p} min={1} max={room} step={1} onChange={setPct} format={(v) => `${v}% · ${money(v * STAKE_PRICE_PER_PCT)}`} />
      ) : <p class="t-xs t-lo">{room <= 0 ? t('life.projects.stake.full') : t('life.projects.stake.noClub')}</p>}
      <div class="row wrap">
        <Button variant="primary" icon="coins" disabled={blocked} onClick={() => clubId && lifePlus.buyStake(clubId, p)}>
          {t('life.projects.stake.buy', { n: p, price: money(cost) })}
        </Button>
        {owned > 0 && <Button variant="ghost" onClick={() => lifePlus.sellStake()}>{t('life.projects.stake.sell', { amount: money(stakeValue(s.life)) })}</Button>}
      </div>
    </ProjectCard>
  )
}

function Fund({ s }: { s: GameState }) {
  const fund = legacyFund(s.life)
  const [amt, setAmt] = useState(100_000)
  const cap = Math.max(20_000, Math.floor(s.life.money / 10_000) * 10_000)
  const a = Math.max(10_000, Math.min(amt, cap))
  const canFund = s.life.money >= 10_000
  return (
    <ProjectCard id="fund" icon="bank" title={t('life.projects.fund.title')}>
      <p class="t-sm t-mid">{t('life.projects.fund.body', { growth: (FUND_GROWTH * 100).toFixed(1) })}</p>
      <dl class="biz-stats">
        <div><dt>{t('life.projects.fund.balance')}</dt><dd class="num" data-testid="prj-fund-balance">{money(fund)}</dd></div>
        <div><dt>{t('life.projects.fund.child')}</dt><dd class="num t-pos">+{money(legacyFundBonus(fund))}</dd></div>
        <div><dt>{t('life.projects.fund.rep')}</dt><dd class="num t-pos">+{legacyAcademyBonus(academyLevel(s.life))}</dd></div>
      </dl>
      <p class="t-xs t-lo">{t('life.projects.fund.effect', { share: Math.round(LEGACY_FUND_SHARE * 100), cap: money(LEGACY_FUND_CAP) })}</p>
      {canFund
        ? <Slider label={t('life.projects.fund.amount')} value={a} min={10_000} max={cap} step={10_000} onChange={setAmt} format={(v) => money(v)} />
        : <p class="t-xs t-lo">{t('life.projects.fund.noCash')}</p>}
      <Button variant="primary" icon="bank" block disabled={!canFund || a > s.life.money} onClick={() => lifePlus.fundLegacy(a)}>
        {t('life.projects.fund.add', { amount: money(a) })}
      </Button>
    </ProjectCard>
  )
}

function Collection({ s }: { s: GameState }) {
  const items = ownedAssetDefs(s.life).filter((d) => d.effect?.key === 'collector')
  const pts = items.reduce((a, d) => a + (d.effect?.value ?? 0), 0)
  return (
    <ProjectCard id="collection" icon="crown" title={t('life.projects.collection.title')}>
      <p class="t-sm t-mid">{t('life.projects.collection.body')}</p>
      {items.length === 0
        ? <p class="t-xs t-lo">{t('life.projects.collection.empty')}</p>
        : <ul class="prj-items">{items.map((d) => <li key={d.id}><span aria-hidden="true">{d.icon}</span> {lt(d.name)} <span class="t-xs t-mid">+{d.effect?.value}</span></li>)}</ul>}
      <div class="row wrap"><Chip tone="gold" icon="trophy">{t('life.projects.collection.points', { n: Math.min(pts, 12) * 3 })}</Chip></div>
    </ProjectCard>
  )
}

export function Projects() {
  const s = gameState.value
  if (!s) return null
  const l = s.life
  const income = stakePct(l) > 0 ? stakeDividend(l) : 0
  const any = academyLevel(l) + stadiumLevel(l) + stakePct(l) + legacyFund(l) > 0
  return (
    <div class="stack prj" style={{ ['--gap' as string]: 'var(--sp-6)' }} data-testid="projects">
      <Card class="prj-summary stack" variant="raised">
        <dl class="biz-stats prj-sum-grid">
          <div><dt>{t('life.projects.sum.dividends')}</dt><dd class={`num ${income > 0 ? 't-pos' : 't-lo'}`}>{money(income)}{t('common.perWeek')}</dd></div>
          <div><dt>{t('life.projects.sum.upkeep')}</dt><dd class={`num ${projectUpkeep(l) > 0 ? 't-neg' : 't-lo'}`}>{projectUpkeep(l) > 0 ? '-' : ''}{money(projectUpkeep(l))}{t('common.perWeek')}</dd></div>
          <div><dt>{t('life.projects.sum.fund')}</dt><dd class="num"><Money value={legacyFund(l)} compact animate={false} /></dd></div>
          <div><dt>{t('life.projects.sum.points')}</dt><dd class="num t-gold" data-testid="prj-points">+{projectsLegacyPoints(l)}</dd></div>
        </dl>
        <p class="t-sm t-mid prj-explain"><Icon name="trophy" size={16} class="t-gold" /><span>{t('life.projects.sum.explain')}</span></p>
      </Card>
      {!any && <EmptyState compact icon="storefront" text={t('life.projects.empty')} />}
      <section class="stack">
        <SectionTitle>{t('life.projects.title')}</SectionTitle>
        <div class="biz-grid">
          <Academy s={s} />
          <Stadium s={s} />
          <Stake s={s} />
          <Fund s={s} />
          <Collection s={s} />
        </div>
      </section>
    </div>
  )
}
