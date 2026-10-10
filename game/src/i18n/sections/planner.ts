import type { Shape } from '../shape'

/** Activities screen (the three-slot day planner was removed in TestFlight build 4). */
export const tr = {
  title: 'Aktiviteler',
  sub: '{day}, {week}',
  week: 'Bu hafta',
  matchDay: 'Maç günü',
  energyBudget: 'Enerji',
  now: 'Şu an: {slot}',
  intro: 'Bir etkinliğe dokun, sonra “Şimdi yap”. Her etkinlik günün bir bölümünü ve enerji harcar.',
  energyLow: 'Enerjin az: dinlenmeyi düşün.',
  catalog: 'Ne yapmak istersin?',
  doNow: 'Şimdi yap',
  usesTime: 'Günün {n} bölümünü kullanır',
  all: 'Tümü',
  slots: '{n} bölüm',
  energyCost: '{n} enerji',
  energyGain: '+{n} enerji',
  done: '{name} tamamlandı',
  noActivities: 'Bu kategoride etkinlik yok',
  advance: 'Zamanı ilerlet',
}

export const en: Shape<typeof tr> = {
  title: 'Activities',
  sub: '{day}, {week}',
  week: 'This week',
  matchDay: 'Match day',
  energyBudget: 'Energy',
  now: 'Now: {slot}',
  intro: 'Tap an activity, then “Do it now”. Each one uses part of your day and some energy.',
  energyLow: 'Your energy is low: think about resting.',
  catalog: 'What do you want to do?',
  doNow: 'Do it now',
  usesTime: 'Uses {n} {n|part|parts} of the day',
  all: 'All',
  slots: '{n} {n|part|parts}',
  energyCost: '{n} energy',
  energyGain: '+{n} energy',
  done: '{name} done',
  noActivities: 'No activities in this category',
  advance: 'Move time on',
}
