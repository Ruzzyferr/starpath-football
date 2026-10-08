import { useState } from 'preact/hooks'
import { t } from '../../../i18n'
import { ovrBreakdown } from '../../../sim/game/ovrBreakdown'
import { Button, Modal } from '../../components'
import { formatPercent } from '../../format'
import { gameState } from '../../store'

/** 2.3#11: opens the position-weight table behind the OVR number. */
export function OvrExplainer() {
  const [open, setOpen] = useState(false)
  const s = gameState.value
  if (!s) return null
  const h = s.hero
  const b = ovrBreakdown(h.attrs, h.position)
  return (
    <>
      <Button size="sm" variant="ghost" icon="info" onClick={() => setOpen(true)} data-testid="ovr-explain-btn">{t('profile.ovrExplain.button')}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('profile.ovrExplain.title', { pos: t(`data.pos.${h.position}`) })} size="md" class="ovr-explain">
        <p class="t-mid">{t('profile.ovrExplain.intro', { ovr: b.ovr })}</p>
        <table class="ovr-table" data-testid="ovr-table">
          <thead>
            <tr>
              <th scope="col">{t('profile.ovrExplain.attr')}</th>
              <th scope="col">{t('profile.ovrExplain.weight')}</th>
              <th scope="col">{t('profile.ovrExplain.value')}</th>
              <th scope="col">{t('profile.ovrExplain.points')}</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{t(`data.attr.${r.key}`)}</th>
                <td class="num">
                  <span class="ovr-bar" aria-hidden="true"><span style={{ width: `${Math.round(r.share * 100 * 4)}%`, maxWidth: '100%' }} /></span>
                  {formatPercent(r.share)}
                </td>
                <td class="num">{r.value}</td>
                <td class="num">{r.points.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>{t('profile.ovrExplain.total')}</th>
              <td class="num"><b>{b.ovr}</b></td>
            </tr>
          </tfoot>
        </table>
        <p class="t-xs t-lo">{t('profile.ovrExplain.note')}</p>
      </Modal>
    </>
  )
}
