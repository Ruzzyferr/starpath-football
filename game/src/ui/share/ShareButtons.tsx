import '../../styles/screens/board.css'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../i18n'
import type { CareerSummary } from '../../sim/game/hallOfFame'
import { careerCardData, careerCsv } from '../../sim/game/localMeta'
import { Button, IconButton, toast } from '../components'
import { formatNumber, formatRating, seasonLabel } from '../format'
import { gameState, type PostMatchView } from '../store'
import { downloadText, shareCard, type CardSpec } from './cards'

const slug = (s: string): string => s.normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'kickborn'

export function careerSpec(sum: CareerSummary): CardSpec {
  const d = careerCardData(sum)
  return {
    kicker: t('board.share.careerKicker'),
    title: d.name,
    subtitle: d.subtitle,
    hero: { label: t('meta.doc.legacy'), value: formatNumber(d.score) },
    kpis: d.kpis.map((k) => ({ label: lt(k.label), value: k.value })),
    footer: `${lt(sum.postCareer ? { tr: 'Emekli', en: 'Retired' } : { tr: 'Kariyer', en: 'Career' })} · ${sum.endSeason}`,
  }
}

export function matchSpec(pm: PostMatchView): CardSpec | null {
  const s = gameState.value
  if (!s) return null
  const fx = pm.fixture
  return {
    kicker: lt(fx.compName),
    title: `${s.hero.firstName} ${s.hero.lastName}`.trim(),
    subtitle: `${fx.home.shortName} ${pm.score[0]} - ${pm.score[1]} ${fx.away.shortName}`,
    hero: { label: t('match.post.rating'), value: formatRating(pm.rating) },
    kpis: [
      { label: t('match.live.goals'), value: String(pm.stats.goals) },
      { label: t('match.live.assists'), value: String(pm.stats.assists) },
      { label: t('match.post.minutes'), value: String(pm.stats.minutes) },
      { label: t('match.post.shots'), value: `${pm.stats.shotsOnTarget}/${pm.stats.shots}` },
    ],
    footer: `${seasonLabel(s.calendar.season)} · ${t('common.week', { n: s.calendar.week + 1 })}`,
    accent: (pm.heroSide === 'home' ? fx.home : fx.away).kit.primary,
  }
}

async function run(spec: CardSpec, file: string, text: string, setBusy: (b: boolean) => void): Promise<void> {
  setBusy(true)
  try {
    const r = await shareCard(spec, file, text)
    if (r === 'downloaded') toast(t('board.share.saved'), 'success', 'download')
    else if (r === 'failed') toast(t('board.share.failed'), 'error')
  } finally {
    setBusy(false)
  }
}

export function ShareCareerButton({ sum, size = 'sm', compact }: { sum: CareerSummary; size?: 'sm' | 'md'; compact?: boolean }) {
  void currentLang.value
  const [busy, setBusy] = useState(false)
  const go = () => void run(careerSpec(sum), `kickborn-${slug(sum.name)}.png`, t('board.share.careerText', { n: sum.name, s: formatNumber(sum.legacyScore) }), setBusy)
  if (compact) return <IconButton icon="upload" label={t('board.share.card')} onClick={go} data-testid="share-career" />
  return (
    <Button size={size} variant="secondary" icon="upload" disabled={busy} data-testid="share-career"
      onClick={() => void run(careerSpec(sum), `kickborn-${slug(sum.name)}.png`, t('board.share.careerText', { n: sum.name, s: formatNumber(sum.legacyScore) }), setBusy)}>
      {t('board.share.card')}
    </Button>
  )
}

export function ShareMatchButton({ pm }: { pm: PostMatchView }) {
  void currentLang.value
  const [busy, setBusy] = useState(false)
  const spec = matchSpec(pm)
  if (!spec) return null
  return (
    <Button size="sm" variant="secondary" icon="upload" disabled={busy} data-testid="share-match"
      onClick={() => void run(spec, `kickborn-match-${pm.score[0]}-${pm.score[1]}.png`, t('board.share.matchText', { m: spec.subtitle, r: formatRating(pm.rating) }), setBusy)}>
      {t('board.share.card')}
    </Button>
  )
}

export function ExportCsvButton({ sum, size = 'sm', compact }: { sum: CareerSummary; size?: 'sm' | 'md'; compact?: boolean }) {
  void currentLang.value
  const go = () => {
    downloadText(careerCsv(sum, currentLang.value === 'en' ? 'en' : 'tr'), `kickborn-${slug(sum.name)}.csv`)
    toast(t('board.share.saved'), 'success', 'download')
  }
  if (compact) return <IconButton icon="download" label={t('board.share.csv')} onClick={go} data-testid="export-csv" />
  return (
    <Button size={size} variant="ghost" icon="download" data-testid="export-csv"
      onClick={() => {
        downloadText(careerCsv(sum, currentLang.value === 'en' ? 'en' : 'tr'), `kickborn-${slug(sum.name)}.csv`)
        toast(t('board.share.saved'), 'success', 'download')
      }}>
      {t('board.share.csv')}
    </Button>
  )
}
