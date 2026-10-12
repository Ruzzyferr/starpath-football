import { t } from '../../../i18n'
import type { MatchupView } from '../../store'

const ROLE_KEY = {
  keeper: 'match.live.matchup.roleKeeper',
  marker: 'match.live.matchup.roleMarker',
  carrier: 'match.live.matchup.roleCarrier',
  attacker: 'match.live.matchup.roleAttacker',
  aerial: 'match.live.matchup.roleAerial',
} as const
const EDGE_KEY = { 1: 'match.live.matchup.edgeHero', '-1': 'match.live.matchup.edgeOpp', 0: 'match.live.matchup.edgeEven' } as const

/** Hero vs the key opponent of the pending moment: names, OVR and the attributes that decide it. */
export function MatchupCard({ mu }: { mu: MatchupView }) {
  return (
    <div class="lm-mu" data-testid="moment-matchup" data-edge={mu.edge} role="group" aria-label={t('match.live.matchup.title')}>
      <div class="lm-mu-sides">
        <div class="lm-mu-side lm-mu-hero" data-testid="mu-hero">
          <span class="lm-mu-role micro">{t('match.live.matchup.you')}</span>
          <span class="lm-mu-name">{mu.hero.name}</span>
          <span class="lm-mu-ovr score-font" aria-label={t('match.live.matchup.ovr', { n: mu.hero.ovr })}>{mu.hero.ovr}</span>
        </div>
        <span class="lm-mu-vs micro" aria-hidden="true">vs</span>
        <div class="lm-mu-side lm-mu-opp" data-testid="mu-opp">
          <span class="lm-mu-role micro">{t(ROLE_KEY[mu.role])}</span>
          <span class="lm-mu-name">{mu.opp.name}</span>
          <span class="lm-mu-ovr score-font" aria-label={t('match.live.matchup.ovr', { n: mu.opp.ovr })}>{mu.opp.ovr}</span>
        </div>
      </div>
      <ul class="lm-mu-rows">
        {mu.rows.map((r) => {
          const hl = t(`data.attr.${r.heroKey}`)
          const ol = t(`data.attr.${r.oppKey}`)
          return (
            <li
              key={r.heroKey + r.oppKey}
              class="lm-mu-row"
              data-testid="mu-row"
              data-edge={r.edge}
              aria-label={t('match.live.matchup.label', { a: hl, b: r.heroKey === r.oppKey ? '' : ol, c: r.heroV, d: r.oppV })}
            >
              <span class="lm-mu-attr">{hl}</span>
              <span class={`lm-mu-val${r.edge > 0 ? ' is-lead' : ''}`}>{r.heroV}</span>
              <span class="lm-mu-mark" aria-hidden="true">{r.edge > 0 ? '◀' : r.edge < 0 ? '▶' : '·'}</span>
              <span class={`lm-mu-val${r.edge < 0 ? ' is-lead' : ''}`}>{r.oppV}</span>
              <span class="lm-mu-attr lm-mu-attr-opp">{r.heroKey === r.oppKey ? '' : ol}</span>
            </li>
          )
        })}
      </ul>
      {mu.chance && (
        <div class="lm-mu-chance" data-testid="mu-chance">
          {mu.chance.oppKey
            ? t('match.live.matchup.chance', { e: t(`match.live.matchup.events.${mu.chance.event}`), p: mu.chance.pct, a: t(`data.attr.${mu.chance.heroKey}`), c: mu.chance.heroV, b: t(`data.attr.${mu.chance.oppKey}`), d: mu.chance.oppV ?? 0 })
            : t('match.live.matchup.chanceSolo', { e: t(`match.live.matchup.events.${mu.chance.event}`), p: mu.chance.pct, a: t(`data.attr.${mu.chance.heroKey}`), c: mu.chance.heroV })}
        </div>
      )}
      <div class="lm-mu-edge" data-testid="mu-edge" data-edge={mu.edge}>{t(EDGE_KEY[mu.edge])}</div>
    </div>
  )
}
