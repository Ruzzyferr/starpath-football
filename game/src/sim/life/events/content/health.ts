/** Health: knocks, diet, doping temptations, mental health, odd medical truths. */
import {
  ban, boss, canAfford, rel, disc, fatigue, flags, follow, fx, happy, hasClub, hasFlag, health, injury, isInjured, money, news, num, press, rep, sharp, stress, t, chain, trust, wageX, attr, energy, form,
} from '../dsl'
import type { EventDef } from '../types'

export const healthEvents: EventDef[] = [
  {
    id: 'health.minor_knock',
    category: 'health',
    weight: 1.2,
    cooldownWeeks: 10,
    triggers: ['training', 'post_match', 'weekly'],
    conditions: ({ state }) => hasClub(state) && !isInjured(state),
    title: t('Ufak Bir Sızı', 'A Little Twinge'),
    text: t(
      'Baldırında bir sızı var. Fizyoterapist "bir hafta dinlen" diyor; {managerName} ise hafta sonu maçı için "hazır mısın?" diye soruyor.',
      'There is a twinge in your calf. The physio says "rest a week"; {managerName} asks whether you are good to go for the weekend.',
    ),
    icon: '🩹',
    choices: [
      {
        label: t('Oynarım hocam', "I'll play, boss"),
        hint: t('Bacak dayanırsa kahraman olursun.', 'If the leg holds, you are a hero.'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Bacak dayandı. {managerName} omzuna vurdu: "İşte adam."', 'The leg held. {managerName} slaps your shoulder: "That\'s my player."'), trust(5), fatigue(8))
            : fx(t('Isınmada "tık" diye bir ses. Bu sefer üç hafta.', 'A "pop" in the warm-up. Three weeks this time.'), injury(3, t('Baldır yırtığı', 'Calf tear')), trust(1), stress(6)),
      },
      {
        label: t('Fizyoterapiste uy, dinlen', "Listen to the physio, rest"),
        effects: () => fx(t('Bir hafta buz, masaj ve dizi. Hoca biraz dudak büktü ama baldır teşekkür ediyor.', 'A week of ice, massage and box sets. The boss sulked a little; the calf says thanks.'), health(6), fatigue(-10), trust(-3), sharp(-4)),
      },
      {
        label: t('Özel bir fizyoterapist tut', 'Hire a private physio'),
        requires: (ctx) => canAfford(ctx.state, wageX(ctx.state, 0.5, 500)),
        lockedHint: t('Bunun için para lazım.', 'You need cash for this.'),
        effects: (ctx) =>
          fx(t('Özel seanslarla iki günde toparlandın. Pahalı ama etkili.', 'Private sessions had you fit in two days. Pricey, but it works.'), money(-wageX(ctx.state, 0.5, 500)), health(4), fatigue(-6)),
      },
    ],
  },
  {
    id: 'health.nutritionist',
    category: 'health',
    weight: 1,
    cooldownWeeks: 30,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ amount: wageX(state, 1, 1500) }),
    title: t('Beslenme Devrimi', 'The Nutrition Revolution'),
    text: t(
      'Ünlü bir diyetisyen seni sezon boyu takip etmek istiyor: {amount:money}. Şartı basit: gece döneri yok, şekerli kahve yok, annenin börekleri ayda bir.',
      'A well-known nutritionist offers to manage your diet all season for {amount:money}. The rules are simple: no late-night kebabs, no sugary coffees, and your mum\'s pastries once a month.',
    ),
    icon: '🥗',
    choices: [
      {
        label: t('Anlaştık, beni yeniden yaz', 'Deal. Rewrite me.'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Bütçe yetmiyor.', 'Not in the budget.'),
        effects: (ctx) =>
          fx(t('İlk hafta açlıktan rüyanda lahmacun gördün. Üçüncü hafta merdivenleri koşarak çıkıyorsun.', 'Week one you dreamed of flatbreads. By week three you are sprinting up the stairs.'), money(-num(ctx, 'amount')), attr('stamina', 1), health(6), happy(-3), flags({ diet_plan: true })),
      },
      {
        label: t('İnternetten bir diyet bulurum', "I'll find a diet online"),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('"Sadece kereviz suyu" diyeti bir hafta sürdü. Hafta sonu bayıldın, neyse ki soyunma odasında.', 'The "celery juice only" diet lasted a week. You fainted on Saturday, luckily in the dressing room.'), health(-6), energy(-15), stress(4))
            : fx(t('Şaşırtıcı biçimde işe yaradı. Kimse nedenini bilmiyor.', 'Surprisingly, it worked. Nobody knows why.'), health(3)),
      },
      {
        label: t('Annemin börekleri ilaçtır', "Mum's pastries are medicine"),
        effects: () => fx(t('Diyetisyen kapıdan çıkarken iç geçirdi. Sen mutlusun, kantar biraz daha az.', 'The nutritionist sighed on the way out. You are happy; the scales less so.'), happy(5), rel('mother', 4), fatigue(3)),
      },
    ],
  },
  {
    id: 'health.doping_offer',
    category: 'health',
    weight: 0.6,
    cooldownWeeks: 60,
    conditions: ({ state }) => hasClub(state) && !hasFlag(state, 'doping_taken'),
    vars: ({ state }) => ({ amount: wageX(state, 1, 2000) }),
    title: t('Mucize Toparlanma Kürü', 'The Miracle Recovery Cure'),
    text: t(
      'Otopark çıkışında "rejenerasyon uzmanı" olduğunu söyleyen biri yaklaştı. Elinde etiketsiz bir şişe: "Testlerde çıkmaz. {amount:money}, iki haftada yeni bacaklar."',
      'Outside the car park a self-styled "regeneration specialist" approaches. Unlabelled vial in hand: "Doesn\'t show up in tests. {amount:money}, new legs in two weeks."',
    ),
    icon: '💉',
    choices: [
      {
        label: t('Kesinlikle hayır', 'Absolutely not'),
        effects: () => fx(t('Arkanı döndün. Bazı kapılar hiç açılmamalı.', 'You walked away. Some doors should stay shut.'), disc(2), happy(1)),
      },
      {
        label: t('Kulüp doktoruna bildir', 'Report it to the club doctor'),
        effects: () =>
          fx(t('Doktor federasyona iletti. Adam bir hafta sonra gözaltına alındı; adın "temiz örnek" diye anılıyor.', 'The doctor passed it to the federation. A week later the man was detained; you are cited as a model professional.'), disc(6), rep(2), press(4), boss(3),
            news(t('{heroName} şüpheli teklifi ihbar etti', '{heroName} reports doping approach'), 1)),
      },
      {
        label: t('Bir kereden bir şey olmaz', "Once won't hurt"),
        hint: t('Olur. Büyük ihtimalle olur.', 'It will. Very probably.'),
        risk: 'high',
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Neyse ki paran yok.', 'Luckily, you cannot afford it.'),
        effects: (ctx) =>
          fx(t('Bacakların gerçekten uçuyor. Ama her sabah aynada bir yabancı var.', 'Your legs really are flying. But every morning there is a stranger in the mirror.'), money(-num(ctx, 'amount')), fatigue(-15), sharp(8), stress(8), flags({ doping_taken: true }), follow(chain('health.doping_test', 3))),
      },
    ],
  },
  {
    id: 'health.doping_test',
    category: 'health',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Sürpriz Doping Testi', 'Surprise Doping Test'),
    text: t(
      'Antrenman sabahı iki görevli kapıda. "Rastgele seçildiniz." Bardak elinde, kalbin kulaklarında.',
      'Two officials at the training ground door. "You have been randomly selected." Cup in hand, heart in your ears.',
    ),
    icon: '🧪',
    choices: [
      {
        label: t('Testi ver, dua et', 'Take the test and pray'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.75)
            ? fx(t('Pozitif. Federasyon dört maç men verdi; manşetler acımasız.', 'Positive. The federation hands you a four-match ban; the headlines are brutal.'), ban(4), rep(-6), disc(-15), trust(-10), stress(12), flags({ doping_taken: null, doping_caught: true }),
                news(t('Skandal: {heroName} dopingden men edildi', 'Scandal: {heroName} banned for doping'), -1))
            : fx(t('Negatif. Şişe ya sahteydi ya da şans yüzüne güldü. Bir daha asla.', 'Negative. Either the vial was fake or luck smiled. Never again.'), stress(-4), flags({ doping_taken: null })),
      },
      {
        label: t('İtiraf et, işbirliği yap', 'Confess and cooperate'),
        effects: () =>
          fx(t('Dürüstlüğün cezayı yarıya indirdi. Utanç ağır ama vicdanın hafif.', 'Your honesty halved the punishment. The shame is heavy; the conscience lighter.'), ban(2), rep(-3), disc(-6), trust(-4), stress(-2), flags({ doping_taken: null, doping_caught: true }),
            news(t('{heroName} hatasını kabul etti', '{heroName} admits doping error'), -1)),
      },
    ],
  },
  {
    id: 'health.burnout',
    category: 'health',
    weight: (ctx) => (ctx.state.life.stress > 70 ? 3 : 1),
    cooldownWeeks: 20,
    conditions: ({ state }) => state.life.stress >= 55,
    title: t('Boş Bakışlar', 'Thousand-Yard Stare'),
    text: t(
      'Son günlerde sabahları yataktan çıkmak maç kazanmaktan zor. Top artık eskisi gibi heyecan vermiyor. Kulüp psikoloğunun kapısı hep açık, biliyorsun.',
      'Lately getting out of bed feels harder than winning a match. The ball does not light you up like it used to. The club psychologist\'s door is always open, you know that.',
    ),
    icon: '🌧️',
    choices: [
      {
        label: t('Psikologla konuş', 'Talk to the psychologist'),
        hint: t('Yardım istemek güçtür.', 'Asking for help is strength.'),
        effects: () => fx(t('İlk seans tuhaftı, sonra kelimeler kendiliğinden aktı. Bir plan yaptınız.', 'The first session was strange, chain the words just came. You made a plan together.'), stress(-12), happy(4), flags({ in_therapy: true }), follow(chain('health.therapy_progress', 3))),
      },
      {
        label: t('Daha çok çalış, geçer', 'Train harder, it will pass'),
        risk: 'medium',
        effects: () => fx(t('Ağırlıklar ağırlaştı, gece uykular kaçtı. Bedenin bağırıyor.', 'The weights got heavier, the nights longer. Your body is shouting.'), stress(8), fatigue(10), health(-5), trust(2)),
      },
      {
        label: t('Ailenin yanına iki gün kaç', 'Escape home for two days'),
        effects: () => fx(t('Annenin mutfağı, çocukluk odan, sessizlik. Biraz nefes aldın.', "Mum's kitchen, your childhood room, silence. You could breathe a little."), stress(-7), happy(5), trust(-2), sharp(-3)),
      },
    ],
  },
  {
    id: 'health.therapy_progress',
    category: 'health',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Terapide Üçüncü Hafta', 'Therapy, Week Three'),
    text: t(
      'Psikolog bir öneride bulunuyor: hikâyeni bir röportajda anlatmak, benzer şeyler yaşayan gençlere umut olabilir. Ya da bu yalnızca senin yolculuğun olarak kalabilir.',
      'Your therapist suggests something: sharing your story in an interview could give hope to young people going through the same. Or it can stay your journey alone.',
    ),
    icon: '🌱',
    choices: [
      {
        label: t('Hikâyemi paylaşayım', "I'll share my story"),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.8)
            ? fx(t('Binlerce mesaj geldi: "Yalnız olmadığımı anladım." Hayatında attığın en anlamlı gol.', 'Thousands of messages: "Now I know I am not alone." The most meaningful goal of your life.'), rep(5), press(6), happy(8), stress(-5), flags({ in_therapy: null, mental_health_voice: true }),
                news(t('{heroName}: "Yardım istemekten utanmayın"', '{heroName}: "Don\'t be ashamed to ask for help"'), 1))
            : fx(t('Çoğu destekledi, birkaç trol de kendini gösterdi. Psikoloğun dediği gibi: sınırlarını koru.', 'Most were kind, a few trolls showed up. As your therapist said: protect your boundaries.'), rep(2), stress(3), happy(2), flags({ in_therapy: null })),
      },
      {
        label: t('Seanslara sessizce devam', 'Keep going, quietly'),
        effects: () => fx(t('Haftalık seanslar rutinin parçası oldu. Sahada kafan daha berrak.', 'Weekly sessions are part of your routine now. Your head is clearer on the pitch.'), stress(-8), attr('composure', 1), form(4), flags({ in_therapy: null })),
      },
      {
        label: t('Artık iyiyim, bırakıyorum', "I'm fine now, I'll stop"),
        effects: () => fx(t('Belki gerçekten iyisin. Kapı yine de açık.', 'Maybe you really are fine. The door stays open anyway.'), stress(-2), flags({ in_therapy: null })),
      },
    ],
  },
  {
    id: 'health.insomnia_gaming',
    category: 'health',
    weight: 1,
    cooldownWeeks: 16,
    conditions: ({ state }) => state.calendar.season - state.hero.birthYear < 28,
    title: t('Sabah 4 Sıralaması', 'The 4 A.M. Leaderboard'),
    text: t(
      'Online lige takıldın. Saat 04.12 ve "son bir maç" diyorsun. Antrenman 09.00\'da.',
      'You are hooked on an online league. It is 04:12 and you are saying "one last game". Training starts at 09:00.',
    ),
    icon: '🎮',
    choices: [
      {
        label: t('Konsolu kutusuna koy', 'Box up the console'),
        effects: () => fx(t('İlk gece tavanı izledin, üçüncü gece bebek gibi uyudun.', 'Night one you stared at the ceiling; by night three you slept like a baby.'), fatigue(-10), health(3), happy(-3)),
      },
      {
        label: t('Son bir maç... daha', 'One more game... again'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Antrenmana gözlerin şiş geldin, pas çalışmasında topu kafana yedin.', 'You arrived at training puffy-eyed and took a pass to the face.'), fatigue(12), trust(-4), sharp(-4))
            : fx(t('Dünya sıralamasında ilk 100\'e girdin. Gözlerin kan çanağı, ruhun mutlu.', 'You cracked the global top 100. Eyes bloodshot, soul happy.'), happy(6), fatigue(8)),
      },
      {
        label: t('Takım arkadaşlarıyla akşam turnuvası yap', 'Make it an early-evening squad tournament'),
        effects: () => fx(t('Saat 22.00\'de bitiyor, kaybeden kahvaltı ısmarlıyor. Takım ruhu sağlam.', 'Lights out at 10 p.m., loser buys breakfast. Team spirit sorted.'), happy(4), fatigue(-3), rel('teammate', 3)),
      },
    ],
  },
  {
    id: 'health.painkiller_injection',
    category: 'health',
    weight: 1,
    cooldownWeeks: 14,
    triggers: ['injury', 'weekly'],
    conditions: ({ state }) => hasClub(state) && isInjured(state) && (state.hero.injury?.weeksLeft ?? 0) <= 3,
    title: t('Derbi Öncesi İğne', 'The Pre-Derby Injection'),
    text: t(
      'Sakatlığın tam geçmedi ama {rivalClub} maçı kapıda. Doktor bir ağrı kesici iğne önerebileceğini söylüyor: "Hissetmezsin. Sonrasını konuşuruz."',
      'You are not fully healed, but the {rivalClub} game is coming. The doctor says a painkilling injection is possible: "You won\'t feel a thing. We\'ll talk about afterwards later."',
    ),
    icon: '🩺',
    choices: [
      {
        label: t('Vur iğneyi, oynayacağım', "Do it. I'm playing."),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.55)
            ? fx(t('Hiçbir şey hissetmedin, oynadın, taraftar adını haykırdı. Ertesi gün merdiven indiremiyorsun ama değdi.', 'Felt nothing, played, the crowd chanted your name. Next day you cannot do stairs, but worth it.'), trust(6), rep(2), health(-6), fatigue(10))
            : fx(t('İğnenin etkisi devrede geçti. Sakatlık iki katına çıktı.', 'The injection wore off at half-time. The injury doubled.'), injury(5, t('Tekrarlayan sakatlık', 'Aggravated injury')), health(-10), stress(8)),
      },
      {
        label: t('Hayır, tam iyileşeceğim', 'No, I heal properly'),
        effects: () => fx(t('Tribünden izledin. Kariyer uzun, derbi bir tane... ama kariyer uzun.', 'You watched from the stands. Careers are long, derbies are one... but careers are long.'), health(5), trust(-3), happy(-3)),
      },
    ],
  },
  {
    id: 'health.dentist',
    category: 'health',
    weight: 0.8,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasClub(state),
    vars: ({ state }) => ({ amount: wageX(state, 0.4, 400) }),
    title: t('Dişçiden Gelen Teşhis', "The Dentist's Diagnosis"),
    text: t(
      'Sürekli kas sakatlıkların için her şeyi denedin. Kulübün yeni dişçisi röntgene bakıp gülümsüyor: "Sorun hamstringinde değil, yirmilik dişinde."',
      'You have tried everything for your recurring muscle strains. The club\'s new dentist studies the X-ray and smiles: "The problem isn\'t your hamstring. It\'s your wisdom tooth."',
    ),
    icon: '🦷',
    choices: [
      {
        label: t('Çektir gitsin', 'Pull it'),
        effects: () => fx(t('Bir hafta pamuk ısırarak konuştun. Sonra kaslar sahiden rahatladı. Tıp ilginç.', 'You spoke through cotton wool for a week. Then the muscles genuinely eased. Medicine is weird.'), health(8), happy(-2), sharp(-2), fatigue(-6)),
      },
      {
        label: t('Özel klinikte lazerle tedavi', 'Laser treatment at a private clinic'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Özel klinik pahalı.', 'Private clinics are pricey.'),
        effects: (ctx) => fx(t('Acısız, hızlı, pahalı. Gülüşün de reklamlık oldu.', 'Painless, fast, expensive. Your smile is now advert-ready.'), money(-num(ctx, 'amount')), health(8), rep(1)),
      },
      {
        label: t('Bu bir şaka mı?', 'Is this a joke?'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Şaka değilmiş. Bir ay sonra yine arka adale.', 'It wasn\'t. A month later, the hamstring again.'), injury(2, t('Arka adale zorlanması', 'Hamstring strain')), stress(4))
            : fx(t('Dişçiyi dinlemedin, şans eseri bir şey olmadı. Şimdilik.', 'You ignored the dentist and nothing happened. For now.'), stress(1)),
      },
    ],
  },
]

