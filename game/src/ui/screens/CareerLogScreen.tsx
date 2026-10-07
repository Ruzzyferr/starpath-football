import '../../styles/screens/inbox.css'
import { useState } from 'preact/hooks'
import type { LogEntry } from '../../core/types'
import { lt, t, tx } from '../../i18n'
import { EmptyState, Page, Tabs } from '../components'
import { seasonLabel } from '../format'
import { Icon, isIconName, type IconName } from '../icons'
import { gameState } from '../store'

type Kind = NonNullable<LogEntry['kind']> | 'other'
type Filter = Kind | 'all'
const KINDS: Kind[] = ['match', 'event', 'money', 'relation', 'career', 'award', 'injury', 'other']
const KIND_ICON: Record<Kind, IconName> = {
  match: 'ball', event: 'sparkle', money: 'coins', relation: 'heart', career: 'career', award: 'trophy', injury: 'bandage', other: 'list',
}
const kindOf = (e: LogEntry): Kind => e.kind ?? 'other'
const isMilestone = (e: LogEntry) => e.kind === 'award' || e.kind === 'career'

export function CareerLogScreen() {
  const s = gameState.value
  const [filter, setFilter] = useState<Filter>('all')
  if (!s) return <Page title={t('inbox.log.title')}><EmptyState /></Page>
  const all = [...s.life.log].sort((a, b) => b.season - a.season || b.week - a.week || b.day - a.day)
  const list = filter === 'all' ? all : all.filter((e) => kindOf(e) === filter)
  const present = KINDS.filter((k) => all.some((e) => kindOf(e) === k))

  // season → week → entries (already sorted desc)
  const seasons: { season: number; weeks: { week: number; items: LogEntry[] }[] }[] = []
  for (const e of list) {
    let se = seasons[seasons.length - 1]
    if (!se || se.season !== e.season) {
      se = { season: e.season, weeks: [] }
      seasons.push(se)
    }
    let wk = se.weeks[se.weeks.length - 1]
    if (!wk || wk.week !== e.week) {
      wk = { week: e.week, items: [] }
      se.weeks.push(wk)
    }
    wk.items.push(e)
  }

  return (
    <Page title={t('inbox.log.title')} sub={t('inbox.log.sub')}>
      <Tabs
        variant="pill"
        label={t('inbox.log.filterLabel')}
        idPrefix="logf"
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all' as Filter, label: t('inbox.log.all') },
          ...present.map((k) => ({ id: k as Filter, label: t(`inbox.log.kind.${k}`), icon: KIND_ICON[k] })),
        ]}
      />
      {seasons.length === 0 ? (
        <EmptyState icon="history" title={t('inbox.log.empty')} text={t('inbox.log.emptyText')} />
      ) : (
        <div class="log-timeline">
          {seasons.map((se) => (
            <section key={se.season} class="log-season" aria-labelledby={`log-s-${se.season}`}>
              <h2 class="log-season-head" id={`log-s-${se.season}`}>
                <span>{t('inbox.log.seasonHead', { season: seasonLabel(se.season) })}</span>
                <span class="micro t-lo">{t('inbox.log.entries', { n: se.weeks.reduce((n, w) => n + w.items.length, 0) })}</span>
              </h2>
              {se.weeks.map((wk) => (
                <div key={wk.week} class="log-week">
                  <div class="log-week-head micro">{t('inbox.log.weekHead', { n: wk.week + 1 })}</div>
                  <ol class="log-items">
                    {wk.items.map((e, i) => {
                      const k = kindOf(e)
                      const icon: IconName = e.icon && isIconName(e.icon) ? e.icon : KIND_ICON[k]
                      const ms = isMilestone(e)
                      return (
                        <li key={i} class={`log-item kind-${k}${ms ? ' is-milestone' : ''}`}>
                          <span class="log-node" aria-hidden="true"><Icon name={icon} size={ms ? 20 : 16} /></span>
                          <div class="log-body">
                            <div class="log-item-meta">
                              <span class="micro">{t(`inbox.log.kind.${k}`)}</span>
                              <span class="t-xs t-lo">{tx(`data.dayShort.${e.day}`)}</span>
                              {ms && <span class="log-ms micro">{t('inbox.log.milestone')}</span>}
                            </div>
                            <p class="log-text">{lt(e.text)}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}
