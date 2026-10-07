import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import '../../styles/screens/settings.css'
import { t } from '../../i18n'
import { Button, Card, Modal, Page, Segmented, Slider, Switch, toast } from '../components'
import { Icon, type IconName } from '../icons'
import { AudioMixerPanel } from '../../audio/ui/AudioMixerPanel'
import { actions, gameState, navigate, settings, updateSettings } from '../store'
import { HelpSettings } from '../tutorial/HelpSettings'
import { KeyBindingsPanel } from './settings/KeyBindingsPanel'
import { PurchasesPanel } from './store/PurchasesPanel'
import { ErrorReportPanel } from '../../telemetry/ErrorReportPanel'
import type { ColorblindMode } from '../store'

function Group({ title, icon, children }: { title: string; icon: IconName; children: ComponentChildren }) {
  return (
    <Card class="set-group" pad="none">
      <div class="set-group-head">
        <Icon name={icon} size={18} />
        <h2 class="h3">{title}</h2>
      </div>
      <div class="set-group-body">{children}</div>
    </Card>
  )
}

function Field({ label, children, hint }: { label: string; children: ComponentChildren; hint?: string }) {
  return (
    <div class="set-field">
      <span class="set-field-label">{label}</span>
      {children}
      {hint && <span class="t-xs t-lo">{hint}</span>}
    </div>
  )
}

export function SettingsScreen() {
  const s = settings.value
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const doReset = async () => {
    setBusy(true)
    try {
      await actions.resetAll()
      toast(t('settings.resetDone'), 'success')
      setConfirm(false)
      navigate('title', undefined, { tab: true })
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={t('settings.title')} sub={t('settings.sub')} backTo={gameState.value ? 'menu' : 'title'} showBack>
      <div class="set-grid">
        <Group title={t('settings.sections.general')} icon="language">
          <Field label={t('settings.language')}>
            <Segmented
              label={t('settings.language')}
              value={s.lang}
              onChange={(lang) => updateSettings({ lang })}
              options={[
                { id: 'tr', label: t('settings.langTr') },
                { id: 'en', label: t('settings.langEn') },
              ]}
            />
          </Field>
        </Group>

        <Group title={t('settings.sections.audio')} icon="speaker">
          <AudioMixerPanel />
          <Switch label={t('settings.vibration')} desc={t('settings.vibrationDesc')} checked={s.vibration} onChange={(vibration) => updateSettings({ vibration })} />
        </Group>

        <Group title={t('settings.sections.match')} icon="ball">
          <Field label={t('settings.aimAssist')} hint={t('settings.aimDesc')}>
            <Segmented
              label={t('settings.aimAssist')}
              value={s.aimAssist}
              onChange={(aimAssist) => updateSettings({ aimAssist })}
              options={[
                { id: 'full', label: t('settings.aimFull') },
                { id: 'half', label: t('settings.aimHalf') },
                { id: 'manual', label: t('settings.aimManual') },
              ]}
            />
          </Field>
          <Switch label={t('settings.slowMo')} desc={t('settings.slowMoDesc')} checked={s.slowMoAim} onChange={(slowMoAim) => updateSettings({ slowMoAim })} />
          <Field label={t('settings.matchSpeed')}>
            <Segmented<1 | 2 | 4>
              label={t('settings.matchSpeed')}
              value={s.matchSpeed}
              onChange={(matchSpeed) => updateSettings({ matchSpeed })}
              options={[
                { id: 1, label: '1×' },
                { id: 2, label: '2×' },
                { id: 4, label: '4×' },
              ]}
            />
          </Field>
        </Group>

        <Group title={t('settings.sections.access')} icon="eye">
          <Field label={t('settings.cbMode')} hint={t('settings.cbModeDesc')}>
            <Segmented<ColorblindMode>
              label={t('settings.cbMode')}
              value={s.cbMode !== 'off' ? s.cbMode : s.colorblind ? 'deuteranopia' : 'off'}
              onChange={(cbMode) => updateSettings({ cbMode, colorblind: cbMode !== 'off' })}
              options={[
                { id: 'off', label: t('settings.cbOff') },
                { id: 'protanopia', label: t('settings.cbProtan') },
                { id: 'deuteranopia', label: t('settings.cbDeutan') },
                { id: 'tritanopia', label: t('settings.cbTritan') },
              ]}
            />
          </Field>
          <Switch label={t('settings.hideCasino')} desc={t('settings.hideCasinoDesc')} checked={s.hideCasino} onChange={(hideCasino) => updateSettings({ hideCasino })} />
          <Switch label={t('settings.highContrast')} desc={t('settings.highContrastDesc')} checked={s.highContrast} onChange={(highContrast) => updateSettings({ highContrast })} />
          <Switch label={t('settings.reducedMotion')} desc={t('settings.reducedMotionDesc')} checked={s.reducedMotion} onChange={(reducedMotion) => updateSettings({ reducedMotion })} />
          <Switch label={t('settings.lowFx')} desc={t('settings.lowFxDesc')} checked={s.lowFx} onChange={(lowFx) => updateSettings({ lowFx })} />
          <Slider
            label={t('settings.textSize')}
            value={Math.round(s.textScale * 100)}
            min={90}
            max={200}
            step={5}
            onChange={(v) => updateSettings({ textScale: v / 100 })}
            format={(v) => `${v}%`}
            id="set-text"
          />
          <p class="set-preview">{t('settings.textPreview')}</p>
        </Group>

        <Group title={t('settings.sectionControls')} icon="keyboard">
          <Switch label={t('settings.leftHanded')} desc={t('settings.leftHandedDesc')} checked={s.leftHanded} onChange={(leftHanded) => updateSettings({ leftHanded })} />
          <Switch label={t('settings.oneHand')} desc={t('settings.oneHandDesc')} checked={s.oneHand} onChange={(oneHand) => updateSettings({ oneHand })} />
          <Slider
            label={t('settings.touchScale')}
            value={Math.round(s.touchScale * 100)}
            min={80}
            max={150}
            step={10}
            onChange={(v) => updateSettings({ touchScale: v / 100 })}
            format={(v) => `${v}%`}
            id="set-touch"
          />
          <h3 class="h3">{t('settings.ctl.title')}</h3>
          <KeyBindingsPanel />
        </Group>

        <Group title={t('help.settings.title')} icon="question">
          <HelpSettings />
        </Group>

        <Group title={t('iap.panel.title')} icon="star">
          <PurchasesPanel />
        </Group>

        <Group title={t('settings.sections.about')} icon="info">
          <ErrorReportPanel />
        </Group>

        <Group title={t('settings.sections.data')} icon="floppy">
          <p class="t-sm t-mid">{t('settings.resetDesc')}</p>
          <div>
            <Button variant="danger" icon="trash" onClick={() => setConfirm(true)} haptic="warning">
              {t('settings.reset')}
            </Button>
          </div>
        </Group>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('settings.resetConfirmTitle')}
        size="sm"
        footer={
          <div class="row-between set-modal-foot">
            <Button variant="ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon="trash" loading={busy} onClick={() => void doReset()} haptic="heavy">
              {t('settings.resetConfirm')}
            </Button>
          </div>
        }
      >
        <p class="t-mid">{t('settings.resetConfirmText')}</p>
      </Modal>
    </Page>
  )
}
