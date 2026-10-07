import { useState } from 'preact/hooks'
import type { Club } from '../../core/types'
import { lt, t } from '../../i18n'
import {
  Avatar, Button, Card, Chip, Crest, EmptyState, Flag, Kit, LeagueTable, Modal, Page, SectionTitle, StatBar, Tabs, TabPanel,
} from '../components'
import { attrColor, formatNumber } from '../format'
import { Icon } from '../icons'
import { actions, data, gameState, heroClub, navigate, screen } from '../store'
import { zonesForLeague } from './career/league'
import { pickTab } from './career/util'
import '../../styles/screens/world.css'

type TabId = 'leagues' | 'scorers' | 'transfers' | 'clubs' | 'interest'
const TAB_IDS: TabId[] = ['leagues', 'scorers', 'transfers', 'clubs', 'interest']

/** Country chips + league pills, shared by leagues/scorers/clubs tabs. */
function LeaguePicker({ countryId, leagueId, onCountry, onLeague }: { countryId: string; leagueId: string; onCountry: (id: string) => void; onLeague: (id: string) => void }) {
  const s = gameState.value!
  const countries = Object.values(s.world.countries).filter((c) => Object.values(s.world.leagues).some((l) => l.countryId === c.id))
  const leagues = Object.values(s.world.leagues).filter((l) => l.countryId === countryId).sort((a, b) => a.tier - b.tier)
  return (
    <div class="world-picker">
      <div class="world-countries" role="radiogroup" aria-label={t('world.country')}>
        {countries.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === countryId}
            class={`world-country${c.id === countryId ? ' is-active' : ''}`}
            onClick={() => onCountry(c.id)}
          >
            <Flag id={c.id} colors={c.flag} size={26} />
            <span>{lt(c.name)}</span>
          </button>
        ))}
      </div>
      {leagues.length > 1 && (
        <Tabs
          variant="pill"
          idPrefix="world-lg"
          label={t('world.league')}
          value={leagueId}
          onChange={onLeague}
          items={leagues.map((l) => ({ id: l.id, label: `${l.name}` }))}
        />
      )}
    </div>
  )
}

