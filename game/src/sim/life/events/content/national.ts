/** National team: call-ups, anthems, armbands and club-versus-country dilemmas. */
import { boss, canAfford, disc, fans, fatigue, flags, follow, form, fx, happy, hasClub, hasFlag, injury, money, morale, news, num, pickFull, press, rel, rep, stress, t, chain, trust, wageX, attr, folPct } from '../dsl'
import type { GameState } from '../../../../core/types'
import type { EventDef } from '../types'

/** Has the hero been capped/called (core field or event flag)? */
const called = (s: GameState): boolean => s.hero.nationalTeam.called || hasFlag(s, 'nt_called')

export const nationalEvents: EventDef[] = [
  {
    id: 'national.first_callup',
    category: 'national',
    weight: 2,
    cooldownWeeks: 0,
    once: true,
    triggers: ['national_break', 'weekly', 'match_win'],
    conditions: ({ state }) => !called(state) && state.hero.reputation >= 40,
    title: t('Telefon Çaldı', 'The Phone Rings'),
    text: t(
      'Bilinmeyen numara. "Milli takım teknik heyetinden arıyoruz. Aday kadrodasın." Elin titriyor; annen arka odadan "Kim o?" diye sesleniyor.',
      'Unknown number. "This is the national team staff. You are in the provisional squad." Your hand is shaking; your mum calls from the back room: "Who is it?"',
    ),
    icon: '📞',
    choices: [
      {
        label: t('"Annee! Milli oldum!"', '"Mum! I\'ve been called up!"'),
        effects: () => fx(t('Annen mutfaktan koşarak geldi, oklava hâlâ elinde. Bu anı hiç unutmayacaksın.', 'Mum ran out of the kitchen, rolling pin still in hand. You will never forget this moment.'), happy(12), rel('mother', 10), rep(4), morale(10), flags({ nt_called: true }),
          news(t('{heroName} ilk kez milli takımda', '{heroName} earns first national call-up'), 1)),
      },
      {
        label: t('Sosyal medyada paylaş', 'Announce it on social media'),
        effects: (ctx) => fx(t('Formayla fotoğrafın yarım saatte gündem oldu. Bazı eski hocaların da beğendi.', 'Your photo in the shirt trended within half an hour. Even a few old coaches liked it.'), folPct(ctx, 12), rep(4), happy(8), flags({ nt_called: true })),
      },
      {
        label: t('Kulübe odaklanmak için reddet', 'Decline to focus on your club'),
        hint: t('Nadir bir karar. Unutulmaz.', 'A rare call. It will be remembered.'),
        risk: 'medium',
        effects: () => fx(t('{managerName} şaşırdı ama memnun. Ülkede ise tartışma büyük.', '{managerName} is surprised but pleased. Back home, the debate is fierce.'), trust(8), boss(6), rep(-4), fans(-6), press(-5),
          news(t('{heroName} milli davete "hayır" dedi', '{heroName} turns down national call-up'), -1)),
      },
    ],
  },
  {
    id: 'national.anthem',
    category: 'national',
    weight: 1.2,
    cooldownWeeks: 20,
    triggers: ['national_break'],
    conditions: ({ state }) => called(state),
    title: t('Marş Okunurken', 'During the Anthem'),
    text: t(
      'Tünelden çıktın, kameralar sırayla yüzlere yaklaşıyor. Birkaç saniye sonra sıra sende.',
      'Out of the tunnel, cameras panning down the line, face by face. In a few seconds it is your turn.',
    ),
    icon: '🎶',
    choices: [
      {
        label: t('Avazın çıktığı kadar söyle', 'Belt it out'),
        effects: (ctx) => fx(t('Sesin biraz çatallandı ama yüreğin doğru yerdeydi. O görüntü her yerde.', 'Your voice cracked a little but your heart was in the right place. The clip is everywhere.'), fans(6), folPct(ctx, 4), morale(6)),
      },
      {
        label: t('Gözlerini kapat, sessizce yaşa', 'Close your eyes, live it quietly'),
        effects: () => fx(t('Sessiz bir an. Kimse fark etmedi ama sen her notayı hissettin.', 'A quiet moment. Nobody noticed, but you felt every note.'), attr('composure', 1), stress(-4)),
      },
      {
        label: t('Kameraya göz kırp', 'Wink at the camera'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Göz kırpma "yılın en havalı anı" seçildi.', 'The wink was voted "coolest moment of the year".'), rep(3), happy(4))
            : fx(t('Yorumcular "saygısızlık" dedi. Sabah programları seni konuşuyor.', 'Pundits called it disrespectful. The breakfast shows are talking about you.'), press(-6), fans(-4), stress(5)),
      },
    ],
  },
  {
    id: 'national.captain_armband',
    category: 'national',
    weight: 1,
    cooldownWeeks: 0,
    once: true,
    triggers: ['national_break'],
    conditions: ({ state }) => called(state) && state.hero.reputation >= 65,
    vars: (_ctx, rng) => ({ veteran: pickFull(rng) }),
    title: t('Pazubandı', 'The Armband'),
    text: t(
      'Milli takım hocası seni odasına çağırdı: "Kaptan {veteran} sakat. Pazubandını sana vermek istiyorum. Ama o yarın kampa gelecek ve kimse ona söylemedi."',
      'The national coach calls you in: "Captain {veteran} is injured. I want you to wear the armband. But he arrives at camp tomorrow and nobody has told him yet."',
    ),
    icon: '🫡',
    choices: [
      {
        label: t('Kabul et', 'Accept'),
        effects: () => fx(t('Pazubandını takarken kolun ağırlaştı sandın. Takım seni dinliyor.', 'Your arm felt heavier as you pulled the armband on. The squad listens to you.'), attr('leadership', 2), rep(5), morale(8), flags({ nt_captain: true })),
      },
      {
        label: t('Önce {veteran} ile konuşayım', 'Let me talk to {veteran} first'),
        effects: (_ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('{veteran} gözlerin içine baktı: "Bunu sen hak ettin." Kucaklaştınız.', '{veteran} looked you in the eye: "You\'ve earned it." You embraced.'), attr('leadership', 2), rep(4), happy(6), flags({ nt_captain: true }))
            : fx(t('{veteran} soğuk davrandı. Pazubandı sende ama kampta bir gerginlik var.', '{veteran} was frosty. The armband is yours, but camp feels tense.'), attr('leadership', 1), rep(3), stress(6), flags({ nt_captain: true })),
      },
      {
        label: t('Kibarca reddet, {veteran} dönene kadar beklesin', 'Decline; keep it warm for {veteran}'),
        effects: () => fx(t('Hoca şaşırdı, kıdemliler etkilendi. "Bu çocukta karakter var" diyorlar.', 'The coach was surprised, the veterans impressed. "That lad has character," they say.'), disc(4), happy(-2), press(3)),
      },
    ],
  },
  {
    id: 'national.club_vs_country',
    category: 'national',
    weight: 1.2,
    cooldownWeeks: 16,
    triggers: ['national_break'],
    conditions: ({ state }) => called(state) && hasClub(state),
    title: t('Kulüp mü, Ülke mi?', 'Club or Country?'),
    text: t(
      'Kasığında hafif bir ağrı var. {managerName} arayıp "Kampa gitme, burada tedavi olalım" diyor. Milli takım doktoru ise "Gel, bir bakalım" diyor.',
      'There is a slight ache in your groin. {managerName} calls: "Skip camp, get treated here." The national team doctor says: "Come in, let\'s take a look."',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Kampa git, ülke çağırıyor', 'Go to camp, the country calls'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('İki maç oynadın, ağrı geçti. {managerName} bir hafta seninle konuşmadı.', 'You played twice and the ache faded. {managerName} gave you the silent treatment for a week.'), rep(3), fans(3), boss(-6), trust(-4))
            : fx(t('İkinci maçta sakatlık büyüdü. Kulübe koltuk değnekleriyle döndün.', 'It worsened in the second game. You returned to the club on crutches.'), injury(4, t('Kasık sakatlığı', 'Groin strain')), boss(-10), trust(-6), stress(8)),
      },
      {
        label: t('Kulübü dinle, kamptan çekil', 'Listen to the club and withdraw'),
        effects: () => fx(t('Kulüp memnun. Milli takım çevresinde "kulübünü seçti" fısıltıları.', 'The club is happy. Around the national setup there are whispers: "He chose his club."'), trust(5), boss(5), fans(-4), press(-3)),
      },
      {
        label: t('Kampa git, durumunu açıkça söyle', 'Go to camp and be honest about it'),
        effects: () => fx(t('Doktor seni bir maç dinlendirdi. İki taraf da makul buldu. Herkes biraz mutlu, kimse tam değil.', 'The doctor rested you for one game. Both sides found it reasonable. Everyone a bit happy, nobody fully.'), fatigue(-4), boss(-1), disc(2)),
      },
    ],
  },
  {
    id: 'national.roommate_prank',
    category: 'national',
    weight: 1,
    cooldownWeeks: 24,
    triggers: ['national_break'],
    conditions: ({ state }) => called(state),
    vars: (_ctx, rng) => ({ roomie: pickFull(rng) }),
    title: t('Kamp Odası Savaşları', 'Camp Room Wars'),
    text: t(
      'Kamp odasına döndüğünde yatağının tamamen streç filmle sarıldığını gördün. Oda arkadaşın {roomie} masum masum kitap okuyor. Ters tutarak.',
      'Back in your camp room, your bed is completely wrapped in cling film. Roommate {roomie} is innocently reading a book. Upside down.',
    ),
    icon: '🛏️',
    choices: [
      {
        label: t('İntikam planla', 'Plot revenge'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('{roomie} sabah duş başlığından mavi suyla yıkandı. Kamp efsanesi oldun.', '{roomie} showered in blue water next morning. You are now camp legend.'), happy(6), morale(4))
            : fx(t('İntikam yanlış odaya gitti: teknik direktörün. Ceza koşusu.', 'The revenge hit the wrong room: the head coach\'s. Punishment laps.'), disc(-5), fatigue(8), happy(2)),
      },
      {
        label: t('Gül, filmi aç, uyu', 'Laugh, unwrap, sleep'),
        effects: () => fx(t('"Hoş geldin" şakası buymuş. Artık gruptansın.', 'Turns out that\'s the welcome prank. You are one of the group now.'), happy(3), stress(-3)),
      },
      {
        label: t('Fotoğrafı paylaş', 'Post the photo'),
        effects: (ctx) => fx(t('Fotoğraf viral oldu. Federasyon basın sorumlusu biraz gergin.', 'The photo went viral. The federation press officer is a bit tense.'), folPct(ctx, 6), disc(-2), happy(3)),
      },
    ],
  },
  {
    id: 'national.coach_dispute',
    category: 'national',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['national_break'],
    conditions: ({ state }) => called(state) && state.hero.position !== 'GK',
    title: t('Yanlış Mevki', 'Wrong Position'),
    text: t(
      'Milli takım hocası seni yine sol beke yazdı. "Ülkene hizmet her mevkide olur" diyor. Sen ise kulübünde hiç bek oynamadın.',
      'The national coach has you at left-back again. "You can serve your country in any position," he says. You have never played full-back in your life.',
    ),
    icon: '🧩',
    choices: [
      {
        label: t('Sessizce oyna', 'Play without complaint'),
        effects: () => fx(t('Bir koşu fazla attın, bir ortayı kestin. Hoca memnun, sen değil.', 'You put in the miles and blocked a cross. The coach is pleased; you are not.'), attr('tackling', 1), happy(-4), disc(3)),
      },
      {
        label: t('Kapalı kapılar ardında konuş', 'Raise it behind closed doors'),
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Hoca dinledi; bir sonraki maç kendi mevkindesin.', 'He listened. Next game, you are in your real position.'), happy(5), form(3))
            : fx(t('"Kadroda olmak istemiyorsan söyle" dedi. Konuşma kısa sürdü.', '"If you don\'t want to be here, say so," he said. Short meeting.'), stress(6), happy(-3)),
      },
      {
        label: t('Basına söyle', 'Tell the press'),
        risk: 'high',
        effects: () => fx(t('Manşetler patladı. Bir sonraki kadroda adın yok.', 'Headlines exploded. Your name is missing from the next squad.'), press(5), rep(-2), stress(8), flags({ nt_called: null }),
          news(t('{heroName}: "Ben bek değilim!"', '{heroName}: "I\'m not a full-back!"'), -1)),
      },
    ],
  },
  {
    id: 'national.squad_announcement',
    category: 'national',
    weight: 1.5,
    cooldownWeeks: 40,
    triggers: ['season_end', 'national_break'],
    conditions: ({ state }) => called(state),
    title: t('Turnuva Kadrosu Açıklanıyor', 'Tournament Squad Announcement'),
    text: t(
      'Büyük turnuvanın kadrosu canlı yayında okunuyor. Ailen salonda, telefonun elinde. İsimler alfabetik...',
      'The tournament squad is being read out live. Your family is in the living room, phone in your hand. The names are alphabetical...',
    ),
    icon: '📺',
    choices: [
      {
        label: t('İzle, nefesini tut', 'Watch and hold your breath'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('Adın okundu! Salonda kıyamet koptu. Turnuvaya gidiyorsun.', 'Your name! The living room erupts. You are going to the tournament.'), happy(12), rep(3), rel('father', 6), follow(chain('national.tournament_moment', 2)))
            : fx(t('Adın yok. Babanın elini omzunda hissettin. "Bir dahakine" dedi.', 'Not there. You felt your dad\'s hand on your shoulder. "Next time," he said.'), happy(-10), stress(6), rel('father', 6)),
      },
      {
        label: t('Telefonu kapat, antrenmana çık', 'Switch off and go training'),
        effects: (_ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('Döndüğünde 47 cevapsız arama vardı. Seçilmişsin!', 'You returned to 47 missed calls. You\'re in!'), happy(10), attr('workRate', 1), follow(chain('national.tournament_moment', 2)))
            : fx(t('Haberi bir taraftar mesajından öğrendin. Ama bir set fazla şut çalıştın.', 'A fan\'s message broke the news. Still, you got an extra set of shooting practice in.'), happy(-6), attr('workRate', 1)),
      },
    ],
  },
  {
    id: 'national.tournament_moment',
    category: 'national',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ amount: wageX(state, 1, 1000) }),
    title: t('Turnuvanın Gecesi', 'Tournament Night'),
    text: t(
      'Grup maçı öncesi otelde son gece. Memleketinde dev ekran kurulacak; belediye senden bir video mesaj, kulüp arkadaşların da bir akşam yemeği daveti istiyor. Hoca ise erken yat diyor.',
      'Last night at the hotel before the group game. Your hometown is putting up a giant screen and wants a video message; teammates want a dinner. The coach says early night.',
    ),
    icon: '🏟️',
    choices: [
      {
        label: t('Memlekete video mesaj', 'Record a message for home'),
        effects: () => fx(t('Mahalle meydanında video oynatıldı, bakkal Hüsnü Amca ağladı.', 'The video played in the town square. Old Hüsnü from the corner shop cried.'), fans(8), rep(3), happy(5)),
      },
      {
        label: t('Memlekete forma ve dev ekran masrafı gönder', 'Pay for shirts and the big screen back home'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bütçe yetmiyor.', 'Not enough money.'),
        effects: (ctx) => fx(t('Bütün mahalle senin numaranla tezahürat yaptı.', 'The whole neighbourhood chanted your number.'), money(-num(ctx, 'amount')), fans(12), rep(4), happy(6),
          news(t('{heroName} memleketine dev ekran hediye etti', '{heroName} gifts big screen to hometown'), 1)),
      },
      {
        label: t('Erken yat', 'Early night'),
        effects: () => fx(t('Dokuz saat uyku. Isınmada bacakların tüy gibi.', 'Nine hours of sleep. Your legs feel like feathers in the warm-up.'), fatigue(-12), form(5), trust(2)),
      },
    ],
  },
]
