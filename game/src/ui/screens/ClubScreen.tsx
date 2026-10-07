import { useState } from 'preact/hooks'
import { lt, t } from '../../i18n'
import {
  Avatar, Button, Card, CardHeader, Chip, Crest, EmptyState, Hearts, Kit, LeagueTable, Modal, Page, SectionTitle, StatBar,
  Tabs, TabPanel, toast,
} from '../components'
import { ageOf, attrColor, formatMoney, formatNumber } from '../format'
import { Icon } from '../icons'
import { actions, data, gameState, heroClub, navigate, screen, type FixtureView, type InteractionKind, type SquadMemberView } from '../store'
import { LINES, faceFor, lineOf } from './career/attrs'
import { deltaText, pickTab } from './career/util'
import { zonesFor } from './career/league'
import '../../styles/screens/club.css'

type TabId = 'squad' | 'fixtures' | 'table' | 'info'
const TAB_IDS: TabId[] = ['squad', 'fixtures', 'table', 'info']

function MateSheet({ m, onClose }: { m: SquadMemberView | null; onClose: () => void }) {
  const s = gameState.value!
  if (!m) return null
  const p = m.player
  const rel = m.relationId ? s.life.relationships[m.relationId] : undefined
  const club = heroClub.value
  const act = (k: InteractionKind) => {
    if (!m.relationId) return
    const d = actions.interact(m.relationId, k)
    toast(d.length ? `${t('club.mate.result', { name: p.lastName })}: ${deltaText(d)}` : t('club.mate.result', { name: p.lastName }), 'success', 'heart')
  }
  return (
    <Modal open onClose={onClose} title={`${p.firstName} ${p.lastName}`} size="sm">
      <div class="stack club-mate">
        <div class="row club-mate-head">
          <Avatar appearance={p.appearance} size={72} background={club?.colors.primary ?? '#24345a'} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} mood={(m.relation ?? 0) / 100} />
          <div class="grow stack" style={{ ['--gap' as string]: '6px' }}>
            <div class="row wrap">
              <Chip tone="info">{t(`data.pos.${p.position}`)}</Chip>
              <Chip>{t('club.squad.age', { n: ageOf(p.birthYear, s.calendar) })}</Chip>
              <Chip tone="violet">{t(`data.personality.${p.personality}`)}</Chip>
            </div>
            <span class="score-font club-mate-ovr" style={{ color: attrColor(p.ovr) }}>{p.ovr}</span>
          </div>
        </div>
        <div>
          <div class="micro t-mid">{t('club.squad.relation')}</div>
          {m.relation !== null ? <Hearts value={m.relation} size={20} /> : <span class="t-sm t-lo">{t('club.squad.unknown')}</span>}
        </div>
        <p class="t-xs t-lo">{t('club.mate.passHint')}</p>
        {rel ? (
          <div>
            <div class="micro t-mid">{t('club.mate.memory')}</div>
            {rel.memory.length ? (
              <ul class="club-memory">
                {rel.memory.map((x, i) => <li key={i}>{lt(x)}</li>)}
              </ul>
            ) : (
              <p class="t-sm t-lo">{t('club.mate.noMemory')}</p>
            )}
          </div>
        ) : (
          <p class="t-sm t-lo">{t('club.mate.noRelation')}</p>
        )}
        {m.relationId && (
          <div class="club-mate-actions">
            <Button size="sm" icon="phone" onClick={() => act('call')}>{t('data.interaction.call')}</Button>
            <Button size="sm" icon="fork-knife" onClick={() => act('dinner')}>{t('data.interaction.dinner')}</Button>
            <Button size="sm" icon="barbell" onClick={() => act('train')}>{t('data.interaction.train')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Squad() {
  const s = gameState.value!
  const h = s.hero
  const club = heroClub.value!
  const squad = data.squad()
  const [sel, setSel] = useState<SquadMemberView | null>(null)
  const [confirm, setConfirm] = useState(false)
  const c = h.contract
  return (
    <div class="club-squad-layout">
      <div class="club-manager-col">
        <Card pad="md" class="club-manager">
          <CardHeader title={t('club.manager.title')} icon="whistle" />
          <div class="row club-manager-row">
            <Avatar appearance={faceFor(club.managerName)} size={56} background="#24345a" age={52} />
            <div class="grow">
              <div class="h3 truncate">{club.managerName}</div>
              {c && <Chip tone="gold" icon="star">{t(`data.role.${c.role}`)}</Chip>}
            </div>
          </div>
          <StatBar label={t('club.manager.trust')} value={h.managerTrust} color={h.managerTrust < 35 ? 'var(--state-danger)' : h.managerTrust < 60 ? 'var(--accent-gold)' : 'var(--brand-pitch)'} />
          <Button variant="ghost" size="sm" icon="sign-out" onClick={() => setConfirm(true)}>{t('club.manager.request')}</Button>
        </Card>
      </div>
      <div class="club-lines">
        <p class="t-sm t-lo">{t('club.squad.count', { n: squad.length + 1 })}</p>
        {LINES.map((line) => {
          const members = squad.filter((m) => lineOf(m.player.position) === line).sort((a, b) => b.player.ovr - a.player.ovr)
          const heroHere = lineOf(h.position) === line
          if (!members.length && !heroHere) return null
          return (
            <section key={line} class="club-line" aria-labelledby={`club-line-${line}`}>
              <h3 class={`club-line-title club-line-${line}`} id={`club-line-${line}`}>{t(`club.lines.${line}`)}</h3>
              <div class="club-rows">
                {heroHere && (
                  <div class="club-row is-hero">
                    <span class="club-num num">{h.shirtNumber}</span>
                    <Avatar appearance={h.appearance} size={40} shirt={club.colors.primary} shirtTrim={club.colors.secondary} />
                    <span class="club-row-main">
                      <span class="club-row-name truncate">{h.firstName} {h.lastName}</span>
                      <span class="t-xs t-lo">{t('club.squad.you')} · {t('club.squad.age', { n: data.heroAge() })}</span>
                    </span>
                    <span class="club-pos">{t(`data.pos.${h.position}`)}</span>
                    <span class="club-ovr num" style={{ color: attrColor(data.heroOvr()) }}>{data.heroOvr()}</span>
                  </div>
                )}
                {members.map((m) => {
                  const p = m.player
                  return (
                    <button key={p.id} type="button" class="club-row" onClick={() => setSel(m)}>
                      <span class="club-num num">{(p.styleSeed % 40) + 2}</span>
                      <Avatar appearance={p.appearance} size={40} shirt={club.colors.primary} shirtTrim={club.colors.secondary} />
                      <span class="club-row-main">
                        <span class="club-row-name truncate">{p.firstName} {p.lastName}</span>
                        <span class="club-row-sub">
                          {m.relation !== null ? <Hearts value={m.relation} size={12} /> : <span class="t-xs t-lo">{t('club.squad.unknown')}</span>}
                          {p.injuredWeeks > 0 && <span class="club-inj"><Icon name="first-aid" size={12} />{t('club.squad.injured', { n: p.injuredWeeks })}</span>}
                        </span>
                      </span>
                      <span class="club-pos">{t(`data.pos.${p.position}`)}</span>
                      <span class="club-ovr num" style={{ color: attrColor(p.ovr) }}>{p.ovr}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <MateSheet m={sel} onClose={() => setSel(null)} />
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('club.manager.confirmTitle')}
        size="sm"
        footer={
          <div class="row club-confirm">
            <Button variant="ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon="sign-out" onClick={() => { actions.requestTransfer(); setConfirm(false); toast(t('club.manager.sent'), 'warning') }}>
              {t('club.manager.confirm')}
            </Button>
          </div>
        }
      >
        <p class="t-mid">{t('club.manager.confirmText')}</p>
      </Modal>
    </div>
  )
}

function FixtureRow({ f }: { f: FixtureView }) {
  const r = f.result
  let res: 'W' | 'D' | 'L' | null = null
  if (r) {
    const us = f.isHome ? r.home : r.away
    const them = f.isHome ? r.away : r.home
    res = us > them ? 'W' : us < them ? 'L' : 'D'
  }
  return (
    <li class={`club-fx${res ? ` res-${res}` : ''}${!r && f.daysUntil === 0 ? ' is-today' : ''}`}>
      <div class="club-fx-meta">
        <span class="club-fx-ha">{f.isHome ? t('club.fixtures.home') : t('club.fixtures.away')}</span>
        <span class="t-xs t-lo truncate">{t(`data.comp.${f.compType}`)} · {t('common.weekShort', { n: f.week + 1 })}</span>
      </div>
      <div class="club-fx-teams">
        <span class="club-fx-team is-home"><span class="truncate">{f.home.name}</span><Crest crest={f.home.crest} size={26} compact /></span>
        <span class="club-fx-score num">
          {r ? `${r.home} – ${r.away}` : f.daysUntil === 0 ? t('common.today') : t('common.inDays', { n: f.daysUntil })}
        </span>
        <span class="club-fx-team"><Crest crest={f.away.crest} size={26} compact /><span class="truncate">{f.away.name}</span></span>
      </div>
      {res && <span class={`club-fx-res res-${res}`} title={t(`club.fixtures.result.${res}`)}>{t(`data.result.${res}`)}</span>}
    </li>
  )
}

function Fixtures() {
  const fx = data.fixtures()
  if (!fx.length) return <EmptyState icon="calendar" title={t('club.fixtures.empty')} />
  const upcoming = fx.filter((f) => !f.result)
  const played = fx.filter((f) => f.result).reverse()
  return (
    <div class="club-fx-grid">
      <section>
        <SectionTitle>{t('club.fixtures.upcoming')}</SectionTitle>
        <ul class="club-fx-list">{upcoming.map((f) => <FixtureRow key={f.fixtureId} f={f} />)}</ul>
      </section>
      <section>
        <SectionTitle>{t('club.fixtures.played')}</SectionTitle>
        <ul class="club-fx-list">{played.map((f) => <FixtureRow key={f.fixtureId} f={f} />)}</ul>
      </section>
    </div>
  )
}

function Table() {
  const s = gameState.value!
  const club = heroClub.value!
  const table = data.leagueTable(club.leagueId)
  const lg = s.world.leagues[club.leagueId]
  if (!table) return <EmptyState icon="list" title={t('club.table.empty')} />
  return (
    <div class="stack">
      {lg && <p class="t-sm t-mid">{t('club.table.league', { name: lg.name, tier: lg.tier })}</p>}
      <LeagueTable rows={table} team={(id) => data.team(id)} highlightId={club.id} zones={zonesFor(club, s.world.leagues)} caption={t('ui.table.caption', { league: lg?.name ?? '' })} />
    </div>
  )
}

function Info() {
  const club = heroClub.value!
  const items: { label: string; value: string }[] = [
    { label: t('club.info.city'), value: club.city },
    { label: t('club.info.stadium'), value: club.stadium.name },
    { label: t('club.info.capacity'), value: formatNumber(club.stadium.capacity) },
    { label: t('club.info.manager'), value: club.managerName },
    { label: t('club.info.formation'), value: club.formation },
    { label: t('club.info.style'), value: t(`club.style.${club.style}`) },
    { label: t('club.info.budget'), value: formatMoney(club.budget, { compact: true }) },
    { label: t('club.info.wageBudget'), value: formatMoney(club.wageBudget, { compact: true }) },
  ]
  return (
    <div class="club-info">
      <Card pad="lg" class="club-info-hero" style={{ ['--c1' as string]: club.colors.primary, ['--c2' as string]: club.colors.secondary }}>
        <Crest crest={club.crest} size={110} label={club.name} />
        <div class="grow">
          <h2 class="h1 club-info-name">{club.name}</h2>
          <div class="t-mid">{club.city}</div>
          <div class="club-info-rep">
            <StatBar label={t('club.info.reputation')} value={club.reputation} color="var(--accent-gold)" />
          </div>
        </div>
      </Card>
      <Card pad="md">
        <dl class="club-dl">
          {items.map((i) => (
            <div key={i.label}><dt>{i.label}</dt><dd class="num">{i.value}</dd></div>
          ))}
        </dl>
      </Card>
      <Card pad="md">
        <CardHeader title={t('club.info.kits')} icon="shirt" />
        <div class="club-kits">
          <figure><Kit kit={club.colors} size={110} number={gameState.value?.hero.shirtNumber} /><figcaption>{t('club.info.home')}</figcaption></figure>
          <figure><Kit kit={club.awayColors} size={110} number={gameState.value?.hero.shirtNumber} /><figcaption>{t('club.info.away')}</figcaption></figure>
        </div>
      </Card>
    </div>
  )
}

export function ClubScreen() {
  const s = gameState.value
  const club = heroClub.value
  const [tab, setTab] = useState<TabId>(pickTab(screen.value.params?.tab, TAB_IDS, 'squad'))
  if (!s || !club)
    return (
      <Page title={t('club.title')}>
        <EmptyState icon="shield" title={t('club.noClub')} text={t('club.noClubHint')} action={<Button variant="primary" onClick={() => navigate('world', { tab: 'interest' })}>{t('club.seeInterest')}</Button>} />
      </Page>
    )
  return (
    <Page
      title={club.name}
      sub={<span class="row"><Crest crest={club.crest} size={18} compact />{club.stadium.name}</span>}
      wide
      class="club-page"
    >
      <Tabs
        idPrefix="club"
        label={t('club.title')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'squad', label: t('club.tabs.squad'), icon: 'users' },
          { id: 'fixtures', label: t('club.tabs.fixtures'), icon: 'calendar' },
          { id: 'table', label: t('club.tabs.table'), icon: 'list' },
          { id: 'info', label: t('club.tabs.info'), icon: 'shield' },
        ]}
      />
      <TabPanel id={tab} idPrefix="club">
        {tab === 'squad' && <Squad />}
        {tab === 'fixtures' && <Fixtures />}
        {tab === 'table' && <Table />}
        {tab === 'info' && <Info />}
      </TabPanel>
    </Page>
  )
}
