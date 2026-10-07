import { t, currentLang } from '../../../i18n'

/** Settings > About: bundled, offline legal pages (generated into public/legal by scripts/gen-legal.mjs). */
export function LegalLinks() {
  const lang = currentLang.value === 'tr' ? 'tr' : 'en'
  return (
    <div class="pp-panel" data-testid="legal-links">
      <h3 class="h4">{t('iap.legal.title')}</h3>
      <ul class="pp-list">
        <li><a href={`./legal/privacy-${lang}.html`} target="_blank" rel="noopener" data-testid="legal-privacy">{t('iap.legal.privacy')}</a></li>
        <li><a href={`./legal/terms-${lang}.html`} target="_blank" rel="noopener" data-testid="legal-terms">{t('iap.legal.terms')}</a></li>
        <li><a href="./legal/THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener" data-testid="legal-licenses">{t('iap.legal.licenses')}</a></li>
      </ul>
      <span class="t-xs t-lo">{t('iap.legal.draftNote')}</span>
    </div>
  )
}
