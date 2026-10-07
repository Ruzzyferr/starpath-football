/** Social media: virality, trolls, brand DMs and the eternal screenshot. */
import {
  boss, canAfford, disc, fans, flags, follow, folPct, fx, happy, hasClub, money, morale, news, nice, num, pickBrand, press, rel, rep, stress, t, chain, trust, wageX, form, fol,
} from '../dsl'
import type { EventDef } from '../types'

export const socialEvents: EventDef[] = [
  {
    id: 'social.viral_challenge',
    category: 'social',
    weight: 1.1,
    cooldownWeeks: 16,
    triggers: ['weekly', 'social_post'],
    conditions: () => true,
    title: t('Çapraz Direk Challenge', 'The Crossbar Challenge'),
    text: t(
      'Herkes "#ÜçteÜç" akımını yapıyor: ceza sahası dışından üç vuruşta üç kez üst direk. {mate} seni etiketledi: "Hadi bakalım yıldız."',
      'Everyone\'s doing #ThreeForThree: hit the bar three times in three shots from outside the box. {mate} tagged you: "Go on chain, superstar."',
    ),
    icon: '📱',
    choices: [
      {
        label: t('Tek çekimde dene', 'One take, no edits'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.25 + ctx.state.hero.attrs.shooting / 250)
            ? fx(t('Bam, bam, BAM! Video milyonları geçti. {mate} bile tebrik etti.', 'Ping, ping, PING! Millions of views. Even {mate} bowed down.'), folPct(ctx, 12), rep(2), happy(6), rel('teammate', 2))
            : fx(t('Üç vuruş, üç tribün. Altına "dürüstlüğün için +1" yazdılar.', 'Three shots, three into the stands. Comments: "+1 for honesty."'), folPct(ctx, 3), happy(-2), morale(-2)),
      },
      {
        label: t('Kırk deneme çek, en iyisini yükle', 'Shoot forty takes, post the best'),
        effects: (ctx) => fx(t('Mükemmel video. Arka planda saat 2 saat ilerlemiş, kimse fark etmedi. Sen ettin; bacakların da.', 'Perfect video. The clock in the background jumped two hours; nobody noticed except your legs.'), folPct(ctx, 6), stress(-1), form(-1)),
      },
      {
        label: t('"Ben sahada konuşurum."', '"I do my talking on the pitch."'),
        effects: () => fx(t('{mate} "korktu" emojisi attı. Hoca ise bu cevaba bayıldı.', '{mate} posted a chicken emoji. The gaffer loved your answer.'), trust(2), rel('teammate', -1)),
      },
    ],
  },
  // ── Chain: old post resurfaces ──
  {
    id: 'social.old_post',
    category: 'social',
    weight: 0.9,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => hasClub(state) && state.hero.reputation >= 15,
    title: t('Eski Paylaşım Hortladı', 'The Old Tweet Resurfaces'),
    text: t(
      '15 yaşındayken yazdığın bir paylaşım bulundu: "{clubName} taraftarı gibi şarkı söyleyen biri olmaktansa ölürüm lol." Şimdi o kulübün formasını giyiyorsun.',
      'Someone dug up a post you wrote at 15: "rather die than sing like a {clubName} fan lol." You now wear that very shirt.',
    ),
    icon: '🕳️',
    choices: [
      {
        label: t('Samimi bir özür videosu çek', 'Record a sincere apology video'),
        effects: (ctx) =>
          fx(t('"15 yaşındaydım ve aptaldım. Şimdi bu armanın her şarkısını ezbere biliyorum." İlk tepkiler olumlu.', '"I was 15 and daft. Now I know every song for this badge." First reactions are kind.'), fans(4), folPct(ctx, 2), stress(3), flags({ old_post: 'apology' }), follow(chain('social.old_post_backlash', 1))),
      },
      {
        label: t('Gönderiyi sil, sus', 'Delete it and go quiet'),
        risk: 'medium',
        effects: () => fx(t('Sildin ama ekran görüntüleri ölümsüzdür.', 'Deleted. But screenshots are forever.'), fans(-4), stress(5), flags({ old_post: 'delete' }), follow(chain('social.old_post_backlash', 1))),
      },
      {
        label: t('Tribüne çık, ultralarla şarkı söyle', 'Go to the stands and sing with the ultras'),
        risk: 'high',
        effects: (ctx) => fx(t('Antrenman sonrası kale arkasına geçip megafonu aldın. Ya efsane ya felaket olacak.', 'After training you grabbed the megaphone behind the goal. Legendary or disastrous, nothing in between.'), folPct(ctx, 5), stress(4), flags({ old_post: 'ultras' }), follow(chain('social.old_post_backlash', 1))),
      },
    ],
  },
  {
    id: 'social.old_post_backlash',
    category: 'social',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Tepkinin Ertesi Günü', 'The Morning After the Storm'),
    text: t('Bildirimler durmuyor. Taraftar grubu tavrını açıklayacak; kulüp de senden bir şey bekliyor.', 'Notifications won\'t stop. The supporters\' group is about to give its verdict, and the club expects something from you.'),
    icon: '🔥',
    choices: [
      {
        label: t('Taraftar grubuyla yüz yüze görüş', 'Meet the supporters\' group face to face'),
        risk: 'medium',
        effects: (ctx, rng) => {
          const how = ctx.state.life.flags['old_post']
          const p = how === 'ultras' ? 0.75 : how === 'apology' ? 0.6 : 0.35
          return rng.chance(p)
            ? fx(t('Bir saatlik konuşma, bir atkı, bir sarılma. Artık "bizden biri" diyorlar.', 'An hour of talking, a scarf, a hug. Now they call you "one of us."'), fans(12), rep(2), stress(-6), flags({ old_post: null }), news(t('Taraftarlar {heroName}\'ı affetti', 'Fans forgive {heroName}'), 1))
            : fx(t('Toplantı bağırışla bitti. Bir sonraki iç saha maçında adın ıslıklandı.', 'The meeting ended in shouting. Your name got whistled at the next home game.'), fans(-12), morale(-6), stress(8), flags({ old_post: null }))
        },
      },
      {
        label: t('Kulüp hayır kurumuna bağış yap', 'Donate to the club\'s foundation'),
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 2, 1500)),
        lockedHint: t('Bağış için bütçen yok.', 'You can\'t afford a donation right now.'),
        effects: (ctx) => fx(t('Bağış takdir edildi, ama bazıları "parayla kurtuluyor" diyor.', 'The donation is appreciated, though some say you bought your way out.'), money(-wageX(ctx.state, 2, 1500)), fans(5), rel('chairman', 4), flags({ old_post: null })),
      },
      {
        label: t('Kendini antrenmana göm', 'Bury yourself in training'),
        effects: () => fx(t('Konuşmayı bıraktın, terlemeye başladın. Fırtına yavaşça dindi.', 'You stopped talking and started sweating. The storm slowly blew over.'), fans(-2), trust(3), stress(2), flags({ old_post: null })),
      },
    ],
  },
  {
    id: 'social.trolls',
    category: 'social',
    weight: 1,
    cooldownWeeks: 10,
    triggers: ['match_loss'],
    conditions: () => true,
    title: t('Yorumlar Zehir', 'The Comments Are Poison'),
    text: t(
      'Yenilginin ardından son paylaşımının altına binlerce yorum: "emekli ol", "kardeşim bile daha iyi oynar", bir de palyaço emojisi yağmuru.',
      'After the defeat your latest post is buried in comments: "retire", "my little brother plays better", and a blizzard of clown emojis.',
    ),
    icon: '🤡',
    choices: [
      {
        label: t('Hepsini oku, cevap ver', 'Read them all and reply'),
        risk: 'high',
        effects: (ctx, rng) =>
          rng.chance(0.3)
            ? fx(t('Bir trolün "kardeşine" ders teklif ettin. Kardeşi kabul etti, internet bayıldı.', 'You offered the troll\'s little brother a free session. He accepted; the internet loved it.'), folPct(ctx, 6), rep(1), stress(2))
            : fx(t('Gece 4\'e kadar tartıştın. Sabah antrenmanında top ayağından kaçıyordu.', 'You argued till 4 a.m. The ball kept escaping you at morning training.'), stress(10), form(-3), happy(-5), press(-2)),
      },
      {
        label: t('Yorumları kapat, telefonu bırak', 'Turn off comments, put the phone down'),
        effects: () => fx(t('Sessizlik. İlk saat zor, sonra şaşırtıcı derecede iyi.', 'Silence. The first hour is hard, then it\'s surprisingly great.'), stress(-6), happy(2)),
      },
      {
        label: t('Kulübün psikoloğuyla konuş', 'Talk to the club psychologist'),
        effects: () => fx(t('"Senin değerin yorum sayısı değil." Basit cümle, derin etki.', '"You are not your comment section." Simple line, deep effect.'), stress(-10), morale(4), trust(1)),
      },
    ],
  },
  {
    id: 'social.fake_account',
    category: 'social',
    weight: 0.8,
    cooldownWeeks: 30,
    conditions: ({ state }) => state.hero.reputation >= 15,
    vars: (_ctx, rng) => ({ fakeHandle: `real_${rng.pick(['star', 'goat', 'king', 'legend'])}_${rng.int(10, 99)}` }),
    title: t('Sahte Hesap', 'The Impostor Account'),
    text: t(
      '@{fakeHandle} adlı bir hesap senin fotoğraflarınla takipçilerine "imzalı forma çekilişi" adı altında para istiyor.',
      'An account called @{fakeHandle} is using your photos to ask followers for money in a "signed shirt giveaway".',
    ),
    icon: '🎭',
    choices: [
      {
        label: t('Uyarı paylaş, platforma bildir', 'Warn followers and report it'),
        effects: (ctx) => fx(t('Hesap iki gün sonra kapandı. Takipçiler dikkatli davranmana teşekkür etti.', 'The account was taken down two days later. Followers thanked you for the heads-up.'), folPct(ctx, 2), fans(3), stress(2)),
      },
      {
        label: t('Mağdurlara imzalı forma gönder', 'Send the victims real signed shirts'),
        requires: (ctx) => canAfford(ctx.state, 1500),
        lockedHint: t('Formalar için bütçen yetmiyor.', 'You can\'t afford the shirts.'),
        effects: (ctx) =>
          fx(t('Dolandırılanlar gerçek formalarını aldı. Haber yayıldı.', 'The scammed fans received real shirts. Word got around.'), money(-1500), fans(8), rep(2), folPct(ctx, 4), news(t('{heroName}, dolandırılan taraftarlarına forma yolladı', '{heroName} sends shirts to fans hit by impostor scam'), 1)),
      },
      {
        label: t('Boş ver, nasılsa kapanır', 'Ignore it, it\'ll vanish'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Gerçekten de kayboldu. Şanslıydın.', 'It did vanish. Lucky.'), stress(-1))
            : fx(t('Hesap büyüdü; şimdi bir haber kanalı "{heroName} taraftarı dolandırdı mı?" diye soruyor.', 'It grew; now a news channel is asking "Did {heroName} scam fans?"'), fans(-6), press(-4), stress(6)),
      },
    ],
  },
  {
    id: 'social.brand_dm',
    category: 'social',
    weight: 1,
    cooldownWeeks: 14,
    conditions: ({ state }) => state.life.followers >= 1000,
    vars: (ctx, rng) => ({ brand: pickBrand(rng), amount: wageX(ctx.state, 1, 600) }),
    title: t('Gelen Kutusunda Teklif', 'A Brand Slides into the DMs'),
    text: t(
      '{brand} adlı enerji içeceği markası yazdı: "Bir story = {amount:money}. Sadece kutuyu tutup gülümse." Ürünün içeriği… tartışmalı.',
      'Energy-drink brand {brand} messages: "One story = {amount:money}. Just hold the can and smile." The ingredients list is… debatable.',
    ),
    icon: '🥤',
    choices: [
      {
        label: t('Paylaş, parayı al', 'Post it, bank it'),
        effects: (ctx) => fx(t('Para hesapta. Kulübün beslenme uzmanı ise kaşlarını çattı.', 'Money landed. The club nutritionist frowned.'), money(num(ctx, 'amount')), folPct(ctx, -1), trust(-2)),
      },
      {
        label: t('Fiyatı ikiye katla', 'Ask for double'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.45)
            ? fx(t('"Tamam" dediler. Pazarlık yeteneğin menajerini bile şaşırttı.', 'They said yes. Your haggling impressed even your agent.'), money(num(ctx, 'amount') * 2), trust(-2))
            : fx(t('Mesaj "görüldü" olarak kaldı. Sonra başka bir oyuncunun story\'sinde kutuyu gördün.', 'Left on read. Then you saw the can in another player\'s story.'), stress(2)),
      },
      {
        label: t('Kibarca reddet', 'Politely decline'),
        effects: () => fx(t('Beslenme uzmanı haberi duyunca sana bir smoothie ısmarladı.', 'The nutritionist heard and bought you a smoothie.'), trust(1), happy(1)),
      },
    ],
  },
  {
    id: 'social.livestream_fail',
    category: 'social',
    weight: 0.9,
    cooldownWeeks: 24,
    conditions: () => true,
    title: t('Canlı Yayın Kazası', 'Livestream Gone Wrong'),
    text: t(
      'Takipçilerinle oyun oynarken canlı yayın yapıyordun. Arkadan {mate} kafasını uzatıp "hocaya ne dediğini anlatsana!" diye bağırdı. Sohbet çıldırdı.',
      'You were streaming a video game with fans when {mate} popped up behind you yelling "tell them what you said about the gaffer!" Chat went feral.',
    ),
    icon: '🎮',
    choices: [
      {
        label: t('Gülerek "şakaydı" de', 'Laugh it off: "just banter"'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Klip komik bulundu, kimse ciddiye almadı.', 'The clip was taken as a joke. Nobody cared.'), folPct(ctx, 4), happy(2))
            : fx(t('Klip {managerName}\'a ulaştı. Sabah ofiste soğuk bir kahve seni bekliyordu.', 'The clip reached {managerName}. A cold coffee awaited you in his office.'), boss(-8), trust(-4), folPct(ctx, 4)),
      },
      {
        label: t('Yayını hemen kapat', 'Kill the stream'),
        effects: (ctx) => fx(t('Ekran karardı; spekülasyon aydınlandı.', 'The screen went dark; the speculation lit up.'), folPct(ctx, 1), stress(4), boss(-2)),
      },
      {
        label: t('{mate}\'yı yayına çek, birlikte dalga geçin', 'Pull {mate} on camera and roast each other'),
        effects: (ctx) => fx(t('İki saatlik kahkaha. Yayın rekor kırdı, takım içi bağınız güçlendi.', 'Two hours of laughs. Record viewers, and a stronger bond.'), folPct(ctx, 8), rel('teammate', 3), boss(-2), disc(-2)),
      },
    ],
  },
  {
    id: 'social.miss_meme',
    category: 'social',
    weight: 1.1,
    cooldownWeeks: 12,
    triggers: ['match_loss', 'match_draw'],
    conditions: ({ state }) => state.hero.position !== 'GK',
    title: t('Kaçan Gol Caps Oldu', 'Your Miss Is a Meme'),
    text: t(
      'Boş kaleye kaçırdığın pozisyon "Ne zaman kira ödeyeceğimi sorduklarında ben" yazısıyla her yerde.',
      'Your open-goal miss is everywhere, captioned "me when the landlord asks about rent."',
    ),
    icon: '😬',
    choices: [
      {
        label: t('Caps\'i kendin paylaş', 'Share the meme yourself'),
        effects: (ctx) => fx(t('"En azından kiramı ödüyorum." Kendinle dalga geçebilmen herkesin gözünde puan.', '"At least I pay my rent." Laughing at yourself wins everyone over.'), folPct(ctx, 9), rep(1), fans(4), stress(-3)),
      },
      {
        label: t('Fazladan bitiricilik çalış', 'Stay late for finishing drills'),
        effects: () => fx(t('Akşam 9\'a kadar boş kaleye vuruş. Bu sefer hepsi ağlarda.', 'Open-goal finishing till 9 p.m. Every one went in this time.'), trust(3), stress(2), morale(2)),
      },
      {
        label: t('Uygulamayı sil', 'Delete the app'),
        effects: (ctx) => fx(t('Bir haftalık detoks. Takipçi kaybettin, huzur kazandın.', 'A week\'s detox. Lost followers, found peace.'), folPct(ctx, -3), stress(-8), happy(3)),
      },
    ],
  },
  {
    id: 'social.followers_milestone',
    category: 'social',
    weight: 2,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => state.life.followers >= 100_000,
    vars: (ctx) => ({ count: nice(ctx.state.life.followers) }),
    title: t('{count} Takipçi!', '{count} Followers!'),
    text: t('Takipçi sayın {count}\'ü geçti. Ekip bir kutlama paylaşımı öneriyor. Ne yapacaksın?', 'You\'ve passed {count} followers. Your team suggests a celebration post. What\'ll it be?'),
    icon: '🎉',
    choices: [
      {
        label: t('İmzalı krampon çekilişi', 'Signed boots giveaway'),
        effects: (ctx) => fx(t('Çekilişe yüz binlerce katılım. Kazanan çocuğun videosu herkesi ağlattı.', 'Hundreds of thousands entered. The winning kid\'s reaction video made everyone cry.'), folPct(ctx, 10), fans(5), money(-300)),
      },
      {
        label: t('Mahalle sahasına teşekkür paylaşımı', 'A thank-you post from your childhood pitch'),
        effects: (ctx) => fx(t('Beton sahadan bir fotoğraf: "Her şey burada başladı." Duygusal ve samimi.', 'A photo from the concrete pitch: "It all started here." Heartfelt.'), folPct(ctx, 5), rel('bestFriend', 6), rel('mother', 4), happy(4)),
      },
      {
        label: t('Lüks bir saatle poz', 'Pose with a luxury watch'),
        risk: 'medium',
        effects: (ctx) => fx(t('Beğeniler geldi, ama "kendini kaybetti" yorumları da.', 'The likes poured in, along with "he\'s lost the plot" comments.'), folPct(ctx, 6), fans(-3), rep(1)),
      },
    ],
  },
  // ── Chain: hacked account ──
  {
    id: 'social.hacked',
    category: 'social',
    weight: 0.7,
    cooldownWeeks: 0,
    once: true,
    conditions: ({ state }) => state.life.followers >= 2000,
    title: t('Hesabın Çalındı', 'Your Account Got Hacked'),
    text: t(
      'Sabah uyandığında hesabından "{rivalClub}\'a transfer oluyorum, bay bay {clubName}" yazılı bir paylaşım ve bir kripto bağlantısı paylaşılmış.',
      'You wake up to a post on your account: "Off to {rivalClub}, bye bye {clubName}", plus a crypto link.',
    ),
    icon: '🔓',
    choices: [
      {
        label: t('Platformla uğraş, şifreyi kurtar', 'Fight the platform support queue'),
        effects: () => fx(t('Destek bileti açıldı. "48 saat içinde dönüş" dediler.', 'Ticket filed. "Response within 48 hours," they said.'), stress(6), fans(-3), follow(chain('social.hacked_recovery', 1, { recovery: 'support' }))),
      },
      {
        label: t('Siber güvenlik uzmanı tut', 'Hire a cybersecurity expert'),
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 1, 1000)),
        lockedHint: t('Uzman tutacak paran yok.', 'Can\'t afford an expert.'),
        effects: (ctx) =>
          fx(t('Uzman üç saatte hesabı geri aldı ve kimin yaptığını bulmaya koyuldu.', 'The expert recovered it in three hours and started tracing the culprit.'), money(-wageX(ctx.state, 1, 1000)), stress(2), follow(chain('social.hacked_recovery', 1, { recovery: 'expert' }))),
      },
      {
        label: t('Kulüp hesabından açıklama yaptır', 'Have the club account clarify'),
        effects: () => fx(t('Kulüp "{heroName} bizimle" diye paylaştı. Taraftar rahatladı, hesabın hâlâ hacker\'da.', 'The club posted "{heroName} is going nowhere." Fans calmed; the hacker still has your account.'), fans(2), rel('chairman', 2), follow(chain('social.hacked_recovery', 2, { recovery: 'club' }))),
      },
    ],
  },
  {
    id: 'social.hacked_recovery',
    category: 'social',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Hesap Geri Geldi… Ama', 'Account Recovered… But'),
    text: t(
      'Hesabın sende. Ama hacker çekilmeden önce özel mesajlarından birkaçının ekran görüntüsünü almış olabilir.',
      'You have your account back. But the hacker may have screenshotted some of your DMs before leaving.',
    ),
    icon: '🛡️',
    choices: [
      {
        label: t('Önden git, şeffaf bir açıklama yap', 'Get ahead of it with a transparent statement'),
        effects: (ctx, rng) =>
          ctx.vars.recovery === 'expert' || rng.chance(0.6)
            ? fx(t('Hiçbir şey sızmadı; açıklaman dürüstlüğün kanıtı oldu.', 'Nothing leaked; your statement became proof of your honesty.'), folPct(ctx, 3), press(3), stress(-5))
            : fx(t('Bir grup sohbetinden hocaya ait bir lakap sızdı. Gülünç ama can sıkıcı.', 'A nickname you used for the gaffer leaked from a group chat. Funny, but awkward.'), boss(-6), folPct(ctx, 4), stress(4), news(t('{heroName}\'ın hocasına taktığı lakap ortaya çıktı', '{heroName}\'s secret nickname for his manager revealed'), -1)),
      },
      {
        label: t('Bir süre sosyal medyaya ara ver', 'Take a social media break'),
        effects: (ctx) => fx(t('İki haftalık sessizlik. Takipçi kaybettin ama uykun düzeldi.', 'Two weeks offline. You lost followers but found sleep.'), fol(-Math.round(ctx.state.life.followers * 0.02)), stress(-8), happy(4)),
      },
    ],
  },
]