function ClubSheet({ club, onClose }: { club: Club | null; onClose: () => void }) {
  const s = gameState.value!
  if (!club) return null
  const top = Object.values(s.world.players).filter((p) => p.clubId === club.id).sort((a, b) => b.ovr - a.ovr).slice(0, 5)
  return (
    <Modal open onClose={onClose} title={club.name} size="md">
      <div class="stack world-club-sheet">
        <div class="world-club-sheet-hero" style={{ ['--c1' as string]: club.colors.primary }}>
          <Crest crest={club.crest} size={84} label={club.name} />
          <div class="world-club-kits">
            <Kit kit={club.colors} size={64} />
            <Kit kit={club.awayColors} size={64} />
          </div>
        </div>
        <div class="t-sm t-mid">{club.city} · {t('world.clubs.stadium', { name: club.stadium.name, cap: formatNumber(club.stadium.capacity) })}</div>
        <div class="t-sm t-lo">{t('world.clubs.manager', { name: club.managerName })}</div>
        <StatBar label={t('world.clubs.reputation')} value={club.reputation} color="var(--accent-gold)" />
        <div>
          <h3 class="micro t-mid">{t('world.clubs.topPlayers')}</h3>
          {top.length === 0 ? (
            <p class="t-sm t-lo">{t('world.clubs.noPlayers')}</p>
          ) : (
            <ul class="world-top">
              {top.map((p) => (
                <li key={p.id} class="world-top-row">
                  <Avatar appearance={p.appearance} size={36} shirt={club.colors.primary} shirtTrim={club.colors.secondary} />
                  <span class="grow truncate">{p.firstName} {p.lastName}</span>
                  <Chip tone="info">{t(`data.pos.${p.position}`)}</Chip>
                  <span class="num world-ovr" style={{ color: attrColor(p.ovr) }}>{p.ovr}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}

function interestLevel(n: number): 'low' | 'mid' | 'high' {
  return n >= 70 ? 'high' : n >= 40 ? 'mid' : 'low'
}

export function WorldScreen() {
  const s = gameState.value
  const own = heroClub.value
  const [tab, setTab] = useState<TabId>(pickTab(screen.value.params?.tab, TAB_IDS, 'leagues'))
  const firstLeague = s ? (own ? s.world.leagues[own.leagueId] : Object.values(s.world.leagues)[0]) : undefined
  const [countryId, setCountryId] = useState(firstLeague?.countryId ?? '')
  const [leagueId, setLeagueId] = useState(firstLeague?.id ?? '')
  const [clubSel, setClubSel] = useState<Club | null>(null)
  if (!s) return <Page title={t('world.title')}><EmptyState /></Page>

  const onCountry = (id: string) => {
    setCountryId(id)
    const lg = Object.values(s.world.leagues).filter((l) => l.countryId === id).sort((a, b) => a.tier - b.tier)[0]
    if (lg) setLeagueId(lg.id)
  }
  const league = s.world.leagues[leagueId]
  const table = data.leagueTable(leagueId)
  const picker = <LeaguePicker countryId={countryId} leagueId={leagueId} onCountry={onCountry} onLeague={setLeagueId} />

  let body = null
  if (tab === 'leagues') {
    body = (
      <div class="stack">
        {picker}
        {league && <h2 class="h2 world-league-name">{league.name} <span class="t-lo t-sm">{t('world.tier', { n: league.tier })}</span></h2>}
        {table ? (
          <LeagueTable
            rows={table}
            team={(id) => data.team(id)}
            highlightId={own?.id}
            zones={zonesForLeague(league)}
            caption={t('ui.table.caption', { league: league?.name ?? '' })}
            onSelect={(id) => setClubSel(s.world.clubs[id] ?? null)}
          />
        ) : (
          <EmptyState icon="list" title={t('world.noTable')} />
        )}
      </div>
    )
  } else if (tab === 'scorers') {
    const rows = leagueId ? data.topScorers(leagueId) : []
    body = (
      <div class="stack">
        {picker}
        {rows.length === 0 ? (
          <EmptyState icon="ball" title={t('world.scorers.empty')} />
        ) : (
          <ol class="world-scorers">
            {rows.map((r, i) => {
              const tm = data.team(r.clubId)
              return (
                <li key={r.playerId} class={`world-scorer${r.isHero ? ' is-hero' : ''}${i < 3 ? ` is-top is-top-${i + 1}` : ''}`}>
                  <span class="world-rank score-font">{i + 1}</span>
                  {tm && <Crest crest={tm.crest} size={28} compact />}
                  <span class="grow world-scorer-name">
                    <span class="truncate">{r.name}</span>
                    <span class="t-xs t-lo truncate">{r.isHero ? t('world.scorers.you') : (tm?.name ?? '')}</span>
                  </span>
                  <span class="world-stat"><span class="score-font">{r.goals}</span><span class="micro t-lo">{t('world.scorers.goals')}</span></span>
                  <span class="world-stat is-dim"><span class="score-font">{r.assists}</span><span class="micro t-lo">{t('world.scorers.assists')}</span></span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    )
  } else if (tab === 'transfers') {
    const news = data.transferNews()
    body = news.length === 0 ? (
      <EmptyState icon="newspaper" title={t('world.transfers.empty')} />
    ) : (
      <div class="world-news stagger">
        {news.map((n) => (
          <article key={n.id} class={`world-news-card sent-${n.sentiment}`}>
            <div class="world-news-meta">
              <Icon name="handshake" size={16} />
              <span class="micro">{t('world.transfers.week', { n: n.week + 1 })}</span>
            </div>
            <h3 class="world-headline">{lt(n.headline)}</h3>
            {n.body && <p class="t-sm t-mid">{lt(n.body)}</p>}
            <div class="t-xs t-lo">{t('world.transfers.source', { s: n.source })}</div>
          </article>
        ))}
      </div>
    )
  } else if (tab === 'clubs') {
    const clubs = (league?.clubIds ?? []).map((id) => s.world.clubs[id]).filter((c): c is Club => !!c)
    body = (
      <div class="stack">
        {picker}
        <p class="t-sm t-lo">{t('world.clubs.count', { n: clubs.length })}</p>
        <div class="world-crests">
          {clubs.map((c) => (
            <button key={c.id} type="button" class={`world-crest${c.id === own?.id ? ' is-own' : ''}`} onClick={() => setClubSel(c)}>
              <Crest crest={c.crest} size={56} />
              <span class="world-crest-name truncate">{c.name}</span>
              <span class="world-crest-rep" aria-hidden="true"><span style={{ transform: `scaleX(${c.reputation / 100})` }} /></span>
              {c.id === own?.id && <span class="sr-only">{t('world.clubs.yours')}</span>}
            </button>
          ))}
        </div>
      </div>
    )
  } else {
    const list = data.interest()
    body = list.length === 0 ? (
      <EmptyState icon="eye" title={t('world.interest.empty')} text={t('world.interest.emptyHint')} />
    ) : (
      <div class="stack">
        <SectionTitle>{t('world.interest.title')}</SectionTitle>
        <div class="world-interest stagger">
          {[...list].sort((a, b) => b.level - a.level).map((it) => {
            const lv = interestLevel(it.level)
            return (
              <Card key={it.club.id} pad="md" class={`world-int is-${lv}`}>
                <div class="row world-int-head">
                  <Crest crest={it.club.crest} size={48} />
                  <div class="grow">
                    <h3 class="h3 truncate">{it.club.name}</h3>
                    <div class="t-xs t-lo truncate">{it.leagueName}</div>
                  </div>
                  <Chip tone={lv === 'high' ? 'gold' : lv === 'mid' ? 'info' : 'neutral'} icon="eye">{t(`world.interest.levels.${lv}`)}</Chip>
                </div>
                <StatBar label={t('world.interest.level')} value={it.level} color={lv === 'high' ? 'var(--accent-gold)' : 'var(--accent-blue)'} size="sm" />
                <p class="t-sm t-mid world-int-note">{lt(it.note)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="handshake"
                  onClick={() => {
                    actions.openNegotiation(it.club.id)
                    navigate('contract')
                  }}
                >
                  {t('world.interest.talk')}
                </Button>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Page title={t('world.title')} sub={t('world.sub')} wide>
      <Tabs
        idPrefix="world"
        label={t('world.title')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'leagues', label: t('world.tabs.leagues'), icon: 'list' },
          { id: 'scorers', label: t('world.tabs.scorers'), icon: 'ball' },
          { id: 'transfers', label: t('world.tabs.transfers'), icon: 'handshake' },
          { id: 'clubs', label: t('world.tabs.clubs'), icon: 'shield' },
          { id: 'interest', label: t('world.tabs.interest'), icon: 'eye', badge: data.interest().length },
        ]}
      />
      <TabPanel id={tab} idPrefix="world">{body}</TabPanel>
      <ClubSheet club={clubSel} onClose={() => setClubSel(null)} />
    </Page>
  )
}
