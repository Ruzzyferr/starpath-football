import { LOCALES, LOCALE_NAMES, isLocale, t } from '../../i18n'
import { settings, settingsLocale, updateSettings } from '../store'

/** Display-language picker: each language is named in itself (Español, Deutsch…). */
export function LanguageSelect({ id = 'lang-select', compact = false }: { id?: string; compact?: boolean }) {
  const value = settingsLocale(settings.value)
  return (
    <div class={compact ? 'text-field lang-select lang-select-compact' : 'text-field lang-select'}>
      <select
        id={id}
        aria-label={t('settings.language')}
        value={value}
        onChange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value
          if (isLocale(v)) updateSettings({ locale: v })
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {compact ? l.toUpperCase() : LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </div>
  )
}
