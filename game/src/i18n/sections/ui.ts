/** Strings used by shared components (ui/components, ui/layout). */
import type { Shape } from '../shape'

export const tr = {
  table: {
    pos: '#', club: 'Kulüp', p: 'O', w: 'G', d: 'B', l: 'M', gf: 'AG', ga: 'YG', gd: 'AV', pts: 'P', form: 'Form',
    caption: '{league} puan durumu',
  },
  zone: { promo: 'Şampiyonluk / Yükselme', euro: 'Kıtasal kupa', playoff: 'Play-off', releg: 'Küme düşme' },
  uncertain: 'belirsiz',
  dialog: 'İletişim kutusu',
  toastClose: 'Bildirimi kapat',
  tierCard: '{tier} kart',
  ovrLabel: 'Genel {n}',
  you: 'Sen',
  relation: { great: 'Çok iyi', good: 'İyi', neutral: 'Nötr', poor: 'Kötü', hostile: 'Düşmanca' },
  slider: { decrease: 'Azalt', increase: 'Arttır' },
  change: 'Değişim',
  skeleton: 'İçerik yükleniyor',
  sparkline: 'Son {n} değer',
  noForm: 'Henüz maç yok',
  topbar: { money: 'Para', energy: 'Enerji', happiness: 'Mutluluk', date: 'Tarih', events: 'Bekleyen kararlar' },
  ctx: { nextMatch: 'Sıradaki maç', quickStats: 'Hızlı bakış', decisions: 'Kararlar', noMatch: 'Planlı maç yok', form: 'Form', trust: 'TD güveni' },
}

export const en: Shape<typeof tr> = {
  table: {
    pos: '#', club: 'Club', p: 'P', w: 'W', d: 'D', l: 'L', gf: 'GF', ga: 'GA', gd: 'GD', pts: 'Pts', form: 'Form',
    caption: '{league} standings',
  },
  zone: { promo: 'Title / Promotion', euro: 'Continental cup', playoff: 'Play-off', releg: 'Relegation' },
  uncertain: 'uncertain',
  dialog: 'Dialog',
  toastClose: 'Dismiss notification',
  tierCard: '{tier} card',
  ovrLabel: 'Overall {n}',
  you: 'You',
  relation: { great: 'Great', good: 'Good', neutral: 'Neutral', poor: 'Poor', hostile: 'Hostile' },
  slider: { decrease: 'Decrease', increase: 'Increase' },
  change: 'Change',
  skeleton: 'Loading content',
  sparkline: 'Last {n} values',
  noForm: 'No matches yet',
  topbar: { money: 'Money', energy: 'Energy', happiness: 'Happiness', date: 'Date', events: 'Pending decisions' },
  ctx: { nextMatch: 'Next match', quickStats: 'At a glance', decisions: 'Decisions', noMatch: 'No match scheduled', form: 'Form', trust: 'Manager trust' },
}
