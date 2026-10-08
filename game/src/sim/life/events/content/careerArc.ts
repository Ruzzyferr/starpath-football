/**
 * Career-arc cards (playtest round 2): content for the phases that ran dry.
 * In an 8–15 season run the share of never-seen cards fell to 4 % by season 8
 * and ~0 % after 30, so the star and veteran years replayed the same rookie
 * deck. These cards are gated by phase so each stage of a career has its own
 * questions:
 *
 *  - star years (reputation 65+): documentary (2-step chain), award campaign,
 *    idle-millions foundation (a money sink when cash just sits there);
 *  - veteran years (29+): recovery, rotation talk, the kid after your shirt,
 *    pundit audition, "when will you stop?", away-end applause, dressing-room
 *    elder, the chairman's farewell-season offer, the knee scan;
 *  - national-team veterans: retiring from international football (honoured
 *    by the squad announcement, sim/game/national.ts);
 *  - Legacy careers: the famous parent's shadow and advice.
 */
import type { GameState, RelationKind } from '../../../../core/types'
import {
  age, attr, boss, canAfford, chain, fans, fatigue, flags, fol, folPct, follow, fx, happy, hasClub, hasFlag, health, injury, money, morale, news, nice,
  num, pickPlayerFull, press, rel, rep, sharp, stress, t, trust,
} from '../dsl'
import type { EventDef } from '../types'

const isLegacy = (s: GameState): boolean => typeof s.life.flags['c:legacyParentId'] === 'string'
const legacyParent = (s: GameState): string => String(s.life.flags['c:legacyParentName'] ?? '')
/** The relationship that holds the legend parent (legacy.ts renames mother/father). */
const parentKind = (s: GameState): RelationKind => {
  const name = legacyParent(s)
  return s.life.relationships.mother?.name === name ? 'mother' : 'father'
}
const caps = (s: GameState): number => s.hero.nationalTeam.caps
const starter = (s: GameState): boolean => ['starter', 'star', 'captain'].includes(s.hero.contract?.role ?? '')

