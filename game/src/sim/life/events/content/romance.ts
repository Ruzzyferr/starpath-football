/**
 * Romance: one long arc plus side branches.
 *
 * Main arc (flag `romance_stage`):
 *   meet_someone ('crush') → first_date ('dating') → getting_serious ('serious')
 *   → move_in ('living') → proposal ('engaged') → wedding ('married') → baby_news (`has_kids`).
 * Every step after the first is a follow-up carrying `{crush}`; steps only fire
 * while a partner relationship exists, so a break-up quietly ends the arc.
 * Side branches: fame_jealousy → jealousy_ultimatum (→ ex_resurfaces),
 * career_conflict → long_distance, paparazzi_partner, ex_resurfaces.
 */
import {
  boss, canAfford, endRel, energy, fans, fatigue, flags, folPct, follow, form, fx, getFlag, happy, hasFlag, hasRel, money, morale,
  news, num, press, rel, relVal, rep, sharp, stress, t, chain, trust, wageX, age,
} from '../dsl'
import type { EventDef } from '../types'
import { partnerNamePool } from '../../../game/partnerPref'

/** Reputation from which strangers know the hero (the "nobody knows me" meeting stops). */
const FAMOUS_REP = 60
/** Most a date dinner costs. */
const DINNER_MAX = 12_000

/** Flags to clear when a relationship ends. */
const SINGLE = { romance_stage: null, long_distance: null }

