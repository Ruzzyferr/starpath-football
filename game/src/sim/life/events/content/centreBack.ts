/**
 * Centre-back story cards (Tur 3b): the central defender's career had only the
 * generic deck. These are the moments of the job: marking duels against famous
 * strikers, leading the back line, set-piece goals, red-card controversies and
 * defensive awards, plus a three-step chain built on the pass network that the
 * match engine records in every match (`g:links`, see game/passLinks.ts).
 *
 * Chains:
 * - Striker duel: rivals.cb_marking_duel → rivals.cb_marking_tunnel (rematch talk)
 * - Red card: press.cb_red_card_row → press.cb_red_card_hearing
 * - Pass link: teammates.cb_link_noticed → teammates.cb_link_routine → teammates.cb_link_signature
 */
import type { GameState } from '../../../../core/types'
import { readJson } from '../../../game/internal'
import { LAST_MATCH_FLAG, type MatchFeats } from '../../../game/records'
import { topPassLink } from '../../../game/passLinks'
import {
  age, attr, boss, canAfford, chain, disc, fans, flags, fol, follow, form, fx, happy, hasClub, money, morale, news, press, rel, relId, rep, sharp, stress, t, trust,
} from '../dsl'
import type { EventCtx, EventDef } from '../types'

const isCb = (s: GameState): boolean => s.hero.position === 'CB' && hasClub(s)
const lastMatch = (s: GameState): MatchFeats | null => readJson<MatchFeats | null>(s.life, LAST_MATCH_FLAG, null)
const starter = (s: GameState): boolean => {
  const r = s.hero.contract?.role
  return r === 'starter' || r === 'star' || r === 'captain'
}

/** The best striker in the world that does not play for the hero's club (the face of the marking duels). */
function starStriker(s: GameState): string {
  const mine = s.hero.contract?.clubId
  let best: { name: string; ovr: number; id: string } | null = null
  for (const p of Object.values(s.world.players)) {
    if (p.position !== 'ST' || p.clubId === mine || !p.clubId) continue
    if (!best || p.ovr > best.ovr || (p.ovr === best.ovr && p.id < best.id)) best = { name: `${p.firstName} ${p.lastName}`, ovr: p.ovr, id: p.id }
  }
  return best?.name ?? 'Marco Reyes'
}

/** Bond change with the team-mate a chain is about (falls back to the whole squad when the id is missing). */
const bond = (c: EventCtx, key: string, n: number) => {
  const id = String(c.vars[key] ?? '')
  return id ? relId(id, n) : rel('teammate', Math.round(n / 3))
}

