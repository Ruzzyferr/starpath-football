import { useState } from 'preact/hooks'
import type { RelationCause, RelationKind, Relationship } from '../../../core/types'
import { relationCauseTotals, relationHistory } from '../../../sim/life/relationships'
import { FAN_GROUPS, fanGroupValue } from '../../../sim/life/fanGroups'
import { CLOSE_FRIEND_MIN, MAX_CLOSE_FRIENDS, canBeCloseFriend, closeFriends } from '../../../sim/life/closeFriends'
import { INTERACT_COST } from '../../../sim/game/interactCost'
import { passPercent, relBand, relGroup, relTrend } from '../../../sim/game/relationView'
import { formatMoney } from '../../format'
import { START_YEAR } from '../../../core/config'
import { lt, t } from '../../../i18n'
import { Avatar, Button, Chip, EmptyState, Hearts, Modal, SectionTitle, toast } from '../../components'
import { Icon, type IconName } from '../../icons'
import { actions, gameState, type InteractionKind } from '../../store'
import { deltasText, relAge, relAppearance } from './util'

type Group = 'family' | 'love' | 'team' | 'pro'
const GROUP_OF: Record<RelationKind, Group> = {
  mother: 'family', father: 'family', sibling: 'family',
  partner: 'love', bestFriend: 'love',
  teammate: 'team', manager: 'team', chairman: 'team',
  agent: 'pro', fans: 'pro', press: 'pro',
}
const HOUSEHOLD_KEY: Record<string, 'life.rel.household.both' | 'life.rel.household.single_mother' | 'life.rel.household.single_father' | 'life.rel.household.foster'> = {
  both: 'life.rel.household.both', single_mother: 'life.rel.household.single_mother', single_father: 'life.rel.household.single_father', foster: 'life.rel.household.foster',
}
const GROUPS: Group[] = ['family', 'love', 'team', 'pro']

const INTERACTIONS: Record<RelationKind, InteractionKind[]> = {
  mother: ['call', 'dinner', 'gift', 'holiday'],
  father: ['call', 'dinner', 'gift', 'holiday'],
  sibling: ['call', 'party', 'gift'],
  partner: ['dinner', 'gift', 'holiday', 'apologize'],
  bestFriend: ['call', 'party', 'dinner'],
  teammate: ['train', 'dinner', 'party'],
  manager: ['call', 'apologize'],
  chairman: ['call', 'dinner'],
  agent: ['call', 'dinner'],
  fans: ['call', 'gift'],
  press: ['call', 'dinner'],
}
const INTERACT_ICON: Record<InteractionKind, IconName> = {
  call: 'phone', dinner: 'fork-knife', gift: 'gift', train: 'barbell', party: 'party', holiday: 'airplane', apologize: 'handshake',
}

function ringColor(v: number): string {
  if (v >= 50) return 'var(--brand-pitch)'
  if (v >= 0) return 'var(--accent-blue)'
  if (v > -50) return 'var(--accent-gold)'
  return 'var(--state-danger)'
}

const CAUSE_ICON: Record<RelationCause, IconName> = {
  match: 'ball', event: 'cards', activity: 'users', decay: 'hourglass', interview: 'megaphone', role: 'tactics',
  social: 'instagram', casino: 'dice', transfer: 'handshake', business: 'storefront', other: 'sparkle',
}

const fmtD = (d: number): string => {
  const a = Math.abs(d)
  return (d >= 0 ? '+' : '−') + (a < 1 ? a.toFixed(1) : String(Math.round(a)))
}

