/** Career sweep (S21): market value formula, OVR breakdown, drill rule texts. */
import type { Shape } from '../shape'

export const tr = {
  value: {
    title: 'Piyasa değerin',
    base: 'GEN tabanı',
    parts: { ovr: 'GEN', potential: 'Potansiyel', age: 'Yaş', reputation: 'İtibar', form: 'Form', contract: 'Son yıl' },
    total: 'Toplam: {v}',
  },
}

export const en: Shape<typeof tr> = {
  value: {
    title: 'Your market value',
    base: 'OVR base',
    parts: { ovr: 'OVR', potential: 'Potential', age: 'Age', reputation: 'Reputation', form: 'Form', contract: 'Final year' },
    total: 'Total: {v}',
  },
}
