import { AgendaCard } from './bench/AgendaCard'
import { agendaBlockReason } from '../backend/benchPath'
import { openScouting } from '../backend/scouting'
import '../../styles/screens/planner.css'
import { useState } from 'preact/hooks'
import { lt, t, tx } from '../../i18n'
import { Button, Card, Chip, DeltaList, EmptyState, Page, RiskBadge, StatBar, Tabs, toast } from '../components'
import { formatMoney } from '../format'
import { Icon, isIconName, type IconName } from '../icons'
import { actions, data, gameState, type ActivityCategory, type ActivityView } from '../store'
import { requestAdvance } from '../tutorial/MatchdayConfirm'
import { lockText } from '../tutorial/UnlockGate'
import { features, type FeatureId } from '../tutorial/unlocks'

/**
 * Activities (owner feedback, TestFlight build 4): the old three-slot day
 * planner is gone. The day is driven by the daily agenda (mandatory tasks +
 * suggestions); everything else is done directly from here — each activity
 * runs NOW and uses its share of the day (time + energy), exactly like before.
 */

/** Activity categories hidden behind progressive unlocks (UI messaging only). */
const GATED: Partial<Record<ActivityCategory, FeatureId>> = { casino: 'casino', business: 'business' }

function withUnlocks(a: ActivityView): ActivityView {
  const f = GATED[a.category]
  const st = f ? features.value[f] : null
  if (!st || st.unlocked) return a
  const msg = lockText(st)
  return { ...a, available: false, lockedReason: { tr: msg, en: msg } }
}

const CAT_ICON: Record<ActivityCategory, IconName> = {
  training: 'barbell', rest: 'bed', social: 'users', family: 'house', media: 'megaphone', business: 'storefront',
  shopping: 'shopping-bag', nightlife: 'moon', charity: 'hand-heart', casino: 'cards',
}
const SLOT_ICON: IconName[] = ['sunrise', 'sun', 'moon']
const CAT_ORDER: ActivityCategory[] = ['training', 'rest', 'social', 'family', 'media', 'business', 'shopping', 'charity', 'nightlife', 'casino']

function actIcon(a: ActivityView): IconName {
  return isIconName(a.icon) ? a.icon : CAT_ICON[a.category]
}

function WeekStrip() {
  const s = gameState.value
  if (!s) return null
  const today = s.calendar.day
  const fixtures = data.fixtures()
  const matchDays = new Set(fixtures.filter((f) => f.week === s.calendar.week && !f.result).map((f) => f.day))
  return (
    <ol class="plan-week" aria-label={t('planner.week')}>
      {[0, 1, 2, 3, 4, 5, 6].map((d) => (
        <li key={d} class={`plan-day${d === today ? ' is-today' : ''}${d < today ? ' is-past' : ''}${matchDays.has(d) ? ' is-match' : ''}`} aria-current={d === today ? 'date' : undefined}>
          <span class="plan-day-name">{tx(`data.dayShort.${d}`)}</span>
          <span class="plan-day-icon">{matchDays.has(d) ? <Icon name="ball" size={18} /> : <span class="plan-day-dot" aria-hidden="true" />}</span>
          {matchDays.has(d) && <span class="sr-only">{t('planner.matchDay')}</span>}
        </li>
      ))}
    </ol>
  )
}

function ActivityRow({ a, open, onToggle, onDo }: { a: ActivityView; open: boolean; onToggle: () => void; onDo: () => void }) {
  return (
    <li class={`plan-act-item${open ? ' is-open' : ''}`}>
      <button type="button" class={`plan-act${open ? ' is-selected' : ''}${a.available ? '' : ' is-locked'}`} aria-expanded={open} onClick={onToggle} data-testid={`act-${a.id}`}>
        <span class={`plan-act-icon cat-${a.category}`}><Icon name={actIcon(a)} size={22} /></span>
        <span class="plan-act-main">
          <span class="row-between">
            <span class="plan-act-name truncate">{lt(a.name)}</span>
            {a.risk && a.risk !== 'safe' && <RiskBadge risk={a.risk} />}
          </span>
          <span class="plan-act-desc">{lt(a.desc)}</span>
          <span class="plan-act-meta">
            <Chip tone={a.energy > 0 ? 'warning' : 'pos'} icon="energy">
              {a.energy > 0 ? t('planner.energyCost', { n: a.energy }) : t('planner.energyGain', { n: -a.energy })}
            </Chip>
            {a.cost > 0 && <Chip tone="neg" icon="coins">{formatMoney(-a.cost)}</Chip>}
            <Chip icon="clock">{t('planner.slots', { n: a.slots })}</Chip>
          </span>
          {a.effects.length > 0 && <DeltaList deltas={a.effects} compact max={5} />}
          {!a.available && a.lockedReason && (
            <span class="plan-act-lock"><Icon name="lock" size={14} /> {lt(a.lockedReason)}</span>
          )}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} class="t-lo plan-act-chev" />
      </button>
      {open && (
        <div class="plan-act-go">
          <span class="t-xs t-mid">{t('planner.usesTime', { n: a.slots })}</span>
          <Button variant="primary" size="sm" icon="play" onClick={onDo} disabled={!a.available} data-testid="act-do">
            {t('planner.doNow')}
          </Button>
        </div>
      )}
    </li>
  )
}

