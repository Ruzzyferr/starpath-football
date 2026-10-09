import '../../../styles/screens/legacy.css'
import { useState } from 'preact/hooks'
import { currentLang, t } from '../../../i18n'
import { Avatar, Button, Modal, Page, Segmented, Switch } from '../../components'
import { gameState, navigate } from '../../store'
import type { PostCareerPath } from '../../../sim/game/hallOfFame'
import { continueCareer, retireNow, retirementView } from '../../backend/meta'

/**
 * The yearly "continue or retire" decision card (from 33), the forced
 * retirement (age 40 / career-ending injury) and the any-time retirement
 * from the Profile (with confirmation). Optional testimonial match.
 */
export function RetireScreen() {
  void currentLang.value
  const s = gameState.value
  const st = retirementView()
  const [testimonial, setTestimonial] = useState(true)
  const [path, setPath] = useState<PostCareerPath | 'none'>('none')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!s || !st) return null
  const h = s.hero

  if (h.retired) {
    return (
      <Page title={t('meta.retire.retired')} backTo="profile">
        <Button variant="primary" block icon="play" onClick={() => navigate('documentary', undefined, { replace: true })}>{t('meta.retire.viewDoc')}</Button>
      </Page>
    )
  }

  const decision = st.decisionDue
  const lead = st.forced === 'age' ? t('meta.retire.forcedAge', { a: st.age }) : st.forced === 'injury' ? t('meta.retire.forcedInjury') : t('meta.retire.sub', { a: st.age })
  const doRetire = () => {
    setBusy(true)
    const sum = retireNow({ testimonial, ...(path !== 'none' ? { postCareer: path } : {}) })
    setBusy(false)
    setConfirm(false)
    if (sum) navigate('documentary', undefined, { tab: true })
  }
  const stay = () => {
    continueCareer()
    navigate('home', undefined, { tab: true })
  }

  return (
    <Page title={decision ? t('meta.retire.title') : t('meta.retire.anytime')} showBack={!decision} backTo="profile" class="ret-page">
      <div class="ret-card" data-testid="retire-card">
        <div class="row" style={{ gap: '14px', alignItems: 'center' }}>
          <Avatar appearance={h.appearance} size={64} />
          <div class="stack" style={{ gap: '4px' }}>
            <div class="h2">{h.firstName} {h.lastName}</div>
            <div class="t-sm t-mid">{t('meta.retire.stats', { a: h.careerStats.apps, g: h.careerStats.goals, as: h.careerStats.assists })}</div>
          </div>
        </div>
        {(decision || st.canRetire || st.forced) && <p class="t-mid">{decision ? lead : t('meta.retire.anytimeHint')}</p>}
        {!st.canRetire && !st.forced && <p class="lg-warn t-sm">{t('meta.retire.tooYoung')}</p>}

        {(st.canRetire || st.forced) && (
          <div class="ret-choice">
            <Switch checked={testimonial} onChange={setTestimonial} label={t('meta.retire.testimonial')} desc={t('meta.retire.testimonialHint')} />
            <div class="stack" style={{ gap: '6px' }} data-testid="retire-path">
              <span class="t-sm">{t('meta.retire.pathTitle')}</span>
              <Segmented
                label={t('meta.retire.pathTitle')}
                value={path}
                onChange={setPath}
                options={[
                  { id: 'none', label: t('meta.retire.pathNone') },
                  { id: 'coach', label: t('meta.retire.pathCoach') },
                  { id: 'pundit', label: t('meta.retire.pathPundit') },
                  { id: 'ambassador', label: t('meta.retire.pathAmbassador') },
                ]}
              />
              <span class="t-xs t-lo">{t('meta.retire.pathHint')}</span>
            </div>
            <Button variant="gold" block icon="crown" onClick={() => setConfirm(true)} data-testid="retire-go">{t('meta.retire.go')}</Button>
            <span class="t-xs t-lo">{t('meta.retire.goHint')}</span>
          </div>
        )}
        {decision && !st.forced && (
          <div class="ret-choice">
            <Button variant="primary" block icon="fire" onClick={stay} data-testid="retire-stay">{t('meta.retire.stay')}</Button>
            <span class="t-xs t-lo">{t('meta.retire.stayHint')}</span>
          </div>
        )}
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('meta.retire.confirmTitle')}
        size="sm"
        footer={
          <div class="row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" loading={busy} onClick={doRetire} data-testid="retire-confirm">{t('meta.retire.confirm')}</Button>
          </div>
        }
      >
        <p>{t('meta.retire.confirmBody')}</p>
      </Modal>
    </Page>
  )
}
