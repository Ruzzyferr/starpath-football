/** Social tab extras: weekly press conference (3 questions) and the generated fan feed. */
import { useState } from 'preact/hooks'
import type { LText } from '../../../core/types'
import { lt, t } from '../../../i18n'
import { JOURNALIST_STYLE_NAME } from '../../../sim/game/interview'
import { Button, Card, CardHeader } from '../../components'
import { formatCompact } from '../../format'
import { Icon } from '../../icons'
import { gameState } from '../../store'
import { lifePlus } from '../../backend/lifePlus'

const TONE_ICON = { humble: 'hand-heart', bold: 'fire', critical: 'warning', deflect: 'shield', joke: 'smile' } as const

export function PressRoom() {
  void gameState.value // re-render on state changes
  const [headline, setHeadline] = useState<LText | null>(null)
  const session = lifePlus.pressSession()
  const open = session && !session.headline ? session : null
  const q = open?.questions.find((x) => !open.answers[x.id])
  const idx = open && q ? open.questions.indexOf(q) : 0
  return (
    <Card class="press-room" data-testid="press-room">
      <CardHeader title={t('life.press.title')} icon="megaphone" sub={t('life.press.sub')} />
      {headline ? (
        <div class="press-headline" role="status">
          <span class="micro t-mid">{t('life.press.headline')}</span>
          <p class="press-headline-text">{lt(headline)}</p>
          <Button size="sm" variant="ghost" onClick={() => setHeadline(null)}>{t('life.press.close')}</Button>
        </div>
      ) : q && open ? (
        <div class="press-q stack">
          <div class="row-between t-xs t-mid">
            <span>{t('life.press.question', { n: idx + 1, total: open.questions.length })}</span>
            <span>{q.journalist.name} · {q.journalist.outlet} · {lt(JOURNALIST_STYLE_NAME[q.journalist.style])}</span>
          </div>
          {q.trap && <span class="press-trap t-xs"><Icon name="warning" size={13} /> {t('life.press.trap')}</span>}
          <p class="press-question">“{lt(q.text)}”</p>
          <div class="press-options stack">
            {q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                class={`press-option tone-${o.tone}`}
                onClick={() => {
                  const r = lifePlus.answer(q.id, o.id)
                  if (r.headline) setHeadline(r.headline)
                }}
              >
                <Icon name={TONE_ICON[o.tone]} size={16} /> <span>{lt(o.label)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : lifePlus.canHoldPress() ? (
        <Button variant="secondary" icon="megaphone" block onClick={() => lifePlus.startPressConference()}>{t('life.press.hold')}</Button>
      ) : (
        <p class="t-sm t-lo">{t('life.press.held')}</p>
      )}
    </Card>
  )
}

export function FanPanel() {
  void gameState.value
  const f = lifePlus.feed()
  if (!f) return null
  return (
    <div class="stack fan-panel">
      <Card class="fan-trending">
        <CardHeader title={t('life.feed.trending')} icon="hashtag" />
        <ol class="fan-tags">
          {f.hashtags.map((h) => (
            <li key={h.tag} class={`fan-tag mood-${h.mood}`}><span class="fan-tag-name">{h.tag}</span> <span class="t-xs t-lo">{t('life.feed.posts', { n: formatCompact(h.count, undefined, 1000) })}</span></li>
          ))}
        </ol>
        <h4 class="micro t-mid">{t('life.feed.audience')}</h4>
        <div class="fan-audience" role="img" aria-label={f.audience.map((a) => `${t(`life.feed.aud.${a.key}`)} ${Math.round(a.share * 100)}%`).join(', ')}>
          {f.audience.map((a) => <span key={a.key} class={`fan-aud fan-aud-${a.key}`} style={{ flexGrow: a.share }} />)}
        </div>
        <div class="fan-aud-legend t-xs">
          {f.audience.map((a) => <span key={a.key}><i class={`fan-aud-dot fan-aud-${a.key}`} /> {t(`life.feed.aud.${a.key}`)} {Math.round(a.share * 100)}%</span>)}
        </div>
      </Card>
      <Card class="fan-comments" data-testid="fan-comments">
        <CardHeader title={t('life.feed.comments')} icon="chat" />
        <ul class="fan-list">
          {f.comments.map((c) => (
            <li key={c.id} class={`fan-comment mood-${c.mood}`}>
              <div class="fan-c-head"><b>@{c.handle}</b> <span class="t-xs t-lo"><Icon name="heart" size={12} /> {formatCompact(c.likes, undefined, 1000)}</span></div>
              <p class="fan-c-text">{lt(c.text)}</p>
              {c.replies.length > 0 && (
                <ul class="fan-replies">
                  {c.replies.map((r, i) => (
                    <li key={i} class={`fan-reply mood-${r.mood}`}><span class="t-xs t-mid">↳ @{r.handle}</span> {lt(r.text)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
