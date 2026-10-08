/**
 * Business decision cards (playtest round 2: "businesses feel bolted on").
 * Each owned business now asks the owner real questions: expand, hire a
 * manager, run a marketing push, survive a crisis. Choices change the weekly
 * P&L through `bizBoost` (temporary revenue multiplier), `bizExpand`
 * (level up), `bizManager` (general manager) and the brand meter, so the
 * "İşletmelerin bu hafta" line moves because of what the player decided.
 *
 * Three kinds x four decisions are built by one factory (kind-specific
 * wording), plus four generic cards. Cooldowns are long and every card is
 * capped per career so a single business never turns into a spam source.
 */
import type { BusinessKind, GameState } from '../../../../core/types'
import { bizBoost, bizExpand, bizManager, brand, businessName, canAfford, fol, fx, happy, hasBusiness, money, nice, num, press, rep, stress, t, trust } from '../dsl'
import { upgradeCost, BUSINESS_DEFS } from '../../business'
import type { EventDef } from '../types'

const biz = (s: GameState, kind: BusinessKind) => (s.life.businesses ?? []).find((b) => b.kind === kind)

interface KindText {
  expandTitle: [string, string]
  expandText: [string, string]
  expandYes: [string, string]
  expandYesOut: [string, string]
  hireText: [string, string]
  mktTitle: [string, string]
  mktText: [string, string]
  crisisTitle: [string, string]
  crisisText: [string, string]
  crisisOwn: [string, string]
  crisisOwnOut: [string, string]
  crisisFight: [string, string]
  crisisWin: [string, string]
  crisisLose: [string, string]
}

