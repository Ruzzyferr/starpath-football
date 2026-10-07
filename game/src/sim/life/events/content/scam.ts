/**
 * Scams: crypto gurus, fake super-agents, phishing texts and a teammate's
 * "can't-lose" scheme. Rule of thumb the cards teach: if a stranger promises
 * guaranteed returns, the only guaranteed return is theirs.
 *
 * Chains:
 * - Crypto: crypto_guru → crypto_moon → crypto_rugpull
 * - Fake agent: fake_agent → fake_agent_vanishes
 * - Ponzi: ponzi_teammate → ponzi_payout → ponzi_collapse
 */
import {
  canAfford, chain, fans, flags, follow, fx, happy, hasClub, hasFlag, money, news, num, pickBrand, pickFull, press, rel, relNpc,
  rep, stress, t, trust, wageX, folPct, disc,
} from '../dsl'
import type { EventDef } from '../types'

const GURUS = ['KriptoKral_Efe', 'MoonMentor', 'Bay Lambo', 'ZenginOl.exe', 'Satoshi\'nin Kuzeni'] as const

export const scamEvents: EventDef[] = [
  // ───────────── Crypto guru (3 steps) ─────────────
  {
    id: 'scam.crypto_guru',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => state.life.money >= wageX(state, 3, 2000) && !hasFlag(state, 'crypto_bag'),
    vars: ({ state }, rng) => ({ guru: rng.pick(GURUS), coin: `${pickBrand(rng).toUpperCase()}COIN`, amount: wageX(state, 3, 2000) }),
    title: t('Ay\'a Gidiyoruz 🚀', 'To the Moon 🚀'),
    text: t(
      '{guru} adlı bir hesap DM attı: "{coin} yarın listeleniyor. Ünlü yatırımcılar kapıda, sana özel ön satış: {amount:money}. Lambo rengini şimdiden seç kardeşim."',
      'An account called {guru} slides into your DMs: "{coin} lists tomorrow. Big names are in, pre-sale just for you: {amount:money}. Pick your Lambo colour now, bro."',
    ),
    icon: '🪙',
    choices: [
      {
        label: t('Yatır, ne olacak ki', 'Invest, what could go wrong'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakdin yok. Belki de şanslısın.', 'Not enough cash. Lucky you, maybe.'),
        effects: (ctx) => fx(t('Gönderdin. {guru} "Hoş geldin aileye 🦍" yazdı. Ailede kaç kişi var, bilmiyorsun.', 'Sent. {guru} replied "welcome to the family 🦍". You don\'t know how big the family is.'), money(-num(ctx, 'amount')), stress(3), flags({ crypto_bag: true }), follow(chain('scam.crypto_moon', 1))),
      },
      {
        label: t('{agentName}\'a sor', 'Ask {agentName}'),
        effects: () => fx(t('{agentName} on saniye güldü, sonra "Engelle" dedi. Engelledin.', '{agentName} laughed for ten seconds, then said "Block." You blocked.'), stress(-1), happy(1)),
      },
      {
        label: t('Hesabı ifşa et', 'Expose the account'),
        effects: (ctx) => fx(t('Ekran görüntüsünü paylaştın: "Sizi de rahatsız ediyor mu?" Takipçilerin {guru}\'yu topluca şikâyet etti.', 'You posted the screenshot: "Do they bother you too?" Your followers reported {guru} en masse.'), folPct(ctx, 2), press(2), rep(1)),
      },
    ],
  },
  {
    id: 'scam.crypto_moon',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Grafik Dikey', 'The Chart Goes Vertical'),
    text: t(
      '{coin} bir haftada %300 yükseldi! {guru} canlı yayında ağlıyor. Takım arkadaşların soyunma odasında "bize de söyleseydin" diyor. Satmak mı, beklemek mi?',
      '{coin} is up 300% in a week! {guru} is crying on a livestream. Your teammates say "you could\'ve told us". Sell, or hold?',
    ),
    icon: '📈',
    choices: [
      {
        label: t('Hepsini sat', 'Sell everything'),
        effects: (ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('Sattın. İki saat sonra grafik şelaleye döndü. Hayatının en iyi zamanlaması.', 'You sold. Two hours later the chart became a waterfall. Best timing of your life.'), money(num(ctx, 'amount') * 3), happy(6), flags({ crypto_bag: null }))
            : fx(t('Satış butonu "bakımda". Bakım hiç bitmedi.', 'The sell button says "under maintenance". Maintenance never ended.'), stress(6), flags({ crypto_bag: null }), follow(chain('scam.crypto_rugpull', 1))),
      },
      {
        label: t('Elmas eller! Bekle 💎', 'Diamond hands! Hold 💎'),
        risk: 'high',
        effects: () => fx(t('Bekledin. Takım otobüsünde her dakika grafiğe baktın. Hoca telefonu aldı.', 'You held. You checked the chart every minute on the team bus. The gaffer confiscated your phone.'), stress(4), trust(-1), follow(chain('scam.crypto_rugpull', 1))),
      },
      {
        label: t('Takım arkadaşlarına da öner', 'Tip off your teammates'),
        risk: 'high',
        effects: () => fx(t('Beş kişi girdi. Soyunma odası artık bir borsa salonu.', 'Five of them bought in. The dressing room is now a trading floor.'), rel('teammate', 2), flags({ crypto_tipped: true }), follow(chain('scam.crypto_rugpull', 1))),
      },
    ],
  },
  {
    id: 'scam.crypto_rugpull',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Halı Çekildi', 'The Rug Is Pulled'),
    text: t(
      '{coin} sıfıra indi. {guru} hesabını sildi, son paylaşımı bir tekne fotoğrafıydı. Tekne güzel.',
      '{coin} is worth zero. {guru} deleted the account; the last post was a picture of a yacht. Nice yacht.',
    ),
    icon: '📉',
    choices: [
      {
        label: t('Polise ve savcılığa başvur', 'Report it to the police'),
        effects: (ctx) =>
          fx(t('Dosyan 412 numaralı şikâyet oldu. Memur "Sizden önce bir milli takım kalecisi geldi" dedi.', 'Yours is complaint number 412. The officer says a national team goalkeeper came in before you.'), stress(3), press(1), flags({ crypto_bag: null }), ...(hasFlag(ctx.state, 'crypto_tipped') ? [rel('teammate', -5)] : [])),
      },
      {
        label: t('Herkese açıkça özür dile', 'Publicly apologise to everyone'),
        effects: (ctx) => fx(t('"Ben de kandırıldım, siz kandırılmayın" videon bir uyarı kampanyasına dönüştü.', 'Your "I got fooled, don\'t you" video turned into a public warning campaign.'), rep(2), press(4), fans(2), stress(-2), flags({ crypto_bag: null, crypto_tipped: null }), ...(hasFlag(ctx.state, 'crypto_tipped') ? [rel('teammate', -2)] : []), news(t('{heroName}: "Kripto gurularına inanmayın"', '{heroName}: "Don\'t trust crypto gurus"'), 1)),
      },
      {
        label: t('Sessizce yasını tut', 'Mourn in silence'),
        effects: () => fx(t('Gece iki kez uyandın, ikisinde de aklına tekne geldi.', 'You woke twice in the night. Both times you thought of the yacht.'), stress(6), happy(-5), flags({ crypto_bag: null })),
      },
    ],
  },
  // ───────────── Fake agent ─────────────
  {
    id: 'scam.fake_agent',
    category: 'scam',
    weight: 0.9,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation < 70,
    vars: ({ state }, rng) => ({ fakeAgent: pickFull(rng), fee: wageX(state, 2, 2500), bigClub: rng.pick(['Real Atlético Norte', 'AC Valmonte', 'Royal Kingsbridge', 'Sporting Aurora']) }),
    title: t('Süper Menajer', 'The Super-Agent'),
    text: t(
      'Altın kol düğmeli {fakeAgent} kartını uzatıyor: "{bigClub} seni istiyor. Tek yapman gereken {fee:money} dosya masrafı. Mevcut menajerine söyleme, kıskanır."',
      '{fakeAgent}, gold cufflinks, hands you a card: "{bigClub} want you. All you need is {fee:money} for paperwork. Don\'t tell your current agent; they\'ll get jealous."',
    ),
    icon: '🕴️',
    choices: [
      {
        label: t('Dosya masrafını öde', 'Pay the paperwork fee'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'fee')),
        lockedHint: t('Neyse ki paran yok.', 'Luckily, you\'re broke.'),
        effects: (ctx) => fx(t('Havale gitti. {fakeAgent} "Pazartesi haber veririm" dedi.', 'Transfer sent. {fakeAgent} said "I\'ll call you Monday."'), money(-num(ctx, 'fee')), stress(2), follow(chain('scam.fake_agent_vanishes', 1))),
      },
      {
        label: t('{bigClub}\'ı kendin ara', 'Call {bigClub} yourself'),
        effects: () => fx(t('Santral seni üç kez bekletti, sonra "Böyle birini tanımıyoruz" dedi. Kartı çöpe attın.', 'The switchboard put you on hold three times, then said "We don\'t know this person." Card in the bin.'), happy(2), rel('agent', 2)),
      },
      {
        label: t('Menajerine anlat', 'Tell your agent'),
        effects: () => fx(t('{agentName} kartı görünce kahvesini püskürttü: "Bu adam geçen yıl da aynı kulübü satıyordu."', '{agentName} spat out their coffee: "This guy was selling the same club last year."'), rel('agent', 4), stress(-1)),
      },
    ],
  },
  {
    id: 'scam.fake_agent_vanishes',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Pazartesi Gelmedi', 'Monday Never Came'),
    text: t(
      '{fakeAgent}\'in telefonu kapalı. Ofis adresi bir kuru temizlemeciye çıktı. Kuru temizlemeci de onu arıyor.',
      '{fakeAgent}\'s phone is off. The office address is a dry cleaner\'s. The dry cleaner is looking for them too.',
    ),
    icon: '👻',
    choices: [
      {
        label: t('Şikâyetçi ol', 'File a complaint'),
        effects: (ctx, rng) =>
          rng.chance(0.35)
            ? fx(t('Polis yakaladı! Paranın yarısı iade edildi. Kol düğmeleri delil olarak alındı.', 'Police caught them! Half your money came back. The cufflinks were taken as evidence.'), money(num(ctx, 'fee') * 0.5), happy(4))
            : fx(t('Dosya açıldı, sonuç çıkmadı. Ama artık her kartvizite kuşkuyla bakıyorsun.', 'A file was opened, nothing came of it. You now distrust every business card.'), stress(3)),
      },
      {
        label: t('Gerçek menajerinden özür dile', 'Apologise to your real agent'),
        effects: () => fx(t('{agentName} sesli güldü ama kırılmıştı. "Bir dahaki sefere önce beni ara."', '{agentName} laughed out loud, but was hurt. "Next time, call me first."'), rel('agent', 3), happy(-2)),
      },
    ],
  },
  // ───────────── Phishing ─────────────
  {
    id: 'scam.phishing',
    category: 'scam',
    weight: 1.1,
    cooldownWeeks: 30,
    conditions: ({ state }) => state.life.money > 2000,
    vars: ({ state }) => ({ loss: wageX(state, 1.5, 800) }),
    title: t('"Hesabınız Bloke Edildi"', '"Your Account Has Been Blocked"'),
    text: t(
      'SMS: "Sayin musterimiz hesabiniz bloke olmustur, acmak icin tiklayiniz: bankaa-guvenli.biz". Maç önü otelde, yarı uykulusun ve başparmağın linkin üstünde.',
      'Text: "Dear custumer your acount is blocked, click to unlock: bankk-secure.biz". It\'s the night before a match, you\'re half asleep in the hotel, thumb hovering over the link.',
    ),
    icon: '📲',
    choices: [
      {
        label: t('Linke tıkla, şifreni gir', 'Click and enter your password'),
        risk: 'high',
        effects: (ctx) => fx(t('Sabah hesabından {loss:money} eksilmiş. Banka iade için form istedi; formun linki gerçekti, bu sefer.', 'By morning {loss:money} was gone. The bank wants a refund form; this time the link was real.'), money(-num(ctx, 'loss')), stress(8), happy(-4)),
      },
      {
        label: t('Bankayı kendin ara', 'Call the bank yourself'),
        effects: () => fx(t('"Biz SMS ile şifre istemeyiz efendim." Bunu biliyordun, şimdi daha çok biliyorsun.', '"We never ask for passwords by text, sir/madam." You knew that. Now you really know it.'), stress(-1), disc(1)),
      },
      {
        label: t('Takım grubuna uyarı at', 'Warn the team chat'),
        effects: () => fx(t('Üç kişi "ben tıklamıştım" yazdı. Kulüp bilgi işlemi herkese ders verdi. Kahraman sensin.', 'Three people replied "I already clicked". Club IT gave everyone a lesson. You\'re the hero.'), rel('teammate', 2), trust(1)),
      },
    ],
  },
  // ───────────── Ponzi teammate (3 steps) ─────────────
  {
    id: 'scam.ponzi_teammate',
    category: 'scam',
    weight: 0.9,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && state.life.money >= wageX(state, 4, 3000),
    vars: ({ state }, rng) => ({ amount: wageX(state, 4, 3000), scheme: `${pickBrand(rng)} Kapital` }),
    title: t('Garantili %20', 'Guaranteed 20%'),
    text: t(
      '{mate} soyunma odasında sessizce yanına oturdu: "{scheme}. Ayda %20, garantili. Ben de girdim, bak, ilk ay ödendi." Telefonundaki ekran görüntüsü gerçekten çok yeşil.',
      '{mate} sits down next to you in the dressing room: "{scheme}. 20% a month, guaranteed. I\'m in. Look, first month paid out." The screenshot is very, very green.',
    ),
    icon: '🔺',
    choices: [
      {
        label: t('{amount:money} yatır', 'Put in {amount:money}'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakdin yok.', 'Not enough cash.'),
        effects: (ctx) => fx(t('{mate} sarıldı: "Zengin olacağız!" Formalar terli, umutlar büyük.', '{mate} hugged you: "We\'re getting rich!" Sweaty shirts, big dreams.'), money(-num(ctx, 'amount')), relNpc(ctx.vars.mateId, ctx.vars.mate, 5), flags({ ponzi_in: true }), follow(chain('scam.ponzi_payout', 2))),
      },
      {
        label: t('Nazikçe reddet', 'Politely decline'),
        effects: (ctx) => fx(t('"Ben paramı yastık altında tutarım" dedin. {mate} seni dinozor ilan etti.', '"I keep my money under the mattress," you said. {mate} declared you a dinosaur.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -3)),
      },
      {
        label: t('{mate}\'yi uyar: "Bu bir piramit"', 'Warn {mate}: "This is a pyramid"'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Şemayı kâğıda çizdin. {mate} sustu, sonra parasını çekti. Sana bir akşam yemeği borçlu.', 'You drew the scheme on paper. {mate} went quiet, then withdrew. They owe you dinner.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 10), rep(1))
            : fx(t('"Kıskançsın" dedi ve masadan kalktı.', '"You\'re just jealous," they said, and left the table.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -6)),
      },
    ],
  },
  {
    id: 'scam.ponzi_payout',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('İlk Ödeme Geldi', 'The First Payout'),
    text: t(
      '{scheme} gerçekten ödedi! Hesabına %20 yattı. {mate} "Şimdi iki arkadaş getirirsen bonus var" diyor. Kulağa tanıdık geliyor mu?',
      '{scheme} actually paid! 20% hit your account. {mate} says "bring two friends and there\'s a bonus". Sound familiar?',
    ),
    icon: '💸',
    choices: [
      {
        label: t('Parayı çek, çık', 'Cash out and leave'),
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Ana para ve kâr hesabında. Kapıdan çıkarken arkana bakmadın.', 'Principal plus profit, safely back. You didn\'t look back.'), money(num(ctx, 'amount') * 1.2), happy(5), flags({ ponzi_in: null }))
            : fx(t('"Çekim talepleri 30 gün içinde işlenir." 30 gün çok uzun.', '"Withdrawals are processed within 30 days." 30 days is a long time.'), money(num(ctx, 'amount') * 0.2), stress(5), follow(chain('scam.ponzi_collapse', 2))),
      },
      {
        label: t('Takım arkadaşlarını da kat', 'Recruit teammates too'),
        risk: 'high',
        effects: (ctx) => fx(t('Üç arkadaş daha girdi. Bonusun geldi. Vicdanın biraz kaşınıyor.', 'Three more teammates joined. Your bonus arrived. Your conscience itches a little.'), money(num(ctx, 'amount') * 0.5), flags({ ponzi_recruiter: true }), follow(chain('scam.ponzi_collapse', 2))),
      },
      {
        label: t('Kazancı da geri yatır', 'Reinvest the gains'),
        risk: 'high',
        effects: () => fx(t('Bileşik faiz! Excel tablon çok güzel görünüyor.', 'Compound interest! Your spreadsheet looks gorgeous.'), happy(3), follow(chain('scam.ponzi_collapse', 2))),
      },
    ],
  },
  {
    id: 'scam.ponzi_collapse',
    category: 'scam',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Piramit Çöktü', 'The Pyramid Falls'),
    text: t(
      '{scheme}\'in sitesi açılmıyor. Kurucu "uzun bir tatile" çıkmış. Soyunma odasında kimse kimsenin gözüne bakmıyor.',
      '{scheme}\'s website is down. The founder has gone on "an extended holiday". Nobody in the dressing room will look anyone in the eye.',
    ),
    icon: '🧱',
    choices: [
      {
        label: t('Getirdiğin arkadaşlara paralarını kendin öde', 'Repay the friends you brought in yourself'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Ödeyecek nakdin yok.', 'No cash to repay them.'),
        effects: (ctx) => fx(t('Cebinden ödedin. Pahalı bir ders, ama takım sana hâlâ güveniyor.', 'You paid out of pocket. An expensive lesson, but the squad still trusts you.'), money(-num(ctx, 'amount')), rel('teammate', 4), rep(1), flags({ ponzi_in: null, ponzi_recruiter: null })),
      },
      {
        label: t('Kulüple birlikte avukat tut', 'Hire a lawyer with the club'),
        effects: (ctx) => fx(t('Kulüp hukukçuları devreye girdi. Paranın bir kısmı belki dönecek; utanç dönmeyecek.', 'Club lawyers stepped in. Some money may come back; the embarrassment won\'t.'), money(num(ctx, 'amount') * 0.25), stress(5), press(-2), flags({ ponzi_in: null }), ...(hasFlag(ctx.state, 'ponzi_recruiter') ? [rel('teammate', -6)] : [])),
      },
      {
        label: t('{mate}\'yi suçla', 'Blame {mate}'),
        effects: (ctx) =>
          fx(
            t('Bağırdın, o da bağırdı. Gazeteler "soyunma odasında piramit kavgası" yazdı.', 'You shouted, they shouted. The papers ran "pyramid feud in the dressing room".'),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -15), stress(4), trust(-2),
            news(t('{clubName} soyunma odasında saadet zinciri kavgası', 'Ponzi row rocks {clubName} dressing room'), -1),
            flags({ ponzi_in: null, ponzi_recruiter: null }),
          ),
      },
    ],
  },
]
