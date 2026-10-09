import { useMemo, useRef, useState, useEffect } from 'preact/hooks'
import { PEAK_AGE, REF_START_AGE, START_AGE_MAX, START_AGE_MIN, previewAttrs, startAgeEffect } from '../../sim/career/createHero'
import { ovrFor } from '../../sim/career/progression'
import { clampHeight, defaultRole } from '../../core/roles'
import '../../styles/screens/wizard.css'
import type { Background, Country, CustomDifficulty, Difficulty, Foot, Gender } from '../../core/types'
import { AI_REACTION_MAX, AI_REACTION_MIN, DEFAULT_CUSTOM } from '../../core/customDifficulty'
import { START_YEAR } from '../../core/config'
import { lt, t } from '../../i18n'
import { foldSearch } from '../a11y/collate'
import { formatNumber } from '../format'
import { Button, Chip, Flag, PlayerCard, Segmented, Slider, Switch, TextField, toast, type PlayerCardStat } from '../components'
import { Icon, type IconName } from '../icons'
import { roleKeys } from '../roleView'
import { haptic } from '../haptics'
import { actions, back, data, navigate, screen, type NewGameInput } from '../store'
import { legacyFor, summaryView } from '../backend/meta'
import { CITIES } from '../../data/world/names'
import { PitchPicker } from './newcareer/PitchPicker'
import { StoryArt } from './newcareer/StoryArt'
import { RolePicker } from './newcareer/RolePicker'
import { AppearanceEditor, randomAppearance, withGender } from './newcareer/AppearanceEditor'
import { beginNewCareer } from '../tutorial/tour'

type Step = 'identity' | 'nation' | 'position' | 'role' | 'background' | 'look' | 'summary'
const STEPS: Step[] = ['identity', 'nation', 'position', 'role', 'background', 'look', 'summary']

const BACKGROUNDS: Background[] = ['street', 'academy', 'footballFamily', 'lateBloomer']
const BG_ICON: Record<Background, IconName> = { street: 'ball', academy: 'building', footballFamily: 'users', lateBloomer: 'sparkle' }
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'legend']
const DIFF_ICON: Record<Difficulty, IconName> = { easy: 'smile', normal: 'ball', hard: 'fire', legend: 'crown' }
/** Opponent sharpness of each preset (sim/game/match DIFFICULTY_FACTOR), the custom slider's starting point. */
const DIFF_REACTION: Record<Difficulty, number> = { easy: 0.85, normal: 1, hard: 1.15, legend: 1.3 }

/** "Custom" difficulty (GAP 2.1#128): bullet time, arc, magnet, AI reaction and wind one by one. */
function CustomDifficultyPanel({ value, base, onChange }: { value: CustomDifficulty | undefined; base: Difficulty; onChange: (c: CustomDifficulty | undefined) => void }) {
  const c = value
  const patch = (p: Partial<CustomDifficulty>) => c && onChange({ ...c, ...p })
  return (
    <div class="wiz-custom" data-testid="wiz-custom">
      <Switch
        checked={!!c}
        onChange={(on) => onChange(on ? { ...DEFAULT_CUSTOM, aiReaction: DIFF_REACTION[base] } : undefined)}
        label={t('wizard.custom.title')}
        desc={t('wizard.custom.desc')}
      />
      {c && (
        <>
          <Switch checked={c.bulletTime} onChange={(v) => patch({ bulletTime: v })} label={t('wizard.custom.bulletTime')} />
          <Switch checked={c.arc} onChange={(v) => patch({ arc: v })} label={t('wizard.custom.arc')} />
          <Switch checked={c.magnet} onChange={(v) => patch({ magnet: v })} label={t('wizard.custom.magnet')} desc={t('wizard.custom.magnetDesc')} />
          <Switch checked={c.wind} onChange={(v) => patch({ wind: v })} label={t('wizard.custom.wind')} />
          <Slider
            label={t('wizard.custom.ai')}
            value={c.aiReaction}
            min={AI_REACTION_MIN}
            max={AI_REACTION_MAX}
            step={0.05}
            onChange={(v) => patch({ aiReaction: v })}
            format={(v) => `×${v.toFixed(2)}`}
          />
        </>
      )}
    </div>
  )
}

