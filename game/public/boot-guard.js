/*
 * Kickborn boot guard. A classic ES5 script loaded before the app bundle (index.html), kept outside
 * the bundle so it still runs where the bundle cannot: an Android System WebView too old to parse
 * it, a failed module import, or an error thrown before the first render. Instead of a black screen
 * it shows a readable TR/EN message, the WebView version and a retry button.
 *
 * It is a same-origin file, not inline, so the strict desktop CSP (script-src 'self') allows it.
 * main.tsx calls window.__spBootDone() once the app has rendered; from then on the guard is inert.
 * MIN_CHROME must match src/platform/compat.ts (checked by compat.node.test.ts).
 */
(function () {
  'use strict'
  var MIN_CHROME = 80
  var WATCHDOG_MS = 20000
  var GRACE_MS = 1500
  var w = window
  var ua = navigator.userAgent || ''
  var m = /(?:Chrome|CriOS)\/(\d+)/.exec(ua)
  var chrome = m ? parseInt(m[1], 10) : 0
  var android = /Android/i.test(ua)
  var tooOld = chrome > 0 && chrome < MIN_CHROME
  var booted = false
  var shown = false
  var firstError = ''
  var watchdog = 0

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }

  function show(reason) {
    if (booted || shown) return
    shown = true
    var tr = /^tr/i.test(navigator.language || 'tr')
    var webview = chrome ? (android ? 'Android System WebView ' : 'Chrome ') + chrome : ''
    var title = tooOld
      ? (tr ? 'WebView sürümü çok eski' : 'Your WebView is too old')
      : (tr ? 'Oyun başlatılamadı' : 'The game could not start')
    var body = tooOld
      ? (tr
          ? 'Kickborn, Android System WebView ' + MIN_CHROME + ' veya üstünü gerektirir. Play Store\'dan "Android System WebView" ve "Chrome" uygulamalarını güncelleyip tekrar dene.'
          : 'Kickborn needs Android System WebView ' + MIN_CHROME + ' or newer. Update "Android System WebView" and "Chrome" in the Play Store, then try again.')
      : (tr
          ? 'Başlatırken bir hata oluştu. Tekrar dene; sorun sürerse Play Store\'dan "Android System WebView" uygulamasını güncelle.'
          : 'Something went wrong while starting. Try again; if it keeps happening, update "Android System WebView" in the Play Store.')
    var store = android
      ? '<a id="sp-boot-store" href="https://play.google.com/store/apps/details?id=com.google.android.webview" style="color:#7fd1ff;display:block;margin:14px 0 0">' +
        (tr ? 'Play Store\'da WebView\'i aç' : 'Open WebView in the Play Store') + '</a>'
      : ''
    var el = document.createElement('div')
    el.id = 'sp-boot-error'
    el.setAttribute('role', 'alert')
    el.setAttribute('data-reason', tooOld ? 'webview-too-old' : reason)
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;overflow:auto;background:#070b14;color:#e8eef7;' +
      'font:16px/1.45 system-ui,-apple-system,Roboto,sans-serif;padding:max(24px,env(safe-area-inset-top)) 24px 24px;box-sizing:border-box'
    el.innerHTML =
      '<div style="max-width:520px;margin:12vh auto 0">' +
      '<div style="font-size:40px;margin-bottom:8px">&#9888;</div>' +
      '<h1 style="font-size:22px;margin:0 0 10px">' + esc(title) + '</h1>' +
      '<p style="margin:0 0 6px">' + esc(body) + '</p>' +
      store +
      '<button id="sp-boot-retry" type="button" style="margin-top:20px;padding:12px 22px;font-size:16px;font-weight:700;border:0;border-radius:10px;background:#2fbf71;color:#04110a">' +
      (tr ? 'Yeniden dene' : 'Try again') + '</button>' +
      '<p style="margin-top:22px;font-size:12px;color:#8a97ab;word-break:break-word">' +
      (webview ? esc(webview) + '<br>' : '') +
      (firstError ? esc(firstError).slice(0, 300) + '<br>' : '') +
      esc(ua) + '</p></div>'
    ;(document.body || document.documentElement).appendChild(el)
    var btn = document.getElementById('sp-boot-retry')
    if (btn) btn.onclick = function () { location.reload() }
  }

  /** An error before the first render: wait a moment (a non-fatal error lets the app boot anyway). */
  function failed(reason, msg) {
    if (booted) return
    if (!firstError && msg) firstError = msg
    setTimeout(function () { show(reason) }, GRACE_MS)
  }

  function onError(e) {
    var t = e && e.target
    if (t && t !== w && t.tagName) {
      // A <script> or stylesheet that failed to load (module graph import failure included).
      if (t.tagName === 'SCRIPT' || (t.tagName === 'LINK' && /stylesheet|modulepreload/.test(t.rel || ''))) {
        failed('load', 'Failed to load ' + (t.src || t.href || t.tagName))
      }
      return
    }
    var msg = (e && (e.message || (e.error && e.error.message))) || ''
    if (/ResizeObserver loop/.test(msg)) return
    failed('error', (e && e.error && e.error.name ? e.error.name + ': ' : '') + msg)
  }

  function onRejection(e) {
    var r = e && e.reason
    failed('rejection', 'Unhandled: ' + ((r && (r.message || r)) || 'promise rejection'))
  }

  w.addEventListener('error', onError, true)
  w.addEventListener('unhandledrejection', onRejection)

  w.__spBootDone = function () {
    // A WebView under the floor keeps the update message even if part of the app happened to run.
    if (tooOld) return
    booted = true
    clearTimeout(watchdog)
    w.removeEventListener('error', onError, true)
    w.removeEventListener('unhandledrejection', onRejection)
    var el = document.getElementById('sp-boot-error')
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }
  w.__spBootGuard = { minChrome: MIN_CHROME, chrome: chrome, tooOld: tooOld }

  if (tooOld) {
    if (document.body) show('webview-too-old')
    else document.addEventListener('DOMContentLoaded', function () { show('webview-too-old') })
    return
  }
  watchdog = setTimeout(function () { show('timeout') }, WATCHDOG_MS)
})()
