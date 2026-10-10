/** Weird & wonderful: the odd, funny moments that make a career feel lived-in. */
import { boss, canAfford, disc, fans, flags, follow, folPct, form, fx, happy, hasClub, hasFlag, money, morale, num, press, rel, rep, stress, t, chain, trust, wageX } from '../dsl'
import type { EventDef } from '../types'

export const weirdEvents: EventDef[] = [
  {
    id: 'weird.lost_dog',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 0,
    once: true,
    triggers: ['training', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Antrenmanda Bir Misafir', 'A Visitor at Training'),
    text: t(
      'Antrenmanın ortasında çamurlu, tasmasız bir köpek sahaya daldı, topu kaptı ve kaleye koştu. Kaleciden daha iyi plonjon yaptı. Şimdi ayaklarının dibinde oturmuş, sana bakıyor.',
      'Mid-session, a muddy, collarless dog sprinted onto the pitch, nicked the ball and headed for goal. Its dive beat the keeper\'s. Now it\'s sitting at your feet, staring at you.',
    ),
    icon: '🐕',
    choices: [
      {
        label: t('Sahiplen', 'Adopt it'),
        hint: t('Ev düzenin değişir.', 'Your home life will change.'),
        effects: () => fx(t('Adını "Ofsayt" koydun çünkü hep yanlış yerde duruyor.', 'You named it "Offside" because it is always in the wrong place.'), happy(10), stress(-5), money(-300), flags({ dog: 'Ofsayt' }), follow(chain('weird.dog_mascot', 4))),
      },
      {
        label: t('Barınağa götür, sahibini bulsunlar', 'Take it to a shelter to find the owner'),
        effects: () => fx(t('Sahibi ertesi gün bulundu ve sana kocaman bir ev yapımı börek getirdi.', 'The owner turned up next day with an enormous homemade pastry for you.'), happy(4), rep(1)),
      },
      {
        label: t('Malzemeciye bırak', 'Leave it with the kit man'),
        effects: () => fx(t('Malzemeci köpekle kankası oldu. Artık sana fazladan havlu veriyor.', 'The kit man and the dog are now inseparable. You get extra towels.'), rel('teammate', 2), happy(2)),
      },
    ],
  },
  {
    id: 'weird.dog_mascot',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'dog'),
    title: t('Ofsayt Şöhret Oluyor', 'Offside Becomes Famous'),
    text: t(
      'Kulüp, köpeğin "Ofsayt"ın antrenman videosunu paylaştı: 3 milyon izlenme. Pazarlama departmanı onu resmî maskot yapmak istiyor.',
      'The club posted a clip of Offside at training: three million views. The marketing department wants it as the official mascot.',
    ),
    icon: '🐾',
    choices: [
      {
        label: t('Kabul et, maç günü sahaya çıksın', 'Accept; it walks out on matchday'),
        effects: (ctx) => fx(t('Ofsayt orta sahada havladı, stadyum ayağa kalktı. Satılan peluş sayısı: çok.', 'Offside barked at the centre circle and the stadium rose. Plush toys sold: loads.'), fans(10), folPct(ctx, 8), rep(2), happy(6)),
      },
      {
        label: t('Gelirin barınaklara gitmesini şart koş', 'Only if proceeds go to animal shelters'),
        effects: (ctx) => fx(t('Kampanya ülke çapında yayıldı. Barınaklar dolu değil, boşalıyor.', 'The campaign went national. Shelters are emptying instead of filling.'), rep(4), press(5), folPct(ctx, 5), happy(5)),
      },
      {
        label: t('Hayır, o sadece benim köpeğim', 'No, it\'s just my dog'),
        effects: () => fx(t('Pazarlama hayal kırıklığına uğradı. Ofsayt ise kanepede horluyor.', 'Marketing are gutted. Offside is snoring on the sofa.'), stress(-4), happy(3), rel('chairman', -2)),
      },
    ],
  },
  {
    id: 'weird.parrot_chants',
    category: 'weird',
    weight: 0.8,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Tezahüratçı Papağan', 'The Chanting Parrot'),
    text: t(
      'Komşunun papağanı balkonda senin adına yazılmış tezahüratı söylüyor — küfürlü versiyonunu. Komşu bir video çekip sana etiketledi.',
      'Your neighbour\'s parrot is on the balcony belting out your chant — the rude version. The neighbour filmed it and tagged you.',
    ),
    icon: '🦜',
    choices: [
      {
        label: t('Videoyu paylaş', 'Share the video'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Papağanın şimdi kendi hayran sayfası var. Seninkinden hızlı büyüyor.', 'The parrot now has its own fan page. It\'s growing faster than yours.'), folPct(ctx, 8), fans(4), happy(4))
            : fx(t('Bir aile derneği "çocuklara kötü örnek" diye açıklama yaptı.', 'A family association issued a statement about "setting a bad example".'), folPct(ctx, 4), press(-4), disc(-2)),
      },
      {
        label: t('Papağana temiz versiyonu öğret', 'Teach the parrot the clean version'),
        effects: () => fx(t('Üç hafta, iki kilo çekirdek. Artık "Bir gol daha!" diyor. Ve hâlâ ara sıra kötü sözü.', 'Three weeks and two kilos of seeds later it says "One more goal!". Mostly.'), happy(5), stress(-3)),
      },
      {
        label: t('Komşuya imzalı forma gönder', 'Send the neighbour a signed shirt'),
        effects: () => fx(t('Komşu formayı papağanın kafesinin üstüne astı.', 'The neighbour hung the shirt over the parrot\'s cage.'), fans(2), happy(2)),
      },
    ],
  },
  {
    id: 'weird.hairstyle_bet',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 52,
    triggers: ['weekly', 'post_match'],
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'hair_bet'),
    title: t('Saç Bahsi', 'The Haircut Bet'),
    text: t(
      '{mate} meydan okuyor: "Bu hafta gol atamazsan, saçını benim seçtiğim modelde kestireceksin." Takım çoktan modeli oyladı bile; sonuç gizli.',
      '{mate} lays down a challenge: "Don\'t score this week and you get the haircut of MY choice." The squad has already voted on the style. Result: secret.',
    ),
    icon: '💇',
    choices: [
      {
        label: t('Kabul! Gol atarım.', 'Deal! I\'ll score.'),
        risk: 'high',
        effects: () => fx(t('Bahis tutuldu. Soyunma odasında makas sesleri taklit ediliyor.', 'Bet on. Somebody keeps doing scissor noises in the dressing room.'), rel('teammate', 4), morale(3), flags({ hair_bet: true }), follow(chain('weird.hairstyle_reveal', 1))),
      },
      {
        label: t('Bahsi ikiye katla: kaybeden ikimiz de keser', 'Double it: if I win, you get the cut'),
        risk: 'high',
        effects: () => fx(t('{mate} yutkundu ama kabul etti. Takım popcorn hazırlıyor.', '{mate} gulped but agreed. The squad is making popcorn.'), rel('teammate', 6), flags({ hair_bet: 'double' }), follow(chain('weird.hairstyle_reveal', 1))),
      },
      {
        label: t('Saçıma dokunulmaz', 'Nobody touches the hair'),
        effects: () => fx(t('"Korkak!" nidaları bir hafta sürdü.', 'Chants of "Chicken!" lasted a week.'), rel('teammate', -2), morale(-2)),
      },
    ],
  },
  {
    id: 'weird.hairstyle_reveal',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'hair_bet'),
    title: t('Bahsin Sonu', 'Bet Settled'),
    text: t(
      'Hafta bitti. Kuaför koltuğu soyunma odasının ortasında hazır. {mate} elinde bir zarfla bekliyor: içinde seçilen model var.',
      'The week is over. A barber chair sits in the middle of the dressing room. {mate} holds an envelope containing the chosen style.',
    ),
    icon: '✂️',
    choices: [
      {
        label: t('Zarfı aç', 'Open the envelope'),
        risk: 'high',
        effects: (ctx, rng) => {
          const won = rng.chance(0.4 + ctx.state.hero.form / 250)
          const dbl = ctx.state.life.flags['hair_bet'] === 'double'
          if (won)
            return fx(
              dbl
                ? t('Gol attın! {mate} artık kâküllü. Takım fotoğrafı tarihe geçti.', 'You scored! {mate} now has a bowl cut. The team photo is history.')
                : t('Gol attın, saçın güvende. Zarfta ne yazdığını hiç öğrenemeyeceksin.', 'You scored; the hair survives. You will never know what was in the envelope.'),
              rel('teammate', 5), happy(6), flags({ hair_bet: null }),
            )
          return fx(
            t('Zarfta "çift renkli mohikan" yazıyordu. Ertesi gün maçta 40 bin kişi seni tanıdı... uzaktan.', 'The envelope said "two-tone mohawk". 40,000 people recognised you from across the stadium.'),
            folPct(ctx, 6), fans(3), morale(-3), boss(-2), flags({ hair_bet: null }),
          )
        },
      },
      {
        label: t('Kaçmaya çalış', 'Try to escape'),
        effects: () => fx(t('Üç kişi seni yakaladı. Sonuç: yarım kalmış bir kesim ve bol kahkaha.', 'Three of them caught you. Result: half a haircut and plenty of laughs.'), rel('teammate', 3), happy(2), morale(-2), flags({ hair_bet: null })),
      },
    ],
  },
  {
    id: 'weird.game_cover',
    category: 'weird',
    weight: 0.6,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => state.hero.reputation >= 55,
    vars: ({ state }) => ({ fee: wageX(state, 8, 20000) }),
    title: t('Video Oyunu Kapağı', 'Video Game Cover Star'),
    text: t(
      'Yılın en çok satan futbol oyununun yapımcıları seni kapakta istiyor. Ücret: {fee:money}. Tek sorun: oyunda senin reytingin 81. Sen 88 olduğunu düşünüyorsun.',
      'The year\'s best-selling football game wants you on the cover. Fee: {fee:money}. One problem: your in-game rating is 81. You think it should be 88.',
    ),
    icon: '🎮',
    choices: [
      {
        label: t('İmzala, reytingi boş ver', 'Sign; forget the rating'),
        effects: (ctx) => fx(t('Kapakta havalı görünüyorsun. Hız reytingine dair yorumlar ise acımasız.', 'You look cool on the cover. The comments about your pace rating are brutal.'), money(num(ctx, 'fee')), rep(4), folPct(ctx, 10)),
      },
      {
        label: t('Reytingini yükseltmeleri şartıyla', 'Only if they bump your rating'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('85\'te anlaştınız. Herkes kazandı, özellikle egon.', 'You settled on 85. Everyone wins, especially your ego.'), money(num(ctx, 'fee')), rep(4), happy(6))
            : fx(t('Başka bir oyuncuyu kapağa koydular. Reytingin hâlâ 81.', 'They put someone else on the cover. Your rating is still 81.'), happy(-4), morale(-3)),
      },
      {
        label: t('Ücreti hayır kurumuna bağışla', 'Donate the fee to charity'),
        effects: (ctx) => fx(t('Kapak + bağış haberi: yılın en sevilen hikâyesi.', 'Cover star and donor: the feel-good story of the year.'), rep(6), fans(6), folPct(ctx, 8)),
      },
    ],
  },
  {
    id: 'weird.wrong_bus',
    category: 'weird',
    weight: 0.8,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Yanlış Otobüs', 'Wrong Bus'),
    text: t(
      'Deplasman sabahı kulaklıkla otobüse bindin, uyudun. Uyandığında etrafta bir emekliler korosu var ve otobüs kaplıcaya gidiyor. Maça 3 saat.',
      'Away day: you boarded the coach with headphones on and fell asleep. You wake up surrounded by a retirees\' choir on their way to a spa. Kick-off in three hours.',
    ),
    icon: '🚍',
    choices: [
      {
        label: t('Taksiye bin, ne pahasına olursa olsun', 'Grab a taxi, whatever it costs'),
        requires: (ctx) => canAfford(ctx.state, 800),
        lockedHint: t('Taksi için 800 € lazım.', 'The taxi needs €800.'),
        effects: () => fx(t('Isınmaya 10 dakika kala vardın. Hoca hiçbir şey demedi, bu daha kötü.', 'You arrived 10 minutes before the warm-up. The gaffer said nothing, which was worse.'), money(-800), boss(-3), stress(6)),
      },
      {
        label: t('Hocayı ara, gerçeği söyle', 'Call the gaffer and confess'),
        effects: () => fx(t('Kulüp seni almaya araba gönderdi. Hikâye sezon sonu videosuna girdi.', 'The club sent a car. The story made the end-of-season blooper reel.'), boss(-2), rel('teammate', 3), disc(-3)),
      },
      {
        label: t('Koroyla bir şarkı söyle, sonra kaç', 'Sing one song with the choir, then run'),
        effects: (ctx) => fx(t('Teyzeler videoyu paylaştı: "Ne tatlı çocuk!" Maça yetiştin, ama kıl payı.', 'The grannies posted the video: "What a sweet {g:boy|girl}!" You made kick-off, barely.'), folPct(ctx, 5), happy(5), boss(-4)),
      },
    ],
  },
  {
    id: 'weird.mascot_swap',
    category: 'weird',
    weight: 0.8,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Maskotun İçinde Kim Var?', 'Who\'s Inside the Mascot?'),
    text: t(
      'Sakat olduğun bir maçta kulübün maskotu hastalandı. Pazarlama müdürü sana dev bir kostüm uzatıyor: "Kimse anlamaz. Lütfen."',
      'On a matchday you are not playing, the club mascot is ill. The marketing manager holds out a giant costume: "Nobody will know. Please."',
    ),
    icon: '🦁',
    choices: [
      {
        label: t('Kostümü giy, şov yap', 'Suit up and put on a show'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Rakip maskotla dans düellosu yaptın. Kimse senin olduğunu bilmiyor... henüz.', 'You won a dance-off with the away mascot. Nobody knows it was you... yet.'), fans(6), happy(7), flags({ secret_mascot: true }))
            : fx(t('Kafa düştü. Stadyumun yarısı seni tanıdı. Çok sevdiler ama hoca o kadar değil.', 'The head fell off. Half the stadium recognised you. They loved it; the gaffer didn\'t.'), fans(8), folPct(ctx, 6), boss(-3)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('Maskotsuz maç. Çocuklar biraz üzüldü.', 'A mascot-less match. The kids were a bit sad.'), fans(-1)),
      },
      {
        label: t('Yerine {mate} gitsin', 'Volunteer {mate} instead'),
        effects: () => fx(t('{mate} kostümde terden eridi ve sana bir ay küs kaldı.', '{mate} melted in the costume and sulked at you for a month.'), rel('teammate', -4), happy(4)),
      },
    ],
  },
  {
    id: 'weird.bird_nest',
    category: 'weird',
    weight: 0.8,
    cooldownWeeks: 0,
    once: true,
    conditions: () => true,
    title: t('Arabadaki Kiracılar', 'Tenants in the Car'),
    text: t(
      'Garajda üç haftadır kullanmadığın arabanın tavan penceresine bir kuş yuva yapmış. İçinde üç yumurta var. Arabaya bugün ihtiyacın var.',
      'A bird has nested in the sunroof of the car you haven\'t driven in three weeks. Three eggs inside. You need the car today.',
    ),
    icon: '🐣',
    choices: [
      {
        label: t('Yumurtalar çıkana kadar taksiyle git', 'Take taxis until they hatch'),
        effects: () => fx(t('Üç hafta taksi. Yavrular çıktı; videosu duygusal yorumlarla doldu.', 'Three weeks of taxis. The chicks hatched, and the video drew a flood of soppy comments.'), money(-600), happy(6), rep(1)),
      },
      {
        label: t('Uzman çağır, yuvayı taşıt', 'Call an expert to relocate the nest'),
        effects: () => fx(t('Uzman yuvayı yandaki ağaca taşıdı. Kuş hâlâ sana kötü bakıyor.', 'The expert moved the nest to the tree next door. The bird still glares at you.'), money(-250), stress(-2)),
      },
      {
        label: t('Takım arkadaşından araba ödünç al', 'Borrow a teammate\'s car'),
        effects: () => fx(t('{mate} arabasını verdi; koltuklar enerji içeceği yapışkanıyla kaplı.', '{mate} lent you {g:his|her} car; the seats are sticky with energy drink.'), rel('teammate', 2), happy(2)),
      },
    ],
  },
  {
    id: 'weird.cooking_show',
    category: 'weird',
    weight: 0.7,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => state.hero.reputation >= 20,
    vars: ({ state }) => ({ fee: wageX(state, 1.5, 1500) }),
    title: t('Ünlü Yemek Yarışması', 'Celebrity Cook-Off'),
    text: t(
      'Akşam kuşağının ünlü yemek yarışması seni istiyor. Ücret: {fee:money}. Mutfakta en iyi yaptığın şey: tost. Bazen.',
      'Prime-time\'s celebrity cook-off wants you. Fee: {fee:money}. Your best dish: a toastie. Sometimes.',
    ),
    icon: '👨‍🍳',
    choices: [
      {
        label: t('Katıl, ne olursa olsun', 'Do it, come what may'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Annenin tarifiyle mantı yaptın ve kazandın! {motherName} gururdan uçuyor.', 'You cooked your mum\'s dumpling recipe and won! {motherName} is over the moon.'), money(num(ctx, 'fee')), folPct(ctx, 8), rel('mother', 8), happy(6))
            : fx(t('Mutfağı yaktın. Hafifçe. İzlenme rekoru kırdı.', 'You set the kitchen on fire. Slightly. Record ratings.'), money(num(ctx, 'fee')), folPct(ctx, 6), stress(4)),
      },
      {
        label: t('Kabul et ama önce annenden ders al', 'Accept, but take lessons from your mum first'),
        effects: (ctx) => fx(t('İki hafta annenin mutfağında. İkinci oldun ve aileyle bağın güçlendi.', 'Two weeks in your mum\'s kitchen. You came second and grew closer to family.'), money(num(ctx, 'fee')), rel('mother', 12), happy(4)),
      },
      {
        label: t('Reddet, futbola odaklan', 'Decline, focus on football'),
        effects: () => fx(t('Hoca "doğru karar" dedi. Mutfağın da güvende.', 'The gaffer said "good call". Your kitchen is safe too.'), trust(3), form(2)),
      },
    ],
  },
  {
    id: 'weird.seagull_banana',
    category: 'weird',
    weight: 0.9,
    cooldownWeeks: 0,
    once: true,
    triggers: ['post_match', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Martı Saldırısı', 'Seagull Heist'),
    text: t(
      'Maç öncesi ısınmada yediğin uğurlu muzunu bir martı elinden kaptı ve kale direğinin üstüne konup gözünün içine baka baka yedi. Kameralar her şeyi çekti.',
      'During the warm-up, a seagull snatched your lucky pre-match banana, perched on the crossbar and ate it while staring you down. Cameras caught everything.',
    ),
    icon: '🍌',
    choices: [
      {
        label: t('Martıya rövanş sözü ver (sosyal medyadan)', 'Swear revenge on the gull (online)'),
        effects: (ctx) => fx(t('"#MartıyaAdalet" etiketi trend oldu. Maçta da iyi oynadın, belki öfke işe yaradı.', '#JusticeForTheBanana trended. You played well, maybe fuelled by rage.'), folPct(ctx, 7), form(3), happy(3)),
      },
      {
        label: t('Bunu kötü işaret say', 'Take it as a bad omen'),
        effects: () => fx(t('Bütün maç martıyı düşündün. Kötü işaret kendini gerçekleştirdi.', 'You spent the whole game thinking about the gull. Self-fulfilling prophecy.'), form(-4), stress(4)),
      },
      {
        label: t('Malzemeciden yedek muz iste', 'Ask the kit man for a spare banana'),
        effects: () => fx(t('Malzemecinin çantasında her zaman yedek muz var. Profesyonellik.', 'The kit man always carries a spare banana. Professionalism.'), morale(2), stress(-1)),
      },
    ],
  },
  {
    id: 'weird.lucky_socks',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 0,
    once: true,
    triggers: ['match_win', 'scored'],
    conditions: ({ state }) => hasClub(state),
    title: t('Uğurlu Çoraplar', 'The Lucky Socks'),
    text: t(
      'Son üç galibiyette aynı iç çorapları giydin. Yıkamadan. Soyunma odasında koku bir kimyasal silah seviyesine ulaştı. {mate} gaz maskesi getirdi.',
      'You\'ve worn the same undersocks for three straight wins. Unwashed. The dressing-room smell is approaching chemical-weapon levels. {mate} brought a gas mask.',
    ),
    icon: '🧦',
    choices: [
      {
        label: t('Seri bitene kadar yıkama', 'No washing until the streak ends'),
        risk: 'medium',
        effects: () => fx(t('Seri devam ediyor. Kimse yanında oturmuyor.', 'The streak lives on. Nobody sits next to you.'), morale(5), rel('teammate', -4), flags({ lucky_socks: true }), follow(chain('weird.socks_crisis', 2))),
      },
      {
        label: t('Yıka ve batıl inancı bırak', 'Wash them and drop the superstition'),
        effects: () => fx(t('Temiz çoraplar. Hafif bir huzursuzluk. Takım derin bir nefes aldı.', 'Clean socks. Mild anxiety. The squad breathed deeply again.'), rel('teammate', 4), stress(2)),
      },
      {
        label: t('Çorapları vakumla paketle, maçtan maça çıkar', 'Vacuum-seal them between games'),
        effects: () => fx(t('Bilimsel bir uzlaşma. Malzemeci seninle gurur duyuyor.', 'A scientific compromise. The kit man is proud of you.'), morale(3), happy(3), flags({ lucky_socks: true }), follow(chain('weird.socks_crisis', 3))),
      },
    ],
  },
  {
    id: 'weird.socks_crisis',
    category: 'weird',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'lucky_socks'),
    title: t('Çoraplar Kayıp!', 'The Socks Are Missing!'),
    text: t(
      'Büyük maç sabahı uğurlu çoraplar yok. Çanta, dolap, araba... hiçbir yerde. {mate} şüpheli derecede sakin görünüyor.',
      'Big-match morning and the lucky socks are gone. Bag, locker, car... nowhere. {mate} looks suspiciously calm.',
    ),
    icon: '🕵️',
    choices: [
      {
        label: t('Hesap sor: {mate}', 'Interrogate {mate}'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('İtiraf etti: "Takım adına yaktım." Kahkahalar arasında barıştınız; batıl inanç da yandı.', '{g:He|She} confessed: "I burned them for the good of the team." You made peace amid laughter; the superstition burned too.'), rel('teammate', 5), stress(-3), flags({ lucky_socks: null }))
            : fx(t('Masummuş. Ortam gerildi; sonra çoraplar annenin çamaşır sepetinden çıktı.', '{g:He|She} was innocent. Things got tense — then the socks turned up in your mum\'s laundry basket.'), rel('teammate', -6), stress(3), flags({ lucky_socks: null })),
      },
      {
        label: t('Yeni çoraplarla oyna, kendine güven', 'Play in new socks — trust yourself'),
        effects: () => fx(t('Çorapsız sihir yok. Sadece sen ve top. Kendinle ilgili bir şey öğrendin.', 'No sock magic. Just you and the ball. You learned something about yourself.'), morale(4), stress(-2), { setFlags: { lucky_socks: null } }),
      },
      {
        label: t('Maçı oynamayı reddet', 'Refuse to play without them'),
        kind: 'certain',
        hint: t('Gerçekten mi?', 'Really?'),
        risk: 'high',
        effects: () => fx(t('Hoca bunu "kariyerinin en saçma talebi" diye kayda geçti.', 'The gaffer logged it as "the most absurd request of my career".'), boss(-10), disc(-6), press(-3), flags({ lucky_socks: null })),
      },
    ],
  },
]
