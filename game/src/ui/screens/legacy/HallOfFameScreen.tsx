import '../../../styles/screens/legacy.css'
import { currentLang, lt, t } from '../../../i18n'
import { Avatar, Button, EmptyState, Page } from '../../components'
import { Icon } from '../../icons'
import { formatMoney, formatNumber } from '../../format'
import { navigate } from '../../store'
import { hallOfFame, legacyFor } from '../../backend/meta'
import { legacyTier, POST_CAREER } from '../../../sim/game/hallOfFame'

/** Every finished career (global storage, survives deleted saves). */
export function HallOfFameScreen() {
  void currentLang.value
  const list = hallOfFame()
  return (
    <Page title={t('meta.hof.title')} sub={t('meta.hof.sub')} class="hof-page" actions={<Button size="sm" variant="secondary" icon="flag" onClick={() => navigate('board')}>{t('board.menu.title')}</Button>}>
      {list.length === 0 && (
        <div class="hof-empty">
          {/* Ghost podium: three unclaimed plinths waiting for retired careers. */}
          <div class="hof-podium" aria-hidden="true">
            {[2, 1, 3].map((n) => (
              <div key={n} class={`hof-plinth hof-plinth-${n}`}>
                <svg viewBox="0 0 60 64" class="hof-ghost"><circle cx="30" cy="20" r="12" /><path d="M6 64c0-16 10-26 24-26s24 10 24 26Z" /></svg>
                <span class="hof-step score-font">{n}</span>
              </div>
            ))}
          </div>
          <EmptyState icon="crown" title={t('meta.hof.title')} text={t('meta.hof.empty')} compact />
        </div>
      )}
      <ol class="stack" aria-label={t('meta.hof.title')} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((e, i) => {
          const leg = legacyFor(e.careerId)
          return (
            <li key={e.careerId} class="hof-row" data-hof={e.careerId}>
              <span class="hof-rank num">{t('meta.hof.rank', { n: i + 1 })}</span>
              <Avatar appearance={{ skin: 2, hairStyle: 1, hairColor: 1, beard: 0, eyeColor: 1, face: 1, accessory: 0, gender: e.gender }} size={44} />
              <div class="grow stack" style={{ minWidth: 0, gap: '2px' }}>
                <div class="h3 truncate">{e.name}</div>
                <div class="t-xs t-mid">
                  {e.position} · {t('meta.hof.seasons', { a: e.startSeason, b: e.endSeason })} · {e.clubs.slice(0, 3).join(', ')}
                </div>
                <div class="t-xs t-lo">{t('meta.retire.stats', { a: e.totals.apps, g: e.totals.goals, as: e.totals.assists })} · <Icon name="trophy" size={12} class="t-gold doc-inline-ico" /> {e.trophies.length}{e.postCareer ? ` · ${lt(POST_CAREER[e.postCareer].label)}` : ''}</div>
                <div class="hof-actions">
                  <Button size="sm" variant="secondary" icon="play" onClick={() => navigate('documentary', { id: e.careerId })}>{t('meta.hof.view')}</Button>
                  {leg && (
                    <Button size="sm" variant="gold" icon="users" onClick={() => navigate('newCareer', { legacy: e.careerId })} title={t('meta.hof.legacyHint', { m: formatMoney(leg.inheritance), r: leg.reputationBonus })}>
                      {t('meta.hof.legacy')}
                    </Button>
                  )}
                </div>
              </div>
              <div class="stack" style={{ alignItems: 'flex-end', gap: '2px' }}>
                <span class="micro t-lo">{t('meta.hof.score')}</span>
                <span class="h2 num" style={{ color: 'var(--accent-gold)' }}>{formatNumber(e.legacyScore)}</span>
                <span class="t-xs t-mid">{lt(legacyTier(e.legacyScore))}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </Page>
  )
}
