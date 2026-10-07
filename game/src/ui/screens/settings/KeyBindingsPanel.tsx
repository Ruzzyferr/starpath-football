import { useEffect, useState } from 'preact/hooks'
import { t, tx } from '../../../i18n'
import { Button, toast } from '../../components'
import {
  BIND_ACTIONS,
  bindingsSignal,
  findConflict,
  isDefaultBindings,
  keyLabel,
  resetBindings,
  setBinding,
  type BindAction,
} from '../../../input/bindings'

/** PC key rebinding list with conflict detection and reset (WP-9). */
export function KeyBindingsPanel() {
  const b = bindingsSignal.value
  const [listening, setListening] = useState<BindAction | null>(null)
  const [msg, setMsg] = useState<{ text: string; swap?: { action: BindAction; code: string } } | null>(null)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        setListening(null)
        return
      }
      const res = setBinding(listening, e.code)
      if (res.ok) {
        setMsg(null)
        setListening(null)
      } else if (res.reason === 'reserved') {
        setMsg({ text: t('settings.ctl.reserved') })
      } else {
        const other = findConflict(listening, e.code)
        setMsg({
          text: t('settings.ctl.conflict', { key: keyLabel(e.code), action: tx(`settings.ctl.actions.${other ?? res.with}`) }),
          swap: { action: listening, code: e.code },
        })
        setListening(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listening])

  return (
    <div class="kb-panel">
      <p class="t-sm t-mid" id="kb-desc">{t('settings.ctl.desc')}</p>
      <ul class="kb-list" aria-describedby="kb-desc">
        {BIND_ACTIONS.map((a) => (
          <li key={a} class="kb-row">
            <span class="kb-name">{tx(`settings.ctl.actions.${a}`)}</span>
            <button
              type="button"
              class={`kb-key${listening === a ? ' is-listening' : ''}`}
              aria-label={`${tx(`settings.ctl.actions.${a}`)}: ${keyLabel(b[a])}`}
              onClick={() => {
                setMsg(null)
                setListening(listening === a ? null : a)
              }}
            >
              {listening === a ? t('settings.ctl.press') : <kbd>{keyLabel(b[a])}</kbd>}
            </button>
          </li>
        ))}
      </ul>
      <div class="kb-status" role="status" aria-live="polite">
        {listening && <span class="t-xs t-lo">{t('settings.ctl.cancel')}</span>}
        {msg && (
          <span class="kb-msg">
            {msg.text}{' '}
            {msg.swap && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBinding(msg.swap!.action, msg.swap!.code, true)
                  setMsg(null)
                }}
              >
                {t('settings.ctl.swap')}
              </Button>
            )}
          </span>
        )}
      </div>
      <div>
        <Button
          variant="ghost"
          disabled={isDefaultBindings(b)}
          onClick={() => {
            resetBindings()
            setMsg(null)
            toast(t('settings.ctl.resetDone'), 'success')
          }}
        >
          {t('settings.ctl.reset')}
        </Button>
      </div>
      <p class="t-xs t-lo">{t('settings.ctl.padHint')}</p>
    </div>
  )
}
