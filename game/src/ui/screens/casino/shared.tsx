/** Casino-wide pieces: header strip, bet picker, playing card, slot symbols. */
import type { ComponentChildren } from 'preact'
import { t } from '../../../i18n'
import { Button, Card, IconButton, Money, Page } from '../../components'
import { formatMoney } from '../../format'
import { Icon } from '../../icons'
import { haptic } from '../../haptics'
import { data, gameState, navigate, type CardView, type Suit } from '../../store'

export function casinoMoney(): number {
  return gameState.value?.life.money ?? 0
}

export function chipValues(min: number, max: number): number[] {
  const raw = [min, min * 5, min * 10, min * 50, min * 100, max]
  return Array.from(new Set(raw.filter((v) => v <= max))).sort((a, b) => a - b)
}

/** Felt-coloured chip. */
export function ChipToken({ value, selected, onClick, label }: { value: number; selected?: boolean; onClick?: () => void; label?: string }) {
  const tier = value >= 50_000 ? 5 : value >= 10_000 ? 4 : value >= 5_000 ? 3 : value >= 1_000 ? 2 : 1
  return (
    <button
      type="button"
      class={`cas-chip cas-chip-${tier}${selected ? ' is-selected' : ''}`}
      onClick={() => {
        haptic('select')
        onClick?.()
      }}
      aria-pressed={selected}
      aria-label={label ?? formatMoney(value)}
    >
      <span class="num">{formatMoney(value, { compact: true }).replace(/\s?€\s?/, '')}</span>
    </button>
  )
}

/** Stack of chips that add to the bet + clear; shows current bet. */
export function BetPicker({ bet, setBet, disabled }: { bet: number; setBet: (n: number) => void; disabled?: boolean }) {
  const st = data.casinoStatus()
  const money = casinoMoney()
  const cap = Math.min(st.maxBet, money)
  return (
    <div class="cas-betpicker">
      <div class="row-between">
        <span class="label t-mid">{t('casino.betAmount')}</span>
        <span class="t-xs t-lo">{t('casino.limits', { min: formatMoney(st.minBet, { compact: true }), max: formatMoney(st.maxBet, { compact: true }) })}</span>
      </div>
      <div class="cas-bet-row">
        <div class="cas-bet-value score-font num" aria-live="polite">{formatMoney(bet)}</div>
        <button type="button" class="cas-clear" disabled={disabled || bet === 0} onClick={() => setBet(0)}>{t('casino.clearBet')}</button>
      </div>
      <div class="cas-chips" role="group" aria-label={t('casino.bet')}>
        {chipValues(st.minBet, st.maxBet).map((v) => (
          <ChipToken key={v} value={v} onClick={() => !disabled && setBet(Math.min(cap, bet + v))} />
        ))}
      </div>
      {money < st.minBet && <p class="t-sm t-neg">{t('casino.noMoney')}</p>}
    </div>
  )
}

export function CasinoBar({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <div class="cas-bar">
      <h1 class="cas-bar-title">{title}</h1>
      {children}
      <span class="cas-bar-money"><Icon name="coins" size={16} /><Money value={casinoMoney()} compact /></span>
    </div>
  )
}

export function BackToLobby({ onBack }: { onBack: () => void }) {
  return <IconButton icon="arrow-left" label={t('casino.lobby')} onClick={onBack} />
}

// ── Playing cards ───────────────────────────────────────────────
export const SUIT_PATH: Record<Suit, string> = {
  H: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  D: 'M12 2l7 10-7 10-7-10z',
  S: 'M12 2s-8 6.5-8 11.2a4 4 0 0 0 7 2.6L10 21h4l-1-5.2a4 4 0 0 0 7-2.6C20 8.5 12 2 12 2z',
  C: 'M12 3a3.8 3.8 0 0 0-3.3 5.6A3.8 3.8 0 1 0 10.6 15L9.6 21h4.8l-1-6a3.8 3.8 0 1 0 1.9-6.4A3.8 3.8 0 0 0 12 3z',
}

export function SuitIcon({ suit, size = 16 }: { suit: Suit; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="cas-suit">
      <path d={SUIT_PATH[suit]} fill="currentColor" />
    </svg>
  )
}

const SUIT_NAME: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

