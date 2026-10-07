import '../../../styles/screens/intl.css'
import { useEffect, useState } from 'preact/hooks'
import { lt, t } from '../../../i18n'
import { Button, Card, Chip, Crest, EmptyState, Page, SectionTitle } from '../../components'
import { settings, screen } from '../../store'
import { drawView } from '../../backend/worldViews'

const STEP_MS = 700

/** Animated draw: balls come out of the pots one tie at a time. */
export function CupDrawScreen() {
  const compId = screen.value.params?.comp as string | undefined
  const v = drawView(compId)
  const [shown, setShown] = useState(0)
  const [running, setRunning] = useState(false)
  const reduced = settings.value.reducedMotion
  useEffect(() => {
    if (!running || !v || shown >= v.pairs.length) return
    const id = setTimeout(() => setShown((n) => n + 1), reduced ? 0 : STEP_MS)
    return () => clearTimeout(id)
  }, [running, shown, v?.pairs.length, reduced])
  if (!v) return <Page title={t('intl.cups.drawTitle')} backTo="world"><EmptyState icon="shuffle" title={t('intl.cups.noDraw')} /></Page>
  const done = shown >= v.pairs.length
  return (
    <Page title={t('intl.cups.drawTitle')} sub={t('intl.cups.drawSub', { c: lt(v.compName), r: lt(v.round) })} backTo="world" wide>
      <div class="draw-stage" data-testid="cup-draw">
        <div class="row" style={{ gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {!running && !done && <Button variant="primary" icon="shuffle" onClick={() => setRunning(true)}>{t('intl.cups.drawStart')}</Button>}
          {!done && <Button variant="secondary" icon="fast-forward" onClick={() => { setRunning(true); setShown(v.pairs.length) }}>{t('intl.cups.drawSkip')}</Button>}
          {done && <Chip tone="pos" icon="check">{t('intl.cups.drawDone')}</Chip>}
          {v.twoLegged && <Chip tone="info">{t('intl.cups.twoLegs')}</Chip>}
        </div>
        {v.seeded.length > 0 && (
          <Card pad="md">
            <SectionTitle>{t('intl.cups.seeded')}</SectionTitle>
            <div class="row" style={{ flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {v.seeded.map((s) => <span key={s.id} class="draw-ball" title={s.name}>{s.shortName}</span>)}
            </div>
          </Card>
        )}
        {running && !done && <div class="row" style={{ justifyContent: 'center' }}><span class="draw-ball draw-spin" aria-hidden="true">?</span></div>}
        <ul class="cup-ties" aria-live="polite">
          {v.pairs.slice(0, shown).map((p, i) => (
            <li key={i} class={`cup-tie draw-pair${p.heroTeam ? ' is-hero' : ''}`} data-testid="draw-pair">
              <span class="cup-team"><Crest crest={p.home.crest} size={26} compact /><span class="truncate">{p.home.name}</span></span>
              <span class="cup-score">v</span>
              <span class="cup-team is-away"><span class="truncate">{p.away.name}</span><Crest crest={p.away.crest} size={26} compact /></span>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  )
}
