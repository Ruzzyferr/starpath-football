/**
 * Business: life as an owner (sim/life/business). Most cards need a business
 * (restaurant / gym / clothing label); the cousin chain is how many players
 * first think about owning one.
 *
 * Chains:
 * - Clothing collab: collab_offer → collab_launch
 * - Cousin: cousin_venture → cousin_followup
 */
import {
  brand, businessName, canAfford, chain, fans, flags, follow, fx, happy, hasBusiness, hasFlag, money, news, num, pickBrand, press, rel, rep,
  stress, t, wageX, folPct, energy,
} from '../dsl'
import type { EventDef } from '../types'

export const businessEvents: EventDef[] = [
  {
    id: 'business.staff_raise',
    category: 'business',
    weight: 1.2,
    cooldownWeeks: 16,
    conditions: ({ state }) => hasBusiness(state),
    vars: ({ state }) => ({ biz: businessName(state), cost: wageX(state, 1, 1500) }),
    title: t('Personel Toplantısı', 'Staff Meeting'),
    text: t(
      '{biz} çalışanları kapıda: "Patron, enflasyon bizi de vuruyor." Talep: toplam {cost:money} zam. Arkadan bir garson elinde pankartla bekliyor; pankartta senin forma numaran var.',
      'The {biz} staff are at the door: "Prices are killing us too." The ask: a {cost:money} raise in total. A waiter in the back holds a sign with your shirt number on it.',
    ),
    icon: '🧑‍🍳',
    choices: [
      {
        label: t('Zammı ver', 'Give the raise'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'cost')),
        lockedHint: t('Kasada yeterli para yok.', 'Not enough cash in the till.'),
        effects: (ctx) => fx(t('Alkış koptu. Garson pankartı çevirdi: "TEŞEKKÜRLER {shirt}".', 'Applause. The waiter flipped the sign: "THANK YOU {shirt}".'), money(-num(ctx, 'cost')), brand(6), happy(3)),
      },
      {
        label: t('Kâr payı sistemi öner', 'Offer profit-sharing instead'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Kabul ettiler. Şimdi herkes müşteriye bir tatlı daha satmaya çalışıyor.', 'They accepted. Now everyone is trying to upsell one more dessert.'), brand(4), stress(1))
            : fx(t('"Kâr mı? Hangi kâr?" dediler. Haklı olabilirler.', '"Profit? What profit?" they asked. They may have a point.'), brand(-3), stress(3)),
      },
      {
        label: t('Reddet', 'Refuse'),
        effects: () => fx(t('İki kişi istifa etti. Biri de internete "patron futbolu biliyor, işletmeyi bilmiyor" diye yorum yazdı.', 'Two people quit. One left a review: "The boss knows football, not business."'), brand(-8), stress(2)),
      },
    ],
  },
  {
    id: 'business.celebrity_visit',
    category: 'business',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasBusiness(state),
    vars: ({ state }, rng) => ({ biz: businessName(state), star: rng.pick(['rapçi Kuzgun', 'şef Mira Volkan', 'oyuncu Tarık Serin', 'dizi yıldızı Ela Dağ']) }),
    title: t('Ünlü Misafir', 'A Famous Guest'),
    text: t(
      '{star} habersiz {biz}\'a geldi. Herkes telefonunu çıkardı. Çalışanlar senden talimat bekliyor.',
      '{star} walked into {biz} unannounced. Phones are out everywhere. The staff look to you for instructions.',
    ),
    icon: '🌟',
    choices: [
      {
        label: t('Ortak fotoğraf çek, paylaş', 'Take a photo together and post it'),
        effects: (ctx) => fx(t('Fotoğraf iki milyon kez görüntülendi. Ertesi gün kapıda kuyruk vardı.', 'Two million views. The next day there was a queue at the door.'), brand(8), folPct(ctx, 3)),
      },
      {
        label: t('Mahremiyetine saygı göster', 'Respect their privacy'),
        effects: () => fx(t('Hesabı sen ödedin, kimseye söylemedin. {star} ertesi gün kendisi paylaştı: "Burası bir cennet."', 'You paid the bill and told no one. Next day {star} posted it themself: "This place is heaven."'), brand(10), rep(1)),
      },
    ],
  },
  {
    id: 'business.inspection',
    category: 'business',
    weight: 1,
    cooldownWeeks: 18,
    conditions: ({ state }) => hasBusiness(state, 'restaurant') || hasBusiness(state, 'gym'),
    vars: ({ state }) => ({ biz: businessName(state, hasBusiness(state, 'restaurant') ? 'restaurant' : 'gym'), fine: wageX(state, 1, 1000) }),
    title: t('Denetim Kapıda', 'Inspector at the Door'),
    text: t(
      'Belediye denetçisi {biz}\'da. Panoyla dolaşıyor, buzdolabının arkasına bakıyor, bir şeyler not ediyor. Not ettiği şey iyi bir şeye benzemiyor.',
      'A council inspector is at {biz}. Clipboard, looking behind the fridge, writing things down. What they write does not look good.',
    ),
    icon: '📋',
    choices: [
      {
        label: t('Eksikleri hemen düzelttir', 'Fix everything on the spot'),
        effects: (ctx) => fx(t('Bir gecede her şey pırıl pırıl. Denetçi "keşke herkes böyle olsa" dedi.', 'Spotless by morning. The inspector said "if only everyone was like this".'), money(-num(ctx, 'fine')), brand(4)),
      },
      {
        label: t('Forma ve imza teklif et', 'Offer a signed shirt'),
        hint: t('Rüşvete benziyor mu? Evet.', 'Does it look like a bribe? Yes.'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.3)
            ? fx(t('Denetçi formayı aldı, raporu yine de yazdı. En azından imzan değerli.', 'The inspector took the shirt and wrote the report anyway. At least your autograph has value.'), money(-num(ctx, 'fine')))
            : fx(t('Denetçi tutanağa "rüşvet teşebbüsü" yazdı. Gazeteler de.', 'The inspector noted "attempted bribery". So did the papers.'), money(-num(ctx, 'fine') * 3), brand(-12), press(-6), news(t('{heroName}\'in işletmesine denetimde "forma" skandalı', 'Shirt-for-inspection scandal at {heroName}\'s business'), -1)),
      },
      {
        label: t('Cezayı öde, itiraz etme', 'Pay the fine, no fuss'),
        effects: (ctx) => fx(t('Ceza ödendi, rapor ilan panosuna asıldı. Müşteriler okudu.', 'Fine paid, report pinned on the door. Customers read it.'), money(-num(ctx, 'fine')), brand(-4)),
      },
    ],
  },
  {
    id: 'business.gym_claim',
    category: 'business',
    weight: 0.9,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasBusiness(state, 'gym'),
    vars: ({ state }) => ({ biz: businessName(state, 'gym'), claim: wageX(state, 2, 2000) }),
    title: t('Ağırlık Kazası', 'The Dumbbell Incident'),
    text: t(
      '{biz}\'da bir üye, telefonla selfie çekerken dambılı ayağına düşürdü. Şimdi {claim:money} tazminat istiyor. Selfie çok güzel çıkmış ama.',
      'At {biz} a member dropped a dumbbell on their foot while taking a selfie. Now they want {claim:money} in damages. Great selfie though.',
    ),
    icon: '🏋️',
    choices: [
      {
        label: t('Uzlaş, ödemeyi yap', 'Settle and pay'),
        effects: (ctx) => fx(t('Ödedin. Üye bir yıllık bedava üyelik de aldı; hâlâ selfie çekiyor.', 'You paid. They got a free year of membership too; still taking selfies.'), money(-num(ctx, 'claim')), brand(2)),
      },
      {
        label: t('Kamera kayıtlarını göster', 'Show the CCTV'),
        effects: (ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('Kayıtta telefon net görünüyor. Dava düştü; video da internete düştü.', 'The footage clearly shows the phone. Case dropped; the video also went viral.'), brand(3), folPct(ctx, 1))
            : fx(t('Kamera o gün kapalıymış. Avukat masrafı da eklendi.', 'The camera was off that day. Legal costs on top.'), money(-num(ctx, 'claim') * 1.4), stress(4)),
      },
      {
        label: t('Salona "telefonsuz bölge" kuralı getir', 'Make the gym a phone-free zone'),
        effects: (ctx) => fx(t('Tazminatı ödedin, kural getirdin. Üyeler önce kızdı, sonra antrenmanları ikiye katlandı.', 'You paid and brought in the rule. Members grumbled, then their workouts doubled.'), money(-num(ctx, 'claim') * 0.8), brand(5)),
      },
    ],
  },
  {
    id: 'business.collab_offer',
    category: 'business',
    weight: 1,
    cooldownWeeks: 30,
    maxPerCareer: 2,
    conditions: ({ state }) => hasBusiness(state, 'clothing'),
    vars: ({ state }, rng) => ({ biz: businessName(state, 'clothing'), partnerBrand: `${pickBrand(rng)} Street`, cost: wageX(state, 3, 3000) }),
    title: t('Ortak Koleksiyon', 'The Collab'),
    text: t(
      'Sokak modası markası {partnerBrand}, {biz} ile ortak bir koleksiyon istiyor. Tasarım ekibi var, sen de forma numaranı ve yüzünü getireceksin. Ön yatırım: {cost:money}.',
      'Streetwear label {partnerBrand} wants a joint collection with {biz}. They bring the designers; you bring your shirt number and your face. Upfront: {cost:money}.',
    ),
    icon: '🧢',
    choices: [
      {
        label: t('Anlaşmayı imzala', 'Sign the deal'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'cost')),
        lockedHint: t('Ön yatırımı karşılayamazsın.', 'You can\'t cover the upfront cost.'),
        effects: (ctx) => fx(t('Moodboard\'lar uçuşuyor. Bir tasarımcı "kramponlu terlik" önerdi; reddettin.', 'Moodboards everywhere. A designer pitched "studded slippers"; you vetoed it.'), money(-num(ctx, 'cost')), stress(2), follow(chain('business.collab_launch', 3))),
      },
      {
        label: t('Kendi ekibinle devam et', 'Stick with your own team'),
        effects: () => fx(t('Bağımsızlık güzel. Ama {partnerBrand} rakip bir futbolcuyla anlaştı.', 'Independence is nice. But {partnerBrand} signed a rival player instead.'), brand(-2)),
      },
    ],
  },
  {
    id: 'business.collab_launch',
    category: 'business',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Lansman Gecesi', 'Launch Night'),
    text: t(
      '{biz} × {partnerBrand} koleksiyonu yarın gece yarısı satışta. Ekip tek bir soru soruyor: lansmanı nasıl yapalım?',
      'The {biz} × {partnerBrand} collection drops at midnight tomorrow. The team has one question: how do we launch it?',
    ),
    icon: '🚀',
    choices: [
      {
        label: t('Takım arkadaşlarını mankenlik için çağır', 'Get your teammates to model it'),
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Defile bir komediye döndü, video milyonlarca izlendi. Stok bir saatte bitti!', 'The catwalk turned into a comedy show and the video got millions of views. Sold out in an hour!'), money(num(ctx, 'cost') * 2.5), brand(12), rel('teammate', 4), folPct(ctx, 4))
            : fx(t('Kaleci podyumdan düştü. Komik ama satış ortalama.', 'The keeper fell off the catwalk. Funny, sales average.'), money(num(ctx, 'cost') * 1.1), brand(3), rel('teammate', 3)),
      },
      {
        label: t('Kazancın bir kısmını gençlik akademisine bağışla', 'Pledge part of the profit to the youth academy'),
        effects: (ctx) => fx(t('Satış iyi geçti; bağış haberi daha da iyi geçti.', 'Sales were good; the donation story was even better.'), money(num(ctx, 'cost') * 1.4), brand(8), fans(4), rep(1)),
      },
      {
        label: t('Sınırlı sayıda, numaralı üretim', 'Limited, numbered run'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Koleksiyoncular kapıştı. Biri tişörtü on katına sattı.', 'Collectors fought over it. One resold a T-shirt for ten times the price.'), money(num(ctx, 'cost') * 2), brand(10))
            : fx(t('"Sınırlı" olan talep çıktı. Depoda kutular duruyor.', 'Turns out the demand was the limited part. Boxes in the warehouse.'), money(num(ctx, 'cost') * 0.6), brand(-4), stress(3)),
      },
    ],
  },
  {
    id: 'business.investor',
    category: 'business',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasBusiness(state) && state.hero.reputation >= 30,
    vars: ({ state }, rng) => ({ biz: businessName(state), fund: `${pickBrand(rng)} Capital`, offer: wageX(state, 10, 30000) }),
    title: t('Yatırımcı Telefonu', 'An Investor Calls'),
    text: t(
      '{fund}, {biz} için büyüme ortağı olmak istiyor: {offer:money} karşılığında yönetimde söz hakkı. "Biz sadece rakamlara bakarız" diyorlar. Sen de rakamlara bakıyorsun.',
      '{fund} want to become a growth partner in {biz}: {offer:money} for a say in how it\'s run. "We only look at the numbers," they say. You\'re looking at the numbers too.',
    ),
    icon: '💼',
    choices: [
      {
        label: t('Teklifi kabul et', 'Accept the offer'),
        effects: (ctx) => fx(t('Para geldi, toplantılar da. Her salı saat 9\'da. Excel ile.', 'The money came, and so did the meetings. Every Tuesday at 9. With spreadsheets.'), money(num(ctx, 'offer')), brand(4), stress(3)),
      },
      {
        label: t('Kontrol bende kalsın', 'Keep control'),
        effects: () => fx(t('"Benim adım, benim kararım." Fon kibarca vazgeçti.', '"My name, my call." The fund politely withdrew.'), happy(2)),
      },
    ],
  },
  {
    id: 'business.teammates_discount',
    category: 'business',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasBusiness(state) && !!state.hero.contract,
    vars: ({ state }) => ({ biz: businessName(state), cost: wageX(state, 0.5, 500) }),
    title: t('"Takıma İndirim Var mı?"', '"Team Discount?"'),
    text: t(
      '{mate} grupta sordu: "{biz}\'da bize indirim var mı?" Yirmi dört kişi "yazıyor..." durumunda.',
      '{mate} asks in the group chat: "Any discount for us at {biz}?" Twenty-four people are "typing...".',
    ),
    icon: '🤑',
    choices: [
      {
        label: t('Takıma her şey bedava!', 'Everything free for the squad!'),
        effects: (ctx) => fx(t('Bir haftada {cost:money} gitti, kalecinin yediği tatlıları saymıyoruz. Soyunma odası seni seviyor.', '{cost:money} gone in a week, not counting the keeper\'s desserts. The dressing room loves you.'), money(-num(ctx, 'cost') * 2), rel('teammate', 5), brand(2)),
      },
      {
        label: t('%20 indirim, adil olsun', '20% off, keep it fair'),
        effects: (ctx) => fx(t('Makul ve herkes memnun. Kaleci yine de iki porsiyon istedi.', 'Reasonable, everyone\'s happy. The keeper still ordered two portions.'), money(-num(ctx, 'cost') * 0.5), rel('teammate', 2)),
      },
      {
        label: t('"İş iştir" de', 'Say "business is business"'),
        effects: () => fx(t('Haklısın ama grubun sessizliği çok uzun sürdü.', 'You\'re right, but the group chat went very quiet.'), rel('teammate', -3)),
      },
    ],
  },
  // ───────────── Cousin chain (entry point, no business needed) ─────────────
  {
    id: 'business.cousin_venture',
    category: 'business',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    conditions: ({ state }) => !hasBusiness(state) && state.life.money >= wageX(state, 10, 20000) && !hasFlag(state, 'cousin_venture'),
    vars: (_ctx, rng) => ({ cousin: rng.pick(['Kuzen Tayfun', 'Kuzen Nihat', 'Kuzen Gülşah', 'Kuzen Serdar']), idea: rng.pick(['döner + smoothie dükkânı', 'futbolcu temalı kafe', 'gece açık spor salonu']) }),
    title: t('Kuzenin İş Fikri', 'Your Cousin\'s Big Idea'),
    text: t(
      '{cousin} bayram sofrasında elinde peçeteye çizilmiş bir planla geldi: "{idea}! Senin adın, benim emeğim." Peçetede bir de logo var. Logo senin yüzün.',
      '{cousin} turned up at the holiday dinner with a plan sketched on a napkin: "{idea}! Your name, my hard work." There\'s a logo too. The logo is your face.',
    ),
    icon: '🧻',
    choices: [
      {
        label: t('"Önce bir iş planı getir"', '"Bring me a proper business plan first"'),
        effects: () => fx(t('{cousin} "tamam" dedi. Kuzenler "tamam" dediğinde genelde başka bir şey olur.', '{cousin} said "fine". When cousins say "fine", something else usually happens.'), rel('father', 1), flags({ cousin_venture: true }), follow(chain('business.cousin_followup', 4))),
      },
      {
        label: t('Kesin bir dille reddet', 'Firm no'),
        effects: () => fx(t('Sofrada üç saniye sessizlik oldu, sonra baklava geldi.', 'Three seconds of silence at the table, then the baklava arrived.'), rel('mother', -1), flags({ cousin_venture: true }), follow(chain('business.cousin_followup', 6))),
      },
      {
        label: t('Kendi işini kurmayı düşün (Yaşam → İşletmeler)', 'Think about running your own (Life → Business)'),
        effects: () => fx(t('Fikri beğendin ama ortaklığı değil. Gerçek bir işletme için Yaşam ekranındaki "İşletmeler" sekmesine baktın.', 'You liked the idea, not the partnership. You opened the "Business" tab in Life to look at doing it properly.'), happy(2), flags({ cousin_venture: true, business_curious: true })),
      },
    ],
  },
  {
    id: 'business.cousin_followup',
    category: 'business',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ fee: wageX(state, 1, 1500) }),
    title: t('Tabelada Adın Var', 'Your Name Is on the Sign'),
    text: t(
      '{cousin} dükkânı açmış. Tabelada kocaman senin yüzün ve "{heroName} onaylı!" yazısı. Kimse sana sormadı. Dükkân da şaşırtıcı derecede kalabalık.',
      '{cousin} opened the shop anyway. Your giant face on the sign and "{heroName} approved!" Nobody asked you. The place is also surprisingly busy.',
    ),
    icon: '🪧',
    choices: [
      {
        label: t('Lisans ücreti iste', 'Ask for a licensing fee'),
        effects: (ctx) => fx(t('{cousin} söylendi ama ödedi. Bayramlar artık biraz soğuk.', '{cousin} grumbled but paid. Holidays are a bit frosty now.'), money(num(ctx, 'fee') * 2), rel('mother', -2)),
      },
      {
        label: t('Destekle, açılışa git', 'Support it, show up at the opening'),
        effects: () => fx(t('Kurdeleyi kestin, mahalle bayram etti. {cousin} ağladı.', 'You cut the ribbon, the neighbourhood partied. {cousin} cried.'), fans(4), rel('mother', 3), rel('father', 2), energy(-6), press(2)),
      },
      {
        label: t('Avukatla yüzünü tabeladan indirt', 'Have a lawyer take your face down'),
        effects: (ctx) => fx(t('Tabela değişti. Yeni logo: "Tanınmış Bir Futbolcunun Kuzeni". Dürüst.', 'New sign: "Cousin of a Well-Known Footballer". Honest.'), money(-num(ctx, 'fee')), rel('mother', -4), news(t('{heroName} kuzenine dava açtı mı?', 'Is {heroName} suing a cousin?'), -1)),
      },
    ],
  },
]
