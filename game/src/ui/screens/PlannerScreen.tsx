import { AgendaCard } from './bench/AgendaCard'
import { agendaBlockReason } from '../backend/benchPath'
import '../../styles/screens/planner.css'
import { useState } from 'preact/hooks'
import { lt, t, tx } from '../../i18n'
import {
  Button, Card, Chip, DeltaList, EmptyState, Modal, Page, RiskBadge, StatBar, Tabs, toast, toastUndo,
} from '../components'
import { formatMoney } from '../format'
import { Icon, isIconName, type IconName } from '../icons'
import { actions, data, gameState, type ActivityCategory, type ActivityView, type DaySlotView } from '../store'
import { requestAdvance } from '../tutorial/MatchdayConfirm'
import { lockText } from '../tutorial/UnlockGate'
import { features, type FeatureId } from '../tutorial/unlocks'

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

function ActivityRow({ a, onPick, selected }: { a: ActivityView; onPick: (a: ActivityView) => void; selected: boolean }) {
  return (
    <button type="button" class={`plan-act${selected ? ' is-selected' : ''}${a.available ? '' : ' is-locked'}`} disabled={!a.available} onClick={() => onPick(a)}>
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
          {a.slots > 1 && <Chip icon="clock">{t('planner.slots', { n: a.slots })}</Chip>}
        </span>
        {a.effects.length > 0 && <DeltaList deltas={a.effects} compact max={5} />}
        {!a.available && a.lockedReason && (
          <span class="plan-act-lock"><Icon name="lock" size={14} /> {lt(a.lockedReason)}</span>
        )}
      </span>
      {selected && <Icon name="check" size={20} class="plan-act-check" />}
    </button>
  )
}

function Picker({ slot, current, onClose }: { slot: DaySlotView | null; current: string | null; onClose: () => void }) {
  const [cat, setCat] = useState<ActivityCategory | 'all'>('all')
  if (!slot) return null
  const acts = data.activities().map(withUnlocks)
  const cats = CAT_ORDER.filter((c) => acts.some((a) => a.category === c))
  const list = cat === 'all' ? acts : acts.filter((a) => a.category === cat)
  const groups = cat === 'all' ? cats.map((c) => ({ c, items: list.filter((a) => a.category === c) })) : [{ c: cat, items: list }]
  const pick = (a: ActivityView) => {
    actions.planSlot(slot.slot, a.id)
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={t('planner.pickerTitle', { slot: tx(`data.slot.${slot.slot}`) })} size="lg" class="plan-picker">
      <Tabs
        variant="pill"
        label={t('planner.choose')}
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
              g.items.map((a) => <ActivityRow key={a.id} a={a} onPick={pick} selected={a.id === current} />)
            )}
          </section>
        ))}
      </div>
      {current && (
        <Button variant="ghost" icon="trash" onClick={() => {
          const prev = current
          actions.planSlot(slot.slot, null)
          onClose()
          if (prev) toastUndo(t('board.undo.cleared'), () => { actions.planSlot(slot.slot, prev); toast(t('board.undo.restored'), 'success', 'check') })
        }}>
          {t('planner.clear')}
        </Button>
      )}
    </Modal>
  )
}

export function PlannerScreen() {
  const s = gameState.value
  const [open, setOpen] = useState<number | null>(null)
  if (!s) return <Page title={t('planner.title')}><EmptyState /></Page>
  const plan = data.dayPlan()
  const acts = data.activities()
  const byId = new Map(acts.map((a) => [a.id, a]))
  const cal = s.calendar
  const low = plan.projectedEnergy < 10
  const blocked = agendaBlockReason()
  const openSlot = open === null ? null : (plan.slots.find((x) => x.slot === open) ?? null)

  const doNow = (a: ActivityView) => {
    const deltas = actions.doActivity(a.id)
    if (deltas.length === 0) return // the backend already explained why it failed
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
      {/* Daily agenda: mandatory tasks and preparation take today's slots too (sim/game/agenda). */}
      <AgendaCard />

      <Card class="plan-energy">
        <div class="row-between">
          <span class="row"><Icon name="energy" size={18} class="t-gold" /><span class="label">{t('planner.energyBudget')}</span></span>
          <span class={`t-sm num ${low ? 't-neg' : 't-mid'}`}>{t('planner.energyAfter', { n: Math.round(plan.projectedEnergy) })}</span>
        </div>
        <StatBar value={plan.energyBudget} preview={Math.round(plan.projectedEnergy - plan.energyBudget)} color="var(--accent-gold)" showValue={false} size="lg" label={t('planner.energyBudget')} hideLabel />
        {low && <p class="t-xs t-neg plan-energy-warn"><Icon name="warning" size={14} /> {t('planner.energyLow')}</p>}
      </Card>

      <ol class="plan-slots" data-tour="plan-slot">
        {plan.slots.map((sl) => {
          const a = sl.activityId ? byId.get(sl.activityId) : undefined
          const editable = sl.state === 'current' || sl.state === 'upcoming'
          return (
            <li key={sl.slot} class={`plan-slot state-${sl.state}`}>
              <div class="plan-slot-time">
                <Icon name={SLOT_ICON[sl.slot]!} size={22} />
                <span class="plan-slot-name">{tx(`data.slot.${sl.slot}`)}</span>
                <span class={`plan-slot-state micro state-chip-${sl.state}`}>{t(`planner.state.${sl.state}`)}</span>
              </div>
              {sl.state === 'match' ? (
                <div class="plan-slot-body plan-slot-match">
                  <Icon name="ball" size={28} />
                  <span>{t('planner.matchSlot')}</span>
                </div>
              ) : (
                <button type="button" class="plan-slot-body" disabled={!editable} onClick={() => setOpen(sl.slot)} aria-label={`${tx(`data.slot.${sl.slot}`)}: ${a ? lt(a.name) : t('planner.empty')}. ${editable ? (a ? t('planner.change') : t('planner.choose')) : ''}`}>
                  {a ? (
                    <>
                      <span class={`plan-act-icon cat-${a.category}`}><Icon name={actIcon(a)} size={24} /></span>
                      <span class="grow">
                        <span class="plan-slot-act">{lt(a.name)}</span>
                        <DeltaList deltas={a.effects} compact max={4} />
                      </span>
                    </>
                  ) : (
                    <>
                      <span class="plan-act-icon plan-act-empty"><Icon name={editable ? 'plus' : 'bed'} size={22} /></span>
                      <span class="grow plan-slot-empty">{editable ? t('planner.choose') : t('planner.empty')}</span>
                    </>
                  )}
                  {editable && <Icon name="chevron-right" size={18} class="t-lo" />}
                </button>
              )}
              {sl.state === 'current' && a && (
                <div class="plan-slot-actions">
                  <Button variant="secondary" size="sm" icon="play" onClick={() => doNow(a)} disabled={!a.available}>
                    {t('planner.doNow')}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {open !== null && <Picker slot={openSlot} current={openSlot?.activityId ?? null} onClose={() => setOpen(null)} />}
    </Page>
  )
}
