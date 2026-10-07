/**
 * Progressive unlock UI: lock panels with "unlocks at …" messaging, "New!"
 * tags on entry points and a one-time explainer card when a feature opens.
 */
import '../../styles/screens/help.css'
import type { ComponentChildren, FunctionComponent } from 'preact'
import { useEffect } from 'preact/hooks'
import { t } from '../../i18n'
import { Button, Modal, Page, toast } from '../components'
import { Icon, type IconName } from '../icons'
import { gameState } from '../store'
import { features, markFeatureSeen, takeFreshUnlocks, type FeatureId, type FeatureState } from './unlocks'

export const FEATURE_ICON: Record<FeatureId, IconName> = { casino: 'cards', investments: 'chart-line', sponsors: 'handshake', business: 'storefront' }

/** "Unlocks in week 4" / "Unlocks at age 18" for a locked feature (empty when open). */
export function lockText(st: FeatureState): string {
  const r = st.reason
  if (!r) return ''
  if (r.kind === 'age') return t('help.unlock.atAge', { age: r.age })
  return t('help.unlock.atWeek', { week: r.week })
}

/** Longer variant with the countdown. */
export function lockTextLong(st: FeatureState): string {
  const r = st.reason
  if (!r) return ''
  if (r.kind === 'age') return t('help.unlock.inYears', { n: r.yearsLeft, age: r.age })
  return `${t('help.unlock.atWeek', { week: r.week })} · ${t('help.unlock.inWeeks', { n: r.weeksLeft })}`
}

/** Small "New!" pill for menus, tiles and tabs. */
export function NewTag({ feature }: { feature: FeatureId }) {
  if (!features.value[feature].isNew) return null
  return <span class="new-tag" data-new={feature}>{t('help.unlock.newTag')}</span>
}

/** Lock chip for an entry point (tile / button) of a locked feature. */
export function LockChip({ feature }: { feature: FeatureId }) {
  const st = features.value[feature]
  if (st.unlocked) return null
  return (
    <span class="lock-chip" data-locked={feature}>
      <Icon name="lock" size={12} />
      {lockText(st)}
    </span>
  )
}

/**
 * Wrap a feature's content: locked → explanatory lock panel; just unlocked →
 * a one-time explainer card above the content.
 */
export function UnlockGate({ feature, children, compact }: { feature: FeatureId; children: ComponentChildren; compact?: boolean }) {
  const st = features.value[feature]
  const name = t(`help.unlock.feature.${feature}`)
  if (!st.unlocked) {
    return (
      <div class={`unlock-locked${compact ? ' is-compact' : ''}`} role="note" data-locked={feature}>
        <span class="unlock-locked-icon" aria-hidden="true">
          <Icon name={FEATURE_ICON[feature]} size={compact ? 22 : 30} />
          <span class="unlock-locked-lock"><Icon name="lock" size={14} /></span>
        </span>
        <div class="unlock-locked-text">
          <h3 class="h3">{t('help.unlock.lockedTitle', { feature: name })}</h3>
          <p class="t-sm t-mid">{t('help.unlock.lockedBody')}</p>
          <p class="unlock-when"><Icon name="clock" size={14} /> {lockTextLong(st)}</p>
        </div>
      </div>
    )
  }
  return (
    <>
      {st.isNew && (
        <aside class="unlock-explainer" aria-labelledby={`unlock-${feature}-title`} data-explainer={feature}>
          <span class="unlock-explainer-icon" aria-hidden="true"><Icon name={FEATURE_ICON[feature]} size={26} /></span>
          <div class="unlock-explainer-text">
            <div class="row">
              <span class="new-tag">{t('help.unlock.newTag')}</span>
              <h3 class="h3" id={`unlock-${feature}-title`}>{name}</h3>
            </div>
            <p class="t-sm">{t(`help.unlock.explain.${feature}`)}</p>
          </div>
          <Button size="sm" variant="primary" icon="check" onClick={() => markFeatureSeen(feature)}>{t('help.unlock.gotIt')}</Button>
        </aside>
      )}
      {children}
    </>
  )
}

/** Announce features that just unlocked (toast), once per career. Mount once in App. */
export function UnlockNotifier() {
  const s = gameState.value
  const key = s ? `${s.calendar.season}-${s.calendar.week}` : ''
  useEffect(() => {
    if (!s) return
    for (const id of takeFreshUnlocks()) {
      toast(t('help.unlock.unlockedToast', { feature: t(`help.unlock.feature.${id}`) }), 'reward', FEATURE_ICON[id], 4200)
    }
  }, [key])
  return null
}

/** One-time explainer card shown as a dialog the first time an unlocked screen opens. */
function ExplainerDialog({ feature }: { feature: FeatureId }) {
  const close = () => markFeatureSeen(feature)
  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title={<span class="row"><span class="new-tag">{t('help.unlock.newTag')}</span> {t(`help.unlock.feature.${feature}`)}</span>}
      footer={<Button variant="primary" block icon="check" onClick={close}>{t('help.unlock.gotIt')}</Button>}
    >
      <div class="unlock-dialog" data-explainer={feature}>
        <span class="unlock-explainer-icon" aria-hidden="true"><Icon name={FEATURE_ICON[feature]} size={26} /></span>
        <p class="t-mid">{t(`help.unlock.explain.${feature}`)}</p>
      </div>
    </Modal>
  )
}

/**
 * Wrap a whole screen: still week-locked → lock page with "unlocks at …";
 * otherwise the screen (age locks stay with the screen itself) plus the
 * one-time explainer the first time it is opened after unlocking.
 */
export function gated(feature: FeatureId, Comp: FunctionComponent): FunctionComponent {
  function Gated() {
    const st = features.value[feature]
    if (st.reason?.kind === 'week') {
      return (
        <Page title={t(`help.unlock.feature.${feature}`)} showBack backTo="life">
          <UnlockGate feature={feature}>{null}</UnlockGate>
        </Page>
      )
    }
    return (
      <>
        <Comp />
        {st.isNew && <ExplainerDialog feature={feature} />}
      </>
    )
  }
  return Gated
}
