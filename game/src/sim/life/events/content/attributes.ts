/**
 * Attribute-driven life (owner requirement: "every stat must matter in the player's life like a
 * real footballer"). Butterfly-effect cards whose conditions read the hero's numbered attributes
 * and whose outcomes feed back into them:
 *  - the manager's development plan on the role's weakest stat (objective 'dev_focus'),
 *  - Composure → penalty duty and big-match nerves, Leadership → the armband, dressing-room rows
 *    and mentoring, Aggression → cards, bans, "hard man" chants and columns,
 *  - Stamina / fatigue → the physio's rest-or-play call, conditioning and diet,
 *  - Vision / Passing → the playmaker label and the assist race, Work Rate → the pressing award,
 *  - Acceleration / Pace → races, banners and double-marking, and the first yard going at 30+,
 *  - scouts' reports and club style fit citing the hero's real strongest stats.
 *
 * Attribute names reach the text through per-language vars ({statTr} / {statEn}), so the Turkish
 * card says "Dayanıklılık 47" and the English one "Stamina 47".
 */
import type { AttributeKey, GameState } from '../../../../core/types'
import { ATTRIBUTE_NAMES } from '../../../career/progression'
import { signatureStrengths, statList, styleFit, styleKeyStat, weakestDevArea } from '../../../career/attributeLife'
import {
  age, attr, ban, boss, canAfford, disc, energy, fans, fatigue, flags, fol, form, fx, happy, hasClub, health, injury, money, morale, news,
  objective, press, rel, rep, sharp, stress, t, trust, wageX,
} from '../dsl'
import type { EventDef, EventVars } from '../types'

const A = (s: GameState, k: AttributeKey): number => s.hero.attrs[k]
const isGk = (s: GameState): boolean => s.hero.position === 'GK'
const role = (s: GameState): string => s.hero.contract?.role ?? 'reserve'
const starter = (s: GameState): boolean => ['starter', 'star', 'captain'].includes(role(s))
const club = (s: GameState) => (s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : undefined)

/** {statTr}/{statEn} = an attribute's name in each language, {v} = its value. */
const statVars = (s: GameState, k: AttributeKey, prefix = ''): EventVars => ({
  [`${prefix}statTr`]: ATTRIBUTE_NAMES[k].tr, [`${prefix}statEn`]: ATTRIBUTE_NAMES[k].en, [`${prefix}v`]: s.hero.attrs[k],
})
/** {strTr}/{strEn}: "Hızlanma 84, Hız 81 ve Önsezi 77". */
const strengthVars = (s: GameState): EventVars => {
  const l = statList(s.hero, signatureStrengths(s.hero))
  return { strTr: l.tr, strEn: l.en }
}
const weakKey = (s: GameState): AttributeKey => weakestDevArea(s.hero) ?? 'stamina'

const STYLE_TR: Record<string, string> = { possession: 'topa sahip olma', counter: 'kontra atak', direct: 'direkt', pressing: 'ön alan presi', defensive: 'savunma', balanced: 'dengeli' }
const STYLE_EN: Record<string, string> = { possession: 'possession', counter: 'counter-attacking', direct: 'direct', pressing: 'high-pressing', defensive: 'defensive', balanced: 'balanced' }

