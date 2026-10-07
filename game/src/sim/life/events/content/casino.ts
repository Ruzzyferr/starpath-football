/**
 * Casino & betting: tables, streaks, the betting-app spiral and the
 * match-fixing approach. Tone: tempting, never glamorising; consequences are
 * real and recovery is always possible.
 *
 * Chains:
 * - Match-fixing: fixing_approach → fixing_job → fixing_blackmail → fixing_investigation → fixing_verdict
 *   (`severity` var 1..4 carried down the chain decides the ban).
 * - Betting addiction: betting_app → chasing_losses → family_notices → recovery_checkin
 */
import {
  addiction, ban, canAfford, chairman, disc, energy, fans, flags, folPct, follow, form, fx, happy, hasClub, hasFlag,
  money, news, num, pickFull, press, rel, relNpc, rep, stress, t, chain, trust, wageX,
} from '../dsl'
import type { EventCtx, EventDef } from '../types'

const BANS = [0, 4, 10, 16, 20]
const sev = (ctx: EventCtx): number => Math.min(4, Math.max(1, Math.round(num(ctx, 'severity')) || 1))

export const casinoEvents: EventDef[] = [
  // ───────────── Match-fixing chain ─────────────
  {
    id: 'casino.fixing_approach',
    category: 'casino',
    weight: 0.6,
    cooldownWeeks: 60,
    triggers: ['casino', 'nightlife', 'weekly'],
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'fixing_accepted') && !hasFlag(state, 'fixing_reported'),
    vars: ({ state }, rng) => ({ amount: wageX(state, 25, 40000), stranger: pickFull(rng) }),
    title: t('Peçetedeki Rakam', 'The Number on the Napkin'),
    text: t(
      'Barda, saatinden pahalı takım elbisesiyle bir adam yanına oturdu. Kendini {stranger} diye tanıttı ve bir peçete kaydırdı: {amount:money}. "Bu hafta sonu ilk 30 dakikada bir sarı kart. Kimse incinmez. Sadece bazı bahisçiler biraz üzülür."',
      'At the bar, a man in a suit worth more than his watch sits down and introduces himself as {stranger}. He slides a napkin over: {amount:money}. "One yellow card before the 30th minute this weekend. Nobody gets hurt. A few bookmakers get a little sad."',
    ),
    icon: '🃏',
    choices: [
      {
        label: t('Federasyonun etik birimine bildir', "Report it to the federation's integrity unit"),
        hint: t('Doğru olan bu. Ama bu insanlar unutmaz.', "It's the right call. These people don't forget, though."),
        effects: () =>
          fx(
            t('Peçeteyi poşetleyip teslim ettin. Federasyon seni örnek gösterdi; telefonun bir süre gece yarısı çalıp sustu.', 'You bagged the napkin and handed it in. The federation held you up as an example; your phone rang and went silent at midnight for a while.'),
            rep(5), disc(6), chairman(8), press(6), stress(6),
            flags({ fixing_reported: true }),
            news(t('{heroName} şike teklifini ifşa etti', '{heroName} exposes match-fixing approach'), 1),
          ),
      },
      {
        label: t('Peçeteyi buruştur, sessizce çık', 'Crumple the napkin, leave quietly'),
        effects: () =>
          fx(t('Arkana bakmadan çıktın. Kimseye anlatmadın; bazı geceler hâlâ aklına geliyor.', 'You walked out without looking back. You told no one; some nights it still crosses your mind.'), stress(4), flags({ fixing_refused: true })),
      },
      {
        label: t('Peçeteyi cebine koy', 'Pocket the napkin'),
        hint: t('Yarısı peşin. Gerisi... sonra.', 'Half up front. The rest... later.'),
        risk: 'high',
        effects: (ctx) =>
          fx(
            t('Ertesi sabah kapının önünde bir spor çanta vardı. İçinde yarısı. Midene bir taş oturdu.', 'Next morning there was a gym bag on your doorstep. Half the money inside. A stone settled in your stomach.'),
            money(num(ctx, 'amount') / 2), stress(10), disc(-2),
            flags({ fixing_accepted: true }),
            follow(chain('casino.fixing_job', 1)),
          ),
      },
    ],
  },
  {
    id: 'casino.fixing_job',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 25, 40000), stranger: pickFull(rng) }),
    title: t('Maç Günü Mesajı', 'Matchday Message'),
    text: t(
      'Isınmadan önce kayıtlı olmayan bir numaradan mesaj: "30\'dan önce. Akıllılık yapma." Soyunma odasında {mate} her zamanki gibi şarkı söylüyor; senin elin titriyor.',
      'Before the warm-up, a text from an unknown number: "Before 30. Don\'t get clever." In the dressing room {mate} is singing as usual; your hands are shaking.',
    ),
    icon: '📱',
    choices: [
      {
        label: t('İşi yap', 'Do the job'),
        risk: 'high',
        effects: (ctx) =>
          fx(
            t('22. dakikada geç ve gereksiz bir kayma. Sarı kart. Tribün homurdandı, {managerName} kaşlarını çattı. Gecenin sonunda çantanın diğer yarısı geldi.', 'A late, pointless slide in the 22nd minute. Yellow card. The stands groaned and {managerName} frowned. By midnight the other half of the bag arrived.'),
            money(num(ctx, 'amount') / 2), disc(-4), trust(-3), stress(10),
            flags({ fixing_did: true }),
            follow(chain('casino.fixing_blackmail', 3)),
          ),
      },
      {
        label: t('Son anda vazgeç, dürüst oyna', 'Back out, play it straight'),
        hint: t('Paranın yarısı sende kaldı. Onlar bunu unutmaz.', 'You still have half their money. They will remember.'),
        risk: 'medium',
        effects: () =>
          fx(
            t('Doksan dakika temiz oynadın. Telefonun maç bitmeden 14 kez çaldı.', 'Ninety clean minutes. Your phone rang 14 times before the final whistle.'),
            stress(12), form(2),
            flags({ fixing_backed_out: true }),
            follow(chain('casino.fixing_blackmail', 2)),
          ),
      },
      {
        label: t('Parayı al, doğrudan federasyona git', 'Take the money straight to the federation'),
        hint: t('Kendini ihbar etmek ağır ama temiz.', 'Turning yourself in is heavy, but clean.'),
        effects: (ctx) =>
          fx(
            t('Çantayı masaya koydun ve her şeyi anlattın. Yetkili not alırken bir an sana acıyarak baktı.', 'You put the bag on the desk and told them everything. The officer, taking notes, gave you a look that was almost pity.'),
            money(-num(ctx, 'amount') / 2), stress(6),
            flags({ fixing_confessed: true }),
            follow(chain('casino.fixing_verdict', 3, { severity: 1 })),
          ),
      },
    ],
  },
  {
    id: 'casino.fixing_blackmail',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 25, 40000), stranger: pickFull(rng) }),
    title: t('Fotoğraflar', 'The Photos'),
    text: t(
      '{stranger} yine karşında. Telefonunda sen, peçete ve çanta var. "Şimdi bütün bir maç istiyoruz. {rivalClub} maçında kötü bir gün geçir. Aynı para. Yoksa bu kareler gazetelere gider."',
      '{stranger} again. On his phone: you, the napkin, the bag. "Now we want a whole match. Have a bad day against {rivalClub}. Same money. Or these go to the papers."',
    ),
    icon: '📸',
    choices: [
      {
        label: t('Dediklerini yap', 'Do what they say'),
        risk: 'high',
        effects: (ctx) =>
          fx(
            t('Hiç olmadığın kadar kötüydün. Taraftarlar ıslıkladı, para geldi. Aynı hafta bahis şirketleri şüpheli oranları federasyona bildirdi.', 'You were worse than you have ever been. The fans whistled, the money came. The same week, bookmakers flagged the odd betting pattern to the federation.'),
            money(num(ctx, 'amount')), form(-8), fans(-8), stress(12), disc(-5),
            follow(chain('casino.fixing_investigation', 2, { severity: 3 })),
          ),
      },
      {
        label: t('Reddet ve federasyona git', 'Refuse and go to the federation'),
        hint: t('Geç kalmış bir dürüstlük de dürüstlüktür.', 'Late honesty is still honesty.'),
        effects: (ctx) =>
          fx(
            t('Hepsini anlattın. Bir avukat "itiraf etmen cezanı hafifletecek" dedi. Hafifletecek, silmeyecek.', 'You told them everything. A lawyer said confessing would soften the sentence. Soften, not erase.'),
            stress(8), happy(-4),
            flags({ fixing_confessed: true }),
            follow(chain('casino.fixing_verdict', 3, { severity: hasFlag(ctx.state, 'fixing_did') ? 2 : 1 })),
          ),
      },
      {
        label: t('Sessiz kalmaları için öde', 'Pay them to go away'),
        hint: t('Şantajcılar nadiren bir kez ister.', 'Blackmailers rarely ask only once.'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar paran yok.', "You don't have that kind of money."),
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(
                t('Para gitti, {stranger} kayboldu. Bir ay sonra çetenin çökertildiğini haberlerde okudun. Adın geçmiyordu. Şimdilik.', 'The money went, {stranger} vanished. A month later you read the ring had been busted. Your name wasn\'t mentioned. For now.'),
                money(-num(ctx, 'amount')), stress(6), flags({ fixing_buried: true }),
              )
            : fx(
                t('Parayı aldılar; iki hafta sonra polis onları yakaladı. Defterlerinde senin adın ve ödemenin tarihi vardı.', 'They took the money; two weeks later the police caught them. Their ledger had your name and the date of your payment.'),
                money(-num(ctx, 'amount')), stress(12),
                follow(chain('casino.fixing_investigation', 2, { severity: 3 })),
              ),
      },
    ],
  },
  {
    id: 'casino.fixing_investigation',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }, rng) => ({ amount: wageX(state, 25, 40000), stranger: pickFull(rng), severity: 2, lawyerFee: wageX(state, 8, 15000) }),
    title: t('Başkanın Odasında İki Kişi', "Two People in the Chairman's Office"),
    text: t(
      'Federasyon etik biriminden iki kişi, {chairmanName} ile birlikte seni bekliyor. Masada üzerinde adın yazan bir dosya. "Telefon kayıtları. Bahis hareketleri. Sizin tarafınızı da dinlemek istiyoruz."',
      'Two people from the federation integrity unit are waiting with {chairmanName}. On the desk: a folder with your name on it. "Phone records. Betting patterns. We would like to hear your side."',
    ),
    icon: '🗂️',
    choices: [
      {
        label: t('Her şeyi itiraf et', 'Confess everything'),
        hint: t('İşbirliği cezayı hafifletir.', 'Cooperation reduces the sentence.'),
        effects: (ctx) =>
          fx(
            t('İki saat konuştun. Çıktığında omuzlarından bir yük kalktı; yerine korku oturdu.', 'You talked for two hours. When you walked out a weight lifted from your shoulders; fear took its place.'),
            stress(6), chairman(-10),
            flags({ fixing_confessed: true }),
            follow(chain('casino.fixing_verdict', 2, { severity: Math.max(1, sev(ctx) - 1) })),
          ),
      },
      {
        label: t('Her şeyi inkâr et', 'Deny everything'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.35)
            ? fx(
                t('Delil yetersiz bulundu. Soruşturma kapandı. Ama {chairmanName} artık sana eskisi gibi bakmıyor, sen de aynaya.', "Insufficient evidence. Case closed. But {chairmanName} doesn't look at you the same way any more, and neither does the mirror."),
                rep(-3), chairman(-12), stress(10),
                flags({ fixing_cleared: true }),
                news(t('{heroName} hakkındaki soruşturma delil yetersizliğinden kapandı', 'Investigation into {heroName} closed for lack of evidence'), 0),
              )
            : fx(
                t('Mesaj kayıtları masaya kondu. Yalan söylediğin de dosyaya eklendi.', 'The message logs were laid on the table. The lie went into the file too.'),
                stress(14), chairman(-15),
                follow(chain('casino.fixing_verdict', 2, { severity: Math.min(4, sev(ctx) + 1) })),
              ),
      },
      {
        label: t('En iyi spor avukatını tut', 'Hire the best sports lawyer'),
        hint: t('Ücret: {lawyerFee:money}', 'Fee: {lawyerFee:money}'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'lawyerFee')),
        lockedHint: t('Avukat ücreti için paran yetmiyor.', "You can't afford the lawyer's fee."),
        effects: (ctx) =>
          fx(
            t('Avukat usul hatalarını tek tek buldu. Suçsuz değilsin, ama ceza pazarlığı masaya geldi.', 'The lawyer found every procedural crack. You are not innocent, but a plea deal is on the table.'),
            money(-num(ctx, 'lawyerFee')), stress(4),
            follow(chain('casino.fixing_verdict', 3, { severity: Math.max(1, sev(ctx) - 1) })),
          ),
      },
    ],
  },
  {
    id: 'casino.fixing_verdict',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ amount: wageX(state, 25, 40000), severity: 2, lawyerFee: wageX(state, 8, 15000) }),
    title: t('Disiplin Kurulu Kararı', 'The Disciplinary Verdict'),
    text: t(
      'Kurul kararını okuyor. Dışarıda flaşlar patlıyor. {clubName} iki satırlık bir açıklama yayımladı. Bundan sonra ne diyeceğin, kariyerinin geri kalanını belirleyecek.',
      'The board reads its decision. Flashes pop outside. {clubName} has issued a two-line statement. What you say next will shape the rest of your career.',
    ),
    icon: '⚖️',
    choices: [
      {
        label: t('Cezayı kabul et, kamuoyundan özür dile', 'Accept the ban, apologise publicly'),
        effects: (ctx) => {
          const s = sev(ctx)
          return fx(
            t('Kameraların karşısında sesin titredi ama kaçmadın. Bazı taraftarlar sırtını döndü, bazıları "insan hata yapar" dedi.', 'Your voice shook in front of the cameras but you did not dodge. Some fans turned their backs; some said "everyone deserves a second chance."'),
            ban(BANS[s]), money(-num(ctx, 'amount') * 0.25 * s), disc(-8 * s), rep(-2 * s), fans(-4 * s), stress(8),
            { addFlags: { scandals: 1 } },
            flags({ fixing_closed: true }),
            news(t('{heroName}, şike skandalında {clubName} formasından men edildi', '{heroName} banned over match-fixing scandal'), -1),
          )
        },
      },
      {
        label: t('İtiraz et', 'Appeal'),
        hint: t('Avukat: {lawyerFee:money}. Kaybedersen ceza büyüyebilir.', 'Lawyer: {lawyerFee:money}. Lose and it may grow.'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'lawyerFee')),
        lockedHint: t('İtiraz için paran yok.', "You can't fund an appeal."),
        effects: (ctx, rng) => {
          const s = sev(ctx)
          return rng.chance(0.3)
            ? fx(
                t('Tahkim cezayı yarıya indirdi. Hâlâ bir cezan var; ama yeniden oynayabileceğin tarih yaklaştı.', 'The tribunal halved the ban. It is still a ban, but your comeback date moved closer.'),
                money(-num(ctx, 'lawyerFee')), ban(Math.ceil(BANS[s] / 2)), disc(-5 * s), rep(-2 * s), stress(6),
                { addFlags: { scandals: 1 } }, flags({ fixing_closed: true }),
                news(t('{heroName}\'in şike cezası itirazda indirildi', "{heroName}'s fixing ban reduced on appeal"), -1),
              )
            : fx(
                t('İtiraz reddedildi; kurul "pişmanlık göstermedi" notunu ekledi.', 'Appeal rejected; the board added a note: "showed no remorse."'),
                money(-num(ctx, 'lawyerFee')), ban(Math.min(20, BANS[s] + 2)), disc(-10 * s), rep(-3 * s), fans(-5 * s), stress(12),
                { addFlags: { scandals: 1 } }, flags({ fixing_closed: true }),
                news(t('{heroName}\'in itirazı reddedildi, ceza arttı', "{heroName}'s appeal rejected, ban extended"), -1),
              )
        },
      },
      {
        label: t('Hikâyeni bir röportajda anlat', 'Tell your story in a long interview'),
        hint: t('Dürüstlük takdir görebilir. Ya da daha çok konuşulursun.', 'Candour may earn respect. Or more headlines.'),
        risk: 'medium',
        effects: (ctx) => {
          const s = sev(ctx)
          return fx(
            t('Nasıl tuzağa düştüğünü, korkuyu, utancı anlattın. Röportaj çok okundu; gençlere uyarı olarak okullarda gösterilmeye başladı.', 'You described the trap, the fear, the shame. The interview went far; schools started using it as a warning for young players.'),
            ban(BANS[s]), money(-num(ctx, 'amount') * 0.25 * s), disc(-6 * s), rep(-s), press(5), folPct(ctx, 4), stress(6),
            { addFlags: { scandals: 1 } }, flags({ fixing_closed: true }),
            news(t('{heroName}: "Şikeye nasıl çekildim"', '{heroName}: "How I was pulled into fixing"'), 0),
          )
        },
      },
    ],
  },

  // ───────────── Betting addiction chain ─────────────
  {
    id: 'casino.betting_app',
    category: 'casino',
    weight: ({ state }) => 0.5 + state.life.casino.addiction / 40,
    cooldownWeeks: 10,
    triggers: ['weekly', 'big_money', 'casino'],
    conditions: ({ state }) => state.life.casino.addiction >= 20 && !hasFlag(state, 'self_excluded'),
    vars: ({ state }) => ({ stake: wageX(state, 1, 500) }),
    title: t('Gece 01.47', '1:47 AM'),
    text: t(
      'Uyku yok. Bahis uygulaması parlıyor: "Tekrar hoş geldin {heroName}! Sana özel artırılmış oran." Haritada bile bulamayacağın bir ülkenin ikinci ligi. Başparmağın ekranın üzerinde.',
      'Can\'t sleep. The betting app glows: "Welcome back, {heroName}! A boosted price, just for you." Second division of a country you couldn\'t find on a map. Your thumb hovers.',
    ),
    icon: '📲',
    choices: [
      {
        label: t('Küçük bir bahis, eğlencesine', 'One small bet, just for fun'),
        hint: t('{stake:money}', '{stake:money}'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'stake')),
        lockedHint: t('Hesabında o kadar yok.', "Your account can't cover it."),
        effects: (ctx, rng) =>
          rng.chance(0.45)
            ? fx(
                t('92. dakikada gol, kupon tuttu! O küçük zafer hissi... işte asıl tuzak o.', 'A 92nd-minute goal, the slip lands! That little rush of winning... that is the real hook.'),
                money(num(ctx, 'stake')), addiction(6), happy(2),
                ...(rng.chance(0.5) ? [follow(chain('casino.chasing_losses', 1))] : []),
              )
            : fx(
                t('Kaleci 89\'da gol yedi. Kayıp küçük; ama içindeki "geri alırım" sesi büyüdü.', 'Their keeper conceded in the 89th. A small loss; but the "I\'ll win it back" voice got louder.'),
                money(-num(ctx, 'stake')), addiction(8), stress(4),
                follow(chain('casino.chasing_losses', 1)),
              ),
      },
      {
        label: t('Uygulamayı sil', 'Delete the app'),
        effects: () => fx(t('Sildin. Elin bir süre boşlukta telefonu aradı. Sonra uyudun.', 'Deleted. Your hand kept reaching for the phone for a while. Then you slept.'), addiction(-6), stress(3), happy(2)),
      },
      {
        label: t('Para yatırma limiti koy', 'Set a deposit limit'),
        hint: t('Yarım önlem, ama önlem.', 'A half-measure, but a measure.'),
        effects: () => fx(t('Limiti en düşüğe çektin. Uygulama üzgün bir ikonla "emin misin?" diye sordu. Emindin.', 'You set the lowest limit. The app asked "are you sure?" with a sad icon. You were.'), addiction(-3), stress(1)),
      },
    ],
  },
  {
    id: 'casino.chasing_losses',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => !hasFlag(state, 'self_excluded'),
    vars: ({ state }) => ({ stake: wageX(state, 1, 500), lost: wageX(state, 4, 2000) }),
    title: t('Kaybı Kovalamak', 'Chasing Losses'),
    text: t(
      'Bu hafta {lost:money} eksidesin. Uygulama bir "geri dönüş kuponu" öneriyor: on dört maç, dev oran. Ne ters gidebilir ki?',
      'You are down {lost:money} this week. The app suggests a "comeback accumulator": fourteen legs, huge odds. What could possibly go wrong?',
    ),
    icon: '📉',
    choices: [
      {
        label: t('Hepsini geri kazanmak için oyna', 'Go big to win it all back'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'lost')),
        lockedHint: t('Kovalayacak paran bile kalmadı.', 'There is not even money left to chase with.'),
        effects: (ctx, rng) =>
          rng.chance(0.15)
            ? fx(
                t('On dördüncü maç da tuttu. Çığlık attın. Sonra sabaha kadar yeni kupon yaptın.', 'The fourteenth leg came in. You screamed. Then you built new slips until sunrise.'),
                money(num(ctx, 'lost') * 2), addiction(12), stress(4), energy(-10),
              )
            : fx(
                t('On üçüncü maçta beraberlik. Gözlerin ekranda, gün ağarıyor.', 'Leg thirteen ends in a draw. Eyes on the screen as dawn breaks.'),
                money(-num(ctx, 'lost')), addiction(12), stress(10), energy(-12), form(-3),
                follow(chain('casino.family_notices', 2)),
              ),
      },
      {
        label: t('Kapat ve uyu', 'Close it and sleep'),
        effects: () => fx(t('Zor oldu. Kayıp hâlâ canını yakıyor ama daha derine inmedin.', 'It was hard. The loss still stings, but you didn\'t dig deeper.'), addiction(-4), stress(5)),
      },
      {
        label: t('{friendName}\'ı ara', 'Call {friendName}'),
        hint: t('Saat gece üç.', "It's 3 AM."),
        effects: () =>
          fx(
            t('{friendName} uykulu bir sesle açtı ve bir saat seni dinledi. "Yarın kahvaltı benden, telefonu da bana ver."', '{friendName} picked up half-asleep and listened for an hour. "Breakfast tomorrow is on me. And hand me that phone."'),
            rel('bestFriend', 6), addiction(-8), stress(-3), energy(-5),
          ),
      },
    ],
  },
  {
    id: 'casino.family_notices',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ therapy: wageX(state, 2, 800) }),
    title: t('Mutfak Masasındaki Ekstreler', 'Statements on the Kitchen Table'),
    text: t(
      '{motherName} aradı, sesi alışılmadık derecede sessiz: "Canım... banka ekstrelerini gördüm. Konuşalım mı?"',
      '{motherName} calls, voice unusually quiet: "Sweetheart... I saw the bank statements. Can we talk?"',
    ),
    icon: '🏠',
    choices: [
      {
        label: t('Kabul et, terapiye başla', 'Admit it, start therapy'),
        hint: t('Seans ücretleri: {therapy:money}', 'Sessions: {therapy:money}'),
        effects: (ctx) =>
          fx(
            t('İlk seansta saatlerce sustun, sonra her şey döküldü. Yol uzun, ama artık yalnız değilsin.', 'At the first session you said nothing for ages, then it all came out. The road is long, but you are no longer alone on it.'),
            money(-num(ctx, 'therapy')), addiction(-20), stress(-6), rel('mother', 10), rel('partner', 6),
            flags({ in_therapy: true }),
            follow(chain('casino.recovery_checkin', 6)),
          ),
      },
      {
        label: t('Kendini bahis sitelerinden yasaklat', 'Register for self-exclusion'),
        effects: () =>
          fx(
            t('Formu doldurdun: hiçbir lisanslı site ve kumarhane seni artık içeri almayacak. {motherName} ağladı, sonra sana sarıldı.', 'You filled in the form: no licensed site or casino will let you in now. {motherName} cried, then hugged you.'),
            addiction(-15), stress(3), rel('mother', 6),
            flags({ self_excluded: true }),
            follow(chain('casino.recovery_checkin', 6)),
          ),
      },
      {
        label: t('"Her şey kontrolümde."', '"It\'s under control."'),
        risk: 'high',
        effects: () =>
          fx(
            t('Telefonun öbür ucunda uzun bir sessizlik. Sonra "Peki" dedi. O "peki" günlerce kulağında çınladı.', 'A long silence on the line. Then: "Alright." That "alright" rang in your ears for days.'),
            rel('mother', -12), rel('partner', -6), addiction(5), stress(6), happy(-3),
          ),
      },
    ],
  },
  {
    id: 'casino.recovery_checkin',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ stake: wageX(state, 1, 500) }),
    title: t('Altı Hafta Temiz', 'Six Weeks Clean'),
    text: t(
      'Altı haftadır tek kupon yok. Sonra akışına derbi oranları düşüyor, tam da "artık iyiyim" dediğin gün.',
      'Six weeks without a single slip. Then derby odds pop up in your feed, on the very day you thought "I\'m fine now."',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('Terapistini / destek grubunu ara', 'Call your therapist or support group'),
        effects: () => fx(t('Konuşunca dürtü söndü. Grup sana küçük bir anahtarlık verdi: "6 hafta". Cebinde taşıyorsun.', 'Talking it through, the urge faded. The group gave you a little keyring: "6 weeks". You carry it everywhere.'), addiction(-10), happy(5), stress(-5), flags({ recovered: true })),
      },
      {
        label: t('Bildirimleri kapat, koşuya çık', 'Mute it and go for a run'),
        effects: () => fx(t('On kilometre. Bacakların yandı, kafan sustu.', 'Ten kilometres. Your legs burned; your head went quiet.'), addiction(-5), energy(-6), form(2)),
      },
      {
        label: t('"Bir tane, eski günlerin hatırına"', '"Just one, for old times\' sake"'),
        risk: 'high',
        effects: (ctx) => fx(t('Bir tane, sonra bir tane daha. Anahtarlık çekmecenin dibine gitti.', 'One, then another. The keyring went to the back of the drawer.'), money(-num(ctx, 'stake')), addiction(12), stress(8), happy(-4), flags({ relapse: true })),
      },
    ],
  },

  // ───────────── Standalone casino nights ─────────────
  {
    id: 'casino.high_roller',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 8,
    triggers: ['casino'],
    conditions: ({ state }) => state.life.money >= wageX(state, 5, 5000) && !hasFlag(state, 'self_excluded'),
    vars: ({ state }) => ({ amount: wageX(state, 5, 5000) }),
    title: t('Özel Salon', 'The Private Room'),
    text: t(
      'Kadife ceketli bir host seni arka salona davet ediyor. Minimum bahis {amount:money}. "Sizin gibi oyuncular masaya şans getirir."',
      'A host in a velvet jacket invites you to the back room. Minimum stake {amount:money}. "Players like you bring luck to the table."',
    ),
    icon: '🎰',
    choices: [
      {
        label: t('Otur ve oyna', 'Sit down and play'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Masanın minimumunu karşılayamıyorsun.', "You can't cover the table minimum."),
        effects: (ctx, rng) => {
          const leak = rng.chance(0.25)
          const extra = leak ? [disc(-4), news(t('{heroName} yüksek bahisli masada görüntülendi', '{heroName} spotted at high-stakes table'), -1)] : []
          return rng.chance(0.4)
            ? fx(
                t('Kartlar seni sevdi: masadan kârla kalktın. Host ismini not defterine yazdı.', 'The cards loved you: you left the table up. The host wrote your name in a little book.'),
                money(num(ctx, 'amount') * 1.5), happy(5), addiction(6), ...extra,
              )
            : fx(
                t('Üç el, üç kayıp. Host gülümsemesini hiç bozmadı.', 'Three hands, three losses. The host never stopped smiling.'),
                money(-num(ctx, 'amount')), stress(6), addiction(6), ...extra,
              )
        },
      },
      {
        label: t('Bir el izle', 'Watch a single hand'),
        effects: () => fx(t('İzledin. Bir yabancı tek elde bir arabanın parasını kaybetti, gülerek.', 'You watched. A stranger lost the price of a car in one hand, laughing.'), addiction(2), happy(1)),
      },
      {
        label: t('Teşekkür et, eve git', 'Thank them and go home'),
        effects: () => fx(t('Taksi sessizdi. Ertesi sabah antrenmana zinde geldin.', 'The taxi ride was quiet. You turned up to training fresh next morning.'), addiction(-2), energy(5), disc(1)),
      },
    ],
  },
  {
    id: 'casino.lucky_streak',
    category: 'casino',
    weight: 1.2,
    cooldownWeeks: 6,
    triggers: ['casino'],
    conditions: () => true,
    vars: ({ state }) => ({ amount: wageX(state, 1.5, 800) }),
    title: t('Kırmızı Beş Kez', 'Red, Five Times'),
    text: t(
      'Rulet bu gece cömert: {amount:money} kârdasın. Arkanda bir kalabalık oluştu, her bahsinde tezahürat yapıyorlar.',
      'Roulette is generous tonight: you are {amount:money} up. A crowd has formed behind you, cheering every bet.',
    ),
    icon: '🎡',
    choices: [
      {
        label: t('Şimdi bozdur ve çık', 'Cash out now'),
        effects: (ctx) => fx(t('Fişleri bozdururken kalabalık hayal kırıklığıyla dağıldı. Cebin dolu, kafan rahat.', 'The crowd drifted off, disappointed, as you cashed in. Pockets full, head clear.'), money(num(ctx, 'amount')), happy(4), addiction(2)),
      },
      {
        label: t('Hepsini siyaha', 'Let it ride on black'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.47)
            ? fx(t('Siyah! Kalabalık çıldırdı. Biri video çekti bile.', 'Black! The crowd went wild. Someone even filmed it.'), money(num(ctx, 'amount') * 2), happy(6), addiction(7), folPct(ctx, 1))
            : fx(t('Kırmızı. Altıncı kez. Kalabalık "aaah" dedi ve dağıldı.', 'Red. Sixth time. The crowd went "ohhh" and melted away.'), addiction(7), stress(5), happy(-3)),
      },
      {
        label: t('Krupiyeye bahşiş bırak, herkese içki ısmarla', 'Tip the dealer, buy the room a round'),
        effects: (ctx) => fx(t('Yarısı gitti ama gece efsane oldu; masadakiler seni bir daha unutmayacak.', 'Half of it went, but the night became a legend; nobody at that table will forget you.'), money(num(ctx, 'amount') / 2), happy(6), addiction(3)),
      },
    ],
  },
  {
    id: 'casino.teammate_cards',
    category: 'casino',
    weight: 1,
    cooldownWeeks: 10,
    triggers: ['training', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ stake: wageX(state, 0.3, 200) }),
    title: t('Otobüsün Arka Koltuğu', 'Back of the Bus'),
    text: t(
      'Deplasman dönüşü, otobüsün arkasında {mate} desteyi karıştırıyor: "El başı {stake:money}. Kaptan kuralları, sızlanmak yok."',
      'Away trip home, back of the bus, {mate} is shuffling: "{stake:money} a hand. Captain\'s rules, no whining."',
    ),
    icon: '🂡',
    choices: [
      {
        label: t('Ciddi oyna', 'Play for real'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'stake') * 3),
        lockedHint: t('Cebinde bozuk para bile yok.', 'Not even loose change in your pocket.'),
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Blöfün tuttu, {mate} kartlarını camdan atmakla tehdit etti.', 'Your bluff worked; {mate} threatened to throw the cards out of the window.'), money(num(ctx, 'stake') * 3), relNpc(ctx.vars.mateId, ctx.vars.mate, 3), addiction(3), happy(3))
            : fx(t('{mate} seni yolun yarısında temizledi ve kalan yolu bunu anlatarak geçirdi.', "{mate} cleaned you out halfway home and spent the rest of the trip telling everyone."), money(-num(ctx, 'stake') * 3), relNpc(ctx.vars.mateId, ctx.vars.mate, 4), addiction(3)),
      },
      {
        label: t('Çekirdekle oynayalım', 'Play for sunflower seeds'),
        effects: () => fx(t('Para yok, çekirdek var. Otobüs kahkahadan sallandı; sezonun en iyi yolculuğu.', 'No money, just seeds. The bus shook with laughter; best trip of the season.'), rel('teammate', 3), happy(4)),
      },
      {
        label: t('Kulaklığı tak, rakibi izle', 'Headphones on, study the next opponent'),
        effects: () => fx(t('{managerName} dikiz aynasından seni gördü ve hafifçe başını salladı. Arkadan "inek" diye bir ses geldi.', '{managerName} caught you in the mirror and gave a little nod. From the back someone muttered "swot".'), trust(2), rel('teammate', -2), form(1)),
      },
    ],
  },
  {
    id: 'casino.online_poker',
    category: 'casino',
    weight: 0.8,
    cooldownWeeks: 16,
    triggers: ['weekly', 'social_post'],
    conditions: ({ state }) => (state.life.followers >= 10000 || state.hero.reputation >= 40) && !hasFlag(state, 'self_excluded'),
    vars: ({ state }, rng) => ({ host: pickFull(rng), buyin: wageX(state, 2, 1000) }),
    title: t('Canlı Yayında Poker', 'Poker, Live on Stream'),
    text: t(
      'Yayıncı {host} seni "ünlüler poker gecesi"ne çağırıyor. Giriş {buyin:money}, iki yüz bin izleyici bekleniyor.',
      'Streamer {host} invites you to a "celebrity poker night". Buy-in {buyin:money}, two hundred thousand viewers expected.',
    ),
    icon: '🎥',
    choices: [
      {
        label: t('Katıl ve kazanmaya oyna', 'Join and play to win'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'buyin')),
        lockedHint: t('Giriş ücreti için paran yok.', "You can't cover the buy-in."),
        effects: (ctx, rng) => {
          const sponsorFrown = rng.chance(0.3) ? [disc(-3)] : []
          return rng.chance(0.3)
            ? fx(t('Final masası, son el, as-papaz. Chat çıldırdı.', 'Final table, last hand, ace-king. Chat exploded.'), money(num(ctx, 'buyin') * 4), folPct(ctx, 6), addiction(5), happy(5), ...sponsorFrown)
            : fx(t('İlk saatte elendin; klibin "futbolcu blöfü" diye dolaşıyor.', 'Knocked out in the first hour; your clip is doing the rounds as "footballer bluff fail".'), money(-num(ctx, 'buyin')), folPct(ctx, 2), addiction(4), stress(3), ...sponsorFrown)
        },
      },
      {
        label: t('Katıl, kazancı bağışla', 'Join, donate any winnings'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'buyin')),
        lockedHint: t('Giriş ücreti için paran yok.', "You can't cover the buy-in."),
        effects: (ctx) => fx(t('Masada az kazandın ama yayın boyunca çocuk hastanesi için bağış toplandı.', 'You won little at the table, but the stream raised money for a children\'s hospital.'), money(-num(ctx, 'buyin')), rep(2), folPct(ctx, 3), addiction(2), happy(3)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('{host} "bir dahakine" dedi. Akşamı uzun bir film ve erken uykuyla geçirdin.', '{host} said "next time then". You spent the evening on a long film and an early night.'), energy(4), stress(-2)),
      },
    ],
  },
  {
    id: 'casino.teammate_bets',
    category: 'casino',
    weight: 0.8,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state),
    title: t('Telefondaki Kupon', 'The Slip on {g:His|Her} Phone'),
    text: t(
      'Soyunma odasında {mate}\'in telefon ekranını gördün: bir bahis kuponu. Kendi maçlarınız değil ama ligin maçları. Kurallar net: oyuncular futbola bahis oynayamaz.',
      "In the dressing room you glimpse {mate}'s screen: a betting slip. Not your games, but games in the league. The rules are clear: players can't bet on football.",
    ),
    icon: '🤫',
    choices: [
      {
        label: t('Özelde konuş', 'Have a private word'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('{mate} önce kızardı, sonra uygulamayı önünde sildi. "Sağ ol, gerçekten."', '{mate} went red, then deleted the app in front of you. "Thanks. Really."'), relNpc(ctx.vars.mateId, ctx.vars.mate, 10), happy(2))
            : fx(t('"Sana ne?" diye patladı. Antrenmanda sana pas vermemeye başladı.', '"None of your business," {g:he|she} snapped. {g:He|She} has stopped passing to you in training.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -10), stress(4)),
      },
      {
        label: t('Kulübün etik sorumlusuna bildir', "Tell the club's integrity officer"),
        hint: t('Kural kuraldır. Soyunma odası başka düşünebilir.', 'Rules are rules. The dressing room may see it differently.'),
        effects: (ctx) =>
          fx(
            t('Soruşturma sessizce yürüdü, {mate} ceza aldı. Kulüp yönetimi teşekkür etti; soyunma odasında bazıları seninle konuşmayı kesti.', '{mate} was quietly investigated and fined. The board thanked you; some in the dressing room stopped talking to you.'),
            disc(5), chairman(4), relNpc(ctx.vars.mateId, ctx.vars.mate, -20), rel('teammate', -4),
          ),
      },
      {
        label: t('Görmemiş gibi yap', 'Pretend you saw nothing'),
        effects: () => fx(t('Başka yöne baktın. Bilmek, bilmemekten ağır geliyor.', 'You looked away. Knowing weighs more than not knowing.'), stress(4), flags({ knew_mate_bets: true })),
      },
    ],
  },
]
