/** Manager: tactics, selection, discipline and the fragile thing called trust. */
import {
  attr, boss, canAfford, disc, energy, fatigue, flags, follow, form, fx, happy, hasClub, hasFlag, health, money, morale, press, rel, rep, sharp,
  stress, t, chain, trust, wageX, num, fans,
} from '../dsl'
import type { EventDef } from '../types'

export const managerEvents: EventDef[] = [
  {
    id: 'manager.tactics_dispute',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['match_loss', 'match_draw', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Tahtadaki Oklar', 'Arrows on the Whiteboard'),
    text: t(
      'Video analizinde {managerName} yine geri çekilip kontra atak oynamayı anlatıyor. Sen bu sistemde topa dokunmadan maç bitirdiğini düşünüyorsun. Söz hakkı sende.',
      '{managerName} is preaching the low block again in video analysis. You feel you finish games without touching the ball. He asks if anyone has thoughts.',
    ),
    icon: '📋',
    choices: [
      {
        label: t('Saygılı ama net: alternatif öner', 'Respectfully pitch an alternative'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.35 + ctx.state.hero.managerTrust / 200)
            ? fx(
                t('Bir süre sustu, sonra "Perşembe deneriz" dedi. Takım sana yeni gözle bakıyor.', 'A long pause, then: "We\'ll try it Thursday." The squad looks at you differently now.'),
                trust(5),
                rel('teammate', 3),
                attr('vision', 1),
                flags({ tactics_voice: true }),
              )
            : fx(
                t('"Teknik direktör kim, sen mi ben mi?" Oda buz kesti.', '"Who\'s the manager here, you or me?" The room went cold.'),
                trust(-7),
                boss(-8),
                stress(4),
                follow(chain('manager.tactics_dispute_aftermath', 1)),
              ),
      },
      {
        label: t('Sus, toplantı sonrası özel konuş', 'Keep quiet, speak privately later'),
        effects: () => fx(t('Kapısını çaldın. Dinledi, bir şey vaat etmedi ama saygı duydu.', 'You knocked on his door. He listened, promised nothing, respected it.'), trust(3), boss(3)),
      },
      {
        label: t('Sistemi tamamen benimse', 'Buy into the system completely'),
        effects: () =>
          fx(t('Daha çok savunma yaptın, ciğerlerin yandı. Hoca memnun.', 'More tracking back, burning lungs. The gaffer is pleased.'), trust(4), attr('workRate', 1), fatigue(6), morale(-3)),
      },
    ],
  },
  {
    id: 'manager.tactics_dispute_aftermath',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Hocanın Odası', "The Gaffer's Office"),
    text: t(
      '{managerName} seni odasına çağırdı. Masada kadro listesi duruyor, senin adının yanında bir soru işareti var.',
      '{managerName} calls you in. The team sheet is on his desk, and there\'s a question mark next to your name.',
    ),
    icon: '🚪',
    choices: [
      {
        label: t('Özür dile', 'Apologise'),
        effects: () => fx(t('"Tamam, kapattık." Soru işareti silindi; gururun biraz sızladı.', '"Fine, it\'s done." The question mark is erased; your pride stings a bit.'), trust(6), boss(8), morale(-3)),
      },
      {
        label: t('Fikrinin arkasında dur', 'Stand by your point'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Uzun bir sessizlik. "Karakterin var. Pazar oynuyorsun." Beklemediğin bir saygı.', 'Long silence. "You\'ve got character. You start Sunday." Respect you didn\'t expect.'), trust(5), boss(6), morale(6))
            : fx(t('Pazar günü tribündeydin. Kadroda bile yoktun.', 'Sunday you watched from the stands. Not even on the bench.'), trust(-8), boss(-6), morale(-8), sharp(-6)),
      },
      {
        label: t('Kaptanı arabulucu olarak getir', 'Bring the captain in to mediate'),
        effects: () =>
          fx(t('{mate} ortamı yumuşattı. Hoca da sen de yüzünüzü kurtardınız.', '{mate} smoothed things over. Everyone saved face.'), trust(3), boss(3), rel('teammate', 2)),
      },
    ],
  },
  {
    id: 'manager.out_of_position',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 26,
    triggers: ['weekly', 'injury'],
    conditions: ({ state }) => hasClub(state) && state.hero.position !== 'GK',
    title: t('Yabancı Mevki', 'Square Peg'),
    text: t(
      'Sakatlıklar kadroyu kırdı geçirdi. {managerName}: "Bu hafta seni farklı bir yerde deneyeceğim, sorun olur mu?" Tahtada adın alışık olmadığın bir bölgede yazıyor.',
      'Injuries have gutted the squad. {managerName}: "I\'m trying you somewhere new this week, alright?" Your name sits in an unfamiliar box on the whiteboard.',
    ),
    icon: '🔀',
    choices: [
      {
        label: t('"Takım için her yerde oynarım."', '"I\'ll play anywhere for the team."'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Şaşırtıcı derecede iyi oynadın. Hoca "çok yönlü" kelimesini kullandı.', 'You were surprisingly decent. The gaffer used the word "versatile".'), trust(8), attr('positioning', 1), morale(4))
            : fx(t('Doksan dakika boyunca kayboldun. Ama kimse çabanı sorgulamadı.', 'You were lost for ninety minutes. Nobody questioned the effort, though.'), trust(4), form(-6), morale(-4)),
      },
      {
        label: t('Kendi mevkinde oynamak istediğini söyle', 'Ask to stay in your own position'),
        effects: () => fx(t('"Anlaşıldı." Bu hafta yedeksin.', '"Understood." You\'re on the bench this week.'), trust(-5), sharp(-5), form(1)),
      },
      {
        label: t('Kabul et ama gece yeni rolü çalış', 'Accept, and study the role all night'),
        effects: () =>
          fx(t('Videolar, notlar, uykusuz bir gece. Sahaya hazırlıklı çıktın.', 'Clips, notes, a sleepless night. You walked out prepared.'), trust(6), energy(-12), attr('positioning', 1), stress(3)),
      },
    ],
  },
  {
    id: 'manager.curfew',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 30,
    triggers: ['nightlife', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Sokağa Çıkma Yasağı', 'Curfew'),
    text: t(
      'Takım otelinde saat 23:00 yasağı var. Saat 22:55 ve {mate} kapını çalıyor: "Aşağıda harika bir yer var, yarım saat, kimse anlamaz."',
      'Team hotel curfew is 11pm. It\'s 10:55 and {mate} knocks: "There\'s a great spot downstairs. Half an hour. No one will know."',
    ),
    icon: '🌙',
    choices: [
      {
        label: t('Gizlice çık', 'Sneak out'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('Harika bir gece, fark edilmeden döndünüz. Ertesi sabah biraz ağırdın.', 'Great night, back unseen. A little heavy-legged next morning.'), happy(7), rel('teammate', 3), fatigue(8), flags({ curfew_breaker: true }))
            : fx(
                t('Asansör açıldı: karşınızda {managerName}. Ceza ve uzun bir bakış.', 'The lift doors open: {managerName}. A fine and a very long stare.'),
                money(-1500),
                trust(-10),
                disc(-10),
                boss(-6),
                follow(chain('manager.curfew_fallout', 1)),
              ),
      },
      {
        label: t('Reddet ve uyu', 'Decline and sleep'),
        effects: () => fx(t('Sekiz saat uyku. Isınmada en canlı sendin.', 'Eight hours of sleep. Sharpest in the warm-up.'), fatigue(-6), sharp(3), rel('teammate', -2)),
      },
      {
        label: t('Odada oyun gecesi öner', 'Suggest a games night in your room'),
        effects: () => fx(t('Kural ihlali yok, kahkaha bol. Kimse kaybetmeyi sevmiyor ama.', 'No rules broken, lots of laughs. Nobody likes losing, though.'), rel('teammate', 4), happy(3), energy(-3)),
      },
    ],
  },
  {
    id: 'manager.curfew_fallout',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Basına Sızdı', 'It Leaked'),
    text: t(
      'Bir spor sitesi "Otel kaçamağı" haberi yaptı. {managerName} senden kamuoyu önünde ne söyleyeceğini soruyor.',
      'A sports site ran a "hotel escape" story. {managerName} wants to know what you will say publicly.',
    ),
    icon: '📰',
    choices: [
      {
        label: t('Sorumluluğu üstlen', 'Take full responsibility'),
        effects: () =>
          fx(t('Dürüst açıklaman takdir topladı. Hoca bir sonraki maçta seni oynattı.', 'Your honest statement went down well. The gaffer picked you next game.'), trust(5), press(4), rep(-1), disc(3)),
      },
      {
        label: t('Suçu {mate}\'ye at', 'Pin it on {mate}'),
        risk: 'high',
        effects: () =>
          fx(t('Basın inandı, soyunma odası inanmadı. Kimse sana pas vermek istemiyor.', 'The press bought it. The dressing room didn\'t. Nobody wants to pass to you.'), press(2), rel('teammate', -10), trust(-3)),
      },
      {
        label: t('"Yorum yok."', '"No comment."'),
        effects: () => fx(t('Hikâye üç gün sürdü, sonra unutuldu. Neredeyse.', 'The story ran three days, then faded. Almost.'), press(-4), rep(-2), stress(4)),
      },
    ],
  },
  {
    id: 'manager.fitness_demand',
    category: 'manager',
    weight: (ctx) => (ctx.state.hero.attrs.stamina < 60 ? 1.4 : 0.7),
    cooldownWeeks: 26,
    triggers: ['training', 'new_season', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ amount: wageX(state, 1, 800) }),
    title: t('Yağ Oranı Konuşması', 'The Body-Fat Talk'),
    text: t(
      'Fitness testleri çıktı. {managerName} kağıdı masaya bıraktı: "Yağ oranın yüksek. İki hafta içinde düşmezse kadroya almam." Kulüp diyetisyeni haftalık {amount:money} istiyor; kendi başına da yapabilirsin.',
      'Fitness results are in. {managerName} drops the sheet: "Body fat\'s too high. Not down in two weeks, you\'re not in the squad." The club nutritionist charges {amount:money} a week, or you can go it alone.',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Özel diyetisyen tut', 'Hire the nutritionist'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bütçen yetmiyor.', 'Out of your budget.'),
        effects: (ctx) =>
          fx(t('Haşlanmış tavuk ve brokoli. Ama sonuçlar ortada.', 'Boiled chicken and broccoli. But the numbers speak.'), money(-num(ctx, 'amount')), health(6), attr('stamina', 1), trust(5), happy(-3)),
      },
      {
        label: t('Kendi başına aç kalarak düşür', 'Starve it off yourself'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Hedefe ulaştın. Bir hafta boyunca herkese sinirliydin.', 'You hit the target. You were grumpy with everyone for a week.'), trust(4), health(-2), stress(5))
            : fx(t('Antrenmanda başın döndü, sağlık ekibi seni kenara aldı.', 'You got dizzy in training and the medics pulled you out.'), health(-8), trust(-2), energy(-10)),
      },
      {
        label: t('"Testler yanlış ölçmüş." de', '"The test must be wrong."'),
        effects: () => fx(t('Hoca güldü ama gülmedi. Kadro listesine bakmaya gerek yok.', 'The gaffer laughed without smiling. Don\'t bother checking the team sheet.'), trust(-8), boss(-5), sharp(-4)),
      },
    ],
  },
  {
    id: 'manager.dropped',
    category: 'manager',
    weight: 1.2,
    cooldownWeeks: 16,
    triggers: ['benched'],
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'dropped_arc'),
    title: t('Kulübe', 'The Bench'),
    text: t(
      'Kadro açıklandı ve ilk on birde yoksun. {managerName} gözlerini kaçırdı. Bankta oturan {mate2} sana bakıp omuz silkti.',
      'The team sheet is up and you\'re not in the XI. {managerName} avoids your eyes. On the bench, {mate2} gives you a shrug.',
    ),
    icon: '🪑',
    choices: [
      {
        label: t('Kapısını çal ve nedenini sor', 'Knock on his door and ask why'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(
                t('"Pres yapmıyorsun." Net bir hedefin var artık.', '"You don\'t press." Now you have a clear target.'),
                trust(3),
                morale(2),
                flags({ dropped_arc: true }),
                follow(chain('manager.dropped_second_chance', 2)),
              )
            : fx(t('"Kadro benim kararım." Kapı kapandı.', '"Selection is my call." The door closed.'), trust(-2), morale(-5), stress(4)),
      },
      {
        label: t('Antrenmanda herkesten çok çalış', 'Outwork everyone in training'),
        effects: () =>
          fx(
            t('Sabah ilk gelen, akşam son çıkan sendin.', 'First in, last out, every day.'),
            attr('workRate', 1),
            fatigue(8),
            trust(4),
            flags({ dropped_arc: true }),
            follow(chain('manager.dropped_second_chance', 2)),
          ),
      },
      {
        label: t('Menajerini arat, "kulübe huzursuz" haberi yaptır', 'Get your agent to leak "unsettled" stories'),
        risk: 'high',
        effects: () =>
          fx(
            t('Haber çıktı, transfer söylentileri başladı. Hoca okudu.', 'The story ran and transfer rumours began. The gaffer read it.'),
            rep(2),
            trust(-10),
            boss(-10),
            fans(-4),
            flags({ wants_out: true }),
          ),
      },
    ],
  },
  {
    id: 'manager.dropped_second_chance',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Son 20 Dakika', 'The Last Twenty Minutes'),
    text: t(
      '0-0, 70. dakika. {managerName} parmağıyla seni gösteriyor: "Isın. Bu senin şansın." Kenar çizgisinde ne yapacağını düşünüyorsun.',
      '0-0, seventy minutes gone. {managerName} points at you: "Warm up. This is your chance." On the touchline, you consider your approach.',
    ),
    icon: '⏱️',
    choices: [
      {
        label: t('Talimatlara harfiyen uy, pres yap', 'Follow orders to the letter, press'),
        effects: () =>
          fx(t('Bir top kaptın, bir korner kazandırdın. Gol yok ama hoca baş parmağını kaldırdı.', 'Won a ball, earned a corner. No goal, but a thumbs-up from the gaffer.'), trust(8), morale(4), flags({ dropped_arc: null })),
      },
      {
        label: t('Kahraman ol: her topta kaleyi dene', 'Be the hero: shoot on sight'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.25 + ctx.state.hero.attrs.finishing / 400)
            ? fx(
                t('89. dakika, uzaklardan... GOL! Tribünler adını haykırıyor.', '89th minute, from distance... GOAL! The stands are chanting your name.'),
                trust(10),
                fans(8),
                rep(3),
                morale(12),
                flags({ dropped_arc: null }),
              )
            : fx(t('Dört şut, dördü de tribüne. Hoca başını iki eli arasına aldı.', 'Four shots, four into the crowd. The gaffer held his head in both hands.'), trust(-6), morale(-6), flags({ dropped_arc: null })),
      },
    ],
  },
  {
    id: 'manager.public_praise',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['match_win', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.managerTrust >= 40,
    title: t('Hocadan Övgü', 'Praise From the Boss'),
    text: t(
      'Basın toplantısında {managerName} seni övdü: "{heroName} bu kulübün geleceği." Sabah gazeteleri bunu manşete taşıdı. Soyunma odasında bazıları alaycı alkış tuttu.',
      'In the presser {managerName} gushed: "{heroName} is this club\'s future." The morning papers ran it big. Some in the dressing room gave a sarcastic slow clap.',
    ),
    icon: '👏',
    choices: [
      {
        label: t('Takıma pasta ısmarla', 'Buy cake for the whole squad'),
        requires: (ctx) => canAfford(ctx.state, 200),
        lockedHint: t('Pastaya bile paran yok.', 'Can\'t even afford cake.'),
        effects: () => fx(t('Alay kesildi, ağızlar doldu. Klasik.', 'The sarcasm stopped; mouths were full. A classic.'), money(-200), rel('teammate', 5), happy(3)),
      },
      {
        label: t('Övgüyü takım arkadaşlarına mal et', 'Deflect credit to the team'),
        effects: () => fx(t('"Ben onlar sayesinde varım." Hem basın hem takım beğendi.', '"I\'m only as good as them." Press and squad both liked it.'), rel('teammate', 3), press(3), morale(3)),
      },
      {
        label: t('Tadını çıkar, sosyal medyada paylaş', 'Bask in it and post the headline'),
        effects: () => fx(t('Paylaşım uçtu. Soyunma odasındaki alkış biraz daha alaycılaştı.', 'The post flew. The dressing-room clapping got slower.'), rep(2), morale(6), rel('teammate', -4)),
      },
    ],
  },
  {
    id: 'manager.rest_or_play',
    category: 'manager',
    weight: (ctx) => (ctx.state.hero.fatigue > 55 ? 2 : 0.5),
    cooldownWeeks: 12,
    triggers: ['post_match', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Rotasyon Sorusu', 'The Rotation Question'),
    text: t(
      '{managerName}: "Üç günde iki maç var. Bacakların ağır görünüyor. Kupa maçında dinlenmek ister misin?" Kupa maçı rakibi {rivalClub}.',
      '{managerName}: "Two games in three days. Your legs look heavy. Want to sit out the cup tie?" The opponents are {rivalClub}.',
    ),
    icon: '🔋',
    choices: [
      {
        label: t('Dinlen', 'Rest'),
        effects: () => fx(t('Kanepe, buz banyosu, uyku. Bacakların geri geldi.', 'Sofa, ice bath, sleep. Your legs came back.'), fatigue(-15), energy(10), sharp(-3)),
      },
      {
        label: t('"Ben her maç oynarım."', '"I play every game."'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('Ağır bacaklarla ama savaştın. Hoca karakterini sevdi.', 'Heavy legs, but you battled. The gaffer liked the character.'), trust(4), fatigue(10), sharp(3))
            : fx(t('Arka adalede bir çekme. Fazla zorladın.', 'A tweak in the hamstring. You pushed too hard.'), fatigue(10), health(-6), stress(4)),
      },
      {
        label: t('Yedekte başlamayı öner', 'Offer to start on the bench'),
        effects: () => fx(t('Akıllıca orta yol. 30 dakika oynadın.', 'A sensible middle ground. You got thirty minutes.'), fatigue(-4), sharp(2), trust(2)),
      },
    ],
  },
]
