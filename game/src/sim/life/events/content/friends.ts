/** Friends: the people who knew you before the badge on your chest. */
import {
  canAfford, disc, energy, fans, flags, follow, folPct, fx, happy, hasFlag, hasRel, injury, money, nice, num, rel, relVal, rep, stress, t, chain, trust, wageX, boss, fatigue, news, press,
} from '../dsl'
import type { EventDef } from '../types'

export const friendsEvents: EventDef[] = [
  // ── Chain: childhood friend in debt ──
  {
    id: 'friends.debt_trouble',
    category: 'friends',
    gambling: true, // a gambling debt
    weight: 1,
    cooldownWeeks: 40,
    minAge: 18, // a gambling debt to loan sharks is not a 16-year-old's story
    conditions: ({ state }) => hasRel(state, 'bestFriend') && !hasFlag(state, 'friend_debt_open'),
    vars: ({ state }) => ({ amount: wageX(state, 3, 2000) }),
    title: t('Gece Yarısı Telefonu', 'The Midnight Call'),
    text: t(
      'Saat 01.12. Arayan {friendName}. Sesi titriyor: "Kumar borcu… Yanlış adamlara {amount:money} borçlandım. Yarına kadar bulamazsam iş çirkinleşecek. Başka kimsem yok."',
      '01:12 a.m. It\'s {friendName}, voice shaking: "Gambling debt… I owe {amount:money} to the wrong people. If I can\'t pay by tomorrow it gets ugly. I\'ve got nobody else."',
    ),
    icon: '📞',
    choices: [
      {
        label: t('Borcun tamamını kapat', 'Pay the whole debt'),
        hint: t('Mahalle dostluğu bedava değil.', 'Old friendships aren\'t free.'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Hesabında o kadar yok.', 'You don\'t have that much.'),
        effects: (ctx) =>
          fx(
            t('Parayı gönderdin. {friendName} hıçkırarak teşekkür etti. Uyuyamadın ama içinde bir huzur var.', 'You sent the money. {friendName} sobbed a thank-you. You didn\'t sleep, but you feel at peace.'),
            money(-num(ctx, 'amount')),
            rel('bestFriend', 20),
            happy(3),
            flags({ friend_debt_open: true, friend_debt_paid: 'full' }),
            follow(chain('friends.debt_aftermath', 3)),
          ),
      },
      {
        label: t('Yarısını ver, gerisini kendisi bulsun', 'Give half, the rest is on them'),
        kind: 'certain',
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, nice(num(ctx, 'amount') / 2)),
        lockedHint: t('Yarısı bile zor.', 'Even half is a stretch.'),
        effects: (ctx) =>
          fx(
            t('"Elimden gelen bu" dedin. {friendName} sessizce "sağ ol" dedi. Geri kalanı nasıl bulacak, bilmiyorsun.', '"This is what I can do," you said. {friendName} quietly said thanks. How the rest gets paid, you don\'t know.'),
            money(-nice(num(ctx, 'amount') / 2)),
            rel('bestFriend', 6),
            stress(5),
            flags({ friend_debt_open: true, friend_debt_paid: 'half' }),
            follow(chain('friends.debt_aftermath', 3)),
          ),
      },
      {
        label: t('Hayır de, bir danışman öner', 'Say no, suggest a debt counsellor'),
        effects: () =>
          fx(
            t('"Sana para değil, yol göstereyim." Telefon uzun bir sessizlikten sonra kapandı.', '"Let me help you find a way, not cash." The line went quiet for a long time, then dead.'),
            rel('bestFriend', -15),
            stress(4),
            flags({ friend_debt_open: true, friend_debt_paid: 'none' }),
            follow(chain('friends.debt_aftermath', 3)),
          ),
      },
    ],
  },
  {
    id: 'friends.debt_aftermath',
    category: 'friends',
    gambling: true, // the friend quits gambling
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Borcun Gölgesi', 'The Shadow of a Debt'),
    text: t(
      '{friendName} haftalar sonra kapını çaldı. Yüzü solgun ama gözlerinde bir şey değişmiş. "Konuşmamız lazım."',
      'Weeks later {friendName} knocks on your door. Pale, but something in their eyes has changed. "We need to talk."',
    ),
    icon: '🚪',
    choices: [
      {
        label: t('İçeri al, dinle', 'Let them in, listen'),
        effects: (ctx, rng) => {
          const paid = ctx.state.life.flags['friend_debt_paid']
          if (paid === 'full' && rng.chance(0.6))
            return fx(
              t('Kumarı bırakmış, bir depoda iş bulmuş. İlk maaşından sana küçük bir taksit getirdi. Bunu hiç unutmayacaksın.', 'They quit gambling and found a warehouse job. Brought you a first instalment from the very first paycheque. You won\'t forget it.'),
              money(nice(num(ctx, 'amount') / 4)),
              rel('bestFriend', 12),
              happy(6),
              flags({ friend_debt_open: null }),
            )
          if (paid === 'none')
            return fx(
              t('Borcu ailesinden toplamış. "Haklıydın belki" dedi, ama aranızda bir buz duvarı var.', 'They scraped it together from family. "Maybe you were right," they said, but there\'s ice between you now.'),
              rel('bestFriend', 4),
              stress(-2),
              flags({ friend_debt_open: null }),
            )
          return fx(
            t('Yine aynı masaya oturmuş. Bu sefer para istemedi; sadece utandı. Ona bir terapist ayarladın.', 'Back at the same table again. No request for money this time, only shame. You booked them a therapist.'),
            rel('bestFriend', 5),
            stress(6),
            money(-200),
            flags({ friend_debt_open: null }),
          )
        },
      },
      {
        label: t('"Bugün olmaz, maç var."', '"Not today, I\'ve got a match."'),
        effects: () =>
          fx(t('Kapıyı kapattın. Telefonuna gelen mesaj kısa: "Anladım."', 'You closed the door. The text that followed was short: "Got it."'), rel('bestFriend', -8), trust(1), flags({ friend_debt_open: null }), follow(chain('friends.debt_press', 10))),
      },
    ],
  },
  {
    id: 'friends.debt_press',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('"Unutulan Çocukluk Arkadaşı"', '"The Forgotten Childhood Friend"'),
    text: t(
      'Yerel bir gazete, mahalleden bir fotoğrafla manşet attı: "Yıldız futbolcu, kapısını çalan çocukluk arkadaşını geri çevirdi." On hafta önce kapattığın kapı şimdi herkesin gündeminde.',
      'A local paper runs a neighbourhood photo under the headline: "Star footballer turns away the childhood friend at his door." The door you closed ten weeks ago is now everyone\'s talking point.',
    ),
    icon: '📰',
    choices: [
      {
        label: t('Açıkça özür dile, onunla görüş', 'Apologise publicly and meet them'),
        effects: () =>
          fx(t('Mahalle kahvesinde bir çay içtiniz, fotoğrafı bu sefer gülerek çekildi.', 'You had tea at the neighbourhood café; this time the photo shows both of you laughing.'), rel('bestFriend', 14), press(3), fans(2), stress(-2), follow(chain('friends.debt_reunion', 4))),
      },
      {
        label: t('Yorum yapma', 'Say nothing'),
        kind: 'certain',
        risk: 'medium',
        effects: () => fx(t('Haber üç gün konuşuldu, sonra unutuldu. Ama arkadaşın unutmadı.', 'The story ran for three days, then faded. Your friend did not forget.'), press(-3), fans(-2), rel('bestFriend', -6), follow(chain('friends.debt_reunion', 8))),
      },
    ],
  },
  {
    id: 'friends.debt_reunion',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Eski Mahalle, Yeni Başlangıç', 'Old Neighbourhood, New Start'),
    text: t(
      'Haberden sonra {friendName} bir mesaj yolladı: mahalle takımının forma sponsoru arıyormuş. Yılların hatırı için bir şans daha?',
      'After the story, {friendName} sends a message: the neighbourhood team needs a shirt sponsor. One more chance for old times\' sake?',
    ),
    icon: '🏘️',
    choices: [
      {
        label: t('Formaları sen sponsor ol', 'Sponsor the shirts yourself'),
        requires: (ctx) => canAfford(ctx.state, 2000),
        lockedHint: t('Şimdilik bütçen yetmiyor.', 'You cannot afford it right now.'),
        effects: () => fx(t('Formalarda adın var. Mahalle seni yeniden "bizden biri" sayıyor.', 'Your name is on the shirts. The neighbourhood counts you as one of their own again.'), money(-2000), rel('bestFriend', 15), fans(4), happy(5), flags({ friend_debt_open: null })),
      },
      {
        label: t('Sadece maça git', 'Just go to the match'),
        effects: () => fx(t('Tribünde yan yana oturdunuz. Konuşmadan çok şey söylediniz.', 'You sat side by side in the stands, saying a lot without talking.'), rel('bestFriend', 7), happy(3), flags({ friend_debt_open: null })),
      },
    ],
  },
  // ── Chain: business idea ──
  {
    id: 'friends.business_pitch',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 52,
    conditions: ({ state }) => hasRel(state, 'bestFriend') && !hasFlag(state, 'friend_business'),
    vars: ({ state }) => ({ amount: wageX(state, 4, 3000) }),
    title: t('Döner Devrimi', 'The Kebab Revolution'),
    text: t(
      '{friendName} elinde peçeteye çizilmiş bir planla geldi: "{city}\'in ilk gece yarısı gurme döner büfesi. Adı: Uzatmalar. Sen {amount:money} koy, ortak olalım. Kaybetmek imkânsız!"',
      '{friendName} turns up with a plan drawn on a napkin: "{city}\'s first late-night gourmet kebab stand. Name: Extra Time. You put in {amount:money}, we\'re partners. Can\'t lose!"',
    ),
    icon: '🥙',
    choices: [
      {
        label: t('Ortak ol, ismini de ver', 'Invest and lend your name'),
        hint: t('Batarsa adın da batar.', 'If it sinks, your name sinks with it.'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu yatırım için paran yetmiyor.', 'You can\'t afford this stake.'),
        effects: (ctx) =>
          fx(
            t('Tabelaya senin forma numaran kondu. {friendName} ilk şişi sana çevirdi.', 'Your shirt number went up on the sign. {friendName} carved the first skewer for you.'),
            money(-num(ctx, 'amount')),
            rel('bestFriend', 15),
            flags({ friend_business: 'named' }),
            follow(chain('friends.business_result', 8)),
          ),
      },
      {
        label: t('Sessiz ortak ol', 'Be a silent partner'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, nice(num(ctx, 'amount') / 2)),
        lockedHint: t('Yarısı bile fazla.', 'Even half is too much.'),
        effects: (ctx) =>
          fx(
            t('Paranın yarısını koydun, adını kullanmamasını şart koştun.', 'You put in half and made them promise not to use your name.'),
            money(-nice(num(ctx, 'amount') / 2)),
            rel('bestFriend', 8),
            flags({ friend_business: 'silent' }),
            follow(chain('friends.business_result', 8, { amount: nice(num(ctx, 'amount') / 2) })),
          ),
      },
      {
        label: t('"Futbolla iş karışmaz."', '"I don\'t mix football and business."'),
        effects: () =>
          fx(t('{friendName} omuz silkti: "Sen bilirsin. Açılışa gel ama."', '{friendName} shrugged: "Your call. Come to the opening though."'), rel('bestFriend', -5)),
      },
    ],
  },
  {
    id: 'friends.business_result',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ amount: wageX(state, 4, 3000) }),
    title: t('Uzatmalar Büfesi: İlk Bilanço', 'Extra Time Kebabs: The Numbers'),
    text: t('{friendName} defteri masaya koydu. Yüzünden bir şey okunmuyor.', '{friendName} puts the ledger on the table. Poker face.'),
    icon: '📒',
    choices: [
      {
        label: t('Defteri aç', 'Open the ledger'),
        risk: 'medium',
        effects: (ctx, rng) => {
          const named = ctx.state.life.flags['friend_business'] === 'named'
          const stake = num(ctx, 'amount')
          if (rng.chance(0.5))
            return fx(
              t('Maç çıkışı kuyruklar köşeyi dönüyor! İlk payın {amount:money}\'nin üstünde.', 'Post-match queues round the corner! Your first cut beats your {amount:money} stake.'),
              money(nice(stake * 1.6)),
              rel('bestFriend', 8),
              happy(6),
              ...(named ? [rep(2), rel('fans', 4)] : []),
              flags({ friend_business: null }),
              ...(named ? [news(t('{heroName}\'ın dönercisi şehrin yeni favorisi', '{heroName}\'s kebab stand is the city\'s new favourite'), 1)] : []),
            )
          return fx(
            t('Belediye ruhsatı, kira, bir de yanan ızgara… Batık. Paranın çoğu gitti.', 'Permits, rent, and a grill fire… It\'s gone under. Most of your money went with it.'),
            money(nice(stake * 0.15)),
            rel('bestFriend', -4),
            stress(7),
            ...(named ? [rep(-2)] : []),
            flags({ friend_business: null }),
          )
        },
      },
      {
        label: t('Sonuç ne olursa olsun payını {friendName}\'e bırak', 'Whatever it says, gift your share to {friendName}'),
        effects: () =>
          fx(t('"Rakamlar seni ilgilendirsin, beni dostluğun." {friendName} bir süre konuşamadı.', '"You keep the numbers, I\'ll keep the friendship." {friendName} couldn\'t speak for a moment.'), rel('bestFriend', 18), happy(4), flags({ friend_business: null })),
      },
    ],
  },
  {
    id: 'friends.entourage',
    category: 'friends',
    weight: 0.9,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasRel(state, 'bestFriend') && state.hero.reputation >= 20,
    vars: ({ state }) => ({ amount: wageX(state, 0.5, 300) }),
    title: t('Sağ Kolun Olayım', 'Let Me Run Your Life'),
    text: t(
      '{friendName} işini bırakmış: "Senin her şeyini ben ayarlayayım. Ulaşım, sosyal medya, randevular. Haftada sadece {amount:money}. Menajer de ne ki?"',
      '{friendName} has quit their job: "Let me handle everything. Driving, socials, appointments. Just {amount:money} a week. Who needs an agent?"',
    ),
    icon: '🕶️',
    choices: [
      {
        label: t('Kabul et, dost eli iyidir', 'Hire them, friends make the best crew'),
        hint: t('Menajerin bu işi sevmeyecek.', 'Your agent won\'t love this.'),
        effects: (ctx) =>
          fx(
            t('{friendName} ertesi sabah kapında güneş gözlüğüyle bekliyordu. {agentName} ise telefonu açmıyor.', '{friendName} was at your door next morning in sunglasses. {agentName} has stopped answering.'),
            money(-num(ctx, 'amount') * 4),
            rel('bestFriend', 15),
            rel('agent', -10),
            happy(4),
            flags({ friend_entourage: true }),
          ),
      },
      {
        label: t('Sadece sosyal medyanı ver', 'Give them your socials only'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Paylaşımların hiç bu kadar samimi olmamıştı. Takipçiler bayıldı.', 'Your posts have never felt so real. Followers love it.'), folPct(ctx, 6), rel('bestFriend', 8))
            : fx(t('Saat 3\'te yanlışlıkla bir maç bileti çekiliş videosu attı. Yorumlar kaos.', 'They posted a "free tickets" giveaway at 3 a.m. by mistake. Comment section chaos.'), folPct(ctx, 2), rep(-1), stress(4), rel('bestFriend', 4)),
      },
      {
        label: t('"Dostluğa iş karıştırmayalım."', '"Let\'s not make it business."'),
        effects: () => fx(t('Anladı ama bozuldu. Akşam yemeğinde az konuştu.', 'They understood, but it stung. Dinner was quiet.'), rel('bestFriend', -8)),
      },
    ],
  },
  {
    id: 'friends.neighbourhood_match',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => !state.hero.injury,
    title: t('Mahalle Maçı', 'Back to the Old Pitch'),
    text: t(
      'Eski mahalleden mesaj: "Cumartesi beton sahada mahalle maçı! Kaleler taş, ödül kola. Gelmezsen sana \'yıldız oldu, unuttu\' diyeceğiz."',
      'A text from the old neighbourhood: "Saturday, the concrete pitch! Stones for goalposts, loser buys the cola. Don\'t come and we\'ll say fame went to your head."',
    ),
    icon: '🧱',
    choices: [
      {
        label: t('Git, eski günlerdeki gibi oyna', 'Go and play like the old days'),
        risk: 'medium',
        hint: t('Beton, krampona pek dost değil.', 'Concrete is no friend to ankles.'),
        effects: (ctx, rng) =>
          rng.chance(0.2)
            ? fx(t('Bir rabona denemesi, bir kaldırım kenarı… Bilek burkuldu. Hoca hiç memnun değil.', 'One rabona, one kerb… twisted ankle. The gaffer is not amused.'), injury(1, t('Burkulmuş bilek', 'Twisted ankle')), boss(-6), rel('bestFriend', 10), happy(6))
            : fx(t('Üç gol, bir de bütün mahalleye dondurma. Çocukluğun bir saatliğine geri geldi.', 'Hat-trick, and ice cream for the whole street. Your childhood came back for an hour.'), happy(10), rel('bestFriend', 10), folPct(ctx, 3), stress(-6), fatigue(5)),
      },
      {
        label: t('Git ama sadece hakemlik yap', 'Go, but only referee'),
        effects: () => fx(t('Düdük sendeydi; her kararına itiraz edildi. Yine de herkes güldü.', 'Whistle in hand, every call disputed. Everyone laughed anyway.'), happy(5), rel('bestFriend', 6), stress(-3)),
      },
      {
        label: t('İmzalı top gönder, gitme', 'Send a signed ball instead'),
        effects: () => fx(t('Top geldi, sen gelmedin. Grupta "yıldız oldu" sticker\'ı dolaşıyor.', 'The ball arrived, you didn\'t. A "too famous now" sticker is going round the group chat.'), rel('bestFriend', -6), money(-80), energy(5)),
      },
    ],
  },
  {
    id: 'friends.best_man',
    category: 'friends',
    weight: 0.8,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasRel(state, 'bestFriend') && relVal(state, 'bestFriend') > 0,
    vars: ({ state }) => ({ amount: wageX(state, 1, 800) }),
    title: t('{g:Sağdıç|Nedime} Sensin', 'You\'re the {g:Best Man|Maid of Honour}'),
    text: t(
      '{friendName} evleniyor ve seni {g:sağdıç|nedime} istiyor! Tek sorun: düğün, deplasman maçının ertesi sabahı, 800 kilometre ötede.',
      '{friendName} is getting married and wants you as {g:best man|maid of honour}! One problem: the wedding is the morning after an away game, 800 km away.',
    ),
    icon: '💍',
    choices: [
      {
        label: t('Özel uçuş kirala, ikisine de yetiş', 'Charter a flight, make both'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount') * 3),
        lockedHint: t('Özel uçuş için paran yetmiyor.', 'Can\'t afford a charter.'),
        effects: (ctx) =>
          fx(
            t('Maçtan duşa, duştan uçağa, uçaktan kürsüye. Konuşmanda herkes ağladı, sen de uykusuzluktan.', 'Match, shower, plane, podium. Your speech made everyone cry, and you nearly did from exhaustion.'),
            money(-num(ctx, 'amount') * 3),
            rel('bestFriend', 25),
            happy(10),
            fatigue(15),
          ),
      },
      {
        label: t('Hocadan izin iste, maçı kaçır', 'Ask the gaffer for leave, miss the match'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('{managerName}: "Aile önemli. Git." Beklenmedik bir insanlık.', '{managerName}: "Family matters. Go." Unexpectedly human.'), rel('bestFriend', 22), boss(3), happy(8))
            : fx(t('İzin çıkmadı ama sen yine gittin. Disiplin kuruluna çağrıldın.', 'Leave denied, you went anyway. Disciplinary hearing on Monday.'), rel('bestFriend', 22), boss(-12), disc(-10), trust(-6), happy(6)),
      },
      {
        label: t('Video mesaj gönder', 'Send a video message'),
        effects: () => fx(t('Videon salonda oynatıldı. Alkış aldı ama {g:sağdıç|nedime} sandalyesi boştu.', 'Your video played in the hall. Applause, but the {g:best man\'s|maid of honour\'s} chair stayed empty.'), rel('bestFriend', -12), trust(2)),
      },
    ],
  },
  {
    id: 'friends.photo_leak',
    category: 'friends',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasRel(state, 'bestFriend') && state.hero.reputation >= 15,
    title: t('Sızan Fotoğraf', 'The Leaked Photo'),
    text: t(
      'Bir dedikodu hesabı, geçen yaz tatilinde çekilmiş, şortla ve ağzında yarım lahmacunla uyuyakaldığın fotoğrafını paylaştı. Fotoğraf sadece {friendName}\'in telefonundaydı.',
      'A gossip account posted last summer\'s photo of you asleep in shorts, half a flatbread in your mouth. Only {friendName} had that photo.',
    ),
    icon: '📸',
    choices: [
      {
        label: t('{friendName}\'le yüzleş', 'Confront {friendName}'),
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Telefonu çalınmış meğer. Özür üstüne özür; ilişkiniz bu krizden güçlenerek çıktı.', 'Turns out their phone was stolen. Apology after apology; you came out of it closer.'), rel('bestFriend', 8), stress(-2))
            : fx(t('Para için satmış. "Kirayı ödeyemiyordum" dedi. Bir şey kırıldı.', 'They sold it. "I couldn\'t make rent," they said. Something broke.'), rel('bestFriend', -25), stress(8), happy(-6)),
      },
      {
        label: t('Gülüp geç, kendin de paylaş', 'Own it, repost it yourself'),
        effects: (ctx) =>
          fx(t('"Lahmacun pozisyonu: dünya klası." Yazınla birlikte internet sana âşık oldu.', '"Flatbread nap: world class." Your caption made the internet fall for you.'), folPct(ctx, 8), rep(1), happy(3), rel('bestFriend', 3)),
      },
      {
        label: t('Avukatına kaldırt', 'Get your lawyer to take it down'),
        effects: () =>
          fx(t('Fotoğraf kalktı ama "yıldız mizahtan anlamıyor" başlıkları çıktı.', 'Photo removed, but "star can\'t take a joke" headlines followed.'), money(-1500), press(-4), rep(-1), stress(-2), news(t('{heroName}, lahmacun fotoğrafı için avukat tuttu', '{heroName} lawyers up over flatbread photo'), -1)),
      },
    ],
  },
]
