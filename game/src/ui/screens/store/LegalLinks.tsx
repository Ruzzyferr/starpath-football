import { useState } from 'preact/hooks'
import '../../../styles/screens/store.css'
import { t, currentLang, type TKey } from '../../../i18n'
import { Modal } from '../../components'

/**
 * Settings > About: bundled, offline legal pages (generated into public/legal by scripts/gen-legal.mjs).
 * They open inside the app (a target=_blank link does nothing in the iOS WebView); the href stays for
 * long-press / desktop.
 */
export function LegalLinks() {
  const lang = currentLang.value === 'tr' ? 'tr' : 'en'
  const [open, setOpen] = useState<{ src: string; title: string } | null>(null)
  const link = (file: string, key: TKey, testId: string) => (
    <a
      href={`./legal/${file}`}
      target="_blank"
      rel="noopener"
      data-testid={testId}
      onClick={(e) => {
        e.preventDefault()
        setOpen({ src: `./legal/${file}`, title: t(key) })
      }}
    >
      {t(key)}
    </a>
  )
  return (
    <div class="pp-panel" data-testid="legal-links">
      <h3 class="h4">{t('iap.legal.title')}</h3>
      <ul class="pp-list">
        <li>{link(`privacy-${lang}.html`, 'iap.legal.privacy', 'legal-privacy')}</li>
        <li>{link(`terms-${lang}.html`, 'iap.legal.terms', 'legal-terms')}</li>
        <li>{link('THIRD_PARTY_LICENSES.txt', 'iap.legal.licenses', 'legal-licenses')}</li>
      </ul>
      <span class="t-xs t-lo">{t('iap.legal.draftNote')}</span>
      {open && (
        <Modal open onClose={() => setOpen(null)} title={open.title} size="lg">
          <iframe class="legal-frame" src={open.src} title={open.title} data-testid="legal-frame" />
        </Modal>
      )}
    </div>
  )
}