export const romanceEvents: EventDef[] = [
  // ───────── Main arc ─────────
  {
    id: 'romance.meet_someone',
    category: 'romance',
    weight: 1.2,
    cooldownWeeks: 12,
    // "For once nobody knows who you are" only works before fame (playtest Tur 4: a reputation-100 star heard
    // "you kick a ball, as a hobby?" ten times in one career). Famous heroes get romance.meet_someone_famous.
    maxPerCareer: 4,
    conditions: ({ state }) => !hasRel(state, 'partner') && getFlag(state, 'romance_stage') !== 'crush' && age(state) >= 18 && state.hero.reputation < FAMOUS_REP,
    vars: (ctx, rng) => ({ crush: rng.pick(partnerNamePool(ctx.state)) }),
    title: t('Kafede Biri', 'Someone at the Café'),
    text: t(
      '{friendName}\'ın doğum günü kutlamasında {crush} ile aynı masaya düştün. Futbolla hiç ilgisi yok; ne iş yaptığını sorunca "Top mu oynuyorsun? Hobi olarak mı?" dedi. İlk kez kimse seni tanımıyor ve bu… hoş.',
      'At {friendName}\'s birthday drinks you end up next to {crush}, who knows nothing about football. On hearing your job: "You kick a ball? Like, as a hobby?" For once nobody knows who you are, and it\'s… nice.',
    ),
    icon: '☕',
    choices: [
      {
        label: t('Numarasını iste', 'Ask for their number'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('Peçeteye yazılmış bir numara. Bütün gece cebinde taşıdın.', 'A number on a napkin. You kept it in your pocket all night.'), happy(6), flags({ romance_stage: 'crush' }), follow(chain('romance.first_date', 1)))
            : fx(t('"Ben pek tanımadığım insanlara numara vermem." Adil.', '"I don\'t really give my number to strangers." Fair.'), happy(-3), morale(-2)),
      },
      {
        label: t('Kim olduğunu çaktırmadan anlat', 'Casually mention who you are'),
        hint: t('Ünün işe yarar mı, yoksa itici mi?', 'Will fame charm or repel?'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.25 + ctx.state.hero.reputation / 200)
            ? fx(t('Telefonundan seni aradı, gözleri büyüdü, güldü: "Peki, {g:ünlü bey|ünlü hanım}, kahve borcun var."', 'They googled you, eyes widened, laughed: "Alright, famous one, you owe me a coffee."'), happy(5), flags({ romance_stage: 'crush' }), follow(chain('romance.first_date', 1)))
            : fx(t('"Ah. Sen şu reklamdaki {g:adamsın|kızsın}." Konu kapandı.', '"Oh. You\'re the {g:guy|girl} from that advert." Conversation over.'), happy(-4), morale(-3)),
      },
      {
        label: t('Gizemli kal, erken çık', 'Stay mysterious, leave early'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.35)
            ? fx(t('Ertesi gün bir mesaj: "{friendName} numaranı verdi. Hobi futbolu nasıl gidiyor?"', 'Next day, a message: "{friendName} gave me your number. How\'s the hobby football?"'), happy(8), flags({ romance_stage: 'crush' }), follow(chain('romance.first_date', 2)))
            : fx(t('Gizem o kadar iyi işledi ki bir daha hiç görüşmediniz.', 'The mystery worked so well you never saw each other again.'), happy(-2)),
      },
      {
        label: t('Şu an tek aşkın futbol', 'Football is your only love right now'),
        effects: () => fx(t('Erken yattın. Ertesi sabah antrenmanda uçtun.', 'Early night. Flew in training the next morning.'), form(3), sharp(3), happy(-2)),
      },
    ],
  },
  {
    id: 'romance.meet_someone_famous',
    category: 'romance',
    weight: 1.1,
    cooldownWeeks: 16,
    maxPerCareer: 4,
    conditions: ({ state }) => !hasRel(state, 'partner') && getFlag(state, 'romance_stage') !== 'crush' && age(state) >= 18 && state.hero.reputation >= FAMOUS_REP,
    vars: (ctx, rng) => ({ crush: rng.pick(partnerNamePool(ctx.state)) }),
    title: t('Kameraların Olmadığı Bir Akşam', 'An Evening Without Cameras'),
    text: t(
      '{friendName} evinde küçük bir yemek verdi, telefonlar kapıda bir sepete. Yanına {crush} oturdu. Seni tanıdığı belliydi ama bir kez bile maçtan söz etmedi; en son ne zaman tatile çıktığını sordu. Cevabı bulamadın.',
      '{friendName} hosted a small dinner, phones left in a basket at the door. {crush} sat next to you. They clearly knew who you were but never mentioned football once; they asked when you last had a holiday. You could not remember.',
    ),
    icon: '☕',
    choices: [
      {
        label: t('Numarasını iste', 'Ask for their number'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('Numarayı verdi, bir şartla: "Fotoğraf yok, paylaşım yok."', 'They gave it, on one condition: "No photos, no posts."'), happy(6), flags({ romance_stage: 'crush' }), follow(chain('romance.first_date', 1)))
            : fx(t('"Senin hayatın biraz kalabalık bana," dedi gülümseyerek. Haklıydı.', '"Your life is a bit crowded for me," they said with a smile. Fair.'), happy(-3), morale(-2)),
      },
      {
        label: t('Kameralardan uzak bir yere davet et', 'Invite them somewhere away from the cameras'),
        hint: t('Ün burada işe yaramaz; samimiyet yarar.', 'Fame does not help here; sincerity does.'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Bir balıkçı kahvesinde iki çay. Kimse dönüp bakmadı, ikiniz de bunu sevdiniz.', 'Two teas at a little harbour café. Nobody looked twice, and you both loved that.'), happy(8), flags({ romance_stage: 'crush' }), follow(chain('romance.first_date', 2)))
            : fx(t('Ertesi gün bir köşe yazısı: "{heroName} gece yarısı gizemli biriyle." Bir daha aramadı.', 'Next day a gossip column: "{heroName} out at midnight with a mystery date." They never called again.'), happy(-4), press(-1)),
      },
      {
        label: t('Şu an tek aşkın futbol', 'Football is your only love right now'),
        effects: () => fx(t('Erken kalktın, sofradan da erken. Sabah antrenmanda ilk sendin.', 'You left the table early. First in at training the next morning.'), form(3), sharp(3), happy(-2)),
      },
    ],
  },
  {
    id: 'romance.first_date',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => !hasRel(state, 'partner'),
    // Half a week's wage, but a dinner is still a dinner (a 414K-a-week star paid 207K for one: playtest Tur 4).
    vars: ({ state }) => ({ dinner: Math.min(wageX(state, 0.5, 300), DINNER_MAX) }),
    title: t('İlk Buluşma', 'First Date'),
    text: t(
      '{crush} ile ilk buluşma. Nereye götüreceğine karar vermen lazım ve {friendName} grup sohbetinde yirmi farklı öneri attı, hepsi berbat.',
      'First date with {crush}. You need a plan, and {friendName} has sent twenty suggestions to the group chat, all terrible.',
    ),
    icon: '🌹',
    choices: [
      {
        label: t('Çatı katında şık restoran', 'A swanky rooftop restaurant'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'dinner')),
        lockedHint: t('Hesap kabarık olur.', 'The bill would sting.'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(
                t('Manzara, mum ışığı, tatlıyı paylaştınız. Ayrılırken "Bir daha?" dedi.', 'The view, candles, a shared dessert. Parting words: "Again?"'),
                money(-num(ctx, 'dinner')),
                rel('partner', 22, String(ctx.vars.crush)),
                happy(10),
                flags({ romance_stage: 'dating' }),
                follow(chain('romance.getting_serious', 8)),
              )
            : fx(
                t('Garson seni tanıdı, imza istedi, sonra bir masa daha istedi. {crush} gece boyunca bir taraftar ordusuyla yemek yedi.', 'The waiter recognised you, then the next table did. {crush} spent the evening dining with a fan club.'),
                money(-num(ctx, 'dinner')),
                happy(-4),
                flags(SINGLE),
              ),
      },
      {
        label: t('Sahilde dürüm ve uzun yürüyüş', 'Street wraps and a long seaside walk'),
        effects: (ctx, rng) =>
          rng.chance(0.75)
            ? fx(
                t('Üç saat yürüdünüz, dürümler soğudu, kimse umursamadı.', 'Three hours of walking, cold wraps, nobody cared.'),
                rel('partner', 18, String(ctx.vars.crush)),
                happy(9),
                flags({ romance_stage: 'dating' }),
                follow(chain('romance.getting_serious', 8)),
              )
            : fx(t('Yağmur bastırdı. {crush} "Belki başka zaman" dedi; o zaman gelmedi.', 'Downpour. {crush} said "another time"; another time never came.'), happy(-4), flags(SINGLE)),
      },
      {
        label: t('Evde yemek yap', 'Cook at your place'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(
                t('Makarna biraz yandı ama birlikte güldünüz. Bazen yanık makarna en iyi başlangıçtır.', 'The pasta caught a bit, you both laughed. Sometimes burnt pasta is the best start.'),
                rel('partner', 20, String(ctx.vars.crush)),
                happy(10),
                flags({ romance_stage: 'dating' }),
                follow(chain('romance.getting_serious', 8)),
              )
            : fx(t('Duman alarmı çaldı, itfaiye geldi, itfaiyeci imza istedi. {crush} taksiye bindi.', 'Smoke alarm, fire brigade, a firefighter asking for an autograph. {crush} took a taxi home.'), happy(-6), stress(4), flags(SINGLE)),
      },
      {
        label: t('İptal et, yarın erken antrenman var', 'Cancel — early training tomorrow'),
        effects: () => fx(t('Profesyonelce. Biraz da yalnız.', 'Professional. A bit lonely.'), sharp(3), trust(1), happy(-5), flags(SINGLE)),
      },
    ],
  },
  {
    id: 'romance.getting_serious',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    title: t('Ailemle Tanışır mısın?', 'Meet the Family?'),
    text: t(
      '{crush} pazar kahvaltısına davet etti: "Annemler seni merak ediyor. Babam da… şey, rakip takımı tutuyor."',
      '{crush} invites you to Sunday breakfast: "My parents are curious about you. And Dad, well… supports the other lot."',
    ),
    icon: '🍳',
    choices: [
      {
        label: t('Git, en iyi gömleğini giy', 'Go, wear your best shirt'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.7)
            ? fx(
                t('Kahvaltı dört saat sürdü. Baba futbolu tartışmak için seni tekrar çağırdı. Bu iyiye işaret.', 'Breakfast ran four hours. The dad invited you back to argue about football. A great sign.'),
                rel('partner', 15),
                happy(6),
                flags({ romance_stage: 'serious' }),
                follow(chain('romance.move_in', 10)),
              )
            : fx(
                t('Baba geçen sezonki penaltı kaçırmanı ezbere anlattı. Gergin ama atlatıldı.', "The dad recounted your missed penalty from last season in detail. Tense, but survived."),
                rel('partner', 8),
                stress(5),
                flags({ romance_stage: 'serious' }),
                follow(chain('romance.move_in', 12)),
              ),
      },
      {
        label: t('Onları maça davet et, VIP locaya', 'Invite them to a match, VIP box'),
        effects: () =>
          fx(
            t('Baba atkısını çıkarmadı ama golünde gizlice alkışladı. {crush} gördü.', "The dad kept his rival scarf on but clapped your goal on the sly. {crush} noticed."),
            rel('partner', 10),
            fans(1),
            flags({ romance_stage: 'serious' }),
            follow(chain('romance.move_in', 12)),
          ),
      },
      {
        label: t('"Biraz erken değil mi?"', '"Isn\'t it a bit soon?"'),
        // Postponing twice is an answer too: the question stops coming back (no endless loop).
        effects: (ctx) =>
          (typeof ctx.state.life.flags.romance_postpone === 'number' ? ctx.state.life.flags.romance_postpone : 0) < 1
            ? fx(t('{crush} "Tabii, acele yok" dedi. Gülümsemesi biraz eksikti.', '{crush} said "Sure, no rush." The smile was a little short.'), rel('partner', -10), stress(3), { addFlags: { romance_postpone: 1 } }, follow(chain('romance.getting_serious', 8)))
            : fx(t('{crush} bir şey demedi. Bu konuyu bir daha açmayacağı belliydi.', '{crush} said nothing. Clearly the subject won’t come up again.'), rel('partner', -12), stress(2), { setFlags: { romance_postpone: null } }),
      },
    ],
  },
  {
    id: 'romance.move_in',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    vars: ({ state }) => ({ flat: wageX(state, 12, 15000) }),
    title: t('Diş Fırçası Meselesi', 'The Toothbrush Situation'),
    text: t(
      '{crush}\'ın diş fırçası, şarj aleti, üç kazağı ve bir saksı bitkisi zaten sende. "Kira ödemeyi bıraksam mı artık?" diye sordu, yarı şaka.',
      '{crush} already keeps a toothbrush, charger, three jumpers and a pot plant at yours. "Should I just stop paying my own rent?" Half a joke.',
    ),
    icon: '📦',
    choices: [
      {
        label: t('Evet, gel bizim eve', 'Yes — move in'),
        effects: () =>
          fx(
            t('Kutular taşındı. Dolapta artık sana ait tek raf var. Mutlusun.', "Boxes moved. You now own exactly one shelf in your wardrobe. You're happy."),
            rel('partner', 15),
            happy(8),
            stress(-4),
            flags({ romance_stage: 'living' }),
            follow(chain('romance.proposal', 14)),
          ),
      },
      {
        label: t('Birlikte yeni, büyük bir ev alın', 'Buy a bigger place together'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'flat')),
        lockedHint: t('Peşinat için birikimin yetmiyor.', "Your savings won't cover a deposit."),
        effects: (ctx) =>
          fx(
            t('Yeni ev, yeni başlangıç. {crush} salonun duvar rengini seçti, sen itiraz etmedin. Akıllıca.', 'New home, fresh start. {crush} picked the living room colour; you wisely did not object.'),
            money(-num(ctx, 'flat')),
            rel('partner', 22),
            happy(10),
            flags({ romance_stage: 'living' }),
            follow(chain('romance.proposal', 12)),
          ),
      },
      {
        label: t('Şimdilik ayrı evler, kendi alanın önemli', 'Separate places for now'),
        risk: 'medium',
        // Like getting_serious: one postponement re-asks later, the second one ends the topic.
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? (typeof ctx.state.life.flags.movein_postpone === 'number' ? ctx.state.life.flags.movein_postpone : 0) < 1
              ? fx(t('{crush} anlayışla karşıladı ama bitki geri gitti.', '{crush} took it well. The pot plant went home, though.'), rel('partner', -8), { addFlags: { movein_postpone: 1 } }, follow(chain('romance.move_in', 10)))
              : fx(t('{crush} bitkiyi bu sefer hiç getirmedi. Konu kapandı; ikiniz de rahatladınız mı, emin değilsin.', '{crush} didn’t even bring the plant this time. Topic closed; you’re not sure who was more relieved.'), rel('partner', -6), { setFlags: { movein_postpone: null } })
            : fx(
                t('"Ben bu ilişkide bir yere gidiyoruz sanıyordum." Kapı kapandı, kazaklar da gitti.', '"I thought we were going somewhere." The door closed. The jumpers went too.'),
                endRel('partner'),
                happy(-12),
                stress(8),
                flags(SINGLE),
              ),
      },
    ],
  },
  {
    id: 'romance.proposal',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    vars: ({ state }) => ({ ring: wageX(state, 6, 3000) }),
    title: t('Çantadaki Kutu', 'The Box in the Kit Bag'),
    text: t(
      'Bir aydır antrenman çantanda küçük kadife bir kutu taşıyorsun. Malzemeci iki kez neredeyse buluyordu. Zamanı geldi mi?',
      "For a month you've carried a small velvet box in your kit bag. The kit man nearly found it twice. Is it time?",
    ),
    icon: '💍',
    choices: [
      {
        label: t('Maç sonu orta sahada diz çök', 'Kneel in the centre circle after a home win'),
        hint: t('Büyük jest. Herkesin önünde.', 'Grand gesture. Very public.'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.78)
            ? fx(
                t('Stat sessizleşti, sonra "EVET" ekranda dev gibi göründü. Kırk bin kişi alkışladı.', 'The stadium hushed — then a giant "YES" on the screen. Forty thousand people applauded.'),
                rel('partner', 20),
                happy(15),
                rep(3),
                fans(6),
                folPct(ctx, 8),
                flags({ romance_stage: 'engaged' }),
                follow(chain('romance.wedding', 10)),
                news(t('{heroName} orta sahada evlenme teklif etti!', '{heroName} pops the question in the centre circle!'), 1),
              )
            : fx(
                t('{crush} kıpkırmızı oldu, "Burada mı?!" dedi ve tünele koştu. Cevap evde geldi: "Sor ama ikimizken."', '{crush} went crimson, "Here?!", and fled down the tunnel. At home: "Ask me. When it\'s just us."'),
                rel('partner', -12),
                stress(10),
                follow(chain('romance.proposal', 6)),
              ),
      },
      {
        label: t('Sessiz bir akşam, gerçek bir yüzük', 'A quiet evening, a proper ring'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'ring')),
        lockedHint: t('Yüzük için birikim lazım.', 'You need savings for a ring.'),
        effects: (ctx, rng) =>
          rng.chance(0.92)
            ? fx(
                t('Balkonda, ikiniz. "Evet" fısıltıyla geldi ve hiçbir tribün sesi o kadar güzel değildi.', 'On the balcony, just you two. The "yes" came as a whisper — louder than any crowd.'),
                money(-num(ctx, 'ring')),
                rel('partner', 22),
                happy(15),
                flags({ romance_stage: 'engaged' }),
                follow(chain('romance.wedding', 10)),
              )
            : fx(t('"Seni seviyorum… ama hazır değilim." Yüzük kutuda kaldı.', '"I love you… but I\'m not ready." The ring went back in its box.'), money(-num(ctx, 'ring')), happy(-8), stress(8), follow(chain('romance.proposal', 12))),
      },
      {
        label: t('Daha bekle', 'Wait a little longer'),
        effects: () => fx(t('Kutu çantada kalmaya devam ediyor. Malzemeci şüpheleniyor.', 'The box stays in the bag. The kit man is getting suspicious.'), rel('partner', -4), follow(chain('romance.proposal', 12))),
      },
    ],
  },
  {
    id: 'romance.wedding',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    vars: ({ state }) => ({ big: wageX(state, 25, 40000), small: wageX(state, 4, 5000) }),
    title: t('Düğün Planı', 'Planning the Wedding'),
    text: t(
      '{crush} ile düğün tarihi belli. Şimdi kavga çıkaracak tek soru kaldı: Nasıl bir düğün? Annen 600 kişilik liste hazırlamış bile.',
      "The date with {crush} is set. Only one fight-starting question left: what kind of wedding? Your mum already has a 600-name guest list.",
    ),
    icon: '💒',
    choices: [
      {
        label: t('Saray gibi, dergi kapaklı düğün', 'Palace-grade, magazine-cover wedding'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'big')),
        lockedHint: t('Bu düğün bütçeni katlar.', 'That wedding costs more than you have.'),
        effects: (ctx) =>
          fx(
            t('Havai fişekler, canlı orkestra, takım arkadaşlarının halay faciası. Herkes yıllarca konuşacak.', 'Fireworks, live orchestra, a team-mate folk-dance disaster. People will talk for years.'),
            money(-num(ctx, 'big')),
            happy(14),
            rel('partner', 12),
            rel('mother', 10),
            rel('teammate', 4),
            rep(4),
            folPct(ctx, 10),
            flags({ romance_stage: 'married' }),
            follow(chain('romance.baby_news', 24)),
            news(t('Yılın düğünü: {heroName} dünyaevine girdi', 'Wedding of the year: {heroName} ties the knot'), 1),
          ),
      },
      {
        label: t('Memleketinde samimi bir tören', 'Intimate ceremony in your hometown'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'small')),
        lockedHint: t('Mütevazı düğüne bile para lazım.', 'Even modest weddings cost something.'),
        effects: (ctx) =>
          fx(
            t('Bahçede, ışıklar altında, yüz kişi. {crush} "Tam istediğim gibi" dedi.', 'In a garden, under string lights, a hundred guests. {crush} said "Exactly what I wanted."'),
            money(-num(ctx, 'small')),
            happy(12),
            rel('partner', 18),
            rel('mother', 4),
            flags({ romance_stage: 'married' }),
            follow(chain('romance.baby_news', 24)),
          ),
      },
      {
        label: t('Nikâh dairesi + kulüp kantininde parti', 'Registry office + party in the club canteen'),
        effects: () =>
          fx(
            t('Malzemeci DJ oldu, aşçı pasta yaptı. Takım bayıldı; annen "Kantinde mi?!" diye hâlâ söyleniyor.', 'The kit man DJed, the canteen chef baked. The squad loved it; Mum is still muttering "The canteen?!"'),
            happy(9),
            rel('partner', 8),
            rel('teammate', 6),
            rel('mother', -8),
            flags({ romance_stage: 'married' }),
            follow(chain('romance.baby_news', 24)),
          ),
      },
      {
        label: t('Kaçıp gizlice evlenin', 'Elope'),
        risk: 'medium',
        effects: () =>
          fx(
            t('Bir adada, iki şahitle. Fotoğraf sızınca basın çıldırdı, annen daha da çok.', 'On an island, two witnesses. When the photo leaked the press went wild — your mum more so.'),
            happy(12),
            rel('partner', 16),
            rel('mother', -15),
            press(5),
            rep(2),
            flags({ romance_stage: 'married' }),
            follow(chain('romance.baby_news', 24)),
          ),
      },
    ],
  },
  {
    id: 'romance.baby_news',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner') && !hasFlag(state, 'has_kids'),
    vars: ({ state }) => ({ car: wageX(state, 8, 8000) }),
    title: t('Minicik Kramponlar', 'Tiny Football Boots'),
    text: t(
      '{crush} elinde küçük bir kutuyla oturmanı istedi. İçinde bebek boyu bir çift krampon var. Beynin üç saniye çalışmadı.',
      '{crush} asks you to sit down and hands you a small box. Inside: a pair of baby-sized football boots. Your brain stopped for three seconds.',
    ),
    icon: '👶',
    choices: [
      {
        label: t('Kulüpten doğum izni sözü al', 'Get the club to promise paternity leave'),
        effects: () =>
          fx(
            t('Hoca kaşlarını çattı: "Fikstürü bilmiyor musun?" Ama {crush} sana hiç bu kadar güvenmemişti.', 'The coach frowned: "Have you seen the fixture list?" But {crush} has never trusted you more.'),
            rel('partner', 18),
            happy(14),
            boss(-4),
            trust(-3),
            flags({ has_kids: true }),
          ),
      },
      {
        label: t('Haberi bir sonraki golünle duyur', 'Announce it with your next goal celebration'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('Topu formanın altına soktun, stat anladı ve patladı. {crush} evde biraz bozuldu: "Önce annemlere söyleyecektik!"', 'Ball up the shirt, stadium got it and erupted. {crush} was miffed: "We were telling my parents first!"'),
            happy(14),
            fans(8),
            rep(2),
            folPct(ctx, 6),
            rel('partner', -4),
            flags({ has_kids: true }),
          ),
      },
      {
        label: t('Panikle gidip aile arabası al', 'Panic-buy a family car'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'car')),
        lockedHint: t('Araba bütçesi yok.', 'No budget for a car.'),
        effects: (ctx) =>
          fx(
            t('Spor arabanın yerinde artık yedi kişilik bir minivan var. Takım arkadaşların acımasız.', 'Your sports car has been replaced by a seven-seat people carrier. Your team-mates are merciless.'),
            money(-num(ctx, 'car')),
            happy(12),
            rel('partner', 10),
            rel('teammate', -2),
            stress(-3),
            flags({ has_kids: true }),
          ),
      },
    ],
  },

  // ───────── Side branch: fame jealousy ─────────
  {
    id: 'romance.fame_jealousy',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 26,
    conditions: ({ state }) => hasRel(state, 'partner') && state.hero.reputation >= 20,
    title: t('Yorumlar Kısmı', 'The Comments Section'),
    text: t(
      '{partnerName} son paylaşımının altındaki yorumları okuyor. Binlerce kalp, bir sürü "evlen benimle" ve her fotoğrafına ilk yorumu yapan bir hayran. "Bu kim?" diye soruyor, sesi sakin. Fazla sakin.',
      '{partnerName} is reading the comments on your latest post. Thousands of hearts, plenty of "marry me", and one fan who is always first. "Who\'s this?" Calm voice. Too calm.',
    ),
    icon: '📱',
    choices: [
      {
        label: t('Birlikte bir fotoğraf paylaş', 'Post a couple photo'),
        effects: (ctx) =>
          fx(t('Fotoğraf rekor beğeni aldı. {partnerName} yorumları okurken bu kez gülümsedi.', 'The photo broke your like record. {partnerName} read the comments smiling this time.'), rel('partner', 12), folPct(ctx, 3), happy(3)),
      },
      {
        label: t('"Bu işin parçası, takma kafana"', '"It\'s part of the job, don\'t worry about it"'),
        risk: 'high',
        effects: () =>
          fx(t('"Takmayayım mı?" Konuşma burada bitti. Ya da bitmedi.', '"Don\'t worry about it?" The conversation ended there. Or did it.'), rel('partner', -10), stress(5), follow(chain('romance.jealousy_ultimatum', 3))),
      },
      {
        label: t('Bir ay sosyal medyayı bırak', 'Go dark on social for a month'),
        effects: (ctx) =>
          fx(
            t('Bildirimler kapandı. İlişkin iyileşti, ama sponsor menajeri iki kez aradı.', 'Notifications off. The relationship improved; your sponsor manager called twice.'),
            rel('partner', 12),
            folPct(ctx, -4),
            stress(-5),
          ),
      },
      {
        label: t('Hayranı engelle, birlikte gülün', 'Block the superfan and laugh about it'),
        effects: () => fx(t('"Engelle" butonuna törenle bastınız. Küçük ama tatlı bir zafer.', 'You pressed "block" together, ceremonially. Small but sweet.'), rel('partner', 6), happy(2)),
      },
    ],
  },
  {
    id: 'romance.jealousy_ultimatum',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    vars: ({ state }) => ({ therapy: wageX(state, 1, 600) }),
    title: t('Ben mi, Spot Işıkları mı?', 'Me or the Spotlight?'),
    text: t(
      '{partnerName} hafta sonu çantası hazırlamış. "Annemlere gidiyorum. Döndüğümde konuşalım: hayatında ben mi varım, yoksa ekranın mı?"',
      '{partnerName} has packed a weekend bag. "I\'m going to my parents\'. When I\'m back, we talk: is there room for me, or just your screen?"',
    ),
    icon: '💔',
    choices: [
      {
        label: t('Hafta sonu yardım gecesini iptal et, git yanına', "Skip the weekend gala, go after them"),
        effects: () => fx(t('Gala sensiz yapıldı, kimse ölmedi. {partnerName} kapıyı açınca ağladı.', 'The gala went ahead without you; nobody died. {partnerName} cried at the door.'), rel('partner', 15), rep(-2), happy(4)),
      },
      {
        label: t('Çift terapisi öner', 'Suggest couples therapy'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'therapy')),
        lockedHint: t('Seans ücretini karşılayamıyorsun.', "You can't cover the sessions."),
        effects: (ctx) =>
          fx(t('Terapist ikinize de ödev verdi. Telefon ödevi: akşam yemeğinde yasak.', 'The therapist set you both homework. Phones banned at dinner.'), money(-num(ctx, 'therapy')), rel('partner', 18), stress(-5)),
      },
      {
        label: t('Açık açık konuş', 'Talk it out, honestly'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.4 + relVal(ctx.state, 'partner') / 250)
            ? fx(t('Gece yarısına kadar konuştunuz. Yanlış anlaşılmalar ortadan kalktı.', 'You talked past midnight. Misunderstandings dissolved.'), rel('partner', 10), stress(-4))
            : fx(
                t('Konuştukça açıldı yaralar. {partnerName} çantayı bu sefer gerçekten aldı.', 'The more you talked, the more it hurt. This time the bag left for good.'),
                endRel('partner'),
                happy(-14),
                stress(10),
                flags(SINGLE),
                follow(chain('romance.ex_resurfaces', 20)),
              ),
      },
      {
        label: t('"Belki bir ara vermeliyiz"', '"Maybe we need a break"'),
        effects: () =>
          fx(
            t('Sessizce ayrıldınız. Ev çok büyük ve çok sessiz geliyor artık.', 'You split quietly. The flat feels too big and too quiet.'),
            endRel('partner'),
            happy(-10),
            stress(6),
            form(2),
            flags(SINGLE),
            follow(chain('romance.ex_resurfaces', 20)),
          ),
      },
    ],
  },

  // ───────── Side branch: careers collide ─────────
  {
    id: 'romance.career_conflict',
    category: 'romance',
    weight: 0.9,
    cooldownWeeks: 52,
    conditions: ({ state }) => hasRel(state, 'partner') && !hasFlag(state, 'long_distance'),
    title: t('Hayalindeki İş', 'The Dream Job'),
    text: t(
      '{partnerName} yıllardır beklediği teklifi aldı: başka bir ülkede, iki yıllık bir proje. "Senin kariyerin hep öncelikliydi. Bu sefer benim sıram mı?"',
      '{partnerName} finally got the offer: a two-year project in another country. "Your career has always come first. Is it my turn?"',
    ),
    icon: '✈️',
    choices: [
      {
        label: t('Destekle, uzak mesafe ilişkisi', 'Back them — go long-distance'),
        effects: () =>
          fx(
            t('Havaalanında uzun bir sarılma. Takvime şimdiden saat dilimi ekledin.', 'A long hug at departures. You\'ve already added a second time zone to your phone.'),
            rel('partner', 15),
            happy(-5),
            flags({ long_distance: true }),
            follow(chain('romance.long_distance', 6)),
          ),
      },
      {
        label: t('Menajerine o şehirdeki kulüpleri sor', 'Ask your agent about clubs in that city'),
        hint: t('Kariyerini aşk için mi yönlendireceksin?', 'Steering your career for love?'),
        effects: () =>
          fx(
            t('{agentName} kaşını kaldırdı ama araştıracak. {partnerName} bu jesti asla unutmayacak.', '{agentName} raised an eyebrow but will look into it. {partnerName} will never forget the gesture.'),
            rel('partner', 18),
            rel('agent', 3),
            boss(-3),
            flags({ wants_transfer_for_partner: true, long_distance: true }),
            follow(chain('romance.long_distance', 6)),
          ),
      },
      {
        label: t('Kalmasını iste', 'Ask them to stay'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Kaldı. Ama bazı akşamlar pencereden uzaklara bakıyor.', 'They stayed. Some evenings, though, they stare out of the window.'), rel('partner', -8), stress(4), flags({ partner_sacrificed: true }))
            : fx(t('"Sen olsan kalır mıydın?" Cevap veremedin. Gitti, ilişki de.', '"Would you have stayed?" You had no answer. They left, and so did the relationship.'), endRel('partner'), happy(-14), stress(8), flags(SINGLE)),
      },
    ],
  },
  {
    id: 'romance.long_distance',
    category: 'romance',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'partner'),
    vars: ({ state }) => ({ flights: wageX(state, 1, 800) }),
    title: t('Saat Dilimleri', 'Time Zones'),
    text: t(
      'Altı haftadır görüntülü konuşmalar. {partnerName} golünü kaçırdı, sen de onun önemli sunumunu. Ekrandaki donmuş yüz bile özlenir hale geldi.',
      'Six weeks of video calls. {partnerName} missed your goal; you missed their big presentation. Even the frozen face on a bad connection is missed now.',
    ),
    icon: '🌍',
    choices: [
      {
        label: t('İzin gününde uçağa atla', 'Fly out on your day off'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'flights')),
        lockedHint: t('Biletler pahalı.', 'Flights are pricey.'),
        effects: (ctx) =>
          fx(
            t('Otuz altı saat, iki uçuş, bir sarılma. Değdi. Bacakların öyle düşünmüyor.', 'Thirty-six hours, two flights, one hug. Worth it. Your legs disagree.'),
            money(-num(ctx, 'flights')),
            rel('partner', 15),
            fatigue(12),
            sharp(-5),
            happy(6),
          ),
      },
      {
        label: t('"Bu böyle yürüyor mu?" diye sor', 'Ask: "Is this working?"'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Yeni kural: her pazar iki saat, telefonlar sessizde. Yürüyor.', 'New rule: two hours every Sunday, nothing else on. It works.'), rel('partner', 10), stress(-3), flags({ long_distance: null }))
            : fx(t('Cevap uzun bir sessizlikti. Ertesi hafta bitti.', 'The answer was a long silence. It ended the next week.'), endRel('partner'), happy(-12), stress(6), flags(SINGLE)),
      },
      {
        label: t('Kafayı antrenmana göm', 'Bury yourself in training'),
        effects: () => fx(t('Fazladan saatler, fazladan sprintler. Telefon ise sessiz.', 'Extra hours, extra sprints. The phone stays quiet.'), form(4), sharp(4), rel('partner', -10), happy(-3)),
      },
    ],
  },

  // ───────── Standalone ─────────
  {
    id: 'romance.paparazzi_partner',
    category: 'romance',
    weight: 0.9,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasRel(state, 'partner') && state.hero.reputation >= 35,
    vars: ({ state }) => ({ amount: wageX(state, 2, 2000) }),
    title: t('"Özel" Röportaj', 'The "Exclusive"'),
    text: t(
      'Bir magazin sitesi {partnerName}\'a "evinizden samimi kareler" röportajı için {amount:money} teklif etti. {partnerName} oldukça hevesli görünüyor.',
      'A gossip site offers {partnerName} {amount:money} for an "intimate at-home" feature. {partnerName} seems rather keen.',
    ),
    icon: '📸',
    choices: [
      {
        label: t('Kabul etsin, onun kararı', "Let them — their call"),
        effects: (ctx) =>
          fx(
            t('Salonun on altı açıdan fotoğrafı internette. {partnerName} mutlu; sen dolabının fotoğrafının neden gerekli olduğunu sorguluyorsun.', 'Your living room, from sixteen angles, online. {partnerName} is thrilled; you question why your wardrobe needed a photo.'),
            rel('partner', 10),
            folPct(ctx, 5),
            rep(1),
            stress(5),
          ),
      },
      {
        label: t('Kesinlikle hayır', 'Absolutely not'),
        effects: () => fx(t('"Sen hep böylesin." {partnerName} bütün akşam telefonla oynadı.', '"You\'re always like this." {partnerName} scrolled in silence all evening.'), rel('partner', -10), stress(-2)),
      },
      {
        label: t('Birlikte yapın ama kurallar sizin', 'Do it together, on your terms'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Zevkli, sıcak bir röportaj çıktı. Okuyucular sizi sevdi.', 'A warm, tasteful piece. Readers loved you both.'), rel('partner', 8), rep(3), folPct(ctx, 4))
            : fx(
                t('Başlık: "Yıldızın evinde soğuk rüzgârlar mı?" Tek bir fotoğraftaki asık yüzün yüzünden.', 'Headline: "Trouble in paradise?" — all from one photo where you blinked grumpily.'),
                press(-5),
                stress(8),
                rel('partner', -3),
                news(t('{heroName}\'ın evinde soğuk rüzgârlar mı?', 'Trouble at home for {heroName}?'), -1),
              ),
      },
    ],
  },
  {
    id: 'romance.ex_resurfaces',
    category: 'romance',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => !hasRel(state, 'partner') && hasFlag(state, 'ex_partner'),
    vars: ({ state }) => ({ exName: String(getFlag(state, 'ex_partner') ?? 'Deniz') }),
    title: t('Gece 1\'de Gelen Mesaj', 'The 1am Message'),
    text: t(
      'Telefon titredi. {exName}: "Golünü izledim. Seninle gurur duydum. Bir kahve?" Ekrana bakıp kaldın.',
      'Your phone buzzes. {exName}: "Saw your goal. Proud of you. Coffee?" You stare at the screen.',
    ),
    icon: '🌙',
    choices: [
      {
        label: t('Kahveye git', 'Go for the coffee'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.4)
            ? fx(
                t('Bir kahve üç saate döndü. Eski kıvılcım hâlâ orada.', 'One coffee became three hours. The old spark is still there.'),
                rel('partner', 25, String(ctx.vars.exName)),
                happy(10),
                flags({ ex_partner: null, romance_stage: 'dating' }),
                follow(chain('romance.getting_serious', 8, { crush: String(ctx.vars.exName) })),
              )
            : fx(t('Güzel bir sohbet, sonra kibar bir veda. Kapanış böyle olur demek.', 'Nice chat, polite goodbye. So this is what closure feels like.'), happy(4), stress(-3), flags({ ex_partner: null })),
      },
      {
        label: t('Okundu\'da bırak', 'Leave it on read'),
        effects: () => fx(t('Gece boyunca telefona dönüp baktın. Sabah da.', 'You checked the phone all night. And in the morning.'), happy(-3), stress(3)),
      },
      {
        label: t('Kibarca cevap ver, kapıyı kapat', 'Reply kindly, close the door'),
        effects: () => fx(t('"Teşekkürler, sana da iyi şanslar." Yük hafifledi.', '"Thanks — good luck to you too." A weight lifts.'), happy(3), stress(-4), morale(2), flags({ ex_partner: null })),
      },
      {
        label: t('Cevap yerine havalı bir fotoğraf paylaş', 'Post a smouldering photo instead'),
        effects: (ctx) =>
          fx(
            t('Yüz bin beğeni. Tek bir görüntülenme önemliydi ve o da geldi. Biraz çocukça, biraz tatmin edici.', 'A hundred thousand likes. Only one view mattered, and it came. Petty, satisfying.'),
            folPct(ctx, 3),
            happy(2),
            energy(-2),
          ),
      },
    ],
  },
]
