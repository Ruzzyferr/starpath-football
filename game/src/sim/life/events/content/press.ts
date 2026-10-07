/** Press: microphones, misquotes, columnists and the art of saying nothing. */
import {
  boss, canAfford, fans, flags, follow, folPct, fx, happy, hasClub, money, morale, news, num, press, rel, relVal, rep, stress, t, chain, trust, wageX, pickBrand, nice,
} from '../dsl'
import type { EventDef } from '../types'

const OUTLETS = ['Gol Postası', 'The Terrace Times', 'Tribün Gazetesi', 'Matchday Monitor', 'Kale Arkası'] as const

export const pressEvents: EventDef[] = [
  {
    id: 'press.post_win_interview',
    category: 'press',
    weight: 1.2,
    cooldownWeeks: 6,
    triggers: ['match_win'],
    conditions: ({ state }) => hasClub(state),
    title: t('Galibiyet Sonrası Mikrofon', 'Post-Win Flash Interview'),
    text: t(
      'Ter içindesin, arkanda sponsor panosu, önünde altı mikrofon. Muhabir gülümsüyor: "{heroName}, bu galibiyeti kime armağan ediyorsun?"',
      'Drenched in sweat, sponsor board behind you, six microphones in your face. The reporter beams: "{heroName}, who do you dedicate this win to?"',
    ),
    icon: '🎙️',
    choices: [
      {
        label: t('"Takıma ve taraftara."', '"The {g:lads|girls} and the fans."'),
        effects: () => fx(t('Kitap gibi cevap. Kimse kızmadı, kimse de hatırlamayacak.', 'Textbook answer. Nobody\'s upset, nobody will remember it.'), rel('teammate', 2), fans(3), press(1)),
      },
      {
        label: t('"Bana inanmayanlara!"', '"To everyone who doubted me!"'),
        risk: 'medium',
        effects: (ctx) =>
          fx(t('Klip saatlerce döndü. Taraftar bayıldı; soyunma odasında birkaç kaş kalktı.', 'The clip went round for hours. Fans loved it; a few eyebrows went up in the dressing room.'), folPct(ctx, 5), fans(5), rep(1), rel('teammate', -2), press(3)),
      },
      {
        label: t('"Anneme. Her şey onun için."', '"My mum. Everything is for her."'),
        effects: () => fx(t('{motherName} izlerken ağlamış. Komşular kapıya çiçek bırakmış.', '{motherName} cried watching it. The neighbours left flowers at the door.'), rel('mother', 10), happy(4), press(2)),
      },
    ],
  },
  {
    id: 'press.post_loss_interview',
    category: 'press',
    weight: 1.2,
    cooldownWeeks: 6,
    triggers: ['match_loss'],
    conditions: ({ state }) => hasClub(state),
    title: t('Yenilgi Sonrası Soğuk Soru', 'The Cold Question After Defeat'),
    text: t(
      'Muhabir acımasız: "Bugün takımda kimse koşmadı gibiydi. {managerName}\'ın taktiği tutmadı mı?"',
      'The reporter goes straight for the throat: "Nobody seemed to run today. Did {managerName}\'s tactics fail?"',
    ),
    icon: '🌧️',
    choices: [
      {
        label: t('"Sorumluluk bizim, oyuncuların."', '"That\'s on us, the players."'),
        effects: () => fx(t('Hocaya kalkan oldun. {managerName} ertesi gün omzuna dokundu.', 'You shielded the gaffer. {managerName} patted your shoulder the next day.'), boss(6), trust(3), press(1)),
      },
      {
        label: t('"Bazı kararları anlamakta zorlanıyoruz."', '"Some decisions are hard to understand."'),
        risk: 'high',
        effects: () =>
          fx(
            t('Manşet hazır: "Soyunma odasında isyan!" Hoca seni ofisine çağırdı.', 'Headline writes itself: "Dressing-room revolt!" The gaffer summoned you to his office.'),
            boss(-15),
            trust(-8),
            press(6),
            fans(2),
            news(t('{heroName}\'dan hocaya üstü kapalı eleştiri', '{heroName} takes veiled swipe at manager'), -1),
          ),
      },
      {
        label: t('Mikrofonları geçip yürü', 'Walk straight past the mics'),
        effects: () => fx(t('Sessizlik de bir cevap. Basın "kibirli" dedi, sen de rahat uyudun.', 'Silence is an answer too. The press called you aloof; you slept fine.'), press(-6), stress(-2)),
      },
    ],
  },
  // ── Chain: misquote → fallout → lawsuit/apology ──
  {
    id: 'press.misquote',
    category: 'press',
    weight: 1,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 10,
    vars: (_ctx, rng) => ({ outlet: rng.pick(OUTLETS) }),
    title: t('Ağzımdan Çıkmadı!', 'I Never Said That!'),
    text: t(
      '{outlet} manşeti: "{heroName}: {clubName} bana küçük gelir." Sen sadece "her oyuncu büyük hayal kurar" demiştin.',
      '{outlet} front page: "{heroName}: {clubName} is too small for me." All you said was "every player dreams big."',
    ),
    icon: '📰',
    choices: [
      {
        label: t('Hemen açıklama yap', 'Issue a statement right away'),
        effects: () =>
          fx(t('Açıklamayı yaptın, taraftarın yarısı inandı. Diğer yarısı "kesin dedi" diyor.', 'You put out a statement; half the fans believe you. The other half are sure you said it.'), fans(-3), press(-2), stress(4), follow(chain('press.misquote_fallout', 1))),
      },
      {
        label: t('Kayıt kaydını yayınla', 'Release the full audio'),
        risk: 'medium',
        effects: (ctx) =>
          fx(t('Ses kaydı her şeyi gösterdi. Gazete köşeye sıkıştı, sen haklı çıktın.', 'The tape proves it. The paper is cornered, you\'re vindicated.'), fans(4), press(-8), folPct(ctx, 3), follow(chain('press.misquote_fallout', 1)), flags({ misquote_proof: true })),
      },
      {
        label: t('Görmezden gel', 'Ignore it'),
        effects: () => fx(t('Haber üç gün döndü, sonra unutuldu. Ama {chairmanName} unutmadı.', 'It ran for three days then faded. {chairmanName} hasn\'t forgotten, though.'), fans(-6), rel('chairman', -6), stress(2)),
      },
    ],
  },
  {
    id: 'press.misquote_fallout',
    category: 'press',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ outlet: rng.pick(OUTLETS) }),
    title: t('{outlet} Geri Adım Atmıyor', '{outlet} Won\'t Back Down'),
    text: t(
      '{outlet} ikinci bir yazı yayımladı: "Kaynaklarımızın arkasındayız." Menajerin {agentName} arıyor: "Dava açalım mı, yoksa barışalım mı?"',
      '{outlet} doubles down: "We stand by our sources." Your agent {agentName} calls: "Do we sue, or make peace?"',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Dava aç', 'Sue them'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 2, 2000)),
        lockedHint: t('Avukat masrafını karşılayamazsın.', 'You can\'t cover the legal fees.'),
        effects: (ctx) =>
          fx(t('Dilekçe verildi. Avukatlar hızlıca fatura kesmeye başladı.', 'Papers filed. The lawyers started billing immediately.'), money(-wageX(ctx.state, 2, 2000)), stress(6), follow(chain('press.misquote_court', 6))),
      },
      {
        label: t('Editörle yemeğe çık, barış', 'Have lunch with the editor, make peace'),
        effects: () =>
          fx(t('Tatlıda düzeltme sözü aldın; bir de özel röportaj sözü verdin.', 'By dessert you\'d secured a correction, and promised them an exclusive.'), press(8), fans(2), stress(-3), flags({ misquote_proof: null })),
      },
      {
        label: t('Kulübün iletişim ekibine bırak', 'Leave it to the club\'s comms team'),
        effects: () => fx(t('Kulüp sert bir açıklama yaptı. Seni korudular, ama sana bir borç yazdılar.', 'The club issued a stern statement. They had your back, and logged a favour owed.'), rel('chairman', 3), press(-3), flags({ misquote_proof: null })),
      },
    ],
  },
  {
    id: 'press.misquote_court',
    category: 'press',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ outlet: rng.pick(OUTLETS) }),
    title: t('Mahkeme Kararı', 'The Verdict'),
    text: t('{outlet} davasında karar günü. Adliye önünde kameralar seni bekliyor.', 'Verdict day in your case against {outlet}. Cameras wait outside the courthouse.'),
    icon: '🏛️',
    choices: [
      {
        label: t('Kararı içeride dinle', 'Hear it inside'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(ctx.state.life.flags['misquote_proof'] ? 0.8 : 0.45)
            ? fx(
                t('Kazandın! Tazminat ve tam sayfa düzeltme. Basın sana artık daha dikkatli yaklaşacak.', 'You won! Damages plus a full-page correction. The press will tread carefully now.'),
                money(wageX(ctx.state, 4, 4000)),
                rep(3),
                press(-5),
                happy(8),
                flags({ misquote_proof: null }),
                news(t('{outlet}, {heroName} davasını kaybetti', '{outlet} loses case brought by {heroName}'), 1),
              )
            : fx(t('Dava reddedildi. Masraflar senden. Manşet: "Yıldız eleştiriye tahammülsüz."', 'Case dismissed, costs against you. Headline: "Star can\'t handle criticism."'), money(-wageX(ctx.state, 1, 1000)), rep(-2), press(-10), stress(8), flags({ misquote_proof: null })),
      },
      {
        label: t('Son dakika uzlaş', 'Settle on the courthouse steps'),
        effects: () => fx(t('Gizli uzlaşma: sessizlik karşılığında küçük bir bağış. Kimse kazanmadı, kimse kaybetmedi.', 'Confidential settlement: a small charity donation for silence. No winners, no losers.'), stress(-5), press(2), flags({ misquote_proof: null })),
      },
    ],
  },
  {
    id: 'press.rival_trash_talk',
    category: 'press',
    weight: 1,
    cooldownWeeks: 16,
    triggers: ['weekly', 'post_match'],
    conditions: ({ state }) => hasClub(state),
    title: t('{rivalPlayer} Laf Soktu', '{rivalPlayer} Has Been Talking'),
    text: t(
      '{rivalClub} forması giyen {rivalPlayer} röportajda: "{heroName} mi? Instagram\'da iyi, sahada pek görmedim." Muhabirler senin cevabını bekliyor.',
      '{rivalClub}\'s {rivalPlayer} in an interview: "{heroName}? Great on Instagram. Haven\'t noticed {g:him|her} on the pitch." Reporters want your reply.',
    ),
    icon: '🗯️',
    choices: [
      {
        label: t('"Sahada görüşürüz."', '"See you on the pitch."'),
        effects: () => fx(t('Kısa, net, havalı. Derbi biletleri bir saatte tükendi.', 'Short, sharp, cool. Tickets sold out within the hour.'), fans(5), morale(5), press(2), flags({ nemesis_heat: true })),
      },
      {
        label: t('Esprili bir gönderme yap', 'Fire back with a joke'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('"O da beni maç özetlerinde görür, kenardan." Internet yıkıldı.', '"{g:He\'ll|She\'ll} see me in the highlights. From the bench." The internet melted.'), folPct(ctx, 7), fans(6), rep(2))
            : fx(t('Espri yanlış anlaşıldı; kibirli göründün.', 'The joke landed badly; you came off arrogant.'), press(-4), rep(-1), stress(4)),
      },
      {
        label: t('"Ona başarılar dilerim."', '"I wish {g:him|her} all the best."'),
        effects: () => fx(t('Büyüklük gösterdin. Bazı taraftarlar daha fazlasını bekliyordu.', 'You took the high road. Some fans wanted blood.'), press(4), fans(-2), boss(2)),
      },
    ],
  },
  {
    id: 'press.presser_ambush',
    category: 'press',
    weight: 0.9,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 25,
    title: t('Basın Toplantısında Pusu', 'Press Conference Ambush'),
    text: t(
      'Maç öncesi toplantıda bir magazin muhabiri sıraya kaynamış: "{heroName}, özel hayatınla ilgili iddialar doğru mu?"',
      'A tabloid reporter has slipped into the pre-match presser: "{heroName}, are the rumours about your private life true?"',
    ),
    icon: '🎤',
    choices: [
      {
        label: t('"Futbol sorularına cevap veriyorum."', '"I\'m taking football questions."'),
        effects: () => fx(t('Salonda alkış koptu. Basın sözcüsü sana göz kırptı.', 'Applause in the room. The press officer winked at you.'), press(3), stress(-1), trust(1)),
      },
      {
        label: t('Esprili bir cevapla geçiştir', 'Deflect with humour'),
        effects: (ctx) => fx(t('"Tek iddiam pazar günü gol atmak." Klip günün en çok izleneni.', '"My only affair is with the goal on Sunday." Most-watched clip of the day.'), folPct(ctx, 4), press(4), rep(1)),
      },
      {
        label: t('Toplantıyı terk et', 'Walk out'),
        risk: 'medium',
        effects: () => fx(t('Kalkıp çıktın. Kulüp sözcüsü ter döktü.', 'You stood up and left. The club spokesman visibly sweated.'), press(-8), rel('chairman', -4), stress(-3), news(t('{heroName} basın toplantısını terk etti', '{heroName} storms out of press conference'), -1)),
      },
    ],
  },
  // ── Chain: documentary crew ──
  {
    id: 'press.documentary',
    category: 'press',
    weight: 0.7,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 30,
    vars: (ctx, rng) => ({ amount: wageX(ctx.state, 5, 5000), platform: `${pickBrand(rng)}Flix` }),
    title: t('Belgesel Teklifi', 'A Documentary Offer'),
    text: t(
      '{platform} bir sezonunu çekmek istiyor: soyunma odası, ev, aile. Teklif {amount:money}. "Gerçek {heroName}\'ı göstereceğiz" diyorlar.',
      '{platform} wants to film your season: dressing room, home, family. The offer is {amount:money}. "We\'ll show the real {heroName}," they promise.',
    ),
    icon: '🎬',
    choices: [
      {
        label: t('Kapıları sonuna kadar aç', 'Full access'),
        risk: 'high',
        effects: (ctx) =>
          fx(t('Kameralar her yerde. Takım arkadaşların kameraya oynuyor, hoca kızgın.', 'Cameras everywhere. Teammates mug for the lens, the gaffer fumes.'), money(num(ctx, 'amount')), boss(-6), stress(5), flags({ doc_access: 'full' }), follow(chain('press.documentary_premiere', 12))),
      },
      {
        label: t('Sadece ev ve aile', 'Home and family only'),
        effects: (ctx) =>
          fx(t('Soyunma odası kapalı kaldı. Annen ilk kez kameraya börek açtı.', 'Dressing room off-limits. Your mum rolled pastry on camera for the first time.'), money(nice(num(ctx, 'amount') * 0.4)), rel('mother', 5), flags({ doc_access: 'home' }), follow(chain('press.documentary_premiere', 12))),
      },
      {
        label: t('Reddet', 'Turn it down'),
        effects: () => fx(t('"Hikâyemi sahada yazacağım." Hoca bu cevabı çok sevdi.', '"I\'ll write my story on the pitch." The gaffer loved that.'), boss(4), trust(2)),
      },
    ],
  },
  {
    id: 'press.documentary_premiere',
    category: 'press',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ platform: `${pickBrand(rng)}Flix` }),
    title: t('Belgesel Yayında', 'The Documentary Drops'),
    text: t('{platform} belgeseli bu gece yayında. Galaya gidiyor musun, yoksa evden mi izleyeceksin?', 'Your {platform} documentary premieres tonight. Red carpet, or sofa?'),
    icon: '🍿',
    choices: [
      {
        label: t('Galaya git', 'Hit the red carpet'),
        risk: 'medium',
        effects: (ctx, rng) => {
          const full = ctx.state.life.flags['doc_access'] === 'full'
          return rng.chance(full ? 0.55 : 0.75)
            ? fx(t('Eleştirmenler övdü, sosyal medya patladı. Herkes artık senin hikâyeni biliyor.', 'Critics rave, socials explode. Everyone knows your story now.'), folPct(ctx, 15), rep(full ? 5 : 3), fans(6), happy(6), flags({ doc_access: null }))
            : fx(t('Kurgu seni hocaya söylenirken gösterdi. Soyunma odası buz gibi.', 'The edit shows you moaning about the gaffer. The dressing room is frosty.'), folPct(ctx, 8), boss(-10), rel('teammate', -4), stress(8), flags({ doc_access: null }))
        },
      },
      {
        label: t('Evde ailenle izle', 'Watch at home with family'),
        effects: (ctx) => fx(t('Babanın gözü doldu ama "dizim fena çıkmış" diye konuyu değiştirdi.', 'Your dad welled up, then complained his knee looked bad on screen.'), rel('father', 8), rel('mother', 5), folPct(ctx, 6), happy(5), flags({ doc_access: null })),
      },
    ],
  },
  {
    id: 'press.columnist_offer',
    category: 'press',
    weight: 0.8,
    cooldownWeeks: 52,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20 && !state.life.flags['columnist'],
    vars: (ctx, rng) => ({ outlet: rng.pick(OUTLETS), amount: wageX(ctx.state, 0.3, 300) }),
    title: t('Köşe Yazarlığı', 'A Column of Your Own'),
    text: t(
      '{outlet} haftalık köşe teklif ediyor: yazı başı {amount:money}. "Sen konuş, biz yazalım" diyorlar ama son okuma onlarda.',
      '{outlet} offers a weekly column at {amount:money} a piece. "You talk, we type," they say, but they get final edit.',
    ),
    icon: '✍️',
    choices: [
      {
        label: t('Kabul et', 'Accept'),
        risk: 'medium',
        effects: (ctx) => fx(t('İlk yazın "Neden hâlâ sokakta top oynuyorum" oldu. Okurlar sevdi.', 'Your first column: "Why I still play street football." Readers loved it.'), money(num(ctx, 'amount') * 4), press(8), rep(2), flags({ columnist: true })),
      },
      {
        label: t('Kendin yaz şartıyla kabul et', 'Accept, but you write it yourself'),
        requires: (ctx) => relVal(ctx.state, 'press') >= 0,
        lockedHint: t('Basınla aran buna izin vermiyor.', 'Your press relations are too sour for that.'),
        effects: (ctx) => fx(t('Gece yarısı yazdığın yazılar beklenmedik derecede iyi. Yorgunsun ama gururlu.', 'Your late-night columns are surprisingly good. Tired, but proud.'), money(num(ctx, 'amount') * 4), press(5), rep(3), stress(5), flags({ columnist: true })),
      },
      {
        label: t('Reddet, odak futbol', 'Decline, stay focused'),
        effects: () => fx(t('{managerName} bunu duydu ve onaylarcasına başını salladı.', '{managerName} heard and nodded approvingly.'), trust(2), press(-2)),
      },
    ],
  },
]

