import { useState } from 'preact/hooks'
import type { RelationCause, RelationKind, Relationship } from '../../../core/types'
import { relationCauseTotals, relationHistory } from '../../../sim/life/relationships'
import { START_YEAR } from '../../../core/config'
import { lt, t } from '../../../i18n'
import { Avatar, Button, EmptyState, Hearts, Modal, SectionTitle, toast } from '../../components'
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

function PersonCard({ rel, week }: { rel: Relationship; week: number }) {
  const s = gameState.value
  const [why, setWhy] = useState(false)
  const ago = Math.max(0, week - rel.lastContactWeek)
  const memory = rel.memory[0]
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
          <h3 class="h3 truncate">{rel.name}</h3>
          <Hearts value={rel.value} />
        </div>
      </div>
      <p class={`life-person-memory t-sm ${memory ? 't-mid' : 't-lo'}`}>{memory ? `“${lt(memory)}”` : t('life.rel.noMemory')}</p>
      {rel.memory.length > 1 && (
        <ul class="life-person-memories t-xs t-lo" data-testid="rel-memories">
          {rel.memory.slice(1, 5).map((m, i) => <li key={i}>{`“${lt(m)}”`}</li>)}
        </ul>
      )}
      <div class="row-between life-person-sub">
        <span class="t-xs t-lo">{ago === 0 ? t('life.rel.thisWeek') : t('life.rel.lastContact', { n: ago })}</span>
        <Button size="sm" variant="ghost" icon="history" class="life-why-btn" onClick={() => setWhy(true)}>{t('life.why.button')}</Button>
      </div>
      {why && <WhyPanel rel={rel} onClose={() => setWhy(false)} />}
      <div class="life-person-actions" role="group" aria-label={t('life.rel.interactLabel', { name: rel.name })}>
        {INTERACTIONS[rel.kind].map((k) => (
          <Button key={k} size="sm" variant="ghost" icon={INTERACT_ICON[k]} onClick={() => interact(k)}>
            {t(`data.interaction.${k}`)}
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
      {GROUPS.map((g) => {
        const list = rels.filter((r) => GROUP_OF[r.kind] === g).sort((a, b) => b.value - a.value)
        if (!list.length) return null
        return (
          <section key={g} class="stack">
            <SectionTitle>{t(`life.rel.groups.${g}`)}</SectionTitle>
            <div class="life-people">
              {list.map((r) => <PersonCard key={r.id} rel={r} week={(s.calendar.season - START_YEAR) * 52 + s.calendar.week} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
