import '../../../styles/screens/board.css'
import { useRef, useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { Button, Card, CardHeader, Chip, EmptyState, Page, Segmented, Switch, TabPanel, Tabs, toast } from '../../components'
import { Icon } from '../../icons'
import { navigate } from '../../store'
import { seasonLabel } from '../../format'
import {
  answerNotifyPrompt, clearFeedback, hallOfFame, importModText, liveOpsView, metaData, removeMod, setModEnabled, setOnlineFeatures, submitFeedback,
} from '../../backend/meta'
import { milestoneTimeline } from '../../../sim/game/liveOps'
import { MOD_MAX_BYTES, MOD_MAX_INSTALLED } from '../../../sim/game/mods'
import { feedbackExport, shouldAskNotifications, type FeedbackKind } from '../../../sim/game/feedback'
import { downloadText } from '../../share/cards'
import { APP_VERSION } from '../../../telemetry/buildInfo'

type Tab = 'today' | 'story' | 'mods' | 'feedback' | 'about'

function Today() {
  const v = liveOpsView()
  if (!v) return <EmptyState icon="calendar" text={t('community.today.noCareer')} compact />
  const stamps = metaData.value.local.stamps
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <section class={`bd-hero${v.current ? '' : ' is-done'}`} data-testid="season-event" aria-labelledby="cm-ev-title">
        <span class="bd-badge" aria-hidden="true"><Icon name={v.current ? v.current.icon : 'calendar'} size={34} weight={2.2} /></span>
        <div class="grow stack" style={{ gap: '4px', minWidth: 0 }}>
          <span class="micro t-lo">{t('community.today.now')}</span>
          <h2 class="h2" id="cm-ev-title">{v.current ? lt(v.current.title) : t('community.today.none')}</h2>
          <p class="t-sm t-mid">{v.current ? lt(v.current.desc) : t('community.today.noneText')}</p>
        </div>
        {v.current && <Chip tone="neutral" icon="flag">{t('community.today.weeks', { a: v.current.start + 1, b: v.current.end + 1 })}</Chip>}
      </section>
      <Card>
        <CardHeader title={t('community.today.newsTitle')} icon="newspaper" />
        <p class="t-xs t-lo">{t('community.today.newsSub')}</p>
        <ul class="cm-list" data-testid="news-of-the-day">
          {v.news.map((n) => (
            <li key={n.id} class="cm-item">
              <span class="bd-badge bd-badge-sm" aria-hidden="true"><Icon name={n.icon} size={22} /></span>
              <div class="stack" style={{ gap: '2px', minWidth: 0 }}>
                <h3 class="h3">{lt(n.title)}</h3>
                <p class="t-sm t-mid">{lt(n.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('community.today.calendar', { s: seasonLabel(v.season) })} icon="calendar" />
        <ol class="cm-cal" data-testid="event-calendar">
          {v.calendar.map((e) => {
            const state = v.week > e.end ? 'past' : v.week >= e.start ? 'running' : 'next'
            const n = stamps[`${v.season}:${e.id}`] ?? 0
            return (
              <li key={e.id} class={`cm-cal-row is-${state}`}>
                <Icon name={e.icon} size={20} />
                <div class="grow stack" style={{ gap: '0', minWidth: 0 }}>
                  <b class="truncate">{lt(e.title)}</b>
                  <span class="t-xs t-lo">{t('community.today.weeks', { a: e.start + 1, b: e.end + 1 })}{n > 0 ? ` · ${t('community.today.stamps', { n })}` : ''}</span>
                </div>
                <Chip tone={state === 'running' ? 'pos' : 'neutral'} solid={state === 'running'}>{t(`community.today.${state}`)}</Chip>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

function Story() {
  const items = milestoneTimeline(metaData.value.local, hallOfFame()).slice(0, 60)
  if (items.length === 0) return <EmptyState icon="history" text={t('community.story.empty')} compact />
  return (
    <ol class="cm-timeline" data-testid="milestone-timeline" aria-label={t('community.story.title')}>
      {items.map((m) => (
        <li key={m.id} class={`cm-tl cm-tl-${m.kind}`}>
          <span class="cm-tl-dot" aria-hidden="true"><Icon name={m.icon} size={18} /></span>
          <div class="stack" style={{ gap: '1px', minWidth: 0 }}>
            <span class="micro t-lo">{t(`community.story.kind.${m.kind}`)}{m.season ? ` · ${seasonLabel(m.season)}` : ''}</span>
            <b class="truncate">{lt(m.title)}</b>
            <span class="t-xs t-mid">{lt(m.detail)}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Mods() {
  const mods = metaData.value.local.mods
  const input = useRef<HTMLInputElement>(null)
  const onFile = async (e: Event) => {
    const el = e.currentTarget as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (!file) return
    const text = file.size > MOD_MAX_BYTES ? 'x'.repeat(MOD_MAX_BYTES + 1) : await file.text()
    const r = await importModText(text)
    if (r.error === 'limit') toast(t('community.mods.limit', { n: MOD_MAX_INSTALLED }), 'warning', 'flag')
    else if (r.ok && r.pack) toast(t('community.mods.imported', { n: r.pack.name }), 'success', 'check')
    else toast(t('community.mods.invalid', { e: r.errors.slice(0, 3).join('; ') }), 'error', 'warning', 6000)
  }
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <p class="t-sm t-mid">{t('community.mods.intro', { kb: MOD_MAX_BYTES / 1024 })}</p>
      <input ref={input} type="file" accept="application/json,.json" hidden data-testid="mod-file" onChange={onFile} />
      <Button variant="primary" icon="upload" onClick={() => input.current?.click()} data-testid="mod-pick">{t('community.mods.pick')}</Button>
      {mods.length === 0 ? (
        <EmptyState icon="users" text={t('community.mods.none')} compact />
      ) : (
        <ul class="cm-list" data-testid="mod-list">
          {mods.map((m) => (
            <li key={m.id} class="cm-item cm-mod">
              <div class="grow stack" style={{ gap: '2px', minWidth: 0 }}>
                <b class="truncate">{m.name} <span class="t-xs t-lo">v{m.version}</span></b>
                <span class="t-xs t-mid">{t('community.mods.contents', { c: m.pack.countries?.length ?? 0, n: m.pack.names?.length ?? 0, w: (m.pack.world?.leagues?.length ?? 0) + (m.pack.world?.clubs?.length ?? 0) })}</span>
                <Chip tone={m.official ? 'pos' : 'neutral'} icon={m.official ? 'check' : 'flag'}>{t(m.official ? 'community.mods.official' : 'community.mods.unofficial')}</Chip>
              </div>
              <Switch label={t('community.mods.enable')} checked={m.enabled} onChange={(v) => setModEnabled(m.id, v)} />
              <Button variant="ghost" size="sm" onClick={() => removeMod(m.id)}>{t('community.mods.remove')}</Button>
            </li>
          ))}
        </ul>
      )}
      <p class="t-xs t-lo">{t('community.mods.note')}</p>
      <p class="t-xs t-lo">{t('community.mods.pending')}</p>
    </div>
  )
}

const KINDS: FeedbackKind[] = ['bug', 'idea', 'other']

function Feedback() {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [text, setText] = useState('')
  const [device, setDevice] = useState(true)
  const [matches, setMatches] = useState(true)
  const list = metaData.value.local.feedback
  const save = () => {
    const e = submitFeedback(kind, text, { device, recentMatches: matches }, APP_VERSION)
    if (!e) return toast(t('community.feedback.tooShort'), 'warning', 'warning')
    setText('')
    toast(t('community.feedback.saved'), 'success', 'check')
  }
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <p class="t-sm t-mid">{t('community.feedback.intro')}</p>
      <Segmented label={t('community.feedback.kindLabel')} value={kind} onChange={setKind} options={KINDS.map((id) => ({ id, label: t(`community.feedback.kind.${id}`) }))} />
      <label class="stack" style={{ gap: '4px' }}>
        <span class="micro t-lo">{t('community.feedback.text')}</span>
        <textarea
          class="cm-field"
          rows={5}
          maxLength={1500}
          value={text}
          placeholder={t('community.feedback.placeholder')}
          data-testid="feedback-text"
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
      <Switch label={t('community.feedback.device')} checked={device} onChange={setDevice} />
      <Switch label={t('community.feedback.matches')} checked={matches} onChange={setMatches} />
      <Button variant="primary" icon="check" onClick={save} data-testid="feedback-save">{t('community.feedback.save')}</Button>
      <Card>
        <CardHeader title={t('community.feedback.list', { n: list.length })} icon="chat" />
        {list.length === 0 ? (
          <p class="t-sm t-lo">{t('community.feedback.empty')}</p>
        ) : (
          <>
            <ul class="cm-list" data-testid="feedback-list">
              {list.slice(-5).reverse().map((f) => (
                <li key={f.id} class="cm-item">
                  <Chip tone="neutral">{t(`community.feedback.kind.${f.kind}`)}</Chip>
                  <span class="t-sm t-mid truncate">{f.text}</span>
                </li>
              ))}
            </ul>
            <div class="row" style={{ gap: '8px', marginTop: '8px' }}>
              <Button variant="ghost" icon="download" onClick={() => downloadText(feedbackExport(list), 'starpath-feedback.json', 'application/json;charset=utf-8')} data-testid="feedback-export">{t('community.feedback.export')}</Button>
              <Button variant="ghost" onClick={clearFeedback}>{t('community.feedback.clear')}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

/** One-time, in-app prompt shown only after the first cleared weekly challenge. */
export function NotifyPrompt() {
  const m = metaData.value.local
  if (!shouldAskNotifications(m)) return null
  return (
    <Card>
      <div class="cm-item" data-testid="notify-prompt">
        <span class="bd-badge bd-badge-sm" aria-hidden="true"><Icon name="bell" size={22} /></span>
        <div class="grow stack" style={{ gap: '2px' }}>
          <h3 class="h3">{t('community.about.notifTitle')}</h3>
          <p class="t-sm t-mid">{t('community.about.notifAsk')}</p>
          <div class="row" style={{ gap: '8px' }}>
            <Button size="sm" variant="primary" onClick={() => void answerNotifyPrompt(true)}>{t('community.about.notifAllow')}</Button>
            <Button size="sm" variant="ghost" onClick={() => void answerNotifyPrompt(false)}>{t('community.about.notifLater')}</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function About() {
  const m = metaData.value.local
  return (
    <div class="stack" style={{ gap: '12px' }}>
      <Card>
        <Switch label={t('community.about.online')} desc={t('community.about.onlineDesc')} checked={m.online} onChange={setOnlineFeatures} />
        <p class="t-xs t-lo" data-testid="online-state">{t(m.online ? 'community.about.onlineOn' : 'community.about.onlineOff')}</p>
      </Card>
      <Card>
        <CardHeader title={t('community.about.notifTitle')} icon="bell" />
        <p class="t-sm t-mid">{t('community.about.notifDesc')}</p>
        <p class="t-xs t-lo" data-testid="notify-state">{t(m.notify === 'granted' ? 'community.about.notifGranted' : m.notify === 'declined' ? 'community.about.notifDeclined' : 'community.about.notifUnasked')}</p>
      </Card>
      <div class="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
        <Button variant="ghost" icon="sparkle" onClick={() => navigate('whatsNew')}>{t('community.about.changelog')}</Button>
        <Button variant="ghost" icon="star" onClick={() => navigate('credits')}>{t('community.about.credits')}</Button>
      </div>
      <Card>
        <CardHeader title={t('community.about.deferredTitle')} icon="info" />
        <p class="t-sm t-mid">{t('community.about.deferred')}</p>
      </Card>
    </div>
  )
}

export function CommunityScreen() {
  void currentLang.value
  const [tab, setTab] = useState<Tab>('today')
  return (
    <Page title={t('community.title')} sub={t('community.sub')} class="bd-page">
      <Tabs<Tab>
        variant="pill"
        idPrefix="community"
        label={t('community.title')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'today', label: t('community.tab.today'), icon: 'calendar' },
          { id: 'story', label: t('community.tab.story'), icon: 'history' },
          { id: 'mods', label: t('community.tab.mods'), icon: 'users' },
          { id: 'feedback', label: t('community.tab.feedback'), icon: 'chat' },
          { id: 'about', label: t('community.tab.about'), icon: 'gear' },
        ]}
      />
      <TabPanel id={tab} idPrefix="community">
        {tab === 'today' ? <Today /> : tab === 'story' ? <Story /> : tab === 'mods' ? <Mods /> : tab === 'feedback' ? <Feedback /> : <About />}
      </TabPanel>
    </Page>
  )
}
