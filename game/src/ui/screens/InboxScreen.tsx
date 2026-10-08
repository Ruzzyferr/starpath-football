import '../../styles/screens/inbox.css'
import { useState } from 'preact/hooks'
import type { NewsItem } from '../../core/types'
import { lt, t } from '../../i18n'
import { Avatar, Button, Card, Crest, EmptyState, Modal, Page, Tabs } from '../components'
import { newsCause } from '../../sim/game/newsCause'
import { collapseRepeats } from '../collapseRepeats'
import { seasonLabel } from '../format'
import { Icon } from '../icons'
import { gameState, heroClub, navigate } from '../store'

type Filter = 'all' | 'pos' | 'neu' | 'neg'
const sentKey = (n: NewsItem): Exclude<Filter, 'all'> => (n.sentiment > 0 ? 'pos' : n.sentiment < 0 ? 'neg' : 'neu')
const SENT_ICON = { pos: 'trend-up', neu: 'newspaper', neg: 'trend-down' } as const

/** 2.7#90: opens the event / log lines that produced a headline. */
function StoryCause({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false)
  const s = gameState.value
  if (!s) return null
  const cause = newsCause(s.life, item)
  return (
    <>
      <Button size="sm" variant="ghost" icon="search" onClick={() => setOpen(true)} data-testid="news-cause-btn">{t('inbox.cause.button')}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('inbox.cause.title')} size="sm">
        <p class="t-mid"><b>{lt(item.headline)}</b></p>
        {cause ? (
          <>
            <h3 class="micro t-mid">{t(cause.kind === 'event' ? 'inbox.cause.event' : 'inbox.cause.week')}</h3>
            <ul class="inbox-cause" data-testid="news-cause">
              {cause.entries.map((e, i) => <li key={i}>{lt(e.text)}</li>)}
            </ul>
          </>
        ) : <p class="t-lo">{t('inbox.cause.none')}</p>}
      </Modal>
    </>
  )
}

export function InboxScreen() {
  const s = gameState.value
  const [filter, setFilter] = useState<Filter>('all')
  if (!s) return <Page title={t('inbox.title')}><EmptyState /></Page>
  const club = heroClub.value
  const all = [...s.life.news].reverse().sort((a, b) => b.season - a.season || b.week - a.week)
  const list = filter === 'all' ? all : all.filter((n) => sentKey(n) === filter)
  const [frontC, ...restC] = collapseRepeats(list, (n) => lt(n.headline))
  const front = frontC?.item
  const rest = restC
  const c1 = club?.colors.primary ?? '#1fd47a'
  const c2 = club?.colors.secondary ?? '#0b1220'
  const counts = { pos: 0, neu: 0, neg: 0 }
  all.forEach((n) => counts[sentKey(n)]++)

  return (
    <Page
      title={t('inbox.title')}
      sub={t('inbox.sub')}
      actions={<Button variant="ghost" size="sm" icon="history" onClick={() => navigate('careerLog')}>{t('inbox.careerLog')}</Button>}
    >
      <Tabs
        variant="pill"
        label={t('inbox.filterLabel')}
        idPrefix="newsf"
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all' as Filter, label: t('inbox.filter.all'), badge: all.length },
          { id: 'pos' as Filter, label: t('inbox.filter.pos'), icon: 'trend-up', badge: counts.pos },
          { id: 'neu' as Filter, label: t('inbox.filter.neu'), icon: 'newspaper', badge: counts.neu },
          { id: 'neg' as Filter, label: t('inbox.filter.neg'), icon: 'trend-down', badge: counts.neg },
        ]}
      />

      {!front ? (
        <EmptyState icon="newspaper" title={t('inbox.empty')} text={t('inbox.emptyText')} />
      ) : (
        <div class="inbox-layout">
          <article class={`inbox-front sent-${sentKey(front)}`} aria-labelledby="inbox-front-h">
            <div class="inbox-photo" style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }} aria-hidden="true">
              <div class="inbox-photo-rays" />
              <div class="inbox-photo-pitch" />
              {club && <span class="inbox-photo-crest"><Crest crest={club.crest} size={88} /></span>}
              <span class="inbox-photo-hero">
                <Avatar appearance={s.hero.appearance} size={150} shirt={c1} shirtTrim={c2} mood={front.sentiment * 0.8} />
              </span>
              <span class="inbox-photo-tag micro">{t('inbox.frontPage')}</span>
            </div>
            <div class="inbox-front-text">
              <div class="inbox-meta">
                <span class="inbox-source">{front.source}</span>
                <span class="t-lo">{t('inbox.weekOf', { season: seasonLabel(front.season), n: front.week + 1 })}</span>
              </div>
              <h2 class="inbox-front-head" id="inbox-front-h">{lt(front.headline)}{(frontC?.count ?? 1) > 1 && <span class="log-repeat num" title={t('inbox.log.repeatTip', { n: frontC?.count ?? 1 })}> ×{frontC?.count}</span>}</h2>
              {front.body && <p class="inbox-front-body">{lt(front.body)}</p>}
              <span class={`inbox-sent sent-${sentKey(front)}`}>
                <Icon name={SENT_ICON[sentKey(front)]} size={14} /> {t(`inbox.sentiment.${sentKey(front)}`)}
              </span>
              <StoryCause item={front} />
            </div>
          </article>

          <div class="inbox-side">
            <ol class="inbox-list">
              {rest.map(({ item: n, count }) => {
                const k = sentKey(n)
                return (
                  <li key={n.id} class={`inbox-item sent-${k}`}>
                    <span class="inbox-item-icon" aria-hidden="true"><Icon name={SENT_ICON[k]} size={18} /></span>
                    <div class="grow">
                      <div class="inbox-meta">
                        <span class="inbox-source">{n.source}</span>
                        <span class="t-lo">{t('common.weekShort', { n: n.week + 1 })}</span>
                        <span class="sr-only">{t(`inbox.sentiment.${k}`)}</span>
                      </div>
                      <h3 class="inbox-item-head">{lt(n.headline)}{count > 1 && <span class="log-repeat num" title={t('inbox.log.repeatTip', { n: count })}> ×{count}</span>}</h3>
                      {n.body && <p class="inbox-item-body">{lt(n.body)}</p>}
                      <StoryCause item={n} />
                    </div>
                  </li>
                )
              })}
            </ol>
            <Card variant="accent" class="inbox-transfers">
              <div class="row">
                <span class="inbox-transfers-icon"><Icon name="handshake" size={22} /></span>
                <div class="grow">
                  <h3 class="h3">{t('inbox.transfers')}</h3>
                  <p class="t-sm t-mid">{t('inbox.transfersText')}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" iconRight="chevron-right" onClick={() => navigate('world', { tab: 'transfers' })}>
                {t('inbox.openWorld')}
              </Button>
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}
