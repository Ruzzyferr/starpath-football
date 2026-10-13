import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { lt } from '../i18n'
import { Button, toast } from '../ui/components'
import { effectiveQuality, settings } from '../ui/store'
import { isReadbackSlow, pickRenderer, webglBrokenReason } from '../game/renderGuard'
import { buildLabel } from './buildInfo'
import { lastIncompleteRun, readCrumbs, readHeartbeat } from './breadcrumbs'
import { formatDiagnostics, mergeErrors, probeWebglRenderer } from './diagnostics'
import { persistedErrors, recentErrors } from './errorRing'
import { copyText } from './ErrorReportPanel'
import { nativeRenderInfo, softwareModeState, type NativeRenderInfo } from '../platform/renderMode'

const L = (tr: string, en: string): string => lt({ tr, en })

/** The report for this moment (live environment). */
export function collectDiagnostics(native: NativeRenderInfo | null = null): string {
  const s = settings.value
  const crumbs = readCrumbs()
  const hb = readHeartbeat()
  const lowGraphics = s.quality === 'low'
  const compat = softwareModeState()
  const unfinished = lastIncompleteRun(crumbs, hb)
  // A fresh WebGL context is itself a GPU start: skipped where the GPU path already misbehaved.
  const lastGpu = [...crumbs].reverse().find((c) => c.stage === 'phaser-built' && (c.info ?? '').indexOf(' · ') > 0)?.info ?? ''
  const risky = compat.on || !!unfinished || !!webglBrokenReason()
  const webgl = risky ? `${L('denenmedi', 'not probed')}${lastGpu ? ` · ${L('son', 'last')}: ${lastGpu}` : ''}` : probeWebglRenderer()
  return formatDiagnostics({
    now: Date.now(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    appVersion: buildLabel(),
    lang: s.lang === 'en' ? 'en' : 'tr',
    webgl,
    quality: { choice: s.quality, auto: s.qualityAuto ?? null, effective: effectiveQuality(s) },
    renderer: `${pickRenderer({ lowGraphics })}${lowGraphics ? ` (${L('Düşük grafik', 'Low graphics')})` : ''}`,
    webglBroken: webglBrokenReason(),
    readbackSlow: isReadbackSlow(),
    compat,
    native,
    screen: typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 } : { w: 0, h: 0, dpr: 1 },
    crumbs,
    heartbeat: hb,
    unfinished,
    errors: mergeErrors(recentErrors(), persistedErrors()),
  })
}

/**
 * Settings › Diagnostics: device / WebView / GPU facts, the graphics choice, the last start
 * breadcrumbs and errors, with Copy (clipboard; the text is selected for a manual copy if that
 * fails). For a player to paste into a chat when a game screen misbehaves.
 */
export function DiagnosticsPanel() {
  const [n, setN] = useState(0)
  const [native, setNative] = useState<NativeRenderInfo | null>(null)
  useEffect(() => {
    let live = true
    void nativeRenderInfo().then((v) => { if (live) setNative(v) })
    return () => { live = false }
  }, [n])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed on Refresh (n)
  const text = useMemo(() => collectDiagnostics(native), [n, native])
  const area = useRef<HTMLTextAreaElement>(null)
  const selectAll = () => {
    const el = area.current
    if (!el) return
    el.focus()
    el.select()
    try { el.setSelectionRange(0, el.value.length) } catch { /* old engines */ }
  }
  return (
    <div class="col diag-panel" data-testid="diagnostics">
      <p class="t-sm t-mid">{L('Bir oyun ekranı açılmıyor ya da kararıyorsa bu metni kopyalayıp bize gönder. Hiçbir şey otomatik gönderilmez.', 'If a game screen will not open or goes black, copy this text and send it to us. Nothing is sent automatically.')}</p>
      <textarea ref={area} class="diag-text" readOnly rows={12} value={text} data-testid="diagnostics-text" onFocus={selectAll} />
      <div class="row wrap">
        <Button
          variant="primary"
          icon="download"
          data-testid="diagnostics-copy"
          onClick={() => {
            void copyText(text).then((ok) => {
              if (!ok) selectAll()
              toast(ok ? L('Tanılama kopyalandı', 'Diagnostics copied') : L('Kopyalanamadı: metin seçildi, basılı tutup kopyala', 'Could not copy: the text is selected, long-press to copy'), ok ? 'success' : 'warning')
            })
          }}
        >
          {L('Kopyala', 'Copy')}
        </Button>
        <Button variant="ghost" icon="stopwatch" onClick={() => setN(n + 1)} data-testid="diagnostics-refresh">{L('Yenile', 'Refresh')}</Button>
      </div>
    </div>
  )
}
