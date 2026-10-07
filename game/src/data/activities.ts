/**
 * Daily activity catalogue (GDD 1 & 4). A day has 3 slots (0 morning,
 * 1 afternoon, 2 evening); each activity takes 1–3 consecutive slots and
 * spends (or restores) energy. Effects are applied by sim/life/activities.ts.
 *
 * Tuning frame (daily energy budget = 100):
 *  - A "pro day" is 2 trainings (~40) + a light evening (~10) → ~50 energy,
 *    leaving room for one indulgence. Rest restores 25, sleeping in 35.
 *  - Happiness/stress swings of ±3–10 per activity: the weekly wellbeing
 *    tick pulls ~30% back toward the life-situation target, so a single
 *    activity is felt for about a week.
 *  - Money: costs marked `scale` grow with wealth (see `lifestyleScale` in
 *    activities.ts) so a millionaire's night out costs more than a youth
 *    player's — keeps money meaningful at every career stage.
 */
import type { LText } from '../core/types'
import type { TrainingType } from '../sim/career/training'

export type ActivityCategory =
  | 'rest' | 'training' | 'health' | 'family' | 'social' | 'romance' | 'nightlife' | 'media'
  | 'work' | 'leisure' | 'gambling' | 'travel' | 'shopping' | 'service'

/** Who a relationship effect targets. `family` = mother, father, sibling. */
export type RelationTarget = 'family' | 'partner' | 'bestFriend' | 'teammates' | 'fans' | 'press' | 'manager'

/**
 * Special handlers for activities whose logic goes beyond flat effects.
 *  - train: delegates to career/training.runTraining
 *  - gym / video: XP via progression
 *  - post: delegates to social.makePost
 *  - trainer: hires a personal trainer
 *  - shoot: pays via sponsors.sponsorShootPay
 *  - physio: counts toward the weekly injury tick
 */
export type ActivitySpecial = 'train' | 'gym' | 'video' | 'post' | 'trainer' | 'fireTrainer' | 'shoot' | 'physio' | 'sleepIn' | 'casino'

/** Money formula keys (amount computed at run time). */
export type MoneyFormula = 'shopping' | 'travel' | 'charity' | 'interview' | 'party' | 'date' | 'golf' | 'dinner' | 'physio'

export interface ActivityConditions {
  /** Allowed days 0..6 (0 = Monday); omit = any. */
  days?: readonly number[]
  offSeasonOnly?: boolean
  inSeasonOnly?: boolean
  /** Usable while injured (default: false — injured heroes can only rest/heal/socialise lightly). */
  injuredOk?: boolean
  minReputation?: number
  minMoney?: number
  /** Minimum hero age (gambling and nightclubs: 18). */
  minAge?: number
  /** Not on match day. */
  notMatchDay?: boolean
  /** Not the day before a match. */
  notBeforeMatch?: boolean
  requiresPartner?: boolean
  requiresSponsor?: boolean
  requiresTrainer?: boolean
  /** Days before it can be repeated. */
  cooldownDays?: number
}

export interface ActivityDef {
  id: string
  name: LText
  desc: LText
  icon: string
  category: ActivityCategory
  /** Consecutive slots consumed. */
  slots: 1 | 2 | 3
  /** Slots it may START in. */
  allowedSlots: readonly number[]
  /** Energy spent (negative = restored). */
  energy: number
  /** Flat money change (negative = cost). */
  money?: number
  moneyFormula?: MoneyFormula
  happiness?: number
  stress?: number
  health?: number
  /** Fatigue change (negative = recovery, scaled by recovery perks/facilities). */
  fatigue?: number
  relations?: readonly { target: RelationTarget; delta: number }[]
  reputation?: number
  /** Followers gained as a fraction of current followers. */
  followersPct?: number
  discipline?: number
  /** Discipline change applied only during the season (club cares then). */
  disciplineInSeason?: number
  /** Extra discipline change when the club plays tomorrow. */
  disciplineBeforeMatch?: number
  conditions: ActivityConditions
  /** Tags the event system can use to pick follow-up decision cards. */
  triggerTags: readonly string[]
  /** Hint 0..1 for how likely the event system should fire a card afterwards. */
  eventChance: number
  special?: ActivitySpecial
  trainingType?: TrainingType
  /** Memory line stored on affected close relationships. */
  memory?: LText
  /** Completion text. */
  done: LText
}

const T = (tr: string, en: string): LText => ({ tr, en })
const ALL = [0, 1, 2] as const
const DAY = [0, 1] as const

