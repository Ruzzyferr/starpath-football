/** Searchable glossary of game terms (OVR, form, trust, xG…), grouped by category. */
import '../../../styles/screens/help.css'
import { useEffect, useRef, useState } from 'preact/hooks'
import { currentLang, t } from '../../../i18n'
import { Page, Tabs } from '../../components'
import { Icon } from '../../icons'
import { gameState, isCasinoHidden, screen } from '../../store'
import { CASINO_TERMS, GLOSSARY, GLOSSARY_CATS, matchesQuery, type GlossaryCat, type GlossaryTerm } from '../../tutorial/glossary'
import { compareText } from '../../a11y/collate'
import { ATTR_DISPLAY_ORDER } from '../career/attrs'

export function GlossaryScreen() {
  const focus = screen.value.params?.term as GlossaryTerm | undefined
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<GlossaryCat | 'all'>('all')
  const lang = currentLang.value
  const focusRef = useRef<HTMLElement>(null)

  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'center' })
  }, [focus])

  // Every attribute is a term too (owner feedback: each stat the game shows is explained), filed under Player.
  const attrs = ATTR_DISPLAY_ORDER.map((k) => ({ id: `attr-${k}`, cat: 'player' as GlossaryCat, name: t(`data.attr.${k}`), def: t(`data.attrDesc.${k}`) }))
  const items = [
    ...GLOSSARY.filter((g) => !(CASINO_TERMS.has(g.id) && isCasinoHidden())).map((g) => ({ ...g, id: g.id as string, name: t(`help.glossary.terms.${g.id}.name`), def: t(`help.glossary.terms.${g.id}.def`) })),
    ...attrs,
  ]
    .filter((g) => cat === 'all' || g.cat === cat)
    .filter((g) => matchesQuery(q, g.name, g.def, lang))
    .sort((a, b) => compareText(a.name, b.name, lang))

  return (
    <Page title={t('help.glossary.title')} sub={t('help.glossary.sub')} backTo={gameState.value ? 'menu' : 'settings'} showBack>
      <div class="gloss-tools">
        <div class="gloss-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={q}
            placeholder={t('help.glossary.search')}
            aria-label={t('help.glossary.search')}
            onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <Tabs
          variant="pill"
          label={t('help.glossary.title')}
          idPrefix="gloss"
          value={cat}
          onChange={setCat}
          items={[{ id: 'all' as const, label: t('help.glossary.cats.all') }, ...GLOSSARY_CATS.map((c) => ({ id: c, label: t(`help.glossary.cats.${c}`) }))]}
        />
        <p class="t-xs t-lo" aria-live="polite">{t('help.glossary.count', { n: items.length })}</p>
      </div>
      {items.length === 0 ? (
        <p class="t-mid t-sm gloss-empty">{t('help.glossary.empty')}</p>
      ) : (
        <dl class="gloss-list">
          {items.map((g) => (
            <div
              key={g.id}
              id={`gloss-${g.id}`}
              class={`gloss-item${g.id === focus ? ' is-focus' : ''}`}
              ref={g.id === focus ? (el) => { focusRef.current = el } : undefined}
              data-term={g.id}
            >
              <dt>
                <span class="gloss-name">{g.name}</span>
                <span class={`gloss-cat micro gloss-cat-${g.cat}`}>{t(`help.glossary.cats.${g.cat}`)}</span>
              </dt>
              <dd>{g.def}</dd>
            </div>
          ))}
        </dl>
      )}
    </Page>
  )
}