const TEXTS: Record<BusinessKind, KindText> = {
  restaurant: {
    expandTitle: ['Yan Dükkân Boşaldı', 'The Shop Next Door Is Empty'],
    expandText: ['{biz}\'nin yanındaki dükkân kapandı. Mal sahibi duvarı yıkıp salonu büyütmene izin veriyor. Hafta sonları kapıda sıra var; masa sayısı artarsa ciro da artar. Maliyet {cost}.', 'The shop next to {biz} closed. The landlord lets you knock the wall through and enlarge the dining room. There is a queue at the door on weekends; more tables, more revenue. Cost: {cost}.'],
    expandYes: ['Duvarı yık, salonu büyüt ({cost:money})', 'Knock the wall through ({cost:money})'],
    expandYesOut: ['Üç hafta toz içinde çalıştınız, sonra yeni salon açıldı. İlk akşam bütün masalar doluydu ve şef ağladı. Seviye yükseldi.', 'Three weeks of dust, then the new dining room opened. Every table was full on night one and the chef cried. The place levels up.'],
    hireText: ['{biz}\'nin mutfağı sensiz de dönebilir ama sen sürekli arıyorsun. Eski bir şef müdürlüğe talip: "Siz maçınıza bakın, ben tabaklara bakarım." Haftalık maaşı {wageW}.', 'Your kitchen could run without you, yet you keep calling in. A veteran chef wants the manager job: "You mind the match, I mind the plates." Weekly pay: {wageW}.'],
    mktTitle: ['Ünlü Şef Gecesi', 'Celebrity Chef Night'],
    mktText: ['Bir yemek programı {biz}\'de özel bir akşam çekmeyi öneriyor. Reklam, davetliler, canlı müzik: toplam {spend}. Kamera önünde menünü tanıtacaksın.', 'A cooking show offers to film a special evening at {biz}. Promotion, guests, live music: {spend} in total. You present the menu on camera.'],
    crisisTitle: ['Yorum Sitesinde Fırtına', 'Review-Site Storm'],
    crisisText: ['{biz} hakkında bir yorum viral oldu: "Midem bozuldu, sahibi de ortada yok." Doğru olup olmadığı belirsiz. Rezervasyonlar iptal ediliyor.', 'A review about {biz} went viral: "Got sick, and the owner is nowhere to be seen." Whether it is true is unclear. Reservations are being cancelled.'],
    crisisOwn: ['Açıklama yap, mutfağı denetime aç', 'Make a statement and open the kitchen to inspection'],
    crisisOwnOut: ['Denetçiler her şeyi temiz buldu. Sen de yazıyı paylaşıp teşekkür ettin. İlk günler zor geçti, sonra güven geri geldi.', 'Inspectors found everything clean. You shared the post and thanked them. The first days were rough, then trust came back.'],
    crisisFight: ['Avukatı devreye sok, yazıyı kaldırt', 'Send the lawyer and have the post removed'],
    crisisWin: ['Yazı kaldırıldı. Ama "ünlü sahip eleştiriyi sildirdi" başlığı sosyal medyada dolaştı.', 'The post came down. But "famous owner silences critic" made the rounds on social media.'],
    crisisLose: ['Avukat yazının kaldırılamayacağını söyledi; fatura yine de geldi. Sosyal medya daha da sertleşti.', 'The lawyer said it cannot be removed; the bill came anyway. Social media got meaner.'],
  },
  gym: {
    expandTitle: ['Üst Kat Kiralandı Bile Değil', 'The Floor Above Is Free'],
    expandText: ['{biz}\'nin üst katı boşaldı. Ağırlık bölümünü genişletip bir grup dersi salonu açabilirsin. Üyeler zaten "yer yok" diye söyleniyor. Maliyet {cost}.', 'The floor above {biz} is free. You could extend the weights area and add a group-class studio. Members already grumble that there is no room. Cost: {cost}.'],
    expandYes: ['Üst katı da kullan ({cost:money})', 'Take the upper floor ({cost:money})'],
    expandYesOut: ['Yeni stüdyoda ilk reformer dersi bir saatte doldu. Üyelik listesi uzadı, bekleme listesi bile oluştu. Seviye yükseldi.', 'The first class in the new studio sold out in an hour. The membership list grew and even a waiting list formed. The place levels up.'],
    hireText: ['{biz}\'de kasadan temizliğe her şeyi sen takip ediyorsun, yorgunsun. Eski bir antrenör "salon müdürü olurum" diyor. Haftalık maaşı {wageW}.', 'You track everything at {biz}, from the till to the cleaning rota, and you are worn out. A former coach says he would make a fine gym manager. Weekly pay: {wageW}.'],
    mktTitle: ['Ocak Ayı Kampanyası', 'The New-Year Campaign'],
    mktText: ['Yeni yıl kararlıları kapıda. Afiş, fenomen anlaşması ve "ilk ay bedava" kampanyası için {spend} gerekiyor. Üyelerin yarısı kalırsa kâr eder.', 'The new-year resolution crowd is coming. Posters, an influencer deal and "first month free" cost {spend}. If half the members stay, it pays off.'],
    crisisTitle: ['Sakatlanan Üye', 'An Injured Member'],
    crisisText: ['Bir üye ağırlık bölümünde sırtını incitti ve {biz}\'i sorumlu tutuyor. Avukat mektubu geldi, haber siteleri ilgileniyor.', 'A member hurt their back in the weights area and blames {biz}. A lawyer\'s letter has arrived, news sites are interested.'],
    crisisOwn: ['Tedaviyi üstlen, güvenlik eğitimi başlat', 'Cover the treatment and start safety training'],
    crisisOwnOut: ['Üye tedavisini ödenmiş buldu ve davayı geri çekti. Antrenör ekibine güvenlik eğitimi verdin; bu da yazıya "örnek tutum" olarak girdi.', 'The member found the treatment covered and dropped the claim. You trained the coaching staff on safety, and the story ran as "exemplary response".'],
    crisisFight: ['Sigorta ve avukatla savun', 'Fight it with insurance and lawyers'],
    crisisWin: ['Mahkeme üyenin kendi ihmalini gördü. Salon kurtuldu ama manşet ve gerginlik kaldı.', 'The court saw the member\'s own fault. The gym is cleared but the headline and the tension remain.'],
    crisisLose: ['Sigorta tazminatın bir kısmını karşıladı, gerisi sana kaldı. Üyelik iptalleri arttı.', 'Insurance covered part of the compensation, the rest is on you. Cancellations climbed.'],
  },
  clothing: {
    expandTitle: ['Atölye Büyütme Fırsatı', 'A Chance to Grow the Workshop'],
    expandText: ['{biz} için bir tekstil atölyesi satılığa çıktı. Üretimi kendi çatın altına alırsan hem fire hem teslim süresi azalır. Maliyet {cost}.', 'A textile workshop is for sale. Bringing production under your own roof means less waste and faster delivery for {biz}. Cost: {cost}.'],
    expandYes: ['Atölyeyi satın al ({cost:money})', 'Buy the workshop ({cost:money})'],
    expandYesOut: ['Kendi dikim hattınız kuruldu. İlk koleksiyon bir hafta erken çıktı ve kalite fark edildi. Seviye yükseldi.', 'Your own sewing line is up. The first collection shipped a week early and the quality was noticed. The place levels up.'],
    hireText: ['{biz}\'in tasarım ve stok işlerini yürütemiyorsun. Büyük bir markadan ayrılan bir direktör işe talip. Haftalık maaşı {wageW}.', 'You cannot run design and stock for {biz} alone. A director who left a big brand wants the job. Weekly pay: {wageW}.'],
    mktTitle: ['Forma Altı Lansmanı', 'The Under-Shirt Launch'],
    mktText: ['{biz} yeni koleksiyonu için bir lansman fikri var: gol sevincinde logoyu göstermek ve fotoğrafçı tutmak. Toplam {spend}. Sezon başında dikkat çekeceğini söylüyorlar.', '{biz} has a launch idea for the new collection: flash the logo in a goal celebration and hire a photographer. {spend} in total. They say it will turn heads early in the season.'],
    crisisTitle: ['Sahte Ürün Salgını', 'The Counterfeit Wave'],
    crisisText: ['{biz} etiketli sahte ürünler pazarda. Müşteriler kalitesiz kumaştan şikâyet ediyor ve bu şikâyetler gerçek ürüne yazılıyor.', 'Fakes with the {biz} label are on the market. Customers complain about poor fabric, and the complaints are landing on the real product.'],
    crisisOwn: ['Resmî uyarı yap, orijinallik etiketi çıkar', 'Issue a notice and add authenticity tags'],
    crisisOwnOut: ['Hologramlı etiket müşterileri rahatlattı. Zahmetli ve masraflıydı ama güven toparlandı.', 'The hologram tags reassured customers. Costly and fiddly, but trust recovered.'],
    crisisFight: ['Dava aç, pazarlara baskın yaptır', 'Sue and raid the markets'],
    crisisWin: ['Baskında bin parça ele geçirildi. Haber olumlu çıktı ama masraf büyüktü.', 'A thousand pieces were seized in the raid. The story was positive but the costs were large.'],
    crisisLose: ['Satıcılar kayıplara karıştı; dava sürüncemede. Masraf geldi, çözüm gelmedi.', 'The sellers vanished and the case drags on. The costs came, the fix did not.'],
  },
}

