/**
 * Legal: contracts, image rights, traffic. Lawyers are expensive, courts are
 * slow, and the small print is always smaller than you think.
 *
 * Chains:
 * - Contract dispute (4 steps): contract_clause → lawyer_strategy → hearing → verdict
 * - Image rights: image_rights → image_rights_settlement
 * - Traffic: traffic_offence → traffic_court
 */
import {
  boss, canAfford, chain, chairman, disc, fans, flagNum, flags, follow, fx, happy, hasClub, money, news, num, pickBrand, press,
  rel, rep, stress, t, trust, wageX, folPct,
} from '../dsl'
import type { EventDef } from '../types'

const LAWYERS = ['Av. Selin Çevik', 'Av. Orhan Tunç', 'Av. Mira Lindqvist', 'Av. Kaan Erdem'] as const

export const legalEvents: EventDef[] = [
  // ───────────── Contract dispute chain (4 steps) ─────────────
  {
    id: 'legal.contract_clause',
    category: 'legal',
    weight: 0.9,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    minWeek: 3,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 12,
    vars: ({ state }, rng) => ({ fee: wageX(state, 2, 1500), lawyer: rng.pick(LAWYERS), share: rng.pick([30, 40, 50]) }),
    title: t('Küçük Puntolu Madde', 'The Small Print'),
    text: t(
      'Kulüp yeni bir "standart ek protokol" gönderdi. Dördüncü sayfada, büyüteçle okunacak puntoda: imaj haklarından elde edilen gelirin %{share}\'i kulübe. {agentName} "Herkes imzalıyor" diyor. Herkes okumadığı için olabilir mi?',
      'The club sent over a "standard addendum". Page four, in magnifying-glass print: {share}% of your image-rights income goes to the club. {agentName} says "everybody signs it". Maybe because nobody reads it?',
    ),
    icon: '📜',
    choices: [
      {
        label: t('Avukat tut ({fee:money})', 'Hire a lawyer ({fee:money})'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'fee')),
        lockedHint: t('Avukat ücretini karşılayamazsın.', "You can't afford the lawyer's fee."),
        effects: (ctx) =>
          fx(
            t('{lawyer} dosyayı açtı, gözlüğünü düzeltti ve "Bu maddeyi yazan stajyer olmalı" dedi.', '{lawyer} opened the file, adjusted their glasses and said: "An intern must have written this clause."'),
            money(-num(ctx, 'fee')), stress(3), chairman(-3),
            flags({ legal_case: 1 }),
            follow(chain('legal.lawyer_strategy', 1)),
          ),
      },
      {
        label: t('İmzala, uğraşamam', 'Just sign it'),
        effects: () => fx(t('İmzaladın. Kulüp başkanı sana bir kalem hediye etti. Pahalı bir kalem. Senin paranla alınmış olabilir.', 'You signed. The chairman gave you a pen as a gift. An expensive pen. Possibly bought with your money.'), chairman(5), trust(2), happy(-2), flags({ image_share_club: true })),
      },
      {
        label: t('Başkanla yüz yüze konuş', 'Talk to the chairman face to face'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.45 + ctx.state.hero.reputation / 250)
            ? fx(t('"Haklısın evlat, o madde sana göre değil." Kalemi aldı, maddeyi çizdi. Bazen sadece sormak yeter.', '"You\'re right, that clause isn\'t for you." A line through it. Sometimes you just have to ask.'), chairman(4), happy(4))
            : fx(t('"Herkes imzalıyor" dedi ve konuyu kapattı. Odadan çıkarken kapı biraz sert kapandı.', '"Everybody signs it," he said, ending the meeting. The door shut a little too firmly behind you.'), chairman(-6), stress(4)),
      },
    ],
  },
  {
    id: 'legal.lawyer_strategy',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ fee: wageX(state, 2, 1500), lawyer: rng.pick(LAWYERS) }),
    title: t('Strateji Toplantısı', 'Strategy Meeting'),
    text: t(
      '{lawyer} masaya üç dosya koydu: "Sert dava, uzlaşma ya da sessizce geri çekilmek. Sert dava kazanırsak emsal olur; kaybedersek kulüpte soğuk bir sezon geçirirsin."',
      '{lawyer} puts three folders on the table: "Full lawsuit, mediation, or quietly withdraw. Win the lawsuit and it sets a precedent; lose it and you spend a chilly season at the club."',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Sert dava aç', 'Go for the full lawsuit'),
        risk: 'high',
        effects: () => fx(t('Dilekçe gitti. Kulübün avukatları cevap için üç hafta istedi, sen de üç gece uyuyamadın.', 'The petition is filed. The club\'s lawyers asked for three weeks to respond; you lost three nights of sleep.'), stress(6), chairman(-8), flags({ legal_case: 2 }), follow(chain('legal.hearing', 2))),
      },
      {
        label: t('Arabulucuya git', 'Go to mediation'),
        effects: () => fx(t('Tarafsız bir arabulucu atandı. Ortam ılık, kurabiyeler kuru.', 'A neutral mediator is appointed. The mood is lukewarm, the biscuits are dry.'), stress(2), chairman(-2), flags({ legal_case: 1 }), follow(chain('legal.hearing', 2))),
      },
      {
        label: t('Geri çekil, ilişkiyi bozma', 'Withdraw, keep the peace'),
        effects: () => fx(t('{lawyer} omuz silkti: "Faturam yine de gelecek." Geldi de.', '{lawyer} shrugged: "My invoice will still arrive." It did.'), chairman(4), happy(-3), flags({ legal_case: null, image_share_club: true })),
      },
    ],
  },
  {
    id: 'legal.hearing',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ lawyer: rng.pick(LAWYERS) }),
    title: t('Duruşma Günü', 'Hearing Day'),
    text: t(
      'Takım elbise, kravat ve maçtan daha çok terleten bir oda. Karşı taraf, sözleşmeyi "kendi rızanla" okuduğunu iddia ediyor. Söz sende.',
      'Suit, tie, and a room that makes you sweat more than a derby. The other side claims you read the contract "of your own free will". The floor is yours.',
    ),
    icon: '🏛️',
    choices: [
      {
        label: t('Sakin ve hazırlıklı konuş', 'Speak calmly, well prepared'),
        effects: (ctx, rng) =>
          rng.chance(0.4 + ctx.state.hero.attrs.composure / 200)
            ? fx(t('Notlarına bakmadan anlattın. Hâkim iki kez başını salladı. {lawyer} masanın altından başparmağını kaldırdı.', 'You told it without notes. The judge nodded twice. {lawyer} gave you a thumbs-up under the table.'), stress(2), { addFlags: { legal_case: 2 } }, follow(chain('legal.verdict', 1)))
            : fx(t('"Ben futbolcuyum, avukat değilim" dedin. Doğru ama yardımcı olmadı.', '"I\'m a footballer, not a lawyer," you said. True, but not helpful.'), stress(5), follow(chain('legal.verdict', 1))),
      },
      {
        label: t('Duygusal bir konuşma yap', 'Make an emotional speech'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Mahalle sahasından bahsettin. Mübaşir gözünü sildi. Bu sayılır mı bilmiyoruz.', 'You talked about the neighbourhood pitch. The court clerk wiped a tear. Not sure that counts.'), fans(3), stress(-2), { addFlags: { legal_case: 1 } }, follow(chain('legal.verdict', 1)))
            : fx(t('Sesin titredi, cümle yarıda kaldı. Gazeteciler bunu çok sevdi.', 'Your voice cracked mid-sentence. The reporters loved it.'), press(3), stress(6), follow(chain('legal.verdict', 1))),
      },
      {
        label: t('Avukatın konuşsun', 'Let your lawyer do the talking'),
        effects: () => fx(t('{lawyer} kırk dakika konuştu, üç içtihat okudu. Sen sadece "evet" dedin, iki kere.', '{lawyer} spoke for forty minutes and cited three precedents. You said "yes" twice.'), stress(1), follow(chain('legal.verdict', 1))),
      },
    ],
  },
  {
    id: 'legal.verdict',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ award: wageX(state, 6, 6000) }),
    title: t('Karar Açıklandı', 'The Verdict'),
    text: t(
      'Kararı okumak için bir dakikan var. {agentName} telefonda nefesini tutuyor, başkanın sekreteri de muhtemelen kapıyı dinliyor.',
      'You have a minute to read the ruling. {agentName} is holding their breath on the phone, and the chairman\'s secretary is probably listening at the door.',
    ),
    icon: '🔨',
    choices: [
      {
        label: t('Kararı oku', 'Read the ruling'),
        effects: (ctx, rng) => {
          const strength = flagNum(ctx.state, 'legal_case')
          return rng.chance(0.2 + strength * 0.15)
            ? fx(
                t('Kazandın! Madde geçersiz, geçmiş payın da faiziyle iade. Kulüp "karara saygı duyuyoruz" dedi; dişlerini sıkarak.', 'You won! The clause is void, past income returned with interest. The club said it "respects the ruling", through gritted teeth.'),
                money(num(ctx, 'award')), rep(2), chairman(-6), happy(8), flags({ legal_case: null, image_share_club: null }),
                news(t('{heroName} kulübüne karşı imaj hakları davasını kazandı', '{heroName} wins image-rights case against own club'), 0),
              )
            : fx(
                t('Kaybettin. Madde geçerli, mahkeme masrafları sende. {lawyer} "temyiz" dedi, sen "yeter" dedin.', 'You lost. The clause stands and the costs are yours. Your lawyer said "appeal"; you said "enough".'),
                money(-num(ctx, 'award') * 0.3), stress(8), happy(-6), flags({ legal_case: null, image_share_club: true }),
              )
        },
      },
      {
        label: t('Karar ne olursa olsun başkanla barış', 'Whatever it says, make peace with the chairman'),
        effects: (ctx) =>
          fx(t('Sonucu okumadan başkanı aradın: "Bu iş aramızı bozmasın." Karar lehineydi; jestin daha çok konuşuldu.', 'You rang the chairman before even reading it: "Let\'s not let this come between us." The ruling went your way; the gesture got more attention.'), money(num(ctx, 'award') * 0.5), chairman(6), trust(2), flags({ legal_case: null, image_share_club: null })),
      },
    ],
  },
  // ───────────── Image rights ─────────────
  {
    id: 'legal.image_rights',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 30,
    maxPerCareer: 2,
    conditions: ({ state }) => state.hero.reputation >= 20,
    vars: ({ state }, rng) => ({ brandName: `${pickBrand(rng)} Kola`, fee: wageX(state, 1, 1000) }),
    title: t('Billboarddaki Sen', 'You, on a Billboard'),
    text: t(
      'Sahil yolundaki dev billboardda yüzün var. Elinde bir {brandName} şişesi tutuyorsun. Hiç tutmadın. Hiç içmedin de. Photoshop ustası bileklerini bile doğru yapmamış.',
      'There\'s a giant billboard on the coast road with your face on it, holding a bottle of {brandName}. You never held one. Never drank one either. The retoucher didn\'t even get your wrists right.',
    ),
    icon: '🪧',
    choices: [
      {
        label: t('Avukatla ihtarname çek ({fee:money})', 'Send a lawyer\'s letter ({fee:money})'),
        risk: 'low',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'fee')),
        lockedHint: t('Avukat ücreti yok.', 'No money for a lawyer.'),
        effects: (ctx) => fx(t('İhtarname gitti. {brandName} cephesinden "bir yanlış anlaşılma" açıklaması geldi.', 'The letter went out. {brandName} issued a statement about "a misunderstanding".'), money(-num(ctx, 'fee')), stress(2), follow(chain('legal.image_rights_settlement', 2))),
      },
      {
        label: t('Sosyal medyada dalga geç', 'Mock it on social media'),
        effects: (ctx) => fx(t('"Bileklerim bu kadar ince değil" yazdın. Paylaşım uçtu; marka panikledi.', '"My wrists are not that skinny," you posted. It flew; the brand panicked.'), folPct(ctx, 5), press(3), follow(chain('legal.image_rights_settlement', 1))),
      },
      {
        label: t('Boş ver, bedava reklam', 'Let it go, free publicity'),
        effects: () => fx(t('Billboard üç ay kaldı. Annen her geçişte fotoğrafını çekti.', 'The billboard stayed for three months. Your mum photographed it every time she drove past.'), happy(2), rep(1)),
      },
    ],
  },
  {
    id: 'legal.image_rights_settlement',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ offer: wageX(state, 4, 4000) }),
    title: t('Uzlaşma Teklifi', 'Settlement Offer'),
    text: t(
      '{brandName} avukatları masaya {offer:money} koydu: "Mahkemesiz, gürültüsüz. Bir de reklamı gerçekten çekelim mi? Bu sefer bileklerinle."',
      '{brandName}\'s lawyers put {offer:money} on the table: "No court, no noise. And shall we shoot the ad for real this time? With your actual wrists."',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Parayı al, reklamı reddet', 'Take the money, refuse the ad'),
        effects: (ctx) => fx(t('Para hesabında. Billboard söküldü. Prensip ve kâr aynı gün.', 'The money landed. The billboard came down. Principle and profit on the same day.'), money(num(ctx, 'offer')), rep(1)),
      },
      {
        label: t('Parayı al ve reklamı çek', 'Take the money and shoot the ad'),
        effects: (ctx) => fx(t('Çekim günü {brandName} içmek zorunda kaldın. Kırk iki kez. Gülümsemen gerçekti, midendeki gaz da.', 'On set you had to drink {brandName}. Forty-two takes. The smile was real; so was the bloating.'), money(num(ctx, 'offer') * 1.8), folPct(ctx, 2), fans(-1), stress(2)),
      },
      {
        label: t('Mahkemeye git, emsal olsun', 'Go to court, set a precedent'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Mahkeme seni haklı buldu: tazminat teklifin iki katı.', 'The court sided with you: damages twice the offer.'), money(num(ctx, 'offer') * 2), rep(2), news(t('{heroName} imaj hakları davasında emsal karar aldı', '{heroName} wins landmark image-rights ruling'), 1))
            : fx(t('Dava iki yıl sürecek. Avukatın yeni bir araba aldı.', 'The case will take two years. Your lawyer bought a new car.'), money(-num(ctx, 'offer') * 0.2), stress(6)),
      },
    ],
  },
  // ───────────── Traffic ─────────────
  {
    id: 'legal.traffic_offence',
    category: 'legal',
    weight: (ctx) => (ctx.state.life.assets.some((a) => a.defId.startsWith('car')) ? 1.4 : 0.5),
    cooldownWeeks: 26,
    maxPerCareer: 2,
    minAge: 18,
    conditions: () => true,
    vars: ({ state }) => ({ fine: wageX(state, 0.5, 300), kmh: 142 }),
    title: t('Flaş Patladı', 'Flash!'),
    text: t(
      'Gece antrenmandan dönerken boş yolda hız kamerası seni {kmh} km/s ile yakaladı. Ceza {fine:money} ve ehliyetine puan. Bir de fotoğraf var: çok iyi çıkmışsın, ne yazık ki.',
      'Driving home from late training on an empty road, a speed camera clocked you at {kmh} km/h. Fine: {fine:money} plus licence points. There\'s a photo too: you look great in it, sadly.',
    ),
    icon: '🚓',
    choices: [
      {
        label: t('Cezayı öde, ders al', 'Pay the fine, learn the lesson'),
        effects: (ctx) => fx(t('Ödedin. Artık yolda bir teyze gibi kullanıyorsun. Teyzeler seni solluyor.', 'Paid. You now drive like a cautious aunt. Aunts overtake you.'), money(-num(ctx, 'fine')), disc(1)),
      },
      {
        label: t('İtiraz et: "Kamera arızalı!"', 'Contest it: "The camera is faulty!"'),
        risk: 'medium',
        effects: () => fx(t('İtiraz dilekçesi gönderildi. Mahkeme tarihi verildi.', 'Appeal filed. A court date has been set.'), stress(3), follow(chain('legal.traffic_court', 2))),
      },
      {
        label: t('"Arabayı kuzenim kullanıyordu" de', 'Say "my cousin was driving"'),
        hint: t('Yalan söylemek kayıt altına girer.', 'Lies go on the record.'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.35)
            ? fx(t('Kuzenin cezayı üstlendi. Karşılığında forman ve bir yıllık kombine istedi.', 'Your cousin took the hit, in exchange for your shirt and a season ticket.'), money(-num(ctx, 'fine')), stress(4))
            : fx(
                t('Fotoğrafta kuzenin değil, sen varsın; formanla. Yalan haberi cezadan daha çok konuşuldu.', 'The photo shows you, not your cousin. Wearing your own shirt. The lie made more noise than the fine.'),
                money(-num(ctx, 'fine') * 3), disc(-8), press(-6), fans(-3), boss(-3),
                news(t('{heroName} hız cezasında kuzenini suçladı, fotoğraf yalanladı', '{heroName} blamed cousin for speeding; the photo says otherwise'), -1),
              ),
      },
    ],
  },
  {
    id: 'legal.traffic_court',
    category: 'legal',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Trafik Mahkemesi', 'Traffic Court'),
    text: t(
      'Koridorda seninle birlikte bekleyenler: bir taksici, iki kurye ve sana imza için kâğıt uzatan bir trafik polisi.',
      'Waiting in the corridor with you: a cab driver, two couriers and a traffic officer holding out a notepad for your autograph.',
    ),
    icon: '🚦',
    choices: [
      {
        label: t('Kalibrasyon raporunu iste', 'Request the calibration report'),
        effects: (ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Kameranın kalibrasyonu iki yıldır yapılmamış. Ceza iptal. Taksici seni alkışladı.', 'The camera hadn\'t been calibrated in two years. Fine cancelled. The cab driver applauded.'), happy(4), stress(-2))
            : fx(t('Kamera kusursuz çıktı. Ceza iki katı, artı mahkeme masrafı.', 'The camera was spotless. Double fine, plus costs.'), money(-num(ctx, 'fine') * 2), stress(3)),
      },
      {
        label: t('Kabul et, polise imza ver', 'Accept it, sign the officer\'s notepad'),
        effects: (ctx) => fx(t('Cezayı ödedin, polise imza verdin. "Kızım çok sevecek" dedi. Bu sefer kamera yoktu.', 'You paid and signed the notepad. "My daughter will love this," said the officer. No camera this time.'), money(-num(ctx, 'fine')), fans(1), rel('fans', 1)),
      },
    ],
  },
]

