import { CelebrationPicker } from './profile/CelebrationPicker'
import { NationalCard } from './national/NationalCard'
import type { AttributeGroup, SeasonStats } from '../../core/types'
import { lt, t } from '../../i18n'
import {
  Button, Card, CardHeader, Chip, Crest, EmptyState, Flag, LineChart, MeterRing, Page, PlayerCard, SectionTitle, StatBar,
} from '../components'
import { formatMoney, formatNumber, formatPercent, formatRating, ratingColor, seasonLabel, tierOf } from '../format'
import { Icon } from '../icons'
import { ROLE_ICON } from '../roleView'
import { heroHeight } from '../../core/roles'
import { data, gameState, heroClub, navigate } from '../store'
import { RADAR_AXES, attrCardsFor, keyStatsFor, keysAvg, radarValues, type GkGroup } from './career/attrs'
import { Radar } from './career/Radar'
import { AttrGrowth } from './profile/AttrGrowth'
import { GoalReel } from './profile/GoalReel'
import { FinanceCharts } from './profile/FinanceCharts'
import { OvrExplainer } from './profile/OvrExplainer'
import { statsByClub, type ClubStatsRow } from '../../sim/game/clubStats'
import { ProfileCareerExtras } from './legacy/CareerCards'
import '../../styles/screens/profile.css'
import { InfoTip } from '../tutorial/InfoTip'

