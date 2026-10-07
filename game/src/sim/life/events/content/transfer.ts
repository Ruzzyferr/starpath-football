/** Transfer window: rumours, tapping-up, requests, loans and deadline-day chaos. */
import { boss, stat, chairman, disc, fans, flags, follow, folPct, form, fx, happy, hasClub, hasFlag, money, morale, num, press, rel, rep, stress, t, chain, trust, wageX } from '../dsl'
import type { EventDef } from '../types'

export const transferEvents: EventDef[] = [
  {
    id: 'transfer.rumour_link',
    category: 'transfer',
    weight: 1.2,
    cooldownWeeks: 16,
    triggers: ['transfer_window'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 10,
    vars: ({ state }) => ({ fee: wageX(state, 400, 200000) }),
    title: t('Manşette Sen Varsın', "You're in the Headlines"),
    text: t(
      'Bir spor gazetesi: "{rivalClub}, {heroName} için {fee:money} hazırladı!" Kaynak: "kulübe yakın biri". Telefonun susmuyor.',
      'A sports paper: "{rivalClub} ready {fee:money} for {heroName}!" Source: "someone close to the club". Your phone will not stop.',
    ),
    icon: '📰',
    choices: [
      {
        label: t('"Burada mutluyum." de', 'Say "I\'m happy here."'),
        effects: () => fx(t('Klasik cümle, ama taraftarlar sevdi.', 'The oldest line in football, but the fans liked it.'), fans(5), chairman(3), trust(2)),
      },
      {
        label: t('"Futbolda asla asla deme." de', 'Say "Never say never in football."'),
        hint: t('Değerini yükseltir, sadakat sorgulanır.', 'Raises your value, questions your loyalty.'),
        risk: 'medium',
        effects: () => fx(t('Fiyatın kulislerde yükseldi. Tribünde bir pankart: "Paralı asker".', 'Your price rose behind the scenes. A banner in the stands: "Mercenary".'), rep(3), fans(-6), chairman(-2), flags({ transfer_flirt: true })),
      },
      {
        label: t('Hiç yorum yapma', 'No comment at all'),
        effects: () => fx(t('Sessizliğin daha çok spekülasyon üretti.', 'Your silence only fed more speculation.'), stress(3), press(-1)),
      },
    ],
  },
  {
    id: 'transfer.tapping_up',
    category: 'transfer',
    weight: 0.9,
    cooldownWeeks: 40,
    triggers: ['transfer_window'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20,
    vars: ({ state }) => ({ offerWage: wageX(state, 1.8, 2000) }),
    title: t('Gizli Bir Akşam Yemeği', 'A Secret Dinner'),
    text: t(
      '{rivalClub} kulübünün sportif direktörü, {agentName} üzerinden haber gönderdi: şehir dışında, sessiz bir restoranda buluşmak istiyor. Haftalık {offerWage:money} konuşulacakmış.',
      '{rivalClub}\'s sporting director sent word via {agentName}: a quiet restaurant out of town, just a chat. Weekly wages of {offerWage:money} are on the table.',
    ),
    icon: '🍷',
    choices: [
      {
        label: t('Git, sadece dinle', 'Go and just listen'),
        hint: t('Kurallara aykırı. Görülürsen...', 'Against the rules. If anyone sees you...'),
        risk: 'high',
        effects: () =>
          fx(
            t('Yemek mükemmeldi, teklif daha da iyi. Çıkarken bir flaş patladı mı? Emin değilsin.', 'The food was superb, the offer better. Was that a camera flash on the way out? You are not sure.'),
            happy(5), stress(5), flags({ tapped_up: true }),
            follow(chain('transfer.leaked_photo', 1)),
          ),
      },
      {
        label: t('Kulübüne haber ver', 'Tell your own club'),
        effects: () => fx(t('Başkan {chairmanName} sadakatini not etti. Belki sözleşmende de not eder.', 'Chairman {chairmanName} noted your loyalty. Maybe your next contract will too.'), chairman(10), trust(3), rel('agent', -5)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('"Şimdilik değil." Kapılar açık kaldı.', '"Not right now." The door stays ajar.'), rel('agent', -2), stress(-1)),
      },
    ],
  },
  {
    id: 'transfer.leaked_photo',
    category: 'transfer',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'tapped_up'),
    title: t('Fotoğraf Sızdı', 'The Photo Leaks'),
    text: t(
      'Bulanık ama tartışmasız: sen ve {rivalClub} kulübünün sportif direktörü aynı masada. Gazete başlığı: "İHANET YEMEĞİ".',
      'Blurry but undeniable: you and {rivalClub}\'s sporting director at one table. The headline: "THE BETRAYAL BANQUET".',
    ),
    icon: '📸',
    choices: [
      {
        label: t('"Akrabamdı" de', 'Claim he is a relative'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.25)
            ? fx(t('İnanılmaz ama tuttu. Kimse soy ağacını kontrol etmedi.', 'Incredibly, it worked. Nobody checked the family tree.'), stress(-3), follow(chain('transfer.club_reaction', 1, { stance: 'lie_ok' })))
            : fx(t('Sportif direktörün aile fotoğrafları sızdı. Sen yoktun.', 'The director\'s family photos surfaced. You weren\'t in any of them.'), press(-8), fans(-8), rep(-2), follow(chain('transfer.club_reaction', 1, { stance: 'lie_bad' }))),
      },
      {
        label: t('Dürüst ol: "Dinledim, karar vermedim."', 'Be honest: "I listened. Nothing decided."'),
        effects: () => fx(t('Dürüstlüğün basında saygı gördü, tribünde ise ıslık.', 'The press respected the honesty; the stands whistled.'), press(4), fans(-5), follow(chain('transfer.club_reaction', 1, { stance: 'honest' }))),
      },
      {
        label: t('Transfer talep et, artık saklanma', 'Hand in a transfer request, stop hiding'),
        hint: t('Köprüleri yakar.', 'Burns bridges.'),
        risk: 'medium',
        effects: () => fx(t('Talebin masada. Başkanın kapısı sana kapandı.', 'Your request is in. The chairman\'s door just slammed.'), chairman(-15), fans(-10), boss(-5), flags({ transfer_requested: true }), follow(chain('transfer.club_reaction', 1, { stance: 'request' }))),
      },
    ],
  },
  {
    id: 'transfer.club_reaction',
    category: 'transfer',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Başkanın Odası', "The Chairman's Office"),
    text: t(
      '{chairmanName} seni çağırdı. Masada sözleşmen, yanında {managerName}. "Konuşalım" dedi, gülümsemeden.',
      '{chairmanName} has summoned you. Your contract is on the desk, {managerName} beside it. "Let\'s talk," he says, unsmiling.',
    ),
    icon: '🏛️',
    choices: [
      {
        label: t('Özür dile, kalmak istediğini söyle', 'Apologise and say you want to stay'),
        effects: (ctx) =>
          fx(
            ctx.vars.stance === 'request'
              ? t('Talebini geri çektin. Affedildin ama unutulmadın.', 'You withdrew the request. Forgiven, not forgotten.')
              : t('Başkan elini sıktı: "Konu kapandı." Hoca ise bir süre seni izleyecek.', 'The chairman shook your hand: "Matter closed." The gaffer will be watching you for a while.'),
            chairman(6), trust(-3), fans(3), flags({ tapped_up: null, transfer_requested: null }),
          ),
      },
      {
        label: t('Zam iste, yoksa giderim de', 'Demand a raise or you walk'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.4 + ctx.state.hero.reputation / 250)
            ? fx(t('Başkan küfretti, sonra imzaladı. Prim paketin büyüdü.', 'The chairman swore, then signed. Your bonus package just grew.'), money(wageX(ctx.state, 4, 5000)), chairman(-8), happy(6), flags({ tapped_up: null }))
            : fx(t('"O zaman yürü." Kadro dışı kaldın, telefonun da çalmadı.', '"Then walk." You were frozen out, and nobody else rang.'), chairman(-15), trust(-12), morale(-10), flags({ tapped_up: null })),
      },
      {
        label: t('Cezayı kabul et', 'Accept a fine and move on'),
        effects: (ctx) => fx(t('Bir haftalık maaş kesildi. Temiz sayfa.', 'A week\'s wages docked. Clean slate.'), money(-wageX(ctx.state, 1, 400)), disc(4), chairman(4), flags({ tapped_up: null, transfer_requested: null })),
      },
    ],
  },
  {
    id: 'transfer.agent_push',
    category: 'transfer',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['transfer_window'],
    conditions: ({ state }) => hasClub(state) && !!state.life.agent,
    vars: ({ state }) => ({ cut: wageX(state, 10, 10000) }),
    title: t('Menajerin Planı', "Your Agent's Master Plan"),
    text: t(
      '{agentName} heyecanlı: "{rivalClub} ciddi. Ben kendi komisyonumu ({cut:money}) bile düşündüm, o derece iyi. İmza at, gidelim!"',
      '{agentName} is buzzing: "{rivalClub} are serious. I even worked out my commission ({cut:money}), that\'s how good it is. Sign, let\'s go!"',
    ),
    icon: '🧳',
    choices: [
      {
        label: t('Onu frenle: "Ben burada gelişiyorum."', 'Rein him in: "I\'m developing here."'),
        effects: () => fx(t('{agentName} somurttu ama kabul etti. Hoca da bunu duydu.', '{agentName} sulked but accepted. The gaffer heard about it.'), rel('agent', -8), trust(4)),
      },
      {
        label: t('Kulübe teklifi ilet', 'Pass the bid to the club'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Kulübün reddetti ama sana yeni bir sözleşme konuşmak istiyor.', 'Your club rejected it but now wants to talk about a new deal.'), chairman(3), rel('agent', 5), happy(4))
            : fx(t('Kulüp "satılık değil" dedi. Herkes biraz gergin.', 'The club said "not for sale". Everyone is a little tense.'), stress(5), rel('agent', 3)),
      },
      {
        label: t('Menajerini değiştirmeyi düşün', 'Consider sacking your agent'),
        effects: () => fx(t('Mesaj alındı: artık seni dinliyor. Ya da öyle görünüyor.', 'Message received: he listens now. Or pretends to.'), rel('agent', -15), stress(-2)),
      },
    ],
  },
  {
    id: 'transfer.loan_offer',
    category: 'transfer',
    weight: 1.2,
    cooldownWeeks: 20,
    triggers: ['transfer_window', 'benched'],
    conditions: ({ state }) => hasClub(state) && (state.hero.contract?.role === 'reserve' || state.hero.contract?.role === 'youth' || state.hero.managerTrust < 40),
    title: t('Kiralık Teklifi', 'A Loan Offer'),
    text: t(
      '{managerName}: "Burada az süre alıyorsun. Alt ligden bir kulüp seni sezon sonuna kadar istiyor. Her hafta oynarsın." Çamurlu sahalar, uzun otobüs yolculukları...',
      '{managerName}: "You\'re not getting minutes here. A lower-league club wants you till the end of the season. You\'d play every week." Muddy pitches, long coach trips...',
    ),
    icon: '🚌',
    choices: [
      {
        label: t('Kabul et, oynamak her şeydir', 'Accept, minutes are everything'),
        effects: () => fx(t('Haftada 90 dakika, haftada üç tekme. Bacakların ve kafan güçleniyor.', 'Ninety minutes a week, three kicks a week. Legs and head are toughening.'), form(8), stat('sharpness', 10), happy(-3), flags({ loan_spell: true })),
      },
      {
        label: t('Kal ve yerin için savaş', 'Stay and fight for your place'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Hoca hırsını sevdi; ilk 11 kapısı aralandı.', 'The gaffer liked the fight; the starting XI door creaked open.'), trust(8), morale(5))
            : fx(t('Kulübe sana ikinci evin oldu.', 'The bench became your second home.'), morale(-6), stat('sharpness', -5)),
      },
      {
        label: t('Kalmak için ekstra antrenman sözü ver', 'Promise extra sessions to stay'),
        effects: () => fx(t('Sabah 7\'de saha senin. Yorgunsun ama hoca gördü.', 'The pitch is yours at 7am. You are knackered, but the gaffer noticed.'), trust(5), stat('fatigue', 10), stress(3)),
      },
    ],
  },
  {
    id: 'transfer.fans_beg',
    category: 'transfer',
    weight: 0.9,
    cooldownWeeks: 30,
    triggers: ['transfer_window'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 25,
    title: t('"Gitme!" Pankartı', '"Don\'t Go!" Banner'),
    text: t(
      'Antrenman tesisinin önünde yüzlerce taraftar: "{heroName} BİZİMDİR" yazan dev pankart. Çocuklar formanı sallıyor.',
      'Hundreds of fans outside the training ground. A giant banner: "{heroName} IS OURS". Kids are waving your shirt.',
    ),
    icon: '🧣',
    choices: [
      {
        label: t('Arabadan in, onlarla selfie çek', 'Get out of the car, do selfies'),
        effects: (ctx) => fx(t('Bir saat kaldın. Antrenmana geç kaldın, ama değdi.', 'You stayed an hour. Late for training, worth it.'), fans(10), folPct(ctx, 3), trust(-2), happy(5)),
      },
      {
        label: t('Kulübe bağlılık sözü ver', 'Pledge your future to the club'),
        hint: t('Söz verirsen tutman gerekir.', 'A promise has to be kept.'),
        effects: () => fx(t('Tezahürat gök gürültüsü gibiydi. Başkan çok mutlu.', 'The chant was thunderous. The chairman is delighted.'), fans(12), chairman(6), flags({ loyalty_pledge: true, transfer_flirt: null })),
      },
      {
        label: t('Camı aç, el salla, devam et', 'Window down, wave, drive on'),
        effects: () => fx(t('Dostça ama mesafeli. Bazıları "soğuk" dedi.', 'Friendly but distant. Some called it cold.'), fans(2)),
      },
    ],
  },
  {
    id: 'transfer.deadline_day',
    category: 'transfer',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['transfer_window'],
    minWeek: 3,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ bonus: wageX(state, 3, 3000) }),
    title: t('Son Gün Çılgınlığı', 'Deadline-Day Madness'),
    text: t(
      'Saat 23:14. {agentName} arıyor: "{rivalClub} son dakika teklif yaptı! Kulüp kabul ederse {bonus:money} imza parası. 46 dakikan var!"',
      '11:14pm. {agentName} rings: "{rivalClub} just made a late bid! If the club accepts, {bonus:money} signing-on fee. You have 46 minutes!"',
    ),
    icon: '⏰',
    choices: [
      {
        label: t('Kulübü zorla', 'Push your club to sell'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.35)
            ? fx(t('Belgeler 23:59\'da faksla gitti... ve faks bozuldu. Transfer çöktü, ilişkiler de.', 'Paperwork sent by fax at 11:59pm... and the fax jammed. Deal collapsed, and so did relations.'), chairman(-12), fans(-8), stress(10))
            : fx(t('Kulüp reddetti, ama sana küçük bir "sadakat zammı" geldi.', 'The club refused, but slipped you a small "loyalty" bonus.'), money(num(ctx, 'bonus') / 2), chairman(-4), happy(2)),
      },
      {
        label: t('Telefonu kapat, uyu', 'Switch off the phone and sleep'),
        effects: () => fx(t('Sabah 47 cevapsız arama. Sen dinlenmiş uyandın.', 'You woke up to 47 missed calls, well rested.'), stress(-6), stat('energy', 8), rel('agent', -4)),
      },
      {
        label: t('Kalma kararını sosyal medyada duyur', 'Announce on social media you are staying'),
        effects: (ctx) => fx(t('"Hiçbir yere gitmiyorum." Gece yarısı en çok beğenilen paylaşım.', '"I\'m going nowhere." The most-liked post of the night.'), fans(8), folPct(ctx, 4), chairman(5)),
      },
    ],
  },
]

