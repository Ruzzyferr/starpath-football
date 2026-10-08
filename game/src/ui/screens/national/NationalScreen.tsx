import '../../../styles/screens/intl.css'
import { useState } from 'preact/hooks'
import { lt, t } from '../../../i18n'
import { Card, Chip, Crest, EmptyState, Page, SectionTitle, TabPanel, Tabs } from '../../components'
import { seasonLabel } from '../../format'
import { gameState, screen } from '../../store'
import { nationalView } from '../../backend/worldViews'
import { MiniTable, TieList, TieRow } from '../cup/CupParts'
import { pickTab } from '../career/util'
import { NationalCard } from './NationalCard'

type TabId = 'overview' | 'squad' | 'fixtures' | 'tables' | 'honours'
const TABS: TabId[] = ['overview', 'squad', 'fixtures', 'tables', 'honours']

export function NationalScreen() {
  const s = gameState.value
  const [tab, setTab] = useState<TabId>(pickTab(screen.value.params?.tab, TABS, 'overview'))
  const v = nationalView()
  if (!s || !v) return <Page title={t('intl.national.title')} backTo="home"><EmptyState /></Page>
  const mine = new Set([v.teamId, s.world.national?.hero.teamId ?? ''])

  let body = null
  if (tab === 'overview') {
    body = (
      <div class="stack">
        <NationalCard detailed />
        <Card pad="md">
          <SectionTitle>{t('intl.national.next')}</SectionTitle>
          {v.next ? <ul class="cup-ties"><TieRow r={v.next} /></ul> : <p class="t-sm t-lo">{t('intl.national.noFixture')}</p>}
          <p class="t-xs t-lo" style={{ marginTop: 'var(--sp-2)' }}>{t('intl.national.coach', { n: v.card?.coach ?? '—' })} · {t('intl.national.youthCaps', { c: v.card?.youthCaps ?? 0, g: v.card?.youthGoals ?? 0 })}</p>
          <p class="t-xs t-lo">{t('intl.national.tournamentInfo')}</p>
        </Card>
        {v.log.length > 0 && (
          <ul class="nt-list">
            {v.log.map((e, i) => (
              <li key={i} class="nt-row">
                <Crest crest={e.opp.crest} size={22} compact />
                <span class="grow truncate">{e.opp.name} <span class="t-xs t-lo">· {lt(e.comp)}</span></span>
                <span class="cup-score">{e.gf}-{e.ga}</span>
                {e.goals > 0 && <Chip tone="pos" icon="ball">{e.goals}</Chip>}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  } else if (tab === 'squad') {
    body = v.squad.length === 0 ? <EmptyState icon="users" title={t('intl.national.squadEmpty')} /> : (
      <ul class="nt-list" data-testid="nt-squad">
        {v.squad.map((p) => (
          <li key={p.id} class={`nt-row${p.isHero ? ' is-hero' : ''}`}>
            <span class="nt-pos">{t(`data.pos.${p.position}`)}</span>
            <span class="grow truncate">{p.isHero ? `${p.name} (${t('intl.national.you')})` : p.name}<span class="t-xs t-lo"> · {p.club}</span></span>
            <span class="t-xs t-lo num">{p.age}</span>
            <span class="nt-ovr num">{p.ovr}</span>
          </li>
        ))}
      </ul>
    )
  } else if (tab === 'fixtures') {
    const all = v.comps.flatMap((c) => c.fixtures.map((f) => ({ f, c }))).sort((a, b) => a.f.week - b.f.week || a.f.day - b.f.day)
    body = all.length === 0 ? <EmptyState icon="calendar" title={t('intl.national.noFixture')} /> : (
      <div class="stack" style={{ gap: 'var(--sp-2)' }}>{all.map(({ f, c }) => (
        <div key={f.fixtureId} class="stack" style={{ gap: 2 }}>
          <span class="t-xs t-lo">{lt(c.name)} · {t('common.weekShort', { n: f.week + 1 })}</span>
          <ul class="cup-ties"><TieRow r={f} /></ul>
        </div>
      ))}</div>
    )
  } else if (tab === 'tables') {
    body = (
      <div class="stack">
        {v.comps.filter((c) => c.groups.length || c.knockout.length).map((c) => (
          <Card key={c.id} pad="md" class="stack">
            <SectionTitle>{lt(c.name)}</SectionTitle>
            {c.hostId && <span class="t-xs t-lo">{t('intl.national.host', { n: s.world.countries[c.hostId] ? lt(s.world.countries[c.hostId]!.name) : c.hostId })}</span>}
            {c.groups.map((g, i) => <MiniTable key={i} g={g} highlight={mine} qualify={c.format === 'nt_finals' ? 2 : c.format === 'nt_qual' ? 1 : 0} />)}
            {c.knockout.length > 0 && <><h3 class="micro t-mid">{t('intl.national.knockout')}</h3><TieList ties={c.knockout} /></>}
            {c.winner && <Chip tone="gold" icon="trophy">{t('intl.national.winner', { n: c.winner.name })}</Chip>}
          </Card>
        ))}
      </div>
    )
  } else {
    body = v.honours.length === 0 ? <EmptyState icon="trophy" title={t('intl.national.noHonours')} /> : (
      <ul class="nt-list">
        {v.honours.map((h, i) => (
          <li key={i} class="nt-row">
            <span class="t-xs t-lo num">{seasonLabel(h.season)}</span>
            <span class="grow truncate">{lt(h.name)}</span>
            <Crest crest={h.winner.crest} size={22} compact />
            <b class="truncate">{h.winner.name}</b>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Page title={t('intl.national.title')} sub={t('intl.national.sub')} backTo="home" wide>
      <Tabs idPrefix="nt" label={t('intl.national.title')} value={tab} onChange={setTab} items={TABS.map((id) => ({ id, label: t(`intl.national.tabs.${id}`) }))} />
      <TabPanel id={tab} idPrefix="nt">{body}</TabPanel>
    </Page>
  )
}
