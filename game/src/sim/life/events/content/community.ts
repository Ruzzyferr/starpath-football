/** Community: schools, hospitals, hometown pitches, charity and local pride. */
import {
  canAfford, chairman, energy, fans, fatigue, follow, fx, happy, hasClub, money, morale, news, num, press, rel, rep,
  stress, t, chain, trust, wageX,
} from '../dsl'
import type { EventDef } from '../types'

export const communityEvents: EventDef[] = [
  {
    id: 'community.school_visit',
    category: 'community',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasClub(state),
    title: t('Okul Ziyareti', 'School Visit'),
    text: t(
      'Kulübün sosyal sorumluluk ekibi seni bir ilkokula götürüyor. Spor salonunda iki yüz çocuk, bir öğretmen ve biraz bozuk bir ses sistemi. Bir çocuk elini kaldırmış: "Hiç ağladın mı?"',
      'The club\'s community team takes you to a primary school. Two hundred kids in the gym, one teacher, a dodgy sound system. A hand shoots up: "Have you ever cried?"',
    ),
    icon: '🏫',
    choices: [
      {
        label: t('Dürüst cevap ver: "Çok kez."', 'Answer honestly: "Loads of times."'),
        effects: (ctx) =>
          fx(t('Reddedildiğin akademiyi, annenle otobüste ağladığın günü anlattın. Öğretmen bile mendil aradı.', 'You told them about the academy that rejected you and crying on the bus with your mum. Even the teacher reached for a tissue.'), rep(2), happy(5), rel('mother', 3), press(2), { addFlags: { community_good: 1 } }, ctx.state.hero.reputation > 50 ? news(t('{heroName} çocuklara gözyaşını anlattı', '{heroName} opens up to schoolkids'), 1) : {}),
      },
      {
        label: t('Bahçede maç yap', 'Play a match in the yard'),
        effects: () => fx(t('On dakika olacaktı, bir saat sürdü. Dokuz yaşında bir kaleci seni iki kez durdurdu.', 'It was meant to be ten minutes; it lasted an hour. A nine-year-old keeper stopped you twice.'), happy(6), fatigue(6), energy(-8), fans(3)),
      },
      {
        label: t('Kısa bir konuşma, imzalı toplar, çıkış', 'Short speech, signed balls, exit'),
        effects: () => fx(t('Verimli, profesyonel, biraz mekanik. Çocuklar topları sevdi.', 'Efficient, professional, a bit mechanical. The kids loved the balls.'), rep(1), energy(-2)),
      },
    ],
  },
  {
    id: 'community.hometown_pitch',
    category: 'community',
    weight: 0.9,
    cooldownWeeks: 52,
    once: true,
    conditions: ({ state }) => state.hero.reputation >= 20,
    vars: ({ state }) => ({ amount: wageX(state, 4, 6000) }),
    title: t('Çocukluğunun Sahası', 'The Pitch Where It Started'),
    text: t(
      '{friendName} bir fotoğraf yolladı: top koşturduğun mahalle sahası. Kale direkleri paslanmış, toprak çukur dolu, bir köşesi otopark olmuş. Belediye "bütçe yok" diyor. Yenilemek yaklaşık {amount:money}.',
      '{friendName} sends a photo: your old neighbourhood pitch. Rusted posts, potholes, one corner now a car park. The council says there is "no budget". Fixing it costs around {amount:money}.',
    ),
    icon: '🥅',
    choices: [
      {
        label: t('Tamamını sen öde', 'Pay for all of it'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Şu an bu kadar paran yok.', "You don't have that much right now."),
        effects: (ctx) =>
          fx(t('İnşaat başladı. {friendName} her gün fotoğraf atıyor.', 'Work has started. {friendName} sends progress photos every day.'), money(-num(ctx, 'amount')), happy(6), rel('bestFriend', 8), rep(2), follow(chain('community.pitch_opening', 5, { funded: 'full' }))),
      },
      {
        label: t('Kampanya başlat, sen de ilk bağışı yap', 'Launch a fundraiser and kick it off'),
        requires: (ctx) => canAfford(ctx.state, Math.round(num(ctx, 'amount') / 4)),
        lockedHint: t('İlk bağış için bile paran yetmiyor.', "You can't even afford the first donation."),
        effects: (ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('Takipçilerin coştu, kampanya iki haftada doldu.', 'Your followers rallied; the fundraiser filled in two weeks.'), money(-Math.round(num(ctx, 'amount') / 4)), fans(5), rep(2), follow(chain('community.pitch_opening', 6, { funded: 'crowd' })))
            : fx(t('Kampanya yarıda kaldı. Kale direkleri boyandı, o kadar.', 'The fundraiser stalled halfway. The posts got painted, and that was it.'), money(-Math.round(num(ctx, 'amount') / 4)), stress(4), rel('bestFriend', 2)),
      },
      {
        label: t('Belediyeye kamuoyu baskısı yap', 'Shame the council into it'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Paylaşımın gündem oldu; belediye apar topar ödenek buldu.', 'Your post trended; the council suddenly found the money.'), press(3), rep(2), follow(chain('community.pitch_opening', 8, { funded: 'council' })))
            : fx(t('Belediye başkanı "Futbolcular vergisini ödesin önce" diye cevap verdi. Ortalık karıştı.', 'The mayor replied: "Footballers should pay their taxes first." Things got messy.'), press(-3), stress(6)),
      },
      {
        label: t('Şu an olmaz', 'Not right now'),
        effects: () => fx(t('{friendName} "anlıyorum" dedi. Fotoğrafı silmedin ama.', '{friendName} said "I get it". You didn\'t delete the photo, though.'), rel('bestFriend', -4), happy(-2)),
      },
    ],
  },
  {
    id: 'community.pitch_opening',
    category: 'community',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Açılış Töreni', 'Opening Day'),
    text: t(
      'Yeni sahada çim kokusu, yeni fileler, bir davulcu ve bütün mahalle. {motherName} en önde. Mahallenin muhtarı makası uzatıyor; çocuklar ise ellerindeki topla seni bekliyor.',
      'Fresh grass, new nets, a drummer and the whole neighbourhood. {motherName} is front and centre. The local headman holds out the scissors; the kids are waiting with a ball.',
    ),
    icon: '✂️',
    choices: [
      {
        label: t('Kurdeleyi kes, kısa bir konuşma yap', 'Cut the ribbon, say a few words'),
        effects: () =>
          fx(t('"Bu sahada düştüm, kalktım, burada büyüdüm." {motherName} ağladı, muhtar da.', '"I fell here, got up here, grew up here." {motherName} cried. So did the headman.'), rel('mother', 10), happy(8), rep(2), news(t('{heroName} çocukluk sahasını yeniledi', '{heroName} restores childhood pitch'), 1)),
      },
      {
        label: t('Çocuklarla ilk maçı oyna', 'Play the first match with the kids'),
        effects: () => fx(t('İlk golü sen değil, altı yaşında bir kız attı. Gelecek parlak.', 'The first goal wasn\'t yours. It was a six-year-old girl\'s. The future is bright.'), happy(10), fatigue(5), fans(4)),
      },
      {
        label: t('Sahaya ilk antrenörünün adını ver', 'Name the pitch after your first coach'),
        effects: () =>
          fx(t('Yaşlı hoca tabelayı görünce konuşamadı. O gün bir fotoğraf karesine sığmayacak kadar güzeldi.', 'Your old coach saw the sign and couldn\'t speak. Too good a day for one photo.'), happy(9), rep(3), morale(5)),
      },
    ],
  },
  {
    id: 'community.hospital_visit',
    category: 'community',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state),
    vars: (_ctx, rng) => ({ kid: rng.pick(['Efe', 'Mira', 'Kuzey', 'Elif', 'Aras', 'Duru']) }),
    title: t('Çocuk Servisi', 'The Children\'s Ward'),
    text: t(
      'Kulüp çocuk hastanesine ziyaret ayarladı. Odalardan birinde {kid} var; tedavisi uzun sürecek, duvarı senin posterlerinle dolu. "Bir sonraki maçta benim için gol atar mısın?"',
      'The club has arranged a children\'s hospital visit. In one room is {kid}, facing a long treatment, walls covered in your posters. "Will you score one for me next match?"',
    ),
    icon: '🏥',
    choices: [
      {
        label: t('Söz ver', 'Promise'),
        risk: 'medium',
        hint: t('Söz bir kere verilir.', 'A promise is a promise.'),
        effects: () => fx(t('{kid}\'in gözleri parladı. Şimdi bir golün hem senin hem de onun.', '{kid}\'s eyes lit up. Your next goal belongs to two people now.'), happy(5), stress(4), follow(chain('community.promised_goal', 2))),
      },
      {
        label: t('"Elimden geleni yapacağım" de, formanı ver', '"I\'ll do my best", and give your shirt'),
        effects: () => fx(t('Dürüst ve sıcak. {kid} formayı battaniyenin üstüne serdi.', 'Honest and warm. {kid} spread the shirt over the blanket.'), happy(4), rep(1)),
      },
      {
        label: t('Kameraları dışarı çıkart, sadece sohbet et', 'Send the cameras out, just talk'),
        effects: () => fx(t('Bir saat boyunca kart oyunu oynadınız. Hiçbir yerde haberi çıkmadı, çıkması da gerekmiyordu.', 'An hour of card games. It never made the news. It didn\'t need to.'), happy(7), stress(-4)),
      },
    ],
  },
  {
    id: 'community.promised_goal',
    category: 'community',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    triggers: ['scored', 'post_match'],
    conditions: () => true,
    title: t('Verilen Söz', 'The Promise'),
    text: t(
      'Hastaneden mesaj: {kid} maçı yataktan izledi. Sen gol attıysan bu sefer o anlatacak; atmadıysan bile seni soruyor.',
      'A message from the hospital: {kid} watched the match from bed. If you scored, that goal is the talk of the ward; even if you didn\'t, {kid} is asking about you.',
    ),
    icon: '💙',
    choices: [
      {
        label: t('Hastaneye gidip golü birlikte izle', 'Go back and rewatch it together'),
        effects: (ctx) =>
          ctx.state.hero.seasonStats.goals > 0
            ? fx(t('Golü on bir kez izlediniz. {kid} her seferinde ilk kez görüyormuş gibi bağırdı.', 'You watched the goal eleven times. {kid} screamed every time like it was the first.'), happy(10), rep(2), fans(4))
            : fx(t('Gol yoktu; ama {kid} senin kayarak müdahaleni taklit etti ve ikiniz de güldünüz. "Sonrakinde" dedi.', 'No goal, but {kid} did an impression of your sliding tackle and you both laughed. "Next time," came the verdict.'), happy(6), stress(-3)),
      },
      {
        label: t('Video mesaj gönder', 'Send a video message'),
        effects: () => fx(t('Kısa, içten bir video. {kid} onu hemşirelere bin kere gösterdi.', 'A short, heartfelt clip. {kid} showed it to every nurse on the ward.'), happy(4)),
      },
      {
        label: t('Takımı ikna et, imzalı forma topla', 'Rally the squad for a signed shirt'),
        effects: () => fx(t('Bütün takım imzaladı, hatta hoca bile. Soyunma odasında güzel bir hava esti.', 'The whole squad signed it, even the gaffer. The dressing room felt good about itself.'), rel('teammate', 4), happy(5), trust(1)),
      },
    ],
  },
  {
    id: 'community.charity_match',
    category: 'community',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => state.hero.reputation >= 15,
    vars: ({ state }) => ({ amount: wageX(state, 1, 1500) }),
    title: t('Yardım Maçı', 'Charity Match'),
    text: t(
      'Bir vakıf, izin gününde yapılacak yardım maçına seni istiyor. Rakip takımda emekli efsaneler, bir pop şarkıcısı ve hâlâ ofsayttan anlamayan bir hava durumu sunucusu var.',
      'A foundation wants you for a charity match on your day off. The other side: retired legends, a pop singer and a TV weather presenter who still doesn\'t understand offside.',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Doksan dakika oyna', 'Play the full ninety'),
        effects: () => fx(t('Hava durumu sunucusuna iki kez çalım attın, sonra pas verdin. Gecenin yıldızı oldun.', 'You nutmegged the weatherman twice, then set him up for a goal. Star of the evening.'), rep(3), fans(4), happy(5), fatigue(10), energy(-12), press(3), { addFlags: { community_good: 1 } }),
      },
      {
        label: t('Yirmi dakika oyna, seyirciyi selamla', 'Play twenty minutes, wave to the crowd'),
        effects: () => fx(t('Görünür, keyifli, yorucu değil. Herkes memnun.', 'Visible, fun, not exhausting. Everyone is happy.'), rep(1), fans(2), fatigue(3)),
      },
      {
        label: t('Gitme ama bağış yap', "Don't go, donate instead"),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bağış için paran yok.', "You can't afford a donation."),
        effects: (ctx) => fx(t('{amount:money} bağış vakfa ulaştı. Dinlenmiş bacaklarla haftaya başladın.', '{amount:money} reached the foundation. You start the week on fresh legs.'), money(-num(ctx, 'amount')), rep(1), energy(4)),
      },
    ],
  },
  {
    id: 'community.kids_tournament',
    category: 'community',
    weight: 0.9,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state),
    title: t('Mahalle Derbisi (U10)', 'The Under-10 Derby'),
    text: t(
      '{city}\'de iki mahallenin çocuk takımları final oynuyor ve tribünde gerçek bir derbi gerginliği var. Organizatörler senden finalde hakemlik yapmanı istiyor.',
      'In {city}, two neighbourhoods\' under-10 teams are in the final, and the parents are bringing genuine derby tension. The organisers want you to referee.',
    ),
    icon: '🏆',
    choices: [
      {
        label: t('Düdüğü al', 'Take the whistle'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Temiz bir maç yönettin. Velilerin bile seni alkışladığı nadir bir an.', 'You ran a clean game. A rare moment when even the parents applauded the ref.'), rep(2), happy(6), fans(3))
            : fx(t('Son dakikada penaltı verdin. Velilerin yarısı seni artık hiç sevmeyecek. Dokuz yaşında bir kaptan sana itiraz etti.', 'You gave a last-minute penalty. Half the parents will never forgive you. A nine-year-old captain argued with you.'), fans(-2), stress(6), happy(3)),
      },
      {
        label: t('Onur konuğu ol, kupaları ver', 'Be guest of honour, hand out trophies'),
        effects: () => fx(t('İki takıma da madalya verdin; kaybeden takımın kaptanına forma da. Kimse eli boş dönmedi.', 'Medals for both sides, and your shirt for the losing captain. Nobody went home empty-handed.'), rep(1), happy(5)),
      },
      {
        label: t('İki takımın formalarını sponsor ol', 'Sponsor kits for both teams'),
        requires: (ctx) => canAfford(ctx.state, 1500),
        lockedHint: t('Forma sponsorluğuna bütçen yok.', "You can't afford the kits."),
        effects: () => fx(t('Formaların arkasında senin numaran var. Gelecek yıl turnuvaya otuz takım başvurdu.', 'Your number is on the back of every shirt. Thirty teams signed up the following year.'), money(-1500), rep(2), fans(5), happy(4)),
      },
    ],
  },
  {
    id: 'community.cafe_named',
    category: 'community',
    weight: 0.8,
    cooldownWeeks: 52,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 30,
    title: t('"{heroName} Kafe"', '"Café {heroName}"'),
    text: t(
      'Mahallede yeni bir kafe açılmış: "{heroName} Kafe". Menüde "{heroName} Tost", "Rövaşata Limonata" ve senin yüzünün köpüğe çizildiği bir latte var. Kimse senden izin almamış.',
      'A new café has opened round the corner: "Café {heroName}". The menu features a "{heroName} Toastie", a "Bicycle-Kick Lemonade" and a latte with your face in the foam. Nobody asked you.',
    ),
    icon: '☕',
    choices: [
      {
        label: t('Uğra, duvarı imzala', 'Drop in and sign the wall'),
        effects: (_ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('Sahibi neredeyse bayılıyordu. Tost gerçekten güzelmiş. Artık müdavimsin.', 'The owner nearly fainted. The toastie is actually great. You\'re a regular now.'), fans(5), happy(5), rep(1))
            : fx(t('Duvarı imzaladın; ertesi hafta "{heroName}\'in onaylı kafesi" tabelası asıldı. Ajanın hiç memnun değil.', 'You signed the wall; next week a sign went up: "Officially endorsed by {heroName}". Your agent is not amused.'), fans(4), rel('agent', -5), stress(3)),
      },
      {
        label: t('Gelirden pay iste', 'Ask for a cut'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Küçük bir anlaşma yaptınız: her ay bir miktar ve bedava kahve.', 'You struck a small deal: a monthly cut and free coffee forever.'), money(wageX(ctx.state, 1, 800)), rel('agent', 4))
            : fx(t('Sahibi tabelayı indirip "Kafe Yıldız" yaptı. Mahalle seni biraz cimri buldu.', 'The owner changed it to "Café Star". The neighbourhood thinks you\'re a bit stingy.'), fans(-4), press(-2)),
      },
      {
        label: t('Avukat mektubu gönder', "Send a lawyer's letter"),
        effects: () => fx(t('Tabela iki gün içinde indi. Hukuken haklısın; kafe sahibi yerel gazeteye ağladı.', 'The sign came down within two days. You were legally right; the owner cried to the local paper.'), fans(-5), press(-3), rel('agent', 3)),
      },
    ],
  },
  {
    id: 'community.refugee_programme',
    category: 'community',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20,
    vars: ({ state }) => ({ amount: wageX(state, 2, 2500) }),
    title: t('Sahada Yeni Bir Başlangıç', 'A Fresh Start on the Pitch'),
    text: t(
      'Yerel bir dernek, savaştan kaçmış ailelerin çocuklarına futbol antrenmanı veriyor. Ortak dil yok ama top herkesin anladığı dil. Seni elçi olarak istiyorlar: ayda bir antrenman ve biraz görünürlük.',
      'A local association runs football sessions for children whose families fled war. No common language, but everyone speaks ball. They want you as an ambassador: one session a month, a bit of visibility.',
    ),
    icon: '🌍',
    choices: [
      {
        label: t('Elçi ol', 'Become an ambassador'),
        effects: () =>
          fx(t('İlk antrenmanda bir çocuk sana kendi dilinde "kaptan" demeyi öğretti. Şimdi her ay oradasın.', 'At the first session a boy taught you how to say "captain" in his language. Now you\'re there every month.'), rep(3), happy(7), energy(-6), press(3), chairman(2), { addFlags: { community_good: 1 } }),
      },
      {
        label: t('Bağış yap, isim verme', 'Donate anonymously'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Şu an bağış yapacak durumda değilsin.', "You can't afford to donate right now."),
        effects: (ctx) => fx(t('{amount:money} ile toplar, kramponlar ve bir minibüs kirası. Kimse bilmeyecek. Sen bileceksin.', '{amount:money} bought balls, boots and a minibus hire. Nobody will know. You will.'), money(-num(ctx, 'amount')), happy(6)),
      },
      {
        label: t('Kibarca reddet, takvimin dolu', 'Decline politely; your schedule is full'),
        effects: () => fx(t('Dernek anlayışla karşıladı. Yine de broşürlerini çantanda taşıyorsun.', 'They understood. You still carry their leaflet in your bag.'), stress(-1), happy(-2)),
      },
    ],
  },
]
