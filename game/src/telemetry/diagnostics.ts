/**
 * Settings › Diagnostics: one plain-text report a player can copy into a chat (WhatsApp) when a
 * game screen misbehaves on their device. Device facts, graphics choice, the last start
 * breadcrumbs (telemetry/breadcrumbs) and the last errors. Nothing is ever sent anywhere.
 *
 * The formatter is pure (unit-tested); `collectDiagnostics` reads the live environment.
 */
import type { Crumb, Heartbeat, UnfinishedRun } from './breadcrumbs'
import { heartbeatVerdict } from './breadcrumbs'
import type { RingEntry } from './errorRing'
import type { NativeRenderInfo, SoftwareModeState } from '../platform/renderMode'

/** "Chrome 154.0.8037.106 (WebView)" from a user agent, or a short UA prefix. */
export function browserVersion(ua: string): string {
  const m = /(?:Chrome|CriOS)\/([\d.]+)/.exec(ua)
  if (m) return `Chrome ${m[1]}${/; wv\)/.test(ua) ? ' (WebView)' : ''}`
  const s = /Version\/([\d.]+).*Safari/.exec(ua)
  if (s) return `Safari ${s[1]}`
  return ua.slice(0, 80) || '?'
}

/** "Android 14" / "iOS 17.4" / "?" from a user agent. */
export function osVersion(ua: string): string {
  const a = /Android\s+([\d.]+)/.exec(ua)
  if (a) return `Android ${a[1]}`
  const i = /(?:iPhone|iPad|CPU) OS (\d+(?:_\d+)*)/.exec(ua)
  if (i) return `iOS ${i[1]!.replace(/_/g, '.')}`
  return /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?'
}

/** Device model from an Android user agent ("SM-A525F"), or ''. */
export function deviceModel(ua: string): string {
  const m = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/.exec(ua)
  const v = m ? m[1]!.trim() : ''
  return v === 'K' || v === 'wv' ? '' : v
}

export interface DiagInput {
  now: number
  ua: string
  appVersion: string
  lang: 'tr' | 'en'
  webgl: string
  quality: { choice: string; auto: string | null; effective: string }
  renderer: string
  webglBroken: string | null
  readbackSlow: boolean
  /** Compatibility mode (software drawing). */
  compat: SoftwareModeState
  /** Android shell facts (null on web / iOS / not answered). */
  native: NativeRenderInfo | null
  screen: { w: number; h: number; dpr: number }
  crumbs: readonly Crumb[]
  heartbeat: Heartbeat | null
  unfinished: UnfinishedRun | null
  errors: readonly RingEntry[]
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n))

/** Local "dd.mm HH:MM:SS". */
export function clock(at: number): string {
  const d = new Date(at)
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** The copyable report (TR or EN labels; values stay as measured). */
export function formatDiagnostics(d: DiagInput): string {
  const tr = d.lang === 'tr'
  const L = (a: string, b: string) => (tr ? a : b)
  const model = deviceModel(d.ua)
  const lines: string[] = [
    `Kickborn ${L('Tanılama', 'Diagnostics')} · ${clock(d.now)}`,
    `${L('Sürüm', 'Version')}: ${d.appVersion}`,
    `WebView: ${browserVersion(d.ua)}`,
    `${L('Sistem', 'OS')}: ${d.native ? `Android ${d.native.android} (API ${d.native.sdk}) · ${d.native.model}` : `${osVersion(d.ua)}${model ? ` · ${model}` : ''}`}`,
    `${L('Ekran', 'Screen')}: ${d.screen.w}×${d.screen.h} @${Math.round(d.screen.dpr * 100) / 100}x`,
    `WebGL: ${d.webgl || 'none'}`,
    `${L('Kalite', 'Quality')}: ${d.quality.choice} → ${d.quality.effective}${d.quality.auto ? ` (${L('ölçülen', 'measured')} ${d.quality.auto})` : ''}`,
    `${L('Uyumluluk modu', 'Compatibility mode')}: ${d.compat.on ? L('açık', 'on') : L('kapalı', 'off')}${d.compat.layer ? ` + ${L('yazılımsal katman', 'software layer')}` : ''}${d.compat.auto ? ` (${L('otomatik', 'automatic')}: ${d.compat.auto})` : ''}${d.native ? ` · ${L('yerel katman', 'native layer')}: ${d.native.active ? 'software' : 'hardware'}${d.native.unresponsive ? ` · ${L('yanıt vermeyen çizim süreci', 'renderer unresponsive')} ×${d.native.unresponsive}` : ''}` : ''}`,
    `${L('Çizici', 'Renderer')}: ${d.renderer}${d.webglBroken ? ` · ${L('WebGL kapalı', 'WebGL off')}: ${d.webglBroken}` : ''}${d.readbackSlow ? ` · ${L('okuma yavaş', 'slow readback')}` : ''}`,
  ]
  if (d.unfinished) {
    lines.push(`${L('Son açılış yarım kaldı', 'Last start did not finish')}: ${d.unfinished.start.info ?? ''} → ${d.unfinished.last.stage}${d.unfinished.last.info ? ` (${d.unfinished.last.info})` : ''}`)
    lines.push(`  ${heartbeatVerdict(d.unfinished, tr)}`)
  }
  if (d.heartbeat) {
    const hb = d.heartbeat
    const rel = (t: number) => (t ? `+${Math.round((t - hb.since) / 100) / 10}s` : '–')
    lines.push(`${L('Kalp atışı', 'Heartbeat')}: ${clock(hb.since)} · rAF ${hb.rafN} ${rel(hb.raf)} · timer ${hb.timerN} ${rel(hb.timer)}`)
  }
  lines.push(`${L('İzler', 'Breadcrumbs')} (${d.crumbs.length}):`)
  const crumbs = d.crumbs.slice(-25)
  let prev = 0
  for (const c of crumbs) {
    const gap = prev ? ` +${c.at - prev}ms` : ''
    lines.push(`  ${clock(c.at)}${gap} ${c.stage}${c.info ? ` · ${c.info}` : ''}`)
    prev = c.at
  }
  if (!crumbs.length) lines.push(`  ${L('(yok)', '(none)')}`)
  lines.push(`${L('Son hatalar', 'Last errors')} (${d.errors.length}):`)
  for (const e of d.errors.slice(-8)) lines.push(`  ${clock(e.at)} [${e.kind}] ${e.message}`)
  if (!d.errors.length) lines.push(`  ${L('(yok)', '(none)')}`)
  return lines.join('\n')
}

/** The GPU's WebGL renderer string, or '' when WebGL is unavailable. Releases the context. */
export function probeWebglRenderer(): string {
  try {
    if (typeof document === 'undefined') return ''
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    const v = String(gl.getParameter(gl.VERSION) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return v ? `${r} · ${v}` : r
  } catch {
    return ''
  }
}

/** Merges this session's ring with the persisted entries (deduplicated, oldest first). */
export function mergeErrors(session: readonly RingEntry[], persisted: readonly RingEntry[]): RingEntry[] {
  const seen = new Set<string>()
  const out: RingEntry[] = []
  for (const e of [...persisted, ...session]) {
    const k = `${e.at}|${e.kind}|${e.message}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  return out.sort((a, b) => a.at - b.at)
}
