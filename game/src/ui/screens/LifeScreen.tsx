import { useState } from 'preact/hooks'
import { t } from '../../i18n'
import '../../styles/screens/life.css'
import { Button, EmptyState, MeterRing, Page, TabPanel, Tabs } from '../components'
import { formatCompact } from '../format'
import { Icon } from '../icons'
import { gameState, navigate, screen } from '../store'
import { Assets } from './life/Assets'
import { Bank } from './life/Bank'
import { Relations } from './life/Relations'
import { Social } from './life/Social'
import { Sponsors } from './life/Sponsors'
import { InfoTip } from '../tutorial/InfoTip'
import { LockChip, NewTag, UnlockGate } from '../tutorial/UnlockGate'
import { features } from '../tutorial/unlocks'

type LifeTab = 'relations' | 'assets' | 'bank' | 'social' | 'sponsors'
const TABS: LifeTab[] = ['relations', 'assets', 'bank', 'social', 'sponsors']
const ICONS = { relations: 'users', assets: 'house', bank: 'bank', social: 'instagram', sponsors: 'handshake' } as const

export function LifeScreen() {
  const p = screen.value.params?.tab
  const initial = (TABS as string[]).includes(String(p)) ? (p as LifeTab) : 'relations'
  const [tab, setTab] = useState<LifeTab>(initial)
  const s = gameState.value
  if (!s) return <Page title={t('life.title')}><EmptyState /></Page>
  const l = s.life
  return (
    <Page
      title={t('life.title')}
      sub={t('life.sub')}
      wide
      showBack={false}
      actions={
        <span class="life-casino-cta">
          <Button size="sm" variant="ghost" icon={features.value.casino.unlocked ? 'cards' : 'lock'} onClick={() => navigate('casino')}>
            {t('life.casinoCta')}
          </Button>
          <NewTag feature="casino" />
          <LockChip feature="casino" />
        </span>
      }
    >
      <div class="life-stats" role="group" aria-label={t('nav.statusBar')}>
        <MeterRing value={l.happiness} size={58} stroke={6} label={t('data.stat.happiness')} color="var(--brand-pitch)" />
        <MeterRing value={l.health} size={58} stroke={6} label={t('data.stat.health')} color="var(--accent-blue)" />
        <MeterRing value={l.stress} size={58} stroke={6} label={t('data.stat.stress')} color={l.stress > 65 ? 'var(--state-danger)' : 'var(--accent-gold)'} info={<InfoTip term="stress" />} />
        <MeterRing value={l.discipline} size={58} stroke={6} label={t('data.stat.discipline')} color="var(--accent-violet)" info={<InfoTip term="discipline" />} />
        <div class="life-followers">
          <Icon name="instagram" size={20} />
          <span class="score-font">{formatCompact(l.followers, undefined, 1000)}</span>
          <span class="micro t-mid">{t('data.stat.followers')}</span>
        </div>
      </div>
      <Tabs
        label={t('life.tabsLabel')}
        idPrefix="life"
        value={tab}
        onChange={setTab}
        items={TABS.map((id) => ({
          id,
          label: t(`life.tabs.${id}`),
          icon: id === 'sponsors' && !features.value.sponsors.unlocked ? 'lock' : ICONS[id],
          extra: id === 'sponsors' ? <NewTag feature="sponsors" /> : id === 'bank' ? <NewTag feature="investments" /> : undefined,
        }))}
      />
      <TabPanel id={tab} idPrefix="life">
        {tab === 'relations' && <Relations />}
        {tab === 'assets' && <Assets />}
        {tab === 'bank' && <Bank />}
        {tab === 'social' && <Social />}
        {tab === 'sponsors' && <UnlockGate feature="sponsors"><Sponsors /></UnlockGate>}
      </TabPanel>
    </Page>
  )
}
