import '../../styles/screens/objectives.css'
import { lt, t } from '../../i18n'
import { Card, EmptyState, Page, SectionTitle } from '../components'
import { Icon } from '../icons'
import { data, gameState } from '../store'
import { ObjectiveRow } from './objectives/ObjectiveRow'

export function ObjectivesScreen() {
  if (!gameState.value) return <Page title={t('objectives.title')}><EmptyState /></Page>
  const o = data.objectives()
  const season = [o.board, o.personal].filter((x): x is NonNullable<typeof x> => !!x)
  return (
    <Page title={t('objectives.title')} sub={t('objectives.sub')} backTo="home">
      <div class="obj-screen">
        <Card class="obj-tally">
          <div class="obj-tally-cell"><span class="score-font obj-tally-n">{o.seasonDone}</span><span class="micro t-mid">{t('objectives.doneCount')} · {t('objectives.thisSeason')}</span></div>
          <div class="obj-tally-cell"><span class="score-font obj-tally-n">{o.seasonFailed}</span><span class="micro t-mid">{t('objectives.missedCount')} · {t('objectives.thisSeason')}</span></div>
          <div class="obj-tally-cell"><span class="score-font obj-tally-n">{o.done + o.failed > 0 ? `${o.done}/${o.done + o.failed}` : '—'}</span><span class="micro t-mid">{t('objectives.career')}</span></div>
        </Card>

        <section aria-labelledby="obj-active">
          <SectionTitle id="obj-active">{t('objectives.active')}</SectionTitle>
          {o.short.length === 0 ? <p class="t-sm t-lo">{t('objectives.none')}</p> : <ul class="obj-list">{o.short.map((x) => <ObjectiveRow key={x.id} o={x} detail />)}</ul>}
        </section>

        {season.length > 0 && (
          <section aria-labelledby="obj-season">
            <SectionTitle id="obj-season">{t('objectives.season')}</SectionTitle>
            <ul class="obj-list">{season.map((x) => <ObjectiveRow key={x.id} o={x} detail />)}</ul>
          </section>
        )}

        <section aria-labelledby="obj-done">
          <SectionTitle id="obj-done">{t('objectives.finished')}</SectionTitle>
          {o.recent.length === 0 ? (
            <p class="t-sm t-lo">{t('objectives.noFinished')}</p>
          ) : (
            <ul class="obj-history">
              {o.recent.map((r, i) => (
                <li key={i} class={`obj-hist obj-hist-${r.status}`} data-testid="objective-result">
                  <span class="obj-avatar obj-avatar-sm" aria-hidden="true">{r.icon}</span>
                  <span class="grow">{lt(r.title)}</span>
                  <span class="obj-hist-status">
                    <Icon name={r.status === 'done' ? 'check' : 'hourglass'} size={14} />
                    {r.status === 'done' ? t('objectives.statusDone') : t('objectives.statusMissed')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  )
}
