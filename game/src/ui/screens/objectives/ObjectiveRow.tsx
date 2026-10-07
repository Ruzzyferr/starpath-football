import type { ObjectivePart, ObjectiveView } from '../../../sim/game'
import { lt, t } from '../../../i18n'
import { Icon } from '../../icons'
import { Chip, DeltaChip } from '../../components'
import { RELATION_LABEL } from '../../backend/mapping'
import type { RelationKind } from '../../../core/types'
import type { Delta } from '../../store'

const pct = (o: ObjectiveView): number => Math.round(Math.max(0, Math.min(1, o.ratio)) * 100)

/** Reward / penalty components as labelled delta chips (relationship changes name who they are with). */
function PartChips({ parts, sign }: { parts: ObjectivePart[]; sign: 1 | -1 }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.key === 'buzz') return <Chip key={i} tone={sign > 0 ? 'info' : 'neg'} icon="megaphone">{t('objectives.buzz')}</Chip>
        const d: Delta = p.key === 'relation'
          ? { key: 'relation', value: p.value, rel: p.rel as RelationKind, label: RELATION_LABEL[p.rel as RelationKind] }
          : { key: p.key, value: p.value }
        return <DeltaChip key={i} delta={d} />
      })}
    </>
  )
}

/** One active objective: giver avatar, title, progress bar, time left, reward / penalty chips. */
export function ObjectiveRow({ o, detail }: { o: ObjectiveView; detail?: boolean }) {
  const board = o.source === 'board'
  const valueText = board ? t('objectives.boardTarget', { n: o.target }) : t('objectives.progress', { a: o.progress, b: o.target })
  const time = o.seasonal ? t('objectives.seasonEndsIn', { n: o.weeksLeft }) : t('objectives.weeksLeft', { n: o.weeksLeft })
  const label = `${lt(o.title)}: ${valueText}, ${t('objectives.weeksLeftLabel', { n: o.weeksLeft })}`
  return (
    <li class={`obj-row${o.seasonal ? ' is-seasonal' : ''}`} data-testid="objective" data-source={o.source}>
      <span class="obj-avatar" aria-hidden="true" title={lt(o.sourceName)}>{o.icon}</span>
      <div class="obj-main">
        <div class="obj-head">
          <span class="obj-title">{lt(o.title)}</span>
          <span class="obj-time t-xs t-lo">{time}</span>
        </div>
        <div class="obj-giver t-xs t-mid">{lt(o.sourceName)}{detail ? ` · ${lt(o.desc)}` : ''}</div>
        {!board && (
          <div class="obj-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(o)}>
            <span class="obj-bar-fill" style={{ width: `${pct(o)}%` }} />
          </div>
        )}
        <div class="obj-foot">
          <span class="obj-count score-font" aria-hidden="true">{valueText}</span>
          <span class="obj-chips">
            <span class="obj-chip-group" title={t('objectives.reward')} aria-label={`${t('objectives.reward')}: ${lt(o.reward)}`}>
              <Icon name="gift" size={13} weight={2.4} />
              <PartChips parts={o.rewardParts} sign={1} />
            </span>
            {o.penalty && (
              <span class="obj-chip-group" title={t('objectives.penalty')} aria-label={`${t('objectives.penalty')}: ${lt(o.penalty)}`}>
                <Icon name="warning" size={13} weight={2.4} />
                <PartChips parts={o.penaltyParts} sign={-1} />
              </span>
            )}
          </span>
        </div>
      </div>
    </li>
  )
}
