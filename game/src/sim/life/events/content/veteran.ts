/**
 * Veteran-years content, part 1 (age 28-40): leadership, mentoring, decline,
 * testimonial, coaching badges. Round-2 playtests ran out of fresh cards after
 * season 8; these questions only make sense late in a career, so every card is
 * gated by age and context. Chains link into the existing veteran cards
 * (club.last_dance, teammates.dressing_room_elder, press.pundit_audition,
 * mentor.young_rival) and use anti-spam through cooldowns and per-career caps.
 *
 * Chains:
 * - Protege (3 steps): mentor.protege_selected → mentor.protege_slump → mentor.protege_overtakes
 * - Testimonial (3 steps): club.testimonial_idea → club.testimonial_guests → club.testimonial_proceeds
 * - Coaching badges (4 steps): mentor.badge_course_offer → badge_exam_week → badge_practical → badge_pro_licence
 */
import {
  age, attr, boss, canAfford, chain, chairman, fans, fatigue, flagNum, flags, fol, follow, fx, happy, hasClub, hasFlag, health, injury, money, morale, news, nice, num, press,
  rel, rep, sharp, stress, t, trust, wageX, form,
} from '../dsl'
import type { EventDef } from '../types'

const vet = (s: Parameters<typeof age>[0], from = 29): boolean => age(s) >= from && age(s) <= 40

