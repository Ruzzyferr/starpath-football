import '../../../styles/screens/intl.css'
import { lt, t } from '../../../i18n'
import { Crest, EmptyState } from '../../components'
import type { GroupTableView, ResultLine } from '../../backend/worldViews'

/** One fixture / tie line: home – score – away (+ aggregate / penalties note). */
export function TieRow({ r }: { r: ResultLine }) {
  return (
    <li class={`cup-tie${r.heroTeam ? ' is-hero' : ''}`} data-testid="tie">
      <span class="cup-team">
        <Crest crest={r.home.crest} size={24} compact />
        <span class="cup-name">{r.home.name}</span>
      </span>
      <span class="stack" style={{ alignItems: 'center', gap: 0 }}>
        <span class="cup-score">{r.score ?? 'v'}</span>
        {(r.note || r.leg) && <span class="cup-note">{r.leg ? t('intl.cups.leg', { n: r.leg }) : ''}{r.note ? ` ${r.note}` : ''}</span>}
      </span>
      <span class="cup-team is-away">
        <span class="cup-name">{r.away.name}</span>
        <Crest crest={r.away.crest} size={24} compact />
      </span>
    </li>
  )
}

export function TieList({ ties }: { ties: ResultLine[] }) {
  if (!ties.length) return <p class="t-sm t-lo">{t('intl.cups.tbd')}</p>
  return <ul class="cup-ties">{ties.map((r) => <TieRow key={r.fixtureId} r={r} />)}</ul>
}

/** Compact standings table (groups, development leagues). */
export function MiniTable({ g, highlight, qualify = 0 }: { g: GroupTableView; highlight?: ReadonlySet<string>; qualify?: number }) {
  if (!g.rows.length) return <EmptyState icon="list" />
  return (
    <div class="stack" style={{ gap: 'var(--sp-1)' }}>
      <h3 class="micro t-mid">{lt(g.title)}</h3>
      <table class="mini-table">
        <thead><tr><th>#</th><th /><th>O</th><th>G</th><th>B</th><th>M</th><th>AV</th><th>P</th></tr></thead>
        <tbody>
          {g.rows.map((r, i) => (
            <tr key={r.clubId} class={`${highlight?.has(r.clubId) ? 'is-hero' : ''}${i < qualify ? ' is-q' : ''}`}>
              <td>{i + 1}</td>
              <td><span class="nt-team-cell"><Crest crest={r.team.crest} size={18} compact /><span class="truncate">{r.team.name}</span></span></td>
              <td class="num">{r.p}</td><td class="num">{r.w}</td><td class="num">{r.d}</td><td class="num">{r.l}</td>
              <td class="num">{r.gf - r.ga}</td><td class="num"><b>{r.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
