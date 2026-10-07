/**
 * Charity: a foundation of your own and one-off good deeds. Giving is good;
 * giving well is harder (and audits exist).
 *
 * Chains:
 * - Foundation (4 steps): foundation_idea → foundation_gala → foundation_audit → foundation_pitch
 */
import {
  canAfford, chain, fans, flags, follow, fx, happy, hasFlag, money, news, num, press, rel, rep, stress, t, wageX, folPct, energy, morale,
  pickFull,
} from '../dsl'
import type { EventDef } from '../types'

export const charityEvents: EventDef[] = [
  // ───────────── Foundation (4 steps) ─────────────
  {
    id: 'charity.foundation_idea',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    conditions: ({ state }) => state.hero.reputation >= 22 && state.life.money >= wageX(state, 8, 15000) && !hasFlag(state, 'foundation'),
    vars: ({ state }) => ({ seed: wageX(state, 8, 15000), foundation: `${state.hero.lastName} Vakfı` }),
    title: t('Kendi Vakfın', 'Your Own Foundation'),
    text: t(
      'Çocukluğunun geçtiği sahada artık çim yok, toz var. {motherName} aradı: "{g:Oğlum|Kızım}, o çocuklar senin gibi olmak istiyor. Bir şey yapamaz mısın?" Bir vakıf kurmak {seed:money} başlangıç sermayesi istiyor.',
      'The pitch you grew up on is dust now, not grass. {motherName} calls: "Those kids want to be you. Can\'t you do something?" Setting up a foundation takes {seed:money} to start.',
    ),
    icon: '🤲',
    choices: [
      {
        label: t('{foundation}\'nı kur', 'Set up the {foundation}'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'seed')),
        lockedHint: t('Başlangıç sermayesi yok.', 'Not enough seed money.'),
        effects: (ctx) => fx(t('Noter, logo, tüzük. İlk toplantıda annen kurabiye getirdi; tüzükte kurabiye maddesi yok ama olmalı.', 'Notary, logo, charter. Your mum brought biscuits to the first board meeting. The charter has no biscuit clause; it should.'), money(-num(ctx, 'seed')), rep(2), happy(6), rel('mother', 5), flags({ foundation: true }), follow(chain('charity.foundation_gala', 3))),
      },
      {
        label: t('Tek seferlik bağış yap', 'Make a one-off donation instead'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'seed') / 4),
        lockedHint: t('Bunun için de paran yok.', 'Not even that much cash.'),
        effects: (ctx) => fx(t('Saha yeniden çimlendi. Tabela yok, isim yok. Çocuklar yine de biliyor.', 'The pitch got new grass. No sign, no name. The kids know anyway.'), money(-num(ctx, 'seed') / 4), happy(4), fans(2)),
      },
      {
        label: t('Şimdi değil', 'Not now'),
        effects: () => fx(t('"Belki seneye" dedin. Annen "olur" dedi, sesi biraz kırık.', '"Maybe next year," you said. Mum said "alright", a little quieter.'), rel('mother', -2)),
      },
    ],
  },
  {
    id: 'charity.foundation_gala',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Bağış Gecesi', 'The Gala'),
    text: t(
      '{foundation}\'nın ilk bağış gecesi. Masalar dolu, mikrofon sende. Açık artırmaya ne koyacaksın?',
      'The {foundation}\'s first fundraising gala. Full tables, the mic is yours. What goes up for auction?',
    ),
    icon: '🎟️',
    choices: [
      {
        label: t('İlk profesyonel golünün kramponunu', 'The boots from your first pro goal'),
        effects: () => fx(t('Bir iş insanı kramponlara servet ödedi, sonra koklamaya çalıştı. Para vakıfta.', 'A businessperson paid a fortune for them, then tried to sniff them. The money\'s in the foundation.'), rep(2), fans(3), happy(4), { addFlags: { foundation_funds: 3 } }, follow(chain('charity.foundation_audit', 4))),
      },
      {
        label: t('"Benimle bir antrenman" deneyimi', 'A training session with you'),
        effects: () => fx(t('Kazanan bir emekli öğretmen çıktı. Antrenmanda seni çalımladı. Video sende.', 'The winner was a retired teacher. They nutmegged you in training. You have the video.'), fans(4), energy(-6), { addFlags: { foundation_funds: 2 } }, follow(chain('charity.foundation_audit', 4))),
      },
      {
        label: t('Sahnede şarkı söyle', 'Sing on stage'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Ses fena değilmiş! Bağışlar ikiye katlandı.', 'Turns out you can sing! Donations doubled.'), folPct(ctx, 4), happy(6), { addFlags: { foundation_funds: 4 } }, follow(chain('charity.foundation_audit', 4)))
            : fx(t('İnsanlar sesinin bitmesi için bağış yaptı. Yine de bağış.', 'People donated for you to stop. Still donations.'), folPct(ctx, 3), press(2), { addFlags: { foundation_funds: 2 } }, follow(chain('charity.foundation_audit', 4))),
      },
    ],
  },
  {
    id: 'charity.foundation_audit',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ treasurer: pickFull(rng) }),
    title: t('Hesaplarda Bir Tuhaflık', 'Something Odd in the Books'),
    text: t(
      'Vakfın saymanı {treasurer}\'ın masraf raporunda "toplantı yemeği" kalemi şaşırtıcı derecede büyük. Fişlerden birinde ıstakoz var. Vakıf çocuk sahaları için.',
      'The foundation\'s treasurer {treasurer} has a surprisingly large "meeting dinners" line. One receipt says lobster. The foundation builds kids\' pitches.',
    ),
    icon: '🦞',
    choices: [
      {
        label: t('Bağımsız denetim yaptır, sonuçları yayımla', 'Order an independent audit and publish it'),
        effects: () => fx(t('Denetim düzeltmeleri yaptı, {treasurer} görevden ayrıldı. Şeffaflığın övgü topladı.', 'The audit fixed things and {treasurer} stepped down. Your transparency earned praise.'), rep(2), press(5), stress(2), follow(chain('charity.foundation_pitch', 3))),
      },
      {
        label: t('{treasurer} ile sessizce konuş', 'Have a quiet word with {treasurer}'),
        effects: (_ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('Fişleri geri ödedi, ıstakoz bir daha görülmedi.', 'They paid it back. The lobster was never seen again.'), stress(1), follow(chain('charity.foundation_pitch', 3)))
            : fx(
                t('Bir gazeteci fişlere ulaştı: "{heroName}\'in vakfında ıstakoz ziyafeti!"', 'A journalist got the receipts: "Lobster feasts at {heroName}\'s foundation!"'),
                press(-8), fans(-4), rep(-2), stress(6),
                news(t('{heroName}\'in vakfında harcama skandalı', 'Spending scandal at {heroName}\'s foundation'), -1),
                follow(chain('charity.foundation_pitch', 4)),
              ),
      },
    ],
  },
  {
    id: 'charity.foundation_pitch',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ top: wageX(state, 4, 8000) }),
    title: t('İlk Saha Açılıyor', 'The First Pitch Opens'),
    text: t(
      'Vakfın ilk mahalle sahası hazır. Kurdele, makas ve yüz çocuk. Çocuklardan biri sana "Ben de senin gibi olacağım ama daha iyi" diyor. Haklı olabilir.',
      'The foundation\'s first neighbourhood pitch is ready. Ribbon, scissors and a hundred kids. One tells you "I\'ll be like you, but better". They might be right.',
    ),
    icon: '🏟️',
    choices: [
      {
        label: t('Kurdeleyi kes, maç yap', 'Cut the ribbon and play a match'),
        effects: (ctx) => fx(t('Beşe beş maç oynadınız. Kaybettin. Hayatının en güzel yenilgisi.', 'A five-a-side match. You lost. The best defeat of your life.'), rep(3), fans(6), happy(10), morale(4), folPct(ctx, 3), news(t('{heroName}\'in vakfı ilk sahasını açtı', '{heroName}\'s foundation opens its first pitch'), 1)),
      },
      {
        label: t('İkinci sahaya {top:money} daha ekle', 'Add {top:money} for a second pitch'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'top')),
        lockedHint: t('Şimdilik bu kadar.', 'That\'s it for now.'),
        effects: (ctx) => fx(t('İkinci saha da yolda. Belediye başkanı fotoğraf için yanına koştu; sen geri çekildin.', 'A second pitch is on its way. The mayor ran over for a photo; you stepped back.'), money(-num(ctx, 'top')), rep(3), fans(5), happy(8), flags({ foundation_pitches: 2 })),
      },
    ],
  },
  // ───────────── Standalone ─────────────
  {
    id: 'charity.hospital_visit',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => !!state.hero.contract,
    vars: (_ctx, rng) => ({ kid: rng.pick(['Mira', 'Efe', 'Ada', 'Kuzey', 'Deniz']) }),
    title: t('Çocuk Hastanesi', 'Children\'s Hospital'),
    text: t(
      'Kulüp çocuk hastanesine ziyaret düzenliyor. Liste gönüllülük esasına dayalı ve aynı gün bir reklam çekimin var. {kid} adlı bir çocuk senin posterini yatağının üstüne asmış.',
      'The club is organising a children\'s hospital visit. It\'s voluntary, and you have an ad shoot the same day. A kid called {kid} has your poster above their bed.',
    ),
    icon: '🏥',
    choices: [
      {
        label: t('Çekimi ertele, hastaneye git', 'Postpone the shoot, go to the hospital'),
        effects: () => fx(t('{kid} posteri imzalattı, sonra "Annem senin en çok saçını beğeniyor" dedi. Günün en büyük kupası.', '{kid} got the poster signed, then said "My mum likes your hair best." Trophy of the day.'), happy(8), stress(-4), fans(3), rep(1)),
      },
      {
        label: t('İmzalı forma gönder', 'Send a signed shirt'),
        effects: () => fx(t('Forma ulaştı. {kid} onu hemşirelere de giydirdi.', 'The shirt arrived. {kid} made the nurses wear it too.'), happy(2), fans(1)),
      },
    ],
  },
  {
    id: 'charity.flood_appeal',
    category: 'charity',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => state.life.money >= wageX(state, 2, 2000),
    vars: ({ state }) => ({ gift: wageX(state, 2, 2000) }),
    title: t('Sel Felaketi', 'Flood Appeal'),
    text: t(
      'Bir sahil kasabasını sel vurdu. Kulüpler yardım kampanyası başlattı. Herkes ne kadar bağış yapacağını konuşuyor ve bazıları bunu kameraya söylüyor.',
      'A coastal town has been hit by floods. Clubs are launching appeals. Everyone is talking about how much they\'ll give, and some are saying it to the cameras.',
    ),
    icon: '🌊',
    choices: [
      {
        label: t('{gift:money} bağışla, sessizce', 'Donate {gift:money}, quietly'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'gift')),
        lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (ctx) => fx(t('Makbuzda adın yok, sadece "bir futbolcu". Bir muhabir yine de buldu.', 'The receipt says "a footballer", no name. A reporter found out anyway.'), money(-num(ctx, 'gift')), happy(5), rep(1), press(3)),
      },
      {
        label: t('Gönüllü olarak bölgeye git', 'Go there to volunteer'),
        effects: () => fx(t('İki gün kum torbası taşıdın. Bacakların ağrıyor, kalbin hafif.', 'Two days of hauling sandbags. Legs aching, heart light.'), energy(-15), happy(8), fans(4), stress(-3), rel('teammate', 1)),
      },
      {
        label: t('Takipçilerini kampanyaya yönlendir', 'Rally your followers to the appeal'),
        effects: (ctx) => fx(t('Paylaşımın bir milyon kişiye ulaştı, kampanya hedefini aştı.', 'Your post reached a million people and the appeal beat its target.'), folPct(ctx, 2), rep(1), fans(2)),
      },
    ],
  },
  {
    id: 'charity.shirt_auction',
    category: 'charity',
    weight: 1,
    cooldownWeeks: 16,
    triggers: ['scored'],
    conditions: ({ state }) => state.hero.reputation >= 10,
    title: t('Gol Formasını Açık Artırmaya Çıkar', 'Auction the Goal Shirt'),
    text: t(
      'Bugün gol attığın formayı bir yardım derneği açık artırmaya çıkarmak istiyor. Formayı aslında babana söz vermiştin.',
      'A charity wants to auction the shirt you scored in today. You\'d actually promised it to your dad.',
    ),
    icon: '👕',
    choices: [
      {
        label: t('Açık artırmaya ver', 'Give it to the auction'),
        effects: () => fx(t('Forma rekor fiyata gitti. Babana bir sonrakini söz verdin.', 'The shirt went for a record. You promised your dad the next one.'), rep(1), fans(2), rel('father', -1), happy(3)),
      },
      {
        label: t('Babana ver', 'Give it to your dad'),
        effects: () => fx(t('Baban formayı çerçeveletti. Çerçeve formadan pahalı.', 'Your dad had it framed. The frame cost more than the shirt.'), rel('father', 6), happy(3)),
      },
      {
        label: t('İkisi de olsun: kramponlar derneğe', 'Both: the boots go to the charity'),
        effects: () => fx(t('Herkes mutlu. Kramponlar biraz kokuyor, alıcı umursamadı.', 'Everyone wins. The boots smell a bit; the buyer didn\'t care.'), rel('father', 4), fans(2), happy(4)),
      },
    ],
  },
]
