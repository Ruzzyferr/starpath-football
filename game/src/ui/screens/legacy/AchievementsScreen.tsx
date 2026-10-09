import '../../../styles/screens/legacy.css'
import { detectPlatform } from '../../../platform/detect'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { MeterRing, Page, Tabs } from '../../components'
import { Icon } from '../../icons'
import { achIcon } from './achIcons'
import { formatNumber, formatTimestamp } from '../../format'
import { achievementsView } from '../../backend/meta'
import type { AchCategory } from '../../../sim/game/achievements'

const CATS: AchCategory[] = ['career', 'match', 'goalkeeping', 'life', 'responsible', 'training', 'legacy']

/** Achievements with progress (global, across careers). */
export function AchievementsScreen() {
  void currentLang.value
  const [cat, setCat] = useState<string>('all')
  const v = achievementsView()
  const rows = cat === 'all' ? v.rows : v.rows.filter((r) => r.def.category === cat)
  const tabs = [{ id: 'all', label: t('meta.ach.all') }, ...CATS.map((c) => ({ id: c, label: t(`meta.ach.cat.${c}`) }))]
  const pct = v.total ? Math.round((v.unlocked / v.total) * 100) : 0
  return (
    <Page title={t('meta.ach.title')} sub={t('meta.ach.sub', { u: v.unlocked, n: v.total })} class="ach-page" wide>
      <div class="lg-summary ach-summary">
        <MeterRing value={pct} max={100} size={84} stroke={8} color="var(--accent-gold)" ariaLabel={t('meta.ach.title')}>
          <span class="score-font ach-pct num">{pct}<small>%</small></span>
        </MeterRing>
        <div class="grow stack" style={{ gap: 'var(--sp-1)' }}>
          <div class="ach-count-line"><span class="lg-big num" data-testid="ach-count">{v.unlocked}</span><span class="t-mid num">/ {v.total}</span></div>
          {detectPlatform() === 'electron' && <div class="t-xs t-lo">{t('meta.ach.steam')}</div>}
        </div>
      </div>
      <Tabs items={tabs} value={cat} onChange={setCat} variant="pill" label={t('meta.ach.title')} idPrefix="ach" />
      <ul class="ach-grid" aria-label={t('meta.ach.title')}>
        {rows.map((r) => {
          const hidden = r.def.secret && !r.unlocked
          return (
            <li key={r.def.id} class={`ach-card ${r.unlocked ? 'is-unlocked' : ''}`} data-ach={r.def.id} data-unlocked={r.unlocked ? '1' : '0'}>
              <span class={`ach-icon ach-medal${hidden ? ' is-secret' : ''}`} aria-hidden="true">
                <Icon name={hidden ? 'question' : achIcon(r.def.id, r.def.category)} size={22} weight={2.2} />
                {!r.unlocked && !hidden && <span class="ach-lock"><Icon name="lock" size={11} weight={2.6} /></span>}
              </span>
              <div class="ach-body">
                <span class="ach-name">{hidden ? t('meta.ach.secret') : lt(r.def.name)}</span>
                <span class="t-xs t-mid">{hidden ? t('meta.ach.secretDesc') : lt(r.def.desc)}</span>
                {r.unlocked ? (
                  <span class="t-xs t-pos">{t('meta.ach.unlockedOn', { d: r.unlockedAt ? formatTimestamp(r.unlockedAt) : '—' })}</span>
                ) : (
                  !hidden && r.def.target > 1 && (
                    <>
                      <div class="lg-bar" role="meter" aria-label={lt(r.def.name)} aria-valuemin={0} aria-valuemax={r.def.target} aria-valuenow={r.progress}><span style={{ width: `${Math.round(r.ratio * 100)}%` }} /></div>
                      <span class="t-xs t-lo num">{t('meta.ach.progress', { p: formatNumber(Math.floor(r.progress)), t: formatNumber(r.def.target) })}</span>
                    </>
                  )
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
