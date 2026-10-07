/** Awards: galas, speeches, votes and the green-eyed monster. */
import { canAfford, disc, fans, flags, folPct, follow, form, fx, happy, hasClub, money, morale, news, num, press, rel, relNpc, rep, stress, t, chain, trust, wageX, attr } from '../dsl'
import type { EventDef } from '../types'

export const awardsEvents: EventDef[] = [
  {
    id: 'awards.gala_outfit',
    category: 'awards',
    weight: 1.5,
    cooldownWeeks: 40,
    triggers: ['season_end'],
    conditions: ({ state }) => state.hero.reputation >= 35,
    vars: ({ state }) => ({ amount: wageX(state, 1.5, 2000) }),
    title: t('Ödül Gecesi Kıyafeti', 'Awards Night Outfit'),
    text: t(
      '{leagueName} ödül gecesine davetlisin, adaylar arasındasın. Stilist {amount:money} değerinde kadife bir takım öneriyor. Dolapta ise mezuniyet takımın duruyor.',
      'You are invited to the {leagueName} awards night, and you are nominated. A stylist suggests a velvet suit worth {amount:money}. In your wardrobe hangs your graduation suit.',
    ),
    icon: '🤵',
    choices: [
      {
        label: t('Kadife takım, tam gaz', 'Velvet suit, full send'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Kadife pahalı.', 'Velvet is expensive.'),
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Kırmızı halıda flaşlar patladı. "Gecenin en şıkı" listesinde birincisin.', 'Flashbulbs on the red carpet. You top the "best dressed" list.'), money(-num(ctx, 'amount')), folPct(ctx, 8), rep(3), happy(5), follow(chain('awards.acceptance_speech', 0)))
            : fx(t('Bir moda yazarı seni "kadife kanepe" diye tanımladı. Yine de herkes konuşuyor.', 'A fashion writer called you "a velvet sofa". Still, everyone is talking.'), money(-num(ctx, 'amount')), folPct(ctx, 5), happy(-2), follow(chain('awards.acceptance_speech', 0))),
      },
      {
        label: t('Mezuniyet takımı, nostalji', 'Graduation suit, for nostalgia'),
        effects: () => fx(t('Biraz dar, ama hikâyesi güzel. Annen gururlu.', 'A bit snug, but it has a story. Your mum is proud.'), rel('mother', 5), happy(2), follow(chain('awards.acceptance_speech', 0))),
      },
      {
        label: t('Kulüp eşofmanıyla git', 'Go in the club tracksuit'),
        risk: 'medium',
        effects: () => fx(t('Taraftar bayıldı, organizatörler bayılmadı.', 'Fans loved it. The organisers did not.'), fans(6), press(-3), follow(chain('awards.acceptance_speech', 0))),
      },
    ],
  },
  {
    id: 'awards.acceptance_speech',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Ve Kazanan...', 'And the Winner Is...'),
    text: t(
      'Zarf açıldı: adın okundu! Kürsüye yürürken aklında kâğıda yazdığın konuşma yok. Mikrofon önünde, bin kişi bakıyor.',
      'The envelope opens: it\'s you! Walking to the podium, the speech you wrote has vanished from your head. A thousand faces stare at you.',
    ),
    icon: '🏆',
    choices: [
      {
        label: t('Herkese tek tek teşekkür et', 'Thank everyone, one by one'),
        effects: () => fx(t('Malzemeciden aşçıya herkesi saydın. Konuşma uzun sürdü ama soyunma odası seni bağrına bastı.', 'From kit man to chef, you named them all. Long speech, but the dressing room adores you for it.'), rel('teammate', 5), trust(3), rep(3), flags({ award_won: true })),
      },
      {
        label: t('Kısa ve esprili', 'Short and witty'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('"Bu ödülü penaltıyı kaçırdığım maçlara adıyorum, onlar olmasa çalışmazdım." Salon güldü.', '"I dedicate this to every penalty I missed. Without them I\'d never have practised." The room roared.'), rep(5), press(5), happy(5), flags({ award_won: true }))
            : fx(t('Espri havada asılı kaldı. Biri öksürdü. Bir başkası alkışladı, yalnız.', 'The joke hung in the air. Someone coughed. One person clapped, alone.'), rep(2), stress(4), flags({ award_won: true })),
      },
      {
        label: t('Duygusallaş, ailene ithaf et', 'Get emotional, dedicate it to family'),
        effects: () => fx(t('Sesin titredi. Kamera ön sıradaki ağlayan anneni gösterdi; ülke de ağladı.', 'Your voice wobbled. The camera found your mum crying in the front row; the nation cried too.'), rel('mother', 8), rel('father', 6), rep(4), happy(6), flags({ award_won: true }),
          news(t('{heroName} ödülünü ailesine adadı', '{heroName} dedicates award to family'), 1)),
      },
    ],
  },
  {
    id: 'awards.player_of_month',
    category: 'awards',
    weight: (ctx) => (ctx.state.hero.form >= 70 ? 2 : 1),
    cooldownWeeks: 10,
    triggers: ['match_win', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.form >= 62,
    title: t('Ayın Oyuncusu', 'Player of the Month'),
    text: t(
      '{leagueName} ayın oyuncusu ödülü senin! Ödülü stadyumda, {stadium} önünde maç öncesi alacaksın. Bir sponsor da plaketle birlikte poz isterken logosunu öne koymak istiyor.',
      'You are the {leagueName} Player of the Month! You will receive it pitch-side at {stadium} before kick-off. A sponsor also wants their logo front and centre in the photo.',
    ),
    icon: '🥇',
    choices: [
      {
        label: t('Takım arkadaşlarını fotoğrafa çağır', 'Bring your teammates into the photo'),
        effects: () => fx(t('On bir kişilik bir ödül fotoğrafı. Soyunma odasında prim hanen arttı.', 'An eleven-man award photo. Your stock in the dressing room rose.'), rel('teammate', 6), rep(2), morale(5)),
      },
      {
        label: t('Sponsorla poz ver', 'Pose with the sponsor'),
        effects: (ctx) => fx(t('Sponsor memnun, banka hesabın da.', 'The sponsor is happy, and so is your bank account.'), money(wageX(ctx.state, 0.5, 500)), rep(2), fans(-2)),
      },
      {
        label: t('Plaketi tribündeki küçük bir taraftara ver', 'Give the plaque to a young fan in the stands'),
        effects: (ctx) => fx(t('Çocuğun yüzündeki ifade internetin en çok izlenen videosu oldu.', 'The look on the kid\'s face became the most watched clip online.'), fans(10), folPct(ctx, 10), rep(3), happy(6)),
      },
    ],
  },
  {
    id: 'awards.rival_wins',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 40,
    triggers: ['season_end'],
    conditions: ({ state }) => state.hero.reputation >= 30,
    title: t('Ödül Ona Gitti', 'The Award Went to Him'),
    text: t(
      'Sezonun oyuncusu ödülü {rivalClub} forması giyen {rivalPlayer}\'a gitti. Senin rakamların daha iyiydi, herkes biliyor. Kamera yüzüne kilitlendi.',
      'Player of the Season goes to {rivalPlayer} of {rivalClub}. Your numbers were better and everyone knows it. The camera is locked on your face.',
    ),
    icon: '😬',
    choices: [
      {
        label: t('Ayağa kalk, centilmence alkışla', 'Stand and applaud like a gentleman'),
        effects: () => fx(t('Fair-play anın gecenin en çok paylaşılan görüntüsü oldu.', 'Your sporting moment became the most shared clip of the night.'), rep(3), press(4), disc(3), happy(-3)),
      },
      {
        label: t('Göz devirmeyi tutamadın', 'Roll your eyes (you couldn\'t help it)'),
        risk: 'medium',
        effects: (ctx) => fx(t('Göz devirme anı caps oldu: "Kıskanç mı?" Taraftarın ise seni haklı buluyor.', 'The eye-roll became a meme: "Jealous much?" Your own fans think you\'re right.'), folPct(ctx, 5), press(-5), fans(4), stress(4), flags({ nemesis_award: true })),
      },
      {
        label: t('Gece boyu antrenman planı yap', 'Spend the night planning next season'),
        effects: () => fx(t('Hırs iyi bir yakıt. Sabaha karşı ek antrenman programın hazırdı.', 'Ambition is good fuel. By dawn your extra training plan was ready.'), attr('workRate', 1), stress(5), form(2)),
      },
    ],
  },
  {
    id: 'awards.goal_vote_campaign',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 26,
    triggers: ['scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.position !== 'GK',
    title: t('Yılın Golü Adaylığı', 'Goal of the Season Nominee'),
    text: t(
      'Son golün "Yılın Golü" adayları arasında. Oylama halka açık. Sosyal medya ekibin ve {friendName} kampanya için heyecanlı.',
      'Your last goal is nominated for Goal of the Season. The vote is public. Your social team and {friendName} are itching to campaign.',
    ),
    icon: '🗳️',
    choices: [
      {
        label: t('Oy kampanyası başlat', 'Launch a vote campaign'),
        effects: (ctx) => fx(t('"#OyunuVer" etiketi gündemde. Sonuç iki hafta sonra.', '"#VoteForIt" is trending. Results in two weeks.'), folPct(ctx, 6), flags({ goal_campaign: true }), follow(chain('awards.goal_vote_result', 2))),
      },
      {
        label: t('Gol kendini anlatır', 'The goal speaks for itself'),
        effects: () => fx(t('Mütevazı tavrın basında beğenildi. Sonuç iki hafta sonra.', 'Your modesty went down well with the press. Results in two weeks.'), press(3), flags({ goal_campaign: false }), follow(chain('awards.goal_vote_result', 2))),
      },
      {
        label: t('Asisti yapan {mate} için oy iste', 'Ask fans to credit {mate}\'s assist instead'),
        effects: (ctx) => fx(t('{mate} duygulandı: "Ömrümde ilk kez biri benim pasımı konuştu."', '{mate} was moved: "First time anyone ever talked about my pass."'), relNpc(ctx.vars.mateId, ctx.vars.mate, 15), rel('teammate', 2), happy(3)),
      },
    ],
  },
  {
    id: 'awards.goal_vote_result',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Oylama Sonuçlandı', 'The Votes Are In'),
    text: t(
      'Yılın Golü sonucu açıklanmak üzere. Bir gazeteci, rakip adayın taraftarlarının "bot oyu" iddiasıyla ortalığı karıştırdığını söylüyor.',
      'Goal of the Season is about to be announced. A journalist says the rival nominee\'s fans are crying "bot votes".',
    ),
    icon: '📊',
    choices: [
      {
        label: t('Sonucu sakin bekle', 'Wait calmly for the result'),
        effects: (ctx, rng) =>
          rng.chance(ctx.state.life.flags['goal_campaign'] === true ? 0.65 : 0.45)
            ? fx(t('Kazandın! Gol, sezon özetlerinin açılış sahnesi oldu.', 'You won! The goal opens every season highlight reel.'), rep(4), happy(8), fans(5), flags({ goal_campaign: null }),
                news(t('Yılın Golü {heroName}\'ın', '{heroName} wins Goal of the Season'), 1))
            : fx(t('Az farkla ikinci oldun. Yine de golü izleyen herkes biliyor.', 'Second by a whisker. Everyone who saw it still knows.'), happy(-3), rep(1), flags({ goal_campaign: null })),
      },
      {
        label: t('Bot iddialarına cevap ver', 'Respond to the bot accusations'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Esprili cevabın oylamadan daha çok konuşuldu ve kazandın.', 'Your witty reply got more attention than the vote, and you won.'), rep(4), press(4), happy(6), flags({ goal_campaign: null }))
            : fx(t('Tartışma büyüdü, ödül rakibe gitti, sen "kavgacı" ilan edildin.', 'The row escalated, the award went to the rival, and you were branded "combative".'), press(-6), stress(7), disc(-3), flags({ goal_campaign: null })),
      },
    ],
  },
  {
    id: 'awards.fan_vote_fiasco',
    category: 'awards',
    weight: 0.8,
    cooldownWeeks: 40,
    triggers: ['season_end', 'weekly'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 25,
    title: t('Taraftar Oylaması Fiyaskosu', 'The Fan Vote Fiasco'),
    text: t(
      '{clubName} taraftarları "Sezonun Oyuncusu" oylamasında seni değil, takımın maskotu Kartal Kemal\'i seçti. %61 oyla. Kulüp ödülü kime vereceğini bilmiyor.',
      '{clubName} fans voted for Kemal the Eagle, the club mascot, as Player of the Season. With 61% of the vote. The club has no idea who to hand the trophy to.',
    ),
    icon: '🦅',
    choices: [
      {
        label: t('Ödülü maskotla birlikte al', 'Collect the award with the mascot'),
        effects: (ctx) => fx(t('Kartal Kemal ile kol kola fotoğraf. Yılın en sevimli anı.', 'Arm in arm with Kemal the Eagle. The cutest moment of the year.'), fans(10), folPct(ctx, 8), happy(5)),
      },
      {
        label: t('Kulübe resmi şikâyet yaz', 'File an official complaint'),
        risk: 'medium',
        effects: () => fx(t('Şikâyetin basına sızdı: "Maskotu kıskanan oyuncu."', 'Your complaint leaked: "Player jealous of mascot."'), press(-6), fans(-8), rep(-2), stress(5)),
      },
      {
        label: t('Kostümü giyip maçta maskot ol', 'Wear the costume at the next home game'),
        effects: () => fx(t('Devre arasında kartal kostümüyle penaltı attın. Stadyum yıkıldı; hoca ise pek gülmedi.', 'You took a half-time penalty in the eagle suit. The stadium went wild; the boss barely smiled.'), fans(14), rep(3), trust(-3), disc(-2)),
      },
    ],
  },
  {
    id: 'awards.dedication',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 30,
    triggers: ['match_win', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20,
    title: t('Golü Kime Adayacaksın?', 'Who Is This One For?'),
    text: t(
      'Maçın oyuncusu seçildin; saha kenarı röportajında muhabir soruyor: "Bu performansı kime adıyorsun?" Kafanda üç isim var.',
      'You are named man of the match, and the touchline reporter asks: "Who do you dedicate this performance to?" Three answers spring to mind.',
    ),
    icon: '🎙️',
    choices: [
      {
        label: t('Annem {motherName}\'e', 'To my mum, {motherName}'),
        effects: () => fx(t('Annen ekranın karşısında ağladı, sonra bütün akrabaları aradı.', 'Mum cried at the TV, chain called every relative she has.'), rel('mother', 10), happy(4)),
      },
      {
        label: t('Taraftarlara', 'To the fans'),
        effects: () => fx(t('Tribünler adını bir sonraki maç boyunca söyledi.', 'The stands sang your name all through the next game.'), fans(8), rep(2)),
      },
      {
        label: t('Beni yedek bırakan hocaya, "teşekkürler"', 'To the coach who benched me. "Thanks."'),
        risk: 'high',
        effects: () => fx(t('İğneleme kimsenin gözünden kaçmadı. {managerName} soyunma odasında seni görmezden geldi.', 'Nobody missed the dig. {managerName} ignored you in the dressing room.'), trust(-10), press(5), stress(5), happy(3)),
      },
    ],
  },
]
