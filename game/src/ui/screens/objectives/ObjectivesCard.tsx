import '../../../styles/screens/objectives.css'
import { lt, t } from '../../../i18n'
import { Button, Card, CardHeader } from '../../components'
import { data, navigate } from '../../store'
import { ObjectiveRow } from './ObjectiveRow'

/** Home card: up to three short objectives plus the board and personal season targets. */
export function ObjectivesCard() {
  const o = data.objectives()
  const season = [o.board, o.personal].filter((x): x is NonNullable<typeof x> => !!x)
  return (
    <Card class="obj-card" data-testid="objectives-card">
      <CardHeader
        title={t('objectives.card')}
        icon="target"
        action={<Button variant="ghost" size="sm" iconRight="chevron-right" onClick={() => navigate('objectives')} aria-label={t('objectives.open')}>{t('objectives.seeAll')}</Button>}
      />
      {o.short.length === 0 ? (
        <p class="t-sm t-lo obj-empty">{t('objectives.none')}</p>
      ) : (
        <ul class="obj-list">{o.short.slice(0, 3).map((x) => <ObjectiveRow key={x.id} o={x} />)}</ul>
      )}
      {season.length > 0 && (
        <ul class="obj-season" aria-label={t('objectives.season')}>
          {season.map((x) => (
            <li key={x.id} class="obj-season-row">
              <span class="obj-avatar obj-avatar-sm" aria-hidden="true">{x.icon}</span>
              <span class="grow truncate">
                <span class="micro t-lo">{x.source === 'board' ? t('objectives.board') : t('objectives.personal')}</span>
                <span class="obj-season-title truncate">{lt(x.title)}</span>
              </span>
              <span class="score-font obj-season-val">
                {x.source === 'board' ? `≤${x.target}` : t('objectives.progress', { a: x.progress, b: x.target })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