export const centreBackEvents: EventDef[] = [
  // ───────────── Marking duels (chain) ─────────────
  {
    id: 'rivals.cb_marking_duel', category: 'rivals', weight: 1.4, cooldownWeeks: 40, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && starter(state) && state.hero.reputation >= 35,
    vars: ({ state }) => ({ striker: starStriker(state) }),
    title: t('Hafta Sonu: {striker} Karşında', 'Weekend Duel: {striker} Awaits'),
    text: t(
      'Hafta sonu {striker} geliyor; son beş maçta yedi gol attı. Hoca antrenmanda kolunu omzuna attı: "Bu hafta bütün oyun senin üzerinden geçecek. Adamı tek parça ve golsüz geri yolla." Video analizinde adamın her hareketi dilimlenmiş durumda.',
      '{striker} is coming this weekend, seven goals in the last five games. The manager put an arm round your shoulder in training: "Everything goes through you this week. Send him home in one piece and without a goal." The video analysis has sliced up his every move.',
    ),
    icon: '🧱',
    choices: [
      { label: t('Gece boyu video izle', 'Study the footage all night'), effects: () => fx(t('Sol ayağına çıkmadan önce hep bir adım atıyor. Bunu fark ettin ve notlarını sabaha kadar kâğıda döktün.', 'Before cutting onto his left he always takes a half-step. You spotted it and wrote the notes down until dawn.'), attr('positioning', 1), sharp(3), stress(3), follow(chain('rivals.cb_marking_tunnel', 1))) },
      { label: t('Önceden yaklaş, fiziksel oyna', 'Get tight early and play it physical'), risk: 'medium', effects: () => fx(t('İlk dakikada sert girdin, hakem sözlü uyardı. Forvet sinirlendi ve oyundan düştü. Ama kartın ucundan döndün.', 'You went in hard in the first minute and the referee gave a verbal warning. The striker got rattled and faded. But you were a whisker from a card.'), attr('tackling', 1), disc(-2), morale(3), follow(chain('rivals.cb_marking_tunnel', 1))) },
      { label: t('Ona hiç bakma, bölgeni koru', 'Ignore him; hold your zone'), effects: () => fx(t('"Adam değil, alan" dedin. Beklenenden sakin bir maç geçirdin ve gol yemedin.', '"Space, not the man," you said. A calmer match than expected and no goal conceded.'), attr('positioning', 1), morale(2), follow(chain('rivals.cb_marking_tunnel', 1))) },
    ],
  },
  {
    id: 'rivals.cb_marking_tunnel', category: 'rivals', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => isCb(state),
    vars: ({ state }) => ({ striker: starStriker(state) }),
    title: t('Tünelde Kısa Sohbet', 'A Few Words in the Tunnel'),
    text: t(
      'Maçtan sonra tünelde {striker} yanına geldi. Terli, yorgun, ama gülümsüyor: "Bütün gece sırtımdaydın. Böyle savunmacıyla yıllardır oynamamıştım. Formanı değişelim mi?" Kameralar uzakta; ikiniz de biliyorsunuz bu an yarın konuşulacak.',
      'After the match {striker} found you in the tunnel. Sweaty, tired, smiling: "You were on my back all night. I haven’t played against a defender like you in years. Swap shirts?" The cameras are far away; you both know this moment will be talked about tomorrow.',
    ),
    icon: '🤝',
    choices: [
      { label: t('Formayı değiş', 'Swap shirts'), effects: () => fx(t('Fotoğraf sosyal medyada bir saatte patladı: "Saygı". Taraftar da, basın da bayıldı.', 'The photo exploded online within an hour: "Respect." Fans and press both loved it.'), fans(5), press(4), rep(1), happy(5)) },
      { label: t('Nazikçe reddet: "Önce şampiyonluk"', 'Politely decline: "Title first"'), effects: () => fx(t('Gülüp geçti ama bakışı sertleşti. Önümüzdeki maçta daha da sinirli olacak.', 'He laughed it off but his look hardened. He will be edgier next time.'), disc(1), morale(1), boss(2)) },
      { label: t('Kulağına eğil: "Rövanşta golü atamazsın"', 'Lean in: "You won’t score in the rematch either"'), risk: 'medium', effects: () => fx(t('Laf tünelde kalmadı, bir kameraman duymuş. Başlık ertesi sabah hazırdı.', 'The words did not stay in the tunnel; a cameraman heard. The headline was ready by morning.'), press(3), fans(3), disc(-2), news(t('{heroName} forvete meydan okudu: "Rövanşta da yok"', '{heroName} to striker: "Not in the rematch either"'), 0)) },
    ],
  },
  {
    id: 'club.cb_derby_marking_plan', category: 'club', weight: 1, cooldownWeeks: 52, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && starter(state) && state.hero.reputation >= 30,
    title: t('Derbi Haftası Planı', 'Derby Week Plan'),
    text: t(
      'Derbi haftası. Hoca üçlü bir savunma planı çiziyor; yalnız bir sorun var: rakibin iki hızlı forveti ortada koşu yapıyor. Sana sormadan karar vermek istemiyor: "Sen ne diyorsun?"',
      'Derby week. The manager is sketching a defensive plan; one problem: the opposition’s two quick forwards run in behind through the middle. He does not want to decide without you: "What do you say?"',
    ),
    icon: '🔥',
    choices: [
      { label: t('Çizgiyi geriye çek', 'Drop the line deep'), effects: () => fx(t('Derin savundunuz, koşular sönükleşti. Taraftar "pasif" dedi ama skor sizdeydi.', 'You defended deep and the runs fizzled. Fans called it passive, but the score was yours.'), boss(3), trust(2), fans(-1)) },
      { label: t('Yüksek çizgi, ofsayt tuzağı', 'High line with an offside trap'), risk: 'high', effects: () => fx(t('Üç ofsayt, bir kaçış. Ama bir kez yakalandın. Soyunma odası seni alkışladı, hoca ise yüz buruşturdu.', 'Three offsides, one escape. You were caught once. The dressing room applauded you; the manager winced.'), attr('positioning', 1), morale(4), boss(-1)) },
      { label: t('Hocaya bırak', 'Leave it to the manager'), effects: () => fx(t('Hoca kararı verdi; uygulayacağın görev net. Derbiden önce kafan rahat.', 'The manager made the call; your job is clear. A clear head before the derby.'), stress(-2), trust(1)) },
    ],
  },

  // ───────────── Leading the back line ─────────────
  {
    id: 'teammates.cb_backline_leader', category: 'teammates', weight: 1.3, cooldownWeeks: 36, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && starter(state) && state.hero.attrs.leadership >= 45,
    title: t('Dörtlü Savunma Sana Bakıyor', 'The Back Four Looks to You'),
    text: t(
      'Son üç maçta yediğiniz goller aynı hatadan geldi: iki bek yukarı çıkarken orta saha boşluğu kapatmıyor. Soyunma odasında savunmacılar sana bakıyor. Hoca sessiz; bunu çözecek kişi sensin.',
      'The goals you conceded in the last three games came from the same flaw: the two full-backs push on and midfield does not cover the gap. In the dressing room the defenders are looking at you. The manager is silent; you are the one to fix it.',
    ),
    icon: '🗣️',
    choices: [
      { label: t('Sahada sürekli bağır, yönet', 'Shout and organise all game'), effects: () => fx(t('Sesin kısıldı ama hatlar daraldı. Rakibin sağdan gelişen hücumları kesildi.', 'Your voice went hoarse but the lines tightened. The opposition’s moves down the right dried up.'), attr('leadership', 1), attr('positioning', 1), rel('teammate', 3), stress(2)) },
      { label: t('Antrenmandan sonra beklerle konuş', 'Talk to the full-backs after training'), effects: () => fx(t('Beklerle yarım saat konuştunuz. Biri ilk defa hatasını kabul etti; ikinci gün düzen oturdu.', 'You spent half an hour with the full-backs. One admitted his mistake for the first time; by day two the shape had settled.'), rel('teammate', 5), attr('leadership', 1), boss(2)) },
      { label: t('Tahtaya çiz, video göster', 'Draw it up and show the video'), effects: () => fx(t('Sessiz bir toplantı oldu ama herkes notunu aldı. Hoca köşeden başını salladı.', 'A quiet meeting, but everyone took notes. The manager nodded from the corner.'), boss(4), trust(2), attr('vision', 1)) },
    ],
  },
  {
    id: 'teammates.cb_young_partner', category: 'teammates', weight: 1.1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => isCb(state) && starter(state) && age(state) >= 24,
    vars: ({ state }) => {
      const kid = Object.values(state.life.relationships).find((r) => r.kind === 'teammate' && r.npcId && state.world.players[r.npcId] && state.calendar.season - state.world.players[r.npcId]!.birthYear <= 20 && state.world.players[r.npcId]!.position === 'CB')
      return { kid: kid?.name ?? 'Yeni stoper', kidId: kid?.id ?? '' }
    },
    title: t('Yeni Stoper Ortağın', 'Your New Centre-Back Partner'),
    text: t(
      '{kid} yirmisine basmadan ilk 11’e girdi ve hoca onu yanına yerleştirdi. İlk antrenmanda üç kere yanlış ayakla çıktı. Senden bir şeyler öğrenmek istiyor ama sormaya utanıyor.',
      '{kid} broke into the starting eleven before turning twenty and the manager has put him next to you. In the first session he stepped out on the wrong foot three times. He wants to learn from you but is too shy to ask.',
    ),
    icon: '🧑‍🏫',
    choices: [
      { label: t('Her antrenmanda yanında dur', 'Stay by his side in every session'), effects: (c) => fx(t('İkinci haftada {kid} senden önce çizgiyi tutmaya başladı. Artık sana soru sormuyor, ağzını açmadan anlaşıyorsunuz.', 'By week two {kid} was holding the line before you did. He no longer asks; you read each other without a word.'), bond(c, 'kidId', 8), attr('leadership', 1), happy(4), stress(1)) },
      { label: t('Ona bir öğrenme planı hazırla', 'Draft a learning plan for him'), effects: (c) => fx(t('Haftalık üç video, iki ikili çalışma. {kid} defterine her şeyi yazıyor.', 'Three videos a week, two paired sessions. {kid} writes it all in his notebook.'), bond(c, 'kidId', 5), boss(3), sharp(1)) },
      { label: t('Kendi işine bak, o öğrenir', 'Mind your own game; he’ll learn'), effects: (c) => fx(t('{kid} kendi başına yolunu buldu, ama aranızdaki bağ ince kaldı.', '{kid} found his own way, but the bond between you stayed thin.'), bond(c, 'kidId', -2), morale(1)) },
    ],
  },
  {
    id: 'club.cb_captaincy_back_line', category: 'club', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => isCb(state) && state.hero.contract?.role === 'captain',
    title: t('Pazubantlı Stoper', 'The Captain at the Back'),
    text: t(
      'Bir kaptan genellikle ortada ya da önde olur; sen stoperden yönetiyorsun. Gazeteler "sahanın arkasından konuşan kaptan" yazıyor. Yeni sezon konuşması: tüm takım sana bakıyor.',
      'A captain is usually in midfield or up front; you lead from centre-back. The papers write "the captain who speaks from behind". Pre-season speech: the whole squad is looking at you.',
    ),
    icon: '©️',
    choices: [
      { label: t('Kısa ve sert konuş', 'Keep it short and fierce'), effects: () => fx(t('"Bu sene kimse bizi geçemeyecek." Soyunma odası ayağa kalktı. İlk antrenman yoğunlaştı.', '"Nobody gets past us this year." The dressing room rose. The first session was electric.'), morale(5), attr('leadership', 1), rel('teammate', 3)) },
      { label: t('Tek tek oyunculara git', 'Go to each player one by one'), effects: () => fx(t('Sabah çaydan akşam yemeğine kadar bütün oyuncularla konuştun. Takım ruhu rafa kalkmadı.', 'From morning tea to dinner you spoke to every player. Team spirit stayed off the shelf.'), rel('teammate', 5), attr('leadership', 2), stress(3)) },
      { label: t('Konuşmayı yardımcına bırak', 'Hand the speech to your deputy'), effects: () => fx(t('Konuşma iyiydi, ama pazubandın ağırlığını kaybettiğini hissettin.', 'The speech was good, but you felt the armband lose some of its weight.'), rel('teammate', 1), morale(-1)) },
    ],
  },

  // ───────────── Set-piece goals ─────────────
  {
    id: 'club.cb_corner_routine', category: 'club', weight: 1.2, cooldownWeeks: 40, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && state.hero.attrs.heading >= 55,
    title: t('Korner Rutini', 'The Corner Routine'),
    text: t(
      'Antrenmanda köşe vuruşu rutini çalışıyorlar. Hoca bir şeyi fark etti: ikinci direkte ona rakip savunmacıların kimse yetişemiyor. "Bu hafta dört kornerde seni ikinci direğe koyacağım. Gelip kafayı vur."',
      'The set-piece coach is drilling corner routines. He has spotted that no defender can match you at the back post. "This week I will put you on the far post for four corners. Come in and head it."',
    ),
    icon: '🎯',
    choices: [
      { label: t('Fazladan kafa çalış', 'Do extra heading work'), effects: () => fx(t('Antrenman sonrası yirmi dakika boyunca ortalar karşısında zıpladın. Boynun ağrıyor ama zamanlaman daha temiz.', 'For twenty minutes after training you leapt for crosses. Your neck aches but the timing is cleaner.'), attr('heading', 1), attr('jumping', 1), sharp(2), stress(1)) },
      { label: t('Kornerciyle zamanlama çalış', 'Rehearse timing with the corner-taker'), effects: () => fx(t('"Sen koş, ben bulayım." Pasör ve sen göz göze anlaştınız.', '"You run, I’ll find you." The taker and you settled it with a glance.'), attr('setPieces', 1), rel('teammate', 3), boss(1)) },
      { label: t('Riskli değil: geride kal', 'Too risky: stay back'), effects: () => fx(t('Savunma kapanmış kaldı, ama hoca planının yarım kaldığını düşündü.', 'The defence stayed locked, but the manager felt his plan was half done.'), boss(-1), trust(-1)) },
    ],
  },
  {
    id: 'fans.cb_header_goal_scene', category: 'fans', weight: 1.6, cooldownWeeks: 20, maxPerCareer: 4, triggers: ['post_match', 'scored'],
    conditions: ({ state }) => {
      const m = lastMatch(state)
      return isCb(state) && !!m && m.headerGoals >= 1
    },
    title: t('Stoperin Golü!', 'The Centre-Back Scores!'),
    text: t(
      'Kornerden yükseldin ve topu tam köşeye gönderdin. Tribünler çıldırdı; kameralar seni takip etti. Gole giderken geriye bakmadan koştun. Şimdi bütün takım üstüne yığıldı.',
      'You rose from the corner and sent the ball into the top corner. The stands went wild; the cameras followed you. You ran without looking back, and now the whole team has piled on top.',
    ),
    icon: '⚽',
    choices: [
      { label: t('Tribüne koş, taraftarla kutla', 'Run to the stands and celebrate with the fans'), effects: () => fx(t('Taraftar adını söylerken ağlamaklı olduk. Defans oyuncusu olmanın en güzel hali.', 'The fans sang your name and you got misty-eyed. The best side of being a defender.'), fans(7), happy(8), rep(1), fol(400)) },
      { label: t('Hemen savunmaya dön', 'Hurry back to defend'), effects: () => fx(t('Bir stoper gol atınca ilk iş yerine dönmek. Hoca bu olgunluğu not etti.', 'When a centre-back scores, the first job is to get back. The manager noted the maturity.'), boss(4), trust(2), attr('composure', 1)) },
      { label: t('Forvet arkadaşlarla dalga geç', 'Joke about stealing the strikers’ job'), effects: () => fx(t('"İşinizi elinizden alıyorum" dedin. Forvetler güldü; biri "Bir daha korner kullanmayın" diye şaka yaptı.', '"I’m taking your jobs," you said. The strikers laughed; one joked, "Stop taking the corners."'), rel('teammate', 3), happy(3)) },
    ],
  },
  {
    id: 'club.cb_free_kick_wall', category: 'club', weight: 0.9, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => isCb(state) && state.hero.attrs.setPieces >= 55,
    title: t('Frikik Duvarı Ya Da Frikik Atıcısı?', 'Free-Kick Wall or Free-Kick Taker?'),
    text: t(
      'Antrenmanın sonunda şaka olsun diye frikik atışı yaptın ve top ağlara gitti. Kaleci bile alkışladı. Hoca kenardan bağırdı: "Cumartesi uzak mesafeli frikikte sen var mısın?"',
      'At the end of training you took a free kick for fun and it flew into the net. Even the keeper applauded. The manager shouted from the side: "Are you in for the long-range free kick on Saturday?"',
    ),
    icon: '🥅',
    choices: [
      { label: t('Evet, bu hafta ben atarım', 'Yes, I’ll take it this week'), risk: 'medium', effects: () => fx(t('İlk denemede duvara çarptı; tribünden "Stoper geri dön" sesleri geldi. Ama top gelecek sefer köşeyi arıyor.', 'The first try hit the wall; from the stands came cries of "Back to defence!" But next time the ball is looking for the corner.'), attr('setPieces', 1), fans(-1), morale(2)) },
      { label: t('Hayır, duvarda durmayı tercih ederim', 'No, I prefer standing in the wall'), effects: () => fx(t('Her şeyin bir yeri var. Sen savunmanın içinde güçlüsün.', 'Everything has its place. You are strongest inside the defence.'), stress(-1), boss(1)) },
    ],
  },

  // ───────────── Red-card controversy (chain) ─────────────
  {
    id: 'press.cb_red_card_row', category: 'press', weight: 2, cooldownWeeks: 30, maxPerCareer: 3, triggers: ['post_match'],
    conditions: ({ state }) => {
      const m = lastMatch(state)
      return isCb(state) && !!m && m.red
    },
    title: t('Kırmızı Kart Tartışması', 'The Red Card Row'),
    text: t(
      'Kırmızı kartı gördüğün anı spor kanalları döne döne gösteriyor. Bir stüdyo konuğu "açık kırmızı" dedi, bir başkası "yarım top, yarım adam" diyor. Hoca soyunma odasında bir şey söylemedi; ama gözlerini kaçırdı.',
      'The sports channels are replaying your red card on a loop. One studio guest called it "clear red", another "half ball, half man". The manager said nothing in the dressing room, but he avoided your eyes.',
    ),
    icon: '🟥',
    choices: [
      { label: t('Hatanı kabul et, takımdan özür dile', 'Own the mistake and apologise to the squad'), effects: () => fx(t('Soyunma odasında ayağa kalkıp "Beni affedin" dedin. Kimse üzerine gelmedi; kaptan sırtına vurdu.', 'You stood up in the dressing room and said, "Forgive me." Nobody piled in; the captain clapped your back.'), rel('teammate', 4), trust(2), disc(2), follow(chain('press.cb_red_card_hearing', 1))) },
      { label: t('Karara itiraz et, video iste', 'Dispute the decision and ask for the video'), risk: 'medium', effects: () => fx(t('Kulüp itiraz dilekçesi verdi. Medya "ya haklı ya da inatçı" diyor.', 'The club filed an appeal. The media say "either right or stubborn".'), press(-2), fans(2), disc(-2), follow(chain('press.cb_red_card_hearing', 1))) },
      { label: t('Sessiz kal, açıklama yapma', 'Stay silent and make no statement'), effects: () => fx(t('Gürültü birkaç gün sürdü, sonra yeni bir futbol hikâyesi başka şeye döndü.', 'The noise lasted a few days, then another football story took over.'), stress(2), press(-1), follow(chain('press.cb_red_card_hearing', 1))) },
    ],
  },
  {
    id: 'press.cb_red_card_hearing', category: 'press', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => isCb(state),
    title: t('Disiplin Kurulu', 'The Disciplinary Hearing'),
    text: t(
      'Disiplin kurulu toplandı. Kulüp avukatı senden yazılı savunma istiyor. Hoca yanına geldi: "Ceza uzarsa ligi kaybedebiliriz. Hazırlıklı ol."',
      'The disciplinary committee has convened. The club lawyer wants a written defence from you. The manager came over: "If the ban gets longer we could lose the league. Be ready."',
    ),
    icon: '⚖️',
    choices: [
      { label: t('Dürüst bir savunma yaz', 'Write an honest defence'), effects: () => fx(t('Net, kısa, abartısız. Kurul ceza süresini kısalttı ve hakem raporunu yeniden değerlendirdi.', 'Clear, short, no spin. The committee shortened the ban and reconsidered the referee report.'), disc(2), trust(2), happy(2)) },
      { label: t('Pahalı bir avukat tut (8K)', 'Hire an expensive lawyer (8K)'), requires: (c) => canAfford(c.state, 8_000), lockedHint: t('Nakdin yetmiyor.', 'Not enough cash.'), effects: () => fx(t('Avukat teknik bir ayrıntı yakaladı; ceza bir maç düştü. Para gitti ama güvence kazandın.', 'The lawyer spotted a technicality; the ban dropped by a match. Money gone, peace of mind earned.'), money(-8_000), disc(1), stress(-2)) },
      { label: t('Cezayı kabul et, sessizce çalış', 'Accept the ban and keep working quietly'), effects: () => fx(t('Cezayı çekerken tek başına ekstra çalıştın. Dönüşte formun yerindeydi.', 'During the ban you worked extra on your own. You came back in shape.'), form(3), sharp(3), disc(2)) },
    ],
  },
  {
    id: 'press.cb_penalty_var', category: 'press', weight: 1.1, cooldownWeeks: 40, maxPerCareer: 3, triggers: ['post_match'],
    conditions: ({ state }) => {
      const m = lastMatch(state)
      return isCb(state) && !!m && !m.red && m.goalsAgainst > 0 && m.rating < 6.1 && state.hero.attrs.tackling >= 40
    },
    title: t('VAR Seni Aradı', 'VAR Called You'),
    text: t(
      'VAR kontrolünden sonra hakem penaltıyı gösterdi; baldırına girişin forvetin ayağına değmişti. Sosyal medya "VAR yine yaptı" ile "stoper aptalca davrandı" arasında bölündü. Soyunma odasında kaleci sana baktı: "Onu çıkarırdım, ama olmadı."',
      'After the VAR check the referee pointed to the spot; your challenge had clipped the striker’s foot. Social media split between "VAR did it again" and "the centre-back was daft". In the dressing room the keeper looked at you: "I would have saved it, but it didn’t work."',
    ),
    icon: '📺',
    choices: [
      { label: t('Sorumluluğu üstlen', 'Take the blame'), effects: () => fx(t('"Hata benimdi, kaleciyi suçlamayın." Soyunma odasında rahatlama oldu; kalecinin gözleri yumuşadı.', '"My mistake; don’t blame the keeper." The dressing room relaxed; the keeper’s eyes softened.'), rel('teammate', 4), disc(1), morale(-1)) },
      { label: t('Kararı sorgula, VAR’ı eleştir', 'Question the call and criticise VAR'), risk: 'medium', effects: () => fx(t('Açıklaman kulübe yarım sayfa ceza notu bıraktı ama taraftarlar seni savundu.', 'Your remarks cost the club half a page of warning notes but the fans defended you.'), fans(4), disc(-2), press(-2)) },
      { label: t('Başını eğ, bir sonraki maça odaklan', 'Head down; focus on the next match'), effects: () => fx(t('Konuşmak yerine antrenmanda iki katı çalıştın.', 'Instead of talking, you worked twice as hard in training.'), sharp(2), stress(1), attr('tackling', 1)) },
    ],
  },

  // ───────────── Defensive honours and reputation ─────────────
  {
    id: 'press.cb_clean_sheet_press', category: 'press', weight: 1.2, cooldownWeeks: 40, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && state.hero.seasonStats.cleanSheets >= 7 && state.hero.seasonStats.apps >= 10,
    vars: ({ state }) => ({ cs: state.hero.seasonStats.cleanSheets }),
    title: t('{cs} Gol Yemeden Maç', '{cs} Clean Sheets'),
    text: t(
      'Sezonda {cs} maçta kalenizi kapattınız. Spor yazarı "Savunmanın mimarı" başlıklı bir röportaj istiyor. Kaleci "bu bizim ortak eserimiz" demek ister ama biraz da kıskanıyor.',
      'You kept {cs} clean sheets this season. A sports writer wants an interview titled "The Architect of the Back Line". The keeper wants to say "this is our joint work" but is a bit jealous.',
    ),
    icon: '📰',
    choices: [
      { label: t('Kalecinin payını öne çıkar', 'Share the credit with the keeper'), effects: () => fx(t('"Kaleci ve bütün savunma bunu yazdı." Kaleci mesaj attı: "Teşekkürler, kardeşim."', '"The keeper and the whole defence wrote it." The keeper messaged: "Thanks, brother."'), rel('teammate', 5), press(3), rep(1)) },
      { label: t('Hocanın planını öv', 'Credit the manager’s plan'), effects: () => fx(t('Hoca röportajı sosyal medyada paylaştı. Kulüp güvenin yükseldi.', 'The manager shared the interview. Your standing at the club rose.'), boss(5), trust(2), press(2)) },
      { label: t('Kendin hakkında konuş, hakkını ver', 'Talk about yourself; you deserve it'), effects: () => fx(t('Röportaj manşet oldu; yorumların yarısı "alçakgönüllü ol" dedi.', 'The interview made the headlines; half the comments said "stay humble".'), rep(2), fol(900), rel('teammate', -2)) },
    ],
  },
  {
    id: 'awards.cb_defender_award', category: 'awards', weight: 2, cooldownWeeks: 52, maxPerCareer: 3, triggers: ['new_season'],
    conditions: ({ state }) => isCb(state) && state.hero.awards.some((a) => a.key === 'defender_of_season' && a.season === state.calendar.season - 1),
    title: t('Yılın Savunmacısı Ödül Töreni', 'The Defender of the Year Gala'),
    text: t(
      'Törende geçen sezonun en iyi savunmacısı olarak adın okundu. Sahneye çıkarken anne babanın gözleri ışıldadı. Mikrofonu eline aldın: kimseyi unutmadan teşekkür etmek istiyorsun.',
      'At the gala your name was read out as last season’s best defender. Your parents’ eyes lit up as you walked on stage. The microphone is in your hand: you want to thank everyone without forgetting anyone.',
    ),
    icon: '🏆',
    choices: [
      { label: t('Bütün savunma hattına teşekkür et', 'Thank the entire back line'), effects: () => fx(t('"Bu ödül dört kişilik." Salon alkışladı; ekip arkadaşlarının hepsi telefondan seni aradı.', '"This award has four names on it." The room applauded; every teammate called you.'), rel('teammate', 5), fans(4), press(3), happy(6)) },
      { label: t('Anne babana ithaf et', 'Dedicate it to your parents'), effects: () => fx(t('Annenin gözleri doldu, baban boğazını temizledi. Fotoğraf anneannenin duvarına asıldı.', 'Your mum teared up, your dad cleared his throat. The photo went on grandma’s wall.'), rel('mother', 6), rel('father', 6), happy(8)) },
      { label: t('Kısa kes, takıma dön', 'Keep it short; back to the team'), effects: () => fx(t('Üç cümle. Hoca gözlerinde gurur olduğunu söylemedi, ama gösterdi.', 'Three sentences. The manager did not say there was pride in his eyes, but he showed it.'), boss(3), trust(2), attr('composure', 1)) },
    ],
  },
  {
    id: 'club.cb_legend_defender_visit', category: 'club', weight: 1, cooldownWeeks: 78, maxPerCareer: 1,
    conditions: ({ state }) => isCb(state) && state.hero.reputation >= 55 && age(state) >= 26,
    title: t('Efsane Stoper Antrenmanda', 'A Legendary Defender at Training'),
    text: t(
      'Kulübün eski kaptanı, yıllarca bu forma altında savunmanın başında duran adam, antrenmanı izlemeye geldi. Bir ara yanına gelip omzuna dokundu: "Seni izledim. Bir şey söylemek istiyorum."',
      'The club’s old captain, the man who led this defence in this shirt for years, came to watch training. At some point he came over and tapped your shoulder: "I have been watching you. I want to tell you something."',
    ),
    icon: '👴',
    choices: [
      { label: t('Dinle, not al', 'Listen and take notes'), effects: () => fx(t('"Bir hücumu durdurmak için topu değil, forvetin niyetini oku." Söz yıllarca kulağında kaldı.', '"To stop an attack, read the striker’s intent, not the ball." The line stayed in your ear for years.'), attr('positioning', 2), attr('vision', 1), happy(4)) },
      { label: t('Birlikte kısa bir idman yap', 'Do a short session together'), effects: () => fx(t('Altmışına yaklaşan eski kaptan, hâlâ ayağa top geldiğinde gençleri azarladı.', 'Closing in on sixty, the old captain still scolded youngsters when the ball came to his feet.'), rel('teammate', 3), attr('tackling', 1), fans(3)) },
      { label: t('Fotoğraf çek, devam et', 'Take a photo and move on'), effects: () => fx(t('Fotoğraf sosyal medyada patladı. Ama belki bir fırsat kaçtı.', 'The photo was a hit online. But maybe a chance slipped by.'), fol(500), fans(2)) },
    ],
  },
  {
    id: 'fans.cb_own_goal_nightmare', category: 'fans', weight: 1, cooldownWeeks: 50, maxPerCareer: 2, triggers: ['post_match'],
    conditions: ({ state }) => {
      const m = lastMatch(state)
      return isCb(state) && !!m && m.goalsAgainst > m.goalsFor && m.rating < 5.8 && m.minutes >= 60
    },
    title: t('Kendi Kalene Gol', 'The Own Goal Nightmare'),
    text: t(
      'Bir ortayı uzaklaştırmaya çalışırken topu kendi ağlarına gönderdin. Maçı bu golle kaybettiniz. Tribünlerden ıslıklar yükseldi, sosyal medyada "stoper hatası" etiketi gündem oldu. Ertesi sabah hâlâ görüntü gözünün önünde.',
      'Trying to clear a cross, you put the ball into your own net. You lost the match to that goal. Whistles rose from the stands, "centre-back blunder" trended online. The next morning the image is still in front of your eyes.',
    ),
    icon: '😖',
    choices: [
      { label: t('Taraftara mesaj at: "Rövanşı alacağım"', 'Post to the fans: "I’ll make up for it"'), effects: () => fx(t('Mesaj beğeni topladı; çoğu taraftar "biz seninleyiz" yazdı.', 'The message got likes; most fans wrote, "We are with you".'), fans(5), happy(2), press(1)) },
      { label: t('Takım arkadaşlarıyla yemeğe çık', 'Go out to dinner with the squad'), effects: () => fx(t('Kaptan "Hepimizin başına geldi" dedi ve hikâyesini anlattı. Hafifledin.', 'The captain said, "It has happened to us all," and told his story. You felt lighter.'), rel('teammate', 5), stress(-4), happy(3)) },
      { label: t('Telefonu kapat, bir gün kaybol', 'Turn off the phone and disappear for a day'), effects: () => fx(t('Bir gün sessizlik iyi geldi. Ama basın "kaybolan stoper" diye yazdı.', 'A day of silence helped. But the press wrote "the vanishing defender".'), stress(-3), press(-2), fans(-1)) },
    ],
  },

  // ───────────── With the goalkeeper ─────────────
  {
    id: 'teammates.cb_keeper_bond', category: 'teammates', weight: 1.1, cooldownWeeks: 45, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && starter(state),
    title: t('Kaleciyle Aranızdaki Dil', 'The Language Between You and the Keeper'),
    text: t(
      'Kaleci hafta içinde sana yaklaştı: "Yüksek toplarda çağrı yapıyorsun, ben de çağırıyorum; bu hafta iki kere çarpıştık." İkiniz de haklısınız; ama bir kural gerekiyor.',
      'The keeper came to you midweek: "You call for high balls, I call for them too; we collided twice this week." You are both right, but a rule is needed.',
    ),
    icon: '🧤',
    choices: [
      { label: t('Kural: kutuda kaleci, dışında sen', 'Rule: keeper inside the box, you outside'), effects: () => fx(t('Basit bir kural, ama işe yaradı. İki maçtır çarpışmıyorsunuz.', 'A simple rule, but it worked. No collisions in two matches.'), rel('teammate', 3), attr('positioning', 1), stress(-1)) },
      { label: t('Birlikte ekstra ikili çalış', 'Do extra paired work together'), effects: () => fx(t('Yarım saat sonra ikiniz de gülüyordunuz. Bu iş konuşmakla değil, tekrarla çözülüyor.', 'Half an hour later you were both laughing. This is solved by repetition, not talk.'), rel('teammate', 5), sharp(2), attr('leadership', 1)) },
      { label: t('Gerek yok, her maça göre bak', 'No need; play it by ear'), effects: () => fx(t('Bu sefer iyi gitti, ama bir sonraki çarpışma ne zaman olur?', 'It went fine this time, but when is the next collision?'), morale(-1)) },
    ],
  },
  {
    id: 'manager.cb_ball_playing_demand', category: 'manager', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => isCb(state) && starter(state) && state.hero.attrs.passing >= 45,
    title: t('Hoca Defansta Pas İstiyor', 'The Manager Wants Passing from the Back'),
    text: t(
      'Hoca yeni bir plan çizdi: "Ortasaha baskı altındayken ilk pası sen çıkaracaksın. Uzun top yok, kısa kısa." Ama sen bunun bir risk olduğunu biliyorsun. Bu hafta üç denemede iki pas kaybettin.',
      'The manager has a new plan: "When midfield is pressed, you make the first pass. No long balls, short and sharp." But you know it is a risk. This week you lost the ball twice in three tries.',
    ),
    icon: '📐',
    choices: [
      { label: t('Planı üstlen, pas çalış', 'Back the plan and work on passing'), effects: () => fx(t('İlk iki maç kırılgandı, sonra oyun akmaya başladı. Hoca dizlerine vurarak güldü.', 'The first two matches were shaky, then the play began to flow. The manager slapped his knees and laughed.'), attr('passing', 1), attr('vision', 1), boss(4), trust(3)) },
      { label: t('Uzun topların neden iyi olduğunu anlat', 'Argue for the merits of long balls'), risk: 'medium', effects: () => fx(t('Hoca ikna olmadı ama tartışmayı not etti: seni dinlediğini gösterdi.', 'The manager was not convinced but noted the debate: he showed he was listening.'), boss(-1), attr('leadership', 1), trust(-1)) },
      { label: t('Riskli bölgede topu uzaklaştır', 'Clear the ball in risky areas'), effects: () => fx(t('Takım ritmini kaybetti ama gol yemedin. Kimse sana kızamadı.', 'The team lost rhythm but you did not concede. Nobody could be angry with you.'), stress(-1), boss(-1)) },
    ],
  },
  {
    id: 'fans.cb_fans_wall_chant', category: 'fans', weight: 1, cooldownWeeks: 52, maxPerCareer: 2,
    conditions: ({ state }) => isCb(state) && state.hero.seasonStats.cleanSheets >= 5 && state.hero.reputation >= 45,
    title: t('Tribün Seni "Duvar" İlan Etti', 'The Stands Named You "The Wall"'),
    text: t(
      'Kale arkasındaki grup yeni bir tezahürat buldu: "Duvar, duvar, geçilmez duvar!" Maç sonu forma satışlarında senin numaran öne geçti. Kulüp mağazası sana bir tişört teklifi yapıyor.',
      'The group behind the goal came up with a new chant: "The Wall, The Wall, impassable Wall!" After the match your number topped shirt sales. The club shop proposes a T-shirt with your name.',
    ),
    icon: '📢',
    choices: [
      { label: t('Tişört için evet de', 'Say yes to the T-shirt'), effects: () => fx(t('Bir haftada binlerce satıldı. Kulüp cebinden pay verdi.', 'Thousands sold in a week. The club passed you a cut.'), money(12_000), fans(5), fol(1200)) },
      { label: t('Tribüne gidip kale arkasını selamla', 'Go to the end and salute the group'), effects: () => fx(t('Gruptan biri sana bir atkı fırlattı. Sezon boyunca boynundaydı.', 'Someone in the group threw you a scarf. It stayed around your neck all season.'), fans(8), happy(5)) },
      { label: t('Alçakgönüllü kal: "Takım duvardır"', 'Stay humble: "The team is the wall"'), effects: () => fx(t('Cevabın etrafta dolaştı: "Takım duvardır." Soyunma odasında bir tebessüm yayıldı.', 'Your answer made the rounds: "The team is the wall." A smile spread through the dressing room.'), rel('teammate', 3), press(2)) },
    ],
  },

  // ───────────── Pass-network chain: the hero's busiest link ─────────────
  {
    id: 'teammates.cb_link_noticed', category: 'teammates', weight: 2.2, cooldownWeeks: 40, maxPerCareer: 3,
    conditions: ({ state }) => isCb(state) && state.calendar.week >= 14 && topPassLink(state) !== null,
    vars: ({ state }) => {
      const l = topPassLink(state)
      return { mate: l?.name ?? 'Takım arkadaşın', mateRel: l?.relId ?? '', passes: l?.passes ?? 0 }
    },
    title: t('Pas Ağında Bir İkili: {mate}', 'A Pair in the Pass Network: {mate}'),
    text: t(
      'Analiz ekibi bu sezonun pas ağını çıkardı: topu en çok {mate} ile paylaşıyorsun, aranızda {passes} pas gidip geldi. Hoca "buradan bir silah çıkar" diyor. İkinizin arasında düzenli bir dil oluşmuş.',
      'The analysts mapped this season’s pass network: you share the ball most with {mate}, {passes} passes back and forth between you. The manager says, "There is a weapon here." A steady language has formed between you two.',
    ),
    icon: '🔗',
    choices: [
      { label: t('Yemeğe davet et, bağı güçlendir', 'Invite {mate} to dinner and deepen the bond'), effects: (c) => fx(t('Akşam yemeği uzun sürdü; futbolun dışında da çok şey konuştunuz. Maçlarda daha çok göz göze gelmeye başladınız.', 'Dinner ran long; you talked about much more than football. In matches you began to find each other’s eyes more.'), bond(c, 'mateRel', 8), happy(4), follow(chain('teammates.cb_link_routine', 4, { mate: String(c.vars.mate ?? ''), mateRel: String(c.vars.mateRel ?? '') }))) },
      { label: t('Antrenmanda ikili rutin çalış', 'Rehearse a two-man routine in training'), effects: (c) => fx(t('Hoca kenardan not alıyordu. Üç gün sonra ikinizin hareketi takımın ezberi oldu.', 'The manager took notes from the side. Three days later your two-man move became the team’s routine.'), bond(c, 'mateRel', 5), boss(3), attr('passing', 1), follow(chain('teammates.cb_link_routine', 3, { mate: String(c.vars.mate ?? ''), mateRel: String(c.vars.mateRel ?? '') }))) },
      { label: t('Herkesle eşit oyna: bağımlılık yaratma', 'Play with everyone equally; avoid dependence'), effects: () => fx(t('Hoca kaşını kaldırdı ama takım dengesi bozulmadı. Bazen en iyi plan öngörülemezlik.', 'The manager raised an eyebrow but the team balance held. Sometimes unpredictability is the best plan.'), morale(1), attr('vision', 1)) },
    ],
  },
  {
    id: 'teammates.cb_link_routine', category: 'teammates', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => isCb(state),
    title: t('{mate} ile Gizli Kod', 'The Secret Code with {mate}'),
    text: t(
      'Aranızda artık konuşmadan anlaşıyorsunuz: sen bir kez dirsek sallıyorsun, {mate} sağdan açılıyor. Rakip analistler bile bu kalıbı kopyalamaya çalışıyor. Hoca bunun maçta işe yarayıp yaramadığını soruyor.',
      'You now understand each other without words: you swing an elbow once and {mate} peels off to the right. Even opposition analysts are trying to copy the pattern. The manager asks whether it works on matchday.',
    ),
    icon: '🧬',
    choices: [
      { label: t('Maçta daha çok kullan', 'Use it more in matches'), risk: 'medium', effects: (c) => fx(t('İkinci yarıda üç kere işe yaradı; üçüncüsü bir pozisyonla bitti. Rakip kodu çözünce sen bir sonraki maçta değişiklik yapmak zorunda kaldın.', 'It worked three times in the second half; the third ended in a chance. When the opposition cracked the code you had to adapt next game.'), bond(c, 'mateRel', 5), attr('passing', 1), form(2), follow(chain('teammates.cb_link_signature', 6, { mate: String(c.vars.mate ?? ''), mateRel: String(c.vars.mateRel ?? '') }))) },
      { label: t('Saklı tut, büyük maç için bekle', 'Keep it hidden for a big match'), effects: (c) => fx(t('Gizli silah gibi sakladınız. Derbide ortaya çıkacak.', 'You kept it like a secret weapon. It will surface in the derby.'), bond(c, 'mateRel', 3), boss(2), follow(chain('teammates.cb_link_signature', 8, { mate: String(c.vars.mate ?? ''), mateRel: String(c.vars.mateRel ?? '') }))) },
      { label: t('Kodu hocayla paylaş', 'Share the code with the manager'), effects: (c) => fx(t('Hoca bunu bütün takıma öğretmek istedi. Siz iki kişilik sırrı kaybettiniz ama takım kazandı.', 'The manager wanted to teach it to the whole squad. You two lost your secret but the team gained.'), bond(c, 'mateRel', 2), boss(5), trust(3)) },
    ],
  },
  {
    id: 'teammates.cb_link_signature', category: 'teammates', weight: 1, cooldownWeeks: 0, followUpOnly: true,
    conditions: ({ state }) => isCb(state),
    title: t('Ortak İmza: {mate}', 'Shared Signature: {mate}'),
    text: t(
      'Ortak rutininizden bir gol çıktı: sen geriden uzun bir pas çıkardın, {mate} tek dokunuşla ağlara gönderdi. Stadyum ayağa kalktı. Maç sonu mikrofonlar ikinizin yüzüne tutuldu: "Bunu önceden mi planladınız?"',
      'A goal came from your routine: you played a long ball from the back and {mate} put it away with one touch. The stadium rose. After the match microphones were pushed at both of you: "Did you plan that?"',
    ),
    icon: '✨',
    choices: [
      { label: t('"Bu yılın antrenmanı"', '"A year of training"'), effects: (c) => fx(t('Cevap hem alçakgönüllü hem dikkat çekiciydi. Spor yazarları "ikili" demeye başladı.', 'The answer was both modest and eye-catching. Sports writers started calling you "the duo".'), bond(c, 'mateRel', 6), press(4), fans(4), rep(1)) },
      { label: t('Tüm kredi {mate}’in', 'All the credit goes to {mate}'), effects: (c) => fx(t('{mate} utanıp gülümsedi, yanağını öptü. Soyunma odasında bu hikâye uzun süre anlatıldı.', '{mate} blushed and smiled. The story was told in the dressing room for a long time.'), bond(c, 'mateRel', 9), happy(5)) },
      { label: t('Sakin kal: "Kodlarımız bizde kalsın"', 'Stay cool: "Our codes stay with us"'), effects: (c) => fx(t('Gazeteciler çıldırdı. Ama aranızdaki sır, bir sonraki maçta da işe yarayacak.', 'Journalists went mad. But the secret between you will work again next match.'), bond(c, 'mateRel', 4), press(-1), flags({ cb_link_code: true })) },
    ],
  },
]
