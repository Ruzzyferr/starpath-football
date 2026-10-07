import '../../styles/screens/season.css'
import { useState } from 'preact/hooks'
import { t, lt, currentLang } from '../../i18n'
import { EmptyState, Page, Tabs } from '../components'
import { Icon } from '../icons'
import { seasonLabel } from '../format'
import { gameState } from '../store'
import { Medal, Trophy, awardTier } from './season/TrophyArt'

const PER_SHELF = 4

export function TrophiesScreen() {
  const s = gameState.value
  void currentLang.value
  const [filter, setFilter] = useState<string>('all')
  if (!s) return <Page title={t('season.cabinet.title')} backTo="profile"><EmptyState icon="trophy" /></Page>

  const { trophies, awards } = s.hero
  const seasons = Array.from(new Set([...trophies.map((x) => x.season), ...awards.map((x) => x.season)])).sort((a, b) => b - a)
  const pick = <T extends { season: number }>(arr: T[]) => (filter === 'all' ? arr : arr.filter((x) => String(x.season) === filter))
  const tList = pick(trophies)
  const aList = pick(awards)

  // Fill the last shelf with "next goal" placeholders (at least one) when viewing everything.
  const goals = [t('season.cabinet.slotLeague'), t('season.cabinet.slotCup'), t('season.cabinet.slotAward'), t('season.cabinet.slotGolden')]
  const rem = tList.length % PER_SHELF
  const emptySlots = filter !== 'all' ? 0 : tList.length === 0 ? PER_SHELF : rem === 0 ? 2 : PER_SHELF - rem

  type Slot = { kind: 'trophy'; name: string; season: number } | { kind: 'empty'; hint: string }
  const slots: Slot[] = [
    ...tList.map((x) => ({ kind: 'trophy' as const, name: lt(x.name), season: x.season })),
    ...Array.from({ length: emptySlots }, (_, i) => ({ kind: 'empty' as const, hint: goals[i % goals.length] })),
  ]
  const shelves: Slot[][] = []
  for (let i = 0; i < slots.length; i += PER_SHELF) shelves.push(slots.slice(i, i + PER_SHELF))

  const tabs = [{ id: 'all', label: t('season.cabinet.filterAll') }, ...seasons.map((x) => ({ id: String(x), label: seasonLabel(x) }))]

  return (
    <Page
      title={t('season.cabinet.title')}
      sub={t('season.cabinet.sub', { t: trophies.length, a: awards.length })}
      backTo="profile"
      class="cab-page"
    >
      {tabs.length > 2 && <Tabs items={tabs} value={filter} onChange={setFilter} variant="pill" label={t('season.cabinet.filterLabel')} idPrefix="cab" />}

      <section class="cab-cabinet" aria-label={t('season.cabinet.trophiesH')}>
        <div class="cab-glass" aria-hidden="true" />
        <h2 class="cab-h"><Icon name="trophy" size={18} /> {t('season.cabinet.trophiesH')}</h2>
        {shelves.length === 0 && <EmptyState icon="trophy" title={t('season.cabinet.empty')} text={t('season.cabinet.emptyHint')} />}
        {shelves.map((shelf, si) => (
          <div class="cab-shelf" key={si}>
            <div class="cab-items">
              {shelf.map((slot, i) =>
                slot.kind === 'trophy' ? (
                  <figure class="cab-item" key={i}>
                    <span class="cab-spot" aria-hidden="true" />
                    <Trophy name={slot.name} season={slot.season} size={58} />
                    <figcaption>
                      <span class="cab-name">{slot.name}</span>
                      <span class="t-xs t-lo num">{seasonLabel(slot.season)}</span>
                    </figcaption>
                  </figure>
                ) : (
                  <figure class="cab-item is-empty" key={i}>
                    <span class="cab-ghost" aria-hidden="true"><Icon name="trophy" size={34} weight={1.5} /></span>
                    <figcaption>
                      <span class="micro t-lo">{t('season.cabinet.nextGoal')}</span>
                      <span class="cab-name t-mid">{slot.hint}</span>
                    </figcaption>
                  </figure>
                ),
              )}
            </div>
            <div class="cab-plank" aria-hidden="true" />
          </div>
        ))}
      </section>

      <section class="cab-awards" aria-label={t('intl.awards.natCareer')} data-testid="cabinet-national">
        <h2 class="cab-h"><Icon name="flag" size={18} /> {t('intl.awards.natCareer')}</h2>
        <div class="cab-nat">
          <span class="cab-nat-badge" aria-hidden="true"><Icon name="flag" size={20} /></span>
          <div class="stack" style={{ gap: 2 }}>
            <span class="t-sm">{t('intl.national.caps', { c: s.hero.nationalTeam.caps, g: s.hero.nationalTeam.goals })}</span>
            <span class="t-xs t-mid">{t('intl.national.youthCaps', { c: s.world.national?.hero.youthCaps ?? 0, g: s.world.national?.hero.youthGoals ?? 0 })}</span>
          </div>
        </div>
      </section>

      <section class="cab-awards" aria-label={t('season.cabinet.awardsH')}>
        <h2 class="cab-h"><Icon name="medal" size={18} /> {t('season.cabinet.awardsH')}</h2>
        {aList.length === 0 ? (
          <EmptyState compact icon="medal" text={t('season.cabinet.empty')} />
        ) : (
          <ul class="cab-award-grid">
            {aList.map((a, i) => {
              const tier = awardTier(a.key)
              return (
                <li class={`cab-award tier-${tier}`} key={`${a.key}-${a.season}-${i}`}>
                  <Medal tier={tier} size={48} />
                  <div class="grow">
                    <div class="cab-award-name">{lt(a.name)}</div>
                    <div class="t-xs t-mid">{t(`data.tier.${tier}`)} · {seasonLabel(a.season)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Page>
  )
}