/** One training activity per TrainingType; energy/fatigue live in TRAINING_TYPES. */
function train(type: TrainingType, icon: string, name: LText, injuredOk = false): ActivityDef {
  return {
    id: `train_${type}`, name, icon, category: 'training', slots: 1, allowedSlots: DAY, energy: 0,
    desc: T('Antrenman mini oyunu: performansın kazanılan XP\'yi belirler.', 'Training mini-game: your performance decides the XP earned.'),
    conditions: { notMatchDay: true, injuredOk }, triggerTags: ['training'], eventChance: 0.05,
    special: 'train', trainingType: type, done: name,
  }
}

/**
 * Extra completion lines (playtest: "Dinlendin, enerjin yerine geldi." was 17 % of
 * every log line). The activity's own `done` text is variant 0; the day picks one.
 */
export const DONE_VARIANTS: Readonly<Record<string, readonly LText[]>> = {
  rest: [
    T('Kanepe, battaniye, bir dizi bölümü. Pil doldu.', 'Sofa, blanket, one episode. Batteries recharged.'),
    T('Telefonu kapattın, iki saat deliksiz uyudun.', 'Phone off, two hours of deep sleep.'),
    T('Evde sessiz bir gün. Vücudun teşekkür etti.', 'A quiet day at home. Your body said thanks.'),
    T('Ayaklar havada, bir kase meyve. Toparlandın.', 'Feet up, a bowl of fruit. You bounced back.'),
  ],
  video: [
    T('Rakibin son üç maçını kare kare izledin.', 'You went through the opponen’ last three games frame by frame.'),
    T('Kendi kaçırdığın pozisyonları tekrar tekrar izledin. Acıttı ama öğretti.', 'You rewatched your own misses. It hurt, but it taught.'),
    T('Analist sana on iki dakikalık bir kurgu hazırlamış. Not defterin doldu.', 'The analyst cut you a twelve-minute reel. Your notebook is full.'),
  ],
  physio: [
    T('Fizyoterapist düğümleri tek tek çözdü.', 'The physio worked the knots out one by one.'),
    T('Buz, masaj, esneme. Bacakların yeniden senin.', 'Ice, massage, stretching. Your legs are yours again.'),
  ],
  family_visit: [
    T('Annen en sevdiğin yemeği yapmış; ikinci tabağı reddedemedin.', 'Mum cooked your favourite; you could’ refuse seconds.'),
    T('Babanla eski maçlarını konuştunuz. Gözleri parlıyordu.', 'You and your dad talked about your old games. His eyes lit up.'),
    T('Kardeşinle bahçede top sektirdiniz, tıpkı eskisi gibi.', 'Keepy-ups in the garden with your sibling, just like old times.'),
  ],
  friend_hangout: [
    T('Kankanla eski mahalleyi turladınız, her köşede bir anı.', 'You toured the old neighbourhood with your best friend; a memory on every corner.'),
    T('Dürümcüde sabaha kadar futbol tartıştınız.', 'You argued about football at the kebab shop until late.'),
    T('Kankan seni konsolda yendi ve bunu kimseye söylemeyeceğine yemin etti. Etmeyecek.', 'Your best friend beat you on the console and swore not to tell anyone. They will.'),
  ],
  team_dinner: [
    T('Masada kaptanın komik hikâyeleri vardı; herkes güldü.', 'The captai’ stories ruled the table; everyone laughed.'),
    T('Hesabı kimin ödeyeceği için kâğıt-makas-taş. Kaybetmedin.', 'Rock-paper-scissors for the bill. You did’ lose.'),
    T('Yeni transferi masaya davet ettiniz, buzlar eridi.', 'You invited the new signing; the ice broke.'),
  ],
  date_night: [
    T('Sahil yürüyüşü, sıcak çikolata ve uzun bir sohbet.', 'A seaside walk, hot chocolate and a long talk.'),
    T('Telefonlar masada ters çevrili. Sadece ikiniz.', 'Phones face down on the table. Just the two of you.'),
  ],
  party: [
    T('Müzik iyiydi, gece uzundu.', 'Good music, long night.'),
    T('VIP bölümünde fotoğraf isteyenler sıraya girdi.', 'People queued for photos in the VIP area.'),
    T('Dans pistinde kimse seni tutamadı.', 'Nobody could stop you on the dance floor.'),
  ],
  shopping: [
    T('Yeni bir ceket, iki tişört ve ihtiyacın olmayan bir şapka.', 'A new jacket, two T-shirts and a hat you do’ need.'),
    T('Mağaza çalışanları seni tanıdı; indirim teklif ettiler.', 'The staff recognised you and offered a discount.'),
  ],
  hobby_gaming: [
    T('Çevrim içi maçta rakibin seni tanıdı ve yine de yendi.', 'An online opponent recognised you and beat you anyway.'),
    T('Üç saatlik turnuva, bir kupa, sıfır pişmanlık.', 'Three-hour tournament, one trophy, zero regrets.'),
  ],
  hobby_music: [
    T('Gitarda yeni bir akor öğrendin.', 'You learned a new chord on the guitar.'),
    T('Bir şarkı yazmaya başladın; ilk dize "Doksanıncı dakika…"', 'You started writing a song; the first line is "Ninetieth minute…"'),
  ],
  gym: [
    T('Bacak günü. Merdivenler artık düşmanın.', 'Leg day. Stairs are now your enemy.'),
    T('Kişisel rekorunu iki kilo geçtin.', 'You beat your personal best by two kilos.'),
  ],
  charity: [
    T('Bir çocuk sana çizdiği resmi verdi. Dolabına astın.', 'A kid gave you a drawing. I’ on your locker now.'),
    T('İmza, fotoğraf, bolca kahkaha. Günün en iyi saatleri.', 'Autographs, photos, plenty of laughs. Best hours of the day.'),
  ],
  interview: [
    T('Sunucu zor sorular sordu; sen sakin kaldın.', 'The host asked tough questions; you stayed calm.'),
    T('Programın reytingleri yükseldi; yapımcı seni yeniden çağıracak.', 'The sho’ ratings rose; the producer wants you back.'),
  ],
  sponsor_shoot: [
    T('Aynı pozu kırk kez verdin. Sonuncusu mükemmeldi.', 'You held the same pose forty times. The last one was perfect.'),
    T('Reklam yönetmeni "doğal ol" dedi. Denedin.', 'The director said "be natural". You tried.'),
  ],
}

