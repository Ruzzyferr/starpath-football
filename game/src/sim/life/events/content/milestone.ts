/**
 * Career milestones. Mostly `once` events keyed off hero stats.
 * Integration: `milestone.hat_trick` reads `life.flags.last_match_goals`
 * (hero goals in the last match), which the match/career layer should set.
 */
import { age, attr, boss, canAfford, disc, fans, flagNum, flags, folPct, fx, happy, hasClub, money, morale, num, press, rel, rep, stress, t, trust, wageX } from '../dsl'
import type { EventDef } from '../types'

export const milestoneEvents: EventDef[] = [
  {
    id: 'milestone.first_goal',
    category: 'milestone',
    weight: 5,
    cooldownWeeks: 0,
    once: true,
    triggers: ['scored', 'post_match'],
    conditions: ({ state }) => hasClub(state) && state.hero.careerStats.goals >= 1 && state.hero.careerStats.goals <= 3,
    title: t('İlk Profesyonel Gol!', 'First Professional Goal!'),
    text: t(
      'Top ağlarda, sen dizlerinin üstünde kaydın. Malzemeci topu sana uzattı: "Bunu sakla evlat." Telefon titriyor: {motherName} arıyor.',
      'Ball in the net, you knee-slid halfway to the corner flag. The kit man hands you the ball: "Keep this, son." Phone buzzing: {motherName} calling.',
    ),
    icon: '⚽',
    choices: [
      {
        label: t('Topu annene hediye et', 'Give the ball to your mum'),
        effects: () => fx(t('{motherName} topu vitrine koydu, misafirlere 40 kez gösterdi.', '{motherName} put it in the display cabinet and has shown it to 40 visitors.'), rel('mother', 12), happy(8)),
      },
      {
        label: t('Takım arkadaşlarına imzalat', 'Have the squad sign it'),
        effects: () => fx(t('Herkes imzaladı, biri "gelecekte değeri olur" diye tarihi de yazdı.', 'Everyone signed; someone added the date "for when it\'s worth something".'), rel('teammate', 4), happy(6)),
      },
      {
        label: t('Kutlamayı sosyal medyada paylaş', 'Post the celebration online'),
        effects: (ctx) => fx(t('Diz kaydırma videosu bir gecede yayıldı.', 'The knee-slide clip went round overnight.'), folPct(ctx, 15), rep(2), happy(5)),
      },
    ],
  },
  {
    id: 'milestone.hat_trick',
    category: 'milestone',
    weight: 5,
    cooldownWeeks: 0,
    once: true,
    triggers: ['scored'],
    conditions: ({ state }) => hasClub(state) && flagNum(state, 'last_match_goals') >= 3,
    title: t('Hat-trick!', 'Hat-trick!'),
    text: t(
      'Üç gol! Maç topu senin. Hakem uzattı, tribünler adını bağırıyor. Soyunma odasında herkes topu imzalamak için sıraya girdi.',
      'Three goals! The match ball is yours. The ref hands it over while the stands scream your name. The dressing room queues to sign it.',
    ),
    icon: '🎩',
    choices: [
      {
        label: t('Topu bir yardım müzayedesine bağışla', 'Donate the ball to a charity auction'),
        effects: () => fx(t('Müzayedede rekor fiyata gitti. Ünün ve vicdanın büyüdü.', 'It fetched a record price. Your fame and conscience both grew.'), rep(4), fans(6), happy(5)),
      },
      {
        label: t('Asist yapan arkadaşlara akşam yemeği ısmarla', 'Buy dinner for whoever assisted'),
        requires: (ctx) => canAfford(ctx.state, 1500),
        lockedHint: t('1.500 € lazım.', 'You need €1,500.'),
        effects: () => fx(t('Kebap, tatlı, kahkaha. {mate} bundan sonra sana daha çok pas atacağına yemin etti.', 'Kebabs, dessert, laughter. {mate} swore to pass to you even more.'), money(-1500), rel('teammate', 8), happy(4)),
      },
      {
        label: t('Mütevazı ol: "Takımın başarısı."', 'Stay humble: "A team effort."'),
        effects: () => fx(t('Hoca bu cevaba bayıldı. Basın biraz sıkıldı.', 'The gaffer loved that answer. The press yawned.'), trust(6), press(-1), morale(6)),
      },
    ],
  },
  {
    id: 'milestone.hundredth_game',
    category: 'milestone',
    weight: 5,
    cooldownWeeks: 0,
    once: true,
    triggers: ['post_match', 'weekly'],
    conditions: ({ state }) => hasClub(state) && state.hero.careerStats.apps >= 100,
    title: t('100. Maç', 'Game Number 100'),
    text: t(
      'Kulüp, 100. profesyonel maçın için özel bir forma hazırladı: sırtında "100". Maç öncesi seni sahaya ailenle çıkarmak istiyorlar.',
      'The club printed a special shirt for your 100th professional game: "100" on the back. They want you to walk out with your family.',
    ),
    icon: '💯',
    choices: [
      {
        label: t('Aileni sahaya çıkar', 'Walk out with your family'),
        effects: () => fx(t('{fatherName} gözyaşlarını gizlemeye çalıştı, başaramadı.', '{fatherName} tried to hide the tears. He failed.'), rel('father', 10), rel('mother', 8), happy(8)),
      },
      {
        label: t('Formayı açık artırmaya koy', 'Auction the shirt'),
        effects: (ctx) => fx(t('Gelir altyapıya gitti. Tesisin bir köşesine adın yazıldı.', 'Proceeds went to the academy. A corner of the facility now bears your name.'), rep(3), fans(5), folPct(ctx, 2)),
      },
      {
        label: t('Sade geç, maça odaklan', 'Keep it low-key, focus on the game'),
        effects: () => fx(t('Seremoniyi kısa tuttun. Hoca bunu profesyonellik olarak gördü.', 'You kept the ceremony short. The gaffer read it as professionalism.'), trust(4), morale(4)),
      },
    ],
  },
  {
    id: 'milestone.fifty_goals',
    category: 'milestone',
    weight: 5,
    cooldownWeeks: 0,
    once: true,
    triggers: ['scored', 'post_match'],
    conditions: ({ state }) => hasClub(state) && state.hero.careerStats.goals >= 50,
    vars: ({ state }) => ({ bonus: wageX(state, 2, 2000) }),
    title: t('50 Gol Kulübü', 'The 50-Goal Club'),
    text: t(
      'Kariyerinin 50. golü! Ayakkabı sponsorun altın kaplı krampon ve {bonus:money} prim teklif ediyor — tek şart, onları bir sonraki maçta giymen.',
      'Career goal number 50! Your boot sponsor offers gold-plated boots and a {bonus:money} bonus — on condition you wear them next match.',
    ),
    icon: '🥇',
    choices: [
      {
        label: t('Altın kramponları giy', 'Wear the golden boots'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Parladın. Kelimenin tam anlamıyla.', 'You shone. Literally.'), money(num(ctx, 'bonus')), folPct(ctx, 5), rep(2))
            : fx(t('Ayağını sıktı, iki net pozisyon kaçtı. Tribün "çıkar onları!" diye bağırdı.', 'They pinched, you missed two sitters, and the crowd chanted "take them off!".'), money(num(ctx, 'bonus')), morale(-4), fans(-3)),
      },
      {
        label: t('Kibarca reddet, eski kramponlarına sadık kal', 'Decline; stay loyal to your old boots'),
        effects: () => fx(t('Uğurlu kramponlarla devam. Sponsor biraz bozuldu.', 'Lucky old boots it is. The sponsor was a bit put out.'), morale(5), happy(2)),
      },
    ],
  },
  {
    id: 'milestone.birthday',
    category: 'milestone',
    weight: 1,
    cooldownWeeks: 40,
    conditions: ({ state }) => state.life.flags['birthday_season'] !== state.calendar.season,
    vars: ({ state }) => ({ newAge: age(state) }),
    title: t('İyi ki Doğdun!', 'Happy Birthday!'),
    text: t(
      'Bugün {newAge} yaşındasın. Takım arkadaşların soyunma odasını balonlarla doldurmuş, {mate} pastanın üstüne hoca karikatürü yaptırmış.',
      'You turn {newAge} today. Your teammates filled the dressing room with balloons, and {mate} had the gaffer\'s caricature iced onto the cake.',
    ),
    icon: '🎂',
    choices: [
      {
        label: t('Pastayı hocaya ilk dilim olarak ver', 'Give the gaffer the first slice'),
        effects: (ctx) => fx(t('{managerName} karikatürüne baktı... ve güldü. Bir efsane doğdu.', '{managerName} looked at his caricature... and laughed. A legend was born.'), boss(5), rel('teammate', 3), happy(5), flags({ birthday_season: ctx.state.calendar.season })),
      },
      {
        label: t('Akşam büyük parti ver', 'Throw a big party tonight'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, 3000),
        lockedHint: t('Parti için 3.000 € lazım.', 'A party costs €3,000.'),
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Muhteşem bir geceydi ve kimse sabaha karşı kameraya yakalanmadı.', 'A cracking night, and nobody was snapped at 4am.'), money(-3000), happy(10), rel('teammate', 5), flags({ birthday_season: ctx.state.calendar.season }))
            : fx(t('Parti güzeldi ama bir fotoğraf sızdı: sen, masada, kravatın kafanda.', 'Great party, but a photo leaked: you, on a table, tie round your head.'), money(-3000), happy(6), disc(-4), flags({ birthday_season: ctx.state.calendar.season })),
      },
      {
        label: t('Ailenle sessiz bir akşam', 'Quiet evening with family'),
        effects: (ctx) => fx(t('Annenin dolması, babanın eski hikâyeleri. Mükemmel.', 'Mum\'s cooking, Dad\'s old stories. Perfect.'), rel('mother', 6), rel('father', 6), stress(-6), flags({ birthday_season: ctx.state.calendar.season })),
      },
    ],
  },
  {
    id: 'milestone.first_captaincy',
    category: 'milestone',
    weight: 5,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.contract?.role === 'captain',
    title: t('Kol Bandı Senin', 'The Armband Is Yours'),
    text: t(
      '{managerName} kaptanlık bandını eline tutuşturdu: "Bu soyunma odası artık senin sesinle konuşacak." Ağır bir kumaş parçası, beklediğinden ağır.',
      '{managerName} pressed the armband into your hand: "This dressing room speaks with your voice now." A strip of fabric, heavier than you expected.',
    ),
    icon: '©️',
    choices: [
      {
        label: t('Takıma bir konuşma yap', 'Give the squad a speech'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('Kısa, net, yürekten. Veteranlar bile başını salladı.', 'Short, sharp, from the heart. Even the veterans nodded.'), rel('teammate', 6), attr('leadership', 2), morale(6))
            : fx(t('Konuşmanın ortasında kelimeler karıştı. {mate} sessizce alkışladı, gerisi kıkırdadı.', 'You lost your words halfway. {mate} clapped politely; the rest sniggered.'), rel('teammate', 1), attr('leadership', 1), morale(-3)),
      },
      {
        label: t('Örnek ol, konuşma', 'Lead by example, say nothing'),
        effects: () => fx(t('İlk gelen, son çıkan sen oldun. Herkes fark etti.', 'First in, last out. Everybody noticed.'), trust(5), attr('workRate', 1), attr('leadership', 1)),
      },
      {
        label: t('Eski kaptanı yemeğe davet et', 'Take the old captain to dinner'),
        effects: () => fx(t('Tavsiyeleri altın değerindeydi, kırgınlık da bitti.', 'His advice was gold, and the hurt feelings faded.'), rel('teammate', 4), attr('leadership', 1), happy(3)),
      },
    ],
  },
  {
    id: 'milestone.club_veteran',
    category: 'milestone',
    weight: 4,
    cooldownWeeks: 0,
    once: true,
    triggers: ['new_season', 'weekly'],
    conditions: ({ state }) => hasClub(state) && state.hero.history.filter((h) => h.clubId === state.hero.contract?.clubId).length >= 5,
    title: t('Kulübün Emektarı', 'Club Stalwart'),
    text: t(
      '{clubName} ile beşinci sezonunu geride bıraktın. Kulüp müzesi senin için bir köşe ayırmak istiyor; taraftar grubu da sana özel bir marş besteledi.',
      'Five seasons at {clubName}. The club museum wants to give you a corner, and the supporters have written you your own song.',
    ),
    icon: '🏟️',
    choices: [
      {
        label: t('Marşı tribünde onlarla söyle', 'Sing the song with them in the stands'),
        effects: (ctx) => fx(t('Sesin berbattı. Kimsenin umurunda olmadı.', 'Your voice was awful. Nobody cared.'), fans(15), folPct(ctx, 4), happy(8)),
      },
      {
        label: t('Müzeye ilk kramponlarını bağışla', 'Donate your first boots to the museum'),
        effects: () => fx(t('Çocuklar vitrinin önünde fotoğraf çekiyor. Başkan çok duygulandı.', 'Kids pose by the display case. The chairman got emotional.'), rel('chairman', 8), rep(2), happy(4)),
      },
      {
        label: t('Uzun sözleşme imzalamaya hazır olduğunu söyle', 'Say you would sign a long contract'),
        effects: () => fx(t('Başkan avukatları çağırdı bile.', 'The chairman has already called the lawyers.'), rel('chairman', 10), fans(6), stress(-3)),
      },
    ],
  },
]

