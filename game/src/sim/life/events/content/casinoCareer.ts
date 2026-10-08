/**
 * Casino: the career cost of heavy gambling, plus VIP, racehorse and "betting
 * on your own match" cards (playtest round 2: "casino less fun, career cost
 * weak and invisible"; WP-E 2.12#52).
 *
 * Cost ladder (addiction meter, see casino.ts weeklyCasinoTick for the quiet
 * weekly drain): the club's manager, partner, press, sponsors and teammates
 * each react at their own threshold, so a heavy gambler sees specific people
 * pushing back instead of an abstract number.
 *
 * Chains:
 * - Partner ultimatum (2 steps): casino.partner_ultimatum → casino.recovery_week
 * - Racehorse (3 steps): casino.horse_offer → casino.horse_race_day → casino.horse_retirement
 */
import { addiction, boss, canAfford, chain, chairman, disc, fans, flags, fol, follow, fx, form, happy, hasClub, hasFlag, hasRel, money, morale, news, nice, num, press, rel, relNpc, rep, stress, t, trust, wageX } from '../dsl'
import { casinoVipTier } from '../../casino'
import type { EventDef } from '../types'

const addic = (s: { life: { casino: { addiction: number } } }): number => s.life.casino.addiction

export const casinoCareerEvents: EventDef[] = [
  // ───────────── Career cost ladder ─────────────
  {
    id: 'casino.manager_warning', category: 'casino', weight: 1.4, cooldownWeeks: 26, maxPerCareer: 3,
    conditions: ({ state }) => hasClub(state) && addic(state) >= 35,
    title: t('Hocanın Gözü Üstünde', 'The Manager Has Noticed'),
    text: t('{managerName} antrenman sonrası seni odasına çağırdı. Masada kumarhane çıkışlı birkaç fotoğraf. "Kondisyon düşüyor, gözlerin kan çanağı. Bana ne olduğunu söyle."', '{managerName} called you into the office after training. On the desk: a few photos from outside the casino. "Your condition is slipping and your eyes are bloodshot. Tell me what is going on."'),
    icon: '🧐',
    choices: [
      { label: t('Dürüst ol, yardım iste', 'Be honest and ask for help'), effects: () => fx(t('Hoca bir an sustu, sonra kulübün psikoloğunun numarasını verdi. "Bunu bilen bir kişi daha var, o da ben." Kendini bir yük daha hafif hissettin.', 'The manager paused, then gave you the club psychologist\'s number. "Two people know now, and I am the other." You felt one weight lighter.'), trust(3), boss(3), stress(-4), addiction(-8), flags({ casino_excluded_weeks: 4 })) },
      { label: t('İnkâr et: "Sadece sosyal bir akşamdı"', 'Deny it: "Just a social evening"'), risk: 'medium', effects: (_c, rng) => rng.chance(0.4) ? fx(t('Hoca inandı gibi yaptı. Ama gözünü senden ayırmadı.', 'The manager pretended to believe you. But he kept his eye on you.'), trust(-2), boss(-2), stress(2)) : fx(t('Hoca telefonundan başka bir fotoğraf gösterdi. İnkâr ettiğin için daha çok bozuldu.', 'The manager showed you another photo on his phone. He was angrier because you lied.'), trust(-6), boss(-5), disc(-4), morale(-4)) },
      { label: t('Sinirlen: "Özel hayatıma karışma"', 'Snap: "Stay out of my private life"'), effects: () => fx(t('Kapı çarptı. Ertesi sabah kadro listesinde adın bir basamak aşağıdaydı.', 'The door slammed. Next morning your name was one rung lower on the squad list.'), boss(-6), trust(-5), disc(-3), form(-3)) },
    ],
  },
  {
    id: 'casino.partner_ultimatum', category: 'casino', weight: 1.3, cooldownWeeks: 40, maxPerCareer: 2,
    conditions: ({ state }) => hasRel(state, 'partner') && addic(state) >= 45,
    title: t('Geceleri Yalnız Kalan Taraf', 'The One Left Alone at Night'),
    text: t('{partnerName} eşiğe geldi: "Üç gecedir eve gelmiyorsun, kredi kartı ekstresi masada. Kazandığında anlatıyorsun, kaybettiğinde saklıyorsun. Ya bu bitecek ya biz."', '{partnerName} reached the doorway: "You have not been home for three nights and the card statement is on the table. You tell me when you win and hide it when you lose. Either this stops or we do."'),
    icon: '💔',
    choices: [
      { label: t('Söz ver, kumarhaneden uzak kal (4 hafta)', 'Promise and stay away (4 weeks)'), effects: () => fx(t('{partnerName} sana sarıldı, ama omzundaki eli titriyordu. "Bu kez gerçekten."', '{partnerName} hugged you, though the hand on your shoulder trembled. "This time for real."'), rel('partner', 6), happy(2), stress(-3), addiction(-6), flags({ casino_excluded_weeks: 4 }), follow(chain('casino.recovery_week', 4))) },
      { label: t('Savun: "Kontrol bende"', 'Defend yourself: "I am in control"'), risk: 'high', effects: () => fx(t('Tartışma sabaha kadar sürdü. {partnerName} bavulunu yarı doldurdu, sonra vazgeçti. Soğuk bir ateşkes var.', 'The argument lasted till morning. {partnerName} half-packed a bag, then gave up. A cold ceasefire holds.'), rel('partner', -10), happy(-6), stress(5)) },
      { label: t('Kapıyı çarp, çık', 'Slam the door and leave'), risk: 'high', effects: () => fx(t('Gece kumarhanede kaldın. Sabah telefonda tek bir mesaj: "Anahtarlar masada."', 'You spent the night at the casino. In the morning a single message: "Keys are on the table."'), rel('partner', -18), happy(-10), stress(7), addiction(4)) },
    ],
  },
  {
    id: 'casino.recovery_week', category: 'casino', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => addic(state) >= 0,
    title: t('Dördüncü Hafta', 'Week Four'),
    text: t('Bir ay kumarhane yok. Akşamlar uzun, sessizlik yüksek, ama {partnerName} sofrayı iki kişilik kuruyor. Telefondaki kumarhane kısa mesajı hâlâ duruyor: "VIP masanız hazır."', 'A month without the casino. Evenings are long and the silence is loud, but {partnerName} sets the table for two. The casino text is still on your phone: "Your VIP table is ready."'),
    icon: '🌱',
    choices: [
      { label: t('Mesajı sil, engelle', 'Delete and block the number'), effects: () => fx(t('Engelle tuşuna basarken parmağın titredi. Sonra derin bir nefes aldın.', 'Your finger shook pressing block. Then you breathed out.'), addiction(-10), happy(6), rel('partner', 4), stress(-4)) },
      { label: t('Yeni bir alışkanlık seç: sabah koşusu', 'Pick a new habit: morning runs'), effects: () => fx(t('Sabah beşte bir yürüyüş, altıda bir koşu. Hayat yavaş yavaş geri geliyor.', 'A walk at five, a run at six. Life is slowly coming back.'), addiction(-8), happy(5), form(2)) },
      { label: t('"Bir akşam zarar vermez"', '"One evening will do no harm"'), risk: 'high', effects: () => fx(t('Kapıdaki görevli adını söylemeden karşıladı. O gece bir saat, yarın iki saat…', 'The doorman greeted you without needing your name. One hour tonight, two tomorrow...'), addiction(7), stress(4), rel('partner', -4)) },
    ],
  },
  {
    id: 'casino.press_expose', category: 'casino', weight: 1.2, cooldownWeeks: 40, maxPerCareer: 2,
    conditions: ({ state }) => addic(state) >= 55 && state.hero.reputation >= 25,
    title: t('Tabloda "Kumar Batağı"', '"Gambling Spiral" in the Tabloid'),
    text: t('Bir tabloid, kumarhane çalışanlarına dayanarak "{heroName}\'in gizli kumar borcu" haberini hazırlıyor. Editör sana yanıt hakkı veriyor: yarın yayınlıyor.', 'A tabloid, citing casino staff, is preparing "{heroName}\'s secret gambling debts". The editor gives you a right of reply: it runs tomorrow.'),
    icon: '🗞️',
    choices: [
      { label: t('Önce kendin açıkla ve yardım al', 'Come out first and get help'), effects: () => fx(t('Açıklamanın tonu içten. Haber "cesur itiraf"a döndü; taraftarlar bağrına bastı ama sponsorlar kaşını kaldırdı.', 'The tone of your statement was sincere. The story turned into a "brave confession"; fans embraced you, sponsors raised an eyebrow.'), fans(5), press(3), rep(-1), stress(-5), addiction(-10), flags({ casino_excluded_weeks: 8 }), news(t('{heroName} kumar sorununu açıkladı', '{heroName} opens up about gambling problem'), 0)) },
      { label: t('Avukatla durdurmaya çalış', 'Try to stop it through lawyers'), risk: 'high', requires: (c) => canAfford(c.state, 25_000), lockedHint: t('Avukat masrafını karşılayamazsın.', 'You cannot pay the lawyers.'), effects: (_c, rng) => rng.chance(0.3) ? fx(t('Haber ertelendi, ama editör "bir sonraki sefer yayınlarız" dedi.', 'The story was delayed, but the editor said: "next time, we run it."'), money(-25_000), press(-1), stress(3)) : fx(t('Avukat mektubu haberi büyüttü: "Ünlü futbolcu haberi susturmak istedi."', 'The lawyer\'s letter inflated the story: "Famous player tries to silence press."'), money(-25_000), press(-8), fans(-4), rep(-2), stress(6)) },
      { label: t('Yorum yapma', 'No comment'), effects: () => fx(t('Haber çıktı. Başlıklar sertti; hoca ve yönetim konuyu toplantıya aldı.', 'The story ran. The headlines were harsh; the manager and board put it on the agenda.'), press(-6), fans(-3), rep(-2), disc(-4), chairman(-3), stress(5)) },
    ],
  },
  {
    id: 'casino.sponsor_clause', category: 'casino', weight: 1.1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => addic(state) >= 50 && state.life.sponsors.length > 0,
    vars: ({ state }) => ({ brandName: state.life.sponsors[0]?.brand ?? 'Sponsor', fine: nice(Math.max(8_000, (state.life.sponsors[0]?.weekly ?? 1_000) * 8)) }),
    title: t('Ahlak Maddesi', 'The Morals Clause'),
    text: t('{brandName} avukatları sözleşmeye "itibar ve ahlak maddesi" ekleyip sana gönderdi: kumarhane haberleri sürerse sözleşme feshedilir. Ceza bedeli {fine}.', '{brandName}\'s lawyers sent a contract rider adding a "reputation and morals clause": if casino stories continue, the deal is terminated. The penalty is {fine}.'),
    icon: '📑',
    choices: [
      { label: t('İmzala, kumarı bırak', 'Sign and quit gambling'), effects: () => fx(t('İmzayı attığın an, birkaç yıldır ilk kez bir şeye söz verdiğini hissettin.', 'The moment you signed you felt, for the first time in years, that you had promised something.'), addiction(-8), trust(2), stress(-2), flags({ casino_excluded_weeks: 6 })) },
      { label: t('İmzala ama alışkanlığa devam et', 'Sign but carry on'), risk: 'high', effects: () => fx(t('Sözleşme güvende, sen ise değilsin. Sponsor "gözlüyoruz" yazdı.', 'The contract is safe; you are not. The sponsor wrote: "we are watching."'), stress(4), addiction(3)) },
      { label: t('Reddet, sponsoru kaybet', 'Refuse and lose the sponsor'), risk: 'high', effects: (c) => fx(t('Sponsor çekildi, afiş ertesi hafta indirildi. İtibarın kısa sürede bir kademe düştü.', 'The sponsor pulled out and the billboard came down the next week. Your reputation took a notch in short order.'), money(-num(c, 'fine')), rep(-3), press(-3), fol(-3_000)) },
    ],
  },
  {
    id: 'casino.loan_shark', category: 'casino', weight: 1.2, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => addic(state) >= 60 && state.life.casino.lost > state.life.casino.won + 20_000,
    vars: ({ state }) => ({ debt: nice(Math.max(20_000, Math.min(state.life.casino.lost - state.life.casino.won, 400_000) * 0.25)) }),
    title: t('"Önceki Bahisler İçin"', '"For the Previous Bets"'),
    text: t('Kapıda iki takım elbiseli adam: "Masadaki arkadaşlarımız senin adına yüksek bahis oynamış, {debt} birikmiş. Futbolcu olduğun için kibar davranıyoruz." Gülümsemeleri gözlerine ulaşmıyor.', 'Two men in suits at the door: "Friends at the tables played high on your name, {debt} piled up. We are polite because you are a footballer." Their smiles do not reach their eyes.'),
    icon: '🕴️',
    choices: [
      { label: t('Borcu öde ({debt:money})', 'Pay the debt ({debt:money})'), requires: (c) => canAfford(c.state, num(c, 'debt')), lockedHint: t('Borcu ödeyecek nakdin yok.', 'You cannot pay the debt.'), effects: (c) => fx(t('Zarf elden ele geçti. Adamlar gitti; sen iki hafta uyuyamadın.', 'The envelope changed hands. The men left; you could not sleep for two weeks.'), money(-num(c, 'debt')), stress(5), addiction(-5), flags({ casino_excluded_weeks: 4 })) },
      { label: t('Polise başvur', 'Go to the police'), risk: 'medium', effects: () => fx(t('Polis konuyu ciddiye aldı ama haber sızdı. Taraftar seni destekledi; kulüp ise kimsenin bilmesini istememişti.', 'The police took it seriously but the story leaked. Fans backed you; the club had wanted nobody to know.'), stress(-3), press(-2), fans(3), chairman(-3), disc(-3), addiction(-6)) },
      { label: t('Zaman iste, kumarla kapat', 'Ask for time and "win it back"'), risk: 'high', effects: (c) => fx(t('Gece masaya oturdun. Sabaha kadar daha çok kaybettin; adamlar bu kez aynı gülümsemeyle gelmedi.', 'You sat at the tables that night. By morning you had lost more; the men did not come with the same smile.'), money(-Math.round(num(c, 'debt') * 0.6)), stress(8), addiction(8), happy(-8)) },
    ],
  },
  {
    id: 'casino.teammate_intervention', category: 'casino', weight: 1.1, cooldownWeeks: 40, maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && addic(state) >= 45,
    title: t('Soyunma Odasında Müdahale', 'Intervention in the Dressing Room'),
    text: t('Antrenman sonrası {mate}, {mate2} ve kaptan kapıyı kapattı. "Kardeşim, kumar yüzünden iki maçtır kafan yok. Kimse seni yargılamıyor ama seni kaybedemeyiz."', 'After training {mate}, {mate2} and the captain closed the door. "Mate, your head has been absent for two games because of gambling. Nobody is judging you, but we cannot lose you."'),
    icon: '🫂',
    choices: [
      { label: t('Dinle, teşekkür et', 'Listen and thank them'), effects: (c) => fx(t('Hepsi omzuna dokundu. {mate} "Bu akşam bizimle yemeğe gel" dedi. O akşam telefonu çantada kaldı.', 'They all touched your shoulder. {mate} said: "Come to dinner with us tonight." The phone stayed in your bag.'), rel('teammate', 5), addiction(-7), stress(-4), happy(4), relNpc(c.vars.mateId, c.vars.mate, 6)) },
      { label: t('Alın: "Karışmayın"', 'Push back: "Stay out of it"'), effects: () => fx(t('Oda buz kesti. Birkaç gün kimse sana pas vermedi.', 'The room turned to ice. For a few days nobody passed to you.'), rel('teammate', -6), morale(-5), form(-2)) },
      { label: t('Hepsini gece kumarhaneye davet et', 'Invite them all to the casino'), risk: 'high', effects: () => fx(t('Bir gece, bir masa, bir şaka. Sabaha kadar sürdü; antrenmanda herkes çürük görünüyordu ve hoca fark etti.', 'One night, one table, one joke. It ran till morning; everyone looked battered at training and the manager noticed.'), rel('teammate', -2), boss(-4), disc(-5), addiction(3)) },
    ],
  },

  // ───────────── Engagement: VIP, hot night, racehorse ─────────────
  {
    id: 'casino.vip_invite', category: 'casino', weight: 1.3, cooldownWeeks: 40, maxPerCareer: 2,
    conditions: ({ state }) => casinoVipTier(state.life) >= 1 && !hasFlag(state, 'casino_vip_room'),
    title: t('VIP Salonuna Davet', 'An Invitation to the VIP Room'),
    text: t('Müdür, kadife bir zarfla masana geldi: "Sadık konuklarımız için ayrı bir salonumuz var. Daha yüksek masa limitleri, ücretsiz akşam yemeği, gizli giriş. Elbette hiçbir şey zorunlu değil."', 'The floor manager arrived at your table with a velvet envelope: "We have a private room for our loyal guests. Higher table limits, free dinners, a private entrance. Naturally, nothing is compulsory."'),
    icon: '💎',
    choices: [
      { label: t('Kabul et: yüksek limitler, kapalı kapılar', 'Accept: higher limits, closed doors'), risk: 'high', effects: () => fx(t('Kadife perdenin ardında kimse seni tanımıyor gibi davrandı. Bu hissi hemen sevdin; bunun tehlikeli olduğunu da hemen anladın.', 'Behind the velvet curtain nobody pretended to know you. You loved the feeling at once, and knew at once it was dangerous.'), happy(5), addiction(5), stress(-2), flags({ casino_vip_room: true })) },
      { label: t('Nazikçe reddet', 'Politely refuse'), effects: () => fx(t('Zarfı geri verdin. Müdür "kapımız açık" dedi. Bir parçan ışıkta kalmaktan mutluydu.', 'You handed the envelope back. The manager said: "our door is open." A part of you was glad to stay in the light.'), addiction(-4), stress(-1), happy(2)) },
      { label: t('Sadece yemeğe git', 'Go for the dinner only'), effects: () => fx(t('Dana bonfile güzeldi. Salona girmeden çıkmak ise beklenenden zordu.', 'The steak was lovely. Leaving without entering the room was harder than expected.'), happy(3), addiction(1)) },
    ],
  },
  {
    id: 'casino.hot_night', category: 'casino', weight: 1, cooldownWeeks: 30, maxPerCareer: 4, triggers: ['casino'],
    conditions: ({ state }) => state.life.money >= 8_000 && state.life.casino.visitsThisWeek >= 1,
    vars: ({ state }) => ({ bet: nice(Math.max(500, state.life.money * 0.01)) }),
    title: t('Masa Isındı', 'The Table Is Hot'),
    text: t('Rulet masasında kırmızı arka arkaya altı kez geldi. Çevre kalabalıklaştı; birisi fısıldadı: "Şimdi bastır, şimdi." Cebinde {bet} var. Çipler sana bakıyor.', 'Red has come up six times in a row at the roulette table. A crowd gathers; someone whispers: "Push it now, now." You have {bet} in your pocket. The chips look back at you.'),
    icon: '🔥',
    choices: [
      { label: t('Tüm masayı bastır ({bet:money})', 'Push it all ({bet:money})'), risk: 'high', requires: (c) => canAfford(c.state, num(c, 'bet')), lockedHint: t('Çipin yok.', 'No chips.'), effects: (c, rng) => rng.chance(0.47) ? fx(t('Kırmızı yeniden geldi! Salon alkışladı, sen kafanda ince bir ses duydun: "bir tane daha".', 'Red again! The room applauded and you heard a small voice in your head: "just one more".'), money(num(c, 'bet') * 2), happy(6), addiction(4)) : fx(t('Siyah. Çipler süpürüldü; kalabalık yarım adım geri çekildi. Gece uzun sürecek.', 'Black. The chips were swept away; the crowd stepped half a pace back. It is going to be a long night.'), money(-num(c, 'bet')), stress(5), addiction(3)) },
      { label: t('Yarısını çek ve yürü', 'Take half off the table and walk'), effects: (c) => fx(t('Yarım kazancı cebine koyup çıktın. Kapıdaki görevli başını salladı; "akıllıca".', 'You pocketed half the winnings and left. The doorman nodded: "wise."'), money(Math.round(num(c, 'bet') * 0.4)), happy(4), addiction(-1)) },
      { label: t('Masadan kalk, kahve iç', 'Leave the table and have coffee'), effects: () => fx(t('Bardağın kenarında soğuk bir gurur vardı. Kalabalık başka birine döndü.', 'There was a cool pride at the rim of the cup. The crowd turned to someone else.'), happy(3), stress(-2), addiction(-2)) },
    ],
  },
  {
    id: 'casino.own_match_bet', category: 'casino', weight: 0.8, cooldownWeeks: 52, maxPerCareer: 2, triggers: ['casino'],
    conditions: ({ state }) => hasClub(state) && state.life.money >= 5_000,
    vars: ({ state }) => ({ stake: nice(Math.max(500, state.life.money * 0.01)) }),
    title: t('Kendi Maçına Kupon', 'A Slip on Your Own Match'),
    text: t('Kumarhanedeki bahis ekranında yarınki maçınız listeli. Oranlar yüksek, rakip kulüp sahada üstün. Yanında oturan tanıdık "içeriden" biri: "Bir şeyi bilen, bir şey oynar." Kurallar net: oyuncu kendi maçına bahis oynayamaz.', 'The betting board in the casino lists tomorrow\'s match. The odds are long and the opponent is favoured. A familiar "insider" next to you says: "He who knows, plays." The rule is clear: a player cannot bet on their own match.'),
    icon: '🎲',
    choices: [
      { label: t('Reddet ve ayrıl', 'Refuse and leave'), effects: () => fx(t('Bahis ekranına bir kez daha bakmadın. Dışarıdaki hava buz gibi ve temiz.', 'You did not look at the board again. The air outside was icy and clean.'), stress(-2), trust(2), addiction(-2)) },
      { label: t('Kulübün entegrasyon birimine bildir', 'Report to the club integrity unit'), effects: () => fx(t('Birim teşekkür etti ve konu sessizce kapandı; "içeriden" kişi bir daha görünmedi. Hoca "doğru olan" dedi.', 'The unit thanked you and the matter was closed quietly; the "insider" never reappeared. The gaffer said: "the right thing."'), trust(4), boss(3), chairman(3), disc(3), stress(2)) },
      { label: t('Kendi galibiyetine küçük bahis oyna ({stake:money})', 'Place a small bet on your own win ({stake:money})'), risk: 'high', requires: (c) => canAfford(c.state, num(c, 'stake')), lockedHint: t('Çipin yok.', 'No chips.'), effects: (c, rng) => rng.chance(0.2) ? fx(t('Kupon yattı, ama bahis kaydı yarım gün sonra federasyona düştü. Ceza ağır: iki maç ve manşet.', 'The slip came in, but the betting record reached the federation half a day later. A heavy penalty: two matches and a headline.'), money(num(c, 'stake')), disc(-12), press(-8), trust(-8), rep(-3), news(t('{heroName} kendi maçına bahis oynadı', '{heroName} bet on own match'), -1)) : fx(t('Kupon yattı. Kimse fark etmedi; ama sen farkındaydın ve maçta pasların titredi.', 'The slip lost. Nobody noticed, but you knew, and your passes trembled in the match.'), money(-num(c, 'stake')), form(-3), stress(5), disc(-3)) },
    ],
  },

  // ───────────── Racehorse ownership (3-step chain) ─────────────
  {
    id: 'casino.horse_offer', category: 'casino', weight: 1, cooldownWeeks: 78, maxPerCareer: 1, minAge: 21,
    conditions: ({ state }) => state.life.money >= 600_000 && !hasFlag(state, 'racehorse') && state.life.casino.addiction < 60,
    vars: ({ state }) => ({ price: nice(Math.max(120_000, state.life.money * 0.1)) }),
    title: t('Bir Safkan Yarış Atı', 'A Thoroughbred'),
    text: t('Yarış pistinden eski bir antrenör, {price} karşılığında henüz isim verilmemiş iki yaşında bir kısrak öneriyor: "Rüzgâr gibi koşuyor. Üstelik sahibi olursan masada oynamak zorunda kalmazsın." Haftalık bakım dahil.', 'An old trainer from the racecourse offers an unnamed two-year-old filly for {price}: "Runs like the wind. And if you own one you will not need to bet at the tables." Weekly upkeep included.'),
    icon: '🐎',
    choices: [
      { label: t('Satın al, adını sen koy ({price:money})', 'Buy her and choose the name ({price:money})'), requires: (c) => canAfford(c.state, num(c, 'price')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: (c) => fx(t('Adını annenin adı yaptın. Ahırda yalnızken kısrağa sebepsiz yere konuşuyorsun.', 'You named her after your mother. Alone in the stable you find yourself talking to her for no reason.'), money(-num(c, 'price')), happy(8), stress(-4), addiction(-3), flags({ racehorse: 1 }), follow(chain('casino.horse_race_day', 16))) },
      { label: t('Ortak ol: payın üçte biri', 'Co-own: a third share'), requires: (c) => canAfford(c.state, Math.round(num(c, 'price') / 3)), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: (c) => fx(t('Üç ortaklı bir at. Kazanırsa üçe bölünür, kaybederse yine üçe.', 'A horse with three owners. If she wins, split three ways; if she loses, split three ways.'), money(-Math.round(num(c, 'price') / 3)), happy(5), flags({ racehorse: 1 }), follow(chain('casino.horse_race_day', 16))) },
      { label: t('Yalnızca yarışı izle', 'Just watch the races'), effects: () => fx(t('Locaya oturdun, çay içtin. Atları gözlemek bazen sahip olmaktan daha güzel.', 'You sat in a box and drank tea. Watching horses can be nicer than owning them.'), happy(3), stress(-2)) },
    ],
  },
  {
    id: 'casino.horse_race_day', category: 'casino', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'racehorse'),
    vars: ({ state }) => ({ purse: nice(Math.max(40_000, state.life.money * 0.05)) }),
    title: t('İlk Resmî Yarış', 'The First Official Race'),
    text: t('Kısrağın ilk resmî yarışı. Jokey sakin, yarış yağmurlu. Tribünde heyecanlı bir kalabalık var; ödül havuzu {purse}. Antrenör: "Temiz bir start yeterli."', 'Your filly\'s first official race. The jockey is calm, the track wet. An excited crowd fills the stands; the purse is {purse}. The trainer: "A clean start is enough."'),
    icon: '🏇',
    choices: [
      { label: t('Tribünden izle, yarışı yaşa', 'Watch from the stands and live it'), effects: (c, rng) => rng.chance(0.45) ? fx(t('Son virajda öne çıktı! Tribün titredi. Kupayı eline aldığında kısrak sana burun sürttü.', 'She surged ahead in the last bend! The stands shook. When you received the cup she nudged you with her nose.'), money(num(c, 'purse')), happy(12), fans(3), press(3), rep(1), follow(chain('casino.horse_retirement', 40))) : fx(t('Beşinci oldu; jokey "yağmur" dedi. Moral bozmadın.', 'She came fifth; the jockey said "the rain". You did not mind.'), money(Math.round(num(c, 'purse') * 0.1)), happy(4), follow(chain('casino.horse_retirement', 40))) },
      { label: t('Kısraktan çok bahse odaklan', 'Bet on the race rather than watch'), risk: 'high', effects: (c, rng) => rng.chance(0.3) ? fx(t('Bahis tuttu ama yarışı hiç izlemedin. Kısrak kazanırken sen ekrana bakıyordun.', 'The bet came in but you hardly watched the race. While your filly won you were staring at a screen.'), money(Math.round(num(c, 'purse') * 0.5)), addiction(3), happy(-2), follow(chain('casino.horse_retirement', 40))) : fx(t('Bahis kaybetti; üstelik jokey "beni de görmedin" diyecek kadar kırıldı.', 'The bet lost, and the jockey was hurt enough to say: "you did not even look at me."'), money(-Math.round(num(c, 'purse') * 0.2)), addiction(4), stress(3), follow(chain('casino.horse_retirement', 40))) },
      { label: t('Yarışa gitme, ahırda bekle', 'Skip the track and wait in the stable'), effects: (c) => fx(t('Sonucu telefondan öğrendin; kısrak yine de iyi koşmuştu.', 'You heard the result by phone; she had run well anyway.'), money(Math.round(num(c, 'purse') * 0.15)), happy(4), follow(chain('casino.horse_retirement', 40))) },
    ],
  },
  {
    id: 'casino.horse_retirement', category: 'casino', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => hasFlag(state, 'racehorse'),
    vars: ({ state }) => ({ stud: nice(Math.max(30_000, wageX(state, 3, 10_000))) }),
    title: t('Kısrak Emekli Oluyor', 'The Filly Retires'),
    text: t('Veteriner bacağındaki ince bir çatlağı gösterdi: kısrak yarışmayı bırakmalı. Üreme çiftliği {stud} öneriyor. İnsan olsa "veda maçı" derdik; at olunca sadece bir sessizlik var.', 'The vet pointed to a hairline crack in her leg: she must stop racing. A stud farm offers {stud}. For a person we would call it a testimonial; for a horse there is only quiet.'),
    icon: '🌾',
    choices: [
      { label: t('Çiftliğe sat', 'Sell to the stud farm'), effects: (c) => fx(t('Para hesapta, ama ahırın kapısı hâlâ boş duruyor.', 'The money is in the account, but the stable door is still empty.'), money(num(c, 'stud')), happy(-2), flags({ racehorse: null })) },
      { label: t('Evine, meraya al', 'Take her home to the paddock'), effects: () => fx(t('Bahçenin arkasında bir kısrak otluyor. Her sabah bir elma götürüyorsun.', 'A filly grazes behind the house. Every morning you bring her an apple.'), happy(9), stress(-5), flags({ racehorse: null })) },
      { label: t('Yeni bir at al', 'Buy a new horse'), risk: 'medium', requires: (c) => canAfford(c.state, 120_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Yeni at, yeni umut, yeni masraf.', 'New horse, new hope, new costs.'), money(-120_000), happy(5), stress(2), follow(chain('casino.horse_race_day', 20))) },
    ],
  },
]