const gate = (kind: BusinessKind) => ({ state }: { state: GameState }) => hasBusiness(state, kind)
const tt = (p: [string, string]) => t(p[0], p[1])

function perKind(kind: BusinessKind): EventDef[] {
  const x = TEXTS[kind]
  const def = BUSINESS_DEFS[kind]
  const cat = 'business' as const
  const id = (s: string) => `business.${s}_${kind}`
  return [
    {
      id: id('expand'), category: cat, weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
      conditions: ({ state }) => { const b = biz(state, kind); return !!b && b.level < 3 && state.hero.reputation >= 20 },
      vars: ({ state }) => ({ biz: businessName(state, kind), cost: upgradeCost(biz(state, kind) ?? { kind, level: 3 }) ?? 0 }),
      title: tt(x.expandTitle), text: tt(x.expandText), icon: def.icon,
      choices: [
        {
          label: tt(x.expandYes), risk: 'medium',
          requires: (c) => canAfford(c.state, num(c, 'cost')),
          lockedHint: t('Bunun için yeterli nakdin yok.', 'You do not have the cash for this.'),
          effects: (c) => fx(tt(x.expandYesOut), money(-num(c, 'cost')), bizExpand(num(c, 'cost'), 4, kind), stress(3), rep(1)),
        },
        {
          label: t('Şimdilik büyüme, mevcut hâli sağlamlaştır', 'Hold off and consolidate for now'),
          effects: () => fx(t('Muhasebeci rahat bir nefes aldı. Fırsat başkasına gitti; ama kasa sağlam kaldı.', 'The accountant breathed out. The chance went to someone else; the till stayed solid.'), stress(-2), brand(1, kind)),
        },
        {
          label: t('Ortak bul, maliyeti bölüş', 'Find a partner and split the cost'),
          risk: 'medium',
          requires: (c) => canAfford(c.state, Math.round(num(c, 'cost') * 0.45)),
          lockedHint: t('Pay bile karşılanamıyor.', 'You cannot even cover your share.'),
          effects: (c, rng) => rng.chance(0.65)
            ? fx(t('Ortak işini bildi; büyüme çıktı ve kâr paylaşıldı. Büyüdü ama ceplere giren az.', 'The partner knew the trade; the expansion landed and profits are shared. It grew, though less lands in your pocket.'), money(-Math.round(num(c, 'cost') * 0.45)), bizExpand(Math.round(num(c, 'cost') * 0.45), 3, kind))
            : fx(t('Ortak son anda çekildi, kapora geri gelmedi. Planlar suya düştü.', 'The partner pulled out at the last moment and the deposit never came back. The plan fell through.'), money(-Math.round(num(c, 'cost') * 0.08)), brand(-2, kind), stress(4)),
        },
      ],
    },
    {
      id: id('hire_manager'), category: cat, weight: 1, cooldownWeeks: 52, maxPerCareer: 1,
      conditions: ({ state }) => { const b = biz(state, kind); return !!b && !b.manager },
      vars: ({ state }) => ({ biz: businessName(state, kind), wageW: nice(1_500 * (biz(state, kind)?.level ?? 1)) }),
      title: t('Yönetici Arıyorsun', 'Looking for a Manager'), text: tt(x.hireText), icon: '🧑‍💼',
      choices: [
        {
          label: t('Genel müdürü işe al', 'Hire the general manager'),
          effects: () => fx(t('Anahtarlar devredildi. İlk hafta gelen telefonlar yarıya indi; ciro ise biraz oynadı. Uzun vadede sana yarayacak.', 'The keys changed hands. Calls dropped by half in week one while revenue wobbled. It should pay off over time.'), bizManager(true, 2, kind), stress(-4), happy(2)),
        },
        {
          label: t('Akrabanı getir', 'Bring in a relative'),
          risk: 'high',
          effects: (_c, rng) => rng.chance(0.5)
            ? fx(t('Kuzenin sandığından iyi çıktı: sorumlu, dürüst ve ucuz.', 'Your cousin turned out better than expected: responsible, honest and cheap.'), bizManager(true, 3, kind), stress(-3))
            : fx(t('Kuzen ilk ay kasadan "avans" aldı, ikinci ay sildi. İşten çıkarmak aile sofrasına girdi.', 'The cousin took an "advance" from the till in month one and vanished in month two. Firing them reached the family dinner table.'), money(-4_000), brand(-4, kind), stress(5)),
        },
        {
          label: t('Her şeyi kendin yönet', 'Run it all yourself'),
          effects: () => fx(t('Maç aralarında stok sayımı yaptın. Yorgun ama kontrol sende.', 'You counted stock between matches. Tired, but in control.'), stress(3), brand(1, kind)),
        },
      ],
    },
    {
      id: id('marketing'), category: cat, weight: 1, cooldownWeeks: 26, maxPerCareer: 3,
      conditions: ({ state }) => hasBusiness(state, kind) && state.hero.reputation >= 15,
      vars: ({ state }) => ({ biz: businessName(state, kind), spend: nice(Math.max(8_000, (biz(state, kind)?.level ?? 1) * def.price * 0.05)) }),
      title: tt(x.mktTitle), text: tt(x.mktText), icon: '📣',
      choices: [
        {
          label: t('Büyük kampanya ({spend:money})', 'Go big ({spend:money})'), risk: 'medium',
          requires: (c) => canAfford(c.state, num(c, 'spend')),
          lockedHint: t('Bütçe yetersiz.', 'Not enough budget.'),
          effects: (c, rng) => rng.chance(0.7)
            ? fx(t('Kampanya tuttu: haftalarca dolu dolu geçti ve sosyal medya konuştu.', 'The campaign landed: weeks of full houses and a social-media buzz.'), money(-num(c, 'spend')), bizBoost(6, 1.4, 8, kind), fol(1_500), rep(1))
            : fx(t('Kampanya beklenen yankıyı uyandırmadı. Para gitti, rakip daha yüksek sesle bağırdı.', 'The campaign did not echo the way you hoped. The money is gone and a rival shouted louder.'), money(-num(c, 'spend')), bizBoost(1, 1.1, 4, kind), stress(2)),
        },
        {
          label: t('Mahalle düzeyinde küçük bir iş', 'A small neighbourhood push'),
          requires: (c) => canAfford(c.state, Math.round(num(c, 'spend') / 4)),
          lockedHint: t('Bütçe yetersiz.', 'Not enough budget.'),
          effects: (c) => fx(t('Broşürler, bir mahalle maçına sponsorluk ve biraz iyi niyet. Ucuz, sakin, işe yarar.', 'Flyers, a local match sponsorship and some goodwill. Cheap, calm, it works.'), money(-Math.round(num(c, 'spend') / 4)), bizBoost(3, 1.12, 6, kind)),
        },
        {
          label: t('Bu sezon reklam yok', 'No advertising this season'),
          effects: () => fx(t('Para cebinde kaldı. İş kendi hâlinde yürüyor.', 'The money stays in your pocket. Business runs on its own.'), stress(-1)),
        },
      ],
    },
    {
      id: id('crisis'), category: cat, weight: 0.9, cooldownWeeks: 60, maxPerCareer: 2,
      conditions: gate(kind),
      vars: ({ state }) => ({ biz: businessName(state, kind), legal: nice(Math.max(15_000, (biz(state, kind)?.level ?? 1) * def.price * 0.06)) }),
      title: tt(x.crisisTitle), text: tt(x.crisisText), icon: '🚨',
      choices: [
        {
          label: tt(x.crisisOwn), risk: 'low',
          effects: () => fx(tt(x.crisisOwnOut), money(-5_000), bizBoost(-1, 0.88, 4, kind), press(2), stress(2)),
        },
        {
          label: tt(x.crisisFight), risk: 'high',
          requires: (c) => canAfford(c.state, num(c, 'legal')),
          lockedHint: t('Avukat masrafını karşılayamazsın.', 'You cannot cover the legal bill.'),
          effects: (c, rng) => rng.chance(0.55)
            ? fx(tt(x.crisisWin), money(-num(c, 'legal')), bizBoost(-2, 0.92, 3, kind), press(-2))
            : fx(tt(x.crisisLose), money(-Math.round(num(c, 'legal') * 1.5)), bizBoost(-9, 0.65, 8, kind), press(-4), stress(4)),
        },
        {
          label: t('Sessiz kal, fırtına geçsin', 'Stay silent and let it pass'),
          effects: () => fx(t('Fırtına dinene kadar masalar yarı boş kaldı. Biraz da hırçınlaştı; "sahip sessiz" yazıldı.', 'Tables stayed half empty until the storm passed. "Owner silent" got written, too.'), bizBoost(-6, 0.75, 6, kind), stress(3)),
        },
      ],
    },
  ]
}

