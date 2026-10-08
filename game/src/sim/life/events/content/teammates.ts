/** Teammates: dressing-room politics, friendships, pranks and favours. */
import {
  attr, boss, canAfford, chairman, disc, energy, fans, flagNum, flags, follow, folPct, form, fx, happy, hasClub, hasFlag, injury, money, morale, news,
  num, pickPlayerFirst, press, rel, relNpc, rep, sharp, stress, t, chain, trust, wageX,
} from '../dsl'
import type { EventDef } from '../types'

/** Weeks a lost captaincy vote keeps a rivalry with the winner (relation drifts down, see sim/life/relationships). */
export const CAPTAIN_RIVALRY_WEEKS = 40

export const teammatesEvents: EventDef[] = [
  {
    id: 'teammates.loan_request',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 20,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ amount: wageX(state, 2, 1000) }),
    title: t('Ufak Bir Rica', 'A Small Favour'),
    text: t(
      '{mate} soyunma odasında yanına sokuldu, sesini alçalttı: "Kardeşim, ev sahibi kirayı artırdı, ay sonuna kadar {amount:money} lazım. Maaş yatınca ilk iş veririm, söz."',
      '{mate} sidles up in the dressing room and lowers {g:his|her} voice: "Mate, my landlord hiked the rent. I need {amount:money} till payday. First thing I do when wages land, promise."',
    ),
    icon: '💸',
    choices: [
      {
        label: t('Ver gitsin', 'Lend it'),
        hint: t('Geri gelir mi? Kim bilir.', 'Will you see it again? Who knows.'),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bu kadar nakdin yok.', "You don't have that much cash."),
        effects: (ctx) =>
          fx(
            t('{mate} sarıldı, neredeyse ağlayacaktı. Şimdi bekleme zamanı.', '{mate} hugged you, nearly in tears. Now you wait.'),
            money(-num(ctx, 'amount')),
            relNpc(ctx.vars.mateId, ctx.vars.mate, 15),
            follow(chain('teammates.loan_payback', 4)),
          ),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: (ctx) =>
          fx(t('"Anlıyorum" dedi ama bakışları başka şey söylüyordu.', '"No worries," {g:he|she} said. {g:His|Her} eyes said otherwise.'), relNpc(ctx.vars.mateId, ctx.vars.mate, -6)),
      },
      {
        label: t('Kulübün avans sistemine yönlendir', "Point {g:him|her} to the club's wage advance"),
        hint: t('Mantıklı ama soğuk.', 'Sensible, a bit cold.'),
        effects: (ctx) =>
          fx(
            t('Muhasebeye gitti. Sorunu çözüldü; size olan sıcaklığı biraz soğudu.', '{g:He|She} went to accounts. Problem solved; the warmth cooled a little.'),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -2),
            trust(1),
          ),
      },
    ],
  },
  {
    id: 'teammates.loan_payback',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Borç Meselesi', 'About That Loan'),
    text: t(
      '{mate} antrenman sonrası yanına geldi. Elinde zarf var mı yok mu, uzaktan anlaşılmıyor.',
      "{mate} wanders over after training. From here you can't tell if there's an envelope in {g:his|her} hand.",
    ),
    icon: '✉️',
    choices: [
      {
        label: t('"Ee, zarf mı o?"', '"So... is that an envelope?"'),
        effects: (ctx, rng) =>
          rng.chance(0.65)
            ? fx(
                t('Zarf! Üstüne bir de kahve ısmarladı. Soyunma odasında sözü geçen bir dostun oldu.', 'An envelope! Plus a coffee on top. You now have a friend with clout in the dressing room.'),
                money(num(ctx, 'amount')),
                relNpc(ctx.vars.mateId, ctx.vars.mate, 10),
                happy(3),
              )
            : fx(
                t('"Gelecek ay kesin" dedi. Üçüncü kez.', '"Next month, definitely," {g:he|she} said. For the third time.'),
                relNpc(ctx.vars.mateId, ctx.vars.mate, -4),
                stress(4),
              ),
      },
      {
        label: t('Borcu sil, dostluk kalsın', 'Write it off, keep the friendship'),
        effects: (ctx) =>
          fx(t('"Unut gitsin" dedin. {mate} sana artık sahada da arkadaş gözüyle bakıyor.', '"Forget it," you said. {mate} now looks for you on the pitch, too.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 20), happy(2)),
      },
    ],
  },
  {
    id: 'teammates.penalty_taker',
    category: 'teammates',
    weight: 1.2,
    cooldownWeeks: 12,
    triggers: ['post_match', 'match_draw', 'match_loss', 'weekly'],
    conditions: ({ state }) => hasClub(state) && state.hero.position !== 'GK',
    title: t('Penaltıyı Kim Atacak?', "Who's on Penalties?"),
    text: t(
      'Hoca toplantıda penaltıcı listesini açık bıraktı. {mate} de sen de topu almak istiyorsunuz. Herkes size bakıyor.',
      'The gaffer left the penalty order "open for discussion". You and {mate} both want the ball. Everyone is looking at you two.',
    ),
    icon: '🎯',
    choices: [
      {
        label: t('"Top bende, nokta."', '"It\'s mine. Full stop."'),
        risk: 'medium',
        effects: (ctx) =>
          fx(t('{managerName} başını salladı: liste başı sensin. {mate} dudak büktü.', '{managerName} nods: you are first choice. {mate} pulls a face.'), trust(2), relNpc(ctx.vars.mateId, ctx.vars.mate, -10), morale(5), flags({ penalty_taker: true })),
      },
      {
        label: t('{mate} atsın, sen ikinci ol', 'Let {mate} have it, be second'),
        effects: (ctx) =>
          fx(t('Soyunma odası bu jesti not etti.', 'The dressing room clocked the gesture.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 12), rel('teammate', 2), morale(-3), flags({ penalty_taker: null })),
      },
      {
        label: t('Antrenmanda penaltı düellosu öner', 'Propose a shoot-out in training'),
        hint: t('Kaybedersen gülünç olursun.', 'Lose and it gets awkward.'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.5 + (ctx.state.hero.attrs.composure - 50) / 200)
            ? fx(t('Beşte beş. Tartışma bitti, hava atma hakkı da senin.', 'Five from five. Debate over, and the bragging rights are yours.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 2), morale(8), boss(3), flags({ penalty_taker: true }))
            : fx(t('İkincisi direğe. Takım günlerce taklidini yaptı.', 'Your second hit the post. The squad did impressions for days.'), morale(-6), form(-2), flags({ penalty_taker: null })),
      },
    ],
  },
  {
    id: 'teammates.captain_race',
    category: 'teammates',
    weight: (ctx) => (ctx.state.hero.reputation >= 25 ? 1 : 0.3),
    cooldownWeeks: 40,
    triggers: ['new_season', 'weekly'],
    conditions: ({ state }) =>
      hasClub(state) && state.hero.contract?.role !== 'captain' && !hasFlag(state, 'team_captain') && state.hero.attrs.leadership >= 45 && !hasFlag(state, 'captain_race_active'),
    title: t('Pazubandı Yarışı', 'The Armband Race'),
    text: t(
      'Kaptan futbolu bıraktı, pazubant boşta. {managerName} oyuncuların görüşünü soracak. Kulislerde iki isim dolaşıyor: sen ve {mate}.',
      "The old skipper has hung up {g:his|her} boots and the armband is up for grabs. {managerName} will sound out the squad. Two names are doing the rounds: yours and {mate}'s.",
    ),
    icon: '🎗️',
    choices: [
      {
        label: t('Açık açık kampanya yap', 'Campaign openly'),
        hint: t('Oy toplarsın, düşman da.', 'You will win votes, and enemies.'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('Herkese tek tek kahve ısmarladın. {mate} buna "siyaset" dedi.', 'You bought everyone a coffee, one by one. {mate} called it "politics".'),
            money(-300),
            rel('teammate', 3),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -4),
            flags({ captain_race_active: true, captain_campaign: 2 }),
            follow(chain('teammates.captain_vote', 2)),
          ),
      },
      {
        label: t('Sahada konuş, dilinle değil', 'Let your football do the talking'),
        effects: () =>
          fx(
            t('Antrenmanlarda daha çok bağırdın, daha çok koştun. Hoca not aldı.', 'You ran harder and shouted louder in training. The gaffer took notes.'),
            trust(3),
            energy(-5),
            attr('leadership', 1),
            flags({ captain_race_active: true, captain_campaign: 1 }),
            follow(chain('teammates.captain_vote', 2)),
          ),
      },
      {
        label: t('Kıdemlilerle yemek ye, oylarını iste', 'Have dinner with the seniors and ask for their votes'),
        hint: t('Para harcarsın; kıdemliler yanında olur, {mate} kırılır.', "It costs money; the seniors back you, {mate} takes offence."),
        risk: 'medium',
        requires: (ctx) => canAfford(ctx.state, 1500),
        lockedHint: t('Yemek için nakdin yetmiyor.', "You can't afford the dinner."),
        effects: (ctx) =>
          fx(
            t('Kıdemlilerle uzun bir akşam yemeği yedin; kimse söz vermedi ama herkes başını salladı. {mate} duyunca yüzünü ekşitti.', 'A long dinner with the seniors; nobody promised anything but everyone nodded. {mate} pulled a face when {g:he|she} heard.'),
            money(-1500),
            rel('teammate', 5),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -3),
            flags({ captain_race_active: true, captain_campaign: 3 }),
            follow(chain('teammates.captain_vote', 2)),
          ),
      },
      {
        label: t('{mate} için çekil', 'Step aside for {mate}'),
        effects: (ctx) =>
          fx(
            t('"Bu iş ona yakışır" dedin. {mate} bunu hiç unutmayacak.', '"The job suits {g:him|her}," you said. {mate} will never forget it.'),
            relNpc(ctx.vars.mateId, ctx.vars.mate, 20),
            rel('teammate', 2),
            morale(-3),
          ),
      },
    ],
  },
  {
    id: 'teammates.captain_vote',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Oylama Günü', 'Vote Day'),
    text: t(
      'Kağıtlar toplandı, {managerName} sayıyor. Sonucu açıklamadan önce sana dönüp soruyor: "Kaybedersen ne yaparsın?"',
      'Ballots are in and {managerName} is counting. Before announcing, he turns to you: "And if you lose?"',
    ),
    icon: '🗳️',
    choices: [
      {
        label: t('"Kim kazanırsa arkasındayım."', '"I\'ll back whoever wins."'),
        effects: (ctx, rng) =>
          rng.chance(0.3 + flagNum(ctx.state, 'captain_campaign') * 0.15)
            ? fx(
                t('Pazubant senin! Hoca cevabını da beğendi.', 'The armband is yours! He liked the answer too.'),
                trust(6),
                rep(3),
                morale(10),
                rel('teammate', 4),
                flags({ captain_race_active: null, captain_campaign: null, team_captain: true }),
                news(t("{clubName}'da yeni kaptan: {heroName}", '{clubName} name {heroName} new captain'), 1),
              )
            : fx(
                t('{mate} kazandı. Elini ilk sıkan sen oldun; bu da konuşuldu.', '{mate} won. You were first to shake {g:his|her} hand, and people noticed.'),
                relNpc(ctx.vars.mateId, ctx.vars.mate, 10),
                trust(2),
                morale(-4),
                flags({ captain_race_active: null, captain_campaign: null, captain_rival_until: ctx.absWeek + CAPTAIN_RIVALRY_WEEKS, captain_rival_id: String(ctx.vars.mateId ?? '') }),
              ),
      },
      {
        label: t('"Kaybetmem hocam."', '"I won\'t lose, boss."'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.25 + flagNum(ctx.state, 'captain_campaign') * 0.15)
            ? fx(
                t('Kazandın ve özgüvenin takıma da bulaştı.', 'You won, and the swagger spread through the squad.'),
                trust(4),
                rep(3),
                morale(12),
                flags({ captain_race_active: null, captain_campaign: null, team_captain: true }),
                news(t("{clubName}'da pazubant {heroName}'da", '{heroName} handed the {clubName} armband'), 1),
              )
            : fx(
                t('Kaybettin. O cümle soyunma odasında aylarca önüne konuldu.', 'You lost. That line got quoted back at you for months.'),
                morale(-8),
                rel('teammate', -3),
                relNpc(ctx.vars.mateId, ctx.vars.mate, -6),
                flags({ captain_race_active: null, captain_campaign: null, captain_rival_until: ctx.absWeek + CAPTAIN_RIVALRY_WEEKS, captain_rival_id: String(ctx.vars.mateId ?? '') }),
              ),
      },
    ],
  },
  {
    id: 'teammates.mentor_youngster',
    category: 'teammates',
    weight: (ctx) => (ctx.state.calendar.season - ctx.state.hero.birthYear >= 23 ? 1.2 : 0.25),
    cooldownWeeks: 52,
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'mentoring'),
    vars: ({ state }, rng) => ({ kid: pickPlayerFirst(state, rng) }),
    title: t('Akademiden Gelen Çocuk', 'The Academy Kid'),
    text: t(
      'A takıma yeni çıkan 17 yaşındaki {kid} gölgen gibi peşinde. Bağcıklarını senin gibi bağlıyor, senin gibi sevinç yapıyor. Bugün cesaretini toplayıp ekstra antrenmanlarına katılıp katılamayacağını sordu.',
      '{kid}, 17 and fresh up from the academy, follows you like a shadow. Same bootlaces, same celebration. Today {g:he|she} finally asked if {g:he|she} can join your extra sessions.',
    ),
    icon: '🧒',
    choices: [
      {
        label: t('Kanatlarının altına al', 'Take {g:him|her} under your wing'),
        hint: t('Zaman ve enerji ister.', 'Costs time and energy.'),
        effects: () =>
          fx(
            t('Her antrenman sonrası yarım saat. {kid} söylediğin her şeyi not ediyor.', 'Half an hour after every session. {kid} hangs on every word.'),
            energy(-8),
            attr('leadership', 1),
            happy(4),
            flags({ mentoring: true }),
            follow(chain('teammates.mentor_payoff', 8)),
          ),
      },
      {
        label: t('"Önce kendi oyunuma bakmalıyım"', '"I need to focus on my own game"'),
        effects: () =>
          fx(t('{kid} başını önüne eğdi. Ertesi gün başka birinin peşindeydi.', '{kid} nodded at the floor. Next day {g:he|she} was shadowing someone else.'), sharp(3), rel('teammate', -2)),
      },
      {
        label: t('Ona profesyonel krampon hediye et', 'Gift {g:him|her} a pair of pro boots'),
        requires: (ctx) => canAfford(ctx.state, 600),
        lockedHint: t('600 € gerek.', 'Needs €600.'),
        effects: () =>
          fx(t('Çocuk kramponlarla uyumuş, öyle diyorlar.', 'Word is {g:he|she} slept in them.'), money(-600), happy(5), rel('teammate', 3), rep(1)),
      },
    ],
  },
  {
    id: 'teammates.mentor_payoff',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    /** Fallback only; the parent's {kid} overrides it. */
    vars: ({ state }, rng) => ({ kid: pickPlayerFirst(state, rng) }),
    title: t('Öğrenci Parlayınca', 'When the Pupil Shines'),
    text: t(
      '{kid} ilk A takım golünü attı ve koşarak doğruca sana geldi. Kameralar ikinizi yakaladı. Şimdi bir muhabir soruyor: "Formanıza mı göz dikti?"',
      '{kid} scored {g:his|her} first senior goal and sprinted straight to you. The cameras caught it all. Now a reporter asks: "Is {g:he|she} after your shirt?"',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('"Umarım bir gün yerimi alır."', '"I hope {g:he|she} takes it one day."'),
        effects: () =>
          fx(t('Söz manşet oldu. Taraftar seni bir kat daha sevdi.', 'The quote made headlines. The fans loved you a little more.'), rep(3), fans(6), happy(5), flags({ mentoring: null })),
      },
      {
        label: t('"O gün daha çok uzak."', '"That day is a long way off."'),
        effects: () =>
          fx(t('Hırslı cevap. Kimi soğuk buldu, hoca rekabeti sevdi.', 'Competitive answer. Some found it cold; the gaffer loved the edge.'), trust(3), morale(4), press(-2), flags({ mentoring: null })),
      },
      {
        label: t('Muhabiri geçiştir, çocuğa sarıl', 'Ignore the reporter, hug the kid'),
        effects: () =>
          fx(t('Fotoğraf her yerde: sen ve {kid}, kahkaha içinde.', 'The photo is everywhere: you and {kid}, both laughing.'), fans(3), happy(6), press(-1), flags({ mentoring: null })),
      },
    ],
  },
  {
    id: 'teammates.prank_war',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 25,
    triggers: ['training', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Şaka Savaşı', 'Prank War'),
    text: t(
      'Dolabını açtın: içi ağzına kadar tıraş köpüğü. Kapıda {mate} gülmemek için kendini zor tutuyor.',
      'You open your locker: wall-to-wall shaving foam. In the doorway, {mate} is failing badly at not laughing.',
    ),
    icon: '🤡',
    choices: [
      {
        label: t('Misilleme: arabasını streç filmle sar', 'Retaliate: cling-film {g:his|her} car'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.7)
            ? fx(
                t('Video patladı. {mate} bile alkışladı.', 'The video blew up. Even {mate} applauded.'),
                relNpc(ctx.vars.mateId, ctx.vars.mate, 8),
                rel('teammate', 3),
                folPct(ctx, 4),
                happy(5),
              )
            : fx(
                t('Yanlış araba. Başkan {chairmanName}\'in arabasıymış.', "Wrong car. It belonged to chairman {chairmanName}."),
                chairman(-6),
                disc(-5),
                rel('teammate', 4),
                happy(2),
              ),
      },
      {
        label: t('Gül geç, ortalığı temizle', 'Laugh it off and clean up'),
        effects: (ctx) =>
          fx(t('Sportmenliğin not edildi. Ama artık kolay hedefsin.', 'Good sport, noted. Also: easy target, noted.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 4), stress(2)),
      },
      {
        label: t('Malzemeciye şikayet et', 'Complain to the kit man'),
        effects: (ctx) =>
          fx(
            t('Malzemeci "Bunu ben mi temizleyeceğim?" diye söylendi. Takımda lakabın çıktı: "Müfettiş".', 'The kit man sighed theatrically. The squad now calls you "the Inspector".'),
            rel('teammate', -4),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -5),
            disc(2),
          ),
      },
    ],
  },
  {
    id: 'teammates.dressing_room_fight',
    category: 'teammates',
    weight: 1,
    cooldownWeeks: 20,
    triggers: ['match_loss'],
    conditions: ({ state }) => hasClub(state),
    title: t('Soyunma Odasında Gerginlik', 'Dressing-Room Flashpoint'),
    text: t(
      'Ağır bir yenilgi. {mate} ikinci golü {mate2}\'ye yıkıyor; sesler yükseliyor, bir su şişesi havada uçuyor. Herkes donmuş, sana bakıyor.',
      'A grim defeat. {mate} blames {mate2} for the second goal; voices rise, a water bottle flies. Everyone freezes and looks at you.',
    ),
    icon: '💢',
    choices: [
      {
        label: t('Araya gir, ikisini ayır', 'Step in and separate them'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.8)
            ? fx(t('Ortalığı yatıştırdın. Hoca kapıdan izliyormuş.', 'You calmed it down. The gaffer was watching from the door.'), trust(4), attr('leadership', 1), rel('teammate', 3))
            : fx(
                t('Ayırırken bir dirsek yedin, kaşın açıldı. Ama kavga bitti.', 'You caught an elbow breaking it up. Cut eyebrow, fight over.'),
                injury(1, t('Kaş yarılması', 'Cut eyebrow')),
                trust(4),
                rel('teammate', 4),
              ),
      },
      {
        label: t('{mate}\'nin tarafını tut', 'Side with {mate}'),
        effects: (ctx) =>
          fx(
            t('{mate} artık sırtını sana dayıyor. {mate2} ise adını bir kenara yazdı.', '{mate} has your back now. {mate2} has your name in a little black book.'),
            relNpc(ctx.vars.mateId, ctx.vars.mate, 12),
            relNpc(ctx.vars.mate2Id, ctx.vars.mate2, -15),
          ),
      },
      {
        label: t('Kulaklığını tak, duşa git', 'Headphones on, hit the showers'),
        effects: () => fx(t('Fırtına geçti, sen ıslanmadın. Ama kimse bir şey öğrenmedi.', 'The storm passed and you stayed dry. Nobody learned anything.'), stress(-2), rel('teammate', -2)),
      },
    ],
  },
  {
    id: 'teammates.jealous_star',
    category: 'teammates',
    weight: (ctx) => (ctx.state.hero.reputation > 40 ? 1.3 : 0.5),
    cooldownWeeks: 26,
    triggers: ['match_win', 'scored', 'weekly'],
    conditions: ({ state }) => hasClub(state),
    title: t('Kıskançlık Kokusu', 'Whiff of Jealousy'),
    text: t(
      '{mate} röportajında adını bir kez bile anmadı, sahada da paslar sana gelmiyor. Biri kulağına fısıldadı: "Manşetlerini kıskanıyor."',
      "{mate} didn't mention you once in {g:his|her} interview, and on the pitch the passes have dried up. Someone whispers: \"{g:He's|She's} jealous of your headlines.\"",
    ),
    icon: '😒',
    choices: [
      {
        label: t('Yemeğe davet et, konuşun', 'Invite {g:him|her} to dinner, talk it out'),
        requires: (ctx) => canAfford(ctx.state, 250),
        lockedHint: t('Yemek parası bile yok.', "Can't even cover dinner."),
        effects: (ctx, rng) =>
          rng.chance(0.65)
            ? fx(t('İkinci tatlıda buzlar eridi. Paslar geri geldi.', 'By the second dessert the ice had melted. The passes are back.'), money(-250), relNpc(ctx.vars.mateId, ctx.vars.mate, 18))
            : fx(t('Hesabı sen ödedin, o telefonuna baktı. Hiçbir şey değişmedi.', 'You paid; {g:he|she} scrolled {g:his|her} phone. Nothing changed.'), money(-250), relNpc(ctx.vars.mateId, ctx.vars.mate, 2), stress(3)),
      },
      {
        label: t('Basına onu öven sözler söyle', 'Praise {g:him|her} publicly to the press'),
        effects: (ctx) =>
          fx(t('Egosunu okşadın. Bazı yorumcular buna "zayıflık" dedi.', 'You stroked {g:his|her} ego. Some pundits called it weakness.'), relNpc(ctx.vars.mateId, ctx.vars.mate, 12), press(2), rep(-1)),
      },
      {
        label: t('Hocaya götür', 'Take it to the gaffer'),
        risk: 'medium',
        effects: (ctx) =>
          fx(
            t('{managerName} ikinizi odasına çağırdı. Sorun çözüldü ama "ispiyoncu" fısıltıları başladı.', '{managerName} hauled you both in. Problem solved, but the "snitch" whispers began.'),
            boss(4),
            relNpc(ctx.vars.mateId, ctx.vars.mate, -6),
            rel('teammate', -3),
          ),
      },
    ],
  },
  {
    id: 'teammates.group_chat',
    category: 'teammates',
    weight: 0.9,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state),
    title: t('Takım Grubunda Kaza', 'Group Chat Mishap'),
    text: t(
      '{mate2} takım grubuna yanlışlıkla hocanın kilosuyla ilgili bir caps attı, sonra silmeye çalıştı. "Herkes için sil" çalışmadı. {managerName} de grupta.',
      '{mate2} accidentally posted a meme about the gaffer\'s waistline in the team chat. "Delete for everyone" failed. {managerName} is in the group.',
    ),
    icon: '📱',
    choices: [
      {
        label: t('Konuyu değiştirmek için maç videosu at', 'Flood the chat with match clips to bury it'),
        effects: (ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('Caps on mesaj yukarıda kayboldu. {mate2} sana bir kasa meyve suyu borçlu.', 'The meme vanished under ten clips. {mate2} owes you big time.'), relNpc(ctx.vars.mate2Id, ctx.vars.mate2, 15))
            : fx(t('Hoca zaten görmüştü: "Güzel kurgu {heroName}."', 'The gaffer had already seen it: "Nice editing, {heroName}."'), relNpc(ctx.vars.mate2Id, ctx.vars.mate2, 10), trust(-3)),
      },
      {
        label: t('Gülme emojisi bas', 'Drop a crying-laughing emoji'),
        risk: 'medium',
        effects: (ctx) =>
          fx(t('Takım seni sevdi, hoca adını not etti.', 'The squad loved it. The gaffer noted your name.'), rel('teammate', 4), trust(-5), relNpc(ctx.vars.mate2Id, ctx.vars.mate2, 4)),
      },
      {
        label: t('Sessiz kal, gruptan bildirimleri kapat', 'Stay silent, mute the group'),
        effects: () => fx(t('Akıllıca. Sıkıcı ama akıllıca.', 'Smart. Boring, but smart.'), stress(-1)),
      },
    ],
  },
]
