import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import '../../styles/screens/settings.css'
import { t } from '../../i18n'
import { formatNumber } from '../format'
import { Button, Card, Modal, Page, Segmented, Slider, Switch, toast } from '../components'
import { Icon, type IconName } from '../icons'
import { AudioMixerPanel } from '../../audio/ui/AudioMixerPanel'
import { actions, detectQuality, effectiveQuality, gameState, settings, updateSettings } from '../store'
import type { CameraDistanceChoice } from '../../game/view'
import type { QualityChoice, QualityProfile } from '../../game/quality'
import { HelpSettings } from '../tutorial/HelpSettings'
import { KeyBindingsPanel } from './settings/KeyBindingsPanel'
import { PurchasesPanel } from './store/PurchasesPanel'
import { LegalLinks } from './store/LegalLinks'
import { CASINO_BUILD } from '../../core/contentFlags'
import { buildDataExport, wipeLocalData } from '../../state/privacy'
import { ErrorReportPanel } from '../../telemetry/ErrorReportPanel'
import type { ColorblindMode } from '../store'
import { ASSIST_REWARD } from '../../sim/match/rating'
import { clearWebglBroken, isWebglBroken } from '../../game/renderGuard'
import { DiagnosticsPanel } from '../../telemetry/DiagnosticsPanel'
import { setSoftwareMode, softwareModeState } from '../../platform/renderMode'
import { detectPlatform } from '../../platform/detect'

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

function qualityLabel(p: QualityProfile): string {
  return p === 'low' ? t('settings.qLow') : p === 'medium' ? t('settings.qMedium') : t('settings.qHigh')
}