export function ActivitiesScreen() {
  const s = gameState.value
  const [cat, setCat] = useState<ActivityCategory | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  if (!s) return <Page title={t('planner.title')}><EmptyState /></Page>
  const acts = data.activities().map(withUnlocks)
  const cats = CAT_ORDER.filter((c) => acts.some((a) => a.category === c))
  const list = cat === 'all' ? acts : acts.filter((a) => a.category === cat)
  const groups = cat === 'all' ? cats.map((c) => ({ c, items: list.filter((a) => a.category === c) })) : [{ c: cat, items: list }]
  const cal = s.calendar
  const energy = Math.round(s.life.energy)
  const low = energy < 15
  const blocked = agendaBlockReason()

  const doNow = (a: ActivityView) => {
    // Studying the opponent is the video-scouting mini-game (plain activity when no match is coming).
    if (a.id === 'video') {
      setOpen(null)
      openScouting()
      return
    }
    const deltas = actions.doActivity(a.id)
    if (deltas.length === 0) return // the backend already explained why it failed
    setOpen(null)
    const parts = deltas.slice(0, 3).map((d) => `${d.value > 0 ? '+' : ''}${d.key === 'money' ? formatMoney(d.value) : d.value} ${tx(`data.stat.${d.key}`, undefined, tx(`data.attr.${d.key}`, undefined, d.key))}`)
    toast(`${t('planner.done', { name: lt(a.name) })}${parts.length ? ' — ' + parts.join(', ') : ''}`, 'success', actIcon(a))
  }

  return (
    <Page
      title={t('planner.title')}
      sub={t('planner.sub', { day: tx(`data.day.${cal.day}`), week: t('common.week', { n: cal.week + 1 }) })}
      footer={
        <Button variant="primary" size="lg" block icon="fast-forward" haptic="select" onClick={() => requestAdvance()} data-tour="advance" disabled={!!blocked} title={blocked ? lt(blocked) : undefined}>
          {blocked ? t('bench.agenda.blocked') : t('planner.advance')}
        </Button>
      }
    >
      <WeekStrip />
      {/* The daily agenda drives the day: mandatory tasks + suggestions (sim/game/agenda). */}
      <AgendaCard />

      <Card class="plan-energy">
        <div class="row-between">
          <span class="row"><Icon name={SLOT_ICON[cal.slot] ?? 'sun'} size={18} class="t-gold" /><span class="label">{t('planner.now', { slot: tx(`data.slot.${cal.slot}`) })}</span></span>
          <span class={`t-sm num ${low ? 't-neg' : 't-mid'}`}><Icon name="energy" size={14} /> {energy}</span>
        </div>
        <StatBar value={energy} color="var(--accent-gold)" showValue={false} size="lg" label={t('planner.energyBudget')} hideLabel />
        <p class="t-xs t-mid plan-energy-warn">{low ? <><Icon name="warning" size={14} /> {t('planner.energyLow')}</> : t('planner.intro')}</p>
      </Card>

      <section class="plan-catalog" aria-labelledby="plan-cat-title" data-tour="activities">
        <h2 class="h3" id="plan-cat-title">{t('planner.catalog')}</h2>
        <Tabs
          variant="pill"
          label={t('planner.catalog')}
          idPrefix="plancat"
          value={cat}
          onChange={setCat}
          items={[{ id: 'all' as const, label: t('planner.all') }, ...cats.map((c) => ({ id: c, label: t(`data.activityCat.${c}`), icon: CAT_ICON[c] }))]}
        />
        <div class="plan-groups">
          {groups.map((g) => (
            <section key={g.c} class="plan-group" aria-label={t(`data.activityCat.${g.c}`)}>
              {cat === 'all' && (
                <h3 class="plan-group-head"><Icon name={CAT_ICON[g.c]} size={16} />{t(`data.activityCat.${g.c}`)}</h3>
              )}
              {g.items.length === 0 ? (
                <p class="t-sm t-lo">{t('planner.noActivities')}</p>
              ) : (
                <ul class="plan-act-list">
                  {g.items.map((a) => <ActivityRow key={a.id} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} onDo={() => doNow(a)} />)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </section>
    </Page>
  )
}