function StatsTable({ season, career }: { season: SeasonStats; career: SeasonStats }) {
  const avg = (s: SeasonStats) => (s.apps ? formatRating(s.ratingSum / s.apps) : '—')
  const acc = (s: SeasonStats) => (s.passes ? formatPercent(s.passesCompleted / s.passes) : '—')
  const rows: { label: string; v: (s: SeasonStats) => string }[] = [
    { label: t('profile.stats.apps'), v: (s) => `${s.apps} (${s.starts})` },
    { label: t('profile.stats.minutes'), v: (s) => formatNumber(s.minutes) },
    { label: t('profile.stats.goals'), v: (s) => String(s.goals) },
    { label: t('profile.stats.assists'), v: (s) => String(s.assists) },
    { label: t('profile.stats.rating'), v: avg },
    { label: t('profile.stats.motm'), v: (s) => String(s.motm) },
    { label: t('profile.stats.shots'), v: (s) => `${s.shots} (${s.shotsOnTarget})` },
    { label: t('profile.stats.passAcc'), v: acc },
    { label: t('profile.stats.cleanSheets'), v: (s) => String(s.cleanSheets) },
    { label: t('profile.stats.yellow'), v: (s) => String(s.yellow) },
    { label: t('profile.stats.red'), v: (s) => String(s.red) },
  ]
  return (
    <div class="prof-table-wrap">
      <table class="prof-table">
        <caption class="sr-only">{t('profile.stats.title')}</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">{t('profile.stats.title')}</span></th>
            <th scope="col">{t('profile.stats.season')}</th>
            <th scope="col">{t('profile.stats.career')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td class="num">{r.v(season)}</td>
              <td class="num">{r.v(career)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 2.7#94: career totals split by club. */
function ClubStatsTable({ rows }: { rows: ClubStatsRow[] }) {
  if (rows.length === 0) return null
  return (
    <div class="prof-table-wrap" data-testid="club-stats">
      <table class="prof-table">
        <caption class="micro t-mid">{t('profile.stats.byClub')}</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">{t('profile.stats.byClub')}</span></th>
            <th scope="col">{t('profile.stats.seasonsShort')}</th>
            <th scope="col">{t('profile.stats.apps')}</th>
            <th scope="col">{t('profile.stats.goals')}</th>
            <th scope="col">{t('profile.stats.assists')}</th>
            <th scope="col">{t('profile.stats.ratingShort')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.clubId}>
              <th scope="row">{r.clubName}</th>
              <td class="num">{r.seasons}</td>
              <td class="num">{r.stats.apps}</td>
              <td class="num">{r.stats.goals}</td>
              <td class="num">{r.stats.assists}</td>
              <td class="num">{r.stats.apps ? formatRating(r.stats.ratingSum / r.stats.apps) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProfileScreen() {
  const s = gameState.value
  if (!s) return <Page title={t('profile.title')}><EmptyState /></Page>
  const h = s.hero
  const club = heroClub.value
  const country = s.world.countries[h.nationality]
  const ovr = data.heroOvr()
  const age = data.heroAge()
  const ovrHist = data.ovrHistory()
  const groups = attrCardsFor(h.position)
  const radar = radarValues(h.attrs)
  const c = h.contract
  const ss = h.seasonStats
  const seasonAvg = ss.apps ? ss.ratingSum / ss.apps : 0

  return (
    <Page title={t('profile.title')} wide>
      <div class="prof-hero" style={{ ['--club' as string]: club?.colors.primary ?? 'var(--brand-pitch)' }}>
        <div class="prof-hero-card">
          <PlayerCard
            name={`${h.firstName} ${h.lastName}`}
            ovr={ovr}
            position={h.position}
            appearance={h.appearance}
            stats={keyStatsFor(h.position).map((k) => ({ label: t(`data.attrShort.${k}`), value: h.attrs[k] }))}
            tier={tierOf(ovr)}
            crest={club?.crest}
            flag={country ? { id: country.id, colors: country.flag } : undefined}
            shirt={club?.colors.primary}
            age={age}
            size="lg"
          />
        </div>
        <div class="prof-hero-info">
          <div class="prof-name-block">
            <h2 class="prof-name">{h.firstName} <strong>{h.lastName}</strong></h2>
            {h.nickname && <div class="prof-nick">{t('profile.nickname', { n: h.nickname })}</div>}
          </div>
          <div class="prof-facts">
            <Chip tone="info" icon="shirt">{t(`data.posLong.${h.position}`)}</Chip>
            {h.role && (
              <span data-testid="profile-role">
                <Chip tone="violet" icon={ROLE_ICON[h.role]} title={t(`data.playRoleDesc.${h.role}`)}>{t(`data.playRole.${h.role}`)}</Chip>
              </span>
            )}
            {h.role && <Chip icon="chevron-up">{t('wizard.heightValue', { n: heroHeight(h) })}</Chip>}
            <Chip>{t('common.ageN', { n: age })}</Chip>
            <Chip icon="boot">{t('profile.foot', { f: t(`data.foot.${h.foot}`) })}</Chip>
            {country && (
              <span class="chip chip-neutral prof-flag-chip">
                <Flag id={country.id} colors={country.flag} size={18} />
                {lt(country.name)}
              </span>
            )}
          </div>
          <div class="prof-club-line">
            {club ? (
              <>
                <Crest crest={club.crest} size={34} />
                <span class="grow">
                  <span class="prof-club-name">{club.name}</span>
                  <span class="t-xs t-lo">{c ? `${t(`data.role.${c.role}`)} · ${t('profile.shirt', { n: h.shirtNumber })}` : ''}</span>
                </span>
              </>
            ) : (
              <span class="t-mid">{t('profile.freeAgent')}</span>
            )}
          </div>
          {(h.injury || h.suspendedMatches > 0) && (
            <div class="row wrap">
              {h.injury && <Chip tone="neg" icon="first-aid">{t('profile.injured', { name: lt(h.injury.name), n: h.injury.weeksLeft })}</Chip>}
              {h.suspendedMatches > 0 && <Chip tone="warning" icon="yellow-card">{t('profile.suspended', { n: h.suspendedMatches })}</Chip>}
            </div>
          )}
          <div class="prof-rings">
            <MeterRing value={h.form} size={68} label={t('profile.rings.form')} color="var(--brand-pitch)" info={<InfoTip term="form" />} />
            <MeterRing value={h.morale} size={68} label={t('profile.rings.morale')} color="var(--accent-gold)" info={<InfoTip term="morale" />} />
            <MeterRing value={h.sharpness} size={68} label={t('profile.rings.sharpness')} color="var(--accent-blue)" info={<InfoTip term="sharpness" />} />
            <MeterRing value={h.fatigue} size={68} label={t('profile.rings.fatigue')} color={h.fatigue > 65 ? 'var(--state-danger)' : 'var(--accent-violet)'} info={<InfoTip term="fatigue" />} />
          </div>
          <div class="prof-quick">
            <div><span class="micro t-lo">{t('profile.stats.apps')}</span><span class="score-font">{ss.apps}</span></div>
            <div><span class="micro t-lo">{t('profile.stats.goals')}</span><span class="score-font">{ss.goals}</span></div>
            <div><span class="micro t-lo">{t('profile.stats.assists')}</span><span class="score-font">{ss.assists}</span></div>
            <div>
              <span class="micro t-lo">{t('profile.stats.rating')}</span>
              <span class="score-font" style={{ color: ss.apps ? ratingColor(seasonAvg) : undefined }}>{ss.apps ? formatRating(seasonAvg) : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="prof-grid">
        <section class="prof-col">
          <SectionTitle>{t('profile.attributes')}</SectionTitle>
          <div class="prof-attr-groups">
            {groups.map((g) => (
              <Card key={g.id} pad="md" data-testid={`attr-group-${g.id}`}>
                <div class="row-between prof-group-head">
                  <h3 class="h3">{g.gk ? t(`data.gkGroup.${g.id as GkGroup}`) : t(`data.group.${g.id as AttributeGroup}`)}</h3>
                  <span class="score-font prof-group-avg">{keysAvg(h.attrs, g.keys)}</span>
                </div>
                <div class="stack prof-bars">
                  {g.keys.map((k) => <StatBar key={k} label={t(`data.attr.${k}`)} value={h.attrs[k]} scale size="sm" />)}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section class="prof-col">
          <SectionTitle>{t('profile.radar.title')}</SectionTitle>
          <Card pad="md" class="prof-radar-card">
            <Radar axes={RADAR_AXES.map((a) => ({ label: t(`profile.radar.${a}`), value: radar[a] }))} />
            <div class="prof-ovr-badge">
              <span class="micro t-mid label-with-tip">{t('profile.ovr')}<InfoTip term="ovr" /></span>
              <span class="score-font">{ovr}</span>
              <OvrExplainer />
            </div>
          </Card>

          {ovrHist.length > 1 && (
            <Card pad="md">
              <CardHeader title={t('profile.ovrHistory')} icon="trend-up" />
              <LineChart values={ovrHist} height={110} color="var(--accent-gold)" label={t('profile.ovrHistory')} />
            </Card>
          )}

          <AttrGrowth />

          <GoalReel />

          <Card pad="md" class="prof-contract">
            <CardHeader
              title={t('profile.contract.title')}
              icon="handshake"
              action={c ? <Button size="sm" variant="secondary" icon="handshake" onClick={() => navigate('contract')}>{t('profile.contract.negotiate')}</Button> : undefined}
            />
            {c ? (
              <dl class="prof-dl">
                <div><dt class="label-with-tip">{t('profile.contract.wage')}<InfoTip term="wage" /></dt><dd class="num">{formatMoney(c.wage)}{t('common.perWeek')}</dd></div>
                <div><dt>{t('profile.contract.until')}</dt><dd>{t('profile.contract.untilSeason', { s: seasonLabel(c.untilSeason) })}</dd></div>
                <div><dt class="label-with-tip">{t('profile.contract.role')}<InfoTip term="squadRole" /></dt><dd>{t(`data.role.${c.role}`)}{c.loan ? ` · ${t('profile.contract.loan')}` : ''}</dd></div>
                <div><dt>{t('profile.contract.goalBonus')}</dt><dd class="num">{formatMoney(c.goalBonus)}</dd></div>
                <div><dt>{t('profile.contract.assistBonus')}</dt><dd class="num">{formatMoney(c.assistBonus)}</dd></div>
                <div><dt class="label-with-tip">{t('profile.contract.release')}<InfoTip term="releaseClause" /></dt><dd class="num">{c.releaseClause ? formatMoney(c.releaseClause, { compact: true }) : t('profile.contract.noRelease')}</dd></div>
              </dl>
            ) : (
              <p class="t-mid t-sm">{t('profile.contract.none')}</p>
            )}
          </Card>

          <NationalCard detailed />

          <CelebrationPicker />

          <Card pad="md">
            <CardHeader title={t('profile.national.title')} icon="flag" />
            {h.nationalTeam.called || h.nationalTeam.caps > 0 ? (
              <div class="row">
                {country && <Flag id={country.id} colors={country.flag} size={36} />}
                <span class="t-mid">{t('profile.national.caps', { n: h.nationalTeam.caps })} · {t('profile.national.goals', { n: h.nationalTeam.goals })}</span>
              </div>
            ) : (
              <p class="t-sm t-lo">{t('profile.national.notCalled')}</p>
            )}
          </Card>
        </section>
      </div>

      <FinanceCharts />
      <ProfileCareerExtras />

      <SectionTitle>{t('profile.stats.title')}</SectionTitle>
      <StatsTable season={h.seasonStats} career={h.careerStats} />
      <ClubStatsTable rows={statsByClub(h, club ? { clubId: club.id, clubName: club.name } : null)} />

      <SectionTitle action={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('trophies')}>{t('profile.honours.cabinet')}</Button>}>
        {t('profile.honours.title')}
      </SectionTitle>
      {h.trophies.length === 0 && h.awards.length === 0 ? (
        <Card variant="inset" class="prof-honours-empty"><Icon name="trophy" size={24} class="t-lo" /><span class="t-mid">{t('profile.honours.none')}</span></Card>
      ) : (
        <div class="prof-honours" role="list">
          {h.trophies.map((tr, i) => (
            <div key={`t${i}`} class="prof-honour is-trophy" role="listitem">
              <Icon name="trophy" size={26} />
              <span class="prof-honour-name">{lt(tr.name)}</span>
              <span class="t-xs t-lo">{seasonLabel(tr.season)}</span>
            </div>
          ))}
          {h.awards.map((a, i) => (
            <div key={`a${i}`} class="prof-honour is-award" role="listitem">
              <Icon name="medal" size={26} />
              <span class="prof-honour-name">{lt(a.name)}</span>
              <span class="t-xs t-lo">{seasonLabel(a.season)}</span>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>{t('profile.history.title')}</SectionTitle>
      {h.history.length === 0 ? (
        <p class="t-mid t-sm">{t('profile.history.empty')}</p>
      ) : (
        <ol class="prof-timeline">
          {[...h.history].reverse().map((r) => {
            const cl = s.world.clubs[r.clubId]
            const avg = r.stats.apps ? r.stats.ratingSum / r.stats.apps : 0
            return (
              <li key={`${r.season}-${r.clubId}`} class="prof-tl-item">
                <span class="prof-tl-dot" aria-hidden="true" />
                <div class="prof-tl-card">
                  {cl ? <Crest crest={cl.crest} size={36} /> : <Icon name="shield" size={28} />}
                  <div class="grow">
                    <div class="row-between">
                      <span class="prof-tl-season">{seasonLabel(r.season)}</span>
                      {r.stats.apps > 0 && <span class="num prof-tl-rating" style={{ color: ratingColor(avg) }}>{formatRating(avg)}</span>}
                    </div>
                    <div class="prof-tl-club truncate">{r.clubName}</div>
                    <div class="t-xs t-lo">
                      {r.leagueName}
                      {r.leaguePosition ? ` · ${t('profile.history.position', { n: r.leaguePosition })}` : ''}
                    </div>
                    <div class="t-sm t-mid num">{t('profile.history.line', { apps: r.stats.apps, goals: r.stats.goals, assists: r.stats.assists })}</div>
                    {r.trophies.length > 0 && (
                      <div class="row wrap prof-tl-trophies">
                        {r.trophies.map((x) => <Chip key={x} tone="gold" icon="trophy">{x}</Chip>)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Page>
  )
}
