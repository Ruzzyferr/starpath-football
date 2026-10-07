/** Club & chairman: contracts, PR duties, boardroom politics. */
import {
  boss, canAfford, chairman, disc, energy, fans, flags, follow, fx, happy, hasClub, hasFlag, money, morale, news, num, press, rel, relVal, rep, stress,
  t, chain, trust, wageX, folPct, pickBrand,
} from '../dsl'
import type { EventDef } from '../types'

export const clubEvents: EventDef[] = [
  {
    id: 'club.contract_hint',
    category: 'club',
    weight: (ctx) => (ctx.state.hero.contract && ctx.state.hero.contract.untilSeason - ctx.state.calendar.season <= 1 ? 2 : 0.6),
    cooldownWeeks: 30,
    minWeek: 4,
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'contract_talks_open'),
    vars: ({ state }) => ({ raise: wageX(state, 0.4, 200) }),
    title: t('Koridorda Bir Laf', 'A Word in the Corridor'),
    text: t(
      'Başkan {chairmanName} tesislerde yanına geldi, omzuna dokundu: "Seninle yakında güzel bir sözleşme konuşalım. Ama sezon ortasında menajerler araya girmesin, değil mi?"',
      'Chairman {chairmanName} catches you at the training ground and pats your shoulder: "We should talk about a nice new contract soon. But let\'s keep agents out of it mid-season, eh?"',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('"Menajerim {agentName} her şeyi konuşur."', '"My agent {agentName} handles all that."'),
        effects: () =>
          fx(
            t('Başkanın gülümsemesi bir milim daraldı. Ama masaya ciddi bir teklif gelecek.', 'The chairman\'s smile narrowed by a millimetre. A serious offer is coming, though.'),
            chairman(-3),
            rel('agent', 5),
            flags({ contract_talks_open: true, contract_leverage: 2 }),
            follow(chain('club.contract_offer', 3)),
          ),
      },
      {
        label: t('Başkanla baş başa konuşmayı kabul et', 'Agree to talk one-on-one'),
        risk: 'medium',
        effects: () =>
          fx(
            t('Başkan sevindi. Menajerin {agentName} öğrenince pek sevinmedi.', 'The chairman is delighted. {agentName}, on hearing, is not.'),
            chairman(6),
            rel('agent', -8),
            flags({ contract_talks_open: true, contract_leverage: 1 }),
            follow(chain('club.contract_offer', 3)),
          ),
      },
      {
        label: t('"Önce sezonu bitirelim başkanım."', '"Let\'s finish the season first."'),
        effects: () => fx(t('Başkan saygıyla başını salladı. Konu şimdilik kapandı.', 'He nods with respect. The subject is closed for now.'), chairman(3), trust(2), morale(1)),
      },
    ],
  },
  {
    id: 'club.contract_offer',
    category: 'club',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    /** Fallback only; the parent's {raise} overrides it. */
    vars: ({ state }) => ({ raise: wageX(state, 0.4, 200) }),
    title: t('Masadaki Teklif', 'The Offer on the Table'),
    text: t(
      'Kulüp sözleşme taslağını yolladı: haftalık {raise:money} zam ve bir yıl uzatma. Bir yandan da {rivalClub}\'ın ilgisi konuşuluyor.',
      'The club sends a draft: a {raise:money} weekly raise and a one-year extension. Meanwhile, whispers say {rivalClub} are interested.',
    ),
    icon: '📝',
    choices: [
      {
        label: t('İmzala, mutlu ol', 'Sign it and be happy'),
        effects: (ctx) =>
          fx(
            t('İmzalar atıldı. Taraftar "sadakat" pankartı astı. (Yeni sözleşme şartları kariyer ekranında işlenecek.)', 'Pen meets paper. The fans unfurl a "loyalty" banner. (New terms are processed on the career screen.)'),
            money(num(ctx, 'raise') * 4),
            fans(8),
            chairman(8),
            happy(5),
            flags({ contract_talks_open: null, contract_leverage: null, contract_extension_agreed: num(ctx, 'raise') }),
            news(t('{heroName} {clubName}\'a imzayı attı', '{heroName} commits future to {clubName}'), 1),
          ),
      },
      {
        label: t('Daha fazlasını iste', 'Hold out for more'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.3 + (Number(ctx.state.life.flags['contract_leverage']) || 0) * 0.15 + ctx.state.hero.reputation / 300)
            ? fx(
                t('Başkan pes etti: zam iki katına çıktı. Bir imza bonusu da cabası.', 'The chairman blinked: the raise doubled, plus a signing bonus.'),
                money(num(ctx, 'raise') * 8),
                chairman(-4),
                happy(7),
                flags({ contract_talks_open: null, contract_leverage: null, contract_extension_agreed: num(ctx, 'raise') * 2 }),
              )
            : fx(
                t('Görüşmeler çöktü. Basın "açgözlü" kelimesini kullandı.', 'Talks collapsed. The press used the word "greedy".'),
                chairman(-10),
                fans(-8),
                press(-3),
                stress(6),
                flags({ contract_talks_open: null, contract_leverage: null, wants_out: true }),
              ),
      },
      {
        label: t('Kararı ertele, {rivalClub}\'ı bekle', 'Stall and wait for {rivalClub}'),
        effects: () =>
          fx(t('Belirsizlik devam ediyor. Başkan sabırlı ama sonsuza kadar değil.', 'Uncertainty drags on. The chairman is patient, but not forever.'), chairman(-5), rep(1), stress(4), flags({ contract_talks_open: null })),
      },
    ],
  },
  {
    id: 'club.kit_launch',
    category: 'club',
    weight: 1,
    cooldownWeeks: 40,
    triggers: ['new_season', 'weekly'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 15,
    vars: (_ctx, rng) => ({ brand: pickBrand(rng) }),
    title: t('Yeni Forma Lansmanı', 'New Kit Launch'),
    text: t(
      'Kulüp yeni sezon formasını {brand} ile tanıtıyor ve yüz olarak seni istiyor. Tasarım... cesur. Yeşil-mor zikzak, yakasında da bir tuhaf püskül.',
      'The club is launching next season\'s {brand} kit and wants you as the face. The design is... bold. Green-and-purple zigzags and a tassel on the collar.',
    ),
    icon: '👕',
    choices: [
      {
        label: t('Gülümse ve pozunu ver', 'Smile and strike a pose'),
        effects: (ctx) =>
          fx(t('Fotoğraflar her yerde. Mizahı seven taraftarlar bayıldı.', 'The photos are everywhere. Fans with a sense of humour adore it.'), chairman(6), folPct(ctx, 5), rep(1), money(500)),
      },
      {
        label: t('İronik bir video çek', 'Shoot an ironic video'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Video viral oldu, forma satışları rekor kırdı.', 'The video went viral and shirt sales set a record.'), folPct(ctx, 10), chairman(8), rep(2))
            : fx(t('Sponsor ironiyi anlamadı. Kulüp özür yayımladı.', 'The sponsor didn\'t get the irony. The club issued an apology.'), chairman(-8), disc(-3), folPct(ctx, 3)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('Lansmana {mate} çıktı. Püskül ona daha çok yakıştı açıkçası.', '{mate} did it instead. Honestly, the tassel suited {g:him|her}.'), chairman(-5), stress(-2)),
      },
    ],
  },
  {
    id: 'club.pr_duty',
    category: 'club',
    weight: 1.1,
    cooldownWeeks: 14,
    conditions: ({ state }) => hasClub(state),
    title: t('Basın Görevi', 'PR Duty'),
    text: t(
      'İletişim ofisi takvimine bir etkinlik koymuş: sponsor süpermarketin açılışında kurdele kesip iki saat imza dağıtacaksın. Tam da dinlenme gününde.',
      'The comms office booked you in: cut a ribbon at a sponsor supermarket opening and sign autographs for two hours. On your only rest day.',
    ),
    icon: '✂️',
    choices: [
      {
        label: t('Git, gülümse', 'Go and smile'),
        effects: () => fx(t('Kurdele kesildi, çocuklar mutlu, bacakların yorgun.', 'Ribbon cut, kids happy, legs tired.'), energy(-10), chairman(4), fans(4), rep(1)),
      },
      {
        label: t('Git ve fazladan bir saat kal', 'Go and stay an extra hour'),
        effects: () =>
          fx(t('Son çocuğa kadar imza verdin. Yerel gazetede güzel bir fotoğraf çıktı.', 'You signed for every last kid. A lovely photo ran in the local paper.'), energy(-18), fans(8), chairman(5), rep(2), happy(3)),
      },
      {
        label: t('"Hastayım" de', 'Call in "sick"'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Kimse sorgulamadı. Koltuk ve dizi günü.', 'Nobody questioned it. Sofa and box-set day.'), energy(10), happy(3), chairman(-3))
            : fx(t('Aynı gün kafede fotoğrafın çekildi. İletişim ofisi çılgına döndü.', 'Someone snapped you at a café that same day. The comms office is livid.'), chairman(-10), disc(-6), press(-3)),
      },
    ],
  },
  {
    id: 'club.chairman_dinner',
    category: 'club',
    weight: (ctx) => (ctx.state.hero.reputation >= 35 ? 1 : 0.4),
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'chairman_favour_pending'),
    title: t('Başkanın Yemeği', "The Chairman's Dinner"),
    text: t(
      '{chairmanName} seni yalıdaki özel yemeğe davet etti. Masada iş insanları, siyasetçiler, bir de çok konuşan bir müteahhit var. Tatlıdan sonra başkan seni kenara çekiyor: "Bir ricam olacak."',
      '{chairmanName} invites you to a private dinner at the waterfront mansion. Business people, politicians and one very talkative developer. After dessert he pulls you aside: "I have a little favour to ask."',
    ),
    icon: '🍽️',
    choices: [
      {
        label: t('"Tabii başkanım, buyurun."', '"Of course, Mr Chairman."'),
        risk: 'medium',
        effects: () =>
          fx(
            t('"Müteahhit dostumun yeni projesinin reklamında oynarsın." Bir imza, bir gülümseme.', '"You\'ll appear in my developer friend\'s new advert." A signature, a smile.'),
            chairman(10),
            money(2000),
            flags({ chairman_favour_pending: true }),
            follow(chain('club.chairman_favour', 3)),
          ),
      },
      {
        label: t('Önce ne olduğunu sor', 'Ask what it is first'),
        effects: () =>
          fx(t('Başkan bir an durdu: "Boş ver, önemli değil." Bir şey kaçırdın mı, kurtuldun mu, bilmiyorsun.', 'He paused: "Never mind, it\'s nothing." You\'re not sure whether you dodged something or missed out.'), chairman(-3), stress(2)),
      },
      {
        label: t('Erken ayrıl, yarın antrenman var', 'Leave early, training tomorrow'),
        effects: () => fx(t('Profesyonelsin. Hoca duyunca gülümsedi; başkan duyunca gülümsemedi.', 'Professional. The gaffer smiled when he heard; the chairman didn\'t.'), boss(4), trust(2), chairman(-5)),
      },
    ],
  },
  {
    id: 'club.chairman_favour',
    category: 'club',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Reklamın Bedeli', 'The Price of the Advert'),
    text: t(
      'Reklam yayına girdi ve aynı hafta müteahhidin projesi çevre protestolarının merkezine oturdu. Taraftar grupları senin yüzünü pankartlara koydu.',
      'The advert aired, and that same week the developer\'s project became the centre of environmental protests. Supporter groups put your face on their banners.',
    ),
    icon: '🏗️',
    choices: [
      {
        label: t('Reklamdan çekildiğini açıkla', 'Publicly withdraw from the advert'),
        effects: () =>
          fx(t('Taraftar alkışladı. Başkanın telefonları artık sesli mesaja düşüyor.', 'The fans applauded. The chairman\'s calls now go straight to voicemail.'), fans(10), press(3), chairman(-15), flags({ chairman_favour_pending: null })),
      },
      {
        label: t('Başkanın arkasında dur', 'Stand by the chairman'),
        effects: () =>
          fx(t('Yönetim katında dostun var. Tribünde ise ıslıklar.', 'You have a friend upstairs. In the stands, whistles.'), chairman(10), fans(-12), stress(6), flags({ chairman_favour_pending: null })),
      },
      {
        label: t('Ücreti bir çevre derneğine bağışla', 'Donate the fee to an environmental charity'),
        requires: (ctx) => canAfford(ctx.state, 2000),
        lockedHint: t('2.000 € gerek.', 'Needs €2,000.'),
        effects: () =>
          fx(
            t('Zarif bir çıkış. Herkes biraz memnun, kimse tam memnun değil.', 'An elegant exit. Everyone\'s a bit happy, nobody completely.'),
            money(-2000),
            fans(5),
            rep(2),
            chairman(-4),
            flags({ chairman_favour_pending: null }),
          ),
      },
    ],
  },
  {
    id: 'club.ticket_protest',
    category: 'club',
    weight: 0.9,
    cooldownWeeks: 40,
    triggers: ['new_season', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Bilet Zammı Protestosu', 'Ticket Price Protest'),
    text: t(
      'Kulüp kombine fiyatlarına %40 zam yaptı. Taraftarlar maçın ilk 10 dakikasında tribünleri boş bırakacak. Bir taraftar temsilcisi senden destek mesajı istiyor.',
      'The club hiked season tickets by 40%. Fans plan to leave the stands empty for the first ten minutes. A supporters\' rep asks you for a message of support.',
    ),
    icon: '🎟️',
    choices: [
      {
        label: t('Taraftarı destekle', 'Back the fans'),
        risk: 'medium',
        effects: () => fx(t('Tribünlerde adın yazılı pankartlar. Yönetimde ise soğuk yüzler.', 'Banners with your name in the stands. Cold faces in the boardroom.'), fans(12), chairman(-12), rep(2)),
      },
      {
        label: t('Tarafsız kal', 'Stay neutral'),
        effects: () => fx(t('"Ben futbolcuyum, gerisini konuşamam." Kimse kızmadı, kimse sevmedi.', '"I\'m a footballer, I can\'t comment on the rest." Nobody angry, nobody impressed.'), fans(-2), stress(-1)),
      },
      {
        label: t('Kendi cebinden 100 gence kombine al', 'Buy 100 season tickets for local kids yourself'),
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 3, 3000)),
        lockedHint: t('Bunun için yeterli birikimin yok.', 'You don\'t have the savings for that.'),
        effects: (ctx) =>
          fx(
            t('Hem taraftar hem yönetim seni alkışladı. Böyle bir orta yol nadir bulunur.', 'Both fans and board applauded. A rare middle ground.'),
            money(-wageX(ctx.state, 3, 3000)),
            fans(10),
            chairman(4),
            rep(3),
            happy(4),
            news(t('{heroName}\'dan çocuklara kombine jesti', '{heroName} buys season tickets for local kids'), 1),
          ),
      },
    ],
  },
  {
    id: 'club.academy_visit',
    category: 'club',
    weight: 0.9,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state),
    title: t('Altyapıda Bir Gün', 'A Day at the Academy'),
    text: t(
      'Altyapı direktörü 12 yaş altı takımı için bir konuşma yapmanı istiyor. Ön sırada bir çocuk elinde senin forman, gözlerini senden ayırmıyor.',
      'The academy director asks you to give a talk to the under-12s. In the front row, a kid clutches your shirt and won\'t stop staring.',
    ),
    icon: '⚽',
    choices: [
      {
        label: t('Samimi bir konuşma yap, kendi hatalarını anlat', 'Give an honest talk about your own mistakes'),
        effects: () => fx(t('Çocuklar güldü, antrenörler not aldı. Kendini iyi hissettin.', 'The kids laughed, the coaches took notes. You felt good.'), happy(6), chairman(3), energy(-5), morale(3)),
      },
      {
        label: t('Konuşmayı bırak, onlarla maç yap', 'Skip the speech and play a match with them'),
        risk: 'low',
        effects: (_ctx, rng) =>
          rng.chance(0.85)
            ? fx(t('9 yaşındaki bir çocuk sana bacak arası attı. Gününün en güzel anı.', 'A nine-year-old nutmegged you. Best moment of your day.'), happy(9), fans(4), energy(-8))
            : fx(t('Çocuklardan biri kaval kemiğine kramponla geldi. Gülerek topalladın.', 'One of them studded your shin. You limped off laughing.'), happy(5), energy(-10), stress(1)),
      },
      {
        label: t('İmza ver, hızlıca çık', 'Sign a few shirts and slip out'),
        effects: () => fx(t('Görev tamamlandı. Ön sıradaki çocuğun yüzü biraz düştü.', 'Duty done. The kid in the front row looked a little crestfallen.'), energy(-2), chairman(1)),
      },
    ],
  },
  {
    id: 'club.board_loyalty_test',
    category: 'club',
    weight: (ctx) => (relVal(ctx.state, 'chairman') < -20 ? 1.5 : 0.4),
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state),
    title: t('Yönetimden Mektup', 'A Letter from the Board'),
    text: t(
      'Yönetim kurulu tüm oyunculara "sosyal medya davranış kuralları" belgesi imzalatıyor. Madde 7: kulüp politikalarını eleştirmek yasak, cezası haftalık maaş kesintisi.',
      'The board wants every player to sign a "social media conduct" agreement. Clause 7: criticising club policy is banned, punishable by a week\'s wages.',
    ),
    icon: '📜',
    choices: [
      {
        label: t('İmzala', 'Sign it'),
        effects: () => fx(t('Mürekkep kurudu. Biraz daha sessiz bir futbolcusun artık.', 'The ink dries. You\'re a slightly quieter footballer now.'), chairman(5), morale(-3)),
      },
      {
        label: t('Oyuncu sendikasına danış', 'Consult the players\' union'),
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Sendika maddeyi geçersiz saydırdı. Takım arkadaşların sana minnettar.', 'The union got clause 7 struck out. Your teammates are grateful.'), rel('teammate', 6), chairman(-6), rep(1))
            : fx(t('Süreç uzadı, gerginlik arttı. Belge hâlâ masada.', 'The process dragged on and tensions rose. The document is still on the table.'), chairman(-8), stress(5)),
      },
      {
        label: t('Belgeyi yırtıp fotoğrafını paylaş', 'Tear it up and post the photo'),
        risk: 'high',
        effects: (ctx) =>
          fx(
            t('İnternet seni kahraman ilan etti. Yönetim ise ceza kesti.', 'The internet declared you a hero. The board issued a fine.'),
            folPct(ctx, 8),
            fans(6),
            chairman(-15),
            money(-wageX(ctx.state, 1, 500)),
            disc(-8),
          ),
      },
    ],
  },
]
