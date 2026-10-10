import '../../../styles/screens/bench.css'
import { useState } from 'preact/hooks'
import { lt, t } from '../../../i18n'
import type { AgendaTask } from '../../../sim/game/agenda'
import { Badge, Button, Modal, toast } from '../../components'
import { Icon, type IconName } from '../../icons'
import { haptic } from '../../haptics'
import { actions, data, gameState, navigate, stateVersion, type TrainingSessionView } from '../../store'
import { agendaSkipPrompt, quickResolveAndSkip, resolveAgendaTask, todayAgenda, todayIdeas, type WeekIdea } from '../../backend/benchPath'
import { DrillOverlay } from '../training/DrillOverlay'
import { openScouting } from '../../backend/scouting'
import { runBenchAction } from './benchActions'

const TASK_ICON: Record<string, IconName> = {
  teamTraining: 'tactics', disciplinary: 'gavel', pressConference: 'megaphone', dopingTest: 'first-aid', physio: 'heartbeat', sponsorShoot: 'camera',
  autographs: 'users', boardMeeting: 'building', nationalCamp: 'flag', dateNight: 'heart', familyBirthday: 'gift', captainMentoring: 'crown',
  charity: 'hand-heart', recoverySession: 'heartbeat', devMeeting: 'chart-line', teamMeeting: 'chat', gymBlock: 'barbell', fitnessTest: 'energy', clubMedia: 'camera', communityVisit: 'hand-heart', train: 'barbell', rest: 'bed', video: 'eye',
}
const IDEA_ICON: Record<WeekIdea['action'], IconName> = {
  impress: 'target', reserve: 'ball', scrimmage: 'whistle', talk: 'chat', oneOnOne: 'handshake', rest: 'bed', video: 'eye', training: 'barbell', teamDinner: 'fork-knife',
}

const say = (lines: { tr: string; en: string }[]): void => {
  if (lines.length) toast(lines.map((l) => lt(l)).join(' '), 'success', 'check', 4500)
}

