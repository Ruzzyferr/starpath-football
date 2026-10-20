/**
 * Money: investments, scams, luxury temptations, taxes and family finance.
 *
 * Chains:
 * - Startup: startup_pitch → startup_result
 * - Tax: creative_accountant → tax_audit
 * - Family: uncle_loan → uncle_business
 * - Restaurant: restaurant_franchise → restaurant_review
 */
import {
  canAfford, chairman, disc, energy, fans, flags, folPct, follow, fx, happy, hasFlag, money, news, num, pickBrand,
  pickFull, press, rel, rep, stress, t, chain, wageX,
} from '../dsl'
import type { EventDef } from '../types'

const UNCLES = ['Rıfat', 'Cemal', 'Naci', 'Sabri', 'Hilmi'] as const
const LOCAL_TEAMS = ['Mahalle Gücü', 'Sahil Yıldızları', 'Dereboyu SK', 'Çınaraltı Gençlik'] as const

export const moneyEvents: EventDef[] = [
  // ───────────── Startup chain ─────────────
  {
    id: 'money.startup_pitch',
    category: 'money',
    weight: 1,
    cooldownWeeks: 30,
    triggers: ['weekly', 'big_money'],
    conditions: ({ state }) => state.life.money >= wageX(state, 4, 3000) && !hasFlag(state, 'startup_stake'),
    vars: ({ state }, rng) => ({ amount: wageX(state, 6, 5000), founder: pickFull(rng), startup: `${pickBrand(rng)}Pitch` }),
    title: t('Asansör Konuşması', 'The Elevator Pitch'),
    text: t(
      'Eski bir akademi kalecisi olan {founder}, girişimci olmuş. {startup}: boş halı sahaları saatlik kiralayan bir uygulama. "{amount:money} ve tanınan bir yüz lazım. Yüz sende var."',
      'Former academy keeper turned founder {founder} pitches {startup}: an app that rents out empty five-a-side pitches by the hour. "We need {amount:money} and a famous face. You have the face."',
    ),
    icon: '🚀',
    choices: [
      {
        label: t('Sessiz ortak ol', 'Invest as a silent partner'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakit yok.', 'Not enough cash.'),
        effects: (ctx) =>
          fx(t('Sözleşmeyi imzaladın. {founder} heyecandan kahveni devirdi.', 'You signed. {founder} knocked your coffee over in excitement.'), money(-num(ctx, 'amount')), stress(2), flags({ startup_stake: true }), follow(chain('money.startup_result', 8))),
      },
      {
        label: t('Yatır ve reklam yüzü ol', 'Invest and be the face of the ads'),
        hint: t('Daha çok görünürlük, daha çok risk.', 'More exposure, more risk.'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakit yok.', 'Not enough cash.'),
        effects: (ctx) =>
          fx(
            t('Reklamda halı sahada rövaşata deniyorsun. Üçüncü çekimde oldu. Herkes izledi.', 'In the ad you try a bicycle kick on a five-a-side pitch. Third take, it went in. Everyone saw it.'),
            money(-num(ctx, 'amount')), folPct(ctx, 4), rep(1), energy(-8),
            flags({ startup_stake: true, startup_face: true }),
            follow(chain('money.startup_result', 8)),
          ),
      },
      {
        label: t('Nazikçe geç', 'Politely pass'),
        effects: () => fx(t('"Başarılar" dedin. {founder} kartını bıraktı, "fikrini değiştirirsen..."', '"Good luck," you said. {founder} left a card: "if you change your mind..."'), stress(-1)),
      },
    ],
  },
  {
    id: 'money.startup_result',
    category: 'money',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 6, 5000), founder: pickFull(rng), startup: `${pickBrand(rng)}Pitch` }),
    title: t('Yönetim Kurulu Telefonu', 'The Board Call'),
    text: t(
      '{founder} arıyor: "Yarın {startup}\'ın geleceği için kritik toplantı var. Bunu önce benden duymanı istedim."',
      '{founder} calls: "Big board meeting tomorrow about the future of {startup}. I wanted you to hear it from me first."',
    ),
    icon: '📊',
    choices: [
      {
        label: t('Lafı dolandırma, söyle', 'Give it to me straight'),
        risk: 'high',
        effects: (ctx, rng) => {
          const a = num(ctx, 'amount')
          const r = rng.next()
          if (r < 0.25)
            return fx(
              t('Büyük bir platform {startup}\'ı satın alıyor! Payın dört katına çıktı.', 'A big platform is buying {startup}! Your stake just quadrupled.'),
              money(a * 4), happy(8), rep(2), flags({ startup_stake: null }),
              news(t('{heroName}\'in yatırım yaptığı {startup} satın alındı', '{startup}, backed by {heroName}, gets acquired'), 1),
            )
          if (r < 0.65)
            return fx(t('Yavaş ama istikrarlı büyüme. Payını küçük bir kârla devrettin.', 'Slow, steady growth. You sold your stake for a modest profit.'), money(a * 1.15), happy(2), flags({ startup_stake: null }))
          return fx(t('Para bitti. {founder} özür diledi; sen de halı saha kiralamanın neden zor olduğunu öğrendin.', 'The money ran out. {founder} apologised; you learned why renting pitches is hard.'), stress(6), happy(-4), flags({ startup_stake: null, startup_flop: true }))
        },
      },
      {
        label: t('Payını şimdi bir fona sat (%70)', 'Sell to a fund now (70%)'),
        effects: (ctx) => fx(t('Güvenli liman. Kayıp var ama uykun kaçmayacak.', 'Safe harbour. A loss, but you will sleep.'), money(num(ctx, 'amount') * 0.7), stress(-2), flags({ startup_stake: null })),
      },
      {
        label: t('Yeni turda daha fazla yatır', 'Double down in the next round'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('İkinci tur için paran yok.', 'No cash for another round.'),
        effects: (ctx, rng) => {
          const a = num(ctx, 'amount')
          return rng.chance(0.3)
            ? fx(t('Cesaret kazandı: yeni yatırımcılar geldi, değerleme uçtu.', 'Nerve paid off: new investors piled in and the valuation flew.'), money(a * 5), happy(10), rep(2), flags({ startup_stake: null }))
            : fx(t('İki kez kaybetmek, bir kez kaybetmekten daha çok acıtıyor.', 'Losing twice hurts more than losing once.'), money(-a), stress(10), happy(-6), flags({ startup_stake: null }))
        },
      },
    ],
  },

  // ───────────── Standalone money events ─────────────
  {
    id: 'money.coin_hype',
    category: 'money',
    gambling: true, // a coin punt, gambling with followers money
    weight: 1,
    cooldownWeeks: 24,
    triggers: ['weekly', 'social_post'],
    conditions: () => true,
    vars: ({ state }, rng) => ({ coin: `${pickBrand(rng)}Coin`, amount: wageX(state, 3, 2000), fee: wageX(state, 2, 1500) }),
    title: t('Aya Gidiyoruz!', 'To the Moon!'),
    text: t(
      'Takım grubunda {mate}: "{coin} bu hafta 40 kat yaptı! Roket kalkmadan bin." Bu arada coin\'in yapımcıları da sana tanıtım için {fee:money} teklif etti.',
      'In the team chat, {mate}: "{coin} did 40x this week! Get in before the rocket leaves." Meanwhile the coin\'s creators have offered you {fee:money} to promote it.',
    ),
    icon: '🪙',
    choices: [
      {
        label: t('{amount:money} ile gir', 'Buy in with {amount:money}'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakit yok.', 'Not enough cash.'),
        effects: (ctx, rng) =>
          rng.chance(0.3)
            ? fx(t('Tam zirvede sattın. Şans mı deha mı, sen de bilmiyorsun.', 'You sold right at the peak. Luck or genius, even you don\'t know.'), money(num(ctx, 'amount') * 2), happy(5))
            : fx(t('Ertesi gün grafik uçurum gibiydi. {mate} gruptan çıktı.', 'Next day the chart looked like a cliff. {mate} left the group chat.'), money(-num(ctx, 'amount') * 0.9), stress(6), happy(-3)),
      },
      {
        label: t('Ücret karşılığı tanıt', 'Promote it for the fee'),
        hint: t('Takipçilerin parasıyla oynamak...', "Gambling with your followers' money..."),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(
                t('{coin} çöktü. Binlerce taraftar para kaybetti, yorumlar acımasız.', '{coin} collapsed. Thousands of fans lost money and the comments are brutal.'),
                money(num(ctx, 'fee')), rep(-4), fans(-8), folPct(ctx, -3), stress(8),
                news(t('{heroName}\'in tanıttığı coin çöktü', 'Coin promoted by {heroName} collapses'), -1),
              )
            : fx(t('Coin ayakta kaldı, para hesabında. Yine de içinde bir huzursuzluk var.', 'The coin held up and the fee is in your account. Something still feels off.'), money(num(ctx, 'fee')), folPct(ctx, 2), stress(3)),
      },
      {
        label: t('Gruba bir GIF at, uzak dur', 'Send a GIF, stay out'),
        effects: () => fx(t('Grupta "ihtiyar" ilan edildin. Cüzdanın teşekkür ediyor.', 'The group declared you a boomer. Your wallet says thanks.'), rel('teammate', -1), stress(-1)),
      },
    ],
  },
  {
    id: 'money.fake_agent',
    category: 'money',
    weight: 1,
    cooldownWeeks: 26,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 1, 1500), scammer: pickFull(rng) }),
    title: t('Acil: Rüya Transfer', 'Urgent: Dream Transfer'),
    text: t(
      '"{agentName} ajansından genç ortak {scammer}" imzalı bir e-posta: büyük bir kulüp seni istiyor, ama "federasyon kayıt ücreti" {amount:money} bugün yatmalı. Link, ajansın sitesinin birebir kopyası.',
      'An email signed "{scammer}, junior associate at {agentName}\'s agency": a big club wants you, but a "federation registration fee" of {amount:money} must be paid today. The link looks exactly like the agency\'s website.',
    ),
    icon: '🎣',
    choices: [
      {
        label: t('Fırsatı kaçırma, öde', 'Pay, don\'t miss the chance'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Hesabında yeterli para yok.', 'Not enough in your account.'),
        effects: (ctx) =>
          fx(
            t('Ödedin. Ertesi gün {agentName} güldü, sonra güldüğüne pişman oldu: "Benim genç ortağım yok."', 'You paid. Next day {agentName} laughed, then regretted laughing: "I don\'t have a junior associate."'),
            money(-num(ctx, 'amount')), stress(6), happy(-4),
          ),
      },
      {
        label: t('Önce {agentName}\'ı ara', 'Call {agentName} first'),
        effects: () => fx(t('"Sakın tıklama!" Ajansın siber güvenlik ekibi e-postayı inceledi; sana bir dahakine dikkat edeceğin üç işaret öğretildi.', '"Don\'t click that!" The agency\'s security people looked into it and taught you three red flags to spot next time.'), rel('agent', 5), stress(-2)),
      },
      {
        label: t('Siber suçlar birimine ilet', 'Forward it to the cybercrime unit'),
        effects: () =>
          fx(
            t('Bir öğleden sonranı ifadeye verdin. Bir ay sonra çete çökertildi; adın "dikkatli vatandaş" olarak geçti.', 'You spent an afternoon giving a statement. A month later the gang was busted, and you were credited as an "alert citizen".'),
            energy(-6), rep(1), press(3),
          ),
      },
    ],
  },
  {
    id: 'money.charity_gala',
    category: 'money',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => state.hero.reputation >= 20,
    vars: ({ state }) => ({ amount: wageX(state, 4, 3000) }),
    title: t('Gala Açık Artırması', 'The Gala Auction'),
    text: t(
      'Hayır gecesinde sıra efsane forvet Nuri Kalkan\'ın final kramponlarında. Sunucu sana bakıyor: "Belki genç yıldızımız {amount:money} der?"',
      'At the charity gala, the next lot is the boots legendary striker Nuri Kalkan wore in a cup final. The host looks at you: "Perhaps our young star will say {amount:money}?"',
    ),
    icon: '🥾',
    choices: [
      {
        label: t('Elini kaldır ve kazan', 'Raise your paddle and win'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu teklif için paran yetmiyor.', "You can't back that bid."),
        effects: (ctx) =>
          fx(
            t('Salon ayağa kalktı. Kramponlar şimdi vitrininde; kokuları hakkında konuşmayalım.', 'The room stood up. The boots are in your display cabinet now; let\'s not discuss the smell.'),
            money(-num(ctx, 'amount')), rep(4), press(5), happy(4),
            news(t('{heroName} hayır gecesinde gönülleri fethetti', '{heroName} wins hearts at charity gala'), 1),
          ),
      },
      {
        label: t('Mütevazı bir teklif ver', 'Make a modest bid'),
        effects: () => fx(t('Bir iş insanı seni ikiye katladı. Yine de alkış aldın.', 'A businessman doubled you. You still got applause.'), rep(1), happy(1)),
      },
      {
        label: t('Yarısını isimsiz bağışla', 'Donate half anonymously'),
        hint: t('Kimse bilmeyecek. Sen bileceksin.', "Nobody will know. You will."),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount') / 2),
        lockedHint: t('Bu kadar bile yok.', 'Not even that much.'),
        effects: (ctx) => fx(t('Makbuzda adın yok. Gece eve dönerken tuhaf bir hafiflik hissettin.', 'Your name is not on the receipt. Walking home you felt oddly light.'), money(-num(ctx, 'amount') / 2), happy(7), stress(-3)),
      },
      {
        label: t('Erken ayrıl', 'Leave early'),
        effects: () => fx(t('Fotoğrafçılar arka kapıdan çıkışını yakaladı: "Cimri yıldız?"', 'Photographers caught you slipping out the back: "Stingy star?"'), press(-4), rep(-1), energy(4)),
      },
    ],
  },
  {
    id: 'money.luxury_impulse',
    category: 'money',
    weight: 1,
    cooldownWeeks: 16,
    triggers: ['shopping', 'big_money', 'weekly'],
    conditions: ({ state }) => state.life.money >= wageX(state, 10, 10000),
    vars: ({ state }, rng) => ({ car: `${pickBrand(rng)} GT`, amount: wageX(state, 15, 20000), gift: wageX(state, 3, 3000) }),
    title: t('Vitrindeki Canavar', 'The Beast in the Window'),
    text: t(
      'Galeride turuncu bir {car} sana göz kırpıyor. Satıcı anahtarı uzattı: "{amount:money}. Bu araba sizin gibi biri için yapılmış."',
      'In the showroom an orange {car} is winking at you. The salesman holds out the key: "{amount:money}. This car was built for someone like you."',
    ),
    icon: '🏎️',
    choices: [
      {
        label: t('Hemen al', 'Buy it on the spot'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Hayal etmek bedava, araba değil.', 'Dreaming is free; the car is not.'),
        effects: (ctx) =>
          fx(
            t('Antrenman otoparkına girdiğinde herkes döndü baktı. {managerName} de baktı, ama başka bir ifadeyle.', 'When you rolled into the training car park everyone turned. {managerName} turned too, with a different expression.'),
            money(-num(ctx, 'amount')), happy(10), rep(2), folPct(ctx, 3), rel('teammate', -2), rel('manager', -2),
          ),
      },
      {
        label: t('Sadece test sürüşü', 'Just a test drive'),
        effects: () => fx(t('Sahil yolunda on dakika. Yetti. Galeriye geri bıraktın; gülümsemen kaldı.', 'Ten minutes on the coast road. Enough. You left it at the showroom; the grin stayed.'), happy(3)),
      },
      {
        label: t('Mantıklı araba al, ailene para gönder', 'Buy something sensible, send money home'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'gift')),
        lockedHint: t('Şu an bunun için bile yok.', 'Not even enough for that right now.'),
        effects: (ctx) =>
          fx(t('{motherName} telefonda ağladı. {fatherName} "aklını başına almışsın" dedi, ki ondan büyük övgü.', '{motherName} cried on the phone. {fatherName} said "you\'ve got your head screwed on", which from him is high praise.'), money(-num(ctx, 'gift')), rel('mother', 8), rel('father', 6), happy(4)),
      },
    ],
  },

  // ───────────── Tax chain ─────────────
  {
    id: 'money.creative_accountant',
    category: 'money',
    weight: 0.9,
    cooldownWeeks: 40,
    conditions: ({ state }) => state.life.money >= wageX(state, 8, 8000) && !hasFlag(state, 'tax_scheme'),
    vars: ({ state }, rng) => ({ accountant: pickFull(rng), saving: wageX(state, 6, 4000) }),
    title: t('Yaratıcı Muhasebe', 'Creative Accounting'),
    text: t(
      'Yeni muhasebecin {accountant}, bir adada "imaj hakları şirketi" öneriyor: "Yılda {saving:money} tasarruf. Tamamen yasal. Çoğunlukla."',
      'Your new accountant {accountant} suggests an "image rights company" on a sunny island: "Saves you {saving:money} a year. Totally legal. Mostly."',
    ),
    icon: '🏝️',
    choices: [
      {
        label: t('Kur şu şirketi', 'Set up the company'),
        risk: 'high',
        effects: (ctx) =>
          fx(t('Birkaç imza, bir posta kutusu adresi. Tasarruf hemen geldi.', 'A few signatures, a PO box address. The savings arrived at once.'), money(num(ctx, 'saving')), flags({ tax_scheme: true }), follow(chain('money.tax_audit', 10))),
      },
      {
        label: t('Sadece yasal kısmını uygula', 'Only do the clearly legal part'),
        effects: (ctx) => fx(t('{accountant} sıkıldığını saklamadı ama küçük bir tasarruf buldu.', "{accountant} didn't hide the boredom, but found a small saving."), money(num(ctx, 'saving') * 0.3), stress(-1)),
      },
      {
        label: t('Kov, sıkıcı bir muhasebeci bul', 'Fire them, hire a boring accountant'),
        effects: () => fx(t('Yeni muhasebecin hiç gülmüyor. Mükemmel.', 'Your new accountant never smiles. Perfect.'), stress(-3), disc(1)),
      },
    ],
  },
  {
    id: 'money.tax_audit',
    category: 'money',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ accountant: pickFull(rng), saving: wageX(state, 6, 4000) }),
    title: t('Vergi Dairesinden Mektup', 'A Letter from the Tax Office'),
    text: t(
      'Kibar ama soğuk bir mektup: ada şirketin hakkında "birkaç soru". {accountant}\'in telefonu artık kullanılmıyor.',
      'A polite but chilly letter: "a few questions" about your island company. {accountant}\'s number is no longer in service.',
    ),
    icon: '🧾',
    choices: [
      {
        label: t('Vergiyi ve cezayı öde', 'Pay the back taxes and penalty'),
        effects: (ctx) => fx(t('Pahalı bir ders. En azından konu kapandı.', 'An expensive lesson. At least it is closed.'), money(-num(ctx, 'saving') * 3), stress(6), rep(-1), flags({ tax_scheme: null })),
      },
      {
        label: t('Vergi avukatlarıyla savaş', 'Fight it with tax lawyers'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'saving')),
        lockedHint: t('Avukatlara verecek paran yok.', "You can't afford the lawyers."),
        effects: (ctx, rng) => {
          const s = num(ctx, 'saving')
          return rng.chance(0.45)
            ? fx(t('Avukatlar bir boşluk buldu. Dava düştü; faturaları düşmedi.', 'The lawyers found a loophole. The case fell; their invoice did not.'), money(-s), stress(4), flags({ tax_scheme: null }))
            : fx(
                t('Mahkeme kaybedildi, gazeteler bayram etti.', 'You lost in court and the papers had a field day.'),
                money(-s * 4), rep(-4), disc(-3), stress(10), chairman(-5), flags({ tax_scheme: null }),
                news(t('{heroName} vergi davasını kaybetti', '{heroName} loses tax case'), -1),
              )
        },
      },
      {
        label: t('Kamuoyu önünde muhasebeciyi suçla', 'Publicly blame the accountant'),
        effects: (ctx) =>
          fx(
            t('Ödedin ve açıklama yaptın. Kimi inandı, kimi "imzayı o mu attı?" diye sordu.', 'You paid and made a statement. Some believed you; some asked "who signed the papers, then?"'),
            money(-num(ctx, 'saving') * 3), press(-3), rep(-2), stress(4), flags({ tax_scheme: null }),
            news(t('{heroName}: "Muhasebecim beni kandırdı"', '{heroName}: "My accountant misled me"'), 0),
          ),
      },
    ],
  },

  // ───────────── Restaurant chain ─────────────
  {
    id: 'money.restaurant_franchise',
    category: 'money',
    weight: 0.9,
    cooldownWeeks: 40,
    conditions: ({ state }) => state.hero.reputation >= 30 && !hasFlag(state, 'restaurant_owner'),
    vars: ({ state }, rng) => ({ amount: wageX(state, 8, 6000), chef: pickFull(rng) }),
    title: t('Adın Tabelada', 'Your Name in Lights'),
    text: t(
      'Şef {chef}, {city}\'de "{heroName} Izgara" açmak istiyor. "Senin adın, benim köftem. {amount:money} ile ortak oluruz."',
      'Chef {chef} wants to open "{heroName}\'s Grill" in {city}. "Your name, my meatballs. {amount:money} and we\'re partners."',
    ),
    icon: '🍖',
    choices: [
      {
        label: t('Ortak ol', 'Become a partner'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Ortaklık için paran yok.', 'Not enough for a partnership.'),
        effects: (ctx) =>
          fx(t('Açılışta kurdeleyi kestin, ilk köfteyi taraftarlar için sen çevirdin.', 'You cut the ribbon and flipped the first meatballs for the fans yourself.'), money(-num(ctx, 'amount')), happy(4), fans(3), flags({ restaurant_owner: true }), follow(chain('money.restaurant_review', 5))),
      },
      {
        label: t('Sadece adını lisansla', 'Just license your name'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Lisans ücreti hesabına geçti. Tabelada gülümseyen bir sen var.', 'The licence fee landed. There is a smiling you on the sign.'), money(num(ctx, 'amount') * 0.3), rep(1))
            : fx(
                t('Bir ay sonra gıda zehirlenmesi haberi çıktı. Manşette senin adın.', 'A month later, a food poisoning story broke. Your name in the headline.'),
                money(num(ctx, 'amount') * 0.3), rep(-3), fans(-3),
                news(t('"{heroName} Izgara"da zehirlenme şüphesi', 'Food poisoning scare at "{heroName}\'s Grill"'), -1),
              ),
      },
      {
        label: t('Reddet', 'Decline'),
        effects: () => fx(t('Şef omuz silkti; köfte başka bir yıldızın adıyla satılacak.', 'The chef shrugged; the meatballs will carry another star\'s name.'), stress(-1)),
      },
    ],
  },
  {
    id: 'money.restaurant_review',
    category: 'money',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 8, 6000), chef: pickFull(rng) }),
    title: t('Eleştirmenin Kalemi', "The Critic's Pen"),
    text: t(
      'Ünlü bir yemek eleştirmeni restoranı yazdı: "Köfteler {heroName}\'in sol ayağı gibi: bazen harika, bazen tribünlere." Rezervasyonlar karıştı.',
      'A famous food critic reviewed the place: "The meatballs are like {heroName}\'s left foot: sometimes brilliant, sometimes into the stands." Bookings are wobbling.',
    ),
    icon: '📝',
    choices: [
      {
        label: t('Eleştirmeni yeniden davet et', 'Invite the critic back'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('İkinci yazı: "Sol ayak düzelmiş." Kuyruk kapıya kadar.', 'Second review: "The left foot has been sorted." Queues out the door.'), money(num(ctx, 'amount') * 0.6), happy(5), rep(1))
            : fx(t('İkinci yazı ilkinden kötü. {chef} mutfakta küsmüş.', 'The second review was worse. {chef} is sulking in the kitchen.'), stress(5), happy(-3)),
      },
      {
        label: t('Yeni bir şef tut', 'Hire a better chef'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount') / 2),
        lockedHint: t('Yeni şef için bütçe yok.', 'No budget for a new chef.'),
        effects: (ctx) => fx(t('Yeni şef menüyü baştan yazdı. Masraflı ama sağlam; ay sonunda kâr geldi.', 'The new chef rewrote the menu. Costly but solid; profit by month\'s end.'), money(-num(ctx, 'amount') / 2), money(num(ctx, 'amount') * 0.8), happy(3)),
      },
      {
        label: t('Payını sat, köfteden çık', 'Sell your share, exit the meatball game'),
        effects: (ctx) => fx(t('Payını {chef}\'e devrettin. Biraz zarar, çok huzur.', 'You sold your share to {chef}. A little loss, a lot of peace.'), money(num(ctx, 'amount') * 0.6), stress(-4), flags({ restaurant_owner: null })),
      },
    ],
  },

  // ───────────── Family money chain ─────────────
  {
    id: 'money.uncle_loan',
    category: 'money',
    weight: 1,
    cooldownWeeks: 40,
    once: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 3, 2500), uncle: rng.pick(UNCLES) }),
    title: t('Amcanın Büyük Fikri', "Your Uncle's Big Idea"),
    text: t(
      '{uncle} amcan stadın yanına dönerci açmak istiyor: "Maç çıkışı herkes aç olur! {amount:money} lazım, iki ayda öderim." Arka planda {fatherName} kaşını kaldırıyor.',
      'Uncle {uncle} wants to open a kebab stand next to the stadium: "Everyone\'s starving after the match! I need {amount:money}, I\'ll pay you back in two months." In the background {fatherName} raises an eyebrow.',
    ),
    icon: '🥙',
    choices: [
      {
        label: t('Ver, aile ailedir', 'Lend it, family is family'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakdin yok.', "You don't have that much cash."),
        effects: (ctx) => fx(t('{uncle} amcan seni öyle sıktı ki kaburgaların hâlâ ağrıyor.', 'Uncle {uncle} hugged you so hard your ribs still hurt.'), money(-num(ctx, 'amount')), rel('mother', 4), rel('father', -3), follow(chain('money.uncle_business', 6))),
      },
      {
        label: t('Daha küçük bir hediye ver', 'Give a smaller gift instead'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount') / 3),
        lockedHint: t('Şu an onu bile veremezsin.', "You can't even spare that right now."),
        effects: (ctx) => fx(t('"Borç değil, hediye" dedin. {fatherName} göz kırptı.', '"Not a loan, a gift," you said. {fatherName} winked.'), money(-num(ctx, 'amount') / 3), rel('father', 3), rel('mother', 2)),
      },
      {
        label: t('Hayır de', 'Say no'),
        effects: () => fx(t('Bayram sofrası biraz gergin geçecek.', 'The next family dinner is going to be a little tense.'), rel('mother', -4), rel('father', 3), happy(-2)),
      },
    ],
  },
  {
    id: 'money.uncle_business',
    category: 'money',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 3, 2500), uncle: rng.pick(UNCLES) }),
    title: t('Tabeladaki Yüz', 'The Face on the Sign'),
    text: t(
      '{uncle} amcanın dönercisi açıldı. Tabelada kocaman senin fotoğrafın var. İzin alınmadan. Altında: "Yıldızın amcası!"',
      'Uncle {uncle}\'s kebab stand is open. On the sign: a giant photo of you. Unauthorised. Underneath: "The star\'s uncle!"',
    ),
    icon: '🪧',
    choices: [
      {
        label: t('Paranı geri iste', 'Ask for your money back'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('İşler iyi gidiyor! {uncle} amcan borcu faiziyle, üstüne bir tepsi baklavayla ödedi.', 'Business is booming! Uncle {uncle} paid you back with interest and a tray of baklava.'), money(num(ctx, 'amount') * 1.1), happy(4), rel('father', 4))
            : fx(t('"Biraz daha sabır" dedi. {motherName} "amcana ayıp" diye seni azarladı.', '"A little more patience," he said. {motherName} told you off for embarrassing him.'), rel('mother', -4), stress(3)),
      },
      {
        label: t('Fotoğraf kalsın, ömür boyu bedava döner', 'Keep the photo, free kebabs for life'),
        effects: () => fx(t('Maç çıkışları taraftarlar tabelanın önünde selfie çekiyor. Diyetisyenin bundan haberdar değil.', 'After matches fans take selfies under the sign. Your nutritionist has not been told.'), fans(4), rep(1), happy(3)),
      },
      {
        label: t('Tabelayı indirmesini iste', 'Demand the sign comes down'),
        effects: () => fx(t('Tabela indi. {uncle} amcan bir süre telefonlarını açmadı.', 'The sign came down. Uncle {uncle} stopped answering your calls for a while.'), rel('mother', -3), rel('father', 2), stress(2)),
      },
    ],
  },

  // ───────────── More standalone ─────────────
  {
    id: 'money.local_team_sponsor',
    category: 'money',
    weight: 1,
    cooldownWeeks: 30,
    conditions: () => true,
    vars: ({ state }, rng) => ({ team: rng.pick(LOCAL_TEAMS), amount: wageX(state, 2, 1500) }),
    title: t('Mahalle Takımının Forması', 'Kits for the Local Kids'),
    text: t(
      '{team} çocuk takımının antrenörü aradı: forma yok, top yok, krampon yarı yarıya. "Göğse senin adını yazarız, söz." Masraf {amount:money}.',
      'The coach of the {team} kids\' team called: no kits, no balls, half of them in borrowed boots. "We\'ll print your name on the chest, promise." Cost: {amount:money}.',
    ),
    icon: '👕',
    choices: [
      {
        label: t('Her şeyi sen karşıla', 'Pay for everything'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Şu an bütçen yok.', 'No budget right now.'),
        effects: (ctx) =>
          fx(
            t('Çocuklar yeni formalarla maça çıkınca fotoğraf gönderdiler. Telefonunun duvar kâğıdı oldu.', 'The kids sent a photo in their new kits. It is your phone wallpaper now.'),
            money(-num(ctx, 'amount')), rep(2), fans(4), happy(6),
          ),
      },
      {
        label: t('İmzalı formalar gönder, açık artırmaya çıksın', 'Send signed shirts to auction'),
        effects: () => fx(t('Açık artırma formaların yarısını karşıladı. Gerisini veliler tamamladı.', 'The auction covered half the kits. The parents chipped in the rest.'), rep(1), happy(3), energy(-4)),
      },
      {
        label: t('Takım arkadaşlarınla bağış maçı organize et', 'Organise a charity match with teammates'),
        effects: () => fx(t('{mate} kaleye geçti ve felaketti. Herkes eğlendi, para toplandı.', '{mate} went in goal and was a disaster. Everyone had fun and the money was raised.'), rel('teammate', 3), rep(2), energy(-10)),
      },
    ],
  },
  {
    id: 'money.bank_adviser',
    category: 'money',
    weight: 0.9,
    cooldownWeeks: 26,
    conditions: ({ state }) => state.life.money >= wageX(state, 10, 10000),
    vars: ({ state }, rng) => ({ adviser: pickFull(rng), amount: wageX(state, 10, 8000) }),
    title: t('Özel Bankacı', 'The Private Banker'),
    text: t(
      'Özel bankacın {adviser}, broşürdeki bir ürünü gösteriyor: "Anapara korumalı yapılandırılmış ürün. %18\'e varan getiri." Küçük yazılar çok küçük.',
      'Your private banker {adviser} points at a brochure: "Capital-protected structured note. Up to 18% returns." The small print is very small.',
    ),
    icon: '🏦',
    choices: [
      {
        label: t('{amount:money} yatır', 'Put in {amount:money}'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakit yok.', 'Not enough cash.'),
        effects: (ctx, rng) => {
          const a = num(ctx, 'amount')
          const r = rng.next()
          if (r < 0.6) return fx(t('Bir yıl sonra güzel bir getiri. {adviser} kendinden memnun.', 'A year later, a nice return. {adviser} looks very pleased with themself.'), money(a * 0.12), happy(2))
          if (r < 0.9) return fx(t('Getiri neredeyse sıfır; ücretler ise sıfır değil.', 'Returns barely moved; the fees did.'), money(-a * 0.02), stress(1))
          return fx(t('"Anapara koruması" meğer şartlıymış. Küçük yazılar büyük ısırdı.', 'The "capital protection" had conditions. The small print bit hard.'), money(-a * 0.25), stress(6))
        },
      },
      {
        label: t('Önce ücretleri sor', 'Ask about the fees first'),
        effects: () => fx(t('{adviser} kekeledi. Sonunda sade bir endeks fonu önerdi; sen de öğrendin ki soru sormak bedava.', '{adviser} stumbled, then suggested a plain index fund. Lesson learned: asking questions is free.'), happy(1), stress(-2), flags({ smart_saver: true })),
      },
      {
        label: t('Teşekkür et, paran yastık altında kalsın', 'Thanks, but the cash stays put'),
        effects: () => fx(t('{adviser} hayal kırıklığını profesyonelce sakladı.', '{adviser} hid the disappointment professionally.'), stress(-1)),
      },
    ],
  },
]
