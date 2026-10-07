import type { RelationKind, Relationship } from '../../../core/types'
import { START_YEAR } from '../../../core/config'
import { lt, t } from '../../../i18n'
import { Avatar, Button, EmptyState, Hearts, SectionTitle, toast } from '../../components'
import type { IconName } from '../../icons'
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

function PersonCard({ rel, week }: { rel: Relationship; week: number }) {
  const s = gameState.value
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
      <div class="t-xs t-lo">{ago === 0 ? t('life.rel.thisWeek') : t('life.rel.lastContact', { n: ago })}</div>
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
