/** Rivals: the nemesis, divers, mouthy agents and copycat celebrations. */
import { ban, boss, disc, fans, flagNum, flags, follow, folPct, form, fx, getFlag, happy, hasClub, hasFlag, money, morale, press, rel, rep, stress, t, chain, trust } from '../dsl'
import type { EventDef } from '../types'

export const rivalsEvents: EventDef[] = [
  {
    id: 'rivals.trash_talk',
    category: 'rivals',
    weight: 1,
    cooldownWeeks: 30,
    triggers: ['post_match', 'match_loss', 'match_win'],
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'nemesis'),
    title: t('Bir Düşman Doğuyor', 'A Nemesis Is Born'),
    text: t(
      '{rivalClub} formasıyla {rivalPlayer} maç sonu mikrofonları yakaladı: "{heroName} mi? Sosyal medyada iyi, sahada kayıp. Bir dahaki sefere cebimden çıkaramayacak."',
      '{rivalClub}\'s {rivalPlayer} grabbed the post-match microphones: "{heroName}? Great on social media, invisible on the pitch. Next time {g:he|she} won\'t even get out of my pocket."',
    ),
    icon: '😤',
    choices: [
      {
        label: t('Sert cevap ver', 'Fire back'),
        hint: t('Basın bayılır. Hoca o kadar değil.', 'The press will love it. The gaffer, less so.'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('"Cebinde sadece bahaneler var." Manşetler hazır, ateş yandı.', '"The only thing in {g:his|her} pocket is excuses." Headlines written, fire lit.'),
            press(6), rep(2), boss(-3), stress(4), folPct(ctx, 3),
            flags({ nemesis: String(ctx.vars.rivalPlayer) }),
            { addFlags: { nemesis_heat: 2 } },
            follow(chain('rivals.heat_rises', 3)),
          ),
      },
      {
        label: t('Gülümse, sahada cevap ver', 'Smile, answer on the pitch'),
        effects: (ctx) =>
          fx(
            t('"Saygı duyuyorum, sahada görüşürüz." Olgun ama {rivalPlayer} bunu zayıflık sandı.', '"Respect. See you on the pitch." Mature, but {rivalPlayer} took it as weakness.'),
            trust(3), morale(3), press(1),
            flags({ nemesis: String(ctx.vars.rivalPlayer) }),
            { addFlags: { nemesis_heat: 1 } },
            follow(chain('rivals.heat_rises', 4)),
          ),
      },
      {
        label: t('Tamamen görmezden gel', 'Ignore it entirely'),
        effects: () => fx(t('Sessizlik. Birkaç taraftar "neden bir şey demedi" diye söylendi.', 'Silence. A few fans grumbled you should have said something.'), fans(-2), stress(-2)),
      },
    ],
  },
  {
    id: 'rivals.heat_rises',
    category: 'rivals',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'nemesis'),
    title: t('Ateş Harlanıyor', 'The Feud Heats Up'),
    text: t(
      '{rivalPlayer} bir video paylaştı: senin kaçırdığın pozisyonu ağır çekimde, üzerine palyaço müziği. 2 milyon izlenme. Derbi yaklaşıyor.',
      '{rivalPlayer} posted a video: your missed chance in slow motion, set to circus music. Two million views. The derby is coming.',
    ),
    icon: '🔥',
    choices: [
      {
        label: t('Kendi videonla misilleme yap', 'Retaliate with your own edit'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('Onun ofsayt rekorlarını derledin, fon müziği: dramatik keman. İnternet ikiye bölündü.', 'You compiled {g:his|her} offside highlights, scored with tragic violins. The internet split in two.'),
            folPct(ctx, 6), rep(1), boss(-4), disc(-3),
            { addFlags: { nemesis_heat: 2 } },
            follow(chain('rivals.derby_showdown', 2)),
          ),
      },
      {
        label: t('Ekstra antrenmanla ateşi işe çevir', 'Channel it into extra training'),
        effects: () =>
          fx(
            t('Gece 10\'da sahadaydın. Analistler bile sana kahve getirdi.', 'You were on the pitch at 10pm. Even the analysts brought you coffee.'),
            form(5), trust(4), stress(3),
            { addFlags: { nemesis_heat: 1 } },
            follow(chain('rivals.derby_showdown', 2)),
          ),
      },
      {
        label: t('Ona özelden mesaj at: "Kahve?"', 'DM {g:him|her}: "Coffee?"'),
        hint: t('Ya barış ya da ekran görüntüsü.', 'Either peace or a screenshot.'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.45)
            ? fx(t('Şaşırtıcı biçimde kabul etti. Şakalaştınız, gerginlik dağıldı.', 'Surprisingly, {g:he|she} said yes. Jokes were made, tension gone.'), happy(5), stress(-5), flags({ nemesis: null, nemesis_heat: null }))
            : fx(t('Mesajının ekran görüntüsü 10 dakikada her yerdeydi: "Korkmuş."', 'Your DM was screenshotted and everywhere in ten minutes: "{g:He\'s|She\'s} scared."'), morale(-6), press(-3), { addFlags: { nemesis_heat: 1 } }, follow(chain('rivals.derby_showdown', 2))),
      },
    ],
  },
  {
    id: 'rivals.derby_showdown',
    category: 'rivals',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'nemesis'),
    vars: ({ state }) => ({ heat: flagNum(state, 'nemesis_heat') }),
    title: t('Tünelde Yüz Yüze', 'Face to Face in the Tunnel'),
    text: t(
      'Derbi öncesi tünel. {rivalPlayer} omzunu çarptı, kameralar kayıtta. Gerginlik seviyesi: {heat}. Bir kelime her şeyi değiştirebilir.',
      'The derby tunnel. {rivalPlayer} barges your shoulder, cameras rolling. Heat level: {heat}. One word could change everything.',
    ),
    icon: '⚔️',
    choices: [
      {
        label: t('Elini uzat', 'Offer a handshake'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Bir an tereddüt etti, sonra sıktı. Ertesi gün manşet: "{g:Centilmenler Derbisi|Fair Play Derbisi}".', '{g:He|She} hesitated, then shook it. Next day\'s headline: "{g:The Gentlemen\'s Derby|The Fair Play Derby}".'), rep(4), press(5), trust(3), flags({ nemesis: null, nemesis_heat: null }), { news: { headline: t('Tünelde centilmenlik!', 'Sportsmanship in the tunnel!'), sentiment: 1 } })
            : fx(t('Elini havada bıraktı. Ama tribünler seni alkışladı.', '{g:He|She} left you hanging. The stands applauded you anyway.'), fans(5), rep(2), morale(-2)),
      },
      {
        label: t('Kulağına bir şey fısılda', 'Whisper something in {g:his|her} ear'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Ne dediysen işe yaradı: 30. dakikada kırmızı kart gördü. Efsane oldun.', 'Whatever you said worked: {g:he|she} saw red on 30 minutes. Instant folklore.'), fans(10), rep(3), form(4), disc(-2), { addFlags: { nemesis_heat: 1 } })
            : fx(t('Kafa attı... sana değil, kameraya göre sana. İkiniz de kırmızı gördünüz.', 'Heads clashed. Both of you saw red, and the replays are not kind.'), ban(2), disc(-8), boss(-6), press(-4), { addFlags: { nemesis_heat: 2 } }),
      },
      {
        label: t('Görmezden gel, maçına odaklan', 'Ignore {g:him|her}, focus on the game'),
        effects: () => fx(t('Kulaklığını takıp geçtin. Hoca soyunma odasında sırtını sıvazladı.', 'Headphones on, you walked past. The gaffer patted your back in the dressing room.'), trust(5), form(3), stress(-3)),
      },
    ],
  },
  {
    id: 'rivals.diver',
    category: 'rivals',
    weight: 1,
    cooldownWeeks: 16,
    triggers: ['post_match', 'match_loss', 'match_draw'],
    conditions: ({ state }) => hasClub(state),
    title: t('Oscar Adayı', 'And the Oscar Goes To…'),
    text: t(
      '{rivalPlayer} sana dokunmadan yere yattı, üç tur döndü, hakem sana sarı gösterdi. Tekrarlar açık: temas yok.',
      '{rivalPlayer} went down without contact, rolled three times, and you got booked. Replays are clear: you never touched {g:him|her}.',
    ),
    icon: '🎭',
    choices: [
      {
        label: t('Röportajda bas bas bağır', 'Call it out loudly in the interview'),
        hint: t('Federasyon "hakem eleştirisi" sevmez.', 'The federation hates criticism of referees.'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Federasyon "hakeme saygısızlık" dedi ve ceza kesti.', 'The federation called it "disrespecting officials" and fined you.'), ban(1), press(3), fans(4))
            : fx(t('Herkes görüntüyü paylaştı. {rivalPlayer} şimdi "Dalgıç" lakabıyla anılıyor.', 'Everyone shared the clip. {rivalPlayer} is now known as "The Diver".'), fans(6), press(4), rep(1)),
      },
      {
        label: t('Kutlamada onun düşüşünü taklit et', 'Imitate {g:his|her} dive in your next celebration'),
        risk: 'medium',
        effects: (ctx) => fx(t('Gol sonrası üç tur takla attın. Stadyum yıkıldı, hoca yüzünü kapattı.', 'After scoring you did three rolls on the grass. The stadium roared; the gaffer covered his face.'), fans(8), folPct(ctx, 5), boss(-3), disc(-2)),
      },
      {
        label: t('"Futbol böyle" deyip geç', 'Shrug: "That\'s football"'),
        effects: () => fx(t('Olgun duruşun takdir topladı, içinden ise küfrediyordun.', 'Your maturity won praise. Inside, you were swearing.'), trust(3), stress(4), press(2)),
      },
    ],
  },
  {
    id: 'rivals.agent_badmouth',
    category: 'rivals',
    weight: 0.8,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 15,
    title: t('Dedikodu Makinesi', 'The Whisper Campaign'),
    text: t(
      'Rakibin {rivalPlayer} adına konuşan menajer bir podcast\'te senin için "sakatlığa yatkın, soyunma odası zehri" dedi. Belli ki kendi müşterisini senin yerine pazarlıyor.',
      '{rivalPlayer}\'s agent said on a podcast that you are "injury-prone and dressing-room poison". He is clearly selling his client as your replacement.',
    ),
    icon: '🐍',
    choices: [
      {
        label: t('Menajerin {agentName} karşılık versin', 'Let your agent {agentName} respond'),
        effects: () => fx(t('{agentName} istatistiklerle donanmış bir açıklama yayınladı. Sıkıcı ama etkili.', '{agentName} put out a statement armed with stats. Dull but effective.'), rep(2), press(2)),
      },
      {
        label: t('Avukat çağır', 'Call a lawyer'),
        hint: t('Pahalı ve uzun.', 'Expensive and slow.'),
        requires: (ctx) => ctx.state.life.money >= 5000,
        lockedHint: t('Avukat için en az 5.000 € lazım.', 'You need at least €5,000 for a lawyer.'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Menajer özür yayınladı. Mahkemeye gerek kalmadı.', 'The agent issued an apology. No court needed.'), money(-5000), rep(3), happy(5))
            : fx(t('Dava uzadı, gazeteler konuyu ısıtıp ısıtıp sundu.', 'The case dragged on and the papers kept reheating it.'), money(-5000), stress(8), press(-2)),
      },
      {
        label: t('Kulüp doktorundan sağlık raporu paylaş', 'Post your clean medical record'),
        effects: (ctx) => fx(t('Raporu paylaştın: "Zehir mi? Kan değerlerim mükemmel." İnternet güldü.', 'You posted it: "Poison? My bloodwork is immaculate." The internet laughed with you.'), folPct(ctx, 4), happy(3)),
      },
    ],
  },
  {
    id: 'rivals.charity_match',
    category: 'rivals',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && hasFlag(state, 'nemesis'),
    vars: ({ state }) => ({ nemesis: String(getFlag(state, 'nemesis') ?? '') }),
    title: t('Aynı Takımda!', 'On the Same Side!'),
    text: t(
      'Bir yardım maçında organizatörler seni ve ezeli rakibin {nemesis} adlı oyuncuyu aynı takıma koymuş. Kameralar ikinizin arasındaki her bakışı yakalamaya hazır.',
      'At a charity match, the organisers put you and {nemesis} on the same team. Cameras are ready for every glance between you.',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Ona asist yap', 'Set {g:him|her} up for a goal'),
        effects: () => fx(t('Mükemmel pas, o attı, sarıldınız. Fotoğraf yılın karesi seçildi.', 'Perfect pass, {g:he|she} scored, you hugged. Photo of the year.'), rep(4), press(5), happy(4), flags({ nemesis: null, nemesis_heat: null })),
      },
      {
        label: t('Topu ona hiç verme', 'Never pass to {g:him|her}'),
        effects: () => fx(t('90 dakika boyunca onu görmezden geldin. Seyirciler bunu fark edip gülüştü.', 'You ignored {g:him|her} for 90 minutes. The crowd noticed and giggled.'), press(-3), rep(-1), { addFlags: { nemesis_heat: 1 } }),
      },
      {
        label: t('Devre arası birlikte bağış toplayın', 'Team up to collect donations at half-time'),
        effects: () => fx(t('İkiniz tribün tribün dolaştınız. Rekor bağış, geçici ateşkes.', 'You toured the stands together. Record donations, temporary ceasefire.'), rep(3), fans(4), happy(3), { addFlags: { nemesis_heat: -1 } }),
      },
    ],
  },
  {
    id: 'rivals.copycat_celebration',
    category: 'rivals',
    weight: 0.9,
    cooldownWeeks: 24,
    triggers: ['post_match', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 10,
    title: t('Kutlama Hırsızı', 'Celebration Thief'),
    text: t(
      '{rivalPlayer} gol attı ve SENİN imza kutlamanı yaptı. Sonra kameraya göz kırptı.',
      '{rivalPlayer} scored and did YOUR signature celebration. Then winked at the camera.',
    ),
    icon: '🕺',
    choices: [
      {
        label: t('Yeni ve daha iyi bir kutlama tasarla', 'Invent a new, better celebration'),
        risk: 'low',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Yeni hareket tuttu: çocuklar okul bahçesinde yapıyor.', 'The new move caught on: kids are doing it in playgrounds.'), folPct(ctx, 5), fans(4), happy(4))
            : fx(t('Yeni hareket... garip kaçtı. Bir sunucu "kramp girmiş" dedi.', 'The new move... looked odd. A pundit asked if you had cramp.'), morale(-3), folPct(ctx, -1)),
      },
      {
        label: t('Telif hakkı esprisi yap', 'Joke about copyright'),
        effects: (ctx) => fx(t('"Faturayı yolluyorum." Espri tuttu, {rivalPlayer} bile beğendi.', '"Invoice is in the post." The joke landed; even {rivalPlayer} liked it.'), folPct(ctx, 3), press(3), stress(-2)),
      },
      {
        label: t('Sinirlen, sahada hesabını sor', 'Seethe; settle it on the pitch'),
        effects: () => fx(t('İçindeki ateş antrenmana yansıdı ama biraz da sertliğe.', 'The fire fed your training, and a bit of your tackling.'), form(4), disc(-2), stress(4), { addFlags: { nemesis_heat: 1 } }),
      },
    ],
  },
  {
    id: 'rivals.academy_old_friend',
    category: 'rivals',
    weight: 0.7,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state),
    title: t('Eski Dost, Yeni Rakip', 'Old Friend, New Rival'),
    text: t(
      'Altyapıdan oda arkadaşın şimdi {rivalClub} formasıyla senin mevkinde oynuyor. Maç öncesi mesaj attı: "Yarın bacaklarını ayırmazsan arkadaşlık biter, haberin olsun 😄"',
      'Your old academy roommate now plays your position at {rivalClub}. Pre-match text: "Keep your legs together tomorrow or our friendship is over 😄"',
    ),
    icon: '📱',
    choices: [
      {
        label: t('Bahse gir: kaybeden yemek ısmarlar', 'Bet: loser buys dinner'),
        risk: 'low',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Kazandın. Restoranın en pahalı şeyini sipariş ettin, ikiniz de güldünüz.', 'You won and ordered the priciest thing on the menu. Both of you laughed.'), happy(6), rel('bestFriend', 2))
            : fx(t('Kaybettin. Hesap tuzlu, ama gece güzeldi.', 'You lost. The bill stung, the night was lovely.'), money(-400), happy(4)),
      },
      {
        label: t('Maç bitene kadar konuşma', 'Radio silence until full-time'),
        effects: () => fx(t('Konsantrasyonun yerindeydi. Arkadaşın biraz alındı.', 'Your focus was sharp. Your friend was a bit miffed.'), form(3), happy(-2)),
      },
    ],
  },
]