export const veteranEvents: EventDef[] = [
  // ───────────── Leadership ─────────────
  {
    id: 'teammates.armband_handover', category: 'teammates', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 31) && hasClub(state) && state.hero.reputation >= 40,
    vars: ({ state }) => ({ heir: state.world.players[state.world.clubs[state.hero.contract?.clubId ?? '']?.squad[3] ?? '']?.lastName ?? 'genç yıldız' }),
    title: t('Pazubent Devri', 'Passing the Armband'),
    text: t('Soyunma odasının genç lideri {heir} sana yaklaştı: "Pazubendi bu sezon sen taşıyorsun ama ben hazırım. Bırakmanı istemiyorum; sadece sırayı bilmeni istiyorum." Odada bir sessizlik oldu.', 'The dressing room\'s young leader {heir} approached you: "You carry the armband this season, but I am ready. I do not want you to give it up; I want you to know the line of succession." The room went quiet.'),
    icon: '🎗️',
    choices: [
      { label: t('Pazubendi bu sezon sonunda devret', 'Hand it over at the end of the season'), effects: () => fx(t('Sezon sonunda armband gençe geçti. Sen kenarda ona rehber oldun; oda seni daha çok saymaya başladı.', 'At the end of the season the armband moved on. You stood beside the heir as a guide, and the room began respecting you more.'), attr('leadership', 1), rel('teammate', 5), happy(4), stress(-3), flags({ armband_passed: true })) },
      { label: t('"Beni kimse alamaz" — şimdilik tut', '"Nobody takes it from me" - hold it for now'), risk: 'medium', effects: () => fx(t('Pazubent sende kaldı ama hava gerildi. Genç yıldız sessiz kaldı; ekip ikiye bölündü.', 'The armband stayed with you but the mood tightened. The young star went quiet and the squad split in two.'), rel('teammate', -4), trust(2), stress(3)) },
      { label: t('Birlikte taşıyın: ortak kaptanlık', 'Share it: co-captains'), effects: () => fx(t('Hoca ortak kaptanlığı ilk kez kabul etti. Basın "yeni bir model" yazdı.', 'The manager accepted co-captaincy for the first time. The press wrote about "a new model".'), rel('teammate', 3), boss(2), press(2), attr('leadership', 1)) },
    ],
  },
  {
    id: 'teammates.locker_room_feud', category: 'teammates', weight: 1, cooldownWeeks: 60, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 29) && hasClub(state),
    title: t('İki Yıldızın Kavgası', 'Two Stars at War'),
    text: t('{mate} ile {mate2} antrenmanda birbirine girdi; mesele pozisyon kıskançlığı. {managerName} "ya sen hallet ya ben hallederim" diyerek odadan çıktı. Gözler sende.', '{mate} and {mate2} clashed in training over a jealousy about positions. {managerName} left saying, "you settle it or I will". All eyes are on you.'),
    icon: '🥊',
    choices: [
      { label: t('İkisiyle akşam yemeği ye', 'Take both out for dinner'), effects: () => fx(t('Üç saat konuştunuz. Adam adama barışmadılar ama el sıkıştılar; sen hesabı ödedin.', 'Three hours of talking. They did not quite make up, but they shook hands, and you paid the bill.'), money(-1_500), attr('leadership', 1), rel('teammate', 4), boss(3)) },
      { label: t('Birini haksız çıkar, öbürünü korur', 'Side with one of them'), risk: 'medium', effects: () => fx(t('Bir taraf seni sevdi, diğeri sırtını döndü. Odada iki kamp var.', 'One side loved you, the other turned their back. The room now has two camps.'), rel('teammate', -3), stress(3)) },
      { label: t('Müdahale etme; hoca halletsin', 'Stay out of it; let the manager sort it'), effects: () => fx(t('Hoca ikisini de yedeğe çekti. Sen karışmadın ama oda "bir şey yapmadı" diye fısıldadı.', 'The manager benched both. You stayed out, but the room whispered: "he did nothing".'), boss(-1), rel('teammate', -2)) },
    ],
  },
  {
    id: 'teammates.captain_speech', category: 'teammates', weight: 1, cooldownWeeks: 52, maxPerCareer: 2, triggers: ['match_loss', 'post_match'],
    conditions: ({ state }) => vet(state, 30) && hasClub(state),
    title: t('Devre Arası Konuşması', 'The Half-Time Speech'),
    text: t('İlk yarı 0-2 bitti. Soyunma odası sessiz; hoca tahtaya bakıyor, sana dönüyor: "İki cümle. Ne diyeceksin?"', 'The first half ended 0-2. The dressing room is silent; the manager looks at the board, then at you: "Two sentences. What do you say?"'),
    icon: '📣',
    choices: [
      { label: t('Sert konuş: "Bu forma böyle giyilmez"', 'Be hard: "This shirt is not worn like this"'), risk: 'medium', effects: (_c, rng) => rng.chance(0.55) ? fx(t('Oda sarsıldı ve ikinci yarı bambaşka başladı. Gençler gözlerini kaçırmadan konuştu.', 'The room shook and the second half started like a different game. The youngsters spoke without looking away.'), morale(8), rel('teammate', 3), attr('leadership', 1)) : fx(t('Sözler ters gitti; iki oyuncu sana bakmadan sahaya çıktı.', 'The words backfired; two players walked out without looking at you.'), morale(-5), rel('teammate', -3), stress(3)) },
      { label: t('Sakin ol: "Bir gol, bir an. Sadece bir gol."', 'Stay calm: "One goal, one moment. Only one goal."'), effects: () => fx(t('Cümle odada yankılandı. Pozisyonlar bastırıldı, skor yine de değişmedi ama inanç döndü.', 'The line echoed in the room. The pressure returned; the score did not move yet but belief did.'), morale(5), rel('teammate', 2), sharp(2)) },
      { label: t('Sustur: "Hoca ne diyorsa o"', 'Stay quiet: "Whatever the gaffer says"'), effects: () => fx(t('Hoca kendi planını anlattı; sen yalnızca başınla onayladın.', 'The manager laid out his own plan; you simply nodded.'), boss(2), stress(-1)) },
    ],
  },
  {
    id: 'manager.assistant_hint', category: 'manager', weight: 0.9, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 31) && hasClub(state) && !hasFlag(state, 'coach_path'),
    title: t('"Teknik Ekipte Yerin Var"', '"There Is a Place on My Staff"'),
    text: t('{managerName} antrenman sonrası seni kenara çekti: "Maçları nasıl okuduğunu izliyorum. Birkaç yıl sonra teknik ekipte yerin var. Ama önce dersler lazım: kurslar, rozetler." Bir ömür oynamak zorunda değilsin, diyor.', '{managerName} took you aside after training: "I watch how you read games. In a few years there is a place on my staff. But first, courses and badges." You do not have to play forever, he says.'),
    icon: '🧢',
    choices: [
      { label: t('"Kurs için hazırım"', '"I am ready for the course"'), effects: () => fx(t('Hoca bir broşür uzattı: ilk kurs bu kış. Kendi geleceğinin kapısını araladın.', 'The manager handed you a leaflet: the first course starts this winter. You opened the door to your own future.'), boss(4), attr('vision', 1), flags({ coach_path: true, coach_badge: 0 }), follow(chain('mentor.badge_course_offer', 12))) },
      { label: t('"Önce oynamak istiyorum"', '"I want to keep playing first"'), effects: () => fx(t('Hoca gülümsedi: "Bekliyorum. Ama zaman kimseyi beklemez."', 'The manager smiled: "I will wait. But time waits for nobody."'), trust(2)) },
      { label: t('Kapıyı kapat: "Koçluk bana göre değil"', 'Close the door: "Coaching is not for me"'), effects: () => fx(t('Hoca sessizce notunu aldı. Belki yanılıyordur; belki de sen.', 'The manager made a quiet note. Perhaps he is wrong; perhaps you are.'), boss(-1), flags({ coach_path: false })) },
    ],
  },
  {
    id: 'club.player_council', category: 'club', weight: 0.9, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 30) && hasClub(state) && state.hero.reputation >= 45,
    title: t('Oyuncu Konseyi Kuruluyor', 'A Player Council Forms'),
    text: t('Yönetim kurulu ile oyuncular arasında sürekli sürtüşme çıkıyor: primler, deplasman programı, tesisler. {chairmanName} "bir oyuncu konseyi kuralım, başkanı sen ol" diyor.', 'Friction between board and players keeps flaring: bonuses, away schedules, facilities. {chairmanName} proposes a player council with you as its chair.'),
    icon: '🪑',
    choices: [
      { label: t('Başkanlığı kabul et', 'Accept the chair'), effects: () => fx(t('İlk toplantıda prim sistemi yazıya döküldü. Oyuncular rahatladı, yönetim şaşırdı; ikisi de seni dinledi.', 'At the first meeting the bonus system was put in writing. The players relaxed, the board was surprised, and both listened to you.'), rel('teammate', 5), chairman(3), attr('leadership', 1), stress(3)) },
      { label: t('Yardımcı olarak katıl', 'Join as a member only'), effects: () => fx(t('Başkanlığı gençlere bıraktın; geri planda kaldın ama hâlâ sözün geçiyor.', 'You left the chair to the younger ones; you stayed behind the scenes but your word still carries.'), rel('teammate', 2), chairman(1)) },
      { label: t('Reddet: "Sahada konuşurum"', 'Decline: "I speak on the pitch"'), effects: () => fx(t('Konsey yine kuruldu, ama sen bu kez masada yoktun.', 'The council formed anyway, but you were not at the table.'), rel('teammate', -1), stress(-2)) },
    ],
  },
  {
    id: 'teammates.newcomer_welcome', category: 'teammates', weight: 1, cooldownWeeks: 52, maxPerCareer: 3,
    conditions: ({ state }) => vet(state, 29) && hasClub(state),
    title: t('Yeni Transferin İlk Haftası', 'The Newcomer\'s First Week'),
    text: t('Kulüp yurt dışından bir oyuncu aldı. Kimseyle konuşamıyor, öğle yemeğini tek başına yiyor. {managerName} bakıyor ama bir şey demiyor; mesaj açık: sen ilgilen.', 'The club signed a player from abroad. They cannot talk to anyone and eat lunch alone. {managerName} watches without saying anything; the message is clear: take care of it.'),
    icon: '🤗',
    choices: [
      { label: t('Yanına otur, sofrayı paylaş', 'Sit beside them and share the table'), effects: () => fx(t('İkiniz ellerle ve çeviri uygulamasıyla konuştunuz. Yarısını anlamadınız, ama güldünüz.', 'You talked with hands and a translation app. You understood half of it, but you laughed.'), rel('teammate', 4), happy(4), attr('leadership', 1)) },
      { label: t('Ona kulübü gezdir ve şehri göster', 'Show them the club and the city'), effects: () => fx(t('Hafta sonu şehir turu ve iyi bir çorba. O şehre de sana da ısındı.', 'A weekend city tour and a good soup. They warmed to the city and to you.'), rel('teammate', 5), money(-300), happy(3), fatigue(3)) },
      { label: t('Bırak, kendi yolunu bulsun', 'Leave them to find their own way'), effects: () => fx(t('Bir ay sonra yeni oyuncu yine yalnızdı. Sen de kendini biraz suçlu hissettin.', 'A month later the newcomer was still alone. You felt a little guilty.'), stress(1)) },
    ],
  },

  // ───────────── Mentoring (protege chain) ─────────────
  {
    id: 'mentor.protege_selected', category: 'mentor', weight: 1, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 29) && hasClub(state) && !hasFlag(state, 'protege'),
    vars: ({ state }) => ({ kid: state.world.players[state.world.clubs[state.hero.contract?.clubId ?? '']?.squad[6] ?? '']?.firstName ?? 'Efe' }),
    title: t('Gözünü Diktiğin Çocuk', 'The One You Pick'),
    text: t('Antrenmanda 19 yaşındaki {kid} tüm hatalarını sende görüp kendi oyununa uyarlıyor. Hoca "biri ona yol göstermeli" diyor. Aynı pozisyon, aynı hırs: kendine bakıyorsun.', 'In training 19-year-old {kid} watches every move and bends it into their own game. The coach says someone should guide them. Same position, same drive: you are looking at yourself.'),
    icon: '🧭',
    choices: [
      { label: t('Resmî çırağın olarak al', 'Take them on as your protege'), effects: () => fx(t('Haftalık bir ders seansı kurdunuz. {kid} defter tutuyor; sen ilk kez öğreten tarafta olmaktan hoşlandın.', 'A weekly lesson slot was set up. {kid} keeps a notebook; you found you enjoy being the teacher.'), happy(6), attr('leadership', 1), rel('teammate', 3), flags({ protege: 1 }), follow(chain('mentor.protege_slump', 14))) },
      { label: t('Arada ipucu ver, ama bağlanma', 'Drop tips now and then, but stay detached'), effects: () => fx(t('Birkaç ipucu, bir kahve. Yeter ve fazlası değil.', 'A few tips, a coffee. Enough, no more.'), happy(2), rel('teammate', 1)) },
      { label: t('Sınır koy: "Kendi yolunu bul"', 'Set a boundary: "Find your own road"'), effects: () => fx(t('Çocuk başını salladı; seni örnek almaya yine devam etti.', 'The kid nodded and kept on copying you anyway.'), stress(-1)) },
    ],
  },
  {
    id: 'mentor.protege_slump', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'protege'),
    title: t('Çırağın Çukurda', 'The Protege Hits a Slump'),
    text: t('{kid} dört maçtır forma giyemiyor, sosyal medya "yetenek tükendi" yazıyor. Gece mesaj attı: "Abi, bıraksam mı?" Bu soruyu sen de bir zaman kendine sormuştun.', '{kid} has not started in four games and social media says "talent gone". A late-night message arrived: "Should I quit?" You once asked yourself the same.'),
    icon: '📉',
    choices: [
      { label: t('Ertesi sabah antrenmandan önce konuş', 'Meet before training the next morning'), effects: () => fx(t('Beraber koşu yaptınız. Çocuk bir şey demedi ama sabaha kadar bir şeyler yazdığını söyledi.', 'You went for a run together. The kid said little but admitted writing through the night.'), happy(5), fatigue(3), rel('teammate', 3), follow(chain('mentor.protege_overtakes', 24))) },
      { label: t('Kendi çukur hikâyeni anlat', 'Tell your own slump story'), effects: () => fx(t('Hikâyeni anlatırken ilk kez ağzından kaçırdığın şeyleri dile getirdin. Çocuk dinledi, sen de rahatladın.', 'While telling the story you said things you had never said out loud. The kid listened and you felt lighter.'), happy(6), stress(-3), follow(chain('mentor.protege_overtakes', 24))) },
      { label: t('"Çözümü sahada bulursun" de', 'Say "you will find the answer on the pitch"'), effects: () => fx(t('Mesaj okundu, yanıt gelmedi. Bir haftadır görüşmüyorsunuz.', 'The message was read, no reply came. You have not spoken for a week.'), stress(2), flags({ protege: null })) },
    ],
  },
  {
    id: 'mentor.protege_overtakes', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasClub(state) && hasFlag(state, 'protege'),
    title: t('Çırak Ustayı Geçti', 'The Protege Overtakes You'),
    text: t('{kid} hafta sonu ilk 11\'de başladı. Üstelik senin pozisyonunda. Maçtan sonra tünelde sarıldınız. "Hepsi senin sayende abi." Ama sen kendi ismini yedek listesinde gördün.', '{kid} started on the weekend, in your position. After the match you hugged in the tunnel. "All thanks to you." But you saw your own name on the bench list.'),
    icon: '🌱',
    choices: [
      { label: t('Gururla alkışla', 'Applaud with pride'), effects: () => fx(t('Gazeteler fotoğrafı "Usta ve Çırak" diye yayınladı. İçinde hem keder hem gurur vardı.', 'Papers ran the picture as "Master and Apprentice". Sorrow and pride sat side by side.'), happy(8), press(4), fans(3), rep(1), news(t('{heroName}: "Onun yükselişi benim zaferim"', '{heroName}: "His rise is my victory"'), 1)) },
      { label: t('Yedekte kalmayı kabullen, rol yap', 'Accept the bench and make it your role'), effects: () => fx(t('Hocaya "gerekirse yedekten gelirim" dedin. Rol küçüldü ama saygı büyüdü.', 'You told the gaffer, "I will come off the bench if needed." The role shrank but the respect grew.'), boss(4), trust(3), stress(-2), sharp(-2)) },
      { label: t('Yerinde ısrar et: "Daha bitmedi"', 'Insist: "I am not finished"'), risk: 'medium', effects: () => fx(t('Bir hafta sert çalıştın. Hoca not aldı. Çocukla aranız soğudu.', 'You trained hard for a week. The manager noticed. The kid and you cooled off.'), sharp(3), fatigue(5), rel('teammate', -1), boss(1)) },
    ],
  },
  {
    id: 'mentor.academy_talk', category: 'mentor', weight: 1, cooldownWeeks: 52, maxPerCareer: 3,
    conditions: ({ state }) => vet(state, 29) && hasClub(state),
    title: t('Akademi Günü Konuşması', 'Academy Day Talk'),
    text: t('Akademi, U15 ve U17 takımlarına konuşma yapmanı istiyor. Salonda iki yüz çocuk, birkaç ebeveyn ve bir kamera. En çok sorulan şey: "Nasıl yıldız olunur?"', 'The academy asks you to speak to the U15 and U17 sides. Two hundred kids, a few parents and a camera. The most-asked question: "How do you become a star?"'),
    icon: '🎤',
    choices: [
      { label: t('Gerçeği anlat: sakatlıklar, vazgeçmeler', 'Tell the truth: injuries, doubts, quitting'), effects: () => fx(t('Salon sessizleşti. Birkaç ebeveyn notlar aldı, bir çocuk sonra kapında bekledi.', 'The hall fell silent. A few parents took notes and a kid waited at your door afterwards.'), happy(5), rep(1), press(2), attr('composure', 1)) },
      { label: t('Motivasyon konuşması yap', 'Give a motivational speech'), effects: () => fx(t('Alkış, selfie, sandviç. Çocuklar uçtu.', 'Applause, selfies, sandwiches. The kids flew.'), happy(4), fol(1_500), fans(2)) },
      { label: t('Soru-cevap yap, onlar sorsun', 'Hold a Q&A and let them ask'), effects: () => fx(t('Bir çocuk "hiç mi korkmadın?" diye sordu. İlk kez dürüst bir cevap verdin.', 'A kid asked, "Were you never afraid?" For once you gave an honest answer.'), happy(6), press(2), stress(-2)) },
    ],
  },
  {
    id: 'mentor.youth_clinic', category: 'mentor', weight: 0.9, cooldownWeeks: 52, maxPerCareer: 2, triggers: ['season_end'],
    conditions: ({ state }) => vet(state, 29) && state.hero.reputation >= 35,
    vars: ({ state }) => ({ cost: wageX(state, 2, 2_000) }),
    title: t('Yaz Futbol Kampı', 'The Summer Football Clinic'),
    text: t('Sezon bitti. Mahalle derneği yaz boyu bir futbol kampı kurmak istiyor. Fikir senin: forma, top, yemek. Maliyet yaklaşık {cost}. Çocuklar için, kendin için, belki bir de isim için.', 'The season is over. The neighbourhood association wants a summer football clinic. The idea is yours: kits, balls, meals. About {cost}. For the kids, for you, maybe for a name.'),
    icon: '⛺',
    choices: [
      { label: t('Kampı finanse et ({cost:money})', 'Fund the clinic ({cost:money})'), requires: (c) => canAfford(c.state, num(c, 'cost')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: (c) => fx(t('Üç hafta, yüz çocuk, bitmeyen top. En iyi tatilin buydu.', 'Three weeks, a hundred kids, endless footballs. It was your best holiday.'), money(-num(c, 'cost')), happy(9), stress(-5), fans(4), press(2), rep(1)) },
      { label: t('Katıl ama masrafı derneğe bırak', 'Show up and leave the cost to the association'), effects: () => fx(t('İlk gün geldin, son gün geldin. Çocuklar fotoğrafı çerçeveledi.', 'You came on day one and on the last day. The kids framed the photo.'), happy(4), fans(2)) },
      { label: t('Tatilini koru: "Dinlenmem lazım"', 'Protect your holiday: "I need rest"'), effects: () => fx(t('Plajdaki ilk üç gün güzeldi. Sonra çocukları özledin.', 'The first three days on the beach were lovely. Then you missed the kids.'), stress(-6), health(4)) },
    ],
  },
  {
    id: 'mentor.memoir_proposal', category: 'mentor', weight: 0.8, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 31) && state.hero.reputation >= 55,
    vars: ({ state }) => ({ adv: nice(Math.max(20_000, state.hero.reputation * 800)) }),
    title: t('Anı Kitabı Teklifi', 'A Memoir Offer'),
    text: t('Bir yayınevi kariyerini kitaplaştırmak istiyor. Avans {adv}. Hayalet yazar mı, kendin mi? Dürüst bir kitap hem taraftarlara hem eski rakiplere yönelik cümleler içerecek.', 'A publisher wants to turn your career into a book. The advance is {adv}. A ghostwriter or yourself? An honest book will contain sentences about fans and old rivals alike.'),
    icon: '📖',
    choices: [
      { label: t('Kendin yaz, dürüst ol', 'Write it yourself, honestly'), risk: 'medium', effects: (c) => fx(t('Altı ay boyunca gece yazdın. Kitap çok satmadı ama eleştirmenler sevdi; eski bir rakip aradı: "Cümlen için sağ ol."', 'Six months of writing at night. The book was no bestseller but critics loved it; an old rival called: "Thanks for the sentence."'), money(num(c, 'adv')), rep(2), press(3), fatigue(4), attr('composure', 1)) },
      { label: t('Hayalet yazarla yap', 'Use a ghostwriter'), effects: (c) => fx(t('Kitap hızlı çıktı, kapağı güzeldi, içi ortalama. Satış iyi oldu.', 'The book came out quickly, with a lovely cover and an average inside. Sales were fine.'), money(Math.round(num(c, 'adv') * 0.7)), fol(3_000), press(1)) },
      { label: t('Şimdilik reddet', 'Turn it down for now'), effects: () => fx(t('Yayıncı kartını bıraktı: "Emekli olunca ararız."', 'The publisher left a card: "We will call when you retire."'), stress(-1)) },
    ],
  },

  // ───────────── Decline ─────────────
  {
    id: 'health.first_step_slower', category: 'health', weight: 1, cooldownWeeks: 52, maxPerCareer: 3,
    conditions: ({ state }) => vet(state, 30) && hasClub(state),
    title: t('İlk Adım Eskisi Gibi Değil', 'The First Step Is Not What It Was'),
    text: t('Sprint verilerinde dikkat çeken bir düşüş var. Fizyoterapist "yaş" demedi ama grafiği masaya koydu: tepe hızın geçen yıldan iki kilometre düşük.', 'Sprint data shows a visible drop. The physio did not say "age", but put the chart on the table: your top speed is two km/h lower than last year.'),
    icon: '⏱️',
    choices: [
      { label: t('Oyununu değiştir: pozisyon ve zekâ', 'Change your game: positioning and brains'), effects: () => fx(t('Daha az koşuyor, daha doğru yerde duruyorsun. İlk maçta iki "ömürlük" pozisyon yakaladın.', 'You run less and stand in the right place. In the first game you caught two "career" chances.'), attr('pace', -1), attr('vision', 1), attr('positioning', 1), stress(-1)) },
      { label: t('Hız antrenmanına gömül', 'Bury yourself in speed work'), risk: 'high', effects: (_c, rng) => rng.chance(0.5) ? fx(t('Çalışma işe yaradı; kayıp yarıya indi ama dizlerde sızı başladı.', 'The work paid off; the loss halved, though the knees began to ache.'), attr('pace', 1), fatigue(8), stress(2)) : fx(t('Fazla zorladın; adale gerildi ve iki hafta dışarıdasın.', 'You pushed too hard; a muscle tore and you are out for two weeks.'), injury(2, t('Adale gerilmesi', 'Muscle strain')), attr('pace', -1)) },
      { label: t('Grafiği görmezden gel', 'Ignore the chart'), effects: () => fx(t('Görmezden gelmek grafiği düzeltmedi, ama bir hafta daha rahat uyudun.', 'Ignoring it did not fix the chart, but you slept easier for a week.'), stress(-2), attr('pace', -1)) },
    ],
  },
  {
    id: 'health.recovery_takes_longer', category: 'health', weight: 1, cooldownWeeks: 40, maxPerCareer: 3,
    conditions: ({ state }) => vet(state, 31) && hasClub(state),
    title: t('Toparlanma Uzun Sürüyor', 'Recovery Takes Longer'),
    text: t('Maç sonrası kasların üç gün boyunca ağrıyor. Gençler iki gün sonra tam hızda koşuyor. Fizyoterapist bir "toparlanma planı" önerdi: buz, uyku, haftada bir gün tam dinlenme.', 'After matches your muscles ache for three days. The youngsters run at full pace after two. The physio proposes a "recovery plan": ice, sleep, one full rest day a week.'),
    icon: '🧊',
    choices: [
      { label: t('Planı harfi harfine uygula', 'Follow the plan to the letter'), effects: () => fx(t('Haftalar içinde ağrılar azaldı; uykuya sadık bir adam oldun.', 'Within weeks the aches eased; you became a loyal sleeper.'), health(5), fatigue(-8), stress(-2), attr('stamina', 1)) },
      { label: t('Yarım yamalak uygula', 'Follow half of it'), effects: () => fx(t('Bazı günler buz, bazı günler pizza. Sonuç ortalama.', 'Ice on some days, pizza on others. An average result.'), health(2), fatigue(-3)) },
      { label: t('"Ben ağrı çekerim" — ilerle', '"I can take pain" - push on'), risk: 'high', effects: () => fx(t('Üç hafta sonra bacakların terk etti ve fizyoterapist "söylemiştim" bile demedi.', 'Three weeks later your legs gave out and the physio did not even say "I told you".'), health(-5), fatigue(6), form(-3), stress(3)) },
    ],
  },
  {
    id: 'manager.minutes_managed', category: 'manager', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 32) && hasClub(state),
    title: t('Dakika Yönetimi', 'Minute Management'),
    text: t('{managerName} planını açıkladı: "Seni 60-70 dakika oynatacağım, kalan bölümde gençler. Daha uzun süre seni kullanabilmem için bu gerekli." Planın mantıklı; ama ego başka şey söylüyor.', '{managerName} laid out the plan: "I will play you 60-70 minutes and give the rest to the youngsters. That is how I keep you going longer." The plan is logical; the ego says otherwise.'),
    icon: '⏳',
    choices: [
      { label: t('Kabul et, rolü benimse', 'Accept it and own the role'), effects: () => fx(t('60 dakikada en iyi oyununu çıkarmak için gizli bir ritim buldun. Hoca bunu fark etti.', 'You found a secret rhythm to give your best in 60 minutes. The manager noticed.'), boss(4), trust(3), health(3), fatigue(-4)) },
      { label: t('İtiraz et: "Tam maç oynarım"', 'Object: "I can play the full game"'), risk: 'medium', effects: () => fx(t('Hoca bir hafta düşündü, sonra "tamam, deneyelim" dedi. Beklentiler yükseldi.', 'The manager thought it over for a week, then said "all right, let us try". Expectations rose.'), boss(-2), trust(-1), sharp(2), fatigue(5)) },
      { label: t('Ajanını ara: "Başka çözüm var mı?"', 'Call your agent: "Any other options?"'), effects: () => fx(t('Ajan üç kulüp saydı; ikisi yurt dışında. Telefon sıcak.', 'The agent named three clubs, two abroad. The phone is warm.'), boss(-1), stress(1)) },
    ],
  },
  {
    id: 'fans.grandpa_banner', category: 'fans', weight: 0.9, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 33) && hasClub(state),
    title: t('Tribündeki "Dede" Pankartı', 'The "Grandpa" Banner'),
    text: t('Rakip taraftarlar tribüne dev bir pankart açtı: "Dede, emekli ol." Kameralar seni çekiyor. Takım arkadaşların gülmemeye çalışıyor; sen ise karar vermek zorundasın.', 'Rival fans unfurled a giant banner: "Grandpa, retire." Cameras are on you. Your teammates try not to laugh; you have to decide.'),
    icon: '👴',
    choices: [
      { label: t('Alkışla ve pankarta gülümse', 'Applaud the banner and smile'), effects: () => fx(t('Gülümsemen manşet oldu; rakip taraftarlar bir sonraki maçta pankartı "Saygı" yaptı.', 'Your smile made headlines; next time the rival fans changed the banner to read "Respect".'), fans(4), press(3), happy(5), fol(2_000)) },
      { label: t('Golle cevap ver', 'Answer with a goal'), risk: 'medium', effects: (_c, rng) => rng.chance(0.4) ? fx(t('İlk yarıda attığın gol pankartı bir anda anlamsızlaştırdı.', 'A first-half goal rendered the banner meaningless in an instant.'), morale(8), fans(6), press(3), form(3)) : fx(t('Gol gelmedi; pankart maç boyu sallandı.', 'No goal came; the banner swayed all match.'), morale(-3), stress(3)) },
      { label: t('Görmezden gel', 'Pretend you did not see'), effects: () => fx(t('Gündem hızla değişti. İçinde küçük bir kıvılcım kaldı.', 'The news cycle moved on. A small spark stayed inside you.'), stress(1), morale(2)) },
    ],
  },
  {
    id: 'rumour.retirement_whispers', category: 'rumour', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 33),
    title: t('"Emekli Oluyor" Haberi', '"Set to Retire" Story'),
    text: t('Bir gazete "{heroName} sezon sonunda futbolu bırakıyor" yazdı. Kaynak belirsiz. Menajerin telefonu çalıyor, annen mesaj attı: "Doğru mu?" Aslında kafandan geçiyor olabilir.', 'A paper ran "{heroName} to retire at season end". The source is unclear. Your agent\'s phone is ringing and your mum messaged: "Is it true?" Honestly, it may be crossing your mind.'),
    icon: '📰',
    choices: [
      { label: t('Net yalanla: "Hâlâ oynuyorum"', 'Deny it flatly: "I am still playing"'), effects: () => fx(t('Açıklama manşet oldu. Hoca memnun, taraftar rahatladı.', 'The statement made headlines. The manager was pleased, fans relieved.'), fans(3), boss(2), press(1), morale(3)) },
      { label: t('Cevap verme, belirsiz bırak', 'Do not respond; stay vague'), effects: () => fx(t('Belirsizlik taraftarı huzursuz etti ama kulüpte masaya yeni sözleşme geldi.', 'The uncertainty unsettled fans but a new contract appeared on the table.'), fans(-2), rel('chairman', 2), stress(2)) },
      { label: t('Düşünüyorsan açıkla: "Henüz karar vermedim"', 'Be honest: "I have not decided yet"'), effects: () => fx(t('Dürüstlük övüldü. Annen sevindi, menajerin bayıldı.', 'The honesty was praised. Your mum was happy, your agent nearly fainted.'), press(3), happy(3), stress(-3)) },
    ],
  },
  {
    id: 'health.body_data_review', category: 'health', weight: 0.9, cooldownWeeks: 52, maxPerCareer: 2, triggers: ['new_season'],
    conditions: ({ state }) => vet(state, 31) && hasClub(state),
    title: t('Sezon Başı Vücut Testi', 'Pre-Season Body Test'),
    text: t('Test sonuçları geldi: kas yoğunluğu iyi, ama eklem esnekliği ve toparlanma hızında düşüş var. Performans direktörü üç farklı plan sunuyor.', 'The test results are in: muscle density is fine, but joint flexibility and recovery speed have slipped. The performance director offers three plans.'),
    icon: '🧬',
    choices: [
      { label: t('Güç + esneklik programı', 'Strength + flexibility programme'), effects: () => fx(t('Haftada üç yoga, iki ağırlık. Başta komikti, şimdi dizlerin teşekkür ediyor.', 'Three yoga sessions and two weights a week. Funny at first, now your knees send thanks.'), health(4), attr('agility', 1), fatigue(5)) },
      { label: t('Beslenme ve uyku odaklı plan', 'Nutrition and sleep plan'), effects: () => fx(t('Diyetisyen gece atıştırmalarını yasakladı. Uyku düzenin düzeldi, ruh halin yükseldi.', 'The dietitian banned late-night snacks. Your sleep fixed itself and your mood rose.'), health(3), happy(4), stress(-3)) },
      { label: t('Mevcut yöntemi sürdür', 'Keep your existing method'), effects: () => fx(t('Rutin güzel ama yaşlanma ona uymuyor. Birkaç hafta sonra yeniden yorgunluk geldi.', 'Your routine is great, but ageing does not fit it. Fatigue returned within weeks.'), fatigue(6), stress(1)) },
    ],
  },

  // ───────────── Testimonial (3-step chain) ─────────────
  {
    id: 'club.testimonial_idea', category: 'club', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 33) && hasClub(state) && state.hero.reputation >= 55 && hasFlag(state, 'farewell_season'),
    title: t('Veda Maçı Fikri', 'A Testimonial Match'),
    text: t('{chairmanName}, farewell sezonu duyurunu hatırlatarak teklif etti: "Sana bir veda maçı düzenleyelim. Stat dolsun, taraftar sana son kez bağırsın." Bilet gelirinin dağıtımı sana ait.', '{chairmanName} reminded you of your farewell announcement: "Let us stage a testimonial. The stadium full, fans shouting your name one last time." How to distribute the gate is up to you.'),
    icon: '🎫',
    choices: [
      { label: t('Evet, ama çok büyük olmasın', 'Yes, but keep it modest'), effects: () => fx(t('Taraflar tarihi belirledi: sezon sonunda eski dostlarla dostluk maçı.', 'A date was set: an end-of-season friendly with old friends.'), happy(6), chairman(3), follow(chain('club.testimonial_guests', 12))) },
      { label: t('Muhteşem olsun: dev bir gece', 'Make it spectacular: a huge night'), requires: (c) => canAfford(c.state, 40_000), lockedHint: t('Organizasyon masrafını karşılayamıyorsun.', 'You cannot cover the organisation costs.'), effects: () => fx(t('Konser, havai fişek, dev ekran. Bütçe şişti ama ilgi büyük.', 'Concert, fireworks, a giant screen. The budget swelled but so did the interest.'), money(-40_000), press(4), fans(5), follow(chain('club.testimonial_guests', 12))) },
      { label: t('Hayır: "Sahada veda ederim"', 'No: "I will say goodbye on the pitch"'), effects: () => fx(t('Başkan teklifi nazikçe geri çekti. Belki daha iyisi.', 'The chairman politely withdrew the offer. Perhaps for the best.'), stress(-1)) },
    ],
  },
  {
    id: 'club.testimonial_guests', category: 'club', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Davetli Listesi', 'The Guest List'),
    text: t('Veda maçının davetli listesi masada. Eski hocalar, büyük rakipler, çocukluk arkadaşların, ilk antrenörün. Herkesi çağıramazsın ama kimi çağıracağın bir mesaj.', 'The testimonial guest list is on the table. Former managers, big rivals, childhood friends, your first coach. You cannot invite everyone, but who you pick is a message.'),
    icon: '📜',
    choices: [
      { label: t('Eski hocaları ve takım arkadaşlarını çağır', 'Invite former managers and teammates'), effects: () => fx(t('Soyunma odasında eski şakalar yeniden canlandı. Biri hâlâ aynı korna sesini çıkarıyor.', 'Old jokes revived in the dressing room. Somebody still makes the same horn sound.'), rel('teammate', 5), boss(3), happy(8), follow(chain('club.testimonial_proceeds', 4))) },
      { label: t('Büyük rakipleri çağır', 'Invite the big rivals'), risk: 'medium', effects: () => fx(t('Rakip kaptan "bir efsaneyi uğurlamaya geldim" dedi. Basın bu cümleyi sevdi.', 'The rival captain said, "I came to send off a legend." The press loved the line.'), press(5), rep(2), happy(5), follow(chain('club.testimonial_proceeds', 4))) },
      { label: t('Mahalle arkadaşlarını ve ilk antrenörü çağır', 'Invite neighbourhood friends and your first coach'), effects: () => fx(t('Antrenör ilk kez takım elbise giydi. Sahaya çıktığında bütün stadyum ayağa kalktı.', 'The coach wore a suit for the first time. When he stepped onto the pitch the whole stadium stood.'), happy(10), fans(5), rep(1), follow(chain('club.testimonial_proceeds', 4))) },
    ],
  },
  {
    id: 'club.testimonial_proceeds', category: 'club', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ gate: nice(Math.max(80_000, state.hero.reputation * 6_000)) }),
    title: t('Bilet Gelirinin Kaderi', 'Where the Gate Goes'),
    text: t('Veda maçından {gate} gelir geldi. Maç gecesi unutulmazdı; şimdi kasadaki paranın akıbetine karar vereceksin.', 'The testimonial raised {gate}. The night was unforgettable; now you decide what happens to the money in the till.'),
    icon: '💰',
    choices: [
      { label: t('Tamamını bağışla (hastane + akademi)', 'Donate it all (hospital + academy)'), effects: () => fx(t('Hastane yeni bir pediatri salonu, akademi yeni toplar aldı. Başlık: "Veda bir miras bıraktı".', 'The hospital got a paediatric ward, the academy new balls. Headline: "A farewell that left a legacy".'), rep(3), press(5), fans(6), happy(10), news(t('{heroName}\'in veda maçı gelirinin tamamı bağışlandı', 'All of {heroName}\'s testimonial proceeds donated'), 1)) },
      { label: t('Yarısını bağışla, yarısını kendine ayır', 'Donate half, keep half'), effects: (c) => fx(t('Dengeli bir karar. Kimse itiraz etmedi; kimse alkışlamadı da.', 'A balanced decision. Nobody objected, nobody cheered.'), money(Math.round(num(c, 'gate') / 2)), rep(1), press(1)) },
      { label: t('Kendine al: "Kariyerimin karşılığı"', 'Keep it: "The reward for a career"'), risk: 'high', effects: (c) => fx(t('Kasa doldu, ama taraftar fısıldadı: "Veda maçı kendi cebi için miydi?"', 'The wallet filled, but fans whispered: "Was the testimonial for his own pocket?"'), money(num(c, 'gate')), fans(-6), press(-4), rep(-1)) },
    ],
  },

  // ───────────── Coaching badges (4-step chain) ─────────────
  {
    id: 'mentor.badge_course_offer', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'coach_path'),
    vars: ({ state }) => ({ fee: wageX(state, 1, 3_000) }),
    title: t('Antrenörlük Kursu: C Lisansı', 'Coaching Course: C Licence'),
    text: t('Federasyon kış kursunu açtı. Hafta içi iki akşam teori, hafta sonu pratik. Ücret {fee}. Soyunma odasında yarı alaycı yarı hayranlıkla "hoca geldi" diyorlar.', 'The federation opened its winter course. Two evenings of theory per week, practice on weekends. The fee is {fee}. In the dressing room they say "here comes the gaffer", half teasing, half admiring.'),
    icon: '📋',
    choices: [
      { label: t('Kursa yaz ({fee:money})', 'Enrol ({fee:money})'), requires: (c) => canAfford(c.state, num(c, 'fee')), lockedHint: t('Kurs ücretini karşılayamıyorsun.', 'You cannot cover the fee.'), effects: (c) => fx(t('İlk dersin konusu 4-3-3\'te üçüncü adam koşusuydu. Not tutarken kendi hatalarını fark ettin.', 'Lesson one was the third-man run in a 4-3-3. Taking notes, you noticed your own mistakes.'), money(-num(c, 'fee')), attr('vision', 1), fatigue(3), flags({ coach_badge: 1 }), follow(chain('mentor.badge_exam_week', 12))) },
      { label: t('Sezon sonuna ertele', 'Postpone to the end of the season'), effects: () => fx(t('Federasyon "başvuru süresi uzatıldı" dedi. Sıra bir yıl sonra yine sende.', 'The federation said the deadline was extended. Your turn comes again a year later.'), stress(-1)) },
      { label: t('Vazgeç', 'Give up the idea'), effects: () => fx(t('Broşürü çekmeceye koydun. Hoca başını salladı.', 'You put the leaflet in a drawer. The manager nodded.'), boss(-1), flags({ coach_path: false })) },
    ],
  },
  {
    id: 'mentor.badge_exam_week', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => flagNum(state, 'coach_badge') >= 1,
    title: t('Sınav Haftası', 'Exam Week'),
    text: t('Yazılı sınav maç haftana denk geldi. Antrenmanda bir gözün defterde, bir gözün topta. Hoca: "Önceliğin ne?"', 'The written exam fell on your match week. In training one eye on the notebook, one on the ball. The manager asks: "What comes first?"'),
    icon: '📝',
    choices: [
      { label: t('Önce sınav: notlar ve uyku', 'Exam first: notes and sleep'), effects: () => fx(t('Sınavdan 91 aldın. Maça da iyi hazırlandın; çünkü iyi uyudun.', 'You scored 91 on the exam and went into the match well rested.'), attr('vision', 1), happy(4), flags({ coach_badge: 2 }), follow(chain('mentor.badge_practical', 10))) },
      { label: t('İkisini birden götür', 'Juggle both'), risk: 'medium', effects: (_c, rng) => rng.chance(0.6) ? fx(t('Sınavı geçtin, maçta da golü attın. Gece ikiye kadar çalışmak değdi.', 'You passed and scored in the match. Studying until two was worth it.'), flags({ coach_badge: 2 }), happy(6), fatigue(7), follow(chain('mentor.badge_practical', 10))) : fx(t('Sınavda ortalamanın altında kaldın ve tekrar etmek zorundasın; maç da vasattı.', 'You came in under the pass mark and have to retake it; the match was mediocre too.'), stress(5), form(-2), flags({ coach_badge: 1 }), follow(chain('mentor.badge_exam_week', 12))) },
      { label: t('Maça odaklan, sınavı ertele', 'Focus on the match and defer the exam'), effects: () => fx(t('Maçta iyi oynadın; sınav için yeni tarih yarım yıl sonra.', 'You played well; the exam retake is half a year away.'), boss(2), form(2), flags({ coach_badge: 1 }), follow(chain('mentor.badge_exam_week', 26))) },
    ],
  },
  {
    id: 'mentor.badge_practical', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => flagNum(state, 'coach_badge') >= 2,
    title: t('Pratik Uygulama: Gençlere Antrenman', 'Practical: Coaching the Youth'),
    text: t('Rozet için bir U14 takımına tam antrenman yaptırman gerekiyor. Sınav kurulu kenarda not alıyor. Çocuklar seni tanıyor; bazıları senin forman ile geldi.', 'For the badge you must run a full session for a U14 side. The panel takes notes on the touchline. The kids know who you are; some turned up in your shirt.'),
    icon: '🏃',
    choices: [
      { label: t('Sade ve net: üç alıştırma', 'Simple and clear: three drills'), effects: () => fx(t('Dakikalar, açıklamalar, tekrar. Kurul "doğal öğretmen" diye not aldı.', 'Timing, explanation, repetition. The panel noted "natural teacher".'), attr('leadership', 1), happy(5), flags({ coach_badge: 3 }), follow(chain('mentor.badge_pro_licence', 20))) },
      { label: t('Kendi tarzında oyun sistemi öğret', 'Teach your own playing system'), risk: 'medium', effects: (_c, rng) => rng.chance(0.55) ? fx(t('Çocuklar anladı, ritim tuttu. Kurul "özgün" yazdı.', 'The kids got it and the rhythm held. The panel wrote "original".'), attr('vision', 1), happy(6), flags({ coach_badge: 3 }), follow(chain('mentor.badge_pro_licence', 20))) : fx(t('Çok karmaşıktı; çocuklar karıştı. Uygulamayı tekrarlayacaksın.', 'It was too complex; the kids got confused. You will repeat the practical.'), stress(4), follow(chain('mentor.badge_practical', 16))) },
      { label: t('Çocuklarla oynayarak öğret', 'Teach by playing with them'), effects: () => fx(t('Sonunda herkes gülüyordu. Kurul "sevgi dolu" yazdı ama "çalışma yapısını netleştir" dedi.', 'In the end everyone was smiling. The panel wrote "warm" but said "tighten the structure".'), happy(8), flags({ coach_badge: 3 }), follow(chain('mentor.badge_pro_licence', 20))) },
    ],
  },
  {
    id: 'mentor.badge_pro_licence', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => flagNum(state, 'coach_badge') >= 3,
    vars: ({ state }) => ({ fee: wageX(state, 3, 10_000) }),
    title: t('Pro Lisans Mülakatı', 'The Pro Licence Interview'),
    text: t('Son basamak: Pro Lisans mülakatı. Panelde eski bir teknik direktör, bir yönetici ve bir psikolog var. Ücret {fee}. Soru: "Bir takımı bir yılda nasıl dönüştürürsünüz?"', 'The final step: the Pro Licence interview. On the panel sit a former manager, an executive and a psychologist. Fee: {fee}. The question: "How would you transform a team in a year?"'),
    icon: '🎓',
    choices: [
      { label: t('Kültür, oyun planı, bireysel gelişim', 'Culture, game plan, individual development'), requires: (c) => canAfford(c.state, num(c, 'fee')), lockedHint: t('Ücreti karşılayamıyorsun.', 'You cannot cover the fee.'), effects: (c) => fx(t('Panel gülümsedi. Aylar sonra elinde "Pro Lisans" belgesi var. Artık kapı gerçekten açık.', 'The panel smiled. Months later you hold the Pro Licence. The door is truly open now.'), money(-num(c, 'fee')), attr('leadership', 2), attr('vision', 1), rep(2), happy(10), press(3), flags({ coach_badge: 4 }), news(t('{heroName} Pro Lisans aldı', '{heroName} earns the Pro Licence'), 1)) },
      { label: t('Veri odaklı bir cevap ver', 'Answer with data-driven analysis'), requires: (c) => canAfford(c.state, num(c, 'fee')), lockedHint: t('Ücreti karşılayamıyorsun.', 'You cannot cover the fee.'), effects: (c) => fx(t('Panel etkilendi ama "insan tarafını da unutma" dedi. Lisans verildi.', 'The panel was impressed but said "do not forget the human side". The licence was granted.'), money(-num(c, 'fee')), attr('vision', 2), rep(1), happy(8), flags({ coach_badge: 4 })) },
      { label: t('Mülakatı bir sonraki döneme bırak', 'Defer the interview'), effects: () => fx(t('Bir yıl sonra aynı panel, aynı soru. Belki cevap değişir.', 'A year later, the same panel and the same question. Perhaps the answer changes.'), stress(-1), follow(chain('mentor.badge_pro_licence', 52))) },
    ],
  },
  {
    id: 'manager.player_coach_offer', category: 'manager', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => hasClub(state) && flagNum(state, 'coach_badge') >= 2 && vet(state, 33),
    title: t('Oyuncu-Antrenör Teklifi', 'A Player-Coach Offer'),
    text: t('{managerName}: "Seni yarı oyuncu, yarı antrenör olarak istiyorum. Sabahları gençlere ders, hafta sonu 45 dakikalık maçlar. Maaş biraz düşer ama bir ayağın geleceğe basar."', '{managerName}: "I want you as half player, half coach. Mornings with the youngsters, 45-minute spells on weekends. The pay dips but one foot stands in the future."'),
    icon: '🧢',
    choices: [
      { label: t('Kabul et', 'Accept'), effects: () => fx(t('Sabahları not tutan, öğleden sonra top koşturan bir adam oldun. Ruhun hafifledi; bacakların da.', 'You became a man who takes notes in the morning and runs after the ball in the afternoon. Your mind felt lighter, and your legs, too.'), boss(5), happy(8), attr('leadership', 1), fatigue(-5), money(-5_000), flags({ player_coach: true })) },
      { label: t('Yarı yarıya kabul et: yalnızca ders ver', 'Accept half: only coach in training'), effects: () => fx(t('Hoca kabul etti. Antrenman sahasında yeni bir rol buldun.', 'The manager agreed. You found a new role on the training pitch.'), boss(3), happy(5), attr('leadership', 1)) },
      { label: t('Reddet: "Tam oyuncuyum"', 'Decline: "I am a full player"'), effects: () => fx(t('Hoca nazikçe gülümsedi: "Kapı hep açık."', 'The manager smiled politely: "The door is always open."'), trust(1)) },
    ],
  },
]