/** "Why did it change?" panel: last 10 ledger entries + totals by cause. */
function WhyPanel({ rel, onClose }: { rel: Relationship; onClose: () => void }) {
  const hist = relationHistory(rel, 10)
  const totals = (Object.entries(relationCauseTotals(rel)) as [RelationCause, number][]).filter(([, v]) => v !== 0)
  totals.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  return (
    <Modal open onClose={onClose} title={t('life.why.title', { name: rel.name })} size="md" class="life-why">
      {hist.length === 0 ? <p class="t-mid">{t('life.why.empty')}</p> : (
        <div class="stack">
          {totals.length > 0 && (
            <section aria-label={t('life.why.totals')}>
              <h3 class="micro t-mid">{t('life.why.totals')}</h3>
              <div class="life-why-totals">
                {totals.map(([c, v]) => (
                  <span key={c} class={`life-why-total ${v >= 0 ? 't-pos' : 't-neg'}`}>
                    <Icon name={CAUSE_ICON[c]} size={14} /> {t(`life.why.cause.${c}`)} <b class="num">{fmtD(v)}</b>
                  </span>
                ))}
              </div>
            </section>
          )}
          <h3 class="micro t-mid">{t('life.why.recent')}</h3>
          <ol class="life-why-list">
            {hist.map((e, i) => (
              <li key={i} class="life-why-row" data-cause={e.cause}>
                <span class="life-why-icon" aria-hidden="true"><Icon name={CAUSE_ICON[e.cause]} size={16} /></span>
                <span class="grow life-why-main">
                  <span class="life-why-text">{lt(e.why)}</span>
                  <span class="t-xs t-lo">
                    {t(`life.why.cause.${e.cause}`)} · {t('life.why.when', { season: START_YEAR + Math.floor(e.w / 52), week: (e.w % 52) + 1 })}
                    {e.n && e.n > 1 ? ` · ${t('life.why.merged', { n: e.n })}` : ''}
                  </span>
                </span>
                <span class="life-why-num">
                  <span class={`num life-why-d ${e.d >= 0 ? 't-pos' : 't-neg'}`}>{fmtD(e.d)}</span>
                  <span class="t-xs t-lo num">{t('life.why.after', { v: Math.round(e.v) })}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  )
}

const costText = (k: InteractionKind): string => {
  const c = INTERACT_COST[k]
  const parts = [t('life.rel.cost.energy', { n: c.energy })]
  if (c.money > 0) parts.push(formatMoney(c.money))
  return parts.join(' · ')
}

const TREND_ICON: Record<'up' | 'down' | 'flat', IconName> = { up: 'trend-up', down: 'trend-down', flat: 'arrow-right' }

function PersonCard({ rel, week }: { rel: Relationship; week: number }) {
  const s = gameState.value
  const [why, setWhy] = useState(false)
  const ago = Math.max(0, week - rel.lastContactWeek)
  const band = relBand(rel.value)
  const group = relGroup(rel.kind)
  const pct = passPercent(rel.value)
  const trend = relTrend(rel, week)
  const memory = rel.memory[0]
  const canFriend = canBeCloseFriend(rel)
  const toggleFriend = () => {
    const r = actions.toggleCloseFriend(rel.id)
    if (r === 'full') toast(t('life.rel.friend.full', { n: MAX_CLOSE_FRIENDS }), 'info', 'users')
    else if (r === 'added') toast(t('life.rel.friend.added', { name: rel.name }), 'success', 'heart')
    else if (r === 'removed') toast(t('life.rel.friend.removed', { name: rel.name }), 'info', 'users')
  }
  const interact = (k: InteractionKind) => {
    const deltas = actions.interact(rel.id, k)
    toast(deltas.length ? t('life.rel.done', { name: rel.name, deltas: deltasText(deltas) }) : t('life.rel.doneEmpty', { name: rel.name }), 'success', 'heart')
  }
  return (
    <article class="life-person card card-default pad-md">
      <div class="life-person-head">
        <Avatar appearance={relAppearance(rel, s?.world)} size={56} background="#1b2740" age={relAge(rel.kind)} mood={rel.value / 100} ring={ringColor(rel.value)} />
        <div class="grow">
          <div class="life-person-kind micro">{t(`data.relation.${rel.kind}`)}</div>
          <h3 class="h3 truncate">{rel.name}{rel.closeFriend && <span class="life-friend-badge" data-testid="close-friend-badge" title={t('life.rel.friend.badge')}> ★</span>}</h3>
          <Hearts value={rel.value} />
          <div class="life-person-band" data-testid="rel-band" data-band={band}>
            <Chip tone={band === 'enemy' || band === 'cold' ? 'neg' : band === 'neutral' ? 'neutral' : 'pos'}>{t(`life.rel.band.${band}`)}</Chip>
            <span class="num t-xs t-mid">{Math.round(rel.value)}</span>
            <span class={`life-person-trend is-${trend.trend}`} title={t(`life.rel.trend.${trend.trend}`)} data-testid="rel-trend">
              <Icon name={TREND_ICON[trend.trend]} size={14} weight={2.4} />
              <span class="sr-only">{t(`life.rel.trend.${trend.trend}`)}</span>
            </span>
          </div>
        </div>
      </div>
      <p class="life-person-effect t-xs t-mid" data-testid="rel-effect">
        <span class="micro">{t('life.rel.bandsTitle')}</span> {t(`life.rel.effect.${group}.${band}`, { pct: `${pct > 0 ? '+' : ''}${pct}%` })}
      </p>
      <p class={`life-person-memory t-sm ${memory ? 't-mid' : 't-lo'}`}>{memory ? `“${lt(memory)}”` : t('life.rel.noMemory')}</p>
      {rel.memory.length > 1 && (
        <ul class="life-person-memories t-xs t-lo" data-testid="rel-memories">
          {rel.memory.slice(1, 5).map((m, i) => <li key={i}>{`“${lt(m)}”`}</li>)}
        </ul>
      )}
      <div class="row-between life-person-sub">
        <span class="t-xs t-lo">{ago === 0 ? t('life.rel.thisWeek') : t('life.rel.lastContact', { n: ago })}</span>
        <div class="life-person-tools">
          {canFriend && (
            <Button size="sm" variant="ghost" icon={rel.closeFriend ? 'heart' : 'users'} class="life-friend-btn" data-testid="close-friend-toggle" aria-pressed={!!rel.closeFriend} onClick={toggleFriend}>
              {rel.closeFriend ? t('life.rel.friend.remove') : t('life.rel.friend.add')}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon="history" class="life-why-btn" onClick={() => setWhy(true)}>{t('life.why.button')}</Button>
        </div>
      </div>
      {why && <WhyPanel rel={rel} onClose={() => setWhy(false)} />}
      <div class="life-person-actions" role="group" aria-label={t('life.rel.interactLabel', { name: rel.name })}>
        {INTERACTIONS[rel.kind].map((k) => (
          <Button key={k} size="sm" variant="ghost" icon={INTERACT_ICON[k]} onClick={() => interact(k)} title={costText(k)} aria-label={`${t(`data.interaction.${k}`)}, ${costText(k)}`}>
            {t(`data.interaction.${k}`)}
            <span class="life-act-cost num" aria-hidden="true">{costText(k)}</span>
          </Button>
        ))}
      </div>
    </article>
  )
}

export function Relations() {
  const s = gameState.value
  if (!s) return null
  const rels = Object.values(s.life.relationships)
  if (!rels.length) return <EmptyState icon="users" text={t('life.rel.empty')} />
  return (
    <div class="stack" style={{ ['--gap' as string]: 'var(--sp-6)' }}>
      <section class="stack life-friends" data-testid="close-friends" aria-label={t('life.rel.friend.title')}>
        <SectionTitle>{t('life.rel.friend.title')}</SectionTitle>
        <p class="t-sm t-mid">{t('life.rel.friend.perks', { n: MAX_CLOSE_FRIENDS, min: CLOSE_FRIEND_MIN })}</p>
        <div class="row life-friend-list">
          {closeFriends(s.life).length === 0
            ? <span class="t-sm t-lo">{t('life.rel.friend.none', { n: MAX_CLOSE_FRIENDS })}</span>
            : closeFriends(s.life).map((f) => (
              <Chip key={f.id} tone={f.value >= CLOSE_FRIEND_MIN ? 'pos' : 'neutral'}>{`★ ${f.name} · ${Math.round(f.value)}`}</Chip>
            ))}
        </div>
      </section>
      {GROUPS.map((g) => {
        const list = rels.filter((r) => GROUP_OF[r.kind] === g).sort((a, b) => b.value - a.value)
        if (!list.length) return null
        return (
          <section key={g} class="stack">
            <SectionTitle>{t(`life.rel.groups.${g}`)}</SectionTitle>
            {g === 'family' && typeof s.life.flags.family_structure === 'string' && <p class="t-sm t-mid" data-testid="family-structure">{t(HOUSEHOLD_KEY[s.life.flags.family_structure] ?? 'life.rel.household.both')}</p>}
            <div class="life-people">
              {list.map((r) => <PersonCard key={r.id} rel={r} week={(s.calendar.season - START_YEAR) * 52 + s.calendar.week} />)}
            </div>
          </section>
        )
      })}
      <section class="stack life-fangroups" data-testid="fan-groups" aria-label={t('life.rel.fanGroups.title')}>
        <SectionTitle>{t('life.rel.fanGroups.title')}</SectionTitle>
        <div class="life-people">
          {FAN_GROUPS.map((g) => {
            const v = fanGroupValue(s.life, g.id)
            return (
              <article key={g.id} class="life-person card card-default pad-md" data-testid={`fan-group-${g.id}`}>
                <div class="life-person-head">
                  <div class="grow">
                    <div class="life-person-kind micro">{t('life.rel.fanGroups.group')}</div>
                    <h3 class="h3 truncate">{lt(g.name)}</h3>
                    <Hearts value={v} />
                    <div class="life-person-band"><Chip tone={v < -10 ? 'neg' : v < 20 ? 'neutral' : 'pos'}>{t(`life.rel.band.${relBand(v)}`)}</Chip><span class="num t-xs t-mid">{Math.round(v)}</span></div>
                  </div>
                </div>
                <p class="t-sm t-mid">{lt(g.wants)}</p>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
