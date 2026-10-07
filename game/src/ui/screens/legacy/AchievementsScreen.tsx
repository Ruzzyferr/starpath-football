import '../../../styles/screens/legacy.css'
import { useState } from 'preact/hooks'
import { currentLang, lt, t } from '../../../i18n'
import { Page, Tabs } from '../../components'
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
      <div class="lg-summary">
        <div class="lg-big num" data-testid="ach-count">{v.unlocked}</div>
        <div class="grow stack">
          <div class="lg-bar is-gold" role="meter" aria-label={t('meta.ach.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>
          <div class="t-xs t-lo">{t('meta.ach.steam')}</div>
        </div>
      </div>
      <Tabs items={tabs} value={cat} onChange={setCat} variant="pill" label={t('meta.ach.title')} idPrefix="ach" />
      <ul class="ach-grid" aria-label={t('meta.ach.title')}>
        {rows.map((r) => {
          const hidden = r.def.secret && !r.unlocked
          return (
            <li key={r.def.id} class={`ach-card ${r.unlocked ? 'is-unlocked' : ''}`} data-ach={r.def.id} data-unlocked={r.unlocked ? '1' : '0'}>
              <span class="ach-icon" aria-hidden="true">{hidden ? '❔' : r.def.icon}</span>
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
