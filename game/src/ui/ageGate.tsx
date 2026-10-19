/**
 * Player age gate (docs/store/AGE-RATING.md). In-game money can be bought, and the simulated casino
 * uses it, so the casino asks the PLAYER's birth year once (neutral: no hint which answer passes) and
 * stays closed under 18. The answer also keeps rewarded ads non-personalised for under-18s. Stored on
 * this device only.
 */
import { signal } from '@preact/signals'
import type { FunctionComponent } from 'preact'
import { useState } from 'preact/hooks'
import { lt } from '../i18n'
import { Button, EmptyState, Page } from './components'
import { navigate } from './store'

const KEY = 'starpath.agegate.v1'
export const CASINO_PLAYER_MIN_AGE = 18

function load(): number | null {
  try {
    const v = Number(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')?.year)
    return Number.isInteger(v) && v > 1900 ? v : null
  } catch {
    return null
  }
}
export const birthYear = signal<number | null>(load())

/** Age this calendar year (conservative: assumes the birthday has not come yet). */
export function playerAge(now = new Date()): number | null {
  return birthYear.value === null ? null : now.getFullYear() - birthYear.value - 1
}
export const isAdultPlayer = (): boolean => (playerAge() ?? 0) >= CASINO_PLAYER_MIN_AGE

function save(year: number): void {
  birthYear.value = year
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ year }))
  } catch {
    /* private mode: asked again next time */
  }
}

/** The birth-year question on its own (also used inline, e.g. the store's cash tab). */
export function AgeQuestionInline() {
  const now = new Date().getFullYear()
  const [year, setYear] = useState('')
  const y = Number(year)
  const valid = Number.isInteger(y) && y > now - 110 && y <= now
  return (
    <div class="age-q">
      <p class="t-mid">{lt({ tr: 'Devam etmeden önce doğum yılını yaz. Yalnızca bu cihazda saklanır.', en: 'Enter your birth year to go on. It is stored on this device only.' })}</p>
      <input class="input" inputMode="numeric" maxLength={4} value={year} onInput={(e) => setYear((e.target as HTMLInputElement).value.replace(/\D/g, ''))} aria-label={lt({ tr: 'Doğum yılı', en: 'Birth year' })} data-testid="age-year" />
      <div style={{ marginTop: '12px' }}>
        <Button variant="primary" disabled={!valid} onClick={() => save(y)} data-testid="age-ok">{lt({ tr: 'Devam', en: 'Continue' })}</Button>
      </div>
    </div>
  )
}

function AgeQuestion() {
  return (
    <Page title={lt({ tr: 'Doğum yılın', en: 'Your birth year' })}>
      <AgeQuestionInline />
    </Page>
  )
}

/** Wraps a casino screen: asks the birth year once; under 18 the casino stays closed. */
export function ageGated(Screen: FunctionComponent): FunctionComponent {
  return function AgeGatedScreen() {
    if (birthYear.value === null) return <AgeQuestion />
    if (!isAdultPlayer()) {
      return (
        <Page title={lt({ tr: 'Kumarhane', en: 'Casino' })} backTo="life" showBack>
          <EmptyState icon="lock" title={lt({ tr: 'Kumarhane 18 yaş ve üstü içindir.', en: 'The casino is for players 18 and over.' })} action={<Button variant="secondary" onClick={() => navigate('life')}>{lt({ tr: 'Geri dön', en: 'Go back' })}</Button>} />
        </Page>
      )
    }
    return <Screen />
  }
}
