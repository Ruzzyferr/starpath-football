import type { ObjectiveView } from '../../../sim/game'
import { lt, t } from '../../../i18n'
import { Chip } from '../../components'

const pct = (o: ObjectiveView): number => Math.round(Math.max(0, Math.min(1, o.ratio)) * 100)

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
            <Chip tone="gold" icon="gift" title={t('objectives.reward')}>{lt(o.reward)}</Chip>
            {o.penalty && <Chip tone="neg" icon="warning" title={t('objectives.penalty')}>{lt(o.penalty)}</Chip>}
          </span>
        </div>
      </div>
    </li>
  )
}
