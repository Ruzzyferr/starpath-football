/**
 * Veteran-years content, part 2 (age 28-40): media career, family milestones,
 * legacy. Hooks into earlier cards through flags (`pundit_contact` from
 * press.pundit_audition, `farewell_season` from club.last_dance, `foundation`,
 * `mentee`, `proj:*` projects) so late-career questions feel connected.
 *
 * Chains:
 * - Media (3 steps): press.podcast_offer → press.podcast_guest → press.podcast_controversy
 * - Child and football (2 steps): family.child_chooses_football → family.child_tryout
 */
import {
  age, attr, boss, canAfford, chain, chairman, fans, fatigue, flags, fol, follow, fx, happy, hasClub, hasFlag, hasRel, money, relVal, trust, form, news, nice, num, press, rel, rep, stress, t,
  wageX,
} from '../dsl'
import { academyLevel, stadiumLevel } from '../../projects'
import type { EventDef } from '../types'

const vet = (s: Parameters<typeof age>[0], from = 29): boolean => age(s) >= from && age(s) <= 40

export const veteran2Events: EventDef[] = [
  // ───────────── Media career ─────────────
  {
    id: 'press.podcast_offer', category: 'press', weight: 1, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 29) && state.hero.reputation >= 40,
    vars: ({ state }) => ({ fee: nice(Math.max(4_000, state.hero.reputation * 120)) }),
    title: t('Kendi Podcast Programın', 'Your Own Podcast'),
    text: t('İki tanıdık yapımcı haftalık bir podcast önerdi: soyunma odası hikâyeleri, antrenör sohbetleri, bol kahve. Haftada bir akşam ve ayda {fee} sabit. Mikrofonun önünde en büyük riskin ağzından kaçan bir cümle.', 'Two familiar producers propose a weekly podcast: dressing-room stories, coach chats, plenty of coffee. One evening a week and {fee} a month. The biggest risk at the mic is a sentence that slips out.'),
    icon: '🎧',
    choices: [
      { label: t('Kabul et: hikâye anlat', 'Accept: tell stories'), effects: (c) => fx(t('İlk bölüm 80 bin dinlenme aldı. Anlatırken kendi kariyerini yeniden yaşadın.', 'Episode one got 80 thousand plays. Telling stories, you relived your own career.'), money(num(c, 'fee')), fol(5_000), press(3), happy(5), flags({ podcast: true }), follow(chain('press.podcast_guest', 8))) },
      { label: t('Yalnızca konuk ol', 'Appear only as a guest'), effects: () => fx(t('Bir bölüm, bir çay. Yapımcılar "her zaman kapımız açık" dedi.', 'One episode, one tea. The producers said, "our door is always open."'), fol(1_500), press(1)) },
      { label: t('Reddet: "Mikrofonla aram iyi değil"', 'Decline: "Microphones and I do not mix"'), effects: () => fx(t('Yapımcılar saygıyla geri çekildi.', 'The producers withdrew with respect.'), stress(-1)) },
    ],
  },
  {
    id: 'press.podcast_guest', category: 'press', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'podcast'),
    title: t('Konuk: Eski Rakip', 'Guest: The Old Rival'),
    text: t('Yapımcılar sürpriz bir konuk buldu: kariyerin boyunca seni tekmeleyen eski savunmacı. Sohbet sıcak başladı; sonra 2019\'daki derbi gündeme geldi.', 'The producers found a surprise guest: the old defender who kicked you for years. The chat started warm; then a derby from years back came up.'),
    icon: '🎙️',
    choices: [
      { label: t('Güçlü kal: gülerek geç', 'Stay strong: laugh it off'), effects: () => fx(t('Gülüşme klibi viral oldu. Eski rakip "kardeşim" dedi ve sarıldınız.', 'The laugh clip went viral. The old rival said "my brother" and you hugged.'), fol(3_000), press(3), happy(6), follow(chain('press.podcast_controversy', 10))) },
      { label: t('Konuyu açarak eski hesaplaşmayı konuş', 'Open the old wound and talk it out'), risk: 'medium', effects: () => fx(t('Sohbet gerildi ama sonunda iki adam bir şey söyledi: özür ve teşekkür.', 'The chat tensed up, but in the end two men said something: sorry and thanks.'), happy(7), press(4), rel('press', 2), follow(chain('press.podcast_controversy', 10))) },
      { label: t('Sohbeti kesmesini yapımcıdan iste', 'Ask the producer to cut the topic'), effects: () => fx(t('Bölüm yumuşak ama biraz sönük çıktı.', 'The episode came out gentle but a bit flat.'), press(1)) },
    ],
  },
  {
    id: 'press.podcast_controversy', category: 'press', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'podcast'),
    title: t('Kesilmiş Klip, Büyük Gürültü', 'A Clipped Quote, a Big Row'),
    text: t('Podcast\'ten kesilmiş bir cümlen "hocam biraz yaşlı" diye başlıkta. Bağlam başka, ama ifadenin yankısı büyük. Hoca ve yönetim aradı.', 'A sentence clipped from the podcast reads "the gaffer is a bit old" in the headline. The context was different, but the echo is big. The manager and the board have called.'),
    icon: '🔥',
    choices: [
      { label: t('Tam bölümü yayınla, bağlamı göster', 'Publish the full episode and show the context'), effects: () => fx(t('Tam bölüm izlendikçe tepkiler yatıştı. Hocadan kısa bir mesaj geldi: "Tamam."', 'As the full episode was watched, the reaction died down. A short message came from the manager: "Fine."'), press(2), boss(1), fol(2_000)) },
      { label: t('Hocadan özür dile', 'Apologise to the manager'), effects: () => fx(t('Hoca sakin bir kahve içirdi ve "gençlere de böyle söyle" dedi.', 'The manager poured a calm coffee and said: "say that to the youngsters too."'), boss(4), press(-1), stress(-2)) },
      { label: t('Podcast\'i bırak', 'Quit the podcast'), effects: () => fx(t('Mikrofonu kapatmak güvenli ama keyifsiz oldu.', 'Switching off the mic was safe but joyless.'), stress(-3), happy(-4), flags({ podcast: null }), fol(-800)) },
    ],
  },
  {
    id: 'press.column_offer', category: 'press', weight: 0.9, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 30) && state.hero.reputation >= 45,
    vars: ({ state }) => ({ fee: wageX(state, 0.6, 3_000) }),
    title: t('Haftalık Köşe Yazısı', 'A Weekly Column'),
    text: t('Bir spor gazetesi pazar günleri için "Sahanın İçinden" adlı köşe önerdi. Haftada 800 kelime, her yazıya {fee}. Dürüst yazarsan iyi; çok dürüst yazarsan savaş.', 'A sports daily offers a Sunday column called "From Inside the Pitch". 800 words a week, {fee} per piece. Honest is good; too honest is war.'),
    icon: '✍️',
    choices: [
      { label: t('Dürüst ve cesur yaz', 'Write honestly and boldly'), risk: 'medium', effects: (c) => fx(t('İlk yazı tartışma yarattı, okurlar fark etti. Birkaç meslektaş "sinirlendik ama haklı" dedi.', 'The first piece caused a row and readers noticed. A few colleagues said: "we were angry but you were right."'), money(num(c, 'fee')), press(3), fol(2_500), rel('teammate', -2), attr('vision', 1)) },
      { label: t('Güvenli yaz: takım ve taraftar', 'Write safe: team and fans'), effects: (c) => fx(t('Dostça yazılar, sıcak yorumlar, birkaç alkış.', 'Friendly pieces, warm comments, a few claps.'), money(num(c, 'fee')), press(1), fans(2)) },
      { label: t('Hayalet yazar kullan', 'Use a ghostwriter'), effects: (c) => fx(t('Yazılar iyi ama sana pek benzemiyor. Bir okur fark etti.', 'The pieces are good but sound little like you. One reader noticed.'), money(Math.round(num(c, 'fee') * 0.6)), press(-1), stress(-2)) },
    ],
  },
  {
    id: 'press.studio_regular', category: 'press', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 31) && hasFlag(state, 'pundit_contact'),
    vars: ({ state }) => ({ fee: nice(Math.max(5_000, state.hero.reputation * 160)) }),
    title: t('Kanalın Sabit Konuğu', 'The Channel\'s Regular Guest'),
    text: t('Daha önce stüdyoda gösterdiğin sakin ve teknik üslup kanalın hoşuna gitti. Sezon boyunca her pazartesi gece programına çağrılıyorsun: {fee}/bölüm. Pazartesi, maç haftasının toparlanma günü.', 'The calm, technical style you showed in the studio won the channel over. You are invited every Monday night all season: {fee} an episode. Monday is your recovery day after the match.'),
    icon: '📺',
    choices: [
      { label: t('Kabul et, pazartesi çalış', 'Accept, work Mondays'), effects: (c) => fx(t('Pazartesi gecesi hem analiz hem sohbet. Yorgunluk arttı, ama gelecek hayallerine bir ses ekledin.', 'Monday nights became analysis and chat. Fatigue grew, but you added a voice to your future dreams.'), money(num(c, 'fee') * 4), press(4), fol(4_000), fatigue(5), attr('vision', 1)) },
      { label: t('Ayda bir kez kabul et', 'Accept once a month'), effects: (c) => fx(t('Dengeli bir çözüm. Kanal sevinmedi ama anlayış gösterdi.', 'A balanced solution. The channel was not thrilled but understanding.'), money(num(c, 'fee')), press(2), fol(1_500)) },
      { label: t('Nazikçe reddet', 'Politely decline'), effects: () => fx(t('Yapımcı "dönüşünü bekleriz" dedi.', 'The producer said: "we will wait for your return."'), stress(-1)) },
    ],
  },
  {
    id: 'press.commentary_booth', category: 'press', weight: 0.9, cooldownWeeks: 78, maxPerCareer: 2, triggers: ['national_break'],
    conditions: ({ state }) => vet(state, 31) && state.hero.reputation >= 50,
    title: t('Yorum Kabininde', 'In the Commentary Booth'),
    text: t('Milli ara. Bir kanal sana dostluk maçının canlı yorumunu önerdi. Mikrofonun yanında eski bir yorumcu: "Gözlerini kapat ve sadece topu anlat."', 'International break. A channel offers you live commentary of a friendly. An old commentator sits beside you: "Close your eyes and just describe the ball."'),
    icon: '🔊',
    choices: [
      { label: t('Heyecanla anlat', 'Narrate with excitement'), effects: () => fx(t('Gol anındaki çığlığın klip oldu. Telefonun "yeni yorumcu" mesajlarıyla doldu.', 'Your scream at the goal became a clip. Your phone filled with "new commentator" messages.'), fol(3_500), press(3), happy(6), money(6_000)) },
      { label: t('Analitik ve sakin ol', 'Stay analytical and calm'), effects: () => fx(t('Maçı satır satır okuyan tarz izleyicinin hoşuna gitti.', 'Reading the match line by line pleased viewers.'), press(3), attr('vision', 1), money(6_000)) },
      { label: t('Reddet, maç izle', 'Decline and just watch the match'), effects: () => fx(t('Arka koltuktan izlemek bazen daha keyifli.', 'Watching from a back seat can be nicer.'), stress(-2)) },
    ],
  },

  // ───────────── Family milestones ─────────────
  {
    id: 'family.first_steps', category: 'family', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 28) && hasRel(state, 'partner') && relVal(state, 'partner') >= 60,
    title: t('İlk Adımlar', 'First Steps'),
    text: t('{partnerName} telefonu uzattı: küçük yavru yürüyor! Ama deplasman yolculuğuna bir saat var. Videoyu şimdi izlemek mi, bir sonraki sefer gerçeğini canlı görmek mi?', '{partnerName} held out the phone: the little one is walking! But your away trip leaves in an hour. Watch the video now or catch the next steps live?'),
    icon: '👣',
    choices: [
      { kind: 'certain', label: t('Yolculuğu ertele, evde kal', 'Delay the trip and stay home'), risk: 'medium', effects: () => fx(t('Hoca kaşını kaldırdı ama anladı. O akşam çocuğun düştüğü ve güldüğü an hafızana yazıldı.', 'The manager raised an eyebrow but understood. That evening, the moment the child fell and laughed was etched in your memory.'), happy(12), rel('partner', 6), boss(-2), stress(-5)) },
      { label: t('Görüntülü ara, yola çık', 'Video-call and travel'), effects: () => fx(t('Telefon ekranında adımlar. Yol boyunca gülümsedin.', 'Steps on a phone screen. You smiled all the way.'), happy(6), rel('partner', 2)) },
      { label: t('Videoyu sonra izle', 'Watch the video later'), effects: () => fx(t('Videoyu üç gün sonra izledin. {partnerName} hissetti.', 'You watched the video three days later. {partnerName} felt it.'), rel('partner', -4), happy(-2)) },
    ],
  },
  {
    id: 'family.school_pickup', category: 'family', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 30) && hasRel(state, 'partner'),
    title: t('Okul Çıkışı', 'School Pick-Up'),
    text: t('Çocuğun okulda "meslek günü" var. Ebeveynler mesleklerini anlatıyor ve herkes seni bekliyor. Aynı gün antrenman var.', 'Your child\'s school has a career day. Parents explain their jobs and everyone expects you. There is training the same day.'),
    icon: '🏫',
    choices: [
      { kind: 'certain', label: t('Antrenmanı kaçır, okula git', 'Skip training and go to school'), risk: 'medium', effects: () => fx(t('Sınıf seni dinledi ve bir çocuk "büyüyünce kaleci olacağım" dedi. Hocaya özür mesajı yazdın.', 'The class listened to you and one kid said, "I will be a goalkeeper when I grow up." You sent the manager an apology.'), happy(10), rel('partner', 4), boss(-2), trust(-1)) },
      { label: t('Videoyla katıl', 'Join through video'), effects: () => fx(t('Sınıfın projektöründe yüzün belirdi. Çocuğun bundan bir gün sonra "babam/annem ekranda" demesi sevimliydi.', 'Your face filled the class projector. It was cute when your child said the next day, "that was on the screen."'), happy(5), rel('partner', 1)) },
      { label: t('Antrenmandan sonra uğra', 'Stop by after training'), effects: () => fx(t('Okulda yalnızca birkaç öğrenci kalmıştı. Yine de bir çizim hediye aldın.', 'Only a few pupils were left at school. You still got a drawing as a present.'), happy(4), fatigue(3)) },
    ],
  },
  {
    id: 'family.parents_anniversary', category: 'family', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 29) && hasRel(state, 'mother'),
    vars: ({ state }) => ({ party: wageX(state, 1, 5_000) }),
    title: t('Anne-Baba Evliliğinin 40. Yılı', 'Your Parents\' 40th Anniversary'),
    text: t('{motherName} ve eşi kırkıncı evlilik yıllarını kutluyor. Sürpriz bir parti planı var: {party}. Ama tarih maç haftasına denk geliyor.', '{motherName} and spouse celebrate forty years of marriage. A surprise party is planned: {party}. But the date falls on match week.'),
    icon: '💐',
    choices: [
      { label: t('Büyük partiyi sen karşıla ({party:money})', 'Pay for the big party ({party:money})'), requires: (c) => canAfford(c.state, num(c, 'party')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: (c) => fx(t('Anneannen ağlayarak güldü, babanın kravatı çok komik görünüyordu. Gece bitince annen sarıldı.', 'Grandma laughed through tears, your dad\'s tie looked hilarious. When the night ended, your mum hugged you.'), money(-num(c, 'party')), happy(12), rel('mother', 8), stress(-4)) },
      { label: t('Küçük bir akşam yemeği hazırla', 'Host a small dinner'), effects: () => fx(t('Sofra küçük ama sevgi büyüktü. Babanın eski hikâyeleri ilk kez kimse kesmeden dinlendi.', 'A small table with big love. Your dad\'s old stories were heard in full for once.'), money(-1_200), happy(8), rel('mother', 4)) },
      { label: t('Maç sonrası aramayla yetin', 'Settle for a call after the match'), effects: () => fx(t('Annen "anlıyorum" dedi. Sesi kısıktı.', 'Your mum said "I understand." Her voice was quiet.'), rel('mother', -3), happy(-3)) },
    ],
  },
  {
    id: 'family.sibling_wedding', category: 'family', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 28) && hasRel(state, 'sibling'),
    title: t('Kardeşin Evleniyor', 'Your Sibling Is Getting Married'),
    text: t('{siblingName} düğün tarihini açıkladı: ligin kritik haftası. Tanık olmanı istiyor. Hoca "bir hafta izin" demiyor; ama "bir akşam" diyebilir.', '{siblingName} announced a wedding date in the league\'s critical week. You are asked to be best man. The manager will not say "a week off", but might say "one evening".'),
    icon: '💍',
    choices: [
      { label: t('Hocayı ikna et, düğüne git', 'Convince the manager and go'), effects: (_c, rng) => rng.chance(0.7) ? fx(t('Hoca "git ama sabah ilk iş antrenmanda ol" dedi. Düğünde iki saat kaldın ve konuşma yaptın.', 'The manager said: "go, but be at training first thing." You stayed two hours and gave the speech.'), happy(12), rel('sibling', 8), boss(-1), fatigue(5)) : fx(t('Hoca izin vermedi, sen gittin. Ceza kesildi ama kardeşinin gözlerindeki mutluluk değerdi.', 'The manager refused, you went anyway. A fine followed but your sibling\'s joy was worth it.'), money(-4_000), happy(10), rel('sibling', 8), boss(-5), trust(-3)) },
      { label: t('Maçı oyna, düğünü videodan izle', 'Play the match and watch the wedding on video'), effects: () => fx(t('Maçta iyiydin ama kardeşin telefonda ağladı: "Fotoğrafta yoksun."', 'You were fine in the match, but your sibling cried on the phone: "You are not in the photo."'), rel('sibling', -5), happy(-4), form(1)) },
      { label: t('Kısa bir tören videosu kaydet', 'Record a short video toast'), effects: () => fx(t('Düğünde ekrana yansıyan konuşman alkışlandı.', 'Your video toast was applauded on the big screen.'), happy(5), rel('sibling', 3)) },
    ],
  },
  {
    id: 'family.child_chooses_football', category: 'family', weight: 1, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 30) && hasRel(state, 'partner') && relVal(state, 'partner') >= 50,
    title: t('"Ben de Futbolcu Olacağım"', '"I Will Be a Footballer Too"'),
    text: t('Çocuk sofrada ilan etti: "Ben de futbolcu olacağım." {partnerName} sana baktı. Basın baskısı, sakatlıklar, yalnızlık: hepsini biliyorsun. Yine de çocuğun gözleri parlıyor.', 'At the table your child announced: "I will be a footballer too." {partnerName} looked at you. Pressure from press, injuries, loneliness: you know them all. Yet your child\'s eyes shine.'),
    icon: '🧒',
    choices: [
      { label: t('Destekle: haftada iki gün birlikte antrenman', 'Support it: train together twice a week'), effects: () => fx(t('Bahçedeki mini maçlar haftanın en iyi iki saati oldu.', 'Mini matches in the garden became the best two hours of the week.'), happy(10), rel('partner', 4), stress(-4), follow(chain('family.child_tryout', 30))) },
      { label: t('Önce okul, sonra futbol', 'School first, football second'), effects: () => fx(t('Çocuk biraz bozuldu ama notlar yükseldi. {partnerName} gülümsedi.', 'The child sulked a little but grades rose. {partnerName} smiled.'), rel('partner', 3), happy(3)) },
      { label: t('Dikkatli ol: "Bu yol kolay değil"', 'Be careful: "This road is not easy"'), effects: () => fx(t('Gerçekleri dürüstçe anlattın; çocuk bir süre sustu, sonra "yine de istiyorum" dedi.', 'You told the truth honestly; the child went quiet, then said: "I still want it."'), happy(4), stress(1), follow(chain('family.child_tryout', 36))) },
    ],
  },
  {
    id: 'family.child_tryout', category: 'family', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    title: t('İlk Akademi Denemesi', 'The First Academy Trial'),
    text: t('Çocuğun yerel bir akademi denemesi var. Hoca soy ismini görünce kaşını kaldırdı. Çocuk titriyor. Beklenti büyük, sen ise kenarda ne yapacaksın?', 'Your child has a trial at a local academy. The coach raised an eyebrow when he saw the surname. The child is trembling. Expectations are high, and what will you do on the touchline?'),
    icon: '🥅',
    choices: [
      { label: t('Kenarda sessiz izle', 'Watch silently from the side'), effects: () => fx(t('Sessizce izledin; çocuk ilk tüneli attı ve gülümsedi.', 'You watched quietly; the child nutmegged somebody and grinned.'), happy(10), rel('partner', 3)) },
      { kind: 'certain', label: t('Sahaya in, birkaç ipucu ver', 'Step on and give a few tips'), risk: 'medium', effects: () => fx(t('Hoca "aile müdahalesi" dedi. Çocuk utandı; ama pas verirken güzel gülüyordu.', 'The coach said "family interference". The child blushed, but smiled lovely while passing.'), happy(4), rel('partner', -1), press(1)) },
      { label: t('Gelme, çocuk kendi adını kursun', 'Stay away; let them make their own name'), effects: () => fx(t('Çocuk bir mesaj attı: "Sensiz daha rahattım." Gururlu ve biraz kırgın hissettin.', 'The child sent a message: "I was more relaxed without you." You felt proud and a bit hurt.'), happy(5), stress(-1)) },
    ],
  },
  {
    id: 'family.grandparent_farewell', category: 'family', weight: 0.8, cooldownWeeks: 156, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 30) && hasRel(state, 'mother'),
    title: t('Dedeye Veda', 'Saying Goodbye to Grandpa'),
    text: t('Seni futbolla tanıştıran dede hastanede. Hekimler "birkaç gün" diyor. Önümüzdeki hafta kritik maç. Dede telefonla "Git, oyna. Beni maçında izlerim" diyor.', 'The grandfather who introduced you to football is in hospital. Doctors say "a few days". A key match is next week. On the phone he says: "Go play. I will watch you in the match."'),
    icon: '🕯️',
    choices: [
      { kind: 'certain', label: t('Yanında kal, maçı kaçır', 'Stay by his side and miss the match'), risk: 'medium', effects: () => fx(t('Dedenin elini tuttun, eski maç hikâyelerini dinledin. Son gece bir şey fısıldadı: "Gururluyum."', 'You held his hand and listened to old match stories. On the last night he whispered, "I am proud."'), happy(-6), stress(5), rel('mother', 5), boss(-2), flags({ grandpa_farewell: true })) },
      { label: t('Maçı oyna, dedenin için gol ara', 'Play the match and play for him'), effects: (_c, rng) => rng.chance(0.5) ? fx(t('Gol attın ve parmağını gökyüzüne kaldırdın. Sonra hastaneye koştun.', 'You scored and pointed to the sky. Then you ran to the hospital.'), happy(4), stress(4), form(3), fans(4), flags({ grandpa_farewell: true })) : fx(t('Maçta kafan başka yerdeydi. Sonra hastaneye gittin; zaman kalmamıştı.', 'Your mind was elsewhere in the match. Then you went to the hospital; there was no time left.'), happy(-8), stress(6), form(-3), flags({ grandpa_farewell: true })) },
      { label: t('Hastaneye kısa sürede git ve dön', 'Make a brief hospital visit and return'), effects: () => fx(t('Bir saatlik ziyaret ağır geçti. Dede gülümsedi: "Şimdi git."', 'The one-hour visit was heavy. Grandpa smiled: "Now go."'), happy(-3), stress(3), flags({ grandpa_farewell: true })) },
    ],
  },
  {
    id: 'family.relocation_question', category: 'family', weight: 1, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 31) && hasRel(state, 'partner') && hasClub(state),
    title: t('"Memlekete Dönelim mi?"', '"Should We Go Home?"'),
    text: t('{partnerName} geceyi mutfakta geçirdi: çocuğun okulu, ailenin yakınlığı, hava, mutluluk. "Hangi yıl dönmek istersin? Bunu düşünmek gerek." Sözleşmen bir yıl daha var.', '{partnerName} spent the night in the kitchen: the child\'s school, family nearby, the weather, happiness. "Which year do you want to go back? We have to think about it." Your contract has a year left.'),
    icon: '🧭',
    choices: [
      { label: t('Sözleşme bitince dönelim', 'We go home when the contract ends'), effects: () => fx(t('Takvime yeni bir tarih yazıldı. Gelecek somutlaştı ve gece uykuların huzurlu oldu.', 'A new date was written in the calendar. The future turned concrete and your nights became peaceful.'), rel('partner', 5), happy(5), stress(-3), flags({ homecoming_plan: true })) },
      { label: t('Önce kariyer, aile bekleyebilir', 'Career first; family can wait'), risk: 'medium', effects: () => fx(t('Konuşma bitti ama mutfaktaki sessizlik bitmedi.', 'The talk ended but the silence in the kitchen did not.'), rel('partner', -5), happy(-3), stress(3)) },
      { label: t('Yazlık bir ev al: iki şehirde yaşa', 'Buy a holiday home: live in two cities'), requires: (c) => canAfford(c.state, 150_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Hafta sonları memlekete uçuyorsunuz. Yorgun ama mutlu bir düzen.', 'Weekend flights home. A tiring but happy arrangement.'), money(-150_000), rel('partner', 6), happy(8), fatigue(4)) },
    ],
  },

  // ───────────── Legacy ─────────────
  {
    id: 'milestone.stand_naming', category: 'milestone', weight: 0.9, cooldownWeeks: 156, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 33) && hasClub(state) && state.hero.reputation >= 60 && state.hero.careerStats.apps >= 200,
    title: t('Tribüne Adın Veriliyor', 'A Stand Takes Your Name'),
    text: t('{clubName} kuzey tribününe senin adını vermek istiyor. {chairmanName}: "Futbol hepimizin, ama bazı isimler tribünde yaşar." Taraftar grubu imza topladı.', '{clubName} wants to name the north stand after you. {chairmanName}: "Football belongs to everyone, but some names live in the stands." The fan group collected signatures.'),
    icon: '🏷️',
    choices: [
      { label: t('Gururla kabul et', 'Accept with pride'), effects: () => fx(t('Açılış gecesinde tabelayı gördüğünde göğsünde bir şey yandı. Kimseye anlatamadın.', 'On unveiling night, when you saw the sign, something burned in your chest. You could not tell anyone.'), rep(3), fans(8), press(4), happy(12), chairman(3), news(t('{clubName} tribününe {heroName}\'in adı verildi', '{clubName} stand renamed after {heroName}'), 1)) },
      { label: t('Taraftarlar arasında anlam taşıyan bir isim iste', 'Ask for a name that belongs to the fans'), effects: () => fx(t('Tribün "Kuzey Kapısı - {heroName} Şerefine" oldu. Tutumun yankı buldu.', 'The stand became "North Gate - in honour of {heroName}". Your attitude resonated.'), fans(10), press(3), happy(8), rep(2)) },
      { label: t('Kibarca reddet: "Henüz bitmedi"', 'Politely decline: "It is not over yet"'), effects: () => fx(t('Başkan "bunu sezon sonu tekrar konuşuruz" dedi.', 'The chairman said: "we will revisit this at season end."'), fans(2), press(1)) },
    ],
  },
  {
    id: 'milestone.statue_proposal', category: 'milestone', weight: 0.7, cooldownWeeks: 208, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 34) && hasClub(state) && state.hero.reputation >= 78,
    vars: ({ state }) => ({ cost: nice(Math.max(60_000, state.hero.reputation * 2_000)) }),
    title: t('Heykel Önerisi', 'A Statue Proposal'),
    text: t('Taraftar derneği stadyumun önüne bronz bir heykelini dikmek istiyor. Para toplanıyor ama {cost} açık var. Heykelin gülümseyen mi, ciddi mi, pozisyonlu mu olacağı sana soruluyor.', 'The supporters\' association wants a bronze statue of you outside the stadium. Money is being raised but {cost} is still missing. You are asked whether it should smile, look serious or strike a pose.'),
    icon: '🗿',
    choices: [
      { label: t('Açığı kapat ({cost:money})', 'Close the gap ({cost:money})'), requires: (c) => canAfford(c.state, num(c, 'cost')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: (c) => fx(t('Heykel gol sevincinle dikildi. Çocuklar altında fotoğraf çektiriyor.', 'The statue went up in your goal celebration. Kids take photos beneath it.'), money(-num(c, 'cost')), rep(4), fans(10), press(5), happy(12)) },
      { label: t('Taraftarlar kendi toplasın', 'Let the fans raise it themselves'), effects: () => fx(t('Para üç ayda toplandı; mütevazı bir bronz oldu. Taraftar gurur duydu.', 'The money was raised in three months; a modest bronze resulted. Fans were proud.'), rep(2), fans(8), happy(7)) },
      { label: t('"Heykel yerine akademiye bağış yapın"', '"Donate to the academy instead of a statue"'), effects: () => fx(t('Dernek bunu sevdi. Heykel yerine akademiye yeni bir saha geldi.', 'The association loved it. Instead of a statue, the academy got a new pitch.'), rep(3), fans(6), press(4), happy(8)) },
    ],
  },
  {
    id: 'awards.lifetime_award', category: 'awards', weight: 0.8, cooldownWeeks: 156, maxPerCareer: 1, triggers: ['season_end'],
    conditions: ({ state }) => vet(state, 34) && state.hero.reputation >= 70 && state.hero.careerStats.apps >= 300,
    title: t('Yaşam Boyu Başarı Ödülü', 'Lifetime Achievement Award'),
    text: t('Futbolcular derneği sana "Yaşam Boyu Başarı Ödülü" vermek istiyor. Tören gecesi sahneye çıkıp konuşma yapacaksın. Konuşma metnini sen mi yazacaksın, yoksa içinden mi geleni mi söyleyeceksin?', 'The players\' association wants to give you a Lifetime Achievement Award. At the ceremony you will give a speech. Write it yourself or speak from the heart?'),
    icon: '🏆',
    choices: [
      { label: t('Yazılı, sade bir konuşma', 'A short, written speech'), effects: () => fx(t('Üç dakikalık konuşman iyi karşılandı. Salon ayağa kalktı.', 'Your three-minute speech was well received. The hall stood up.'), rep(3), press(4), happy(10), fans(4)) },
      { label: t('İçinden geleni söyle', 'Speak from the heart'), risk: 'medium', effects: (_c, rng) => rng.chance(0.65) ? fx(t('Sesinin titremesi herkesi etkiledi. Eski hocan gözlerini sildi.', 'Your trembling voice touched everybody. Your old coach wiped his eyes.'), rep(4), press(5), happy(12), fol(6_000)) : fx(t('Konuşma uzadı, bir iki yerde dağıldı. Yine de alkış aldın.', 'The speech ran long and rambled in places. You still got applause.'), rep(2), press(1), happy(6)) },
      { label: t('Ödülü eski takım arkadaşlarına ithaf et', 'Dedicate it to old teammates'), effects: () => fx(t('Salonda onlarca eski takım arkadaşı ayağa kalktı. Bu ödül bir ekibin ödülü oldu.', 'Dozens of former teammates stood in the hall. The award became a team\'s award.'), rel('teammate', 6), rep(3), press(4), happy(11)) },
    ],
  },
  {
    id: 'fans.mural_in_hood', category: 'fans', weight: 0.9, cooldownWeeks: 104, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 31) && state.hero.reputation >= 50,
    title: t('Mahalledeki Duvar Resmi', 'The Mural in Your Old Neighbourhood'),
    text: t('Çocukluk mahalleni gezerken bir duvarda dev bir resim görüyorsun: yüzün, formanla, altında "Bizim çocuk". Yanında üç çocuk top oynuyor. Biri seni tanıdı.', 'Walking through your old neighbourhood, you spot a huge mural on a wall: your face in your shirt, below it: "Our kid". Three kids play ball beside it. One recognises you.'),
    icon: '🎨',
    choices: [
      { label: t('Çocuklarla top oyna', 'Play ball with the kids'), effects: () => fx(t('Yarım saatlik maç, iki gol ve üç selfie. En güzel antrenman buydu.', 'Half an hour of football, two goals, three selfies. That was your best training session.'), happy(10), fans(4), fatigue(2), fol(2_500)) },
      { label: t('Duvarı yenilemek için sanatçıya destek ver', 'Support the artist to keep the mural fresh'), requires: (c) => canAfford(c.state, 6_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Sanatçı yeni bir figür ekledi: ilk antrenörün. Mahalle bayram yaptı.', 'The artist added a new figure: your first coach. The district celebrated.'), money(-6_000), fans(6), press(2), happy(8)) },
      { label: t('Fotoğrafı çek, sessizce yürü', 'Take a photo and walk on quietly'), effects: () => fx(t('Fotoğrafı telefonun ekranında tutuyorsun. Bazen bu da yeter.', 'You keep the photo on your phone screen. Sometimes that is enough.'), happy(5)) },
    ],
  },
  {
    id: 'milestone.shirt_retired', category: 'milestone', weight: 0.8, cooldownWeeks: 208, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 34) && hasClub(state) && state.hero.reputation >= 65 && hasFlag(state, 'farewell_season'),
    title: t('Forma Numaran Emekli Ediliyor', 'Your Shirt Number Is Retired'),
    text: t('{clubName} sezon sonu töreninde {shirt} numaralı formayı emekli etmeyi planlıyor. Yeni gelen oyuncu ise "bu numarayı giymek şerefti" diyordu. Karar kulübün, ama senin sözün çok değerli.', '{clubName} plans to retire shirt number {shirt} at the season-end ceremony. A newcomer had said it was an honour to wear it. The decision is the club\'s, but your word carries weight.'),
    icon: '🔟',
    choices: [
      { label: t('Memnuniyetle kabul et', 'Accept gladly'), effects: () => fx(t('Tören sırasında forma ışıklarla tavana çıktı. Salon çıldırdı.', 'During the ceremony the shirt rose to the rafters in lights. The hall went wild.'), rep(3), fans(9), press(4), happy(12), chairman(3)) },
      { label: t('Numarayı gençlere miras bırakmayı öner', 'Suggest passing the number to the youth'), effects: () => fx(t('Önerin tartışma yarattı ama herkes cömertliğini övdü. Akademi lideri numarayı "hak edene" verecek.', 'Your suggestion started debate but everyone praised the generosity. The academy leader will hand it to "the deserving".'), fans(5), press(4), rep(2), happy(8)) },
      { label: t('Mütevazı ol: "Takımın numarası"', 'Stay modest: "It is the team\'s number"'), effects: () => fx(t('Kulüp bir plaket asıp numarayı oyunda tuttu. Taraftar mütevazılığını sevdi.', 'The club hung a plaque and kept the number in play. Fans loved your modesty.'), fans(4), press(2), happy(6)) },
    ],
  },
  {
    id: 'milestone.fan_letter_decade', category: 'milestone', weight: 0.9, cooldownWeeks: 104, maxPerCareer: 2,
    conditions: ({ state }) => vet(state, 32) && state.hero.careerStats.apps >= 250,
    title: t('On Yıl Sonra Gelen Mektup', 'The Letter Ten Years Later'),
    text: t('Kulübe bir mektup geldi. Yazan, çocukken sana forma imzalatmış biri: "O imza hayatımı değiştirdi. Şimdi doktorum ve hastane odama formanı astım." Mektubun sonunda bir fotoğraf var.', 'A letter reached the club. The writer once had you sign a shirt as a child: "That signature changed my life. I am a doctor now and hung your shirt in my office." A photo is enclosed.'),
    icon: '✉️',
    choices: [
      { label: t('Şahsen cevap yaz', 'Reply personally'), effects: () => fx(t('Uzun bir mektup yazdın. Bir hafta sonra gelen yanıt şuydu: "Çocuklarımla maça gelebilir miyiz?"', 'You wrote a long letter. A week later came the reply: "May I bring my children to a match?"'), happy(9), rep(1), fans(3)) },
      { label: t('Kulüpte maça davet et', 'Invite them to a match at the club'), effects: () => fx(t('Maç sonrası tünelde o forma imzalandı: bu kez yeni bir imzayla.', 'After the match, in the tunnel, the shirt was signed again with a new signature.'), happy(10), fans(4), press(2)) },
      { label: t('Mektubu kaydet, cevap verme', 'Keep the letter and do not reply'), effects: () => fx(t('Mektubu çekmecede sakladın. Bazı duygular cevap istemez.', 'You kept the letter in a drawer. Some feelings do not ask for a reply.'), happy(4)) },
    ],
  },
  {
    id: 'milestone.career_museum', category: 'milestone', weight: 0.8, cooldownWeeks: 156, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 33) && state.hero.reputation >= 55 && (state.life.assets.some((a) => a.defId.startsWith('col_')) || state.hero.trophies.length >= 4),
    vars: ({ state }) => ({ n: state.hero.trophies.length }),
    title: t('Müze Sana Soruyor', 'The Museum Asks'),
    text: t('Şehir müzesi "futbol ve toplum" sergisi için eşyalarını istiyor: forma, kupalar ({n} kupa) ve koleksiyonun. Sergi iki yıl sürecek. Eşyaların sigortası müzede; ama evin sessizleşecek.', 'The city museum wants items for its "Football and Society" exhibition: shirts, trophies ({n} trophies) and your collection. It runs for two years. The items are insured by the museum; but your home will go quiet.'),
    icon: '🏛️',
    choices: [
      { label: t('Tüm koleksiyonu emanet et', 'Lend the entire collection'), effects: () => fx(t('Sergide kupalar cam altında parladı. Açılışta çocuklar "o mu?" diye fısıldaştı.', 'At the exhibition trophies shone under glass. At the opening, children whispered: "is that him?"'), rep(3), press(4), fans(4), happy(9), flags({ museum_lent: true })) },
      { label: t('Yalnızca formalarını ver', 'Lend only your shirts'), effects: () => fx(t('Üç forma, iki fotoğraf ve bir kısa video. Küçük ama gururlu bir köşe.', 'Three shirts, two photos and a short video. A small, proud corner.'), rep(1), press(2), happy(5)) },
      { label: t('Reddet: "Bunlar evde kalmalı"', 'Decline: "These belong at home"'), effects: () => fx(t('Müze nazikçe teşekkür etti. Dolap yerinde.', 'The museum thanked you politely. The cabinet stays put.'), stress(-1)) },
    ],
  },
  {
    id: 'milestone.letter_to_child', category: 'milestone', weight: 0.8, cooldownWeeks: 156, maxPerCareer: 1,
    conditions: ({ state }) => vet(state, 32) && (hasRel(state, 'partner') || state.life.money >= 1_000_000),
    title: t('Gelecekteki Çocuğa Mektup', 'A Letter to a Future Child'),
    text: t('Eski bir çekmeceden kendi çocukluk defterini buldun: "Futbolcu olacağım. Çok koşacağım." Bu defterin devamını yazmak, ileride bir çocuğa mektup bırakmak güzel olabilir.', 'From an old drawer you pulled your own childhood notebook: "I will be a footballer. I will run a lot." Writing its sequel, a letter for a child to come, could be lovely.'),
    icon: '📔',
    choices: [
      { label: t('Dürüst bir mektup yaz', 'Write an honest letter'), effects: () => fx(t('Zaferleri, korkuları, pişmanlıkları anlattın. Mektubu mühürleyip kasaya bıraktın.', 'You wrote victories, fears and regrets. You sealed the letter and left it in the safe.'), happy(8), stress(-4), attr('composure', 1), flags({ child_letter: true })) },
      { label: t('Kısa bir tavsiye yaz: "Önce eğlen"', 'Write short advice: "Have fun first"'), effects: () => fx(t('Beş satır, bir çizim ve bir top. Fazlası gereksiz.', 'Five lines, a drawing and a ball. Anything more is unnecessary.'), happy(5), stress(-2)) },
      { label: t('Vazgeç, zamanı henüz değil', 'Skip it; the time is not yet'), effects: () => fx(t('Defteri çekmeceye geri koydun.', 'You put the notebook back in the drawer.'), stress(-1)) },
    ],
  },
  {
    id: 'milestone.legacy_audit', category: 'milestone', weight: 1, cooldownWeeks: 78, maxPerCareer: 2, triggers: ['season_end'],
    conditions: ({ state }) => vet(state, 31) && state.life.money >= 1_500_000 && academyLevel(state.life) + stadiumLevel(state.life) === 0 && !hasFlag(state, 'proj:fund'),
    title: t('Miras Soruları', 'Questions About Your Legacy'),
    text: t('Bir gazeteci sezon sonu röportajında dedi ki: "Kariyer bittiğinde geride ne bırakacaksın? Kupa, rekor… başka?" Hesabında milyonlar var ama geride kalacak bir şey yok.', 'A journalist asked in the season-end interview: "When the career ends, what will you leave behind? Trophies, records... anything else?" There are millions in your account but nothing to leave behind.'),
    icon: '❓',
    choices: [
      { label: t('Akademi kurma fikrini araştır', 'Look into starting an academy'), effects: () => fx(t('Muhasebecin ve eski antrenörünle bir plan çizmeye başladın.', 'You began sketching a plan with your accountant and old coach.'), happy(4), stress(-1), follow(chain('money.academy_blueprint', 6))) },
      { label: t('Çocuklara stadyum yapma fikrini araştır', 'Look into building a community stadium'), effects: () => fx(t('Belediye sana bir arsa dosyası gönderdi.', 'The city sent you a file on a plot.'), happy(4), follow(chain('charity.stadium_plan', 6))) },
      { label: t('"Önce oynayayım, sonra düşünürüm"', '"Let me play first and think later"'), effects: () => fx(t('Soru kafanda kaldı. Bazen cevap sonradan gelir.', 'The question stayed in your head. Sometimes the answer comes later.'), stress(1)) },
    ],
  },
]
