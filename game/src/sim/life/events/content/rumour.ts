/**
 * Rumours: transfer gossip you can fuel or deny, relationship gossip and
 * fabricated quotes. Rumour heat is shared with interviews through the
 * `transfer_buzz` flag (0..10): fuel it and journalists ask about it.
 *
 * Chains:
 * - Transfer gossip (4 steps): transfer_gossip → transfer_club_reacts → transfer_fans_banner → transfer_resolution
 * - Romance gossip: romance_gossip → romance_photo
 */
import {
  boss, chain, chairman, fans, flagNum, flags, follow, fx, happy, hasClub, hasFlag, hasRel, money, news, press, rel, relNpc, rep, stress,
  t, trust, wageX, folPct, morale, disc, fatigue,
} from '../dsl'
import type { EventDef } from '../types'

const GIANTS = ['Real Atlético Norte', 'AC Valmonte', 'Royal Kingsbridge', 'Sporting Aurora', 'Olympique Lumière'] as const
const TABLOIDS = ['Gece Bekçisi', 'Sport Daily Star', 'Kulis Ekspres'] as const

export const rumourEvents: EventDef[] = [
  // ───────────── Transfer gossip (4 steps) ─────────────
  {
    id: 'rumour.transfer_gossip',
    category: 'rumour',
    weight: (ctx) => 0.8 + flagNum(ctx.state, 'transfer_buzz') * 0.15,
    cooldownWeeks: 20,
    maxPerCareer: 2,
    triggers: ['weekly', 'transfer_window', 'scored'],
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 18 && !hasFlag(state, 'rumour_active'),
    vars: (_ctx, rng) => ({ giant: rng.pick(GIANTS), tabloid: rng.pick(TABLOIDS) }),
    title: t('"Kaynaklara Göre..."', '"Sources Say..."'),
    text: t(
      '{tabloid} manşeti: "{giant}, {heroName} için harekete geçti!" Kaynak: "kulübe yakın bir isim". Kulübe en yakın isim muhtemelen otoparktaki güvenlik görevlisi.',
      '{tabloid} splash: "{giant} make their move for {heroName}!" Source: "someone close to the club". The closest person to the club is probably the car-park attendant.',
    ),
    icon: '🗞️',
    choices: [
      {
        label: t('Gizemli bir paylaşımla körükle 👀', 'Fuel it with a cryptic post 👀'),
        hint: t('Değerin artar, taraftar sinirlenir.', 'Your value rises; the fans get twitchy.'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('Sadece bir uçak emojisi paylaştın. İnternet kırk sekiz saat boyunca başka bir şey konuşmadı.', 'You posted a single aeroplane emoji. The internet talked about nothing else for forty-eight hours.'),
            folPct(ctx, 4), fans(-4), rel('agent', 3), chairman(-3),
            { addFlags: { transfer_buzz: 3 } }, flags({ rumour_active: true, rumour_fuelled: true }),
            follow(chain('rumour.transfer_club_reacts', 1)),
          ),
      },
      {
        label: t('Kesin bir dille yalanla', 'Deny it firmly'),
        effects: () =>
          fx(
            t('"Buradayım, burada mutluyum." Taraftar grubu açıklamanı stadın girişine astı.', '"I\'m here and I\'m happy here." The supporters\' club pinned your statement at the stadium gate.'),
            fans(5), chairman(3), rel('agent', -2), { addFlags: { transfer_buzz: -3 } }, flags({ rumour_active: null }),
          ),
      },
      {
        label: t('Hiçbir şey söyleme', 'Say nothing at all'),
        effects: () => fx(t('Sessizliğin de bir manşet oldu: "{heroName} susuyor!"', 'Your silence became a headline too: "{heroName} stays silent!"'), press(-1), { addFlags: { transfer_buzz: 1 } }, flags({ rumour_active: true }), follow(chain('rumour.transfer_club_reacts', 2))),
      },
    ],
  },
  {
    id: 'rumour.transfer_club_reacts',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Başkanın Odası', 'The Chairman\'s Office'),
    text: t(
      '{chairmanName} gazeteyi masaya fırlattı: "{giant} mi? Bana önce senden duymak isterdim. Söyle bakalım, aklın nerede?"',
      '{chairmanName} throws the paper on the desk: "{giant}? I\'d have liked to hear it from you first. So tell me, where\'s your head at?"',
    ),
    icon: '🏢',
    choices: [
      {
        label: t('"Kalbim burada, ama hak ettiğimi istiyorum."', '"My heart is here, but I want what I deserve."'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Başkan bir süre baktı, sonra güldü: "Pazarlığı da öğrenmişsin." Yeni sözleşme masada konuşulacak.', 'He stared, then laughed: "You\'ve learned to negotiate." A new deal will be discussed.'), chairman(2), rep(1), flags({ renewal_push: true }), follow(chain('rumour.transfer_fans_banner', 1)))
            : fx(t('"Hak ettiğini sahada göster." Toplantı bitti.', '"Show what you deserve on the pitch." Meeting over.'), chairman(-4), stress(3), follow(chain('rumour.transfer_fans_banner', 1))),
      },
      {
        label: t('"Haberlerin hepsi uydurma."', '"It\'s all made up."'),
        effects: (ctx) =>
          hasFlag(ctx.state, 'rumour_fuelled')
            ? fx(t('Başkan telefonunu çevirdi: ekranda senin uçak emojin. Sessizlik çok uzun sürdü.', 'The chairman turned his phone around: your aeroplane emoji. The silence lasted a very long time.'), chairman(-8), trust(-3), follow(chain('rumour.transfer_fans_banner', 1)))
            : fx(t('İnandı. Hatta {tabloid}\'a dava açmayı düşünüyor.', 'He believes you. He\'s even thinking of suing {tabloid}.'), chairman(5), follow(chain('rumour.transfer_fans_banner', 1))),
      },
      {
        label: t('{agentName} konuşsun', 'Let {agentName} do the talking'),
        effects: () => fx(t('{agentName} kırk dakika konuştu, hiçbir şey söylemedi. Bu bir sanat.', '{agentName} spoke for forty minutes and said nothing. It\'s an art.'), rel('agent', 2), chairman(-1), follow(chain('rumour.transfer_fans_banner', 1))),
      },
    ],
  },
  {
    id: 'rumour.transfer_fans_banner',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Tribündeki Pankart', 'The Banner in the Stand'),
    text: t(
      'Maçta kale arkasında dev bir pankart: "{heroName}, BU FORMA SENİ {giant} İÇİN YETİŞTİRMEDİ". Altında daha küçük harflerle: "ama gidersen bize forma at".',
      'A giant banner behind the goal: "{heroName}, THIS SHIRT DIDN\'T RAISE YOU FOR {giant}". Underneath, smaller: "but if you go, throw us your shirt".',
    ),
    icon: '🏳️',
    choices: [
      {
        label: t('Golden sonra armayı öp', 'Kiss the badge after your next goal'),
        effects: () => fx(t('Arma öpüldü, tribün çıldırdı. {agentName} telefonu kapattı.', 'Badge kissed, stands erupted. {agentName} hung up the phone.'), fans(8), rel('agent', -3), { addFlags: { transfer_buzz: -2 } }, follow(chain('rumour.transfer_resolution', 2))),
      },
      {
        label: t('Taraftar grubuyla buluş', 'Meet the supporters\' group'),
        effects: () => fx(t('Çay, simit ve dürüst bir konuşma. "Seni anlıyoruz ama kolay değil" dediler.', 'Tea, bagels and an honest chat. "We get it, but it isn\'t easy," they said.'), fans(5), stress(-2), follow(chain('rumour.transfer_resolution', 2))),
      },
      {
        label: t('Görmezden gel', 'Ignore it'),
        effects: () => fx(t('Pankart üç hafta kaldı. Sen de üç hafta o tarafa bakmadın.', 'The banner stayed three weeks. You didn\'t look that way for three weeks.'), fans(-3), morale(-2), follow(chain('rumour.transfer_resolution', 2))),
      },
    ],
  },
  {
    id: 'rumour.transfer_resolution',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ raise: wageX(state, 3, 2000) }),
    title: t('Söylenti Nereye Vardı?', 'Where the Rumour Led'),
    text: t(
      'Pencere kapanmak üzere. {giant} cephesinden ses yok; ama söylenti işini yaptı: adın artık daha çok konuşuluyor. Son hamle senin.',
      'The window is about to close. Not a word from {giant}; but the rumour did its job: your name carries further now. Last move is yours.',
    ),
    icon: '🔚',
    choices: [
      {
        label: t('Kulüpten prim iste', 'Ask the club for a loyalty bonus'),
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Başkan "sadakat primi" adı altında {raise:money} onayladı. Kimse "söylenti primi" demedi.', 'The chairman approved {raise:money} as a "loyalty bonus". Nobody called it a "rumour bonus".'), money(num0(ctx.vars.raise)), chairman(-2), flags({ rumour_active: null, rumour_fuelled: null }))
            : fx(t('"Sadakat prim istemez" dedi başkan. Haklı mı? Belki.', '"Loyalty doesn\'t ask for bonuses," said the chairman. Is he right? Maybe.'), chairman(-3), happy(-2), flags({ rumour_active: null, rumour_fuelled: null })),
      },
      {
        label: t('Sayfayı kapat, futbola dön', 'Close the chapter, back to football'),
        effects: () => fx(t('Söylenti söndü. Değerin ise sönmedi.', 'The rumour faded. Your market value didn\'t.'), rep(2), trust(2), stress(-3), { addFlags: { transfer_buzz: -5 } }, flags({ rumour_active: null, rumour_fuelled: null })),
      },
    ],
  },
  // ───────────── Relationship rumours ─────────────
  {
    id: 'rumour.romance_gossip',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 26,
    maxPerCareer: 2,
    conditions: ({ state }) => state.hero.reputation >= 15,
    vars: (_ctx, rng) => ({ celeb: rng.pick(['pop yıldızı Lal', 'oyuncu Derin Ay', 'şarkıcı Nova', 'sunucu Pera Kaya']), tabloid: rng.pick(TABLOIDS) }),
    title: t('Aşk Dedikodusu', 'Love Gossip'),
    text: t(
      '{tabloid}: "{heroName} ile {celeb} aynı restoranda görüldü!" Aynı restoran, farklı masalar, farklı saatler. Ama fotoğrafın açısı başka şey söylüyor.',
      '{tabloid}: "{heroName} and {celeb} spotted at the same restaurant!" Same restaurant, different tables, different times. The camera angle tells another story.',
    ),
    icon: '💘',
    choices: [
      {
        label: t('Gülerek yalanla', 'Laugh it off'),
        effects: (ctx) =>
          fx(t('"Ben o akşam köfte yedim, yalnız." Köfteci sana teşekkür mesajı attı.', '"I had meatballs that night. Alone." The meatball place sent a thank-you note.'), press(2), folPct(ctx, 1), ...(hasRel(ctx.state, 'partner') ? [rel('partner', -2)] : [])),
      },
      {
        label: t('Bir şey söyleme, gizem iyidir', 'Say nothing; mystery sells'),
        kind: 'certain',
        risk: 'medium',
        effects: (ctx) =>
          hasRel(ctx.state, 'partner')
            ? fx(t('Takipçilerin uçtu. {partnerName} ise "gizem" kelimesinden hiç hoşlanmadı.', 'Followers soared. {partnerName} did not enjoy the word "mystery".'), folPct(ctx, 5), rel('partner', -8), follow(chain('rumour.romance_photo', 1)))
            : fx(t('Takipçilerin uçtu. Annen aradı: "O kim? Neden en son ben duyuyorum?"', 'Followers soared. Your mum called: "Who is this, and why am I the last to know?"'), folPct(ctx, 5), rel('mother', -2), follow(chain('rumour.romance_photo', 1))),
      },
      {
        label: t('Avukatla düzeltme iste', 'Demand a correction via lawyer'),
        effects: () => fx(t('Gazete küçük bir düzeltme bastı, 14. sayfada, bir yatak ilanının altında.', 'The paper printed a tiny correction on page 14, under a mattress ad.'), press(-2), stress(1), follow(chain('rumour.romance_photo', 2))),
      },
    ],
  },
  {
    id: 'rumour.romance_photo',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Bulanık Fotoğraf', 'The Blurry Photo'),
    text: t(
      'Paparazzi yeni bir kare yayımladı: sen ve {celeb}, bir otoparkta, bulanık. Aslında ikiniz de aynı anda arabanızı arıyordunuz.',
      'The paparazzi published a new shot: you and {celeb} in a car park, blurry. You were both just looking for your cars at the same time.',
    ),
    icon: '📷',
    choices: [
      {
        label: t('{celeb} ile ortak esprili paylaşım yap', 'Post a joint joke with {celeb}'),
        effects: (ctx) => fx(t('"Biz sadece otopark arkadaşıyız 🚗." İnternet bayıldı, dedikodu bitti.', '"We\'re just car-park friends 🚗." The internet loved it, gossip over.'), folPct(ctx, 6), press(3), rep(1), happy(3)),
      },
      {
        label: t('Sevdiklerine her şeyi anlat', 'Sit down with your loved ones and explain'),
        effects: (ctx) =>
          hasRel(ctx.state, 'partner')
            ? fx(t('Uzun bir akşam. Sonunda {partnerName} güldü: "Otopark mı? Cidden mi?"', 'A long evening. In the end {partnerName} laughed: "A car park? Really?"'), rel('partner', 8), stress(-3))
            : fx(t('Annene anlattın. "Evlen artık" dedi. Konu kapandı.', 'You told your mum instead. "Just get married already," she said. Case closed.'), rel('mother', 2), stress(-2)),
      },
      {
        label: t('Fotoğrafçıyla tartış', 'Confront the photographer'),
        risk: 'high',
        effects: () =>
          fx(
            t('Bağırdın, o çekmeye devam etti. Yeni manşet: "{heroName} çılgına döndü!"', 'You shouted; they kept shooting. New headline: "{heroName} loses it!"'),
            press(-8), disc(-3), stress(6),
            news(t('{heroName} paparazziyle tartıştı', '{heroName} clashes with photographer'), -1),
          ),
      },
    ],
  },
  {
    id: 'rumour.feud_gossip',
    category: 'rumour',
    weight: 1,
    cooldownWeeks: 24,
    maxPerCareer: 10, // playtest Tur 4: ×15–17 in one 12–16 season career
    triggers: ['weekly', 'post_match'],
    conditions: ({ state }) => hasClub(state),
    title: t('"Soyunma Odasında Buz Gibi Hava"', '"Ice-Cold Dressing Room"'),
    text: t(
      'Bir spor programı, sen ve {mate} arasında "ciddi bir küslük" olduğunu iddia ediyor. Kanıt: maç sonu birbirinize sarılmamışsınız. Aslında ikiniz de çok terliydiniz.',
      'A sports show claims there\'s "a serious feud" between you and {mate}. Evidence: you didn\'t hug after the game. In fact you were both just very sweaty.',
    ),
    icon: '🥶',
    choices: [
      {
        label: t('{mate} ile ortak antrenman videosu çek', 'Film a joint training video with {mate}'),
        effects: (ctx) => fx(t('Rondoda birbirinize bacak arası attınız. Video "küslük bu mu?" başlığıyla yayıldı.', 'You nutmegged each other in a rondo. The video spread as "is THIS the feud?"'), relNpc(ctx.vars.mateId, ctx.vars.mate, 8), folPct(ctx, 2), press(2), fatigue(3)),
      },
      {
        label: t('Programı arayıp canlı yayına bağlan', 'Phone in to the show live'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('"Biz terliydik sadece." Sunucu güldü, reytingler uçtu.', '"We were just sweaty." The host laughed; ratings soared.'), press(5), fans(2))
            : fx(t('Sunucu soruyu çarpıttı, sen sinirlendin. Şimdi gerçekten bir dedikodu var.', 'The host twisted your words, you got angry. Now there really is a story.'), press(-4), stress(4)),
      },
      {
        label: t('{mate}\'ye "gerçekten küs müyüz?" diye sor', 'Ask {mate}: "are we actually feuding?"'),
        effects: (ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('"Ne küslüğü {g:abi|abla}, dün beraber döner yedik." Haklı.', '"What feud? We had kebabs together yesterday." Fair.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 4))
            : fx(t('Uzun bir sessizlik. "Aslında... şu pas meselesi var." Demek ki vardı.', 'Long silence. "Well... there is that passing thing." So there was something.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 2), stress(2), boss(1)),
      },
    ],
  },
  {
    id: 'rumour.fake_quote',
    category: 'rumour',
    weight: 0.9,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 10,
    title: t('Söylemediğin Söz', 'Words You Never Said'),
    text: t(
      'Sosyal medyada bir alıntı dolaşıyor: "{managerName}\'ın taktiği 1990\'larda kaldı. — {heroName}". Bunu hiç söylemedin. Ama tarzına benzemiyor değil.',
      'A quote is doing the rounds: "{managerName}\'s tactics are stuck in the 1990s. — {heroName}". You never said it. Though it does sound a bit like you.',
    ),
    icon: '🗯️',
    choices: [
      {
        label: t('Hocayı hemen ara', 'Call the manager straight away'),
        effects: () => fx(t('"Biliyorum evlat, ben de 1990\'ları severim zaten." Hoca espri yaptı; buz eridi.', '"I know, kid. I love the 1990s anyway." The gaffer cracked a joke; ice melted.'), boss(4), trust(2)),
      },
      {
        label: t('Kulüp aracılığıyla resmi yalanlama', 'Official denial through the club'),
        effects: () => fx(t('Kulüp açıklaması on dakikada yayımlandı. Sahte hesap da kapandı.', 'The club statement went out in ten minutes. The fake account went down too.'), press(2), boss(1), stress(1)),
      },
      {
        label: t('"Aslında... biraz haklı" diye espri yap', 'Joke: "well... it\'s not entirely wrong"'),
        risk: 'high',
        effects: (ctx) => fx(t('İnternet güldü. {managerName} gülmedi.', 'The internet laughed. {managerName} didn\'t.'), folPct(ctx, 3), boss(-4), trust(-6), press(3)),
      },
    ],
  },
  // ───────────── Close-friend insider tip (2.4#37) ─────────────
  {
    id: 'rumour.insider_tip',
    category: 'rumour',
    weight: (ctx) => 0.6 + flagNum(ctx.state, 'transfer_buzz') * 0.1,
    cooldownWeeks: 26,
    maxPerCareer: 4,
    triggers: ['weekly', 'transfer_window'],
    conditions: ({ state }) =>
      hasClub(state) && state.hero.reputation >= 15 &&
      Object.values(state.life.relationships).some((r) => r.closeFriend && r.value >= 25),
    vars: ({ state }) => {
      const f = Object.values(state.life.relationships).filter((r) => r.closeFriend && r.value >= 25).sort((a, b) => b.value - a.value)[0]
      return { friend: f ? f.name : '?' }
    },
    title: t('Yakın Arkadaştan İçeriden Bilgi', 'Inside Word From a Close Friend'),
    text: t(
      '{friend} seni kenara çekti: "Kulis konuşuyor, yönetim bu yaz senin hakkında konuşuyor. Dikkatli ol, ama hazırlıklı da ol."',
      '{friend} pulled you aside: "Word in the corridors is the board is talking about you this summer. Be careful, but be ready."',
    ),
    icon: '🤫',
    choices: [
      {
        label: t('Menajerini haberdar et', 'Tip off your agent'),
        hint: t('Ajan masaya hazırlıklı oturur.', 'Your agent goes into talks prepared.'),
        effects: () => fx(t('Menajerin notları aldı ve telefon trafiğini başlattı.', 'Your agent took notes and started working the phones.'), rel('agent', 3), { addFlags: { transfer_buzz: 2 } }),
      },
      {
        label: t('Teşekkür et, kimseye söyleme', 'Thank them and tell no one'),
        effects: () => fx(t('Sırrı sakladın. Dostluk bir kat daha sağlamlaştı.', 'You kept the secret. The friendship got a little stronger.'), happy(2), stress(-1)),
      },
      {
        label: t('Teknik direktörle açık konuş', 'Speak openly to the manager'),
        risk: 'medium',
        effects: () => fx(t('Hoca dürüstlüğünü takdir etti ama kulis biraz gerildi.', 'The gaffer valued the honesty, though the corridors got tense.'), boss(3), chairman(-2), trust(2)),
      },
    ],
  },
]

/** Number from a template var (vars are string | number). */
function num0(v: string | number | undefined): number {
  return typeof v === 'number' ? v : Number(v) || 0
}
