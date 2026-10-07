import { useState } from 'preact/hooks'
import { t } from '../../../i18n'
import '../../../styles/screens/casino.css'
import { Button, Chip, Money, Page } from '../../components'
import { formatMoney } from '../../format'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { actions, blackjack, data, type BlackjackHandView, type BlackjackView, type CardView } from '../../store'
import { BetPicker, casinoMoney, PlayingCard } from './shared'

function Hand({ cards, label, total, dealer, revealed }: { cards: CardView[]; label: string; total: number | null; dealer?: boolean; revealed?: boolean }) {
  return (
    <div class={`bj-hand ${dealer ? 'bj-dealer' : 'bj-player'}`}>
      <div class="bj-hand-label">
        <span class="micro">{label}</span>
        <span class="bj-total score-font" aria-live="polite">{total === null ? '?' : total}</span>
      </div>
      <div class="bj-cards">
        {cards.map((c, i) => (
          <PlayingCard key={`${i}-${c.rank}${c.suit}-${c.faceDown ? 'd' : 'u'}`} card={c} delay={c.faceDown ? i * 140 : revealed && dealer && i === 1 ? 0 : i * 140} reveal={revealed && dealer && i === 1} />
        ))}
      </div>
    </div>
  )
}

const RESULT_TONE: Record<NonNullable<BlackjackView['result']>, 'pos' | 'neg' | 'neutral' | 'gold'> = {
  win: 'pos', blackjack: 'gold', push: 'neutral', lose: 'neg', bust: 'neg',
}

/** One of the two hands after a split. */
function SplitHand({ h, index, active, done }: { h: BlackjackHandView; index: number; active: boolean; done: boolean }) {
  return (
    <div
      class={`bj-hand bj-player bj-split-hand${active ? ' is-active' : ''}${done && h.result ? ` is-${h.result}` : ''}`}
      aria-current={active ? 'true' : undefined}
      aria-label={t('casino.bj.hand', { n: index + 1 })}
    >
      <div class="bj-hand-label">
        <span class="micro">{t('casino.bj.hand', { n: index + 1 })}</span>
        <span class="bj-total score-font" aria-live="polite">{h.total}</span>
        {active && <span class="bj-active-tag micro">{t('casino.bj.active')}</span>}
      </div>
      <div class="bj-cards">
        {h.cards.map((c, i) => <PlayingCard key={`${i}-${c.rank}${c.suit}`} card={c} delay={i * 140} />)}
      </div>
      <div class="bj-hand-meta">
        <span class="num t-xs">{t('casino.bj.stake', { amount: formatMoney(h.stake) })}</span>
        {h.doubled && <Chip tone="gold">{t('casino.bj.doubled')}</Chip>}
        {done && h.result && (
          <Chip tone={RESULT_TONE[h.result]}>
            {t(`casino.bj.result.${h.result}`)} · {formatMoney(h.payout, { sign: true })}
          </Chip>
        )}
      </div>
    </div>
  )
}

export function BlackjackScreen() {
  const st = data.casinoStatus()
  const [view, setView] = useState<BlackjackView | null>(blackjack.value)
  const [bet, setBet] = useState(st.minBet)
  const playing = view?.phase === 'player'
  const money = casinoMoney()

  const run = (fn: () => BlackjackView) => {
    const v = fn()
    setView(v)
    if (v.phase === 'done') haptic(v.payout > 0 ? 'success' : v.payout < 0 ? 'warning' : 'tap')
  }

  const result = view?.phase === 'done' ? view.result : null
  return (
    <Page title={t('casino.games.blackjack')} backTo="casino" wide actions={<span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={money} compact /></span>}>
      <div class="bj-layout">
        <div class="bj-table cas-felt">
          <div class="bj-shoe" aria-hidden="true" />
          <svg class="bj-arc" viewBox="0 0 400 80" aria-hidden="true">
            <defs><path id="bj-arc-path" d="M20 10Q200 90 380 10" /></defs>
            <text><textPath href="#bj-arc-path" startOffset="50%" text-anchor="middle">{t('casino.bj.table')}</textPath></text>
          </svg>
          {view ? (
            <>
              <Hand cards={view.dealer} label={t('casino.bj.dealer')} total={view.dealerTotal} dealer revealed={view.phase === 'done'} />
              <div class={`bj-result${result ? ` is-${result} is-shown` : ''}`} aria-live="assertive">
                {result && (
                  <>
                    <span class="bj-result-title">{t(`casino.bj.result.${result}`)}</span>
                    <span class={`bj-result-net num ${view.payout > 0 ? 't-pos' : view.payout < 0 ? 't-neg' : ''}`}>
                      {t('casino.net', { amount: formatMoney(view.payout, { sign: true }) })}
                    </span>
                  </>
                )}
              </div>
              {view.hands && view.hands.length > 1 ? (
                <div class="bj-split">
                  {view.hands.map((h, i) => <SplitHand key={i} h={h} index={i} active={playing && i === view.active} done={view.phase === 'done'} />)}
                </div>
              ) : (
                <Hand cards={view.player} label={t('casino.bj.you')} total={view.playerTotal} />
              )}
              <div class="bj-stake"><span class="cas-chip cas-chip-3" aria-hidden="true" /> <span class="num">{formatMoney(view.bet)}</span></div>
            </>
          ) : (
            <p class="bj-empty">{t('casino.bj.placeBet')}</p>
          )}
        </div>

        <div class="bj-controls">
          {playing && view ? (
            <div class="bj-actions">
              <Button variant="secondary" size="lg" icon="plus" onClick={() => run(() => actions.casino.blackjackHit())}>{t('casino.bj.hit')}</Button>
              <Button variant="primary" size="lg" icon="pause" onClick={() => run(() => actions.casino.blackjackStand())}>{t('casino.bj.stand')}</Button>
              <Button variant="gold" size="lg" icon="coins" disabled={!view.canDouble} onClick={() => run(() => actions.casino.blackjackDouble())}>{t('casino.bj.double')}</Button>
              <Button variant="secondary" size="lg" icon="shuffle" disabled={!view.canSplit} title={t('casino.bj.splitHint')} onClick={() => run(() => actions.casino.blackjackSplit())}>{t('casino.bj.split')}</Button>
            </div>
          ) : (
            <>
              <BetPicker bet={bet} setBet={setBet} />
              <Button
                variant="primary"
                size="lg"
                block
                icon="cards"
                disabled={bet < st.minBet || bet > money}
                onClick={() => run(() => actions.casino.blackjackDeal(bet))}
              >
                {view ? t('casino.bj.newHand') : t('casino.bj.deal')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
