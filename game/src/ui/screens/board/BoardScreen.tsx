import '../../../styles/screens/board.css'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { Avatar, IconButton, Card, CardHeader, Chip, EmptyState, Page, Segmented, TabPanel, Tabs } from '../../components'
import { formatNumber, formatRating, seasonLabel } from '../../format'
import { Icon } from '../../icons'
import { gameState, navigate } from '../../store'
import { hallOfFame, metaData, weeklyChallengeView } from '../../backend/meta'
import { CHALLENGES, boardValue, localBoard, type BoardMetric, type PersonalBests } from '../../../sim/game/localMeta'
import { ExportCsvButton, ShareCareerButton } from '../../share/ShareButtons'

type Tab = 'challenge' | 'careers' | 'bests'
const METRICS: BoardMetric[] = ['legacy', 'goals', 'assists', 'apps', 'trophies']
const BEST_ROWS: { key: keyof PersonalBests; fmt: (v: number) => string }[] = [
  { key: 'bestRating', fmt: (v) => formatRating(v) },
  { key: 'goalsMatch', fmt: String },
  { key: 'assistsMatch', fmt: String },
  { key: 'biggestWin', fmt: (v) => `+${v}` },
  { key: 'matches', fmt: (v) => formatNumber(v) },
]

function Challenge() {
  const v = weeklyChallengeView()
  const m = metaData.value.local
  const s = gameState.value
  const done = Object.entries(m.challenges).sort((a, b) => {
    const [as, aw] = a[0].split(':').map(Number)
    const [bs, bw] = b[0].split(':').map(Number)
    return bs - as || bw - aw
  }).slice(0, 12)
  return (
    <div class="stack" style={{ gap: '12px' }}>
      {v && s ? (
        <section class={`bd-hero${v.done ? ' is-done' : ''}`} data-testid="weekly-challenge" aria-labelledby="bd-ch-title">
          <span class="bd-badge" aria-hidden="true"><Icon name={v.done ? 'check' : v.def.icon} size={34} weight={2.2} /></span>
          <div class="grow stack" style={{ gap: '4px', minWidth: 0 }}>
            <span class="micro t-lo">{t('board.challenge.week')} · {t('board.challenge.weekN', { s: seasonLabel(s.calendar.season), w: s.calendar.week + 1 })}</span>
            <h2 class="h2" id="bd-ch-title">{lt(v.def.title)}</h2>
            <p class="t-sm t-mid">{lt(v.def.desc)}</p>
            <p class="t-xs t-lo">{v.done ? t('board.challenge.doneNote', { o: v.done.opponent, r: formatRating(v.done.rating) }) : t('board.challenge.pendingNote')}</p>
          </div>
          <Chip tone={v.done ? 'pos' : 'neutral'} icon={v.done ? 'check' : 'hourglass'} solid={!!v.done}>{v.done ? t('board.challenge.done') : t('board.challenge.pending')}</Chip>
        </section>
      ) : (
        <EmptyState icon="flag" text={t('board.challenge.noCareer')} compact />
      )}
      <div class="bd-kpis">
        <div class="bd-kpi"><span class="micro t-lo">{t('board.challenge.streak')}</span><b class="score-font num">{m.streak}</b></div>
        <div class="bd-kpi"><span class="micro t-lo">{t('board.challenge.bestStreak')}</span><b class="score-font num">{m.bestStreak}</b></div>
        <div class="bd-kpi"><span class="micro t-lo">{t('board.challenge.total')}</span><b class="score-font num">{Object.keys(m.challenges).length}</b></div>
      </div>
      <Card>
        <CardHeader title={t('board.challenge.history')} icon="history" />
        {done.length === 0 ? (
          <p class="t-sm t-lo">{t('board.challenge.historyEmpty')}</p>
        ) : (
          <ul class="rec-list" data-testid="challenge-history">
            {done.map(([key, d]) => {
              const [se, wk] = key.split(':').map(Number)
              const def = CHALLENGES.find((c) => c.id === d.id)
              return (
                <li key={key}>
                  <span><Icon name="check" size={14} class="t-pos" /> {def ? lt(def.title) : d.id}<span class="t-xs t-lo"> · {t('board.challenge.weekRow', { s: seasonLabel(se), w: wk + 1 })}</span></span>
                  <b class="num">{formatRating(d.rating)}</b>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Careers() {
  const [metric, setMetric] = useState<BoardMetric>('legacy')
  const list = localBoard(hallOfFame(), metric)
  if (list.length === 0) return <EmptyState icon="crown" text={t('board.careers.empty')} compact />
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <Segmented label={t('board.careers.sortBy')} value={metric} onChange={setMetric} options={METRICS.map((id) => ({ id, label: t(`board.metric.${id}`) }))} />
      <ol class="bd-board" data-testid="career-board" aria-label={t('board.tab.careers')}>
        {list.map((e, i) => (
          <li key={e.careerId} class={`bd-row${i < 3 ? ` bd-top bd-top-${i + 1}` : ''}`}>
            <span class="bd-rank score-font num">{i + 1}</span>
            <Avatar appearance={{ skin: 2, hairStyle: 1, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0, gender: e.gender }} size={40} />
            <div class="grow stack" style={{ gap: '1px', minWidth: 0 }}>
              <span class="h3 truncate">{e.name}</span>
              <span class="t-xs t-mid truncate">{e.position} · {t('meta.hof.seasons', { a: e.startSeason, b: e.endSeason })} · {t('meta.retire.stats', { a: e.totals.apps, g: e.totals.goals, as: e.totals.assists })}</span>
              <span class="bd-actions">
                <IconButton icon="play" label={t('meta.hof.view')} onClick={() => navigate('documentary', { id: e.careerId })} />
                <ShareCareerButton sum={e} />
                <ExportCsvButton sum={e} />
              </span>
            </div>
            <b class="bd-val score-font num">{metric === 'rating' ? formatRating(boardValue(e, metric)) : formatNumber(boardValue(e, metric))}</b>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Bests() {
  const b = metaData.value.local.bests
  if (b.matches === 0) return <EmptyState icon="medal" text={t('board.bests.empty')} compact />
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <div class="bd-tiles" data-testid="personal-bests">
        {BEST_ROWS.map((r) => (
          <div key={r.key} class="bd-tile">
            <span class="micro t-lo">{t(`board.bests.${r.key}`)}</span>
            <b class="score-font num">{r.fmt(b[r.key])}</b>
          </div>
        ))}
      </div>
      <p class="t-xs t-lo">{t('board.bests.note')}</p>
    </div>
  )
}

export function BoardScreen() {
  void currentLang.value
  const [tab, setTab] = useState<Tab>('challenge')
  return (
    <Page title={t('board.title')} sub={t('board.sub')} class="bd-page">
      <Tabs<Tab>
        variant="pill"
        idPrefix="board"
        label={t('board.title')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'challenge', label: t('board.tab.challenge'), icon: 'flag' },
          { id: 'careers', label: t('board.tab.careers'), icon: 'crown' },
          { id: 'bests', label: t('board.tab.bests'), icon: 'medal' },
        ]}
      />
      <TabPanel id={tab} idPrefix="board">
        {tab === 'challenge' ? <Challenge /> : tab === 'careers' ? <Careers /> : <Bests />}
      </TabPanel>
    </Page>
  )
}
