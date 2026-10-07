import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Card, Money, Page, StatBar } from '../../components'
import { Icon } from '../../icons'
import { data, gameState, navigate, type ScreenId } from '../../store'
import { HorseSvg, PlayingCard, SlotSymbol, CasinoAgeLock } from './shared'
import { ExclusionLock, HelplineNote, ResponsiblePanel } from './ResponsiblePanel'
import { casinoExclusion } from '../../../sim/life/casino'

type Game = 'blackjack' | 'roulette' | 'slots' | 'horses'
const GAMES: { id: Game; screen: ScreenId }[] = [
  { id: 'blackjack', screen: 'blackjack' },
  { id: 'roulette', screen: 'roulette' },
  { id: 'slots', screen: 'slots' },
  { id: 'horses', screen: 'horses' },
]

function TileArt({ game }: { game: Game }) {
  switch (game) {
    case 'blackjack':
      return (
        <div class="cas-tile-art cas-art-bj" aria-hidden="true">
          <PlayingCard card={{ rank: 'A', suit: 'S' }} />
          <PlayingCard card={{ rank: 'K', suit: 'H' }} />
        </div>
      )
    case 'roulette':
      return (
        <div class="cas-tile-art" aria-hidden="true">
          <svg viewBox="0 0 100 100" class="cas-art-wheel">
            {Array.from({ length: 18 }, (_, i) => {
              const a0 = (i / 18) * Math.PI * 2
              const a1 = ((i + 1) / 18) * Math.PI * 2
              const p = (a: number, r: number) => `${(50 + Math.sin(a) * r).toFixed(1)} ${(50 - Math.cos(a) * r).toFixed(1)}`
              return <path key={i} d={`M${p(a0, 46)}A46 46 0 0 1 ${p(a1, 46)}L${p(a1, 28)}A28 28 0 0 0 ${p(a0, 28)}Z`} fill={i === 0 ? 'var(--brand-pitch-deep)' : i % 2 ? 'var(--cas-red)' : 'var(--cas-black)'} />
            })}
            <circle cx="50" cy="50" r="28" fill="var(--cas-wood)" />
            <circle cx="50" cy="50" r="8" fill="var(--accent-gold)" />
            <circle cx="50" cy="12" r="3.5" fill="#f2f5fa" />
          </svg>
        </div>
      )
    case 'slots':
      return (
        <div class="cas-tile-art cas-art-slots" aria-hidden="true">
          {[3, 3, 3].map((s, i) => <span key={i} class="cas-art-reel"><SlotSymbol index={s} size={40} /></span>)}
        </div>
      )
    default:
      return (
        <div class="cas-tile-art cas-art-horses" aria-hidden="true">
          <span class="cas-art-finish" />
          {['#ff4d5e', '#ffc83d', '#3da5ff'].map((silk, i) => <span key={i} class="cas-art-lane"><HorseSvg silk={silk} /></span>)}
        </div>
      )
  }
}

export function CasinoScreen() {
  return data.casinoStatus().ageLock ? <CasinoAgeLock /> : <CasinoMain />
}

function CasinoMain() {
  const s = gameState.value
  const st = data.casinoStatus()
  const level = st.addiction >= 60 ? 'high' : st.addiction >= 30 ? 'medium' : 'low'
  const net = st.won - st.lost
  return (
    <Page title={t('casino.title')} sub={t('casino.sub')} backTo="life" wide actions={s && <span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={s.life.money} compact /></span>}>
      <div class="cas-lobby">
        {s && casinoExclusion(s.life) > 0 ? <ExclusionLock /> : <div class="cas-tiles">
          {GAMES.map((g) => (
            <button key={g.id} type="button" class={`cas-tile cas-tile-${g.id}`} onClick={() => navigate(g.screen)}>
              <TileArt game={g.id} />
              <span class="cas-tile-text">
                <span class="cas-tile-name">{t(`casino.games.${g.id}`)}</span>
                <span class="cas-tile-desc">{t(`casino.gamesDesc.${g.id}`)}</span>
              </span>
              <span class="cas-tile-cta"><Icon name="play" size={16} /> {t('casino.play')}</span>
            </button>
          ))}
        </div>}

        <aside class="cas-side stack">
          <Card class={`cas-rg cas-rg-${level}`} variant="raised">
            <div class="row">
              <Icon name={level === 'low' ? 'shield-check' : 'warning'} size={22} />
              <h2 class="h3">{t('casino.responsible.title')}</h2>
            </div>
            <StatBar
              label={t('casino.responsible.meter')}
              value={st.addiction}
              color={level === 'high' ? 'var(--state-danger)' : level === 'medium' ? 'var(--accent-gold)' : 'var(--brand-pitch)'}
            />
            <div class="cas-rg-scale" aria-hidden="true"><span /><span /><span /></div>
            <p class="cas-rg-msg">{t(`casino.responsible.${level}`)}</p>
            <p class="t-sm t-mid">{t('casino.responsible.body')}</p>
            <div class="row wrap">
              <Button variant={level === 'low' ? 'ghost' : 'secondary'} icon="sign-out" onClick={() => navigate('life', undefined, { tab: true })}>{t('casino.responsible.leave')}</Button>
              <Button variant="ghost" icon="home" onClick={() => navigate('home', undefined, { tab: true })}>{t('casino.responsible.stop')}</Button>
            </div>
            <HelplineNote />
            <p class="t-xs t-lo">{t('casino.responsible.note')}</p>
          </Card>
          <ResponsiblePanel />
          <Card>
            <dl class="cas-stats">
              <div><dt>{t('casino.status.won')}</dt><dd class="num t-pos"><Money value={st.won} compact animate={false} /></dd></div>
              <div><dt>{t('casino.status.lost')}</dt><dd class="num t-neg"><Money value={st.lost} compact animate={false} /></dd></div>
              <div><dt>{t('casino.status.net')}</dt><dd class={`num ${net >= 0 ? 't-pos' : 't-neg'}`}><Money value={net} compact sign animate={false} /></dd></div>
              <div><dt>{t('casino.status.visits')}</dt><dd class="num">{st.visitsThisWeek}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>
    </Page>
  )
}
