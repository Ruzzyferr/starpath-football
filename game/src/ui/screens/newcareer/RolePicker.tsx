/**
 * Wizard role step (owner feedback): only the chosen position's roles, each with its key strengths and
 * weaknesses; a live preview of the starting values, the suggested perk and the height slider.
 */
import type { Background, Gender, Position, Role } from '../../../core/types'
import { POSITION_ROLES, ROLE_PERK, defaultRole, heightRange } from '../../../core/roles'
import { PERK_BY_ID } from '../../../data/perks'
import { lt, t } from '../../../i18n'
import { Slider, StatBar } from '../../components'
import { haptic } from '../../haptics'
import { Icon } from '../../icons'
import { ROLE_ICON, roleKeys, rolePreview, type RoleStat } from '../../roleView'

/** Live preview bars with the difference to the position average (inline in the picked card on phones, side panel on desktop). */
function RoleStats({ stats, cls }: { stats: RoleStat[]; cls: string }) {
  return (
    <span class={cls} aria-live="polite">
      {stats.map((s) => (
        <span key={s.key} class="wiz-role-stat">
          <StatBar label={t(`data.attr.${s.key}`)} value={s.value} max={80} scale size="sm" />
          <span
            class={`wiz-role-delta num ${s.delta > 0 ? 'is-up' : s.delta < 0 ? 'is-down' : ''}`}
            aria-label={`${s.delta > 0 ? t('wizard.roleStrong') : s.delta < 0 ? t('wizard.roleWeak') : ''} ${s.delta > 0 ? '+' : ''}${s.delta}`}
          >
            {s.delta > 0 ? `+${s.delta}` : s.delta < 0 ? `−${Math.abs(s.delta)}` : '±0'}
          </span>
        </span>
      ))}
    </span>
  )
}

export function RolePicker({ position, role, background, gender, heightCm, onRole, onHeight }: {
  position: Position
  role: Role
  background: Background
  gender: Gender
  heightCm: number | undefined
  onRole: (r: Role) => void
  onHeight: (cm: number) => void
}) {
  const roles = POSITION_ROLES[position]
  const stats = rolePreview(position, role, background)
  const range = heightRange(role, gender)
  const height = heightCm ?? range.def
  const perk = PERK_BY_ID[ROLE_PERK[role]]
  return (
    <div class="wiz-role">
      <p class="t-sm t-mid wiz-role-intro">{t('wizard.roleIntro', { pos: t(`data.posLong.${position}`) })}</p>
      <div class="wiz-cards wiz-role-cards" role="radiogroup" aria-label={t('wizard.steps.role')} data-testid="role-cards">
        {roles.map((r) => {
          const sel = r === role
          const keys = roleKeys(r, position)
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={sel}
              data-role={r}
              class={`wiz-card wiz-role-card${sel ? ' is-active' : ''}`}
              onClick={() => {
                haptic('select')
                onRole(r)
              }}
            >
              <span class="wiz-card-icon"><Icon name={ROLE_ICON[r]} size={26} /></span>
              <span class="wiz-card-text">
                <span class="wiz-card-title">
                  {t(`data.playRole.${r}`)}
                  {r === defaultRole(position) && <span class="chip chip-pos chip-solid">{t('wizard.suggested')}</span>}
                </span>
                <span class="wiz-card-desc">{t(`data.playRoleDesc.${r}`)}</span>
                <span class="wiz-role-keys">
                  {keys.strong.map((k) => (
                    <span key={k} class="wiz-role-key is-strong" title={`${t('wizard.roleStrong')}: ${t(`data.attr.${k}`)}`}>
                      <Icon name="chevron-up" size={12} weight={3} />
                      {t(`data.attrShort.${k}`)}
                    </span>
                  ))}
                  {keys.weak.map((k) => (
                    <span key={k} class="wiz-role-key is-weak" title={`${t('wizard.roleWeak')}: ${t(`data.attr.${k}`)}`}>
                      <Icon name="chevron-down" size={12} weight={3} />
                      {t(`data.attrShort.${k}`)}
                    </span>
                  ))}
                </span>
              </span>
              {sel && <RoleStats stats={stats} cls="wiz-role-stats is-inline" />}
              {sel && <span class="wiz-check"><Icon name="check" size={14} weight={3} /></span>}
            </button>
          )
        })}
      </div>

      <section class="wiz-role-panel" aria-label={t('wizard.rolePreview')} data-testid="role-preview">
        <header class="wiz-role-panel-head">
          <span class="wiz-role-badge"><Icon name={ROLE_ICON[role]} size={20} /></span>
          <span class="grow">
            <span class="micro t-lo">{t('wizard.rolePicked')}</span>
            <span class="wiz-role-name">{t(`data.playRole.${role}`)}</span>
          </span>
        </header>
        <RoleStats stats={stats} cls="wiz-role-stats is-panel" />
        {perk && (
          <div class="wiz-role-perk" title={lt(perk.desc)}>
            <span class="micro t-lo">{t('wizard.rolePerk')}</span>
            <span class="wiz-role-perk-name"><span aria-hidden="true">{perk.icon}</span> {lt(perk.name)}</span>
          </div>
        )}
        <Slider
          id="wiz-height"
          label={t('wizard.height')}
          value={height}
          min={range.min}
          max={range.max}
          marker={range.def}
          onChange={onHeight}
          format={(v) => t('wizard.heightValue', { n: v })}
        />
        <p class="t-xs t-lo">{t('wizard.heightHint')}</p>
      </section>
    </div>
  )
}