export const ACTIVITIES: readonly ActivityDef[] = [
  // ── Rest ──────────────────────────────────────────────
  { id: 'rest', icon: '🛋️', category: 'rest', slots: 1, allowedSlots: ALL, energy: -25, fatigue: -8, stress: -4,
    name: T('Dinlen', 'Rest'), desc: T('Evde kal, toparlan.', 'Stay home and recharge.'),
    conditions: { injuredOk: true }, triggerTags: ['home'], eventChance: 0.02, done: T('Dinlendin, enerjin yerine geldi.', 'You rested and recharged.') },
  { id: 'sleep_in', icon: '😴', category: 'rest', slots: 1, allowedSlots: [0], energy: -35, fatigue: -10, stress: -3,
    relations: [{ target: 'manager', delta: -1 }], disciplineInSeason: -1, special: 'sleepIn',
    name: T('Geç Kalk', 'Sleep In'), desc: T('Sabah antrenmanını boş ver, uyu. Sezon içinde hoca fark eder.', 'Skip the morning and sleep. In season the manager notices.'),
    conditions: { injuredOk: true }, triggerTags: ['home', 'lazy'], eventChance: 0.05, done: T('Öğlene kadar uyudun.', 'You slept until noon.') },

  // ── Training (club drills) ──────────────────────────────
  train('shooting', '🎯', T('Şut Antrenmanı', 'Shooting Drill')),
  train('passing', '🔁', T('Pas Çalışması', 'Passing Drill')),
  train('dribbling', '🌀', T('Top Sürme', 'Dribbling Course')),
  train('physical', '🏋️', T('Kondisyon & Güç', 'Fitness & Strength')),
  train('tactical', '📋', T('Taktik Çalışma', 'Tactical Session')),
  train('setPiece', '🚩', T('Duran Top', 'Set Pieces')),
  train('goalkeeping', '🧤', T('Kaleci Antrenmanı', 'Goalkeeping Drill')),
  train('crossing', '📐', T('Orta İstasyonu', 'Cross Station')),
  train('heading', '⚽', T('Kafa Topu Makinesi', 'Header Machine')),
  train('tackling', '🛡️', T('Top Kapma Düellosu', 'Tackle Duel')),
  train('recovery', '🧘', T('Yoga & Toparlanma', 'Yoga & Recovery'), true),
  { id: 'gym', icon: '💪', category: 'training', slots: 1, allowedSlots: ALL, energy: 15, fatigue: 8, health: 1, stress: -2,
    special: 'gym', name: T('Spor Salonu', 'Gym Session'), desc: T('Kendi başına ağırlık çalış: güç ve dayanıklılık.', 'Lift on your own: strength and stamina.'),
    conditions: { notMatchDay: true }, triggerTags: ['training', 'gym'], eventChance: 0.03, done: T('Salonda ter döktün.', 'You put in the work at the gym.') },
  { id: 'video', icon: '📺', category: 'training', slots: 1, allowedSlots: ALL, energy: 8, stress: 1,
    special: 'video', relations: [{ target: 'manager', delta: 1 }],
    name: T('Video Analiz', 'Study Tactics'), desc: T('Rakip ve kendi maç görüntülerini incele.', 'Study match footage of rivals and yourself.'),
    conditions: { injuredOk: true }, triggerTags: ['training'], eventChance: 0.02, done: T('Saatlerce maç görüntüsü izledin.', 'You studied hours of footage.') },
  { id: 'physio', icon: '🩺', category: 'health', slots: 1, allowedSlots: DAY, energy: 5, fatigue: -12, health: 2, moneyFormula: 'physio',
    special: 'physio', name: T('Fizyoterapi', 'Physio'), desc: T('Özel fizyoterapist: sakatlık iyileşmesini hızlandırır.', 'Private physio: speeds up injury recovery.'),
    conditions: { injuredOk: true }, triggerTags: ['health'], eventChance: 0.02, done: T('Fizyoterapiden çıktın, vücudun rahatladı.', 'Physio done, your body feels looser.') },

  // ── Family & friends ─────────────────────────────────────
  { id: 'family_visit', icon: '🏠', category: 'family', slots: 1, allowedSlots: [1, 2], energy: 10, happiness: 6, stress: -5,
    relations: [{ target: 'family', delta: 5 }], memory: T('Ziyarete geldi', 'Came to visit'),
    name: T('Aileni Ziyaret Et', 'Visit Family'), desc: T('Annenin yemekleri, babanın nasihatleri.', "Mum's cooking, Dad's advice."),
    conditions: { injuredOk: true }, triggerTags: ['family'], eventChance: 0.1, done: T('Ailenle güzel vakit geçirdin.', 'You had a lovely time with your family.') },
  { id: 'friend_hangout', icon: '🍔', category: 'social', slots: 1, allowedSlots: [1, 2], energy: 10, happiness: 5, stress: -5, money: -60,
    relations: [{ target: 'bestFriend', delta: 6 }], memory: T('Birlikte takıldık', 'Hung out together'),
    name: T('Kankayla Takıl', 'Hang Out with Best Friend'), desc: T('Çocukluk arkadaşınla eski günleri an.', 'Catch up with your childhood friend.'),
    conditions: { injuredOk: true }, triggerTags: ['friends'], eventChance: 0.1, done: T('Kankanla gülmekten karnın ağrıdı.', 'You laughed till it hurt with your best friend.') },
  { id: 'team_dinner', icon: '🍝', category: 'social', slots: 1, allowedSlots: [2], energy: 10, happiness: 4, stress: -3, moneyFormula: 'dinner',
    relations: [{ target: 'teammates', delta: 3 }],
    name: T('Takım Yemeği', 'Team Dinner'), desc: T('Takım arkadaşlarına yemek ısmarla, soyunma odası ısınsın.', 'Treat your teammates; warm up the dressing room.'),
    conditions: { injuredOk: true, inSeasonOnly: true }, triggerTags: ['teammates'], eventChance: 0.12, done: T('Takımla keyifli bir akşam yemeği.', 'A fun dinner with the squad.') },
  { id: 'date_night', icon: '🌹', category: 'romance', slots: 1, allowedSlots: [2], energy: 12, happiness: 7, stress: -4, moneyFormula: 'date',
    relations: [{ target: 'partner', delta: 7 }], memory: T('Romantik akşam', 'Romantic evening'),
    name: T('Romantik Akşam', 'Date Night'), desc: T('Sevgilinle şık bir restoranda akşam yemeği.', 'Dinner with your partner at a fancy restaurant.'),
    conditions: { injuredOk: true, requiresPartner: true }, triggerTags: ['romance'], eventChance: 0.12, done: T('Unutulmaz bir akşam geçirdiniz.', 'You had an unforgettable evening.') },

  // ── Nightlife ────────────────────────────────────────────
  { id: 'party', icon: '🪩', category: 'nightlife', slots: 1, allowedSlots: [2], energy: 30, happiness: 10, stress: -10, fatigue: 10, health: -3,
    moneyFormula: 'party', followersPct: 0.002, relations: [{ target: 'teammates', delta: 2 }],
    disciplineInSeason: -3, disciplineBeforeMatch: -6,
    name: T('Gece Kulübü', 'Nightclub'), desc: T('Şampanya, müzik ve paparazziler. Maç öncesi riskli!', 'Champagne, music and paparazzi. Risky before a match!'),
    conditions: { minMoney: 200, minAge: 18 }, triggerTags: ['nightlife', 'party'], eventChance: 0.25, done: T('Sabaha kadar dans ettin.', 'You danced until sunrise.') },
  { id: 'casino', icon: '🎰', category: 'gambling', slots: 1, allowedSlots: [2], energy: 15, stress: 2, special: 'casino',
    name: T('Kumarhane', 'Casino'), desc: T('Blackjack, rulet, slot, at yarışı. Sorumlu oyna.', 'Blackjack, roulette, slots, horse racing. Play responsibly.'),
    conditions: { minMoney: 100, minAge: 18 }, triggerTags: ['casino', 'gambling', 'nightlife'], eventChance: 0.15, done: T('Kumarhaneye gittin.', 'You went to the casino.') },

  // ── Public / media / work ────────────────────────────────
  { id: 'charity', icon: '🤲', category: 'social', slots: 2, allowedSlots: DAY, energy: 15, happiness: 4, stress: -2, moneyFormula: 'charity',
    reputation: 1, followersPct: 0.003, discipline: 2, relations: [{ target: 'fans', delta: 4 }, { target: 'press', delta: 3 }],
    name: T('Hayır İşi', 'Charity Work'), desc: T('Çocuk hastanesini ziyaret et, bağış yap.', "Visit a children's hospital and donate."),
    conditions: { injuredOk: true }, triggerTags: ['charity'], eventChance: 0.15, done: T('Çocukların yüzünü güldürdün.', 'You put smiles on the kids’ faces.') },
  { id: 'sponsor_shoot', icon: '📸', category: 'work', slots: 2, allowedSlots: DAY, energy: 15, stress: 2, followersPct: 0.004,
    special: 'shoot', name: T('Reklam Çekimi', 'Sponsor Shoot'), desc: T('Sponsorun için fotoğraf ve reklam çekimi.', 'Photo and ad shoot for your sponsor.'),
    conditions: { requiresSponsor: true, injuredOk: true, notMatchDay: true }, triggerTags: ['media', 'sponsor'], eventChance: 0.08, done: T('Çekim tamamlandı, kamera seni seviyor.', 'Shoot wrapped. The camera loves you.') },
  { id: 'interview', icon: '🎤', category: 'media', slots: 1, allowedSlots: DAY, energy: 8, stress: 3, moneyFormula: 'interview',
    reputation: 0.5, relations: [{ target: 'press', delta: 4 }],
    name: T('Röportaj', 'Media Interview'), desc: T('Bir spor programına konuk ol. Söylediklerine dikkat!', 'Guest on a sports show. Mind your words!'),
    conditions: { injuredOk: true, minReputation: 5 }, triggerTags: ['media', 'press'], eventChance: 0.3, done: T('Röportajın yayınlandı.', 'Your interview has aired.') },
  { id: 'social_post', icon: '📱', category: 'media', slots: 1, allowedSlots: ALL, energy: 2,
    special: 'post', name: T('Sosyal Medya Paylaşımı', 'Social Media Post'), desc: T('Antrenman, lüks, aile, hayır ya da olay paylaşım.', 'Training, luxury, family, charity or provocation.'),
    conditions: { injuredOk: true }, triggerTags: ['social'], eventChance: 0.05, done: T('Paylaşım yapıldı.', 'Posted.') },
  { id: 'business_meeting', icon: '💼', category: 'work', slots: 1, allowedSlots: DAY, energy: 10, stress: 3,
    name: T('İş Görüşmesi', 'Business Meeting'), desc: T('Yatırımcılar ve girişimcilerle buluş. Fırsat da dolandırıcı da çıkabilir.', 'Meet investors and founders. Could be a gem or a scam.'),
    conditions: { injuredOk: true, minMoney: 50000 }, triggerTags: ['business'], eventChance: 0.4, done: T('Toplantıdan yeni fikirlerle çıktın.', 'You left the meeting full of ideas.') },

  // ── Leisure / hobbies ────────────────────────────────────
  { id: 'shopping', icon: '🛍️', category: 'shopping', slots: 1, allowedSlots: [1, 2], energy: 8, happiness: 5, stress: -3, moneyFormula: 'shopping',
    name: T('Alışveriş', 'Shopping'), desc: T('Kendini şımart.', 'Treat yourself.'),
    conditions: { injuredOk: true, minMoney: 150 }, triggerTags: ['shopping'], eventChance: 0.05, done: T('Torbalarla eve döndün.', 'You came home with bags full.') },
  { id: 'hobby_gaming', icon: '🎮', category: 'leisure', slots: 1, allowedSlots: ALL, energy: 5, happiness: 4, stress: -5, followersPct: 0.001,
    relations: [{ target: 'teammates', delta: 1 }],
    name: T('Oyun Oyna', 'Gaming'), desc: T('Takım arkadaşlarınla online maç.', 'Online matches with your teammates.'),
    conditions: { injuredOk: true }, triggerTags: ['gaming'], eventChance: 0.03, done: T('Konsolda rakiplerini ezdin.', 'You crushed your rivals on the console.') },
  { id: 'hobby_golf', icon: '⛳', category: 'leisure', slots: 2, allowedSlots: DAY, energy: 12, happiness: 5, stress: -6, moneyFormula: 'golf',
    relations: [{ target: 'manager', delta: 1 }],
    name: T('Golf', 'Golf'), desc: T('Yeşil çimlerde sakin bir gün; iş bağlantıları kurulur.', 'A calm day on the greens; good for networking.'),
    conditions: { injuredOk: true, minMoney: 500, notMatchDay: true }, triggerTags: ['golf', 'business'], eventChance: 0.1, done: T('18 delik bitti, kafan boşaldı.', '18 holes done, mind cleared.') },
  { id: 'hobby_music', icon: '🎸', category: 'leisure', slots: 1, allowedSlots: ALL, energy: 6, happiness: 4, stress: -6,
    name: T('Müzik Yap', 'Play Music'), desc: T('Gitarını al, kafanı dağıt.', 'Grab your guitar and unwind.'),
    conditions: { injuredOk: true }, triggerTags: ['music'], eventChance: 0.03, done: T('Birkaç şarkı çaldın, rahatladın.', 'You played a few songs and relaxed.') },
  { id: 'travel', icon: '✈️', category: 'travel', slots: 3, allowedSlots: [0], energy: -40, fatigue: -25, happiness: 15, stress: -20, moneyFormula: 'travel',
    relations: [{ target: 'partner', delta: 8 }, { target: 'family', delta: 2 }], memory: T('Birlikte tatil', 'Holiday together'), followersPct: 0.005,
    name: T('Tatil', 'Vacation'), desc: T('Sezon arası: egzotik bir yere kaç.', 'Off-season: escape somewhere exotic.'),
    conditions: { offSeasonOnly: true, injuredOk: true, minMoney: 1500, cooldownDays: 7 }, triggerTags: ['travel'], eventChance: 0.2, done: T('Harika bir tatil geçirdin.', 'You had a wonderful holiday.') },

  // ── Services ─────────────────────────────────────────────
  { id: 'hire_trainer', icon: '🧑‍🏫', category: 'service', slots: 1, allowedSlots: DAY, energy: 0, special: 'trainer',
    name: T('Özel Antrenör Tut', 'Hire Personal Trainer'), desc: T('Bir özellik grubuna ekstra XP; haftalık ücret.', 'Extra XP for one attribute group; weekly fee.'),
    conditions: { injuredOk: true, minMoney: 1000 }, triggerTags: ['service'], eventChance: 0, done: T('Yeni antrenörünle anlaştın.', 'You hired a new trainer.') },
  { id: 'fire_trainer', icon: '🚪', category: 'service', slots: 1, allowedSlots: ALL, energy: 0, special: 'fireTrainer',
    name: T('Antrenörü Bırak', 'Dismiss Trainer'), desc: T('Özel antrenörünle yollarını ayır.', 'Part ways with your personal trainer.'),
    conditions: { injuredOk: true, requiresTrainer: true }, triggerTags: ['service'], eventChance: 0, done: T('Antrenörünle yollarını ayırdın.', 'You dismissed your trainer.') },
]

export const ACTIVITY_BY_ID: Readonly<Record<string, ActivityDef>> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]))