export const attributeEvents: EventDef[] = [
  // ───────────── The manager's development plan ─────────────
  {
    id: 'manager.attr_dev_plan',
    category: 'manager',
    weight: 1.2,
    cooldownWeeks: 26,
    minWeek: 3,
    conditions: ({ state }) => hasClub(state) && !state.hero.retired && weakestDevArea(state.hero) !== null && A(state, weakKey(state)) <= 72,
    triggers: ['weekly', 'training'],
    vars: ({ state }) => statVars(state, weakKey(state)),
    title: t('Hocanın Odasında Bir Dosya', 'A File on the Manager’s Desk'),
    text: t(
      'Hoca bir dosya uzattı. Rolündeki oyuncuların ortalamalarıyla seninkiler yan yana; bir satır kırmızıyla çizilmiş: {statTr} {v}. "Diğer her şeyin iyi. Ama bu satır seni bir üst seviyeden ayırıyor. Altı hafta veriyorum."',
      'The manager slid a file across. Your numbers next to the average for your role; one line is circled in red: {statEn} {v}. "Everything else is fine. But this line is what keeps you from the next level. I’m giving you six weeks."',
    ),
    icon: '📋',
    choices: [
      {
        label: t('Kabul: gelişim planı başlasın', 'Deal: start the development plan'),
        hint: t('Süreli hedef: başarırsan güven, kaçırırsan güven kaybı', 'Timed objective: trust if you make it, trust lost if you miss'),
        effects: () => fx(t('"Altı hafta," dedin. Hoca dosyayı kapattı ve ilk kez gülümsedi. Ekstra seanslar takvime işlendi.', '"Six weeks," you said. The manager closed the file and smiled for the first time. Extra sessions went into the diary.'), objective('dev_focus'), trust(2), boss(2)),
      },
      {
        label: t('Kendi cebinden birebir antrenör tut', 'Pay for one-to-one coaching yourself'),
        requires: ({ state }) => canAfford(state, wageX(state, 0.5, 1500)),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: ({ state }) => fx(t('Akşamları da çalıştın. Hoca bunu duyunca ekipmancıya "bu çocuğa bir dolap daha ver" dedi.', 'You worked evenings too. When the manager heard, he told the kit man to give you a second locker.'), money(-wageX(state, 0.5, 1500)), attr(weakKey(state), 1), objective('dev_focus'), trust(3)),
      },
      {
        label: t('"Ben böyle oynuyorum hocam"', '"This is how I play, boss"'),
        risk: 'medium',
        effects: () => fx(t('Hoca dosyayı çekmeceye kaldırdı. "Peki," dedi. Sesindeki soğukluk bir hafta sürdü.', 'The manager put the file in a drawer. "Fine," he said. The chill in his voice lasted a week.'), trust(-3), boss(-3), morale(-2)),
      },
    ],
  },
  {
    id: 'manager.attr_penalty_duty',
    category: 'manager',
    weight: 0.9,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && !isGk(state) && starter(state) && A(state, 'composure') >= 72 && A(state, 'finishing') >= 62,
    triggers: ['weekly', 'post_match'],
    vars: ({ state }) => ({ ...statVars(state, 'composure'), fin: A(state, 'finishing') }),
    title: t('Penaltı Kimde?', 'Who Takes the Penalties?'),
    text: t(
      'Penaltıcınız üst üste iki kez kaçırdı. Hoca antrenmanın sonunda topu sana attı: "{statTr} {v}, bitiricilik {fin}. Kâğıt üstünde en sakin adam sensin. Sorumluluğu istiyor musun?"',
      'Your penalty taker has missed two in a row. At the end of training the manager tossed you the ball: "{statEn} {v}, finishing {fin}. On paper you are the coolest head here. Do you want the job?"',
    ),
    icon: '🎯',
    choices: [
      {
        label: t('İstiyorum', 'I want it'),
        effects: ({ state }, rng) => rng.chance(0.35 + A(state, 'composure') / 200)
          ? fx(t('İlk penaltında kaleciyi ters köşeye yatırdın. Tribün adını bağırdı; artık noktanın sahibi sensin.', 'Your first penalty sent the keeper the wrong way. The stands chanted your name; the spot is yours now.'), morale(5), rep(1), fans(3), flags({ penalty_taker: true }), attr('composure', 1))
          : fx(t('İlkini direğe nişanladın. Çizginin dışına çıkarken hoca sakin kalmanı işaret etti: "Bir sonraki de senin."', 'You hit the post with your first. Walking back, the manager signalled calm: "The next one is yours too."'), morale(-2), stress(3), flags({ penalty_taker: true }), attr('composure', 1)),
      },
      {
        label: t('Kaptana bırak, ikinci sıradayım', 'Leave it to the captain; I’ll be second'),
        effects: () => fx(t('Kaptan omzuna vurdu. Soyunma odası bu jesti not etti.', 'The captain patted your shoulder. The dressing room noted the gesture.'), rel('teammate', 3), boss(1)),
      },
      {
        label: t('Önce bir hafta penaltı çalışayım', 'Give me a week of practice first'),
        effects: () => fx(t('Her antrenmandan sonra yirmi penaltı. Kaleciler bıktı ama ritmin oturdu.', 'Twenty penalties after every session. The keepers got sick of it, but your routine settled.'), attr('composure', 1), attr('finishing', 1), fatigue(4), trust(1)),
      },
    ],
  },
  {
    id: 'manager.attr_big_match_nerves',
    category: 'manager',
    weight: 0.9,
    cooldownWeeks: 30,
    minWeek: 6,
    conditions: ({ state }) => hasClub(state) && starter(state) && A(state, 'composure') < 55,
    triggers: ['weekly'],
    vars: ({ state }) => statVars(state, 'composure'),
    title: t('Büyük Maç Titremesi', 'Big-Match Shakes'),
    text: t(
      'Hafta sonu sezonun en büyük maçı. Son iki büyük gecede elin ayağına dolaştı; analist sessizce bir not düşmüş: "{statTr} {v}: baskı altında karar kalitesi düşüyor." Hoca bunu sana bıraktı.',
      'The biggest game of the season is this weekend. In the last two big nights your feet got tangled; the analyst quietly added a note: "{statEn} {v}: decision quality drops under pressure." The manager left it with you.',
    ),
    icon: '😰',
    choices: [
      {
        label: t('Spor psikoloğuyla çalış', 'Work with a sports psychologist'),
        requires: ({ state }) => canAfford(state, wageX(state, 0.3, 800)),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: ({ state }) => fx(t('Nefes, rutin, tek bir düşünce: "sonraki hareket". Maç günü kalbin hâlâ hızlıydı ama ellerin titremiyordu.', 'Breathing, a routine, one thought: "next action." On match day your heart still raced, but your hands were steady.'), money(-wageX(state, 0.3, 800)), attr('composure', 1), stress(-6)),
      },
      {
        label: t('Kafanı boşalt, sadece oyna', 'Clear your head and just play'),
        risk: 'medium',
        effects: ({ state }, rng) => rng.chance(0.3 + A(state, 'composure') / 200)
          ? fx(t('Düşünmedin, oynadın. İlk topu doğru verince gerisi geldi.', 'You didn’t think, you played. The first good pass settled everything else.'), morale(4), form(3))
          : fx(t('İlk dakikada kolay bir topu kaybettin ve maç boyunca o anı taşıdın.', 'You gave away an easy ball in the first minute and carried that moment all game.'), morale(-4), stress(5)),
      },
      {
        label: t('Kaptandan tecrübesini iste', 'Ask the captain how he copes'),
        effects: () => fx(t('"Ben de kusardım," dedi kaptan. "Sonra fark ettim: tribün beni değil, topu izliyor." Garip ama işe yaradı.', '"I used to throw up," the captain said. "Then I realised the stands watch the ball, not me." Odd, but it helped.'), rel('teammate', 3), stress(-3)),
      },
    ],
  },
  {
    id: 'manager.attr_armband_audition',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && starter(state) && role(state) !== 'captain' && age(state) >= 22 && A(state, 'leadership') >= 64,
    triggers: ['weekly', 'post_match'],
    vars: ({ state }) => statVars(state, 'leadership'),
    title: t('Pazubant Boşta', 'The Armband Is Free'),
    text: t(
      'Kaptan dört hafta yok. Hoca pazubandı masaya koydu: "Liderlik {v}. Soyunma odası seni dinliyor mu, görmek istiyorum. Maçtan önceki konuşmayı sen yap."',
      'The captain is out for four weeks. The manager put the armband on the table: "Leadership {v}. I want to see whether the dressing room listens to you. You give the pre-match talk."',
    ),
    icon: '©️',
    choices: [
      {
        label: t('Ayağa kalk ve konuş', 'Stand up and speak'),
        effects: ({ state }, rng) => rng.chance(0.2 + A(state, 'leadership') / 120)
          ? fx(t('Üç cümle, bir yumruk. Kimse gözünü kaçırmadı. Hoca kenarda başını salladı: "Bunu tekrar göreceğiz."', 'Three sentences and a fist on the table. No one looked away. On the touchline the manager nodded: "We’ll be seeing that again."'), morale(5), trust(4), rel('teammate', 4), attr('leadership', 1), flags({ stand_in_captain: true }))
          : fx(t('Sözler boğazında düğümlendi. Birkaç kıdemli göz göze geldi. Yine de bandı taktın; öğrenilecek çok şey var.', 'The words caught in your throat. A couple of senior players exchanged glances. You still wore the band; there is a lot to learn.'), stress(4), attr('leadership', 1)),
      },
      {
        label: t('Konuşmayı kıdemliye bırak, sahada önde ol', 'Let a senior talk; lead by example on the pitch'),
        effects: () => fx(t('Tek kelime etmedin ama ilk ikili mücadeleye sen girdin. Takım arkandan geldi.', 'You said nothing, but you went into the first duel. The team followed.'), attr('workRate', 1), rel('teammate', 2), boss(1)),
      },
      {
        label: t('"Henüz hazır değilim"', '"I’m not ready yet"'),
        effects: () => fx(t('Hoca bandı geri aldı. "Dürüst cevap," dedi, "ama hazır olduğunda kapıyı çal."', 'The manager took the band back. "An honest answer," he said, "but knock when you are ready."'), stress(-2), trust(-1)),
      },
    ],
  },
  {
    id: 'manager.attr_workrate_benched',
    category: 'manager',
    weight: 1,
    cooldownWeeks: 30,
    minWeek: 5,
    conditions: ({ state }) => hasClub(state) && !isGk(state) && A(state, 'workRate') < 52 && state.hero.seasonStats.apps >= 3,
    triggers: ['weekly', 'benched', 'post_match'],
    vars: ({ state }) => statVars(state, 'workRate'),
    title: t('GPS Yalan Söylemez', 'The GPS Doesn’t Lie'),
    text: t(
      'Analiz toplantısında ekranda senin koşu haritan var. Top rakipteyken yürüyorsun. Hoca kimsenin adını söylemedi; söylemesine gerek yoktu. Çalışkanlık {v}.',
      'At the analysis meeting your running map is on the screen. When the opponent has the ball, you walk. The manager named no one; he didn’t need to. Work rate {v}.',
    ),
    icon: '📡',
    choices: [
      {
        label: t('Pres seanslarına gönüllü ol', 'Volunteer for the pressing sessions'),
        effects: () => fx(t('Bir hafta boyunca ciğerlerin yandı. Hoca son gün GPS çıktısını odasının kapısına astı: senin.', 'For a week your lungs burned. On the last day the manager pinned a GPS printout on his door: yours.'), attr('workRate', 1), attr('stamina', 1), fatigue(8), trust(3)),
      },
      {
        label: t('"Ben topla oynarım, koşucu değilim"', '"I play with the ball; I’m not a runner"'),
        risk: 'medium',
        effects: () => fx(t('Hoca bir sonraki maçta seni ilk on birde yazmadı. Mesaj net.', 'The manager left you out of the next starting eleven. Message received.'), trust(-4), boss(-3), morale(-3)),
      },
      {
        label: t('Kendi videonu iste, nerede durduğunu gör', 'Ask for your own clips to see where you stop'),
        effects: () => fx(t('Görüntüler acıttı ama öğretti: koşmadığın anlar hep aynı anlar. Onları biliyorsun artık.', 'The footage hurt but it taught: the moments you stop are always the same moments. Now you know them.'), attr('anticipation', 1), attr('workRate', 1), boss(2)),
      },
    ],
  },
  {
    id: 'manager.attr_aggression_warning',
    category: 'manager',
    weight: 1.2,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') >= 70 && state.hero.seasonStats.yellow >= 3,
    triggers: ['post_match', 'weekly'],
    vars: ({ state }) => ({ ...statVars(state, 'aggression'), y: state.hero.seasonStats.yellow }),
    title: t('Sarı Kart Koleksiyonu', 'The Yellow Card Collection'),
    text: t(
      'Bu sezon {y} sarı kart. Hoca seni çağırdı: "Sertliğin bu takımın parçası, onu istiyorum. Ama bir kart daha ve beş maçlık seriyi seyircide izleyeceksin. Nasıl çözeceksin?"',
      '{y} yellow cards this season. The manager called you in: "Your edge is part of this team, I want it. But one more card and you’ll watch the next run of games from the stands. How will you fix it?"',
    ),
    icon: '🟨',
    choices: [
      {
        label: t('Kontrollü agresiflik: video ve zamanlama çalış', 'Controlled aggression: video and timing work'),
        effects: () => fx(t('Faul yaptığın her pozisyonu izledin; çoğu geç kalmaktan. Erken okuyunca kayman gerekmiyor.', 'You watched every foul you made; most came from arriving late. Read it early and you don’t need to slide.'), attr('anticipation', 1), attr('composure', 1), disc(3), trust(2)),
      },
      {
        label: t('"Ben böyleyim, rakipler de biliyor"', '"That’s me, and the opponents know it"'),
        risk: 'high',
        effects: ({ state }, rng) => rng.chance(0.25 + (A(state, 'aggression') - A(state, 'composure')) / 200)
          ? fx(t('Bir sonraki maçta geç kalan bir müdahale, ikinci sarı. Bir maç ceza ve hocanın soğuk bakışı.', 'Next match: one late tackle, a second yellow. A one-match ban and a cold stare from the manager.'), ban(1), disc(-4), trust(-4), fans(2))
          : fx(t('Rakip forvet ilk temasta geri çekildi. Kart görmedin ama hakem seni not defterine yazdı.', 'The opposing striker shrank from the first contact. No card, but the referee wrote your name in his book.'), fans(3), disc(-2), morale(2)),
      },
      {
        label: t('Bir hafta tamamen temassız oyna', 'Play a week with no contact at all'),
        effects: () => fx(t('Antrenmanda ellerini arkana bağlamış gibi savundun. Sıkıcıydı ama ayağın yerinde kaldı.', 'You defended in training as if your hands were tied behind your back. Boring, but you stayed on your feet.'), attr('positioning', 1), disc(2)),
      },
    ],
  },

  // ───────────── Dressing room & mentoring ─────────────
  {
    id: 'teammates.attr_dressing_room_row',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state) && A(state, 'leadership') >= 55 && age(state) >= 20,
    triggers: ['match_loss'],
    title: t('Soyunma Odasında Gerilim', 'Tension in the Dressing Room'),
    text: t(
      'Yenilginin ardından {mate} ile {mate2} birbirine girdi: biri "koşmuyorsun", öteki "pas vermiyorsun" diye bağırıyor. Hoca henüz gelmedi. Herkes sana bakıyor.',
      'After the defeat {mate} and {mate2} went at each other: one shouting "you don’t run", the other "you don’t pass". The manager isn’t in yet. Everyone is looking at you.',
    ),
    icon: '🗯️',
    choices: [
      {
        label: t('Araya gir ve odayı topla', 'Step in and take the room'),
        hint: t('Liderlik ne kadar yüksekse şansın o kadar iyi', 'The higher your Leadership, the better your chances'),
        effects: ({ state }, rng) => rng.chance(0.15 + A(state, 'leadership') / 110)
          ? fx(t('"Bu yenilgi hepimizin." Sesin yükselmedi ama oda sustu. İkisi de el sıkıştı.', '"This defeat is all of ours." You didn’t raise your voice, but the room went quiet. They shook hands.'), rel('teammate', 4), attr('leadership', 1), trust(2), morale(2))
          : fx(t('Araya girdin ama ikisi de sana döndü. Hoca kapıda belirince herkes dağıldı; senin de payına bir bakış düştü.', 'You stepped in, but they both turned on you. When the manager appeared at the door everyone scattered; you got a look too.'), rel('teammate', -2), stress(4), attr('leadership', 1)),
      },
      {
        label: t('Kaptana bırak', 'Leave it to the captain'),
        effects: () => fx(t('Kaptan işi halletti. Sen soyunup duşa girdin. Kimse seni suçlamadı, kimse de hatırlamadı.', 'The captain handled it. You showered and left. No one blamed you; no one remembered you either.'), stress(-1)),
      },
      {
        label: t('İkisini ayrı ayrı akşam yemeğine çağır', 'Take them both to dinner, separately'),
        requires: ({ state }) => canAfford(state, 300),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: () => fx(t('İki akşam, iki uzun sohbet. Hafta sonu ikisi aynı golü kutladı.', 'Two evenings, two long talks. At the weekend they celebrated the same goal together.'), money(-300), rel('teammate', 5), attr('leadership', 1)),
      },
    ],
  },
  {
    id: 'teammates.attr_kid_asks_mentor',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 3,
    conditions: ({ state }) => hasClub(state) && age(state) >= 24 && A(state, 'leadership') >= 52,
    triggers: ['weekly', 'training'],
    title: t('"Bana Öğretir misin?"', '"Will You Teach Me?"'),
    text: t(
      'Akademiden yeni çıkan bir genç antrenmandan sonra yanına geldi, kramponlarını elinde tutuyor: "Sizin gibi oynamak istiyorum. Haftada bir yarım saat, yeter."',
      'A kid just up from the academy came over after training, boots in hand: "I want to play like you. Half an hour a week, that’s all."',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('Her hafta birlikte çalışın', 'Work together every week'),
        effects: () => fx(t('Haftada bir, ışıklar kapanana kadar. Bir gün gencin ilk golünün asistini sen verdin; sevinmekten çok gurur duydun.', 'Once a week, until the lights went out. One day you set up the kid’s first goal and felt more pride than joy.'), attr('leadership', 1), attr('composure', 1), rel('teammate', 3), fatigue(3), happy(3)),
      },
      {
        label: t('Bir kerelik ipuçları ver', 'Give a one-off masterclass'),
        effects: () => fx(t('Yarım saat, üç ipucu. Genç bir deftere yazdı; ertesi hafta defter hâlâ cebindeydi.', 'Half an hour, three tips. The kid wrote them in a notebook; a week later it was still in a pocket.'), attr('leadership', 1), happy(2)),
      },
      {
        label: t('"Önce kendine odaklan"', '"Focus on yourself first"'),
        effects: () => fx(t('Genç başını sallayıp gitti. Haklıydın belki, ama soyunma odası bu cevabı duydu.', 'The kid nodded and left. Maybe you were right, but the dressing room heard the answer.'), rel('teammate', -2)),
      },
    ],
  },
  {
    id: 'teammates.attr_hard_man_nickname',
    category: 'teammates',
    weight: 0.8,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') >= 74 && !isGk(state),
    triggers: ['weekly', 'post_match'],
    vars: ({ state }) => statVars(state, 'aggression'),
    title: t('Lakabın Hazır', 'You Have a Nickname'),
    text: t(
      'Antrenmanda üçüncü kez birini yere serdikten sonra {mate} dolabının üstüne bir etiket yapıştırdı: "KASAP". Herkes gülüyor; bekleniyor ki sen de gül.',
      'After you flattened someone for the third time in training, {mate} stuck a label on your locker: "THE BUTCHER". Everyone is laughing, waiting to see if you laugh too.',
    ),
    icon: '🪓',
    choices: [
      {
        label: t('Sahiplen: etiketin altına imzanı at', 'Own it: sign under the label'),
        effects: () => fx(t('Lakap soyunma odasından tribüne sızdı. Rakipler ilk temastan önce iki kez düşünüyor.', 'The nickname leaked from the dressing room to the stands. Opponents think twice before the first contact.'), rel('teammate', 3), fans(3), disc(-1)),
      },
      {
        label: t('Gülümse ama antrenmanda yumuşa', 'Smile, then ease off in training'),
        effects: () => fx(t('Bir hafta boyunca kimseyi yere sermeden top kaptın. Etiket yerinde kaldı ama gülüşler değişti.', 'For a week you won the ball without flattening anyone. The label stayed, but the laughs changed.'), attr('tackling', 1), disc(2)),
      },
    ],
  },
  {
    id: 'teammates.attr_sprint_race',
    category: 'teammates',
    weight: 0.9,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && (A(state, 'acceleration') >= 78 || A(state, 'pace') >= 80),
    triggers: ['training', 'weekly'],
    vars: ({ state }) => ({ acc: A(state, 'acceleration'), pace: A(state, 'pace') }),
    title: t('30 Metre, Bir Kasa İçecek', '30 Metres for a Crate of Drinks'),
    text: t(
      'Kulübün en hızlısı olduğunu iddia eden {mate} antrenman sonunda meydan okudu: 30 metre, kaybeden takıma içecek ısmarlıyor. Telefonlar çoktan kayıtta. Hızlanma {acc}, hız {pace}.',
      '{mate}, who claims to be the fastest at the club, threw down the gauntlet after training: 30 metres, loser buys the team drinks. Phones are already recording. Acceleration {acc}, pace {pace}.',
    ),
    icon: '⚡',
    choices: [
      {
        label: t('Kabul', 'Accept'),
        effects: ({ state }, rng) => rng.chance(0.15 + A(state, 'acceleration') / 120)
          ? fx(t('İlk üç adımda farkı açtın; gerisi tören. Video kulübün hesabında yayınlandı.', 'You opened the gap in the first three strides; the rest was a parade. The club posted the video.'), morale(3), fol(1500), rel('teammate', 2))
          : fx(t('Çıkışta ondan iyiydin ama son on metrede yakaladı. İçecekler senden.', 'You were quicker off the mark, but the last ten metres were his. Drinks are on you.'), money(-150), happy(-1), rel('teammate', 3)),
      },
      {
        label: t('"Ben maçta koşarım"', '"I only run in matches"'),
        effects: () => fx(t('Yuhalandın, ama sevgiyle.', 'You got booed, affectionately.'), rel('teammate', 1)),
      },
    ],
  },
  {
    id: 'teammates.attr_striker_thanks_playmaker',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state) && A(state, 'vision') >= 70 && A(state, 'passing') >= 68 && state.hero.seasonStats.assists >= 3,
    triggers: ['post_match', 'weekly'],
    vars: ({ state }) => ({ a: state.hero.seasonStats.assists, vis: A(state, 'vision') }),
    title: t('Forvetin Teşekkürü', 'The Striker Says Thanks'),
    text: t(
      'Bu sezon {a} asist. {mate} soyunma odasında herkesin önünde sana döndü: "Gollerimin yarısı onun. Ben sadece kapıyı itiyorum." Gülüşmeler, alkış. Sonra yanına gelip sessizce sordu: "Ekstra çalışalım mı? Koşularımı okumanı istiyorum."',
      '{a} assists this season. In the dressing room {mate} turned to you in front of everyone: "Half my goals are his. I just push the door." Laughter, applause. Later, quietly: "Shall we do extra work? I want you to read my runs."',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Antrenman sonrası pas desenleri çalışın', 'Work on passing patterns after training'),
        effects: () => fx(t('Koşu, pas, koşu. Bir hafta sonra bakmadan buluşmaya başladınız.', 'Run, pass, run. A week later you were finding each other without looking.'), attr('vision', 1), attr('passing', 1), rel('teammate', 4), fatigue(3)),
      },
      {
        label: t('Övgüyü takıma paylaştır', 'Share the credit with the team'),
        effects: () => fx(t('"Gol atan da, koşan da biziz." Basın bu cümleyi manşete taşıdı.', '"We score and we run together." The press put the line in a headline.'), rel('teammate', 3), press(2), rep(1)),
      },
    ],
  },

  // ───────────── Body: fatigue, stamina, diet, sleep, age ─────────────
  {
    id: 'health.attr_running_on_fumes',
    category: 'health',
    weight: 1.6,
    cooldownWeeks: 6,
    conditions: ({ state }) => hasClub(state) && !state.hero.injury && state.hero.fatigue >= 68,
    triggers: ['weekly', 'training', 'post_match'],
    vars: ({ state }) => ({ f: Math.round(state.hero.fatigue), sta: A(state, 'stamina') }),
    title: t('Fizyonun Uyarısı', 'The Physio’s Warning'),
    text: t(
      'Fizyoterapist yorgunluk ölçümünü önüne koydu: {f}/100. "Kasların alarm veriyor. Bu tempoda bir sakatlık kapıda. Dayanıklılık {sta}; vücudun bu yükü kaldıracak kadar büyük bir motor değil. Karar senin."',
      'The physio put your fatigue reading in front of you: {f}/100. "Your muscles are screaming. At this rate an injury is at the door. Stamina {sta}; your engine isn’t big enough for this load. Your call."',
    ),
    icon: '🩺',
    choices: [
      {
        label: t('Bir gün tam dinlen', 'Take a full day off'),
        effects: () => fx(t('Bir gün kanepe, iki öğün iyi yemek, dokuz saat uyku. Bacakların teşekkür etti; hoca biraz homurdandı.', 'A day on the sofa, two proper meals, nine hours of sleep. Your legs thanked you; the manager grumbled a bit.'), fatigue(-18), energy(15), sharp(-2), trust(-1)),
      },
      {
        label: t('Buz banyosu ve masaj', 'Ice bath and massage'),
        requires: ({ state }) => canAfford(state, 250),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: () => fx(t('On dakika buz, bir saat masaj. Ağrı geçmedi ama yük hafifledi.', 'Ten minutes of ice, an hour of massage. The ache stayed, but the load eased.'), money(-250), fatigue(-10), stress(-2)),
      },
      {
        label: t('Devam et, takım beni bekliyor', 'Play on; the team needs me'),
        risk: 'high',
        hint: t('Düşük dayanıklılık riski artırır', 'Low Stamina raises the risk'),
        effects: ({ state }, rng) => rng.chance(Math.max(0.08, 0.32 - (A(state, 'stamina') - 50) / 250))
          ? fx(t('Bir sprintte arka adalende bir şey koptu gibi oldu. Fizyonun gözleri her şeyi söylüyordu.', 'In one sprint something seemed to snap in your hamstring. The physio’s eyes said it all.'), injury(2, t('Arka adale zorlanması', 'Hamstring strain')), trust(1), morale(-4))
          : fx(t('Diş sıktın, bitirdin. Bu sefer şans yanındaydı; bir dahaki sefere belki olmayacak.', 'You gritted your teeth and got through it. Luck was with you this time; it may not be next time.'), trust(2), fatigue(6), stress(3)),
      },
    ],
  },
  {
    id: 'health.attr_fading_after_sixty',
    category: 'health',
    weight: 1,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state) && A(state, 'stamina') < 52 && state.hero.seasonStats.apps >= 4,
    triggers: ['weekly', 'post_match'],
    vars: ({ state }) => statVars(state, 'stamina'),
    title: t('Altmışıncı Dakika Duvarı', 'The Sixty-Minute Wall'),
    text: t(
      'Kondisyoner GPS verilerini gösterdi: 60. dakikadan sonra sprint sayın yarı yarıya düşüyor. "{statTr} {v}. Ya motoru büyütürüz ya da hoca seni hep 60\'ta çıkarır."',
      'The fitness coach showed you the GPS data: after the 60th minute your sprint count halves. "{statEn} {v}. Either we build the engine, or the manager will keep hooking you on the hour."',
    ),
    icon: '🫁',
    choices: [
      {
        label: t('Ekstra kondisyon bloğu', 'An extra conditioning block'),
        effects: () => fx(t('Üç hafta, ikinci seanslar, interval koşuları. Nefesin hâlâ yanıyor ama artık 75\'e kadar yanıyor.', 'Three weeks of second sessions and intervals. Your lungs still burn, but now they burn until the 75th.'), attr('stamina', 1), attr('workRate', 1), fatigue(10), trust(2)),
      },
      {
        label: t('Beslenme uzmanıyla çalış', 'Work with a nutritionist'),
        requires: ({ state }) => canAfford(state, 600),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: () => fx(t('Karbonhidrat zamanlaması, sıvı planı, maç öncesi menü. Bir hafta içinde toparlanman hızlandı.', 'Carb timing, a fluids plan, a pre-match menu. Within a week your recovery sped up.'), money(-600), flags({ diet_left: 7 }), health(3), attr('stamina', 1)),
      },
      {
        label: t('Oyununu ritme göre ayarla', 'Pace your game instead'),
        effects: () => fx(t('Daha az koşu, daha akıllı koşu. Pozisyon almayı öğrendin ama hoca yine de 70\'te tabelayı kaldırdı.', 'Fewer runs, smarter runs. You learned to take up positions, but the board still went up on 70.'), attr('positioning', 1), trust(-1)),
      },
    ],
  },
  {
    id: 'health.attr_first_yard_going',
    category: 'health',
    weight: 1.2,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && age(state) >= 30 && !isGk(state),
    triggers: ['new_season', 'weekly'],
    vars: ({ state }) => ({ acc: A(state, 'acceleration'), vis: A(state, 'vision'), ant: A(state, 'anticipation') }),
    title: t('İlk Adım Gidiyor', 'The First Yard Is Going'),
    text: t(
      'Sezon öncesi testlerinde 10 metre süren geçen yılın gerisinde. Hızlanma {acc}. Kondisyoner kibar: "Bu yaşta herkeste olur." Ama vizyonun {vis}, önsezin {ant}: oyunu okuman hiç bu kadar iyi olmamıştı.',
      'In pre-season testing your 10-metre time is down on last year. Acceleration {acc}. The fitness coach is kind: "Everyone gets it at this age." But your vision is {vis} and anticipation {ant}: you have never read the game better.',
    ),
    icon: '⏳',
    choices: [
      {
        label: t('Oyununu değiştir: önce düşün, sonra koş', 'Change your game: think first, run second'),
        effects: () => fx(t('Bir adım önde olmak için hızlı olmaya gerek yok; doğru yerde olmak yeter. Video odası ikinci evin oldu.', 'You don’t need speed to be a step ahead; you need to be in the right place. The video room became your second home.'), attr('anticipation', 1), attr('positioning', 1), morale(2)),
      },
      {
        label: t('Özel sprint koçu tut', 'Hire a private sprint coach'),
        requires: ({ state }) => canAfford(state, wageX(state, 0.5, 2000)),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: ({ state }) => fx(t('Teknik, kol çalışması, çıkış açısı. Saati geri çeviremezsin, ama yavaşlatabilirsin.', 'Technique, arm drive, start angle. You can’t turn back the clock, but you can slow it down.'), money(-wageX(state, 0.5, 2000)), attr('acceleration', 1), fatigue(6)),
      },
      {
        label: t('Testler yanılıyor', 'The tests are wrong'),
        effects: () => fx(t('İnkâr bir süre işe yaradı. Sonra bir maçta, eskiden kolayca geçtiğin bir beke yakalandın.', 'Denial worked for a while. Then, in one game, a full-back you used to skip past caught you.'), stress(4), morale(-2)),
      },
    ],
  },
  {
    id: 'health.attr_sleep_plan',
    category: 'health',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && state.hero.fatigue >= 45 && age(state) >= 19,
    triggers: ['weekly'],
    title: t('Uyku Bilimcisi', 'The Sleep Scientist'),
    text: t(
      'Kulüp bir uyku bilimcisiyle anlaştı. Bileğine bir takip cihazı taktılar; sonuç: gecelik ortalama 6 saat, derin uyku yarım saat. "Kasların gece onarılır. Sen onlara vakit bırakmıyorsun."',
      'The club has signed up a sleep scientist. They strapped a tracker to your wrist; the verdict: six hours a night, half an hour of deep sleep. "Your muscles are repaired at night. You aren’t giving them the time."',
    ),
    icon: '😴',
    choices: [
      {
        label: t('Planı uygula: ekran yok, 23.00 yatış', 'Follow the plan: no screens, in bed by 11'),
        effects: () => fx(t('İlk üç gece tavanı izledin. Dördüncü gece dokuz saat uyudun. Bacakların hafifledi.', 'The first three nights you stared at the ceiling. The fourth, you slept nine hours. Your legs felt lighter.'), fatigue(-12), energy(10), stress(-3), happy(-1)),
      },
      {
        label: t('Gece oyunlarımdan vazgeçmem', 'I’m not giving up my late-night gaming'),
        effects: () => fx(t('Cihaz çekmeceye girdi. Sabah antrenmanlarında esnemeler arttı.', 'The tracker went into a drawer. The yawns at morning training multiplied.'), happy(2), fatigue(4)),
      },
    ],
  },
  {
    id: 'health.attr_core_programme',
    category: 'health',
    weight: 0.9,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && A(state, 'balance') < 55 && !isGk(state),
    triggers: ['weekly', 'training'],
    vars: ({ state }) => statVars(state, 'balance'),
    title: t('Yere Çok Düşüyorsun', 'You Go Down Too Easily'),
    text: t(
      'Fizyo omuz omuza mücadelelerdeki görüntülerini durdurdu: her temasta ağırlığın tek ayakta kalıyor. "{statTr} {v}. Bu hem topu kaybettiriyor hem de diz bağlarını riske atıyor."',
      'The physio paused your shoulder-to-shoulder clips: in every contact your weight stays on one leg. "{statEn} {v}. It costs you the ball and puts your knee ligaments at risk."',
    ),
    icon: '🧱',
    choices: [
      {
        label: t('Core ve propriosepsiyon programı', 'A core and proprioception programme'),
        effects: () => fx(t('Denge tahtası, tek ayak squat, plank. Sıkıcı ama bir ay sonra stoperler senden sekmeye başladı.', 'Wobble board, single-leg squats, planks. Boring, but a month later the centre-backs started bouncing off you.'), attr('balance', 1), attr('strength', 1), fatigue(5)),
      },
      {
        label: t('Şimdilik geç', 'Skip it for now'),
        effects: () => fx(t('Fizyo omuz silkti ve dosyayı kapattı. Dosya, sakatlık raporlarının durduğu rafa gitti.', 'The physio shrugged and closed the file. It went on the shelf with the injury reports.'), stress(-1)),
      },
    ],
  },
  {
    id: 'health.attr_nutrition_offer',
    category: 'health',
    weight: 0.8,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state) && (age(state) >= 26 || state.hero.fatigue >= 55),
    triggers: ['weekly'],
    title: t('Sporcu Mutfağı', 'The Athlete’s Kitchen'),
    text: t(
      'Takımın beslenme uzmanı bir teklifle geldi: kişisel menü, haftalık kaplar, maç günü planı. "Otuzuna yaklaşan bir vücut, yediklerinden yapılır."',
      'The team nutritionist came with an offer: a personal menu, boxed meals for the week, a match-day plan. "A body heading towards thirty is made of what it eats."',
    ),
    icon: '🥗',
    choices: [
      {
        label: t('Kabul: bir haftalık plan', 'Yes: a week-long plan'),
        requires: ({ state }) => canAfford(state, 300),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: () => fx(t('Haftanın yemekleri dolapta, etiketli. Sabahları daha az ağrıyla uyanıyorsun.', 'The week’s meals are in the fridge, labelled. You wake up with fewer aches.'), money(-300), flags({ diet_left: 7 }), health(3), fatigue(-5)),
      },
      {
        label: t('Annemin yemekleri yeter', 'Mum’s cooking is enough'),
        effects: () => fx(t('Beslenme uzmanı gülümsedi: "Annene de bir menü göndereyim mi?"', 'The nutritionist smiled: "Shall I send your mum a menu too?"'), happy(2)),
      },
    ],
  },

  // ───────────── Fans & press ─────────────
  {
    id: 'fans.attr_hard_man_chant',
    category: 'fans',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') >= 74 && state.hero.seasonStats.tackles >= 15,
    triggers: ['post_match', 'match_win'],
    vars: ({ state }) => ({ tk: state.hero.seasonStats.tackles }),
    title: t('Tribünden Yeni Bir Marş', 'A New Chant from the Stands'),
    text: t(
      'Bu sezon {tk} top kapma. Bugün kale arkası tribün yeni bir marş besteledi: "Kimse geçemez, kimse kaçamaz, {heroLast} geliyor, ayağını çek!" Her müdahalende tekrar ediyorlar.',
      '{tk} tackles this season. Today the stand behind the goal came up with a new song: "No one gets past, no one escapes, here comes {heroLast}, pull your foot away!" They sing it after every tackle you make.',
    ),
    icon: '📣',
    choices: [
      {
        label: t('Tribüne yumruğunu göster', 'Raise a fist to the stand'),
        effects: () => fx(t('Tribün yıkıldı. Hakem ise bir sonraki temasında seni daha yakından izledi.', 'The stand went wild. The referee watched your next contact a little closer.'), fans(6), morale(3), disc(-1)),
      },
      {
        label: t('Sadece alkışla, oyuna dön', 'Just applaud and get on with it'),
        effects: () => fx(t('Saygılı bir jest. Taraftar bunu da sevdi.', 'A respectful gesture. The fans liked that too.'), fans(3), press(1)),
      },
    ],
  },
  {
    id: 'fans.attr_express_banner',
    category: 'fans',
    weight: 0.9,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && A(state, 'acceleration') >= 84 && state.hero.reputation >= 25,
    triggers: ['post_match', 'scored'],
    vars: ({ state }) => ({ acc: A(state, 'acceleration') }),
    title: t('"{heroLast} Ekspresi"', 'The "{heroLast} Express"'),
    text: t(
      'Kale arkasında dev bir pankart: bir lokomotifin üstünde senin yüzün ve "{heroLast} EKSPRESİ: DURAKSIZ". Hızlanma {acc}: bekler artık seni gördüğünde iki adım geri çekiliyor.',
      'A giant banner behind the goal: your face on a locomotive and "{heroLast} EXPRESS: NON-STOP". Acceleration {acc}: full-backs now take two steps back when they see you coming.',
    ),
    icon: '🚂',
    choices: [
      {
        label: t('Pankartın önünde lokomotif sevinci yap', 'Do a train celebration in front of it'),
        effects: () => fx(t('Bir sonraki golünde tüm takım arkanda vagon oldu. Video milyonları buldu.', 'At your next goal the whole team lined up behind you as carriages. The video went into the millions.'), fans(5), fol(4000), happy(3)),
      },
      {
        label: t('Fotoğrafını çek, paylaş', 'Take a photo and post it'),
        effects: () => fx(t('"Biletler sizden, yolculuk benden." Paylaşım günün en çok beğenileni oldu.', '"You bring the tickets, I’ll bring the ride." The post was the most-liked of the day.'), fol(2500), fans(3)),
      },
    ],
  },
  {
    id: 'fans.attr_captain_song',
    category: 'fans',
    weight: 0.9,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && role(state) === 'captain' && A(state, 'leadership') >= 70,
    triggers: ['match_win', 'post_match'],
    vars: ({ state }) => statVars(state, 'leadership'),
    title: t('Kaptanın Şarkısı', 'The Captain’s Song'),
    text: t(
      'Maç bitti, takım tribüne yürüdü ve taraftar sadece senin için bir şarkı söyledi: "Kaptan önde, biz arkada." Liderlik {v}: bandı taktığından beri bu takım ikinci yarılarda bambaşka.',
      'Full time; the team walked to the stand and the fans sang a song just for you: "Captain in front, we follow." Leadership {v}: since you took the armband, this team is a different side after half-time.',
    ),
    icon: '🎶',
    choices: [
      {
        label: t('Takımı tribünün önünde topla', 'Gather the team in front of the stand'),
        effects: () => fx(t('Kol kola, hep birlikte. Hoca kenarda kollarını kavuşturup izledi.', 'Arm in arm, all together. The manager watched from the touchline, arms folded.'), fans(5), rel('teammate', 3), morale(4)),
      },
      {
        label: t('Alkışla ve ilk soyunma odasına gir', 'Applaud and be first into the dressing room'),
        effects: () => fx(t('Kaptanlar önce gider, son çıkar. Taraftar bunu da not etti.', 'Captains go in first and leave last. The fans noticed that too.'), fans(2), trust(1)),
      },
    ],
  },
  {
    id: 'press.attr_playmaker_label',
    category: 'press',
    weight: 1,
    cooldownWeeks: 40,
    maxPerCareer: 3,
    conditions: ({ state }) => hasClub(state) && A(state, 'vision') >= 74 && state.hero.seasonStats.assists >= 5,
    triggers: ['post_match', 'weekly'],
    vars: ({ state }) => ({ ...statVars(state, 'vision'), a: state.hero.seasonStats.assists }),
    title: t('"Orkestra Şefi"', '"The Conductor"'),
    text: t(
      'Bir köşe yazarı seni "orkestra şefi" ilan etti: {a} asist, maç başına en çok kilit pas, ve "{statTr} {v} ile oyunu başkalarından iki saniye önce görüyor." Mikrofonlar şimdi sana uzanıyor.',
      'A columnist has crowned you "the conductor": {a} assists, the most key passes per game, and "with {statEn} {v} he sees the game two seconds before everyone else." Now the microphones are coming your way.',
    ),
    icon: '🎼',
    choices: [
      {
        label: t('Alçakgönüllü ol: "Golleri onlar atıyor"', 'Stay humble: "They score the goals"'),
        effects: () => fx(t('Basın alçakgönüllülüğü, takım arkadaşların övgüyü sevdi.', 'The press loved the humility; your team-mates loved the credit.'), rep(1), rel('teammate', 3), press(2)),
      },
      {
        label: t('Lakabı sahiplen', 'Embrace the nickname'),
        effects: () => fx(t('"Orkestra hazırsa ben de hazırım." Cümle formalara basıldı.', '"If the orchestra is ready, so am I." The line got printed on shirts.'), rep(2), fol(3000), press(1)),
      },
    ],
  },
  {
    id: 'press.attr_dirty_player_column',
    category: 'press',
    weight: 1,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') >= 76 && state.hero.seasonStats.yellow >= 4,
    triggers: ['post_match', 'weekly'],
    vars: ({ state }) => ({ y: state.hero.seasonStats.yellow, r: state.hero.seasonStats.red }),
    title: t('"Ligin En Kirli Oyuncusu mu?"', '"The Dirtiest Player in the League?"'),
    text: t(
      'Pazar gazetesinin kapağında senin kayarak müdahale fotoğrafın: "{y} sarı, {r} kırmızı. Ligin en kirli oyuncusu mu?" Menajerin aradı: "Bir açıklama yapalım mı, yoksa sessiz mi kalalım?"',
      'The Sunday paper’s front page has your sliding tackle: "{y} yellows, {r} reds. The dirtiest player in the league?" Your agent rang: "Do we make a statement, or stay quiet?"',
    ),
    icon: '📰',
    choices: [
      {
        label: t('Sakin bir röportaj ver', 'Give a calm interview'),
        effects: () => fx(t('"Sert oynarım ama kimseyi sakatlamak istemem." Ton dengeli, tartışma söndü.', '"I play hard, but I never want to hurt anyone." A measured tone; the row died down.'), press(3), disc(2), attr('composure', 1)),
      },
      {
        label: t('Yazara cevap ver', 'Hit back at the columnist'),
        risk: 'medium',
        effects: () => fx(t('Sosyal medyada sert bir cevap. Taraftarın bir kısmı alkışladı, federasyon dosyayı açtı.', 'A sharp reply on social media. Some fans cheered; the federation opened a file.'), press(-3), fans(3), disc(-3), news(t('{heroName}: "Kirli olan benim oyunum değil, sizin kaleminiz"', '{heroName}: "It’s your pen that’s dirty, not my game"'), -1)),
      },
      {
        label: t('Futbolun konuşsun', 'Let your football do the talking'),
        effects: () => fx(t('Sustun. Bir sonraki maçta tek faul yapmadan dokuz top kaptın.', 'You said nothing. Next game you won the ball nine times without a single foul.'), attr('tackling', 1), disc(1)),
      },
    ],
  },
  {
    id: 'press.attr_iceman',
    category: 'press',
    weight: 0.8,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && A(state, 'composure') >= 80 && state.hero.seasonStats.goals >= 5,
    triggers: ['scored', 'post_match'],
    vars: ({ state }) => ({ ...statVars(state, 'composure'), g: state.hero.seasonStats.goals }),
    title: t('Buz Adam', 'The Iceman'),
    text: t(
      'Bu sezon {g} gol ve hiçbirinde aceleye gelmedin. Bir televizyon programı kaleci karşısındaki nabzını grafikle gösterdi: düz bir çizgi. "{statTr} {v}. Bu adamın kanı soğuk."',
      '{g} goals this season and you never rushed one. A TV show graphed your heart rate in one-on-ones: a flat line. "{statEn} {v}. This one has ice in the veins."',
    ),
    icon: '🧊',
    choices: [
      {
        label: t('Gülümse: "Sadece nefes alıyorum"', 'Smile: "I just breathe"'),
        effects: () => fx(t('Cümle bir spor içeceği reklamına dönüştü. Ajansın telefonu susmuyor.', 'The line turned into a sports drink advert. Your agent’s phone won’t stop ringing.'), rep(1), fol(2000), money(2000)),
      },
      {
        label: t('Gençlere bir nefes videosu çek', 'Record a breathing video for young players'),
        effects: () => fx(t('Akademi video ile antrenmana başladı. Bir veli teşekkür mektubu yazdı.', 'The academy started using the video in training. A parent wrote a thank-you letter.'), press(2), attr('leadership', 1), happy(3)),
      },
    ],
  },

  // ───────────── Scouts, style and transfers ─────────────
  {
    id: 'transfer.attr_scout_report',
    category: 'transfer',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 20 && age(state) <= 31,
    triggers: ['transfer_window', 'weekly'],
    vars: ({ state }) => strengthVars(state),
    title: t('Sızan Scout Raporu', 'A Leaked Scout Report'),
    text: t(
      'Menajerin bir ekran görüntüsü gönderdi: büyük bir kulübün scout raporu. Başlıkta senin adın, altında üç satır: "{strTr}. Takip et." Altında el yazısıyla bir not: "Karakteri?"',
      'Your agent sent a screenshot: a scout report from a big club. Your name at the top, three lines below: "{strEn}. Keep tracking." Underneath, a handwritten note: "Character?"',
    ),
    icon: '🔎',
    choices: [
      {
        label: t('Menajere: "Kapıyı aralık tut"', 'Tell your agent: "Keep the door ajar"'),
        effects: () => fx(t('Menajerin birkaç telefon açtı. Raporun sahibi kulüp şimdi maçlarına iki kişi gönderiyor.', 'Your agent made a few calls. The club behind the report now sends two people to your games.'), rel('agent', 3), { addFlags: { transfer_buzz: 2 } }),
      },
      {
        label: t('"Karakter" notunu kafana tak, örnek ol', 'Take the "character" note to heart'),
        effects: () => fx(t('Antrenmana ilk gelen, son çıkan sen oldun. Rapor bir sonraki ziyarette güncellendi: "Profesyonel."', 'You were first in and last out at training. At the next visit the report was updated: "Professional."'), disc(3), boss(2), trust(1)),
      },
      {
        label: t('Kulübüne sadık kal, görmezden gel', 'Stay loyal; ignore it'),
        effects: () => fx(t('Raporu sildin. Kulüp başkanı bunu bir şekilde duydu ve seni yemeğe davet etti.', 'You deleted it. Somehow the chairman heard and invited you to dinner.'), rel('chairman', 3), fans(2)),
      },
    ],
  },
  {
    id: 'club.attr_style_mismatch',
    category: 'club',
    weight: 1.1,
    cooldownWeeks: 40,
    conditions: ({ state }) => {
      const c = club(state)
      return !!c && c.style !== 'balanced' && styleFit(state.hero.attrs, c.style, isGk(state)) <= -0.2
    },
    triggers: ['weekly', 'benched'],
    vars: ({ state }) => {
      const c = club(state)!
      const k = styleKeyStat(state.hero.attrs, c.style) ?? 'workRate'
      return { styleTr: STYLE_TR[c.style] ?? c.style, styleEn: STYLE_EN[c.style] ?? c.style, ...statVars(state, k) }
    },
    title: t('Yanlış Sistemde Doğru Oyuncu', 'Right Player, Wrong System'),
    text: t(
      'Hoca {styleTr} oynuyor ve bu sistemin istediği şey senin güçlü yanın değil: {statTr} {v}. Analist kibarca söyledi: "Ya sisteme uyacaksın, ya da sistem sana uymayacak."',
      'The manager plays a {styleEn} game, and what that system asks for isn’t your strength: {statEn} {v}. The analyst put it kindly: "Either you fit the system, or the system won’t fit you."',
    ),
    icon: '🧩',
    choices: [
      {
        label: t('Uyum sağla: sistemin istediğini çalış', 'Adapt: train what the system wants'),
        effects: ({ state }) => fx(t('Haftalarca sistemin istediği koşuları çalıştın. Hoca ilk kez seni örnek gösterdi.', 'For weeks you drilled the runs the system wants. For the first time the manager held you up as an example.'), attr(styleKeyStat(state.hero.attrs, club(state)?.style ?? 'balanced') ?? 'workRate', 1), trust(3), fatigue(5)),
      },
      {
        label: t('Menajere: "Bana uyan bir kulüp bul"', 'Tell your agent: "Find me a club that suits me"'),
        risk: 'medium',
        effects: () => fx(t('Menajerin listeyi çıkardı: oyun tarzı sana uyan dört kulüp. Hoca bunu duymadı; şimdilik.', 'Your agent drew up a list: four clubs whose style suits you. The manager hasn’t heard; yet.'), rel('agent', 3), trust(-2), { addFlags: { transfer_buzz: 3 } }),
      },
      {
        label: t('Sabırlı ol, kendi oyununu oyna', 'Be patient and play your own game'),
        effects: () => fx(t('Bazen sistemler değişir, bazen hocalar. Bekledin.', 'Sometimes systems change; sometimes managers do. You waited.'), stress(2), morale(-1)),
      },
    ],
  },
  {
    id: 'club.attr_analyst_radar',
    category: 'club',
    weight: 1,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && state.hero.seasonStats.apps >= 2 && weakestDevArea(state.hero) !== null,
    triggers: ['weekly', 'new_season'],
    vars: ({ state }) => ({ ...strengthVars(state), ...statVars(state, weakKey(state), 'w') }),
    title: t('Analistin Radar Grafiği', 'The Analyst’s Radar Chart'),
    text: t(
      'Kulübün yeni veri analisti senin için bir radar grafiği çizdi. Sivri uçlar: {strTr}. Göçük: {wstatTr} {wv}. "Rakip analistler de bunu görüyor," dedi. "Seni oradan vuracaklar."',
      'The club’s new data analyst drew you a radar chart. The spikes: {strEn}. The dent: {wstatEn} {wv}. "The opposition analysts see this too," he said. "That’s where they’ll attack you."',
    ),
    icon: '📊',
    choices: [
      {
        label: t('Göçüğü kapat: gelişim planı', 'Fill the dent: a development plan'),
        effects: () => fx(t('Analistle haftalık hedefler koydunuz. Grafik her pazartesi güncellenecek.', 'You set weekly targets with the analyst. The chart will be updated every Monday.'), objective('dev_focus'), boss(1)),
      },
      {
        label: t('Güçlü yanlarını daha da sivrilt', 'Sharpen your strengths even more'),
        effects: ({ state }) => fx(t('"Herkesin her şeyi olamaz," dedin. En iyi yaptığın şeyi daha da iyi yapmaya karar verdin.', '"No one has everything," you said. You decided to get even better at what you do best.'), attr(signatureStrengths(state.hero, 1)[0] ?? 'passing', 1), morale(2)),
      },
    ],
  },

  // ───────────── Mentoring ─────────────
  {
    id: 'mentor.attr_youth_programme',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && age(state) >= 27 && A(state, 'leadership') >= 58,
    triggers: ['weekly', 'new_season'],
    vars: ({ state }) => statVars(state, 'leadership'),
    title: t('Kulübün Mentorluk Programı', 'The Club’s Mentoring Scheme'),
    text: t(
      'Kulüp akademi için bir mentorluk programı kuruyor ve ilk isim olarak seni istiyor: her ay dört genç, birebir görüşmeler, bir de soyunma odası kuralları sunumu. Liderlik {v}.',
      'The club is setting up a mentoring scheme for the academy and wants you as the first name: four kids a month, one-to-ones, and a talk on dressing-room rules. Leadership {v}.',
    ),
    icon: '🧑‍🏫',
    choices: [
      {
        label: t('Kabul et', 'Accept'),
        effects: () => fx(t('İlk sunumda bir genç el kaldırdı: "Siz de hiç yedek kaldınız mı?" Cevabın salonu güldürdü, sonra düşündürdü.', 'At the first talk a kid raised a hand: "Were you ever on the bench?" Your answer made the room laugh, then think.'), attr('leadership', 1), attr('composure', 1), rel('teammate', 3), rep(1)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('Kulüp anlayışla karşıladı ve listedeki ikinci ismi aradı.', 'The club understood and called the second name on the list.'), stress(-1)),
      },
    ],
  },
  {
    id: 'mentor.attr_veteran_reads_game',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 1,
    conditions: ({ state }) => hasClub(state) && age(state) <= 22 && A(state, 'anticipation') < 65 && !isGk(state),
    triggers: ['weekly', 'training'],
    vars: ({ state }) => statVars(state, 'anticipation'),
    title: t('Yaşlı Kurt', 'The Old Fox'),
    text: t(
      'Takımın 34 yaşındaki emektarı, {mate}, antrenmandan sonra seni kenara çekti: "Ben senden yavaşım ama topu senden önce alıyorum. Neden biliyor musun? Önsezi {v}, değil mi? Gel, sana bir şey göstereyim."',
      'The team’s 34-year-old veteran, {mate}, pulled you aside after training: "I’m slower than you, but I get to the ball first. Know why? Anticipation {v}, right? Come, let me show you something."',
    ),
    icon: '🦊',
    choices: [
      {
        label: t('Dinle ve izle', 'Listen and watch'),
        effects: () => fx(t('"Pasörün kalçasına bak, ayağına değil." Basit bir cümle, ama o günden sonra iki pası önceden gördün.', '"Watch the passer’s hips, not his feet." A simple line, but from that day you saw two passes coming.'), attr('anticipation', 1), attr('positioning', 1), rel('teammate', 3)),
      },
      {
        label: t('"Ben hızımla kazanırım"', '"I win with my pace"'),
        effects: () => fx(t('Emektar güldü: "Herkes öyle der. Otuzunda tekrar konuşalım."', 'The veteran laughed: "Everyone says that. Let’s talk again when you’re thirty."'), rel('teammate', -1)),
      },
    ],
  },

  // ───────────── Awards & milestones ─────────────
  {
    id: 'awards.attr_assist_king',
    category: 'awards',
    weight: 1.3,
    cooldownWeeks: 40,
    minWeek: 28,
    conditions: ({ state }) => hasClub(state) && state.hero.seasonStats.assists >= 10,
    triggers: ['post_match', 'weekly', 'season_end'],
    vars: ({ state }) => ({ a: state.hero.seasonStats.assists, vis: A(state, 'vision'), pas: A(state, 'passing') }),
    title: t('Asist Kralı Yarışı', 'The Assist King Race'),
    text: t(
      '{a} asistle ligin zirvesindesin. Bir istatistik sitesi seni "sezonun oyun kurucusu" listesine koydu: vizyon {vis}, pas {pas}. Ödül töreni için davetiye geldi; kulüp de bir kutlama videosu çekmek istiyor.',
      'With {a} assists you lead the league. A stats site has put you on its "playmaker of the season" list: vision {vis}, passing {pas}. An invitation to the awards night arrived, and the club wants to film a celebration video.',
    ),
    icon: '🅰️',
    choices: [
      {
        label: t('Törene git, ödülü al', 'Go to the ceremony and collect it'),
        effects: () => fx(t('Sahneye çıktın ve ödülü gollerini attığın arkadaşlarına adadın. Salon ayağa kalktı.', 'You went on stage and dedicated the award to the team-mates who scored your assists. The room stood up.'), rep(2), rel('teammate', 3), fol(3000), news(t('{heroName} asist krallığını takım arkadaşlarına adadı', '{heroName} dedicates assist crown to team-mates'), 1)),
      },
      {
        label: t('Videoyu takımla çek', 'Film the video with the team'),
        effects: () => fx(t('Video: sen pas veriyorsun, herkes gol atıyor, sonunda topu kameraya veriyorsun. Kulübün en çok izlenen paylaşımı.', 'The video: you pass, everyone scores, and finally you pass to the camera. The club’s most-watched post ever.'), fans(4), fol(5000)),
      },
    ],
  },
  {
    id: 'awards.attr_engine_room',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 40,
    minWeek: 20,
    conditions: ({ state }) => hasClub(state) && A(state, 'workRate') >= 78 && A(state, 'stamina') >= 70 && state.hero.seasonStats.tackles >= 25,
    triggers: ['post_match', 'weekly'],
    vars: ({ state }) => ({ wr: A(state, 'workRate'), sta: A(state, 'stamina'), tk: state.hero.seasonStats.tackles }),
    title: t('Taraftarın "Motor" Ödülü', 'The Fans’ "Engine Room" Award'),
    text: t(
      'Taraftar derneği ayın oyuncusu yerine bu sefer "en çok ter döken" ödülünü verdi: {tk} top kapma, maç başına ligin en uzun koşu mesafesi. Çalışkanlık {wr}, dayanıklılık {sta}. Plaketin üstünde bir krampon izi var.',
      'Instead of player of the month, the supporters’ club gave out a "hardest worker" award: {tk} tackles and the league’s longest distance per game. Work rate {wr}, stamina {sta}. The plaque has a boot print on it.',
    ),
    icon: '🏅',
    choices: [
      {
        label: t('Plaketi soyunma odasına as', 'Hang the plaque in the dressing room'),
        effects: () => fx(t('"Her gün buna bakın," dedin. Ertesi antrenmanda pres yoğunluğu arttı.', '"Look at this every day," you said. At the next session the pressing intensity went up.'), rel('teammate', 3), fans(3), attr('leadership', 1)),
      },
      {
        label: t('Taraftar derneğine yemek ısmarla', 'Buy the supporters’ club dinner'),
        requires: ({ state }) => canAfford(state, 1200),
        lockedHint: t('Yeterli paran yok', 'Not enough money'),
        effects: () => fx(t('Bir akşam, iki yüz taraftar, bitmeyen marşlar.', 'One evening, two hundred fans, endless songs.'), money(-1200), fans(6), happy(4)),
      },
    ],
  },
  {
    id: 'awards.attr_fair_play',
    category: 'awards',
    weight: 1,
    cooldownWeeks: 52,
    minWeek: 30,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') <= 45 && state.hero.seasonStats.yellow === 0 && state.hero.seasonStats.apps >= 15,
    triggers: ['weekly', 'season_end'],
    vars: ({ state }) => ({ apps: state.hero.seasonStats.apps }),
    title: t('Fair Play Ödülü', 'The Fair Play Award'),
    text: t(
      '{apps} maç, tek bir kart yok. Lig seni sezonun fair play ödülüne aday gösterdi. Bir hakem röportajında adını andı: "Onun maçında düdüğü az çalarız."',
      '{apps} games without a single card. The league has nominated you for its fair play award. A referee mentioned you in an interview: "In his games we hardly need the whistle."',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Ödülü okul turnuvasına bağışla', 'Donate the prize to a schools tournament'),
        effects: () => fx(t('Ödül parası bir okul turnuvasının kupalarını aldı. Çocuklar seni sahaya davet etti.', 'The prize money paid for a schools tournament’s trophies. The kids invited you to the final.'), rep(1), fans(3), disc(3), happy(3)),
      },
      {
        label: t('Teşekkür et ve unut', 'Say thanks and move on'),
        effects: () => fx(t('Kısa bir teşekkür, sonra antrenman. Basın bu sadeliği de sevdi.', 'A short thank-you, then training. The press liked the simplicity too.'), press(2), disc(2)),
      },
    ],
  },
  {
    id: 'milestone.attr_elite_ninety',
    category: 'milestone',
    weight: 2,
    cooldownWeeks: 8,
    maxPerCareer: 4,
    conditions: ({ state }) => hasClub(state) && eliteStat(state) !== null,
    triggers: ['weekly', 'training', 'post_match'],
    vars: ({ state }) => {
      const k = eliteStat(state) ?? 'pace'
      return { ...statVars(state, k), key: k }
    },
    title: t('Elit Seviye: 90', 'Elite Level: 90'),
    text: t(
      'Kulübün performans raporunda bir satır altın renge döndü: {statTr} {v}. Bu seviyeye dünyada birkaç yüz oyuncu ulaşabiliyor. Analist "Artık bu senin imzan," dedi.',
      'A line on the club’s performance report has turned gold: {statEn} {v}. Only a few hundred players in the world reach this level. "This is your signature now," said the analyst.',
    ),
    icon: '🌟',
    choices: [
      {
        label: t('Kutla: takıma pasta', 'Celebrate: cake for the squad'),
        effects: ({ state, vars }) => fx(t('Pastanın üstünde tek bir sayı: 90. Herkes bir dilim aldı, sen ise antrenmana erken çıktın.', 'One number on the cake: 90. Everyone had a slice; you went out to train early.'), rel('teammate', 2), morale(4), flags({ [`elite_${String(vars.key ?? 'x')}`]: true }), rep(state.hero.reputation < 60 ? 1 : 0)),
      },
      {
        label: t('Sessizce bir sonraki hedefe bak', 'Quietly set the next target'),
        effects: ({ vars }) => fx(t('"95," diye yazdın dolabının içine. Kimseye söylemedin.', 'You wrote "95" inside your locker door. You told no one.'), morale(2), stress(-1), flags({ [`elite_${String(vars.key ?? 'x')}`]: true })),
      },
    ],
  },

  // ───────────── Rivals ─────────────
  {
    id: 'rivals.attr_provocation',
    category: 'rivals',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state) && A(state, 'aggression') >= 68,
    triggers: ['weekly', 'post_match'],
    vars: ({ state }) => ({ agg: A(state, 'aggression'), com: A(state, 'composure') }),
    title: t('Kışkırtma', 'The Wind-Up'),
    text: t(
      '{rivalPlayer} maç öncesi röportajda seni hedef aldı: "Kafası sıcak biri. İlk on dakikada kırmızı kart görür." Herkes biliyor ki bu bir tuzak. Agresiflik {agg}, soğukkanlılık {com}.',
      'In a pre-match interview {rivalPlayer} singled you out: "Hot-headed. He’ll be sent off inside ten minutes." Everyone knows it’s a trap. Aggression {agg}, composure {com}.',
    ),
    icon: '😤',
    choices: [
      {
        label: t('Sahada cevap ver: ilk ikili mücadele senin', 'Answer on the pitch: win the first duel'),
        risk: 'high',
        hint: t('Soğukkanlılık kartı önler', 'Composure keeps the card away'),
        effects: ({ state }, rng) => rng.chance(0.15 + Math.max(0, A(state, 'aggression') - A(state, 'composure')) / 120)
          ? fx(t('Tuzağa düştün: ilk temas geç, ikinci temas daha geç. Kırmızı kart ve iki maç ceza. {rivalPlayer} kameraya göz kırptı.', 'You took the bait: first contact late, second contact later. A red card and a two-match ban. {rivalPlayer} winked at the camera.'), ban(2), disc(-5), trust(-4), fans(-2))
          : fx(t('İlk topa sert ama temiz girdin. {rivalPlayer} maçın geri kalanında senden uzak durdu.', 'You went into the first ball hard but clean. {rivalPlayer} stayed away from you for the rest of the game.'), fans(4), morale(4), attr('composure', 1)),
      },
      {
        label: t('Gülümse ve görmezden gel', 'Smile and ignore it'),
        effects: () => fx(t('Bütün maç boyunca omzuna vurdu, kulağına konuştu. Sen sadece oynadın. Maç sonu elini sıkmadan gitti.', 'All game he bumped your shoulder and talked in your ear. You just played. He left without shaking hands.'), attr('composure', 1), disc(2), boss(2)),
      },
    ],
  },
  {
    id: 'rivals.attr_double_marked',
    category: 'rivals',
    weight: 0.9,
    cooldownWeeks: 40,
    maxPerCareer: 3,
    conditions: ({ state }) => hasClub(state) && starter(state) && state.hero.reputation >= 35 && (A(state, 'acceleration') >= 80 || A(state, 'dribbling') >= 82 || A(state, 'vision') >= 82),
    triggers: ['weekly'],
    vars: ({ state }) => strengthVars(state),
    title: t('Sana Özel Plan', 'A Plan Just for You'),
    text: t(
      'Rakip hocanın basın toplantısından bir cümle: "{heroLast}\'a iki adam koyacağız. {strTr}: tek kişiyle durmaz." Hoca gülümsedi: "İki kişi sende, demek ki birisi boşta."',
      'One line from the opposing manager’s press conference: "We’ll put two men on {heroLast}. {strEn}: one man won’t stop that." Your manager grinned: "Two on you means someone is free."',
    ),
    icon: '🎯',
    choices: [
      {
        label: t('Adamları üstüne çek, boşu bul', 'Drag them onto you and find the free man'),
        effects: () => fx(t('İki markajcıyı peşinden sürükledin; boş kalan arkadaşın golü attı. Bu sefer asist bile değildi, ama hoca biliyordu.', 'You dragged both markers with you; the free team-mate scored. Not even an assist this time, but the manager knew.'), attr('vision', 1), trust(3), rel('teammate', 2)),
      },
      {
        label: t('Meydan okumayı kabul et: ikisini de geç', 'Take on the challenge: beat them both'),
        risk: 'medium',
        effects: ({ state }, rng) => rng.chance(0.25 + (A(state, 'dribbling') + A(state, 'acceleration')) / 400)
          ? fx(t('İki adamı tek bir çalımla geçtiğin an stadyumda yankılandı. Video gece boyunca döndü.', 'The moment you beat both men with one move echoed round the stadium. The clip ran all night.'), fans(5), fol(3000), morale(4))
          : fx(t('İkisi de seni duvar gibi kapattı. Takım seni bekledi, sen topu kaybettin.', 'They shut you down like a wall. The team waited for you; you lost the ball.'), morale(-3), boss(-1)),
      },
    ],
  },
]

/** The best attribute at 90+ not yet celebrated (one card per attribute). */
function eliteStat(s: GameState): AttributeKey | null {
  const keys = (Object.keys(s.hero.attrs) as AttributeKey[]).filter((k) => s.hero.attrs[k] >= 90 && s.life.flags[`elite_${k}`] !== true)
  keys.sort((a, b) => s.hero.attrs[b] - s.hero.attrs[a])
  return keys[0] ?? null
}
