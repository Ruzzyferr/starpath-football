import type { Shape } from '../shape'

export const tr = {
  title: 'Karar anı',
  counter: '{i}/{n}',
  choose: 'Ne yapacaksın?',
  requires: 'Şart: {text}',
  unmet: 'Şart sağlanmıyor',
  outcome: 'Sonuç',
  success: 'İşler yolunda gitti',
  failure: 'Planladığın gibi olmadı',
  continue: 'Devam',
  nextEvent: 'Sıradaki karar',
  noChange: 'Kayda değer bir değişim yok',
  missing: 'Bu karar artık geçerli değil.',
  later: 'Sonra karar ver',
}

export const en: Shape<typeof tr> = {
  title: 'Decision time',
  counter: '{i}/{n}',
  choose: 'What will you do?',
  requires: 'Requires: {text}',
  unmet: 'Requirement not met',
  outcome: 'Outcome',
  success: 'It worked out',
  failure: 'Not what you planned',
  continue: 'Continue',
  nextEvent: 'Next decision',
  noChange: 'No notable change',
  missing: 'This decision is no longer available.',
  later: 'Decide later',
}
