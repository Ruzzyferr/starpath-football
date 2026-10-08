/**
 * Late-game money goals as decision cards (see sim/life/projects.ts for the
 * numbers): youth academy foundation (3 stages), charity stadium (2 stages),
 * club ownership stake, legacy fund for the Legacy child. Every choice that
 * spends cash also starts or advances a real project (flags read by the
 * weekly economy tick), so idle millions turn into something that pays back
 * in fans, reputation, dividends or a better start for the next career.
 *
 * Chains:
 * - Academy (3 steps): money.academy_blueprint → mentor.academy_opening → mentor.academy_first_graduate
 * - Stadium (2 steps): charity.stadium_plan → charity.stadium_opening
 */
import { age, boss, canAfford, chain, chairman, fans, flags, fol, follow, fx, happy, hasClub, money, news, num, press, rel, rep, stress, t } from '../dsl'
import {
  ACADEMY_PRICE, STADIUM_PRICE, STAKE_MAX_PCT, STAKE_PRICE_PER_PCT, academyGraduates, academyLevel, legacyFund, nextAcademyPrice, stadiumLevel, stakePct,
} from '../../projects'
import type { EventDef } from '../types'

const rich = (cash: number, price: number, margin = 1.25): boolean => cash >= price * margin

export const projectEvents: EventDef[] = [
  // ───────────── Youth academy (3-step chain + stage-ups) ─────────────
  {
    id: 'money.academy_blueprint', category: 'money', weight: 1.2, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 23 && academyLevel(state.life) === 0 && rich(state.life.money, ACADEMY_PRICE[1]),
    vars: ({ state }) => ({ price: ACADEMY_PRICE[1], half: Math.round(ACADEMY_PRICE[1] / 2), friend: state.life.relationships.bestFriend?.name ?? 'eski antrenörün' }),
    title: t('Kendi Akademin', 'An Academy of Your Own'),
    text: t(
      'Çocukluk mahallendeki toprak saha hâlâ duruyor; üstünde dört direk, bir de çatlak kale. {friend} elinde bir çizimle geldi: kapalı salon, dört soyunma odası, yirmi yataklı yurt. "Bu sahadan çıkan sensin. Sıradaki çocukları da çıkaralım." Birinci aşama {price}; haftalık bakım ayrıca gelir.',
      'The dirt pitch in the neighbourhood you grew up in is still there: four posts and a cracked goal. Someone brought a sketch: an indoor hall, four changing rooms, a twenty-bed dorm. "You came out of this pitch. Let us bring out the next kids." Stage one costs {price}; running costs come on top.',
    ),
    icon: '🏗️',
    choices: [
      {
        label: t('Tam olarak kendin kur ({price:money})', 'Build it entirely yourself ({price:money})'), risk: 'medium',
        requires: (c) => canAfford(c.state, num(c, 'price')),
        lockedHint: t('Bunun için yeterli nakdin yok.', 'You do not have the cash for this.'),
        effects: (c) => fx(t('Temel atma töreninde kazma sende kaldı, fotoğraf mahalle gazetesinin birinci sayfasına çıktı. Akademi artık sende.', 'You kept hold of the pickaxe at the groundbreaking and the photo made the local front page. The academy is yours now.'),
          money(-num(c, 'price')), happy(8), rep(1), fans(4), press(3), flags({ 'proj:academy': 1 }), follow(chain('mentor.academy_opening', 16))),
      },
      {
        label: t('Kulübün akademisiyle ortak kur ({half:money})', 'Partner with the club academy ({half:money})'),
        requires: (c) => hasClub(c.state) && canAfford(c.state, num(c, 'half')),
        lockedHint: t('Aktif bir kulübün ve yeterli nakdin olmalı.', 'You need a club and enough cash.'),
        effects: (c) => fx(t('Yönetim kurulu "seninle ortak olmak şeref" dedi ve yarısını üstlendi. Daha az kontrol, daha az masraf; ama tabelada senin adın da var.', 'The board said it was an honour and covered half. Less control, less cost; yet your name is on the sign as well.'),
          money(-num(c, 'half')), chairman(5), boss(2), rep(1), flags({ 'proj:academy': 1 }), follow(chain('mentor.academy_opening', 16))),
      },
      {
        label: t('Çizimi sakla, şimdilik zamanı değil', 'Keep the sketch for later'),
        effects: () => fx(t('Çizim çekmeceye girdi. Sahadaki çocuklar yine toprakta oynuyor.', 'The sketch went into a drawer. The kids are still playing on dirt.'), stress(1)),
      },
    ],
  },
  {
    id: 'mentor.academy_opening', category: 'mentor', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => academyLevel(state.life) >= 1,
    title: t('Kurdele Kesimi', 'Cutting the Ribbon'),
    text: t(
      'Akademinin kapısında kurdele var. Kameralar, belediye başkanı, çocuklar ve yeni formalar hazır. Biri sordu: "Akademiye kimin adını verelim?"',
      'A ribbon hangs at the academy gate. Cameras, the mayor, the kids and the new kits are all ready. Someone asks: "Whose name goes on the academy?"',
    ),
    icon: '🎀',
    choices: [
      { label: t('Kendi adını ver', 'Name it after yourself'), effects: () => fx(t('Tabelada adın parlıyor. Bir kısım gurur duydu, bir kısım "kendini yüceltiyor" dedi.', 'Your name shines on the sign. Some were proud, some said you were glorifying yourself.'), rep(2), press(1), fol(3_000), flags({ academy_named: 'self' }), news(t('{heroName} adını taşıyan akademi açıldı', 'Academy bearing {heroName}\'s name opens'), 1)) },
      { label: t('İlk antrenörünün adını ver', 'Name it after your first coach'), effects: () => fx(t('Yaşlı antrenör kurdeleyi tutarken ağladı. Mahalle gözyaşlarına eşlik etti.', 'Your old coach cried holding the ribbon. The neighbourhood cried with him.'), happy(8), fans(5), press(3), flags({ academy_named: 'coach' })) },
      { label: t('Mahallenin adını ver', 'Name it after the neighbourhood'), effects: () => fx(t('Sade ve temiz. Çocuklar için en önemli şey ismin değil, sahanın olduğunu söyledi biri.', 'Simple and clean. Someone said the pitch matters more to the kids than the name.'), fans(7), press(2), rep(1), flags({ academy_named: 'hood' }), follow(chain('mentor.academy_first_graduate', 30))) },
    ],
  },
  {
    id: 'mentor.academy_stage_up', category: 'mentor', weight: 1, cooldownWeeks: 60, maxPerCareer: 2,
    conditions: ({ state }) => academyLevel(state.life) >= 1 && academyLevel(state.life) < 3 && rich(state.life.money, nextAcademyPrice(state.life) ?? Infinity),
    vars: ({ state }) => ({ price: nextAcademyPrice(state.life) ?? 0, lvl: academyLevel(state.life) + 1 }),
    title: t('Akademi Büyüyor', 'The Academy Outgrows Itself'),
    text: t('Başvuran çocuk sayısı kapasitenin üç katı. Müdür yeni bir blok istiyor: daha çok saha, fizyoterapi odası, öğretmen. Aşama {lvl} için {price}. "Artık sadece mahallenin değil, şehrin akademisi olabiliriz."', 'Applicants are three times the capacity. The director wants a new wing: more pitches, a physio room, teachers. Stage {lvl} costs {price}. "We could become the city\'s academy, not just the neighbourhood\'s."'),
    icon: '🏫',
    choices: [
      { label: t('Yeni bloğu yaptır ({price:money})', 'Fund the new wing ({price:money})'), requires: (c) => canAfford(c.state, num(c, 'price')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Beton döküldü, yeni formalar geldi. İlk yıl başvurular iki katına çıktı.', 'Concrete poured, new kits arrived. Applications doubled in the first year.'), money(-num(c, 'price')), rep(2), fans(4), happy(6), flags({ 'proj:academy': academyLevel(c.state.life) + 1 })) },
      { label: t('Bir yıl bekleyelim', 'Let us wait a year'), effects: () => fx(t('Müdür başını salladı. Çocuklar sırada beklemeye devam ediyor.', 'The director nodded. The kids keep waiting in line.'), stress(1)) },
      { label: t('Belediyeden destek iste', 'Ask the city for support'), risk: 'medium', effects: (c, rng) => rng.chance(0.5) ? fx(t('Belediye yarı yarıya öderse dedi; protokol imzalandı.', 'The city agreed to split the bill and a protocol was signed.'), money(-Math.round(num(c, 'price') / 2)), rep(2), press(3), flags({ 'proj:academy': academyLevel(c.state.life) + 1 })) : fx(t('Belediye "bütçe yok" dedi. Toplantı uzadı, sonuç çıkmadı.', 'The city said there is no budget. The meeting dragged on without result.'), stress(3)) },
    ],
  },
  {
    id: 'mentor.academy_first_graduate', category: 'mentor', weight: 1, cooldownWeeks: 40, maxPerCareer: 3, minAge: 24,
    conditions: ({ state }) => academyLevel(state.life) >= 1 && academyGraduates(state.life) >= 1,
    vars: ({ state }) => ({ n: academyGraduates(state.life) }),
    title: t('Akademiden Çıkan İlk Yetenek', 'The First Talent Out of the Academy'),
    text: t('Akademiden toplam {n} genç mezun oldu. Biri ise çok parlak: büyük kulüplerin gözü üstünde. Çocuk seni arıyor: "{g:Abi|Abla}, ne yapayım?"', '{n} youngsters have graduated from the academy so far. One of them is brilliant, and big clubs are watching. The kid calls you: "What should I do?"'),
    icon: '🎓',
    choices: [
      { label: t('Büyük kulübe gitmesini söyle', 'Tell them to go to the big club'), effects: () => fx(t('Çocuk gitti, kulüp akademiye transfer hakkı olarak bir bağış yaptı. Mahalle sevindi.', 'The kid left; the club donated a transfer fee to the academy. The neighbourhood cheered.'), money(25_000), rep(1), fans(3), press(2)) },
      { label: t('Kendi kulübünde sınatmayı öner', 'Offer a trial at your club'), requires: (c) => hasClub(c.state), lockedHint: t('Bir kulübün olmalı.', 'You need a club.'), effects: () => fx(t('Antrenmanda çocuk senin pasını ilk dokunuşta kesti. Hoca bakıp gülümsedi.', 'In training the kid killed your pass on the first touch. The coach smiled.'), happy(7), rel('manager', 3), rep(1)) },
      { label: t('Akademide antrenör yapıp kalmasını söyle', 'Keep them at the academy as a coach'), effects: () => fx(t('Çocuk futbolcu olmadı ama yetenek yetiştiren bir isim oldu. Akademi bir miras kazandı.', 'The kid never became a player but turned into someone who develops talent. The academy gained a legacy.'), happy(5), press(2), stress(-2)) },
    ],
  },

  // ───────────── Charity stadium ─────────────
  {
    id: 'charity.stadium_plan', category: 'charity', weight: 1.2, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 22 && stadiumLevel(state.life) === 0 && rich(state.life.money, STADIUM_PRICE[1]),
    vars: () => ({ price: STADIUM_PRICE[1] }),
    title: t('Herkesin Stadyumu', 'A Stadium for Everyone'),
    text: t('Belediyenin kullanılmayan bir stadyum arsası var. Sen finanse edersen çim saha, tribün ve kadınlar ile engelliler için ayrı antrenman saatleri kurulacak. Gelir yok, giderler var; ama bir semt futbola kavuşacak. Birinci aşama {price}.', 'The city owns an unused stadium plot. Fund it and a grass pitch, stands and dedicated training hours for women and disabled players will open. No income, only costs; but a district gets football. Stage one costs {price}.'),
    icon: '🏟️',
    choices: [
      { label: t('Finanse et ({price:money})', 'Fund it ({price:money})'), risk: 'medium', requires: (c) => canAfford(c.state, num(c, 'price')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Proje belediye meclisinde oy birliğiyle geçti. Çim ekimine ilk sen başladın.', 'The project passed the city council unanimously. You planted the first strip of turf yourself.'), money(-num(c, 'price')), happy(8), fans(5), press(4), rep(1), flags({ 'proj:stadium': 1 }), follow(chain('charity.stadium_opening', 18))) },
      { label: t('Yalnızca saha için bağış yap', 'Donate only for the pitch'), requires: (c) => canAfford(c.state, 150_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Bir saha yapıldı, tribün hayali sonraya kaldı. Yine de iyi bir şey.', 'A pitch got built; the stands are for later. Still a good thing.'), money(-150_000), fans(2), press(1), happy(3)) },
      { label: t('Kenarda dur, planı destekle', 'Stay out and back the plan'), effects: () => fx(t('Basın toplantısında hiç para vermeden alkışlandın. İnsanlar ne kadar çabuk fark ediyor.', 'You were applauded at the press conference without giving a cent. People notice quickly.'), press(-1)) },
    ],
  },
  {
    id: 'charity.stadium_opening', category: 'charity', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => stadiumLevel(state.life) >= 1,
    title: t('İlk Maç Mahallenin', 'The First Match Belongs to the District'),
    text: t('Stadyumun açılış maçı: mahallenin kadın takımı ile engelli takımı. Sen kuralları tek cümleyle açıklaman istendi: "Bu stadyum kimin için?"', 'Opening day: the district women\'s side against a disabled-players team. You were asked to say in one sentence: "Who is this stadium for?"'),
    icon: '🥅',
    choices: [
      { label: t('"Futbolu sevenlerin hepsi için"', '"Everyone who loves football"'), effects: () => fx(t('Cümle alıntılanıp tribünlere yazıldı. Çocuklar maça seninle girdi.', 'The line was quoted and painted on the stands. The kids walked out with you.'), fans(6), press(4), happy(8), fol(4_000), rep(1)) },
      { label: t('Sessizce selam ver, sahayı onlara bırak', 'Wave quietly and leave the pitch to them'), effects: () => fx(t('Gösterişsizlik ilgi gördü; fotoğraf yine de çıktı.', 'The modesty was noticed; the photo came out anyway.'), fans(4), press(3), happy(6)) },
      { label: t('Takımlardan birine forma imzala, maç topunu at', 'Sign a shirt for one side and kick off'), effects: () => fx(t('İlk gol yarım dakikada. Çocuk golün ardından sana koştu.', 'First goal in thirty seconds. The kid ran to you after scoring.'), fans(5), happy(9), rel('press', 2)) },
    ],
  },
  {
    id: 'charity.stadium_expand', category: 'charity', weight: 1, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => stadiumLevel(state.life) === 1 && rich(state.life.money, STADIUM_PRICE[2]),
    vars: () => ({ price: STADIUM_PRICE[2] }),
    title: t('Tribün, Aydınlatma ve Yurt', 'Stands, Floodlights and a Hostel'),
    text: t('Stadyum her hafta doluyor ama akşamları karanlık. Aydınlatma, kapalı tribün ve konuk takımlar için küçük bir yurt gerekiyor: {price}. Bölge ligi artık burada maç yapmak istiyor.', 'The stadium fills every week but it is dark at night. Floodlights, a covered stand and a small hostel for visiting sides would cost {price}. The regional league wants to play here.'),
    icon: '💡',
    choices: [
      { label: t('İkinci aşamayı yaptır ({price:money})', 'Fund stage two ({price:money})'), requires: (c) => canAfford(c.state, num(c, 'price')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Işıklar yandığı gece mahalle sokağa döküldü. Biri "burası artık memleket" dedi.', 'The night the lights came on, the whole district poured out. Someone said, "this is home now".'), money(-num(c, 'price')), rep(2), fans(6), press(4), happy(8), flags({ 'proj:stadium': 2 }), news(t('{heroName}\'in stadyumuna ışık geldi', 'Floodlights switch on at {heroName}\'s stadium'), 1)) },
      { label: t('Yalnızca aydınlatma ekle', 'Add floodlights only'), requires: (c) => canAfford(c.state, 300_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Akşam maçları başladı. Yurt hâlâ hayal.', 'Evening games began. The hostel is still a dream.'), money(-300_000), fans(3), happy(4)) },
      { label: t('Şimdilik bu kadar', 'That is enough for now'), effects: () => fx(t('Stadyum olduğu gibi güzel. Bazı hayaller yerinde kalsın.', 'The stadium is lovely as it is. Some dreams can stay as they are.'), stress(-1)) },
    ],
  },

  // ───────────── Club ownership stake ─────────────
  {
    id: 'money.club_stake_offer', category: 'money', weight: 1.1, cooldownWeeks: 78, maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 25 && hasClub(state) && state.hero.reputation >= 50 && stakePct(state.life) < STAKE_MAX_PCT && state.life.money >= STAKE_PRICE_PER_PCT * 5 * 1.2,
    vars: ({ state }) => ({ pct5: 5, cost5: 5 * STAKE_PRICE_PER_PCT, pct10: 10, cost10: 10 * STAKE_PRICE_PER_PCT, club: state.world.clubs[state.hero.contract?.clubId ?? '']?.name ?? 'kulüp' }),
    title: t('Kulüpte Hisse Teklifi', 'A Stake in the Club'),
    text: t('{chairmanName} seni odasına çağırdı: "{clubName} yeni ortaklar arıyor. Seni listenin başına yazdık. %5 için {cost5}, %10 için {cost10}." Hisse, yıllık yaklaşık %7 temettü demek; ama kulüp batarsa sen de batarsın.', '{chairmanName} called you in: "{clubName} is looking for new partners. You are at the top of the list. 5% costs {cost5}, 10% costs {cost10}." A stake means roughly 7% a year in dividends; but if the club sinks, so do you.'),
    icon: '📈',
    choices: [
      { label: t('%10 al ({cost10:money})', 'Take 10% ({cost10:money})'), risk: 'medium', requires: (c) => canAfford(c.state, num(c, 'cost10')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('İmzalar atıldı. Yönetim kurulunda artık senin için bir koltuk var.', 'Papers signed. The boardroom has a seat with your name on it.'), money(-num(c, 'cost10')), chairman(8), boss(2), rep(1), happy(5), { addFlags: { 'proj:stake': 10, 'proj:stakeInvested': num(c, 'cost10') }, setFlags: { 'proj:stakeClub': c.state.hero.contract?.clubId ?? '' } }) },
      { label: t('%5 al ({cost5:money})', 'Take 5% ({cost5:money})'), requires: (c) => canAfford(c.state, num(c, 'cost5')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Küçük ama sembolik bir pay. Başkan sırtına vurdu: "Aileye hoş geldin."', 'A small but symbolic share. The chairman clapped you on the back: "Welcome to the family."'), money(-num(c, 'cost5')), chairman(5), rep(1), { addFlags: { 'proj:stake': 5, 'proj:stakeInvested': num(c, 'cost5') }, setFlags: { 'proj:stakeClub': c.state.hero.contract?.clubId ?? '' } }) },
      { label: t('Hayır: "Oyuncu olarak kalmak istiyorum"', 'No: "I want to stay a player"'), effects: () => fx(t('Başkan teklifi geri çekti, ama gülümseyerek. Kapı aralık.', 'The chairman withdrew the offer with a smile. The door stays ajar.'), chairman(1)) },
    ],
  },
  {
    id: 'club.stake_board_meeting', category: 'club', weight: 1, cooldownWeeks: 52, maxPerCareer: 4,
    conditions: ({ state }) => stakePct(state.life) >= 5 && hasClub(state),
    vars: ({ state }) => ({ pct: stakePct(state.life) }),
    title: t('Yönetim Kurulunda Oy Hakkı', 'A Vote in the Boardroom'),
    text: t('%{pct} hissesiyle artık yönetim kurulu toplantılarına katılıyorsun. Gündem: teknik direktörün bütçesi mi, tesislerin yenilenmesi mi, yoksa temettüyü artırmak mı?', 'With your {pct}% stake you sit in the board meetings. The agenda: the manager\'s budget, renovating the facilities, or raising the dividend?'),
    icon: '🗳️',
    choices: [
      { label: t('Teknik direktörün bütçesini destekle', 'Back the manager\'s budget'), effects: () => fx(t('Hoca seni yanına çağırıp teşekkür etti. Soyunma odasında bir tebessüm fark ettin.', 'The manager called you aside to thank you. You noticed a smile in the dressing room.'), boss(6), rel('teammate', 2), money(-20_000)) },
      { label: t('Tesisleri yenilet', 'Renovate the facilities'), effects: () => fx(t('Antrenman sahası yenilendi, taraftar tribününün çatısı onarıldı.', 'The training pitch was renewed and the fans\' stand got a new roof.'), fans(4), chairman(2), money(-30_000), happy(3)) },
      { label: t('Temettüyü artır', 'Raise the dividend'), effects: () => fx(t('Hissedarlar sevindi, taraftar sormaya başladı: "Para nereye?"', 'Shareholders were pleased; fans began asking: "Where is the money going?"'), money(25_000), fans(-4), press(-2)) },
    ],
  },

  // ───────────── Legacy fund ─────────────
  {
    id: 'money.legacy_fund_idea', category: 'money', weight: 1.1, cooldownWeeks: 78, maxPerCareer: 2,
    conditions: ({ state }) => age(state) >= 24 && legacyFund(state.life) === 0 && state.life.money >= 1_200_000,
    vars: ({ state }) => ({ quarter: Math.round(state.life.money * 0.1), half: Math.round(state.life.money * 0.2) }),
    title: t('Çocuğun İçin Bir Kumbara', 'A Piggy Bank for the Kid'),
    text: t('Banka müdürü bir "miras fonu" önerdi: Para kilitli kalıyor, yılda %3,5 büyüyor ve kariyerin bitince ileride dünyaya gelecek çocuğunun (ya da bir akrabanın) yoluna ışık oluyor. "Parayı harcamayı unut, bunu bırak."', 'The bank manager proposes a legacy fund: the money stays locked, grows 3.5% a year, and when your career ends it lights the way for a child of yours (or a relative). "Forget about spending it. Leave this behind."'),
    icon: '🐷',
    choices: [
      { label: t('Servetin %20\'sini yatır ({half:money})', 'Put in 20% of your cash ({half:money})'), requires: (c) => canAfford(c.state, num(c, 'half')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Sözleşme imzalandı. Fon hesabında yeşil bir ışık yandı; ilk kez gerçekten biriktirmiş gibi hissettin.', 'Contract signed. A green light came on in the fund account; for the first time you felt you had really saved.'), money(-num(c, 'half')), happy(6), stress(-3), { addFlags: { 'proj:fund': num(c, 'half') } }) },
      { label: t('%10 ile başla ({quarter:money})', 'Start with 10% ({quarter:money})'), requires: (c) => canAfford(c.state, num(c, 'quarter')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Başlangıç küçük ama alışkanlık güçlü. Muhasebeci "her sezon biraz" dedi.', 'A modest start but a strong habit. The accountant said: "a little each season".'), money(-num(c, 'quarter')), happy(3), { addFlags: { 'proj:fund': num(c, 'quarter') } }) },
      { label: t('Henüz erken, para elimde kalsın', 'Too early; keep the cash close'), effects: () => fx(t('Para yastığın altında kaldı; ya da yatırım hesabında beklemeye devam etti.', 'The money stayed under the pillow, or waiting in an investment account.'), stress(1)) },
    ],
  },
  {
    id: 'money.legacy_fund_review', category: 'money', weight: 1, cooldownWeeks: 52, maxPerCareer: 6, triggers: ['season_end'],
    conditions: ({ state }) => legacyFund(state.life) > 0 && state.life.money >= 500_000,
    vars: ({ state }) => ({ fund: Math.round(legacyFund(state.life)), top: Math.round(Math.min(state.life.money * 0.1, 800_000)) }),
    title: t('Fonun Yıllık Raporu', 'The Fund\'s Annual Statement'),
    text: t('Banka fonun yıllık raporunu gönderdi. Bakiye: {fund}. Eklersen aynı faizle büyür; çekersen %10 cezası var. Çocuk için bir şeyler yaptığını bilmek güzel.', 'The bank sent the fund\'s annual statement. Balance: {fund}. Add more and it compounds; withdraw and a 10% penalty applies. It is nice to know you are doing something for the kid.'),
    icon: '📬',
    choices: [
      { label: t('Bu yıl da ekle ({top:money})', 'Top it up again ({top:money})'), requires: (c) => canAfford(c.state, num(c, 'top')), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'),
        effects: (c) => fx(t('Bakiye büyüdü. Muhasebeci başını salladı: "Bu sabır işi."', 'The balance grew. The accountant nodded: "This is a patience game."'), money(-num(c, 'top')), happy(3), stress(-2), { addFlags: { 'proj:fund': num(c, 'top') } }) },
      { label: t('Olduğu gibi bırak', 'Leave it alone'), effects: () => fx(t('Rapor çekmeceye girdi. Faiz çalışmaya devam ediyor.', 'The statement went into a drawer. The interest keeps working.'), stress(-1)) },
      { label: t('Bir kısmını çek (%10 ceza)', 'Withdraw some (10% penalty)'), risk: 'medium', effects: (c) => fx(t('Para hesabında ama çocuğun payı küçüldü. Vicdan azabı küçük, fatura büyük.', 'The money is in your account but the kid\'s share shrank. A small pang of guilt, a larger bill.'), money(Math.round(num(c, 'fund') * 0.2 * 0.9)), happy(-2), { addFlags: { 'proj:fund': -Math.round(num(c, 'fund') * 0.2) } }) },
    ],
  },
]

