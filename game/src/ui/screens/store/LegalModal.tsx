import { useState } from 'preact/hooks'
import { currentLang, t } from '../../../i18n'
import { Modal } from '../../components'

/**
 * Terms / Privacy shown INSIDE the app (an iframe over the bundled page). A target=_blank link does
 * nothing in the iOS WebView, and App Review needs these reachable from the purchase screen.
 */
export function LegalLinksInline({ testId }: { testId?: string }) {
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null)
  const lang = currentLang.value === 'tr' ? 'tr' : 'en'
  const label = (k: 'terms' | 'privacy') => t(`iap.legal.${k}`).replace(/\s*\((taslak|draft)\)\s*$/i, '')
  return (
    <p class="t-xs" data-testid={testId}>
      <button type="button" class="link-btn" onClick={() => setOpen('terms')}>{label('terms')}</button>
      {' · '}
      <button type="button" class="link-btn" onClick={() => setOpen('privacy')}>{label('privacy')}</button>
      {open && (
        <Modal open onClose={() => setOpen(null)} title={label(open)} size="lg">
          <iframe class="legal-frame" src={`./legal/${open}-${lang}.html`} title={label(open)} data-testid="legal-frame" />
        </Modal>
      )}
    </p>
  )
}