const generic: EventDef[] = [
  {
    id: 'business.supplier_deal', category: 'business', weight: 1, cooldownWeeks: 40, maxPerCareer: 2,
    conditions: ({ state }) => hasBusiness(state),
    vars: ({ state }) => ({ biz: businessName(state), pay: nice(Math.max(12_000, (state.life.businesses?.[0]?.invested ?? 200_000) * 0.04)) }),
    title: t('Toptancıdan Yıllık Anlaşma', 'The Supplier\'s Annual Deal'),
    text: t('{biz}\'nin toptancısı peşin ödemeye indirim öneriyor: bu yıl {pay} peşin, karşılığında yıl boyu daha ucuz mal ve öncelikli teslimat. Hesap makinesi güzel görünüyor; peki ya işler kötüye giderse?', 'The supplier of {biz} offers a discount for paying up front: {pay} now, in return for a year of cheaper goods and priority delivery. The calculator looks good; what if business turns bad?'),
    icon: '📦',
    choices: [
      { label: t('Peşin öde ({pay:money})', 'Pay up front ({pay:money})'), requires: (c) => canAfford(c.state, num(c, 'pay')), lockedHint: t('Peşin ödeyecek nakdin yok.', 'No cash for an up-front payment.'),
        effects: (c) => fx(t('Mal ucuzladı, teslimat hızlandı. Muhasebeci "iyi iş" dedi.', 'Goods got cheaper and delivery quicker. The accountant said, "good deal".'), money(-num(c, 'pay')), bizBoost(2, 1.1, 20)) },
      { label: t('Vadeli pazarlık yap', 'Haggle for instalments'), effects: () => fx(t('Daha az indirim aldın ama nakit kasada kaldı.', 'You got a smaller discount, but the cash stayed in the till.'), bizBoost(1, 1.04, 12)) },
      { label: t('Toptancıyı değiştir', 'Switch supplier'), risk: 'medium', effects: (_c, rng) => rng.chance(0.5) ? fx(t('Yeni toptancı daha taze ve ucuz çıktı.', 'The new supplier turned out fresher and cheaper.'), bizBoost(3, 1.08, 12)) : fx(t('Yeni toptancı iki kez geç teslim etti; müşteri fark etti.', 'The new supplier delivered late twice and customers noticed.'), bizBoost(-3, 0.9, 6), stress(2)) },
    ],
  },
  {
    id: 'business.entrepreneur_award', category: 'business', weight: 0.8, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => hasBusiness(state) && state.hero.reputation >= 40,
    vars: ({ state }) => ({ biz: businessName(state), gala: nice(Math.max(10_000, state.hero.reputation * 300)) }),
    title: t('Yılın Sporcu Girişimcisi', 'Athlete Entrepreneur of the Year'),
    text: t('Bir iş dergisi {biz}\'i "sporcu girişimci" dalında adaylar arasına koydu. Ödül gecesi masası {gala}; kazanırsan basın seni "futbolcu ama patron" diye yazacak.', 'A business magazine has shortlisted {biz} for "athlete entrepreneur". A table at the awards night costs {gala}; win it, and the press will write "footballer, but a boss".'),
    icon: '🏅',
    choices: [
      { label: t('Masa al, takım elbiseyi giy ({gala:money})', 'Buy a table and dress up ({gala:money})'), requires: (c) => canAfford(c.state, num(c, 'gala')), lockedHint: t('Masayı karşılayamıyorsun.', 'You cannot afford a table.'),
        effects: (c, rng) => rng.chance(0.5) ? fx(t('Kazandın! Mikrofona "ekip sayesinde" dedin ve bunu gerçekten kastettin.', 'You won! You said "thanks to the team" at the mic and meant it.'), money(-num(c, 'gala')), brand(8), rep(2), press(4), happy(6)) : fx(t('Kazanamadın ama ağ kurdun: iki yatırımcı kartvizit bıraktı.', 'You did not win, but you networked: two investors left cards.'), money(-num(c, 'gala')), brand(3), press(1)) },
      { label: t('Çalışanları gönder', 'Send the staff instead'), effects: () => fx(t('Ekip gururla gitti; sen maça odaklandın.', 'The team went proudly; you stayed focused on the match.'), brand(2), happy(2)) },
      { label: t('Adaylığı reddet: "Ben futbolcuyum"', 'Decline: "I am a footballer"'), effects: () => fx(t('Basın bunu mütevazılık saydı.', 'The press called it modesty.'), press(1), trust(1)) },
    ],
  },
  {
    id: 'business.silent_partner', category: 'business', weight: 0.8, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => hasBusiness(state) && (state.life.businesses ?? []).some((b) => b.totalProfit > 50_000),
    vars: ({ state }) => ({ biz: businessName(state), buy: nice(Math.max(30_000, (state.life.businesses?.[0]?.invested ?? 200_000) * 0.25)) }),
    title: t('Sessiz Ortağın Çıkışı', 'The Silent Partner Wants Out'),
    text: t('{biz}\'e ilk günden destek veren sessiz ortak, yurt dışına taşınıyor ve payını {buy} karşılığında sana sunuyor. Kabul edersen kâr tamamen senin; reddedersen payı bir yabancıya satacak.', 'The silent partner who backed {biz} from day one is moving abroad and offers you their share for {buy}. Accept and the profit is all yours; decline and the share goes to a stranger.'),
    icon: '🤝',
    choices: [
      { label: t('Payı satın al ({buy:money})', 'Buy the share ({buy:money})'), requires: (c) => canAfford(c.state, num(c, 'buy')), lockedHint: t('Pay için nakdin yok.', 'No cash for the share.'),
        effects: (c) => fx(t('Artık patron tek: sensin. Sorumluluk arttı, kâr da.', 'You are the only boss now. Responsibility grew, and so did profit.'), money(-num(c, 'buy')), bizBoost(4, 1.12, 26), stress(2)) },
      { label: t('Yabancıya satmasına izin ver', 'Let the stranger buy in'), risk: 'medium', effects: (_c, rng) => rng.chance(0.5) ? fx(t('Yeni ortak sorun çıkarmadı; hatta iş çevresi getirdi.', 'The new partner caused no trouble and even brought contacts.'), bizBoost(2, 1.06, 20), brand(2)) : fx(t('Yeni ortak her kararda söz hakkı istedi. Toplantılar uzadı, ciro sendeledi.', 'The new partner wants a say in every decision. Meetings dragged on, revenue wobbled.'), bizBoost(-3, 0.92, 12), stress(4)) },
      { label: t('Elinden gelmez: iş olduğu gibi kalsın', 'Cannot afford it: leave it as it is'), effects: () => fx(t('Hiçbir şey değişmedi. Bunu şimdilik rahatlık say.', 'Nothing changed. Call that comfort for now.'), stress(1)) },
    ],
  },
  {
    id: 'business.year_review', category: 'business', weight: 1, cooldownWeeks: 52, maxPerCareer: 4, triggers: ['season_end'],
    conditions: ({ state }) => hasBusiness(state) && (state.life.businesses ?? []).some((b) => b.history.length >= 4),
    vars: ({ state }) => {
      const total = (state.life.businesses ?? []).reduce((s, b) => s + b.history.reduce((p, h) => p + h.profit, 0), 0)
      return { biz: businessName(state), p8: Math.round(total), keep: nice(Math.max(5_000, Math.abs(total) * 0.4)) }
    },
    title: t('Sezon Sonu Hesabı', 'End-of-Season Accounts'),
    text: t('Muhasebeci son sekiz haftanın toplamını masaya koydu: {p8:money}. "Bu parayla ne yapalım?" diyor. {biz} büyümeye aç, ama sen de dinlenmek istiyorsun.', 'The accountant puts the last eight weeks on the table: {p8:money}. "What do we do with this?" {biz} is hungry to grow, and you would like a rest.'),
    icon: '🧾',
    choices: [
      { label: t('Yeniden yatır ({keep:money})', 'Reinvest ({keep:money})'), requires: (c) => canAfford(c.state, num(c, 'keep')), lockedHint: t('Yatıracak nakdin yok.', 'No cash to put in.'),
        effects: (c) => fx(t('Yeni ekipman, yeni tabela, yeni enerji. İşletme buna yanıt verdi.', 'New equipment, new signage, new energy. The business responded.'), money(-num(c, 'keep')), bizBoost(4, 1.15, 12)) },
      { label: t('Kendine öde, tatile çık', 'Pay yourself and take a holiday'), effects: (c) => fx(t('Birkaç günlük gerçek mola. İşletme duraksadı ama sen gülümsüyorsun.', 'A few days of real rest. The business paused, but you are smiling.'), money(Math.round(Math.max(0, num(c, 'p8')) * 0.2)), happy(6), stress(-6)) },
      { label: t('Çalışanlara prim dağıt', 'Hand out staff bonuses'), effects: () => fx(t('Ekip morale kavuştu; müşteriler de bunu hissetti.', 'Staff morale soared and customers felt it.'), money(-6_000), brand(5), bizBoost(2, 1.06, 10), happy(3)) },
    ],
  },
]

export const businessDecisionEvents: EventDef[] = [...perKind('restaurant'), ...perKind('gym'), ...perKind('clothing'), ...generic]