const FALLBACK_COUNTRY: Country = {
  id: 'TR', name: { tr: 'Türkiye', en: 'Türkiye' }, adjective: { tr: 'Türk', en: 'Turkish' },
  flag: ['#e30a17', '#ffffff', '#e30a17'], reputation: 70, nameStyle: 'tr',
}

function loadCountries(): Country[] {
  try {
    const list = data.countries()
    return list.length ? list : [FALLBACK_COUNTRY]
  } catch {
    return [FALLBACK_COUNTRY]
  }
}

export function NewCareerScreen() {
  const countries = useMemo(loadCountries, [])
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  // New Game+ Legacy: ?legacy=<careerId> pre-fills the surname / nation and carries the inheritance.
  const legacyId = screen.value.params?.legacy
  const legacy = typeof legacyId === 'string' ? legacyFor(legacyId) : null
  const parent = typeof legacyId === 'string' ? summaryView(legacyId) : null
  const [form, setForm] = useState<NewGameInput>(() => ({
    firstName: '',
    lastName: parent?.lastName ?? '',
    nickname: '',
    nationality: countries.find((c) => c.id === 'TR')?.id ?? countries[0]!.id,
    birthYear: START_YEAR - 17,
    position: 'ST',
    foot: 'R',
    role: defaultRole('ST'),
    background: 'academy',
    appearance: randomAppearance(Date.now()),
    gender: 'male',
    difficulty: 'normal',
    trials: true,
    ...(legacy ? { legacy } : {}),
    ...(parent && countries.some((c) => c.id === parent.nationality) ? { nationality: parent.nationality } : {}),
  }))
  const bodyRef = useRef<HTMLDivElement>(null)
  const set = <K extends keyof NewGameInput>(k: K, v: NewGameInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setGender = (g: Gender) => setForm((f) => ({ ...f, gender: g, appearance: withGender(f.appearance, g) }))

  const cur = STEPS[step]!
  const nameOk = form.firstName.trim().length > 0 && form.lastName.trim().length > 0
  const country = (countries.find((c) => c.id === form.nationality) ?? countries[0])!
  const shirt = country.flag[0]
  const trim = country.flag[1] === shirt ? country.flag[2] : country.flag[1]

  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 })
    bodyRef.current?.querySelector<HTMLElement>('.wiz-step-title')?.focus()
  }, [step])

  const go = (n: number) => {
    if (n > 0 && !nameOk) {
      setTouched(true)
      setStep(0)
      toast(t('wizard.nameRequired'), 'warning')
      return
    }
    const clamped = Math.max(0, Math.min(STEPS.length - 1, n))
    haptic('select')
    setStep(clamped)
    setMaxReached((m) => Math.max(m, clamped))
  }

  const start = () => {
    if (!nameOk) return go(0)
    setBusy(true)
    try {
      actions.newGame({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nickname: (form.nickname.trim() || form.lastName.trim()),
      })
      haptic('success')
      beginNewCareer()
      navigate('home', undefined, { tab: true })
    } catch {
      setBusy(false)
      toast(t('wizard.failed'), 'error')
    }
  }

  const filtered = query.trim()
    ? countries.filter((c) => foldSearch(`${c.name.tr} ${c.name.en} ${c.id}`).includes(foldSearch(query)))
    : countries

  const age = START_YEAR - form.birthYear
  // Expected starting card (no noise): the role's key strengths and the weighted OVR at the position.
  const sheet = previewAttrs(form.position, form.role, form.background, age)
  const cardKeys = [...roleKeys(form.role, form.position).strong]
  const stats: PlayerCardStat[] = cardKeys.map((k) => ({ label: t(`data.attrShort.${k}`), value: sheet[k] }))
  const ovr = ovrFor(sheet, form.position)
  const gender: Gender = form.gender ?? 'male'
  const fullName = `${form.firstName.trim() || '—'} ${form.lastName.trim()}`.trim()

  return (
    <div class="wiz">
      <header class="wiz-head">
        <button type="button" class="icon-btn icon-btn-ghost" aria-label={t('common.back')} onClick={() => (step > 0 ? go(step - 1) : back('title'))}>
          <Icon name="arrow-left" size={22} />
        </button>
        <div class="grow">
          <div class="micro t-lo">{t('wizard.stepOf', { n: step + 1, total: STEPS.length })}</div>
          <h1 class="wiz-title">{t('wizard.title')}</h1>
        </div>
      </header>

      <ol class="wiz-stepper" aria-label={t('wizard.title')}>
        {STEPS.map((s, i) => {
          const state = i === step ? 'is-current' : i <= maxReached ? 'is-done' : ''
          return (
            <li key={s} class={`wiz-stepper-item ${state}`}>
              <button
                type="button"
                class="wiz-stepper-btn"
                aria-current={i === step ? 'step' : undefined}
                disabled={i > maxReached && !(nameOk && i === maxReached + 1)}
                onClick={() => go(i)}
              >
                <span class="wiz-stepper-num num">{i < step ? <Icon name="check" size={14} weight={3} /> : i + 1}</span>
                <span class="wiz-stepper-label">{t(`wizard.steps.${s}`)}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div class="wiz-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} /></div>

      <div class="wiz-body" ref={bodyRef}>
        <div class="wiz-step" key={cur}>
          <h2 class="wiz-step-title" tabIndex={-1}>{t(`wizard.stepTitle.${cur}`)}</h2>

          {cur === 'identity' && (
            <div class="wiz-identity">
              <div class="grid-md-2 stack">
                <TextField id="wiz-first" label={t('wizard.firstName')} value={form.firstName} placeholder={t('wizard.firstPh')} onInput={(v) => set('firstName', v)} autoFocus />
                <TextField id="wiz-last" label={t('wizard.lastName')} value={form.lastName} placeholder={t('wizard.lastPh')} onInput={(v) => set('lastName', v)} />
              </div>
              <div class="stack" style={{ ['--gap' as string]: 'var(--sp-2)' }}>
                <span class="label t-mid" id="wiz-gender-label">{t('wizard.gender')}</span>
                <Segmented<Gender>
                  label={t('wizard.gender')}
                  value={form.gender ?? 'male'}
                  onChange={setGender}
                  options={[{ id: 'male', label: t('wizard.genderMale') }, { id: 'female', label: t('wizard.genderFemale') }]}
                />
                <p class="t-xs t-lo">{t('wizard.genderHint')}</p>
              </div>
              <TextField id="wiz-nick" label={t('wizard.nickname')} value={form.nickname} placeholder={t('wizard.nickPh')} maxLength={14} onInput={(v) => set('nickname', v)} />
              <p class="t-xs t-lo">{t('wizard.nicknameHint')}</p>
              {touched && !nameOk && <p class="wiz-error" role="alert"><Icon name="warning" size={16} /> {t('wizard.nameRequired')}</p>}
              <div class="stack" style={{ ['--gap' as string]: 'var(--sp-2)' }}>
                <span class="label t-mid">{t('wizard.age')}</span>
                <Segmented
                  label={t('wizard.age')}
                  value={age}
                  onChange={(a) => set('birthYear', START_YEAR - a)}
                  options={START_AGES.map((a) => ({ id: a, label: String(a) }))}
                />
                <AgeTradeOff age={age} ovr={ovr} refOvr={ovrFor(previewAttrs(form.position, form.role, form.background, REF_START_AGE), form.position)} />
                <p class="t-xs t-lo">{t('wizard.ageHint')}</p>
              </div>
            </div>
          )}

          {cur === 'nation' && (
            <div class="stack">
              <div class="wiz-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  value={query}
                  placeholder={t('wizard.search')}
                  aria-label={t('wizard.search')}
                  onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
                />
              </div>
              {filtered.length === 0 ? (
                <p class="t-mid t-sm">{t('wizard.noCountry')}</p>
              ) : (
                <div class="wiz-flags" role="radiogroup" aria-label={t('wizard.steps.nation')}>
                  {filtered.map((c) => {
                    const sel = c.id === form.nationality
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        class={`wiz-flag${sel ? ' is-active' : ''}`}
                        onClick={() => {
                          haptic('select')
                          setForm((f) => ({ ...f, nationality: c.id, birthCity: undefined }))
                        }}
                      >
                        <Flag id={c.id} colors={c.flag} size={56} />
                        <span class="wiz-flag-name truncate">{lt(c.name)}</span>
                        <span class="wiz-flag-rep" title={t('wizard.reputation')} aria-label={`${t('wizard.reputation')} ${c.reputation}`}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i} class={i < Math.round(c.reputation / 20) ? 'is-on' : ''} />
                          ))}
                        </span>
                        {sel && <span class="wiz-check"><Icon name="check" size={14} weight={3} /></span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {(CITIES[form.nationality] ?? []).length > 0 && (
                <div class="text-field">
                  <label for="wiz-city">{t('wizard.birthCity')}</label>
                  <select
                    id="wiz-city"
                    value={form.birthCity ?? ''}
                    onChange={(e) => set('birthCity', (e.currentTarget as HTMLSelectElement).value || undefined)}
                  >
                    <option value="">{t('wizard.birthCityAuto')}</option>
                    {(CITIES[form.nationality] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p class="t-xs t-lo">{t('wizard.birthCityHint')}</p>
                </div>
              )}
            </div>
          )}

          {cur === 'position' && (
            <div class="wiz-position">
              <PitchPicker
                value={form.position}
                onChange={(p) => setForm((f) => (p === f.position ? f : { ...f, position: p, role: defaultRole(p), heightCm: undefined }))}
              />
              <div class="wiz-position-side stack">
                <div class="wiz-pos-readout">
                  <span class="wiz-pos-big score-font">{t(`data.pos.${form.position}`)}</span>
                  <span class="h3">{t(`data.posLong.${form.position}`)}</span>
                </div>
                <span class="label t-mid">{t('wizard.foot')}</span>
                <Segmented<Foot>
                  label={t('wizard.foot')}
                  value={form.foot}
                  onChange={(f) => set('foot', f)}
                  options={(['L', 'R', 'B'] as Foot[]).map((f) => ({ id: f, label: t(`data.foot.${f}`) }))}
                />
                <p class="t-xs t-lo">{t('wizard.footHint')}</p>
              </div>
            </div>
          )}

          {cur === 'role' && (
            <RolePicker
              position={form.position}
              role={form.role}
              background={form.background}
              gender={gender}
              heightCm={form.heightCm}
              age={age}
              onRole={(r) => setForm((f) => ({ ...f, role: r, heightCm: undefined }))}
              onHeight={(cm) => set('heightCm', clampHeight(form.role, gender, cm))}
            />
          )}

          {cur === 'background' && (
            <div class="wiz-cards wiz-cards-story" role="radiogroup" aria-label={t('wizard.steps.background')}>
              {BACKGROUNDS.map((b) => {
                const sel = form.background === b
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    class={`wiz-card wiz-story wiz-story-${b}${sel ? ' is-active' : ''}`}
                    onClick={() => {
                      haptic('select')
                      set('background', b)
                    }}
                  >
                    <span class="wiz-story-art" aria-hidden="true"><StoryArt kind={b} /><span class="wiz-story-badge"><Icon name={BG_ICON[b]} size={20} /></span></span>
                    <span class="wiz-card-text">
                      <span class="wiz-card-title">{t(`data.background.${b}`)}</span>
                      <span class="wiz-card-desc">{t(`data.backgroundDesc.${b}`)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {cur === 'look' && (
            <AppearanceEditor value={form.appearance} onChange={(a) => set('appearance', a)} shirt={shirt} trim={trim} />
          )}

          {cur === 'summary' && (
            <div class="wiz-summary">
              <div class="wiz-summary-card">
                <PlayerCard
                  name={fullName}
                  ovr={ovr}
                  position={form.position}
                  appearance={form.appearance}
                  stats={stats}
                  flag={{ id: country.id, colors: country.flag }}
                  shirt={shirt}
                  age={age}
                  size="lg"
                />
              </div>
              <div class="stack">
                <dl class="wiz-facts">
                  {([
                    ['summaryName', `${fullName}${form.nickname.trim() ? ` "${form.nickname.trim()}"` : ''} · ${t('common.ageN', { n: age })}`, 0],
                    ['summaryNation', lt(country.name), 1],
                    ...(form.birthCity ? ([['summaryCity', form.birthCity, 1]] as const) : []),
                    ['summaryPos', `${t(`data.posLong.${form.position}`)} · ${t(`data.foot.${form.foot}`)}`, 2],
                    ['summaryStyle', `${t(`data.playRole.${form.role}`)} · ${t('wizard.heightValue', { n: clampHeight(form.role, gender, form.heightCm) })}`, 3],
                    ['summaryStory', t(`data.background.${form.background}`), 4],
                  ] as const).map(([k, v, s]) => (
                    <div key={k} class="wiz-fact">
                      <dt class="micro t-lo">{t(`wizard.${k}`)}</dt>
                      <dd>{v}</dd>
                      <button type="button" class="wiz-edit" onClick={() => go(s)} aria-label={`${t('wizard.edit')}: ${t(`wizard.${k}`)}`}>
                        <Icon name="chevron-right" size={18} />
                      </button>
                    </div>
                  ))}
                </dl>
                {form.legacy && <Chip tone="gold" icon="users">{form.legacy.parentName}</Chip>}
                <Switch checked={!!form.trials} onChange={(v) => set('trials', v)} label={t('meta.trials.wizard')} desc={t('meta.trials.wizardHint')} />
                <span class="label t-mid">{t('wizard.difficulty')}</span>
                <div class="wiz-diffs" role="radiogroup" aria-label={t('wizard.difficulty')}>
                  {DIFFS.map((d) => {
                    const sel = form.difficulty === d
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        class={`wiz-diff wiz-diff-${d}${sel ? ' is-active' : ''}`}
                        onClick={() => {
                          haptic('select')
                          set('difficulty', d)
                        }}
                      >
                        <Icon name={DIFF_ICON[d]} size={20} />
                        <span class="wiz-diff-name">{t(`data.difficulty.${d}`)}</span>
                        <span class="wiz-diff-desc">{t(`data.difficultyDesc.${d}`)}</span>
                      </button>
                    )
                  })}
                </div>
                <CustomDifficultyPanel value={form.custom} base={form.difficulty} onChange={(c) => set('custom', c)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <footer class="wiz-foot">
        <Button variant="ghost" icon="arrow-left" onClick={() => (step > 0 ? go(step - 1) : back('title'))}>
          {step > 0 ? t('common.back') : t('common.cancel')}
        </Button>
        {cur === 'summary' ? (
          <Button variant="primary" size="lg" icon="ball" loading={busy} onClick={start} haptic={false}>
            {busy ? t('wizard.starting') : t('wizard.start')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => go(step + 1)} haptic={false}>
            {t('common.next')}
          </Button>
        )}
      </footer>
    </div>
  )
}

const START_AGES: readonly number[] = Array.from({ length: START_AGE_MAX - START_AGE_MIN + 1 }, (_, i) => START_AGE_MIN + i)

/** Starting-age trade-off (owner feedback): level now vs ceiling and years before the peak. */
function AgeTradeOff({ age, ovr, refOvr }: { age: number; ovr: number; refOvr: number }) {
  const e = startAgeEffect(age)
  const d = ovr - refOvr
  const num = (n: number) => formatNumber(Math.abs(n), undefined, Number.isInteger(n) ? 0 : 1)
  const signed = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(n)}` : '±0')
  const kind = age < REF_START_AGE ? 'young' : age > REF_START_AGE ? 'old' : 'ref'
  return (
    <div class="wiz-age-trade" data-testid="age-trade" aria-live="polite">
      <span class="wiz-age-cell">
        <span class="micro t-lo">{t('wizard.ageStartOvr')}</span>
        <span class="num wiz-age-val">{ovr} <span class={`wiz-age-delta${d > 0 ? ' is-up' : d < 0 ? ' is-down' : ''}`}>{signed(d)}</span></span>
      </span>
      <span class="wiz-age-cell">
        <span class="micro t-lo">{t('wizard.ageCeiling')}</span>
        <span class={`num wiz-age-val${e.potential > 0 ? ' is-up' : e.potential < 0 ? ' is-down' : ''}`}>{signed(e.potential)}</span>
      </span>
      <span class="wiz-age-cell">
        <span class="micro t-lo">{t('wizard.agePeakYears')}</span>
        <span class="num wiz-age-val">{t('wizard.agePeakValue', { n: Math.max(0, PEAK_AGE - age) })}</span>
      </span>
      <span class="wiz-age-note t-xs t-mid">{t(`wizard.ageTrade.${kind}`)}</span>
    </div>
  )
}
