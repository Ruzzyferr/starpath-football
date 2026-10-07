/**
 * Mentor: giving back to the academy, and (when young) learning from a veteran.
 * Academy prospects are footballers, so they share the hero's gender ({g:…}).
 *
 * Chains:
 * - Youth academy (4 steps): academy_visit → kid_struggles → kid_debut → kid_transfer
 */
import {
  age, attr, boss, canAfford, chain, fans, flags, follow, fx, happy, hasClub, money, morale, news, num, pickPlayerFull, rel, rep,
  stress, t, trust, wageX, fatigue, energy,
} from '../dsl'
import type { EventDef } from '../types'

export const mentorEvents: EventDef[] = [
  // ───────────── Youth academy chain (4 steps) ─────────────
  {
    id: 'mentor.academy_visit',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => hasClub(state) && (age(state) >= 23 || state.hero.reputation >= 35),
    vars: ({ state }, rng) => ({ kid: pickPlayerFull(state, rng) }),
    title: t('Akademideki Gölgen', 'Your Shadow at the Academy'),
    text: t(
      'Akademi direktörü seni U17 antrenmanına davet etti. {kid} adlı bir genç, koşu stilini, gol sevincini, hatta ayakkabı bağlama şeklini bile senden kopyalamış. Sana bakıyor; konuşmaya cesareti yok.',
      'The academy director invited you to U17 training. A kid called {kid} has copied your running style, your celebration, even the way you tie your boots. Staring at you, too shy to speak.',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('Antrenman sonrası birebir çalış', 'Stay after for a one-on-one'),
        effects: () => fx(t('Bir saat şut çalıştınız. {kid} her golde senin sevincini yaptı. Utanç verici derecede tatlı.', 'An hour of shooting drills. {kid} did your celebration after every goal. Embarrassingly sweet.'), happy(5), attr('leadership', 1), fatigue(4), flags({ mentee: true }), follow(chain('mentor.kid_struggles', 5))),
      },
      {
        label: t('Telefon numaranı ver: "Takıldığın yerde ara"', 'Give your number: "call me when you\'re stuck"'),
        effects: () => fx(t('{kid} numarayı ezberledi, kâğıdı da sakladı. İkisi de hayatının en değerli eşyası.', '{kid} memorised the number and kept the paper. Both now prized possessions.'), happy(3), flags({ mentee: true }), follow(chain('mentor.kid_struggles', 6))),
      },
      {
        label: t('Selam ver, geç', 'Wave and move on'),
        effects: () => fx(t('{kid} el salladı. Biraz bozuldu ama yine de el salladı.', '{kid} waved back. A little crushed, but still waved.'), stress(-1)),
      },
    ],
  },
  {
    id: 'mentor.kid_struggles',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ help: wageX(state, 1, 1000) }),
    title: t('Gece Yarısı Telefonu', 'Midnight Call'),
    text: t(
      '{kid} arıyor, sesi titriyor: "Babam işten çıkarıldı. Okulu bırakıp çalışmam gerekebilir. Futbolu bırakmam lazım galiba." Arkadan bir televizyon sesi geliyor; senin maçının özeti.',
      '{kid} calls, voice shaking: "Dad lost his job. I might have to quit school and work. I think I have to quit football." There\'s a TV in the background: your match highlights.',
    ),
    icon: '📞',
    choices: [
      {
        label: t('Akademiyle konuş, burs ayarla', 'Talk to the academy, arrange a scholarship'),
        effects: () => fx(t('Direktör ikna oldu: burs ve yol parası. {kid} telefonda ağladı, sen de biraz.', 'The director agreed: scholarship plus travel money. {kid} cried on the phone. So did you, a bit.'), happy(6), boss(2), follow(chain('mentor.kid_debut', 10))),
      },
      {
        label: t('Aileye kendin destek ol ({help:money}/ay gibi)', 'Support the family yourself (about {help:money})'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'help')),
        lockedHint: t('Şu an buna gücün yetmiyor.', 'You can\'t afford that right now.'),
        effects: (ctx) => fx(t('Babası seni arayıp teşekkür etti, sesinde gurur ve utanç birlikte vardı. "Geri ödeyeceğim." "Gol atınca ödersin."', 'The father called to thank you, pride and embarrassment in one voice. "I\'ll pay you back." "Pay me in goals."'), money(-num(ctx, 'help') * 3), happy(8), rep(1), follow(chain('mentor.kid_debut', 10))),
      },
      {
        label: t('"Hayat bazen böyle" de', 'Say "that\'s life sometimes"'),
        effects: () => fx(t('Telefon kapandı. Bir daha aramadı. Akademide forması başkasına verildi.', 'The line went quiet. They never called again. Their shirt went to someone else.'), happy(-6), stress(3), flags({ mentee: null })),
      },
    ],
  },
  {
    id: 'mentor.kid_debut',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasClub(state),
    title: t('Büyük Gün', 'The Big Day'),
    text: t(
      '{kid} A takımla ilk maçına çıkıyor, hem de senin yanında. Isınmada titriyor. {managerName} sana bakıp başıyla işaret etti: "Sen ilgilen."',
      '{kid} makes a senior debut, right next to you. Shaking in the warm-up. {managerName} catches your eye and nods: "You handle it."',
    ),
    icon: '🎽',
    choices: [
      {
        label: t('İlk pası ona ver', 'Make sure the first pass goes to them'),
        effects: () => fx(t('İlk dokunuş temiz. Sonra bir tane daha. Maç sonu {kid} formanı istedi; sen de onunkini.', 'First touch: clean. Then another. After the match {kid} asked for your shirt; you asked for theirs.'), happy(8), trust(3), rel('teammate', 3), morale(4), follow(chain('mentor.kid_transfer', 12))),
      },
      {
        label: t('Gol fırsatında ona bırak', 'Square it for them when you could score'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('{kid} attı! Sevinç: seninkinin aynısı. Stat yıkıldı.', '{kid} scored! The celebration: identical to yours. The stadium erupted.'), fans(6), rep(2), happy(10), news(t('{heroName} golü gence bıraktı: "Gelecek onun"', '{heroName} gifts goal to debutant: "The future is theirs"'), 1), follow(chain('mentor.kid_transfer', 12)))
            : fx(t('{kid} kaçırdı. Hoca sana baktı, "neden kendin vurmadın" bakışıyla.', '{kid} missed. The gaffer gave you a "why didn\'t you shoot" look.'), trust(-3), happy(2), follow(chain('mentor.kid_transfer', 12))),
      },
      {
        label: t('Kendi oyununa odaklan', 'Focus on your own game'),
        effects: () => fx(t('İyi oynadın. {kid} kenarda kaldı ama seni izledi, not aldı.', 'You played well. {kid} stayed on the fringes, watching you, taking notes.'), morale(2), follow(chain('mentor.kid_transfer', 14))),
      },
    ],
  },
  {
    id: 'mentor.kid_transfer',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: (_ctx, rng) => ({ shark: rng.pick(['"Altın Çanta" Ferhat', 'Menajer Vito Bruni', '"Kontrat" Kenan']) }),
    title: t('Köpekbalıkları Etrafında', 'Sharks Circling'),
    text: t(
      '{kid} artık konuşuluyor. {shark} kapısında: "%25 komisyon, hayatını değiştiririm." {kid} sana yazdı: "{g:Abi|Abla}, ne yapayım?"',
      '{kid} is the talk of the town. {shark} is at the door: "25% commission and I\'ll change your life." {kid} texts you: "What do I do?"',
    ),
    icon: '🦈',
    choices: [
      {
        label: t('{agentName} ile tanıştır', 'Introduce them to {agentName}'),
        effects: () => fx(t('{agentName} kibar bir sözleşme hazırladı, %8. {shark} küfür etti.', '{agentName} drew up a fair contract at 8%. {shark} swore loudly.'), rel('agent', 4), happy(5), rep(1), flags({ mentee: null, mentee_success: true })),
      },
      {
        label: t('"Bir yıl daha burada kal, oyna" de', 'Advise: "Stay a year, get minutes"'),
        effects: () => fx(t('{kid} kaldı, otuz maç oynadı. Ertesi yaz çok daha iyi bir kulübe, çok daha iyi şartlarla gitti.', '{kid} stayed, played thirty games, and next summer moved to a much better club on much better terms.'), boss(3), happy(6), attr('leadership', 1), flags({ mentee: null, mentee_success: true })),
      },
      {
        label: t('Karışmamaya karar ver', 'Decide not to interfere'),
        effects: () => fx(t('{shark} ile imzaladı. İki yıl sonra adını bir alt ligde gördün.', 'They signed with {shark}. Two years later you saw their name in a lower division.'), happy(-4), stress(2), flags({ mentee: null })),
      },
    ],
  },
  // ───────────── Standalone ─────────────
  {
    id: 'mentor.veteran_advice',
    category: 'mentor',
    weight: 1,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state) && age(state) <= 21,
    vars: ({ state }, rng) => ({ vet: pickPlayerFull(state, rng) }),
    title: t('Yaşlı Kurt', 'The Old Wolf'),
    text: t(
      'Takımın 35 yaşındaki emektarı {vet} antrenman sonrası seni kenara çekti: "Sana bir şey anlatayım. Ben senin yaşındayken..." Gözlerinde kırk tane kariyer hatası var.',
      'The squad\'s 35-year-old veteran {vet} pulls you aside after training: "Let me tell you something. When I was your age..." Forty career mistakes in those eyes.',
    ),
    icon: '🐺',
    choices: [
      {
        label: t('Dinle, not al', 'Listen and take notes'),
        effects: () => fx(t('"Paranı ilk yıl harcama. Dizine iyi bak. Menajerine her şeyi imzalatma." Üçü de altın.', '"Don\'t blow your money in year one. Look after your knees. Don\'t let your agent sign everything." All three: gold.'), attr('composure', 1), stress(-3), rel('teammate', 2)),
      },
      {
        label: t('Yemeğe davet et, uzun uzun konuş', 'Invite them to dinner and talk for hours'),
        effects: () => fx(t('Gece yarısı oldu. Hikâyelerin yarısı uydurma olabilir; dersler değil.', 'Midnight came. Half the stories may be made up; the lessons aren\'t.'), attr('vision', 1), happy(4), energy(-5), rel('teammate', 3)),
      },
      {
        label: t('"Devir değişti hocam" de', 'Say "times have changed, mate"'),
        effects: () => fx(t('{vet} gülümsedi: "Değişti tabii." İki ay sonra senin yaptığın hatayı ilk o fark etti.', '{vet} smiled: "Sure they have." Two months later, they were the first to spot your mistake.'), stress(2), rel('teammate', -1)),
      },
    ],
  },
  {
    id: 'mentor.coaching_badge',
    category: 'mentor',
    weight: 0.9,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 27,
    vars: ({ state }) => ({ fee: wageX(state, 1, 1500) }),
    title: t('Antrenörlük Kursu', 'Coaching Badge'),
    text: t(
      'Federasyon aktif oyunculara hafta sonu antrenörlük kursu açtı. Ücret {fee:money}. Kursta taktik tahtası, video analizi ve bir sürü kahve var.',
      'The federation opened a weekend coaching course for active players. Fee: {fee:money}. Tactics boards, video analysis and a lot of coffee.',
    ),
    icon: '📋',
    choices: [
      {
        label: t('Kaydol', 'Sign up'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'fee')),
        lockedHint: t('Kurs ücreti yok.', 'Can\'t afford the fee.'),
        effects: (ctx) => fx(t('Sınavda ofsayt tuzağını çizdin. Hoca "Bunu bana da anlat" dedi.', 'In the exam you drew the offside trap. Your manager said "explain that to me sometime".'), money(-num(ctx, 'fee')), attr('vision', 1), attr('leadership', 1), fatigue(5), boss(3), flags({ coaching_badge: true })),
      },
      {
        label: t('Emeklilikte bakarım', 'Maybe after retirement'),
        effects: () => fx(t('Hafta sonu dinlendin. Bacakların teşekkür etti.', 'You rested all weekend. Your legs said thanks.'), stress(-2), energy(5)),
      },
    ],
  },
]

