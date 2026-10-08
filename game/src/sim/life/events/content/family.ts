/** Family: parents, siblings, the village — the people who knew you before the badge. */
import {
  boss, canAfford, energy, fatigue, flags, follow, fx, happy, hasFlag, hasRel, money, morale, num, rel, rep, stress, t, chain, trust, wageX, fans, sharp,
} from '../dsl'
import type { EventDef } from '../types'

export const familyEvents: EventDef[] = [
  // ── Chain: parents need help → how it turned out ──
  {
    id: 'family.parents_money',
    category: 'family',
    weight: 1,
    cooldownWeeks: 40,
    conditions: ({ state }) => hasRel(state, 'mother') || hasRel(state, 'father'),
    vars: ({ state }) => ({ amount: wageX(state, 3, 2000) }),
    title: t('Çatı Akıtıyor', 'The Roof Is Leaking'),
    text: t(
      '{motherName} aradı. Önce hava durumundan, sonra komşunun kızının düğününden bahsetti. Ancak yirminci dakikada asıl konuya geldi: evin çatısı akıtıyor, usta {amount:money} istiyor. "Babana söyleme, gururuna dokunur" dedi.',
      "{motherName} calls. First the weather, then the neighbour's daughter's wedding. Twenty minutes in, the real reason: the roof is leaking and the builder wants {amount:money}. \"Don't tell your father, his pride can't take it.\"",
    ),
    icon: '🏠',
    choices: [
      {
        label: t('Hepsini hemen gönder', 'Send the lot, today'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount')),
        lockedHint: t('Hesapta o kadar yok.', "Your account can't cover it."),
        effects: (ctx) =>
          fx(
            t('Para gitti, çatı yapılacak. {motherName} "Allah razı olsun" dedi ve üç kere teşekkür etti.', 'Money sent, roof sorted. {motherName} thanked you three times and blessed you twice.'),
            money(-num(ctx, 'amount')),
            rel('mother', 14),
            happy(4),
            flags({ parents_help: 'full' }),
            follow(chain('family.parents_money_outcome', 3)),
          ),
      },
      {
        label: t('Yarısını gönder, gerisine söz ver', 'Send half, promise the rest'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'amount') / 2),
        lockedHint: t('Yarısı bile zor.', 'Even half is a stretch.'),
        effects: (ctx) =>
          fx(
            t('Usta yarım parayla yarım çatı yapmaz ama bekleyecek. Annen idare eder.', "The builder won't do half a roof for half the money, but he'll wait. Mum will manage."),
            money(-Math.round(num(ctx, 'amount') / 2)),
            rel('mother', 6),
            stress(3),
            flags({ parents_help: 'half' }),
            follow(chain('family.parents_money_outcome', 3)),
          ),
      },
      {
        label: t('İzin gününde kendin tamir et', 'Fix it yourself on your day off'),
        hint: t('Ucuz ama yorucu. Babanla da çalışacaksın.', "Cheap but tiring. And you'll be working alongside Dad."),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(
                t('Babanla çatıda bir gün. Yıllardır bu kadar konuşmamıştınız. Çatı da sağlam.', 'A day on the roof with your dad. You haven\'t talked this much in years. The roof holds, too.'),
                energy(-15),
                fatigue(8),
                rel('father', 15),
                rel('mother', 8),
                flags({ parents_help: 'diy' }),
                follow(chain('family.parents_money_outcome', 3)),
              )
            : fx(
                t('Kiremit kaydı, bileğin burkuldu. Çatı hâlâ akıtıyor, hoca da "Ne işin vardı çatıda?" diye soruyor.', 'A tile slipped and so did you. Twisted ankle, still-leaking roof, and a coach asking what on earth you were doing up there.'),
                energy(-15),
                fatigue(12),
                sharp(-6),
                trust(-3),
                rel('father', 6),
              ),
      },
      {
        label: t('Şu an olmaz, de', '"I can\'t right now"'),
        effects: () =>
          fx(t('"Tamam evladım, sen dert etme" dedi. Edeceksin.', '"Of course, love, don\'t you worry." You will worry.'), rel('mother', -10), stress(6), happy(-3)),
      },
    ],
  },
  {
    id: 'family.parents_money_outcome',
    category: 'family',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'father') || hasRel(state, 'mother'),
    title: t('Babanın Gururu', "Dad's Pride"),
    text: t(
      '{fatherName} her şeyi öğrenmiş. Telefonu açtığında sesi ciddi: "{g:Oğlum|Kızım}, borcumu taksit taksit ödeyeceğim. Tartışma yok."',
      '{fatherName} found out. His voice is stern on the phone: "I\'m paying you back in instalments. No arguments."',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Kabul et, gururu kırılmasın', 'Accept, let him keep his pride'),
        effects: (ctx) =>
          fx(
            t('Her ay küçük bir havale geliyor, açıklamasında "Kira değil, borç" yazıyor.', 'Every month a small transfer arrives, reference: "Not charity. A debt."'),
            money(Math.round(num(ctx, 'amount') / 4)),
            rel('father', 10),
            rel('mother', -3),
          ),
      },
      {
        label: t('"Baba, sen beni büyüttün. Ödeşmek yok."', '"Dad, you raised me. We\'re square."'),
        effects: (_ctx, rng) =>
          rng.chance(0.6)
            ? fx(t('Uzun bir sessizlik. Sonra "Peki" dedi, sesi titriyordu.', 'A long silence. Then "Alright," voice cracking.'), rel('father', 14), happy(6))
            : fx(t('"Ben kimseden sadaka almam!" Telefon suratına kapandı. Annen arada kaldı.', '"I don\'t take handouts!" He hung up. Mum is stuck in the middle.'), rel('father', -8), rel('mother', 4), stress(4)),
      },
      {
        label: t('Karşılığında maça gelmesini iste', 'Ask him to come to a match instead'),
        effects: () =>
          fx(
            t('Tribünde, eski atkısıyla. Golünden sonra ilk baktığın yer orası oldu.', 'In the stands, in his old scarf. After your next goal, that\'s the first place you looked.'),
            rel('father', 12),
            morale(6),
            happy(4),
          ),
      },
    ],
  },

  // ── Chain: father's health ──
  {
    id: 'family.father_checkup',
    category: 'family',
    weight: 0.8,
    cooldownWeeks: 60,
    conditions: ({ state }) => hasRel(state, 'father') && !hasFlag(state, 'father_health_scare'),
    vars: ({ state }) => ({ clinic: wageX(state, 2, 1500) }),
    title: t('Babanın Göğsü', "Dad's Chest Pains"),
    text: t(
      '{siblingName} fısıldayarak aradı: "Babam iki haftadır göğsüm sıkışıyor diyor ama doktora gitmiyor. Senin sözünü dinler."',
      '{siblingName} calls in a whisper: "Dad\'s had chest pains for two weeks and won\'t see a doctor. He\'ll listen to you."',
    ),
    icon: '❤️',
    choices: [
      {
        label: t('Özel klinikte tam check-up ayarla', 'Book a full private check-up'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'clinic')),
        lockedHint: t('Özel klinik bütçeni aşıyor.', 'A private clinic is beyond you right now.'),
        effects: (ctx) =>
          fx(
            t('Erken yakalandı: damarlarda daralma var, ilaçla kontrol altında. Doktor "İyi ki geldiniz" dedi.', 'Caught early: narrowed arteries, manageable with medication. The doctor says it was a good call.'),
            money(-num(ctx, 'clinic')),
            rel('father', 10),
            rel('sibling', 6),
            flags({ father_health_scare: true }),
            follow(chain('family.father_recovery', 2)),
          ),
      },
      {
        label: t('Antrenmanı ekip onu hastaneye kendin götür', 'Skip training and take him yourself'),
        effects: (_ctx, rng) =>
          fx(
            t('Hastane koridorunda dört saat. Babanla bekleme salonunda eski maçları konuştunuz. Hoca boş yerine baktı.', 'Four hours in a hospital corridor talking about old matches. The coach stared at your empty spot.'),
            rel('father', 14),
            trust(-4),
            boss(-3),
            flags({ father_health_scare: true }),
            follow(chain(rng.chance(0.35) ? 'family.father_surgery' : 'family.father_recovery', 2)),
          ),
      },
      {
        label: t('Telefonda ısrar et', 'Nag him over the phone'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          fx(
            t('"Tamam, giderim, uzatma!" Gidecek mi? Muhtemelen. Belki.', '"Fine, I\'ll go, stop going on!" Will he? Probably. Maybe.'),
            rel('father', -3),
            stress(4),
            flags({ father_health_scare: true }),
            follow(chain(rng.chance(0.55) ? 'family.father_surgery' : 'family.father_recovery', 3)),
          ),
      },
      {
        label: t('"Babam güçlüdür, abartmayın"', '"He\'s tough, don\'t overreact"'),
        risk: 'high',
        effects: (_ctx, rng) =>
          fx(
            t('{siblingName} sustu. Bu sessizlik hiç hoşuna gitmedi.', '{siblingName} went quiet. You did not like that silence.'),
            rel('sibling', -10),
            flags({ father_health_scare: true }),
            follow(chain(rng.chance(0.85) ? 'family.father_surgery' : 'family.father_recovery', 3)),
          ),
      },
    ],
  },
  {
    id: 'family.father_surgery',
    category: 'family',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'father'),
    vars: ({ state }) => ({ surgeon: wageX(state, 5, 6000) }),
    title: t('Ameliyat Günü', 'Surgery Day'),
    text: t(
      '{fatherName} acil bypass ameliyatına alınıyor. Ameliyat saati, maçın başlama saatiyle aynı. {motherName} "Sen işine bak" diyor ama sesi öyle demiyor.',
      '{fatherName} is going in for emergency bypass surgery. Same time as kick-off. {motherName} says "You do your job," but her voice says something else.',
    ),
    icon: '🏥',
    choices: [
      {
        label: t('Maçı bırak, hastaneye git', 'Miss the match, go to the hospital'),
        effects: () =>
          fx(
            t('Ameliyat başarılı. Gözünü açtığında ilk gördüğü sendin. Hoca anlayışlı davrandı, kulüp başkanı pek değil.', 'Surgery went well. You were the first face he saw. The coach understood; the chairman less so.'),
            rel('father', 20),
            rel('mother', 15),
            trust(-5),
            rel('chairman', -4),
            happy(4),
            follow(chain('family.father_recovery', 2)),
          ),
      },
      {
        label: t('Oyna ve golü ona adamaya çalış', 'Play, and try to score for him'),
        risk: 'high',
        effects: (_ctx, rng) =>
          rng.chance(0.45)
            ? fx(
                t('Golü attın, formayı kaldırdın: altında "Dayan baba" yazıyordu. Bütün stat ayağa kalktı.', 'You scored and lifted your shirt: "Hold on, Dad" underneath. The whole stadium rose.'),
                rel('father', 12),
                rep(3),
                fans(8),
                morale(6),
                follow(chain('family.father_recovery', 2)),
              )
            : fx(
                t('Aklın hastanedeydi, ayakların sahada. Kötü bir maç. Neyse ki ameliyat iyi geçti.', 'Your head was at the hospital, your feet on the pitch. A poor game. Thankfully the surgery went fine.'),
                stress(12),
                morale(-5),
                rel('mother', -4),
                follow(chain('family.father_recovery', 2)),
              ),
      },
      {
        label: t('En iyi cerrahı getirt, masrafı sen karşıla', 'Fly in the top surgeon, on you'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'surgeon')),
        lockedHint: t('Ünlü cerrahlar ucuz değil.', 'Star surgeons are not cheap.'),
        effects: (ctx) =>
          fx(
            t('Para konuştu, cerrah geldi. Sen de maça rahat bir kafayla çıkabildin.', 'Money talked, the surgeon came, and you could play with a clear head.'),
            money(-num(ctx, 'surgeon')),
            rel('father', 10),
            rel('mother', 8),
            stress(-4),
            follow(chain('family.father_recovery', 2)),
          ),
      },
    ],
  },
  {
    id: 'family.father_recovery',
    category: 'family',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'father'),
    title: t('Yasaklı Kebap', 'The Forbidden Kebab'),
    text: t(
      '{fatherName} toparlanıyor ama doktorun diyet listesini "tavsiye" olarak yorumluyor. Annen seni aradı: "Gel de şuna bir şey söyle."',
      '{fatherName} is recovering but treats the diet sheet as "suggestions". Mum rang: "Come and say something to him."',
    ),
    icon: '🥗',
    choices: [
      {
        label: t('Haftada iki gün onunla yürüyüşe çık', 'Walk with him twice a week'),
        effects: () => fx(t('Sahil yolunda yürüyüşler. Baban yine ağır ağır gülüyor.', 'Seaside walks. Dad is laughing again, slowly.'), energy(-8), rel('father', 12), happy(6), stress(-4)),
      },
      {
        label: t('Kulübün diyetisyenini rica et', "Borrow the club's nutritionist"),
        effects: () =>
          fx(
            t('Diyetisyen bir hafta sonra "Hayatımın en zor danışanı" dedi. Ama işe yaradı.', 'A week later the nutritionist called him "the toughest client of my career". It worked, though.'),
            rel('father', 6),
            rel('mother', 10),
            boss(-2),
          ),
      },
      {
        label: t('Bir kebaba göz yum, moral de önemli', 'Allow one kebab — morale matters'),
        risk: 'medium',
        effects: (_ctx, rng) =>
          rng.chance(0.7)
            ? fx(t('{g:Baba-oğul|Baba-kız} gizli kebap operasyonu. Annen hâlâ bilmiyor.', 'A secret {g:father-son|father-daughter} kebab mission. Mum still doesn\'t know.'), rel('father', 15), rel('mother', -2), happy(5))
            : fx(t('Annen yakaladı. İkinize de bir hafta konuşmadı.', 'Mum caught you both. Neither of you was spoken to for a week.'), rel('father', 8), rel('mother', -12), stress(5)),
      },
    ],
  },

  // ── Chain: sibling's trial ──
  {
    id: 'family.sibling_trial',
    category: 'family',
    weight: 1,
    cooldownWeeks: 52,
    conditions: ({ state }) => hasRel(state, 'sibling') && !hasFlag(state, 'sibling_trial_done'),
    vars: ({ state }) => ({ academy: wageX(state, 4, 3000) }),
    title: t('Kardeşin de Futbolcu Olmak İstiyor', 'Your Sibling Wants In'),
    text: t(
      '{siblingName} bir alt lig takımının seçmelerine çağrıldı. "Ben de senin gibi olmak istiyorum" dedi. Bu cümle hem gurur verici hem korkutucu.',
      '{siblingName} got invited to a lower-league trial. "I want to be like you." Flattering and terrifying in one sentence.',
    ),
    icon: '👟',
    choices: [
      {
        label: t('Menajerine bir telefon açtır', 'Have your agent make a call'),
        hint: t('Torpil kokabilir.', 'Might smell of string-pulling.'),
        risk: 'medium',
        requires: ({ state }) => !!state.life.agent,
        lockedHint: t('Bir menajerin yok.', 'You have no agent.'),
        effects: () =>
          fx(
            t('{agentName} "Bir bakarım" dedi. Kulüp artık {siblingName} ismini biliyor.', '{agentName} promised to "take a look". The club now knows the name {siblingName}.'),
            rel('agent', -4),
            rel('sibling', 10),
            flags({ sibling_trial_help: 'agent', sibling_trial_done: true }),
            follow(chain('family.sibling_trial_result', 2, { trialOdds: 60 })),
          ),
      },
      {
        label: t('İzin gününde birlikte çalışın', 'Train together on your rest day'),
        effects: () =>
          fx(
            t('Sabah 7, boş saha, iki kardeş. Ona bildiğin her şeyi gösterdin; sen de bir şeyler hatırladın.', '7am, empty pitch, two siblings. You taught everything you know and remembered a few things yourself.'),
            energy(-15),
            fatigue(10),
            rel('sibling', 15),
            happy(5),
            flags({ sibling_trial_help: 'train', sibling_trial_done: true }),
            follow(chain('family.sibling_trial_result', 2, { trialOdds: 50 })),
          ),
      },
      {
        label: t('Özel akademi parasını sen öde', 'Pay for a private academy'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'academy')),
        lockedHint: t('Akademi ücreti fazla.', "Academy fees are too steep."),
        effects: (ctx) =>
          fx(
            t('Profesyonel koçlar, video analiz, hatta beslenme planı. {siblingName} hazır görünüyor.', 'Pro coaches, video analysis, even a meal plan. {siblingName} looks ready.'),
            money(-num(ctx, 'academy')),
            rel('sibling', 12),
            rel('mother', 5),
            flags({ sibling_trial_help: 'academy', sibling_trial_done: true }),
            follow(chain('family.sibling_trial_result', 2, { trialOdds: 70 })),
          ),
      },
      {
        label: t('Dürüst ol: "Önce okulunu bitir"', 'Be honest: "Finish your studies first"'),
        effects: () =>
          fx(
            t('Annen sana minnettar. {siblingName} ise kapıyı biraz sert kapattı.', 'Mum is grateful. {siblingName} closed the door a little too hard.'),
            rel('sibling', -12),
            rel('mother', 8),
            flags({ sibling_trial_done: true }),
          ),
      },
    ],
  },
  {
    id: 'family.sibling_trial_result',
    category: 'family',
    weight: 1,
    cooldownWeeks: 0,
    followUpOnly: true,
    conditions: ({ state }) => hasRel(state, 'sibling'),
    title: t('Seçme Sonuçları', 'Trial Results'),
    text: t(
      'Seçmeler bitti. {siblingName} arıyor; sesinden ne olduğu anlaşılmıyor.',
      'The trial is over. {siblingName} is calling; you can\'t read anything in the voice.',
    ),
    icon: '📞',
    choices: [
      {
        label: t('"Söyle hadi, çatlatma!"', '"Just tell me!"'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(num(ctx, 'trialOdds') / 100 || 0.5)
            ? fx(
                t('KABUL EDİLDİ! İkiniz de telefonda bağırdınız. Komşular polisi arayacaktı.', 'SIGNED! You both screamed down the phone. The neighbours nearly called the police.'),
                rel('sibling', 15),
                happy(10),
                rel('mother', 8),
                flags({ sibling_pro: true }),
              )
            : fx(
                t('Olmamış. "Belki de senin gibi değilim" dedi. O cümle kulağında kaldı.', 'Not this time. "Maybe I\'m just not you." That line stays with you.'),
                rel('sibling', 4),
                happy(-6),
                stress(4),
              ),
      },
      {
        label: t('"Ne olursa olsun seninle gurur duyuyorum" diye başla', 'Start with "I\'m proud of you either way"'),
        effects: (ctx, rng) =>
          rng.chance(num(ctx, 'trialOdds') / 100 || 0.5)
            ? fx(t('"Ama alındım!" Gülüşmeler, gözyaşları. Ailenin ikinci futbolcusu yolda.', '"But I got in!" Laughter, tears. Family footballer number two is on the way.'), rel('sibling', 18), happy(10), flags({ sibling_pro: true }))
            : fx(
                t('Alınmamış ama söylediğin söz iyi geldi. Yarın yeniden denemeye karar verdi.', "Didn't make it, but your words landed. Already planning the next trial."),
                rel('sibling', 12),
                happy(-2),
              ),
      },
    ],
  },

  // ── Standalone ──
  {
    id: 'family.mother_birthday',
    category: 'family',
    weight: 1,
    cooldownWeeks: 52,
    conditions: ({ state }) => hasRel(state, 'mother'),
    vars: ({ state }) => ({ gift: wageX(state, 1.5, 500) }),
    title: t('Annenin Doğum Günü', "Mum's Birthday"),
    text: t(
      'Takvim acı acı hatırlatıyor: bugün {motherName} için önemli bir gün. Ve yarın da deplasman var.',
      'Your calendar pings guiltily: it\'s {motherName}\'s birthday today. And there\'s an away trip tomorrow.',
    ),
    icon: '🎂',
    choices: [
      {
        label: t('Akşam uçağıyla eve uç, sabah dön', 'Fly home for dinner, back by morning'),
        effects: () =>
          fx(
            t('Mumları birlikte üflediniz. Uçakta iki saat uyuyabildin.', 'You blew out the candles together. You got two hours of sleep on the plane.'),
            rel('mother', 15),
            happy(8),
            fatigue(12),
            sharp(-4),
            trust(-2),
          ),
      },
      {
        label: t('Gösterişli bir hediye yolla', 'Send something spectacular'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'gift')),
        lockedHint: t('Bu ay kemer sıkıyorsun.', 'Belt-tightening month.'),
        effects: (ctx) =>
          fx(
            t('Hediye harikaydı. Annen bütün mahalleye gösterdi. Ama telefonda "Keşke sen gelseydin" dedi.', 'The gift was gorgeous; the whole street has seen it. On the phone: "I\'d rather have had you."'),
            money(-num(ctx, 'gift')),
            rel('mother', 7),
          ),
      },
      {
        label: t('Takımla görüntülü "İyi ki doğdun" söyle', 'Get the squad to sing on a video call'),
        effects: () =>
          fx(
            t('Yirmi futbolcu, sıfır nota. Annen gülmekten ağladı; video aile grubunda rekor kırdı.', 'Twenty footballers, zero pitch accuracy. Mum cried laughing; the clip broke records in the family group chat.'),
            rel('mother', 10),
            rel('teammate', 2),
            happy(4),
          ),
      },
    ],
  },
  {
    id: 'family.grandma_village',
    category: 'family',
    weight: 0.9,
    cooldownWeeks: 52,
    conditions: () => true,
    vars: ({ state }) => ({ pitch: wageX(state, 6, 5000) }),
    title: t('Köyden Davet', 'Summoned to the Village'),
    text: t(
      'Babaannen kesin konuştu: "Bütün köy seni soruyor. Muhtar yeni sahayı senin açmanı istiyor. Gelmezsen gelmeyiver." Bu son cümle bir tehdittir.',
      'Grandma was clear: "The whole village asks after you. The headman wants you to open the new pitch. If you don\'t come, don\'t come." That last line is a threat.',
    ),
    icon: '🌾',
    choices: [
      {
        label: t('Hafta sonu köye git', 'Go for the weekend'),
        effects: () =>
          fx(
            t('Kurdele kesildi, üç kuzu yendi, yüz fotoğraf çekildi. Babaannen herkese "Benim torunum" dedi.', 'Ribbon cut, three lambs eaten, a hundred selfies taken. Grandma introduced you to everyone. Twice.'),
            energy(-10),
            fatigue(6),
            happy(10),
            rel('mother', 6),
            rel('father', 6),
            rep(1),
          ),
      },
      {
        label: t('Sahanın ışıklarını sen bağışla', 'Pay for the pitch floodlights'),
        requires: (ctx) => canAfford(ctx.state, num(ctx, 'pitch')),
        lockedHint: t('Işıklar pahalı.', 'Floodlights are pricey.'),
        effects: (ctx) =>
          fx(
            t('Sahanın adı artık senin adın. Babaannen "Ama sen de gelecektin" diye ekledi.', 'The pitch now bears your name. Grandma added: "You were supposed to come too, though."'),
            money(-num(ctx, 'pitch')),
            rep(2),
            rel('father', 4),
            happy(4),
          ),
      },
      {
        label: t('"Yazın kesin gelirim" diye söz ver', 'Promise you\'ll come in summer'),
        effects: () =>
          fx(t('Babaannen bu sözü deftere yazdı. Gerçekten bir defteri var.', 'Grandma wrote the promise in her notebook. She genuinely has a notebook.'), rel('father', -4), stress(3), flags({ grandma_promise: true })),
      },
    ],
  },
]
