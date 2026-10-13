/**
 * Boot check of the start breadcrumbs: when the previous run stopped in the middle of starting a
 * game screen (a hang leaves no error), show a one-time TR/EN notice with the last stage reached.
 * A run that hung once the Phaser game was being built (the GPU path) escalates the drawing
 * mode: compatibility mode first, then (Android, hung again) the software layer.
 *
 * Plain DOM: shown even if the thing that broke is in Preact.
 */
import { checkLastRunAtBoot, heartbeatState, reachedPhaser, type UnfinishedRun } from './breadcrumbs'
import type { PlatformId } from '../platform/detect'
import type { SoftwareModeState } from '../platform/renderMode'
import { bindExitTap } from '../platform/exitTap'

export type CompatStep = 'compat' | 'layer'

/**
 * The step to switch on after an unfinished run, keyed on observed behaviour only: the run reached
 * the Phaser build and did not keep running. Compatibility mode first; with that already on, the
 * Android software layer; nothing further after that.
 */
export function shouldAutoCompat(run: UnfinishedRun, platform: PlatformId, state: SoftwareModeState): CompatStep | null {
  if (!reachedPhaser(run) || heartbeatState(run) === 'running') return null
  if (!state.on) return 'compat'
  if (platform === 'android' && !state.layer) return 'layer'
  return null
}

export function lastRunNoticeText(run: UnfinishedRun, step: CompatStep | null, tr: boolean): { title: string; body: string } {
  const stage = `${run.last.stage}${run.last.info ? ` (${run.last.info})` : ''}`
  const tail = tr ? ' Ayrıntılar Ayarlar › Tanılama’da; “Kopyala” ile bize gönderebilirsin.' : ' Details are in Settings › Diagnostics; use “Copy” to send them to us.'
  let what = ''
  if (step === 'compat') {
    what = tr
      ? ' Uyumluluk modu açıldı: oyun ekranları artık ekran kartı sürücüsünü kullanmadan çizilecek. Ayarlar › Grafik bölümünden kapatabilirsin.'
      : ' Compatibility mode is now on: game screens are drawn without the graphics driver. You can turn it off in Settings › Graphics.'
  } else if (step === 'layer') {
    what = tr
      ? ' Yazılımsal çizim açıldı (son çare): uygulamayı kapatıp yeniden aç. Oyun yavaşlayabilir; Ayarlar › Grafik bölümünden kapatabilirsin.'
      : ' Software drawing is now on (last resort): close and reopen the app. The game may run slowly; you can turn it off in Settings › Graphics.'
  }
  return tr
    ? { title: 'Son açılış yarım kaldı', body: `Geçen sefer oyun ekranı açılırken takıldı. Son adım: ${stage}.${what}${tail}` }
    : { title: 'The last start did not finish', body: `Last time a game screen got stuck while opening. Last step: ${stage}.${what}${tail}` }
}

export function showLastRunNotice(run: UnfinishedRun, step: CompatStep | null): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  const tr = (document.documentElement.lang || 'tr').startsWith('tr')
  const { title, body } = lastRunNoticeText(run, step, tr)
  const box = document.createElement('div')
  box.className = 'last-run-notice'
  box.setAttribute('role', 'alertdialog')
  box.setAttribute('data-testid', 'last-run-notice')
  box.setAttribute('data-compat', step ?? 'none')
  const h = document.createElement('strong')
  h.textContent = title
  const p = document.createElement('p')
  p.textContent = body
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'btn btn-primary'
  btn.setAttribute('data-testid', 'last-run-ok')
  btn.textContent = tr ? 'Tamam' : 'OK'
  bindExitTap(btn, () => box.remove())
  box.append(h, p, btn)
  document.body.appendChild(box)
  return box
}

/** Boot: check, maybe escalate the drawing mode, show the notice. Never throws. */
export async function handleLastRunAtBoot(o: { platform: PlatformId; state: SoftwareModeState; enable: (step: CompatStep, reason: string) => Promise<unknown> }): Promise<UnfinishedRun | null> {
  try {
    const run = checkLastRunAtBoot()
    if (!run) return null
    const step = shouldAutoCompat(run, o.platform, o.state)
    if (step) await o.enable(step, `hung at ${run.last.stage}`)
    showLastRunNotice(run, step)
    return run
  } catch {
    return null
  }
}