function MandatoryRow({ task, onDrill }: { task: AgendaTask; onDrill: (task: AgendaTask) => void }) {
  const [open, setOpen] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const done = !!task.done
  const choices = task.play?.choices ?? []
  return (
    <li class={`ag-task is-mandatory${done ? ' is-done' : ''}`} data-testid={`ag-task-${task.kind}`} data-done={done ? task.done : undefined}>
      <div class="ag-task-top">
        <span class="ag-task-icon" aria-hidden="true"><Icon name={TASK_ICON[task.kind] ?? 'calendar'} size={20} /></span>
        <div class="ag-task-body">
          <div class="ag-task-title">
            <Icon name={done ? 'check' : 'lock'} size={14} class={done ? 't-pos' : 't-gold'} />
            <span>{lt(task.title)}</span>
          </div>
          <p class="t-xs t-mid">{done && task.result ? lt(task.result) : lt(task.why)}</p>
          {!done && <p class="t-xs ag-quick-hint">{lt(task.reward)}</p>}
        </div>
      </div>
      {!done && (
        <div class="ag-actions">
          <Button size="sm" variant="primary" icon="check" onClick={() => { haptic('select'); say(resolveAgendaTask(task.id, 'quick')) }} data-testid="ag-quick">{t('bench.agenda.quick')}</Button>
          {task.play?.drill && <Button size="sm" variant="secondary" icon="play" onClick={() => onDrill(task)} data-testid="ag-play">{t('bench.agenda.play')}</Button>}
          {choices.length > 0 && <Button size="sm" variant="secondary" icon="chat" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="ag-decide">{t('bench.agenda.decide')}</Button>}
          {task.skip && <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(true)} data-testid="ag-skip">{t('bench.agenda.skip')}</Button>}
        </div>
      )}
      {!done && open && (
        <ul class="ag-choices">
          {choices.map((c) => (
            <li key={c.id}>
              <button type="button" class="ag-choice" onClick={() => { haptic('select'); say(resolveAgendaTask(task.id, 'played', { choice: c.id })) }} data-testid={`ag-choice-${c.id}`}>
                <b class="t-sm">{lt(c.label)}</b>
                <span class="t-xs t-mid">{lt(c.hint)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirmSkip && task.skip && (
        <Modal open size="sm" title={t('bench.agenda.skipTitle')} onClose={() => setConfirmSkip(false)}>
          <p class="t-mid">{t('bench.agenda.skipText', { task: lt(task.title) })}</p>
          <p class="t-sm ag-skip-cost"><Icon name="warning" size={16} /> {lt(task.skip)}</p>
          <div class="row ag-modal-actions">
            <Button variant="ghost" onClick={() => setConfirmSkip(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { setConfirmSkip(false); say(resolveAgendaTask(task.id, 'skip')) }} data-testid="ag-skip-confirm">{t('bench.agenda.skipConfirm')}</Button>
          </div>
        </Modal>
      )}
    </li>
  )
}

function PrepRow({ task }: { task: AgendaTask }) {
  const done = !!task.done
  const go = () => {
    haptic('select')
    if (task.kind === 'train') navigate('training')
    // The opponent video is a mini-game now (game/training/scouting), not an instant resolve.
    else if (task.kind === 'video') openScouting()
    else if (task.activity) actions.doActivity(task.activity)
  }
  return (
    <li class={`ag-task is-prep${done ? ' is-done' : ''}`} data-testid={`ag-prep-${task.kind}`}>
      <button type="button" class="ag-prep-btn" onClick={go} disabled={done}>
        <span class="ag-task-icon" aria-hidden="true"><Icon name={done ? 'check' : TASK_ICON[task.kind] ?? 'target'} size={20} /></span>
        <span class="ag-task-body">
          <span class="ag-task-title"><span>{lt(task.title)}</span></span>
          <span class="t-xs t-mid">{lt(task.why)}</span>
          <span class="idea-reward"><Icon name="trend-up" size={13} weight={2.4} />{lt(task.reward)}</span>
        </span>
        {!done && <Icon name="chevron-right" size={18} class="idea-go" />}
      </button>
    </li>
  )
}

/**
 * "Bugünün programı" (owner: a footballer's every moment is planned): today's
 * mandatory tasks (lock until done; quick / play / decide / skip), the
 * preparation goals for the next opponent and today's best opportunities.
 */
export function AgendaCard() {
  void stateVersion.value
  const s = gameState.value
  const [drillTask, setDrillTask] = useState<{ task: AgendaTask; session: TrainingSessionView } | null>(null)
  if (!s || s.hero.retired || !s.hero.contract) return null
  const a = todayAgenda()
  if (!a) return null
  const mand = a.tasks.filter((x) => x.mandatory)
  const prep = a.tasks.filter((x) => !x.mandatory)
  const ideas = todayIdeas().slice(0, prep.length >= 2 ? 1 : 2)
  const open = mand.filter((x) => !x.done).length
  const doneN = a.tasks.filter((x) => x.done).length
  const startDrill = (task: AgendaTask) => {
    const session = data.trainingSessions().find((x) => x.id === task.play?.drill && x.available && x.drill)
    if (!session) {
      say(resolveAgendaTask(task.id, 'quick'))
      return
    }
    setDrillTask({ task, session })
  }
  return (
    <section class="ag-card" data-testid="agenda" data-tour="agenda" aria-labelledby="ag-title">
      <div class="ag-head">
        <span class="ag-head-icon" aria-hidden="true"><Icon name="calendar" size={20} /></span>
        <div class="grow">
          <h2 class="h3" id="ag-title">{t('bench.agenda.title')}</h2>
          <p class="t-xs t-mid">{a.tasks.length ? t('bench.agenda.progress', { d: doneN, n: a.tasks.length }) : t('bench.agenda.free')}</p>
        </div>
        {open > 0 && <span class="ag-badge" aria-label={t('bench.agenda.openAria', { n: open })}><Badge count={open} /></span>}
      </div>

      {mand.length > 0 && (
        <div class="ag-block">
          <h3 class="micro ag-sec ag-sec-mand"><Icon name="lock" size={12} /> {t('bench.agenda.mandatory')}</h3>
          <ul class="ag-list">{mand.map((x) => <MandatoryRow key={x.id} task={x} onDrill={startDrill} />)}</ul>
        </div>
      )}

      {prep.length > 0 && (
        <div class="ag-block">
          <h3 class="micro ag-sec">{t('bench.agenda.prep')}</h3>
          <ul class="ag-list">{prep.map((x) => <PrepRow key={x.id} task={x} />)}</ul>
        </div>
      )}

      {ideas.length > 0 && (
        <div class="ag-block">
          <h3 class="micro ag-sec">{t('bench.ideas.title')}</h3>
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
        </div>
      )}

      {drillTask && (
        <DrillOverlay
          session={drillTask.session}
          onDrillResult={(perf) => { resolveAgendaTask(drillTask.task.id, 'played', { performance: perf }) }}
          onClose={() => setDrillTask(null)}
        />
      )}
    </section>
  )
}

/** "Skip to matchday" with open mandatory tasks: one confirm quick-resolves them all. */
export function AgendaSkipConfirm() {
  const p = agendaSkipPrompt.value
  if (!p) return null
  const close = () => { agendaSkipPrompt.value = null }
  return (
    <Modal open size="sm" title={t('bench.agenda.skipAllTitle')} onClose={close}>
      <p class="t-mid">{t('bench.agenda.skipAllText')}</p>
      <ul class="skip-list">
        {p.map((x) => <li key={x.id}><Icon name={TASK_ICON[x.kind] ?? 'calendar'} size={16} /><span>{lt(x.title)}</span><span class="t-xs t-mid">{lt(x.reward)}</span></li>)}
      </ul>
      <div class="row ag-modal-actions">
        <Button variant="ghost" onClick={close}>{t('common.cancel')}</Button>
        <Button variant="primary" icon="fast-forward" onClick={() => quickResolveAndSkip(() => actions.advanceToMatch())} data-testid="ag-skip-all">{t('bench.agenda.skipAllGo')}</Button>
      </div>
    </Modal>
  )
}
