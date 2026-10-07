/** Fans: autographs, ultras politics, chants, away-day hostility, superfans. */
import {
  ban, boss, canAfford, disc, energy, fans, fatigue, flags, folPct, follow, fx, happy, hasClub, money, morale, news, num,
  pickFirst, press, rel, rep, stress, t, chain, trust, wageX, heroShoneLastMatch,
} from '../dsl'
import type { EventDef } from '../types'

export const fansEvents: EventDef[] = [
  {
    // Fairness (store reviews: "hat-trick and still got blamed"): the stand knows who fought.
    id: 'fans.hero_in_defeat',
    category: 'fans',
    weight: 2,
    cooldownWeeks: 6,
    triggers: ['match_loss'],
    conditions: ({ state }) => hasClub(state) && heroShoneLastMatch(state),
    title: t('Yenilgide Ayakta Alkış', 'A Standing Ovation in Defeat'),
    text: t(
      'Maç kaybedildi ama tribün oturmadı. Senin adını söylüyorlar. Takım arkadaşların başları önde soyunma odasına giderken sen hâlâ sahadasın.',
      'The game is lost, but the stand won\'t sit down. They\'re chanting your name. Your teammates head for the tunnel, heads bowed; you\'re still on the pitch.',
    ),
    icon: '👏',
    choices: [
      {
        label: t('Takımı geri çağır, birlikte selamlayın', 'Call the team back and salute them together'),
        effects: () => fx(t('Bütün takım tribüne yürüdü. Alkış ikiye katlandı. Kaptan omzuna dokundu: "Sağ ol."', 'The whole squad walked to the stand. The applause doubled. The captain touched your shoulder: "Thanks."'), fans(4), rel('teammate', 3), trust(2)),
      },
      {
        label: t('Formanı tribüne at', 'Throw your shirt into the crowd'),
        effects: () => fx(t('Formayı küçük bir çocuk yakaladı. Haftanın fotoğrafı oldu.', 'A small kid caught it. Photo of the week.'), fans(6), rep(1)),
      },
      {
        label: t('Başını eğ, kazanamadık', 'Head down: we didn\'t win'),
        effects: () => fx(t('Alkışı kabul etmedin. Taraftar bunu da sevdi: "Kazanmak istiyor."', 'You didn\'t accept the applause. The fans loved that too: "This one wants to win."'), fans(3), morale(2)),
      },
    ],
  },
  {
    id: 'fans.autograph_swarm',
    category: 'fans',
    weight: 1.2,
    cooldownWeeks: 10,
    triggers: ['weekly', 'training'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 15,
    title: t('İmza Seli', 'Autograph Avalanche'),
    text: t(
      'Antrenman çıkışı. Tesis kapısında elinde forma, top, hatta bir tane de bebek bezi paketi tutan elli kişi var. Arabana yürümek için önünde yaklaşık kırk dakikalık imza var.',
      'Leaving training. Fifty people are waiting at the gate with shirts, balls and, for some reason, a packet of nappies. Between you and your car stands roughly forty minutes of signing.',
    ),
    icon: '✍️',
    choices: [
      {
        label: t('Hepsini imzala, selfie dahil', 'Sign everything, selfies included'),
        hint: t('Yorucu ama unutulmaz.', 'Exhausting, but they will never forget it.'),
        effects: (ctx) =>
          fx(
            t('Bebek bezi paketini de imzaladın. Bilek ağrıyor; ama {city} bu akşam senden bahsediyor.', 'You even signed the nappies. Your wrist aches, but {city} is talking about you tonight.'),
            fans(8), energy(-12), fatigue(4), folPct(ctx, 2), happy(3),
          ),
      },
      {
        label: t('Çocuklara öncelik ver, gerisine el salla', 'Kids first, wave to the rest'),
        effects: () =>
          fx(t('Çocuklar mutlu, birkaç yetişkin söylenerek dağıldı. Makul bir orta yol.', 'The kids are thrilled, a few grown-ups grumble off. A decent middle ground.'), fans(3), energy(-4)),
      },
      {
        label: t('Arka kapıdan sıvış', 'Slip out the back'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Kimse fark etmedi. Eve erken vardın, kanepe seni bekliyordu.', 'Nobody noticed. Home early, the sofa welcomed you back.'), energy(6))
            : fx(
                t('Biri seni kamerayla yakaladı: "Yıldız taraftardan kaçıyor." Video bir günde yayıldı.', 'Someone filmed you sneaking off: "Star runs from {g:his|her} own fans." It went round in a day.'),
                fans(-8), folPct(ctx, -1), stress(5),
              ),
      },
    ],
  },
  {
    id: 'fans.ultras_banner',
    category: 'fans',
    weight: 0.9,
    cooldownWeeks: 40,
    once: true,
    minWeek: 3,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20,
    vars: (_ctx, rng) => ({ ultraLeader: pickFirst(rng) }),
    title: t('Tribün Liderinin Daveti', "The Ultras' Invitation"),
    text: t(
      'Kale arkası grubunun lideri {ultraLeader} telefonda: "Perşembe dernekte toplantı var. Gel, pankarta imza at, çocuklar seni görsün. Sen bizdensin, değil mi?" Soru değil gibi soruldu.',
      'On the phone is {ultraLeader}, the leader of the end-behind-the-goal crew: "Meeting at the clubhouse Thursday. Come sign the banner, let the lads see you. You\'re one of us, right?" It doesn\'t sound like a question.',
    ),
    icon: '🚩',
    choices: [
      {
        label: t('Toplantıya git', 'Go to the meeting'),
        hint: t('Tribün seni sever; kulüp bu ilişkiyi sevmeyebilir.', 'The stands will love you; the club may not love the link.'),
        risk: 'medium',
        effects: () =>
          fx(
            t('Duman, çay, davul. Pankartı imzaladın, marş söylendi. {ultraLeader} kulağına eğildi: "Bir dahaki iç saha maçında seni bekleriz."', 'Smoke, tea, drums. You signed the banner, they sang the anthem. {ultraLeader} leaned in: "We\'ll be expecting you at the next home game."'),
            fans(15), boss(-3), disc(-2),
            flags({ ultras_friend: true }), follow(chain('fans.ultras_choreo', 2)),
          ),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () =>
          fx(
            t('"Kulüp kuralları, anlarsın" dedin. Hattın öbür ucunda uzun bir sessizlik oldu.', '"Club rules, you understand," you said. There was a long silence on the line.'),
            fans(-5), trust(2),
            flags({ ultras_snub: true }), follow(chain('fans.ultras_hostile_banner', 3)),
          ),
      },
      {
        label: t('İmzalı forma gönder, kendin gitme', "Send a signed shirt, don't go yourself"),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Forma derneğin duvarına asıldı. Onurlandılar, idare eder.', 'The shirt went up on the clubhouse wall. Honour roughly satisfied.'), fans(4))
            : fx(
                t('{ultraLeader} formayı geri yollamadı ama mesaj attı: "Forma değil, {g:adam|yürek} istiyoruz."', '{ultraLeader} kept the shirt but texted: "We wanted {g:a man|a leader}, not a shirt."'),
                fans(-2), stress(3), follow(chain('fans.ultras_hostile_banner', 4)),
              ),
      },
    ],
  },
  {
    id: 'fans.ultras_choreo',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    triggers: ['post_match', 'match_win'],
    conditions: () => true,
    title: t('Megafon Sende', 'Your Turn on the Megaphone'),
    text: t(
      'Maç bitti. Kale arkasında devasa bir koreografi: senin yüzün, üç kat boyunda. {ultraLeader} tel örgünün üstünden megafonu uzatıyor. Kulüp basın sorumlusu uzaktan "sakın" diye kafa sallıyor.',
      'Full time. Behind the goal, a giant tifo: your face, three storeys high. {ultraLeader} holds a megaphone out over the fence. The club press officer, across the pitch, is shaking his head: "don\'t".',
    ),
    icon: '📣',
    choices: [
      {
        label: t('Megafonu al, marşı başlat', 'Take it, lead the chant'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('Kırk bin kişi sesini tekrarladı. Tüylerin diken diken. Ertesi gün yönetim "kurumsal duruş" diye bir e-posta attı.', 'Forty thousand voices echoed yours. Goosebumps. Next day the board emailed about "corporate conduct".'),
            fans(18), folPct(ctx, 4), boss(-5), disc(-5), happy(6),
            news(t('{heroName} kale arkasında marş yönetti', '{heroName} leads the chants from the ultras end'), 1),
          ),
      },
      {
        label: t('Alkışla, megafonu nazikçe geri ver', 'Applaud them, hand the megaphone back'),
        effects: () =>
          fx(t('Saygıyı gösterdin ama sahneyi almadın. {ultraLeader} omuz silkti: "Sen bilirsin."', 'You showed respect without taking the stage. {ultraLeader} shrugged: "Your call."'), fans(4), trust(1)),
      },
      {
        label: t('Koreografinin fotoğrafını paylaş, tribünü etiketle', 'Post the tifo, tag the ultras'),
        effects: (ctx) =>
          fx(t('Paylaşım uçtu. Tribün de memnun, yönetim de bir şey diyemedi.', 'The post flew. The ultras are happy and the board has nothing to object to.'), fans(7), folPct(ctx, 3)),
      },
    ],
  },
  {
    id: 'fans.ultras_hostile_banner',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Tribünde Pankart', 'The Banner'),
    text: t(
      'Isınmaya çıktığında kale arkasında kocaman bir pankart: "{heroName}: Arması olmayan kalbin, formayı hak etmez." Kameralar bir pankarta bir sana dönüyor.',
      'You walk out for the warm-up and there it is, behind the goal: "{heroName}: no badge on your heart, no right to the shirt." The cameras swing between the banner and you.',
    ),
    icon: '🪧',
    choices: [
      {
        label: t('Gidip tribünü alkışla', 'Walk over and applaud them'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('Birkaç saniye ıslık, sonra alkış. Buzlar eridi, pankart devre arası indi.', 'A few seconds of whistles, then applause. The ice broke; the banner came down at half-time.'), fans(10), morale(4), flags({ ultras_snub: null }))
            : fx(t('Islık arttı. Isınmanın kalanını kulakların yanarak yaptın.', 'The whistles got louder. You finished the warm-up with burning ears.'), fans(-4), stress(8), morale(-5)),
      },
      {
        label: t('Basına konuş: "Formanın hakkını sahada veririm"', 'Tell the press: "I answer on the pitch"'),
        effects: () =>
          fx(t('Cümle manşet oldu. Bir kısım taraftar arkanda, kale arkası daha da kızgın.', 'The quote made the headlines. Some fans back you; the ultras are angrier than ever.'), press(4), fans(-3), rep(1), stress(4)),
      },
      {
        label: t('Görmezden gel', 'Ignore it'),
        effects: () => fx(t('Pankart orada kaldı, sen de oradaydın. Bu sefer fark etmedin gibi yaptın.', 'The banner stayed. So did you. You pretended not to see it.'), stress(5), fans(-2)),
      },
    ],
  },
  {
    id: 'fans.chant',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 30,
    triggers: ['match_win', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.position !== 'GK',
    title: t('Sana Bir Beste', 'They Wrote You a Song'),
    text: t(
      'Tribün senin için marş yaptı: bilinen bir pop şarkısının nakaratına adın oturtulmuş. Kafiye "{heroName}" ile "bir tane daha"yı eşleştirmiş. Bir dizesi de... hafif kaba.',
      'The stands have a song for you: your name crammed into a pop chorus. It rhymes "{heroName}" with something about "another one". One verse is also... slightly rude.',
    ),
    icon: '🎶',
    choices: [
      {
        label: t('Soyunma odasında söyleyip video paylaş', 'Sing it in the dressing room, post the video'),
        effects: (ctx) =>
          fx(t('Sesin kötü, takım daha kötü. Video milyon izlendi.', 'You sing badly; the team sings worse. The video does a million views.'), folPct(ctx, 6), fans(8), rel('teammate', 2), happy(4)),
      },
      {
        label: t('Kaba dizenin değişmesini rica et', 'Ask them to change the rude verse'),
        hint: t('Doğru olan bu; tribün bunu nasıl alır bilinmez.', 'The right thing; who knows how the stands take it.'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Dize "annesinin {g:oğlu|kızı}" olarak değişti. {motherName} gururdan ağladı.', 'The line became "{g:his|her} mother\'s pride". {motherName} cried with joy.'), fans(4), rel('mother', 6), rep(1))
            : fx(t('"Şarkıya da mı karışacak?" Tribün dizeyi daha yüksek söylemeye başladı.', '"Now {g:he\'s|she\'s} editing our songs?" They started singing the verse louder.'), fans(-4), stress(3)),
      },
      {
        label: t('Mütevazı kal, sahada konuş', 'Stay humble, let your feet talk'),
        effects: () => fx(t('Bir gol sonrası tribüne el salladın, o kadar. Beste yaşamaya devam ediyor.', 'A wave to the end after a goal, nothing more. The song lives on.'), fans(3), morale(3)),
      },
    ],
  },
  {
    id: 'fans.kid_sign',
    category: 'fans',
    weight: 1.1,
    cooldownWeeks: 14,
    triggers: ['post_match'],
    conditions: ({ state }) => hasClub(state),
    vars: (_ctx, rng) => ({ kidName: rng.pick(['Efe', 'Yusuf', 'Zeynep', 'Mira', 'Kuzey', 'Ela']) }),
    title: t('Pankartlı Çocuk', 'The Kid with the Sign'),
    text: t(
      'Maç bitti, kenarda küçük bir el pankartı: "{heroName}, formanı verir misin? Annem 9 yaşındayım dedi, ama aslında 8." Pankartın sahibi {kidName}, heyecandan titriyor.',
      'Final whistle. A small hand-drawn sign by the tunnel: "{heroName}, can I have your shirt? Mum says I\'m 9 but I\'m actually 8." Its owner, {kidName}, is shaking with excitement.',
    ),
    icon: '👕',
    choices: [
      {
        label: t('Formayı ver, bir de sarıl', 'Hand over the shirt, plus a hug'),
        effects: (ctx) =>
          fx(t('{kidName} formanın içinde kayboldu. Yayıncı kamera o anı yakaladı.', '{kidName} disappeared inside the shirt. The broadcaster caught the moment.'), fans(6), folPct(ctx, 2), happy(5), rep(1)),
      },
      {
        label: t('Kramponlarını da ver', 'Throw in your boots too'),
        hint: t('Yeni çift almak gerekecek.', 'You will need a new pair.'),
        requires: (ctx) => canAfford(ctx.state, 300),
        lockedHint: t('Yeni krampon parası yok.', "Can't afford new boots."),
        effects: (ctx) =>
          fx(
            t('Çamurlu kramponlar, forma ve bir hayat boyu hikâye. Ertesi gün yeni krampon almak zorunda kaldın.', 'Muddy boots, a shirt and a story for life. Next morning you had to buy new boots.'),
            money(-300), fans(9), folPct(ctx, 3), happy(6), rep(1),
          ),
      },
      {
        label: t('Forma takımla değişilecek, imza at geç', 'Shirt is promised to an opponent; sign the sign'),
        effects: () => fx(t('Pankartı imzaladın. {kidName} yine sevindi; biraz da kırıldı.', 'You signed the sign. {kidName} was happy. A bit crushed, too.'), fans(1), stress(2)),
      },
    ],
  },
  {
    id: 'fans.away_hostile',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 10,
    triggers: ['match_loss'],
    conditions: ({ state }) => hasClub(state),
    title: t('Deplasman Cehennemi', 'Away-Day Inferno'),
    text: t(
      '{rivalClub} deplasmanı, maç kaybedildi. Korner bayrağına gittiğin her seferinde yüzlerce kişi senin hakkında yaratıcı şeyler söylüyor. Biri de bozuk para fırlattı.',
      'Away at {rivalClub}, and you lost. Every time you went near the corner flag, a few hundred people said creative things about you. Someone threw a coin.',
    ),
    icon: '🔥',
    choices: [
      {
        label: t('Skorbord yerine forma armasını göster', 'Kiss the badge at them'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Kendi taraftarın bayıldı; hakem kart göstermedi. Efsane an.', 'Your own fans loved it, the ref let it go. Legendary.'), fans(10), morale(5))
            : fx(
                t('Federasyon "kışkırtıcı hareket" dedi: bir maç ceza.', 'The federation called it "provocative conduct": a one-match ban.'),
                fans(5), ban(1), disc(-6), boss(-4),
                news(t('{heroName} deplasmanda tribünü kışkırttı', '{heroName} provokes away crowd'), -1),
              ),
      },
      {
        label: t('Yüzü dönük, soyunma odasına yürü', 'Head down, walk to the tunnel'),
        effects: () => fx(t('Akıllıca. Ama o sesler gece rüyana girdi.', 'Sensible. But those voices followed you into your dreams.'), stress(6), trust(1)),
      },
      {
        label: t('Parayı hakeme götür, sakin kal', 'Hand the coin to the referee, stay calm'),
        effects: () =>
          fx(t('Soğukkanlılığın maç sonu programlarında övüldü. Rakip kulübe ceza yağdı.', 'Your composure was praised on every post-match show. The home club got fined.'), press(5), rep(2), disc(3)),
      },
    ],
  },
  {
    id: 'fans.mural',
    category: 'fans',
    weight: 0.8,
    cooldownWeeks: 52,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 35,
    vars: ({ state }) => ({ amount: wageX(state, 1, 800) }),
    title: t('Duvardaki Sen', 'You, on a Wall'),
    text: t(
      'Taraftarlar internetten para topladı: stadın arkasındaki duvara dev bir {heroName} resmi yapılacak. Ressam hangi pozu istediğini soruyor. Bütçe biraz eksik, {amount:money} kadar.',
      'Fans crowdfunded a giant {heroName} mural on the wall behind the stadium. The artist wants to know which pose you prefer. They are about {amount:money} short.',
    ),
    icon: '🎨',
    choices: [
      {
        label: t('Eksik parayı sen tamamla', 'Cover the shortfall yourself'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu parayı şu an ayıramazsın.', "You can't spare that right now."),
        effects: (ctx) =>
          fx(t('Duvar bitti; turistler önünde fotoğraf çekiyor. Biraz tuhaf, biraz harika.', 'The wall is finished; tourists pose in front of it. Slightly weird, mostly wonderful.'), money(-num(ctx, 'amount')), fans(10), rep(2), happy(5)),
      },
      {
        label: t('Sadece poz öner, gerisi onlarda', 'Suggest a pose, leave the rest to them'),
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Resim bitti. Benzerlik... diyelim ki iddialı. Yine de içini ısıttı.', 'It is done. The likeness is... ambitious. It still warms your heart.'), fans(5), happy(3))
            : fx(t('Para yetmedi; resim belden yukarı kaldı. "Yarım {heroName}" internette mem oldu.', 'Money ran out; you exist from the waist up. "Half-{heroName}" became a meme.'), fans(3), stress(3)),
      },
      {
        label: t('"O parayı mahalle sahasına verin" de', 'Ask them to give the money to a local pitch'),
        effects: () =>
          fx(t('Mütevazılık takdir topladı. Bazı taraftarlar "biz duvar istiyorduk" diye söylendi.', 'The humility won praise. Some fans grumbled that they really wanted the wall.'), rep(3), press(4), fans(-2)),
      },
    ],
  },
  {
    id: 'fans.superfan',
    category: 'fans',
    weight: 0.8,
    cooldownWeeks: 60,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 25,
    vars: (_ctx, rng) => ({ fanName: pickFirst(rng) }),
    title: t('Her Yerde O', 'Always There'),
    text: t(
      '{fanName} adında biri bu ay antrenmanda, havaalanında, kahvecinde ve dişçinin bekleme salonunda karşına çıktı. Her seferinde aynı gülümseme, aynı formalar, aynı "Selam kardeşim!".',
      'This month a fan called {fanName} turned up at training, the airport, your coffee shop and your dentist\'s waiting room. Same smile, same shirt, same "Alright, brother!".',
    ),
    icon: '👀',
    choices: [
      {
        label: t('Sohbet et, selfie çekil', 'Chat and take a selfie'),
        effects: () =>
          fx(t('{fanName} çok mutlu oldu. Gereğinden biraz fazla mutlu.', '{fanName} was delighted. Maybe a bit too delighted.'), fans(3), happy(2), follow(chain('fans.superfan_gate', 3))),
      },
      {
        label: t('Kibar ama net bir sınır koy', 'Set a kind but firm boundary'),
        effects: (_ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('"Anladım {g:abi|abla}, kusura bakma." Sonra gerçekten kayboldu. Rahatladın.', '"Got it, sorry." And then actually vanished. Relief.'), stress(-3))
            : fx(t('Anlamış gibi yaptı. Ertesi hafta bakkalda yine karşındaydı.', 'Nodded along. Next week, there at the corner shop again.'), stress(4), follow(chain('fans.superfan_gate', 2))),
      },
      {
        label: t('Kulüp güvenliğine bildir', 'Report it to club security'),
        effects: () => fx(t('Güvenlik ilgilendi. {fanName} tesise giriş yasağı aldı; sosyal medyada sitem dolu bir mesaj yazdı.', 'Security handled it. {fanName} got banned from the training ground and posted a wounded message online.'), stress(-4), fans(-2)),
      },
    ],
  },
  {
    id: 'fans.superfan_gate',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Kapının Önünde', 'At Your Gate'),
    text: t(
      'Sabah yedide zil çaldı. Kapıda {fanName}: elinde ev yapımı börek ve senin çocukluk fotoğrafların olan bir albüm. "Annenin eski komşusundan aldım" diyor.',
      'Seven a.m., the doorbell. It is {fanName}, holding home-made pastries and an album of your childhood photos. "Got them from your mum\'s old neighbour," comes the explanation.',
    ),
    icon: '🚪',
    choices: [
      {
        label: t('Çay ver ama sınırları konuş', 'Make tea, talk about boundaries'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Uzun ve tuhaf bir sohbet. Sonunda anlaştınız: maç günleri tribünde, diğer günler uzakta.', 'A long, strange chat. In the end, a deal: match days in the stands, other days far away.'), stress(-2), fans(2))
            : fx(t('Çayı içti, albümü bıraktı, "haftaya gelirim" dedi. Kapı kamerası taktırdın.', 'Drank the tea, left the album, promised to "pop by next week". You ordered a door camera.'), stress(8), money(-400)),
      },
      {
        label: t('Polisi ara', 'Call the police'),
        effects: () =>
          fx(t('Uzaklaştırma kararı çıktı. Olay basına sızdı; çoğu kişi senin tarafında.', 'A restraining order was issued. It leaked to the press; most people are on your side.'), stress(-5), press(2), news(t('{heroName}\'in kapısında takıntılı taraftar', 'Obsessed fan turns up at {heroName}\'s door'), 0)),
      },
      {
        label: t('Daha korunaklı bir siteye taşın', 'Move to a gated complex'),
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 3, 3000)),
        lockedHint: t('Taşınmaya bütçen yetmiyor.', "You can't afford to move."),
        effects: (ctx) =>
          fx(t('Yeni ev, güvenlik görevlisi, yüksek duvarlar. Sakin ama biraz yalnız.', 'New house, a guard, tall walls. Calm, and a little lonely.'), money(-wageX(ctx.state, 3, 3000)), stress(-8), happy(-2)),
      },
    ],
  },
]