export function PlayingCard({ card, delay = 0, reveal }: { card: CardView; delay?: number; reveal?: boolean }) {
  const red = card.suit === 'H' || card.suit === 'D'
  if (card.faceDown)
    return (
      <div class="bj-card is-back" style={{ animationDelay: `${delay}ms` }} role="img" aria-label={t('casino.bj.hidden')}>
        <span class="bj-back-pattern" />
      </div>
    )
  return (
    <div
      class={`bj-card ${red ? 'is-red' : 'is-black'}${reveal ? ' is-reveal' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      role="img"
      aria-label={`${card.rank}${SUIT_NAME[card.suit]}`}
    >
      <span class="bj-corner bj-tl"><span class="bj-rank">{card.rank}</span><SuitIcon suit={card.suit} size={12} /></span>
      <span class="bj-center"><SuitIcon suit={card.suit} size={34} /></span>
      <span class="bj-corner bj-br"><span class="bj-rank">{card.rank}</span><SuitIcon suit={card.suit} size={12} /></span>
    </div>
  )
}

// ── Slot symbols (48×48) ────────────────────────────────────────
export const SLOT_SYMBOLS = ['cherries', 'star', 'bell', 'seven', 'ball', 'trophy', 'diamond'] as const
export type SlotSymbolName = (typeof SLOT_SYMBOLS)[number]

export function SlotSymbol({ index, size = 56 }: { index: number; size?: number }) {
  const name = SLOT_SYMBOLS[((index % SLOT_SYMBOLS.length) + SLOT_SYMBOLS.length) % SLOT_SYMBOLS.length]
  let body
  switch (name) {
    case 'cherries':
      body = (
        <>
          <path d="M18 30C20 18 26 10 34 6M30 31c-1-9 0-17 4-25" stroke="var(--brand-pitch-deep)" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M34 6c5 0 9 3 10 8-6 1-10-2-10-8z" fill="var(--brand-pitch)" />
          <circle cx="16" cy="34" r="9" fill="var(--state-danger)" />
          <circle cx="31" cy="36" r="9" fill="var(--state-danger-deep)" />
          <circle cx="13" cy="31" r="2.5" fill="#fff" opacity=".55" />
          <circle cx="28" cy="33" r="2.5" fill="#fff" opacity=".45" />
        </>
      )
      break
    case 'star':
      body = <path d="M24 4l6 12.6 13.6 1.9-9.9 9.4 2.5 13.6L24 35l-12.2 6.5 2.5-13.6-9.9-9.4 13.6-1.9z" fill="var(--accent-gold)" stroke="var(--accent-gold-deep)" stroke-width="2" stroke-linejoin="round" />
      break
    case 'bell':
      body = (
        <>
          <path d="M24 6c-8 0-12 7-12 15v8l-4 6h32l-4-6v-8c0-8-4-15-12-15z" fill="var(--accent-gold)" stroke="var(--accent-gold-deep)" stroke-width="2" />
          <circle cx="24" cy="39" r="4" fill="var(--accent-gold-deep)" />
          <path d="M17 18c1-5 4-7 7-7" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" fill="none" stroke-linecap="round" />
        </>
      )
      break
    case 'seven':
      body = (
        <text x="24" y="42" text-anchor="middle" font-family="Teko, Barlow Condensed, sans-serif" font-weight="600" font-size="48" fill="var(--state-danger)" stroke="var(--accent-gold)" stroke-width="2" paint-order="stroke">7</text>
      )
      break
    case 'ball':
      body = (
        <>
          <circle cx="24" cy="24" r="18" fill="#f2f5fa" stroke="#0b1220" stroke-width="2" />
          <path d="M24 15l8 5.8-3 9.4H19l-3-9.4z" fill="#0b1220" />
          <path d="M24 6v9M32 20.8l8.6-3M29 30.2l5.4 7.6M19 30.2l-5.4 7.6M16 20.8l-8.6-3" stroke="#0b1220" stroke-width="2" />
        </>
      )
      break
    case 'trophy':
      body = (
        <>
          <path d="M14 7h20v10a10 10 0 0 1-20 0z" fill="var(--accent-gold)" stroke="var(--accent-gold-deep)" stroke-width="2" />
          <path d="M14 10H8v3a6 6 0 0 0 6 6M34 10h6v3a6 6 0 0 1-6 6" stroke="var(--accent-gold-deep)" stroke-width="2.5" fill="none" />
          <path d="M22 27h4v6h-4zM16 34h16v6H16z" fill="var(--accent-gold-deep)" />
        </>
      )
      break
    default: // diamond
      body = (
        <>
          <path d="M8 18l8-10h16l8 10-16 22z" fill="var(--accent-blue)" stroke="var(--accent-blue-deep)" stroke-width="2" stroke-linejoin="round" />
          <path d="M8 18h32M16 8l8 32M32 8l-8 32M16 8l-4 10M32 8l4 10" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none" />
        </>
      )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={t(`casino.slot.symbols.${name}`)}>
      {body}
    </svg>
  )
}

/** Friendly locked state for under-18 heroes (lobby and every game screen). */
export function CasinoAgeLock({ title }: { title?: string }) {
  const lock = data.casinoStatus().ageLock
  const minAge = lock?.minAge ?? 18
  return (
    <Page title={title ?? t('casino.title')} backTo="life">
      <Card class="cas-locked" variant="raised">
        <span class="cas-locked-badge" aria-hidden="true">{minAge}+</span>
        <h2 class="h3">{t('casino.locked.title')}</h2>
        <p>{t('casino.locked.body', { age: minAge, n: lock?.yearsLeft ?? 1 })}</p>
        <p class="t-sm t-mid">{t('casino.locked.hint')}</p>
        <Button variant="primary" icon="arrow-left" onClick={() => navigate('life', undefined, { tab: true })}>{t('casino.locked.back')}</Button>
      </Card>
    </Page>
  )
}

/** Side-on racehorse with a jockey in the given silk colour (race track + lobby tile). */
export function HorseSvg({ silk }: { silk: string }) {
  return (
    <svg viewBox="0 0 44 28" class="hr-horse-svg" aria-hidden="true">
      <path d="M8 13Q3 13 2 19" stroke="#3a2618" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <ellipse cx="19" cy="15" rx="12" ry="5.5" fill="#6b4226" />
      <path d="M28 12L35 5L40 6.5L38.5 10L33 15Z" fill="#6b4226" />
      <path d="M35 5l1-3 1.5 3" fill="#6b4226" />
      <g stroke="#4a2e1a" stroke-width="2.2" stroke-linecap="round" class="hr-legs">
        <path d="M11 19L8 26" /><path d="M15 19L17 26" /><path d="M24 19L22 26" /><path d="M28 18L31 26" />
      </g>
      <path d="M17 10L22 3.5L26 5.5L22 11Z" fill={silk} stroke="#0b1220" stroke-width=".8" />
      <circle cx="24.5" cy="3.2" r="2.4" fill={silk} stroke="#0b1220" stroke-width=".8" />
    </svg>
  )
}
