/**
 * "Alone Abroad" (GAP-AUDIT 2.4#101): a 4-step chain for heroes who play in a
 * country that isn't theirs. Category `friends` (it is about finding people).
 *
 * Chain: abroad_lonely → abroad_language → abroad_homesick → abroad_settled
 */
import {
  attr, chain, fans, flags, follow, fx, happy, money, morale, playsAbroad, rel, rep, stress, t, trust, wageX, energy, num, canAfford,
} from '../dsl'
import type { EventDef } from '../types'

export const abroadEvents: EventDef[] = [
  {
    id: 'friends.abroad_lonely',
    category: 'friends',
    weight: 1.6,
    cooldownWeeks: 52,
    maxPerCareer: 2,
    minWeek: 2,
    conditions: ({ state }) => playsAbroad(state),
    title: t('Yabancı Bir Şehirde Yalnız', 'Alone in a Foreign City'),
    text: t(
      '{city}\'deki dairende pazar akşamı. Buzdolabında bir yoğurt, televizyonda anlamadığın bir yarışma programı. Takım grubu konuşuyor ama dilini bilmediğin için sadece emojileri anlıyorsun.',
      'Sunday evening in your flat in {city}. One yoghurt in the fridge, a game show you don\'t understand on TV. The team chat is buzzing but you only understand the emojis.',
    ),
    icon: '🧳',
    choices: [
      {
        label: t('Dil kursuna yazıl', 'Sign up for language classes'),
        effects: () => fx(t('İlk ders: "Merhaba, adım..." Kursta bir kasap, iki öğrenci ve emekli bir dansçı var. Yeni arkadaşlar.', 'Lesson one: "Hello, my name is..." Your classmates: a butcher, two students and a retired dancer. New friends.'), stress(-3), happy(2), flags({ abroad_class: true }), follow(chain('friends.abroad_language', 2))),
      },
      {
        label: t('{mate}\'den şehri gezdirmesini iste', 'Ask {mate} to show you around'),
        effects: () => fx(t('{mate} seni bütün gece şehrin en iyi büfelerine götürdü. Sabah antrenmanı ağırdı ama değdi.', '{mate} took you to every great late-night food stand in town. Morning training was heavy but worth it.'), rel('teammate', 2), happy(4), energy(-6), follow(chain('friends.abroad_language', 2))),
      },
      {
        label: t('Her akşam memleketle görüntülü konuş', 'Video-call home every evening'),
        effects: () => fx(t('{motherName} her aramada yemek tarifi veriyor. Tarifler güzel ama mutfak hâlâ boş.', '{motherName} gives you a recipe on every call. Lovely recipes; the kitchen is still empty.'), rel('mother', 4), stress(-1), happy(-1), follow(chain('friends.abroad_language', 3))),
      },
    ],
  },
  {
    id: 'friends.abroad_language',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Soyunma Odasında Dil Kazası', 'Lost in Translation'),
    text: t(
      'Takım toplantısında hocaya cevap verdin. Herkes güldü. Meğer "teşekkürler hocam" yerine "teşekkürler patatesim" demişsin.',
      'You answered the manager in the team meeting. Everyone laughed. Turns out you said "thank you, my potato" instead of "thank you, boss".',
    ),
    icon: '🥔',
    choices: [
      {
        label: t('Şakaya katıl, lakabı sahiplen', 'Laugh along, own the nickname'),
        effects: () => fx(t('Artık takımda adın "Patates". Formanın arkasına basılmasını istiyorlar.', 'Your squad nickname is now "Potato". They want it printed on your shirt.'), rel('teammate', 5), happy(4), morale(3), follow(chain('friends.abroad_homesick', 4))),
      },
      {
        label: t('Kursu yoğunlaştır, iki katı çalış', 'Double down on lessons'),
        kind: 'certain',
        effects: () => fx(t('Bir ay sonra hocayla taktik konuşabiliyorsun. Hâlâ "patates" kelimesinden kaçıyorsun.', 'A month later you can discuss tactics with the gaffer. You still avoid the word "potato".'), attr('vision', 1), trust(3), stress(2), follow(chain('friends.abroad_homesick', 4))),
      },
      {
        label: t('Çevirmen uygulamasına güven', 'Trust the translation app'),
        effects: () => fx(t('Uygulama hocanın "presle" komutunu "ütüle" diye çevirdi. Antrenman ilginç geçti.', 'The app translated "press high" as "iron the clothes". Training was interesting.'), stress(3), trust(-1), follow(chain('friends.abroad_homesick', 4))),
      },
    ],
  },
  {
    id: 'friends.abroad_homesick',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    vars: ({ state }) => ({ ticket: wageX(state, 0.5, 400) }),
    title: t('Bayram Uzakta', 'A Holiday Far Away'),
    text: t(
      'Memlekette bayram. Ailen sofrada, telefonu masanın ortasına koymuşlar; sen ekrandan herkese el sallıyorsun. Kuzenin elini ekrana uzatıp sana baklava "veriyor".',
      'It\'s a holiday back home. The family is at the table with the phone propped in the middle; you wave from the screen. Your cousin holds baklava up to the camera "for you".',
    ),
    icon: '🏠',
    choices: [
      {
        label: t('Aileni buraya uçur ({ticket:money})', 'Fly the family over ({ticket:money})'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'ticket') * 4),
        lockedHint: t('Bilet parası yetmiyor.', 'Not enough for the tickets.'),
        effects: (ctx) => fx(t('Annen valizde üç kilo kuru dolma getirdi; gümrük memuru da tattı.', 'Mum brought three kilos of stuffed peppers in her suitcase; the customs officer tried one.'), money(-num(ctx, 'ticket') * 4), rel('mother', 8), rel('father', 6), happy(10), stress(-5), follow(chain('friends.abroad_settled', 6))),
      },
      {
        label: t('Takım arkadaşlarına memleket yemeği pişir', 'Cook a taste of home for your teammates'),
        effects: () => fx(t('Mutfak savaş alanına döndü ama sofrada kimse konuşmadı; çünkü herkes yiyordu.', 'The kitchen became a war zone, but nobody talked at dinner: everyone was eating.'), rel('teammate', 6), happy(6), energy(-5), follow(chain('friends.abroad_settled', 6))),
      },
      {
        label: t('Kendini antrenmana ver', 'Lose yourself in training'),
        effects: () => fx(t('Fazladan iki seans. Bacakların güçlendi, kalbin biraz daha yoruldu.', 'Two extra sessions. Legs stronger, heart a little more tired.'), attr('stamina', 1), happy(-4), stress(3), follow(chain('friends.abroad_settled', 6))),
      },
    ],
  },
  {
    id: 'friends.abroad_settled',
    category: 'friends',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: () => true,
    title: t('Burası Artık Ev mi?', 'Is This Home Now?'),
    text: t(
      'Fırıncı seni adınla selamlıyor, otobüs şoförü maç tahmini soruyor, tribün senin için uydurulmuş bir şarkı söylüyor. Bir sabah fark ettin: rüyanı bu dilde gördün.',
      'The baker greets you by name, the bus driver asks for your prediction, the stand sings a song made up just for you. One morning you notice: you dreamt in this language.',
    ),
    icon: '🌇',
    choices: [
      {
        label: t('Kök sal: bu şehir artık evin', 'Put down roots: this city is home'),
        effects: () => fx(t('Mahallenin çocuk takımına forma aldın. Tribün şarkının yeni bir kıtası var.', 'You bought kits for the neighbourhood kids\' team. The stand\'s song has a new verse.'), fans(6), happy(8), rep(1), flags({ abroad_home: true })),
      },
      {
        label: t('{agentName}\'a "memlekete yakın bir kulüp" de', 'Tell {agentName}: "a club closer to home"'),
        effects: () => fx(t('{agentName} not aldı. Burada mutlusun ama kalbin hâlâ ikiye bölünmüş.', '{agentName} made a note. You\'re happy here, but your heart is still split in two.'), rel('agent', 2), happy(2), flags({ wants_home: true })),
      },
    ],
  },
]
