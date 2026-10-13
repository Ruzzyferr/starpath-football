/**
 * Boot check of the start breadcrumbs: when the previous run stopped in the middle of starting a
 * game screen (a hang leaves no error), show a one-time TR/EN notice with the last stage reached.
 * On Android, a run that hung once the Phaser game was being built switches compatibility mode
 * (software drawing, platform/renderMode) on, and the notice says so.
 *
 * Plain DOM: shown even if the thing that broke is in Preact.
 */
import { checkLastRunAtBoot, heartbeatState, reachedPhaser, type UnfinishedRun } from './breadcrumbs'
import type { PlatformId } from '../platform/detect'
import { bindExitTap } from '../platform/exitTap'

/** Compatibility mode is switched on automatically for a run that hung on the GPU path (Android only). */
export function shouldAutoCompat(run: UnfinishedRun, platform: PlatformId, alreadyOn: boolean): boolean {
  if (platform !== 'android' || alreadyOn) return false
  return reachedPhaser(run) && heartbeatState(run) !== 'running'
}

export function lastRunNoticeText(run: UnfinishedRun, compat: boolean, tr: boolean): { title: string; body: string } {
  const stage = `${run.last.stage}${run.last.info ? ` (${run.last.info})` : ''}`
  if (tr) {
    return {
      title: 'Son açılış yarım kaldı',
      body: `Geçen sefer oyun ekranı açılırken takıldı. Son adım: ${stage}.${compat ? ' Uyumluluk modu (yazılımsal çizim) açıldı; Ayarlar › Grafik bölümünden kapatabilirsin.' : ''} Ayrıntılar Ayarlar › Tanılama’da; “Kopyala” ile bize gönderebilirsin.`,
    }
  }
  return {
    title: 'The last start did not finish',
    body: `Last time a game screen got stuck while opening. Last step: ${stage}.${compat ? ' Compatibility mode (software drawing) is now on; you can turn it off in Settings › Graphics.' : ''} Details are in Settings › Diagnostics; use “Copy” to send them to us.`,
  }
}

export function showLastRunNotice(run: UnfinishedRun, compat: boolean): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  const tr = (document.documentElement.lang || 'tr').startsWith('tr')
  const { title, body } = lastRunNoticeText(run, compat, tr)
  const box = document.createElement('div')
  box.className = 'last-run-notice'
  box.setAttribute('role', 'alertdialog')
  box.setAttribute('data-testid', 'last-run-notice')
  box.setAttribute('data-compat', compat ? '1' : '0')
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

/** Boot: check, maybe switch compatibility mode on, show the notice. Never throws. */
export async function handleLastRunAtBoot(o: { platform: PlatformId; softwareOn: boolean; enableCompat: (reason: string) => Promise<unknown> }): Promise<UnfinishedRun | null> {
  try {
    const run = checkLastRunAtBoot()
    if (!run) return null
    const compat = shouldAutoCompat(run, o.platform, o.softwareOn)
    if (compat) await o.enableCompat(`hung at ${run.last.stage}`)
    showLastRunNotice(run, compat)
    return run
  } catch {
    return null
  }
}
