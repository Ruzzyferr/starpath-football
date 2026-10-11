import { t } from '../../../i18n'
import type { DrillMatchup } from '../../../game/training/matchup'

const EDGE_KEY = { 1: 'training.matchup.edgeHero', '-1': 'training.matchup.edgeOpp', 0: 'training.matchup.edgeEven' } as const

/** "You vs opponent" on a drill's intro card: the opposition's level and the attributes that decide the duel. */
export function DrillMatchupCard({ mu }: { mu: DrillMatchup }) {
  return (
    <div class="trn-mu" data-testid="drill-matchup" data-edge={mu.edge} role="group" aria-label={t('training.matchup.title')}>
      <div class="trn-mu-head">
        <span class="micro t-lo">{t('training.matchup.you')}</span>
        <span class="trn-mu-vs micro" aria-hidden="true">vs</span>
        <span class="micro t-lo trn-mu-opp">
          {t(`training.matchup.role.${mu.role}`)} · {t('training.matchup.level', { n: mu.level })}
        </span>
      </div>
      <ul class="trn-mu-rows">
        {mu.rows.map((r) => {
          const hl = t(`data.attr.${r.heroKey}`)
          const ol = t(`data.attr.${r.oppKey}`)
          return (
            <li key={r.heroKey + r.oppKey} class="trn-mu-row" data-testid="drill-mu-row" data-edge={r.edge}>
              <span class="trn-mu-attr">{hl}</span>
              <span class={`trn-mu-val${r.edge > 0 ? ' is-lead' : ''}`}>{r.heroV}</span>
              <span class="trn-mu-mark" aria-hidden="true">{r.edge > 0 ? '◀' : r.edge < 0 ? '▶' : '·'}</span>
              <span class={`trn-mu-val${r.edge < 0 ? ' is-lead' : ''}`}>{r.oppV}</span>
              <span class="trn-mu-attr trn-mu-attr-opp">{ol}</span>
            </li>
          )
        })}
      </ul>
      <div class="trn-mu-foot micro" data-testid="drill-mu-edge">{t(EDGE_KEY[mu.edge])} · {t('training.matchup.hint')}</div>
    </div>
  )
}
