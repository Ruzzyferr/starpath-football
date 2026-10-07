import { useState } from 'preact/hooks'
import { lt } from '../i18n'
import { Button, Switch, toast } from '../ui/components'
import { buildLabel } from './buildInfo'
import { buildErrorReport, clearErrorLog, isErrorLogEnabled, readErrorLog, setErrorLogEnabled } from './errorLog'

const L = (tr: string, en: string): string => lt({ tr, en })

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Settings > About: build info + opt-in local crash log with a "Copy error report" button. No network. */
export function ErrorReportPanel() {
  const [on, setOn] = useState(isErrorLogEnabled())
  const [n, setN] = useState(readErrorLog().length)

  return (
    <div class="col" data-testid="error-report-panel">
      <p class="t-sm t-mid" data-testid="build-info">{L('Sürüm', 'Version')}: {buildLabel()}</p>
      <Switch
        label={L('Yerel hata günlüğü', 'Local error log')}
        desc={L('Çökmeleri yalnızca bu cihazda saklar; hiçbir şey gönderilmez.', 'Keeps crashes on this device only; nothing is ever sent.')}
        checked={on}
        onChange={(v) => { setErrorLogEnabled(v); setOn(v); setN(readErrorLog().length) }}
      />
      <div class="row">
        <Button
          variant="ghost"
          icon="download"
          onClick={() => {
            void copyText(buildErrorReport()).then((ok) => toast(ok ? L('Hata raporu kopyalandı', 'Error report copied') : L('Kopyalanamadı', 'Could not copy'), ok ? 'success' : 'error'))
          }}
        >
          {L('Hata raporunu kopyala', 'Copy error report')}{n ? ` (${n})` : ''}
        </Button>
        {n > 0 && <Button variant="ghost" onClick={() => { clearErrorLog(); setN(0) }}>{L('Temizle', 'Clear')}</Button>}
      </div>
    </div>
  )
}