export const careerArcEvents: EventDef[] = [
  // ───────────── Star years ─────────────
  {
    id: 'press.documentary_offer',
    category: 'press',
    weight: 1,
    cooldownWeeks: 60,
    maxPerCareer: 1,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 65,
    vars: ({ state }) => ({ fee: nice(Math.max(40_000, state.hero.reputation * 2_500)) }),
    title: t('Kamera Her Yerde', 'Cameras Everywhere'),
    text: t(
      'Bir yayın platformu senin bir sezonunu çekmek istiyor: soyunma odası, ev, aile sofrası. Ücret {fee}. {managerName} kaşlarını çattı: "Soyunma odası kutsaldır."',
      'A streaming platform wants to film a season of your life: dressing room, home, family dinners. The fee is {fee}. {managerName} frowns: "The dressing room is sacred."',
    ),
    icon: '🎬',
    choices: [
      {
        label: t('Tam erişim: her şey çekilsin', 'Full access: film everything'),
        risk: 'medium',
        hint: t('Para ve şöhret getirir; takım arkadaşları kameradan hoşlanmayabilir.', 'Money and fame; teammates may hate the cameras.'),
        effects: (ctx) => fx(t('Ekip ertesi sabah kapındaydı. Mikrofonu soyunma odasına da soktular.', 'The crew was at your door the next morning. The mic went into the dressing room too.'),
          money(num(ctx, 'fee')), stress(6), boss(-5), rel('teammate', -3), flags({ doc_access: 'full' }), follow(chain('press.documentary_release', 14))),
      },
      {
        label: t('Sadece saha dışı: ev ve aile', 'Off the pitch only: home and family'),
        effects: (ctx) => fx(t('Anlaşma yarı ücretle imzalandı. Soyunma odası kapısı kapalı kalacak.', 'Signed for half the fee. The dressing-room door stays shut.'),
          money(Math.round(num(ctx, 'fee') / 2)), stress(3), rel('mother', 3), flags({ doc_access: 'home' }), follow(chain('press.documentary_release', 14))),
      },
      {
        label: t('Reddet', 'Turn it down'),
        effects: () => fx(t('"Belki emekli olunca." {managerName} omzuna vurdu.', '"Maybe when I retire." {managerName} patted your shoulder.'), boss(3), trust(2)),
      },
    ],
  },
  {
    id: 'press.documentary_release',
    category: 'press',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'doc_access'),
    title: t('Belgesel Yayında', 'The Documentary Drops'),
    text: t(
      'Dizi yayına girdi. İlk bölüm sosyal medyada gündem; ikinci bölümdeki bir sahne ise şimdiden kesilip biçiliyor.',
      'The series is out. Episode one is trending; a scene in episode two is already being clipped and dissected.',
    ),
    icon: '📺',
    choices: [
      {
        label: t('Gala gecesine git, sahneye çık', 'Go to the premiere and take the stage'),
        effects: (ctx) => fx(
          ctx.state.life.flags.doc_access === 'full'
            ? t('Soyunma odası sahneleri olay oldu. Bir takım arkadaşın, söylediği bir lafın yayınlanmasından hiç memnun değil.', 'The dressing-room scenes went viral. One teammate is far from happy that something he said made the cut.')
            : t('Aile sofrası sahneleri herkesi duygulandırdı. Annenin köftesi bile gündem oldu.', 'The family dinner scenes moved everyone. Even your mum\'s meatballs trended.'),
          rep(2), folPct(ctx, 15), fatigue(5),
          ...(ctx.state.life.flags.doc_access === 'full' ? [rel('teammate', -4), boss(-2)] : [rel('mother', 4)]),
          flags({ doc_access: null }), news(t('{heroName} belgeseli izlenme rekoru kırdı', '{heroName} documentary breaks streaming records'), 1)),
      },
      {
        label: t('İzleme, sahaya odaklan', 'Don\'t watch it, focus on football'),
        effects: () => fx(t('Telefonunu kapattın. Herkes diziyi konuşurken sen video analizi izledin.', 'You switched your phone off. While everyone talked about the show, you watched match footage.'),
          rep(1), trust(2), sharp(3), flags({ doc_access: null })),
      },
    ],
  },
  {
    id: 'awards.campaign',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 3,
    minWeek: 20,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 75 && state.hero.seasonStats.apps >= 10,
    title: t('Ödül Kampanyası', 'The Award Campaign'),
    text: t(
      'Kulübün iletişim ekibi yılın oyuncusu oylaması için kampanya başlatmak istiyor: röportajlar, özel video, oy çağrısı. "Sessiz kalırsan başkası kazanır."',
      'The club\'s media team wants to run a player-of-the-year campaign: interviews, a special video, a call to vote. "Stay quiet and someone else wins it."',
    ),
    icon: '🗳️',
    choices: [
      {
        label: t('Kampanyaya katıl', 'Join the campaign'),
        effects: (ctx) => fx(t('Bir hafta boyunca her yerdeydin. Oylar akıyor ama antrenmanda başın başka yerde.', 'You were everywhere for a week. The votes are flowing, but your head isn\'t in training.'),
          folPct(ctx, 6), press(4), fatigue(6), stress(4), sharp(-3)),
      },
      {
        label: t('"Ödülü saha versin"', '"Let the pitch decide"'),
        effects: () => fx(t('Teklifi geri çevirdin. Antrenmana ilk sen geldin, son sen çıktın.', 'You said no. First into training, last out.'), trust(3), boss(2), sharp(3)),
      },
      {
        label: t('Kampanyayı takım arkadaşına yönlendir', 'Point the campaign at a teammate'),
        effects: () => fx(t('"Bu sezon {mate} ödülü benden çok hak ediyor." Soyunma odasında hava değişti.', '"{mate} deserves it more than me this season." The dressing room felt different after that.'),
          rel('teammate', 6), attr('leadership', 1), press(2)),
      },
    ],
  },
  {
    id: 'money.foundation',
    category: 'money',
    weight: (ctx) => (ctx.state.life.money >= 5_000_000 ? 2 : 1),
    cooldownWeeks: 70,
    maxPerCareer: 2,
    conditions: ({ state }) => state.life.money >= 2_000_000,
    vars: ({ state }) => ({ big: nice(state.life.money * 0.08), small: nice(state.life.money * 0.02) }),
    title: t('Hesapta Duran Milyonlar', 'Millions Just Sitting There'),
    text: t(
      'Bankacın aradı: "Hesabında yıllardır duran bir servet var." {agentName} bir vakıf kurmanı öneriyor; annen ise "Mahallenin okuluna bir kütüphane" diyor.',
      'Your banker called: "There\'s a fortune just sitting in your account." {agentName} suggests a foundation; your mum says "a library for the neighbourhood school".',
    ),
    icon: '🏛️',
    choices: [
      {
        label: t('Vakıf kur ({big})', 'Start a foundation ({big})'),
        effects: (ctx) => fx(t('Vakfın ilk bursiyerleri belli oldu. Adının yanında artık "hayırsever" de yazıyor.', 'Your foundation named its first scholars. "Philanthropist" now sits next to your name.'),
          money(-num(ctx, 'big')), rep(3), happy(10), press(5), flags({ foundation: true }), news(t('{heroName} kendi vakfını kurdu', '{heroName} launches a charitable foundation'), 1)),
      },
      {
        label: t('Okula kütüphane ({small})', 'A school library ({small})'),
        effects: (ctx) => fx(t('Açılışta annen kurdeleyi kesti. Senin kadar heyecanlıydı.', 'Your mum cut the ribbon at the opening. She was as excited as you.'),
          money(-num(ctx, 'small')), rel('mother', 6), happy(6), rep(1)),
      },
      {
        label: t('Para bankada kalsın', 'Leave it in the bank'),
        effects: () => fx(t('Bankacın sustu. {agentName} iç çekti: "Peki, sen bilirsin."', 'Your banker went quiet. {agentName} sighed: "Fine, your call."'), rel('agent', -2)),
      },
    ],
  },

  // ───────────── Veteran years ─────────────
  {
    id: 'health.veteran_recovery',
    category: 'health',
    weight: 1.2,
    cooldownWeeks: 30,
    maxPerCareer: 3,
    triggers: ['post_match'],
    conditions: ({ state }) => age(state) >= 30 && hasClub(state),
    vars: ({ state }) => ({ physio: nice(Math.max(2_000, (state.hero.contract?.wage ?? 1_000) * 1.5)) }),
    title: t('Pazartesi Sabahları', 'Monday Mornings'),
    text: t(
      'Maçtan iki gün sonra hâlâ merdivenleri yan yan iniyorsun. Eskiden bir gecede geçen ağrı artık hafta sonuna kadar sürüyor.',
      'Two days after the game you still take the stairs sideways. The ache that used to be gone overnight now lasts until the weekend.',
    ),
    icon: '🦵',
    choices: [
      {
        label: t('Özel fizyoterapist tut ({physio})', 'Hire a private physio ({physio})'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'physio')),
        lockedHint: t('Bunun için nakdin yetmiyor.', 'Not enough cash for this.'),
        effects: (ctx) => fx(t('Her sabah yarım saat masaj ve mobilite. Bacakların sana teşekkür ediyor.', 'Half an hour of massage and mobility every morning. Your legs are grateful.'),
          money(-num(ctx, 'physio')), fatigue(-12), health(6)),
      },
      {
        label: t('Gece hayatını tamamen kes', 'Cut out nights out completely'),
        effects: () => fx(t('Saat onda yatakta, sabah altıda havuzda. Sıkıcı ama işe yarıyor.', 'In bed by ten, in the pool by six. Boring, but it works.'), fatigue(-8), happy(-5), health(4)),
      },
      {
        label: t('"Yaş sadece bir sayı"', '"Age is just a number"'),
        risk: 'medium',
        hint: t('Vücudun bu fikre katılmayabilir.', 'Your body may disagree.'),
        effects: () => fx(t('Antrenmanda herkesten çok koştun. Akşam buz torbası iki taneydi.', 'You outran everyone in training. In the evening there were two ice packs.'), fatigue(8), morale(3), trust(2)),
      },
    ],
  },
  {
    id: 'manager.veteran_rotation',
    category: 'manager',
    weight: 1.2,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 31 && hasClub(state) && starter(state),
    title: t('Rotasyon Konuşması', 'The Rotation Talk'),
    text: t(
      '{managerName} seni odasına çağırdı: "Seni sezon sonuna sağlam getirmek istiyorum. Kupa maçlarında dinlenmeye ne dersin?"',
      '{managerName} called you in: "I want you fit at the end of the season. How about resting in the cup games?"',
    ),
    icon: '🔄',
    choices: [
      {
        label: t('"Haklısın hocam"', '"You\'re right, boss"'),
        effects: () => fx(t('{managerName} rahatladı. Kupa maçlarında kenardan izleyip gençlere bağıracaksın.', '{managerName} looked relieved. You\'ll shout at the kids from the bench in cup games.'), trust(5), boss(5), fatigue(-10), morale(-3)),
      },
      {
        label: t('"Her maç oynamak istiyorum"', '"I want to play every game"'),
        risk: 'medium',
        effects: () => fx(t('"Peki. Ama yorulduğunu görürsem çıkarırım." Gözünü senden ayırmıyor.', '"Fine. But if I see you tiring, you\'re coming off." He is watching you closely.'), trust(-3), boss(-3), morale(4), fatigue(5)),
      },
      {
        label: t('"Gençlere ben yardım edeyim"', '"Let me help the youngsters"'),
        effects: () => fx(t('Kupa maçlarında kenarda değil, ısınma alanında gençlerle olacaksın. {managerName} not aldı.', 'In cup games you\'ll be with the kids in the warm-up area, not just on the bench. {managerName} took note.'), trust(4), attr('leadership', 1), rel('teammate', 3), fatigue(-6)),
      },
    ],
  },
  {
    id: 'mentor.young_rival',
    category: 'mentor',
    weight: 1.2,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 29 && hasClub(state),
    vars: ({ state }, rng) => ({ kid: pickPlayerFull(state, rng) }),
    title: t('Formanı İsteyen Genç', 'The Kid Who Wants Your Shirt'),
    text: t(
      'A takıma çıkan 19 yaşındaki {kid} senin mevkinde oynuyor ve antrenmanda herkesi geçiyor. Basın şimdiden "nöbet değişimi" yazıyor.',
      'Nineteen-year-old {kid} has come up to the first team, plays in your position and is beating everyone in training. The press is already writing about "the changing of the guard".',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('Onu kanatlarının altına al', 'Take the kid under your wing'),
        effects: () => fx(t('Antrenmandan sonra kaldın, ona bildiğin hileleri gösterdin. {kid} sana artık "{g:abi|abla}" diyor.', 'You stayed late and showed the kid every trick you know. {kid} looks up to you now.'),
          attr('leadership', 1), trust(4), rel('teammate', 5), happy(3), fatigue(3)),
      },
      {
        label: t('Sahada cevap ver', 'Answer on the pitch'),
        effects: () => fx(t('Antrenmanda her topa ilk sen gittin. Gençle aranızda kıyasıya bir rekabet var artık.', 'You got to every ball first in training. There\'s a fierce rivalry between you two now.'), sharp(5), fatigue(6), morale(2), rel('teammate', -2)),
      },
      {
        label: t('Basına "Formam kimseye emanet değil" de', 'Tell the press "My shirt belongs to no one else"'),
        risk: 'medium',
        effects: () => fx(t('Söz manşet oldu. {managerName} genç oyuncusunu korumak için seni uyardı.', 'The line made headlines. {managerName} warned you, protecting his young player.'), fans(3), boss(-4), trust(-3), press(3),
          news(t('{heroName}: "Formam kimseye emanet değil"', '{heroName}: "My shirt belongs to no one else"'), 0)),
      },
    ],
  },
  {
    id: 'press.pundit_audition',
    category: 'press',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 31 && state.hero.reputation >= 45,
    vars: ({ state }) => ({ fee: nice(Math.max(3_000, state.hero.reputation * 200)) }),
    title: t('Stüdyoda Bir Sandalye', 'A Seat in the Studio'),
    text: t(
      'Bir spor kanalı derbi gecesi için konuk yorumcu arıyor. Ücret {fee}. Yapımcı fısıldıyor: "Biraz sert konuşursan reyting uçar."',
      'A sports channel wants a guest pundit for derby night. The fee is {fee}. The producer whispers: "Be a little harsh and the ratings fly."',
    ),
    icon: '🎙️',
    choices: [
      {
        label: t('Sert ve dürüst konuş', 'Be harsh and honest'),
        risk: 'medium',
        effects: (ctx) => fx(t('Yorumların kesilip paylaşıldı. Eleştirdiğin oyunculardan biri seni takipten çıktı.', 'Your clips went everywhere. One of the players you criticised unfollowed you.'), money(num(ctx, 'fee')), fol(4_000), press(4), rel('teammate', -3), stress(3)),
      },
      {
        label: t('Teknik ve sakin anlat', 'Keep it calm and technical'),
        effects: (ctx) => fx(t('Tahtada çizdiğin hücum varyasyonu çok beğenildi. Kanal "Emekli olunca bizi ara" dedi.', 'The attacking pattern you drew on the board went down well. The channel said: "Call us when you retire."'), money(num(ctx, 'fee')), press(3), attr('vision', 1), flags({ pundit_contact: true })),
      },
      {
        label: t('Reddet: "Daha oynuyorum"', 'Decline: "I\'m still playing"'),
        effects: () => fx(t('Yapımcı numaranı rehberde tuttu.', 'The producer kept your number.'), trust(2)),
      },
    ],
  },
  {
    id: 'family.when_stop',
    category: 'family',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 32,
    title: t('"Ne Zaman Bırakacaksın?"', '"When Will You Stop?"'),
    text: t(
      'Bayram sofrasında herkes sustu ve annen o soruyu sordu: "Ne zaman bırakacaksın? Dizlerini düşünüyorum." Bütün gözler sende.',
      'At the holiday table everyone went quiet and your mum asked the question: "When will you stop? I worry about your knees." All eyes are on you.',
    ),
    icon: '🍽️',
    choices: [
      {
        label: t('"Bir sezon daha, söz"', '"One more season, I promise"'),
        effects: () => fx(t('Annen başını salladı ama gülümsemedi. Babanın gözleri dolu.', 'Your mum nodded but didn\'t smile. Your dad\'s eyes were wet.'), rel('mother', 2), morale(3)),
      },
      {
        label: t('"Bacaklarım söylediği sürece oynayacağım"', '"As long as my legs say yes"'),
        effects: () => fx(t('Masada kahkaha koptu. Kuzenin "Bacaklar çoktan emekli" diye takıldı.', 'The table burst out laughing. Your cousin joked that the legs retired long ago.'), happy(4), stress(-3)),
      },
      {
        label: t('"Aslında ben de düşünüyorum"', '"Actually, I\'ve been thinking about it"'),
        effects: () => fx(t('Sessizlik. Sonra annen elini tuttu. İlk kez yüksek sesle söyledin.', 'Silence. Then your mum took your hand. It\'s the first time you\'ve said it out loud.'), rel('mother', 6), rel('father', 4), stress(-6), morale(-3)),
      },
    ],
  },
  {
    id: 'fans.away_applause',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 30,
    maxPerCareer: 2,
    triggers: ['post_match'],
    conditions: ({ state }) => age(state) >= 33 && hasClub(state) && state.hero.reputation >= 50,
    title: t('Rakip Tribünden Alkış', 'Applause from the Away End'),
    text: t(
      'Oyundan çıkarken rakip tribün ayağa kalkıp seni alkışladı. Yıllarca sana ıslık çalan insanlar bunlar. Pankartta "Son kez buradasın, sağ ol" yazıyor.',
      'As you were subbed off the home end rose and applauded you. These people have whistled at you for years. A banner reads "Your last time here. Thank you."',
    ),
    icon: '👏',
    choices: [
      {
        label: t('Tribüne dön, elini kalbine koy', 'Turn to them, hand on heart'),
        effects: () => fx(t('Görüntü bütün ülkede paylaşıldı. Kendi taraftarın bile bu kez kızmadı.', 'The clip was shared across the country. Even your own fans didn\'t mind this time.'), happy(8), fans(4), rep(1), news(t('Rakip tribünden {heroName} için ayakta alkış', 'Standing ovation for {heroName} from rival fans'), 1)),
      },
      {
        label: t('Formanı tribüne at', 'Throw your shirt into the crowd'),
        effects: () => fx(t('Formayı bir çocuk yakaladı. Kulübün malzemecisi sana ters ters baktı.', 'A kid caught the shirt. The kit man gave you a look.'), happy(6), fans(3), fol(2_000)),
      },
    ],
  },
  {
    id: 'teammates.dressing_room_elder',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 3,
    conditions: ({ state }) => age(state) >= 29 && hasClub(state) && state.hero.reputation >= 40,
    title: t('Soyunma Odasının {g:Abisi|Ablası}', 'The Dressing-Room Elder'),
    text: t(
      'İki genç takım arkadaşın kapıda: biri ilk büyük sözleşmesini imzalayacak, diğeri bir menajerle anlaşmak üzere. "Sen olsan ne yapardın?"',
      'Two young teammates at your door: one is about to sign a first big contract, the other about to sign with an agent. "What would you do?"',
    ),
    icon: '🧭',
    choices: [
      {
        label: t('Oturup her şeyi anlat', 'Sit them down and tell them everything'),
        effects: () => fx(t('Gece yarısına kadar konuştunuz: vergiler, menajerler, sahte dostlar. Ertesi gün ikisi de sana kahve getirdi.', 'You talked until midnight: taxes, agents, fake friends. The next day both brought you coffee.'), rel('teammate', 7), attr('leadership', 1), fatigue(3), happy(4)),
      },
      {
        label: t('Kendi menajerine yönlendir', 'Send them to your own agent'),
        effects: () => fx(t('{agentName} sevindi: "İki yeni müşteri!" Gençler biraz bozuldu; senden akıl istemişlerdi.', '{agentName} was thrilled: "Two new clients!" The kids were a little disappointed; they wanted your advice.'), rel('agent', 5), rel('teammate', 1)),
      },
      {
        label: t('"Bunlar beni ilgilendirmez"', '"Not my business"'),
        effects: () => fx(t('Kapı kapandı. Soyunma odasında birkaç kişi sana artık daha mesafeli.', 'The door closed. A few people in the dressing room keep a bit more distance now.'), rel('teammate', -4), stress(-2)),
      },
    ],
  },

  {
    id: 'club.last_dance',
    category: 'club',
    weight: 1.2,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    minWeek: 4,
    conditions: ({ state }) => age(state) >= 33 && hasClub(state),
    title: t('Son Dans mı?', 'The Last Dance?'),
    text: t(
      '{chairmanName} seni yemeğe çağırdı: "Bu sezonu bir veda sezonuna çevirmek istiyoruz. Her deplasmanda bir tören, son maçta dolu bir stat. Ama karar senin."',
      '{chairmanName} invited you to dinner: "We\'d like to make this a farewell season. A ceremony at every away ground, a full house for the last game. But it\'s your call."',
    ),
    icon: '🕯️',
    choices: [
      {
        label: t('Veda sezonunu ilan et', 'Announce the farewell season'),
        effects: () => fx(t('Açıklama gece yarısı yapıldı. Sabah stadın önünde mum yakan taraftarlar vardı.', 'The announcement went out at midnight. By morning fans were lighting candles outside the stadium.'),
          fans(10), happy(6), stress(-4), rel('chairman', 6), flags({ farewell_season: true }), news(t('{heroName} veda sezonunu açıkladı', '{heroName} announces farewell season'), 1)),
      },
      {
        label: t('"Henüz bitmedi"', '"It\'s not over yet"'),
        effects: () => fx(t('{chairmanName} gülümsedi: "Ben de öyle düşünmüştüm." Hesap ödenirken ikiniz de sustunuz.', '{chairmanName} smiled: "I thought you\'d say that." Neither of you spoke while the bill was paid.'), morale(5), rel('chairman', -2)),
      },
      {
        label: t('Kararı sezon sonuna bırak', 'Decide at the end of the season'),
        effects: () => fx(t('Konu kapandı, tatlılar geldi. Ama soru aklında.', 'The topic was dropped and dessert arrived. The question stays with you, though.'), stress(2)),
      },
    ],
  },
  {
    id: 'health.cartilage_scan',
    category: 'health',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    conditions: ({ state }) => age(state) >= 31 && hasClub(state),
    vars: ({ state }) => ({ cost: nice(Math.max(8_000, (state.hero.contract?.wage ?? 2_000) * 3)) }),
    title: t('MR Sonuçları', 'The Scan Results'),
    text: t(
      'Rutin taramada dizinde kıkırdak aşınması çıktı. Doktor: "Şimdilik sorun yok ama bundan sonra her yük birikecek." Önünde üç yol var.',
      'A routine scan shows cartilage wear in your knee. The doctor: "No problem yet, but from now on every load adds up." There are three ways forward.',
    ),
    icon: '🩻',
    choices: [
      {
        label: t('Özel tedavi programı ({cost})', 'A private treatment programme ({cost})'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'cost')),
        lockedHint: t('Bunun için nakdin yetmiyor.', 'Not enough cash for this.'),
        effects: (ctx) => fx(t('Haftada iki seans, enjeksiyon ve kuvvet çalışması. Diz artık daha sessiz.', 'Two sessions a week, injections and strength work. The knee is quieter now.'), money(-num(ctx, 'cost')), health(8), fatigue(-6)),
      },
      {
        label: t('Antrenman yükünü azalt', 'Cut your training load'),
        effects: () => fx(t('Sprint serilerini gençlere bıraktın. Dizin rahat, maç temposu biraz düştü.', 'You left the sprint sets to the kids. Knee happy, match sharpness slightly down.'), fatigue(-8), sharp(-4)),
      },
      {
        label: t('Kimseye söyleme, oynamaya devam', 'Tell no one and keep playing'),
        risk: 'high',
        effects: (_ctx, rng) => rng.chance(0.35)
          ? fx(t('Bir hafta sonra diz şişti. Sağlık ekibi her şeyi öğrendi.', 'A week later the knee swelled up. The medical staff found out everything.'), injury(3, t('Diz kıkırdağı iltihabı', 'Knee cartilage inflammation')), trust(-3))
          : fx(t('Şimdilik tutuyor. Her sabah ilk adımda bir sızı.', 'It holds, for now. A twinge with every first step in the morning.'), morale(2), stress(3)),
      },
    ],
  },

  // ───────────── National regulars ─────────────
  {
    id: 'national.international_retirement',
    category: 'national',
    weight: 1.5,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    triggers: ['national_break', 'weekly'],
    conditions: ({ state }) => age(state) >= 31 && caps(state) >= 10 && !hasFlag(state, 'nt_retired'),
    title: t('Milli Takıma Veda?', 'Retire from International Football?'),
    text: t(
      '{caps} milli maçtan sonra vücudun her kampta biraz daha bağırıyor. {managerName} imalı konuşuyor: "Kulübe daha çok lazımsın." Milli takım hocası ise "Turnuvada seni istiyorum" diyor.',
      'After {caps} caps your body screams a little louder at every camp. {managerName} hints: "The club needs you more." The national coach says: "I want you at the tournament."',
    ),
    vars: ({ state }) => ({ caps: caps(state) }),
    icon: '🎽',
    choices: [
      {
        label: t('Milli takımı bırak', 'Retire from the national team'),
        hint: t('Bir daha A Milli Takım\'a çağrılmazsın; kulüpte daha dinç olursun.', 'No more senior call-ups; you\'ll be fresher for your club.'),
        effects: () => fx(t('Açıklamanı yazarken elin titredi. Son satır: "Bu formayı taşımak hayatımın onuruydu."', 'Your hand shook as you wrote the statement. Last line: "Wearing this shirt was the honour of my life."'),
          trust(5), boss(5), fatigue(-10), fans(-2), flags({ nt_retired: true }), news(t('{heroName} milli takımı bıraktı', '{heroName} retires from international football'), 0)),
      },
      {
        label: t('"Ülkem çağırdıkça gelirim"', '"I\'ll come whenever my country calls"'),
        effects: () => fx(t('Milli takım hocası mesaj attı: "Biliyordum." {managerName} yalnızca iç çekti.', 'The national coach texted: "Knew it." {managerName} just sighed.'), fans(3), boss(-2), morale(3)),
      },
    ],
  },

  // ───────────── Legacy (New Game+) careers ─────────────
  {
    id: 'family.legacy_shadow',
    category: 'family',
    weight: 2,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => isLegacy(state) && hasClub(state),
    vars: ({ state }) => ({ legend: legacyParent(state) }),
    title: t('Efsanenin Gölgesi', 'In the Legend\'s Shadow'),
    text: t(
      'Maç sonu bir muhabir mikrofonu uzattı: "{legend} senin yaşındayken çoktan bir yıldızdı. Bu yük ağır gelmiyor mu?"',
      'After the game a reporter thrust a mic at you: "{legend} was already a star at your age. Isn\'t the weight too much?"',
    ),
    icon: '🧬',
    choices: [
      {
        label: t('"Onun adını taşımak bir onur"', '"Carrying that name is an honour"'),
        effects: ({ state }) => fx(t('Akşam telefonun çaldı: "{legend}" yazıyordu. Tek kelime: "Gurur duydum."', 'Your phone rang that evening: "{legend}". Two words: "So proud."'), rel(parentKind(state), 6), press(3), stress(2)),
      },
      {
        label: t('"Ben {heroFirst}\'im, başka biri değil"', '"I\'m {heroFirst}, not someone else"'),
        effects: ({ state }) => fx(t('Söz manşet oldu. Bir kısmı cesur buldu, bir kısmı saygısız.', 'The line made headlines. Some called it brave, others disrespectful.'), morale(5), rel(parentKind(state), -3), press(-1),
          news(t('{heroName}: "Ben başka biri değilim"', '{heroName}: "I\'m not someone else"'), 0)),
      },
      {
        label: t('Gülümse: "Bir de evde onu dinleyin"', 'Smile: "Try listening to it at home"'),
        effects: () => fx(t('Muhabirler güldü. Haber sevimli bir anekdot olarak çıktı.', 'The reporters laughed. It ran as a sweet anecdote.'), press(4), happy(3)),
      },
    ],
  },
  {
    id: 'family.legacy_advice',
    category: 'family',
    weight: 1.5,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => isLegacy(state),
    vars: ({ state }) => ({ legend: legacyParent(state) }),
    title: t('Efsaneden Bir Ders', 'A Lesson from the Legend'),
    text: t(
      '{legend} antrenman görüntülerini izlemiş ve bir liste hazırlamış: "Vücudunu kötü açıyorsun, ilk dokunuşun ağır." Pazar sabahı sahada buluşmak istiyor.',
      '{legend} has watched your training footage and made a list: "Your body shape is wrong and your first touch is heavy." Wants to meet at the pitch on Sunday morning.',
    ),
    icon: '🧬',
    choices: [
      {
        label: t('Pazar sabahı sahada ol', 'Be at the pitch on Sunday morning'),
        effects: ({ state }) => fx(t('İki saat aynı hareketi tekrarladınız. Sonunda tek bir söz: "İşte bu."', 'Two hours of the same drill. At the end, just two words: "That\'s it."'), attr('firstTouch', 1), rel(parentKind(state), 6), fatigue(6)),
      },
      {
        label: t('"Kendi yolumu bulmalıyım"', '"I need to find my own way"'),
        effects: ({ state }) => fx(t('Telefonda kısa bir sessizlik oldu. "Haklısın. Ama listeyi sakla."', 'A short silence on the phone. "You\'re right. But keep the list."'), morale(4), rel(parentKind(state), -2)),
      },
    ],
  },
]
