import '../../../styles/screens/bench.css'
import { lt, t } from '../../../i18n'
import { Button } from '../../components'
import { Icon, type IconName } from '../../icons'
import { gameState, stateVersion } from '../../store'
import { skipMissed, todayIdeas, type WeekIdea } from '../../backend/benchPath'
import { runBenchAction } from './benchActions'

const IDEA_ICON: Record<WeekIdea['action'], IconName> = {
  impress: 'target', reserve: 'ball', scrimmage: 'whistle', talk: 'chat', oneOnOne: 'handshake', rest: 'bed', video: 'eye', training: 'barbell', teamDinner: 'fork-knife',
}

/** "What can you do today?": 2–3 contextual actions with their reward, each one tap away. */
export function WeekIdeasCard() {
  void stateVersion.value
  const s = gameState.value
  if (!s || s.hero.retired || !s.hero.contract) return null
  const ideas = todayIdeas()
  if (!ideas.length) return null
  return (
    <section class="ideas-card" data-testid="week-ideas" aria-labelledby="ideas-title">
      <div class="ideas-head">
        <span class="ideas-head-icon" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
        <div>
          <h2 class="h3" id="ideas-title">{t('bench.ideas.title')}</h2>
          <p class="t-xs t-mid">{t('bench.ideas.sub')}</p>
        </div>
      </div>
      <ul class="ideas-list">
        {ideas.map((i) => (
          <li key={i.action} class={`idea idea-${i.action}`}>
            <button type="button" class="idea-btn" onClick={() => runBenchAction(i.action)} data-testid={`idea-${i.action}`}>
              <span class="idea-icon" aria-hidden="true"><Icon name={IDEA_ICON[i.action]} size={22} /></span>
              <span class="idea-body">
                <span class="idea-title">{lt(i.title)}</span>
                <span class="t-xs t-mid idea-why">{lt(i.why)}{i.attr ? ` · ${t(`data.attr.${i.attr}` as never)}` : ''}</span>
                <span class="idea-reward"><Icon name="trend-up" size={13} weight={2.4} />{lt(i.reward)}</span>
              </span>
              <Icon name="chevron-right" size={18} class="idea-go" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Skip nudge: backend/benchPath watches commits for multi-day skips (skipMissed).

export function SkipSummary() {
  const m = skipMissed.value
  if (!m) return null
  return (
    <section class="skip-card" role="status" data-testid="skip-summary" aria-labelledby="skip-title">
      <div class="row-between">
        <h2 class="h3" id="skip-title"><Icon name="hourglass" size={18} /> {t('bench.skip.title')}</h2>
      </div>
      <p class="t-sm t-mid">{t('bench.skip.text', { d: m.days, e: m.energy })}</p>
      <ul class="skip-list">
        {m.ideas.map((i) => <li key={i.action}><Icon name={IDEA_ICON[i.action]} size={16} /> <span>{lt(i.title)}</span><span class="t-xs t-pos">{lt(i.reward)}</span></li>)}
      </ul>
      {m.gain > 0 && <p class="t-xs t-lo">{t('bench.skip.gain', { n: m.gain })}</p>}
      <div class="row skip-actions">
        <Button size="sm" variant="ghost" onClick={() => { skipMissed.value = null }} data-testid="skip-dismiss">{t('bench.skip.dismiss')}</Button>
      </div>
    </section>
  )
}