export function SettingsScreen() {
  const s = settings.value
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [webglOff, setWebglOff] = useState(isWebglBroken)
  const [compat, setCompat] = useState(softwareModeState)

  const doExportAll = async () => {
    setBusy(true)
    try {
      const saves: Record<string, string> = {}
      for (const slot of [1, 2, 3]) {
        try { saves[`slot${slot}`] = await actions.exportSave(slot) } catch { /* empty slot */ }
      }
      const data = buildDataExport(localStorage, saves)
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'starpath-my-data.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(t('settings.exportedAll'), 'success', 'download')
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    setBusy(true)
    try {
      await actions.resetAll()
      await wipeLocalData() // settings, key bindings, achievements, logs, offline cache: really everything
      toast(t('settings.resetDone'), 'success')
      setConfirm(false)
      // Reload so in-memory settings/meta cannot write the old values back.
      setTimeout(() => location.reload(), 700)
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

        <Group title={t('settings.gameSection')} icon="trophy">
          <Field label={t('settings.moneyStyle')} hint={t('settings.moneyStyleDesc')}>
            <Segmented
              label={t('settings.moneyStyle')}
              value={s.moneyStyle}
              onChange={(moneyStyle) => updateSettings({ moneyStyle })}
              options={[
                { id: 'symbol', label: t('settings.moneySymbol') },
                { id: 'code', label: t('settings.moneyCode') },
                { id: 'star', label: t('settings.moneyStar') },
              ]}
            />
          </Field>
          <Field label={t('settings.eventTransparency')} hint={t('settings.eventTransparencyDesc')}>
            <Segmented
              label={t('settings.eventTransparency')}
              value={s.eventTransparency}
              onChange={(eventTransparency) => updateSettings({ eventTransparency })}
              options={[
                { id: 'full', label: t('settings.transFull') },
                { id: 'direction', label: t('settings.transDirection') },
              ]}
            />
          </Field>
          <Field label={t('settings.partnerPref')} hint={t('settings.partnerPrefDesc')}>
            <Segmented
              label={t('settings.partnerPref')}
              value={s.partnerPref}
              onChange={(partnerPref) => updateSettings({ partnerPref })}
              options={[
                { id: 'any', label: t('settings.partnerAny') },
                { id: 'women', label: t('settings.partnerWomen') },
                { id: 'men', label: t('settings.partnerMen') },
              ]}
            />
          </Field>
          <Switch label={t('settings.autosave')} desc={t('settings.autosaveDesc')} checked={s.autosave !== false} onChange={(autosave) => updateSettings({ autosave })} />
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
                { id: 'full', label: `${t('settings.aimFull')} ×${formatNumber(ASSIST_REWARD.full, undefined, 2)}` },
                { id: 'half', label: `${t('settings.aimHalf')} ×${formatNumber(ASSIST_REWARD.half, undefined, 2)}` },
                { id: 'manual', label: `${t('settings.aimManual')} ×${formatNumber(ASSIST_REWARD.manual, undefined, 2)}` },
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
          <Field label={t('settings.theme')} hint={t('settings.themeDesc')}>
            <Segmented<'dark' | 'light' | 'system'>
              label={t('settings.theme')}
              value={s.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { id: 'dark', label: t('settings.themeDark') },
                { id: 'light', label: t('settings.themeLight') },
                { id: 'system', label: t('settings.themeSystem') },
              ]}
            />
          </Field>
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
          {CASINO_BUILD && <Switch label={t('settings.hideCasino')} desc={t('settings.hideCasinoDesc')} checked={s.hideCasino} onChange={(hideCasino) => updateSettings({ hideCasino })} />}
          <Switch label={t('settings.highContrast')} desc={t('settings.highContrastDesc')} checked={s.highContrast} onChange={(highContrast) => updateSettings({ highContrast })} />
          <Switch label={t('settings.matchDecisions')} desc={t('settings.matchDecisionsDesc')} checked={s.matchDecisions !== false} onChange={(matchDecisions) => updateSettings({ matchDecisions })} />
          <Switch label={t('settings.reducedMotion')} desc={t('settings.reducedMotionDesc')} checked={s.reducedMotion} onChange={(reducedMotion) => updateSettings({ reducedMotion })} />
          <Switch label={t('settings.soundCaptions')} desc={t('settings.soundCaptionsDesc')} checked={s.soundCaptions} onChange={(soundCaptions) => updateSettings({ soundCaptions })} />
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

        <Group title={t('settings.sections.graphics')} icon="sliders">
          <div data-testid="quality-setting">
            <Field label={t('settings.quality')} hint={t('settings.qualityDesc')}>
              <Segmented<QualityChoice>
                label={t('settings.quality')}
                value={s.quality}
                onChange={(quality) => updateSettings({ quality })}
                options={[
                  { id: 'auto', label: t('settings.qAuto') },
                  { id: 'low', label: t('settings.qLow') },
                  { id: 'medium', label: t('settings.qMedium') },
                  { id: 'high', label: t('settings.qHigh') },
                ]}
              />
            </Field>
            <div class="row-between set-quality-auto">
              <span class="t-xs t-mid" data-testid="quality-detected" data-profile={effectiveQuality(s)}>
                {s.qualityAuto ? t('settings.qualityDetected', { p: qualityLabel(s.qualityAuto) }) : t('settings.qualityNotMeasured')}
              </span>
              <Button size="sm" variant="ghost" icon="stopwatch" onClick={() => { clearWebglBroken(); setWebglOff(false); toast(t('settings.qualityDetected', { p: qualityLabel(detectQuality()) }), 'success') }}>
                {t('settings.qualityRedetect')}
              </Button>
            </div>
            {s.quality === 'low' && <p class="t-xs t-mid" data-testid="quality-canvas">{t('settings.qualityLowCanvas')}</p>}
            {webglOff && <p class="t-xs t-mid" data-testid="webgl-off">{t('settings.webglOff')}</p>}
          </div>
          <div data-testid="compat-setting">
            <Switch
              label={t('settings.compatMode')}
              desc={t('settings.compatModeDesc')}
              checked={compat.on}
              onChange={(on) => {
                const wasLayer = compat.layer === true
                void setSoftwareMode(on).then(() => {
                  setCompat(softwareModeState())
                  if (wasLayer && !on) toast(t('settings.compatRestart'), 'info', 'info', 6000)
                })
              }}
            />
            {compat.on && compat.auto && <p class="t-xs t-mid" data-testid="compat-auto">{t('settings.compatAuto')}</p>}
            {compat.on && detectPlatform() === 'android' && (
              <Switch
                label={t('settings.compatLayer')}
                desc={t('settings.compatLayerDesc')}
                checked={compat.layer === true}
                onChange={(layer) => {
                  void setSoftwareMode(true, { layer }).then(() => {
                    setCompat(softwareModeState())
                    toast(t('settings.compatRestart'), 'info', 'info', 6000)
                  })
                }}
              />
            )}
          </div>
          <div data-testid="camera-setting">
            <Field label={t('settings.camera')} hint={t('settings.cameraDesc')}>
              <Segmented<CameraDistanceChoice>
                label={t('settings.camera')}
                value={s.cameraDistance}
                onChange={(cameraDistance) => updateSettings({ cameraDistance })}
                options={[
                  { id: 'auto', label: t('settings.qAuto') },
                  { id: 'far', label: t('settings.camFar') },
                  { id: 'normal', label: t('settings.camNormal') },
                  { id: 'close', label: t('settings.camClose') },
                ]}
              />
            </Field>
          </div>
          <Switch label={t('settings.reduceFlashes')} desc={t('settings.reduceFlashesDesc')} checked={s.reduceFlashes} onChange={(reduceFlashes) => updateSettings({ reduceFlashes })} />
          <p class="t-xs t-lo">{t('settings.qualityFlashNote')}</p>
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
          <Field label={t('settings.touchShot')} hint={t('settings.touchShotDesc')}>
            <Segmented
              label={t('settings.touchShot')}
              value={s.touchShot}
              onChange={(touchShot) => updateSettings({ touchShot })}
              options={[
                { id: 'swipe', label: t('settings.shotSwipe') },
                { id: 'slingshot', label: t('settings.shotSling') },
                { id: 'meter', label: t('settings.shotMeter') },
              ]}
            />
          </Field>
          <Field label={t('settings.pcPower')} hint={t('settings.pcPowerDesc')}>
            <Segmented
              label={t('settings.pcPower')}
              value={s.pcPower}
              onChange={(pcPower) => updateSettings({ pcPower })}
              options={[
                { id: 'hold', label: t('settings.powerHold') },
                { id: 'oscillate', label: t('settings.powerOsc') },
              ]}
            />
          </Field>
          <Field label={t('settings.padPower')} hint={t('settings.padPowerDesc')}>
            <Segmented
              label={t('settings.padPower')}
              value={s.padPower}
              onChange={(padPower) => updateSettings({ padPower })}
              options={[
                { id: 'hold', label: t('settings.powerHold') },
                { id: 'oscillate', label: t('settings.powerOsc') },
                { id: 'analog', label: t('settings.powerAnalog') },
              ]}
            />
          </Field>
          <Slider
            label={t('settings.padDeadzone')}
            value={Math.round(s.padDeadzone * 100)}
            min={5}
            max={40}
            step={1}
            onChange={(v) => updateSettings({ padDeadzone: v / 100 })}
            format={(v) => `${v}%`}
            id="set-deadzone"
          />
          <Switch label={t('settings.visionHints')} desc={t('settings.visionHintsDesc')} checked={s.visionHints} onChange={(visionHints) => updateSettings({ visionHints })} />
          <Switch label={t('settings.timingAssist')} desc={t('settings.timingAssistDesc')} checked={s.timingAssist} onChange={(timingAssist) => updateSettings({ timingAssist })} />
          <h3 class="h3">{t('settings.ctl.title')}</h3>
          <KeyBindingsPanel />
        </Group>

        <Group title={t('help.settings.title')} icon="question">
          <HelpSettings />
        </Group>

        <Group title={t('iap.panel.title')} icon="star">
          <PurchasesPanel />
        </Group>

        <Group title={t('settings.sections.privacy')} icon="shield">
          <ul class="set-privacy" data-testid="privacy-section">
            <li class="t-sm t-mid">{t('settings.privacyLocal')}</li>
            <li class="t-sm t-mid">{t('settings.privacyNoTracking')}</li>
            <li class="t-sm t-mid">{t('settings.privacyErrors')}</li>
            <li class="t-sm t-mid">{t('settings.privacyExport')}</li>
          </ul>
        </Group>

        <Group title={t('settings.sections.cloud')} icon="upload">
          <div class="col" data-testid="cloud-section">
            <span class="set-soon">{t('settings.comingSoon')}</span>
            <p class="t-sm t-mid">{t('settings.cloudDesc')}</p>
            <div>
              <Button variant="ghost" icon="lock" disabled>
                {t('settings.cloudSignIn')}
              </Button>
            </div>
          </div>
        </Group>

        <Group title={t('settings.sections.diagnostics')} icon="stopwatch">
          <DiagnosticsPanel />
        </Group>

        <Group title={t('settings.sections.about')} icon="info">
          <ErrorReportPanel />
          <LegalLinks />
        </Group>

        <Group title={t('settings.sections.data')} icon="floppy">
          <p class="t-sm t-mid">{t('settings.exportAllDesc')}</p>
          <div>
            <Button variant="ghost" icon="download" loading={busy} onClick={() => void doExportAll()} data-testid="export-all">
              {t('settings.exportAll')}
            </Button>
          </div>
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
