/** Nightlife: parties, paparazzi, fights, curfews. Mostly fired when the hero goes out. */
import {
  ban, boss, canAfford, disc, energy, fans, fatigue, flags, folPct, follow, form, fx, happy, hasClub, health, injury, money,
  morale, news, num, pickFirst, press, rel, relNpc, rep, sharp, stress, t, chain, trust, wageX,
} from '../dsl'
import type { EventDef } from '../types'

export const nightlifeEvents: EventDef[] = [
  {
    id: 'nightlife.vip_dj',
    category: 'nightlife',
    weight: 1.1,
    cooldownWeeks: 12,
    triggers: ['nightlife'],
    conditions: ({ state }) => state.hero.reputation >= 15,
    vars: (_ctx, rng) => ({ dj: rng.pick(['DJ Kozmik', 'DJ Nebula', 'Mavi Volt', 'DJ Poyraz']) }),
    title: t('DJ Kabinine Davet', 'Into the DJ Booth'),
    text: t(
      'Şehrin en popüler kulübü. {dj} müziği kesip mikrofona bağırıyor: "Aranızda bir yıldız var! {heroName}, yukarı gel!" Bütün telefonlar sana dönüyor.',
      'The hottest club in town. {dj} cuts the music and yells into the mic: "We\'ve got a star in the house! {heroName}, get up here!" Every phone turns your way.',
    ),
    icon: '🎧',
    choices: [
      {
        label: t('Kabine çık, mikrofonu kap', 'Get up there, grab the mic'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Takımın marşını bas eşliğinde söyledin. Video bütün gece paylaşıldı, çoğunlukla sevgiyle.', 'You sang the club anthem over a bass drop. The clip did the rounds all night, mostly with love.'), folPct(ctx, 5), fans(4), happy(6), energy(-10))
            : fx(
                t('Mikrofonda "rakiplere" bir laf ettin. Biraz fazla. Sabah hoca videoyu izlemişti.', 'You said something about "the rivals" on the mic. A bit much. By morning the gaffer had seen it.'),
                folPct(ctx, 3), boss(-4), disc(-4), energy(-10),
                news(t('{heroName} gece kulübünde mikrofonu bırakmadı', '{heroName} hogs the mic at nightclub'), -1),
              ),
      },
      {
        label: t('El salla, VIP\'de sakin takıl', 'Wave, keep it low-key in VIP'),
        effects: () => fx(t('Gülümseme, el sallama, sonra köşede su. Profesyonel bir gece.', 'A smile, a wave, then water in a corner booth. A professional night.'), happy(3), energy(-4)),
      },
      {
        label: t('Fark edildin, erken çık', "You've been spotted. Leave early"),
        effects: () => fx(t('Eve döndüğünde saat daha on biriydi. Yatağın seni bekliyordu, arkadaşların ise biraz kırgın.', 'Home before eleven. The bed was thrilled; your mates less so.'), energy(5), sharp(2), rel('bestFriend', -3)),
      },
    ],
  },
  {
    id: 'nightlife.paparazzi',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 10,
    triggers: ['nightlife'],
    conditions: ({ state }) => state.hero.reputation >= 25,
    title: t('Kapıda Flaşlar', 'Flashbulbs at the Door'),
    text: t(
      'Saat 02.40. Kulüpten çıkarken kapıda altı foto muhabiri. Gömleğin hafif yamuk, gözlerin yarı kapalı. Arabaya yirmi metre var.',
      '2:40 a.m. Six photographers outside the club. Your shirt is slightly askew, your eyes half closed. The car is twenty metres away.',
    ),
    icon: '📸',
    choices: [
      {
        label: t('Gülümse, poz ver, kibar ol', 'Smile, pose, be nice'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Fotoğraflar "keyifli yıldız" temalı çıktı. Zararsız.', 'The photos ran as "star enjoys night off". Harmless.'), press(3), rep(1))
            : fx(t('Fotoğraflardan biri pek iyi çıkmadı. Gerçekten iyi çıkmadı.', 'One of the shots was not kind. Really not kind.'), press(1), follow(chain('nightlife.paparazzi_photos', 1))),
      },
      {
        label: t('Yüzünü kapat, koş', 'Cover your face and run'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.4)
            ? fx(t('Arabaya kadar koştun, kimse doğru düzgün çekemedi.', 'You made it to the car; nobody got a clean shot.'), stress(2))
            : fx(t('Kaldırımda tökezledin. Fotoğraf: tek ayakkabı, havada kollar.', 'You tripped on the kerb. Photo: one shoe, arms flailing.'), stress(6), follow(chain('nightlife.paparazzi_photos', 1))),
      },
      {
        label: t('Mutfak kapısından çık', 'Leave through the kitchen'),
        effects: () => fx(t('Aşçılar seni alkışladı, biri de lahmacun verdi. Kapıdakiler boşuna bekledi.', 'The chefs applauded you out and handed you a flatbread. The snappers waited in vain.'), happy(3)),
      },
    ],
  },
  {
    id: 'nightlife.paparazzi_photos',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Gazetede Sen', 'Front-Page Night Out'),
    text: t(
      'Sabah gazetesi: "{heroName} sabaha karşı 3\'te, maç haftasında!" Fotoğraf berbat. {managerName} henüz aramadı. Henüz.',
      'Morning paper: "{heroName} out at 3 a.m. in match week!" The picture is dreadful. {managerName} hasn\'t called yet. Yet.',
    ),
    icon: '📰',
    choices: [
      {
        label: t('Fotoğrafla dalga geçen bir paylaşım yap', 'Post a self-deprecating joke about it'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('"Ayakkabımı bulan getirsin" yazdın. İnternet seni sevdi; hoca bile gülümsedi.', '"Whoever finds my shoe, please return it." The internet loved it; even the gaffer smirked.'), folPct(ctx, 4), press(3), happy(2))
            : fx(t('Şaka tutmadı: "Hâlâ ciddiye almıyor" yorumları yağdı.', 'The joke flopped: "Still not taking it seriously," wrote everyone.'), fans(-4), boss(-3), stress(5)),
      },
      {
        label: t('Hocayı ara, önce sen özür dile', 'Call the gaffer first, apologise'),
        effects: () => fx(t('{managerName} sesini yükseltmedi. "Sahada göster" dedi. Bu kez idare etti.', '{managerName} didn\'t raise his voice. "Show me on the pitch." This time, it\'s fine.'), boss(3), trust(2), disc(2)),
      },
      {
        label: t('Hiçbir şey olmamış gibi davran', 'Act like nothing happened'),
        effects: () => fx(t('Antrenmanda kimse bir şey demedi. Kadro listesinde adın ilk on birde değildi.', 'Nobody said anything at training. Your name just wasn\'t in the starting XI.'), trust(-5), disc(-3), stress(4)),
      },
    ],
  },
  {
    id: 'nightlife.bar_fight',
    category: 'nightlife',
    weight: 0.9,
    cooldownWeeks: 20,
    triggers: ['nightlife'],
    conditions: ({ state }) => hasClub(state),
    title: t('Bardaki Kabadayı', 'The Bar-Room Hard Man'),
    text: t(
      'Bir adam {mate}\'in üstüne bilerek içki döktü, sonra kulübünüz hakkında yüksek sesle bir şeyler söyledi. Arkadaşları sırıtıyor, telefonlar kayıtta. {mate} yumruklarını sıkıyor.',
      'A bloke deliberately spilled a drink down {mate}, then loudly said something about your club. His friends are grinning, phones already recording. {mate} is clenching {g:his|her} fists.',
    ),
    icon: '🥊',
    choices: [
      {
        label: t('{mate}\'i kolundan tut, çıkın', 'Grab {mate} by the arm and leave'),
        effects: (ctx) => fx(t('Arkanızdan "korkaklar" diye bağırdılar. Ertesi gün {mate} teşekkür etti.', 'They shouted "cowards" after you. Next day {mate} said thanks.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 8), disc(2), stress(3)),
      },
      {
        label: t('Esprili bir lafla gerginliği düşür', 'Defuse it with a joke'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('"Kulübümüzü bu kadar dert ediyorsan kombine alırsın artık." Bar güldü, adam bile.', '"If you care this much, buy a season ticket." The bar laughed. Even him.'), folPct(ctx, 2), happy(4), relNpc(ctx.vars.mateId, ctx.vars.mate, 5))
            : fx(t('Espri yanlış anlaşıldı, adam itti; ama güvenlik zamanında geldi.', 'He took it the wrong way and shoved you, but security stepped in just in time.'), stress(6)),
      },
      {
        label: t('Geri it', 'Shove him back'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(
                t('Kısa, çirkin bir arbede. Elin şişti. Video çoktan yayında.', 'A short, ugly scuffle. Your hand is swollen. The video is already online.'),
                injury(1, t('Burkulmuş el', 'Sprained hand')), disc(-8), relNpc(ctx.vars.mateId, ctx.vars.mate, 10),
                flags({ bar_fight: true }), follow(chain('nightlife.fight_police', 0)),
              )
            : fx(
                t('Adam yere düştü, sen de üstüne. Polis geldi, ifade verdin.', 'He went down, so did you. The police came; you gave a statement.'),
                disc(-10), stress(10), health(-3), flags({ bar_fight: true }), follow(chain('nightlife.fight_police', 0)),
              ),
      },
    ],
  },
  {
    id: 'nightlife.fight_police',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ amount: wageX(state, 2, 2000) }),
    title: t('Video Yayında', 'The Footage Is Out'),
    text: t(
      'Kavga videosu her yerde; açılardan biri seni gerçekten kötü gösteriyor. Avukatın arıyor, kulübün basın sorumlusu arıyor, annen de arıyor.',
      'The fight video is everywhere, and one angle makes you look genuinely bad. Your lawyer is calling. The press office is calling. Your mum is calling.',
    ),
    icon: '🚓',
    choices: [
      {
        label: t('Kamuoyundan özür dile, bağış yap', 'Apologise publicly and donate'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bağış yapacak paran yok.', "You can't afford a donation."),
        effects: (ctx) =>
          fx(
            t('Samimi bir açıklama ve {amount:money} bağış. Fırtına diniyor ama kulüp yine de konuşmak istiyor.', 'A sincere statement and {amount:money} to charity. The storm eases, but the club still wants a word.'),
            money(-num(ctx, 'amount')), press(6), fans(3), rep(1), follow(chain('nightlife.club_hearing', 1)),
          ),
      },
      {
        label: t('Avukatına bırak, sus', 'Let the lawyer handle it, say nothing'),
        effects: (ctx) =>
          fx(t('Hukuken temizsin; avukat faturası {amount:money}. Kamuoyu sessizliğini kibir olarak okudu.', 'Legally you\'re clear; the bill is {amount:money}. The public read your silence as arrogance.'), money(-num(ctx, 'amount')), press(-4), follow(chain('nightlife.club_hearing', 1))),
      },
      {
        label: t('"Ben başlatmadım" de', '"I didn\'t start it"'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Başka bir açıdan video çıktı: gerçekten sen başlatmamışsın. Kamuoyu döndü.', 'A second angle emerged: you really didn\'t start it. Opinion swung your way.'), press(4), fans(4), stress(-3))
            : fx(t('Kimse inanmadı. "Bahane üreten yıldız" manşeti.', 'Nobody bought it. Headline: "Star makes excuses".'), press(-6), rel('mother', -4), stress(6), follow(chain('nightlife.club_hearing', 1))),
      },
    ],
  },
  {
    id: 'nightlife.club_hearing',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ fine: wageX(state, 1, 1000) }),
    title: t('Disiplin Kurulu', 'Disciplinary Hearing'),
    text: t(
      '{chairmanName}, {managerName} ve kulübün avukatı uzun bir masanın arkasında. Önlerinde video kareleri. "{fine:money} ceza öneriyoruz" diyor başkan. "Söyleyeceğin bir şey var mı?"',
      '{chairmanName}, {managerName} and the club lawyer sit behind a long table, video stills in front of them. "We propose a {fine:money} fine," says the chairman. "Anything to add?"',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Cezayı kabul et', 'Accept the fine'),
        effects: (ctx) => fx(t('Kısa ve temiz. Sayfa kapandı.', 'Short and clean. Page turned.'), money(-num(ctx, 'fine')), disc(5), rel('chairman', 2), flags({ bar_fight: null })),
      },
      {
        label: t('Ceza yerine toplum hizmeti öner', 'Offer community work instead'),
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Kurul ikna oldu: altı hafta çocuk akademisinde gönüllü antrenörlük.', 'They agreed: six weeks volunteering at the kids\' academy.'), disc(6), rep(2), energy(-6), flags({ bar_fight: null }))
            : fx(t('"Burası pazar yeri değil." Ceza iki katı.', '"This isn\'t a bazaar." The fine doubled.'), money(-2 * num(ctx, 'fine')), disc(2), rel('chairman', -4)),
      },
      {
        label: t('İtiraz et: "Arkadaşımı korudum"', 'Push back: "I protected a teammate"'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.35)
            ? fx(t('{managerName} beklenmedik şekilde arkanda durdu. Ceza yarıya indi; takım bunu duydu.', '{managerName} unexpectedly backed you. Fine halved, and the squad heard about it.'), money(-Math.round(num(ctx, 'fine') / 2)), rel('teammate', 4), boss(2), flags({ bar_fight: null }))
            : fx(t('Kurul seni bir maç kadro dışı bıraktı. Başkan kapıyı sertçe kapattı.', 'The board left you out for a match. The chairman slammed the door.'), money(-num(ctx, 'fine')), ban(1), rel('chairman', -8), trust(-4)),
      },
    ],
  },
  {
    id: 'nightlife.mate_birthday',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 16,
    triggers: ['nightlife', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Doğum Günü, Maçtan Önceki Gece', 'Birthday, Night Before a Match'),
    text: t(
      '{mate} yarın 27 yaşına giriyor ve partiyi bu gece yapıyor. Yarın da maç var. "Sadece bir saat gel" diyor. Herkes bilir ki "bir saat" futbolcu dilinde "sabah dörde kadar" demektir.',
      '{mate} turns 27 tomorrow and is throwing the party tonight. Tomorrow is also match day. "Just come for an hour." Everyone knows "an hour" in footballer means "until 4 a.m.".',
    ),
    icon: '🎂',
    choices: [
      {
        label: t('Git, gazozla takıl, gece yarısı çık', 'Go, stick to soda, leave at midnight'),
        effects: (ctx) => fx(t('Pasta, kısa bir konuşma, gece yarısı çıkış. Dengeli bir zafer.', 'Cake, a short speech, out by midnight. A balanced victory.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 8), energy(-5), happy(3)),
      },
      {
        label: t('Sonuna kadar kal', 'Stay till the end'),
        risk: 'high',
        effects: (ctx) =>
          fx(
            t('Unutulmaz bir gece. Maçın ilk yarısında da unutulmaz derecede ağırdın.', 'An unforgettable night. You were also unforgettably heavy-legged in the first half.'),
            relNpc(ctx.vars.mateId, ctx.vars.mate, 15), rel('teammate', 3), fatigue(15), form(-6), sharp(-5), happy(6), flags({ party_animal: true }),
          ),
      },
      {
        label: t('Gitme, güzel bir hediye yolla', 'Skip it, send a great gift'),
        requires: (ctx) => canAfford(ctx.state, 500),
        lockedHint: t('Hediye bütçen yok.', 'No budget for a gift.'),
        effects: (ctx) => fx(t('Hediye çok sevildi. Grup fotoğrafında yokluğun ise fark edildi.', 'The gift was a hit. Your absence from the group photo was noticed, though.'), money(-500), relNpc(ctx.vars.mateId, ctx.vars.mate, 4), sharp(3)),
      },
      {
        label: t('Gitme, mesaj at', 'Skip it, send a text'),
        effects: (ctx) => fx(t('"İyi ki doğdun kanka 🎉". Mavi tik geldi, cevap gelmedi.', '"Happy birthday mate 🎉". Read. No reply.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -6), sharp(3), trust(1)),
      },
    ],
  },
  {
    id: 'nightlife.karaoke',
    category: 'nightlife',
    weight: 1,
    cooldownWeeks: 14,
    triggers: ['nightlife'],
    conditions: ({ state }) => hasClub(state),
    title: t('Karaoke Gecesi', 'Karaoke Night'),
    text: t(
      'Takım yemeği karaokeye döndü. {mate2} az önce acıklı bir arabesk parçayı ağlayarak bitirdi. Mikrofon şimdi sende. Kaptan "çeki, çeki" diye tempo tutuyor.',
      'Team dinner has become karaoke. {mate2} just finished a tragic ballad in actual tears. The mic is now in your hand and the captain is starting a chant.',
    ),
    icon: '🎤',
    choices: [
      {
        label: t('Duygusal bir slow, tüm kalbinle', 'A slow ballad, full heart'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Sesin şaşırtıcı derecede iyi. Masada sessizlik, sonra ayakta alkış.', 'Your voice is shockingly good. Silence, then a standing ovation.'), rel('teammate', 5), happy(6), folPct(ctx, 2))
            : fx(t('Nakaratta sesin çatladı. Takım bu sesi sezon boyunca ısınmada taklit edecek.', 'Your voice cracked on the chorus. The squad will imitate it in every warm-up this season.'), rel('teammate', 3), happy(2), stress(2)),
      },
      {
        label: t('Takımın marşını herkesle söyle', 'Lead the whole table in the club anthem'),
        effects: () => fx(t('Masalar titredi, garsonlar da katıldı. Takım ruhu tavan.', 'The tables shook, even the waiters joined in. Team spirit through the roof.'), rel('teammate', 6), morale(5), happy(4)),
      },
      {
        label: t('Mikrofonu {mate2}\'e geri ver', 'Hand the mic back to {mate2}'),
        effects: (ctx) => fx(t('{mate2} bis yaptı. Senin sıra gelmedi, yüzün kızarmadı.', '{mate2} did an encore. Your turn never came; neither did the blushing.'), relNpc(ctx.vars.mate2Id, ctx.vars.mate2, 4), rel('teammate', -1)),
      },
    ],
  },
  {
    id: 'nightlife.shady_promoter',
    category: 'nightlife',
    weight: 0.8,
    cooldownWeeks: 24,
    triggers: ['nightlife'],
    conditions: ({ state }) => state.hero.reputation >= 30,
    vars: ({ state }, rng) => ({ promoter: pickFirst(rng), amount: wageX(state, 2, 2500) }),
    title: t('Yatta After Parti', 'Afterparty on a Yacht'),
    text: t(
      'Altın zincirli, kendine "{promoter} Prodüksiyon" diyen biri yanına oturdu: "Yatta bir after var. Sadece gel, bir iki fotoğraf. {amount:money} nakit, hemen." Kartında telefon numarası bile yok.',
      'A man in a gold chain who calls himself "{promoter} Productions" sits beside you: "Afterparty on a yacht. Just show up, a couple of photos. {amount:money} cash, right now." His card doesn\'t even have a phone number.',
    ),
    icon: '🛥️',
    choices: [
      {
        label: t('Parayı al, git', 'Take the cash, go'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('İki fotoğraf, bir saatlik sıkıcı sohbet, cebinde para. Bu kez sorun çıkmadı.', 'Two photos, an hour of dull chat, cash in pocket. No trouble this time.'), money(num(ctx, 'amount')), energy(-10), fatigue(6))
            : fx(
                t('Yattakilerin kim olduğu ertesi gün haberlerde çıktı. Seni de "konuklar" arasında saydılar.', 'The next day the news revealed who else was on that yacht. You were listed among "the guests".'),
                money(num(ctx, 'amount')), rep(-4), disc(-8), press(-6), stress(10), boss(-4),
                news(t('{heroName} tartışmalı yat partisinde', '{heroName} spotted at controversial yacht party'), -1),
              ),
      },
      {
        label: t('Gel ama para alma', 'Go, but refuse the money'),
        effects: () => fx(t('Kimseye borçlu değilsin, ama yat da sandığın kadar eğlenceli değildi.', "You owe nobody, but the yacht wasn't as fun as advertised."), energy(-8), happy(2)),
      },
      {
        label: t('Kibarca reddet, eve git', 'Decline politely, go home'),
        effects: () => fx(t('{promoter} omuz silkip başka bir masaya geçti. Uykun da tam oldu.', '{promoter} shrugged and moved to another table. You slept well.'), energy(4), disc(2)),
      },
    ],
  },
  {
    id: 'nightlife.curfew_sneak',
    category: 'nightlife',
    weight: 0.9,
    cooldownWeeks: 16,
    triggers: ['weekly', 'nightlife'],
    conditions: ({ state }) => hasClub(state),
    title: t('Kamp Otelinde Kaçamak', 'Sneaking Out of the Team Hotel'),
    text: t(
      'Deplasman kampı, saat 23.30, yat saati geçti. {mate} kapını tıklatıyor: "Aşağıda bir yer var, yarım saat. Merdivenden ineriz, kimse görmez." Koridorda bir ışık yanıp sönüyor.',
      'Away trip, team hotel, 11:30 p.m., past curfew. {mate} taps on your door: "Bar round the corner, half an hour. Fire stairs, nobody\'ll see." A light flickers in the corridor.',
    ),
    icon: '🌙',
    choices: [
      {
        label: t('Merdivenlerden in', 'Take the fire stairs'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.45)
            ? fx(t('Yarım saat, bir limonata, gizli bir zafer. Kimse görmedi. Bu sefer.', 'Half an hour, one lemonade, a secret triumph. Nobody saw. This time.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 10), happy(4), fatigue(4))
            : fx(
                t('Döndüğünüzde lobide pijamalı biri bekliyordu: {managerName}. Ceza ve kadro dışı.', 'When you came back, someone in pyjamas was waiting in the lobby: {managerName}. Fined and dropped.'),
                relNpc(ctx.vars.mateId, ctx.vars.mate, 6), money(-wageX(ctx.state, 0.5, 500)), trust(-10), disc(-10), boss(-8),
              ),
      },
      {
        label: t('Onu sen de vazgeçir', 'Talk {g:him|her} out of it too'),
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Biraz homurdandı ama kaldı. Ertesi gün iyi oynadı ve sana göz kırptı.', '{g:He|She} grumbled, but stayed. Played well the next day and winked at you.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 4), trust(1))
            : fx(t('"Sen bilirsin hocanın gözdesi." Tek başına gitti.', '"Fine, teacher\'s pet." {g:He|She} went alone.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -6)),
      },
      {
        label: t('Kapıyı kapat, uyu', 'Close the door, go to sleep'),
        effects: (ctx) => fx(t('Sekiz saat uyku. Sabah kahvaltıda kimin gözü kızarık, hemen anladın.', 'Eight hours of sleep. At breakfast you could tell exactly who had gone out.'), sharp(3), energy(5), relNpc(ctx.vars.mateId, ctx.vars.mate, -3)),
      },
    ],
  },
]
