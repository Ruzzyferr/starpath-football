/**
 * How-to cards for every mini-game: the ONE per-kind data source for the card text
 * (goal, controls, tip + the attribute it names). Edit hint copy here.
 *
 * Keys: `match:<highlight kind>`, `drill:<drill key>` (variant when it has its own rules),
 * `scout`, `doping`, `dialogue`. A string value is an i18n key, an LText is inline TR/EN copy.
 * Controls default to the per-group platform text (help.hints.<platform>.<group>) of `groups`.
 *
 * Visibility (pure): a card shows before EVERY play of its kind unless the master switch
 * ("Mini oyun ipuçları") is off or the player ticked "Bir daha gösterme" for that kind.
 */
import type { AttributeKey, LText } from '../../core/types'
import { MATCH_GROUPS, type HintGroup } from './hints'

type Copy = LText | string

export interface HowTo {
  /** Card heading (i18n key or text). */
  title: Copy
  goal: Copy
  /** Hint groups: drive the gesture art and the default controls text. */
  groups: HintGroup[]
  /** Platform controls when the group text does not fit (scouting, doping, dialogue, drills). */
  controls?: { touch: Copy; pc: Copy }
  /** The attribute the tip is about (shown as a chip). */
  attr: AttributeKey
  tip: LText
}

type MatchCopy = { goal: LText; attr: AttributeKey; tip: LText }

/** Match moments: goal + one tip each. Groups come from hints.MATCH_GROUPS. */
const MATCH: Record<string, MatchCopy> = {
  build_up: { goal: { tr: 'Topu takımda tut, boşluk bul ve hücumu ceza sahasına taşı.', en: 'Keep the ball, find space and carry the attack into the box.' }, attr: 'passing', tip: { tr: 'Kısa ve güvenli pas seriyi korur; Pas yüksekse ara pası dene.', en: 'Short, safe passes keep the move alive; try the through ball if your Passing is high.' } },
  counter: { goal: { tr: 'Savunma yerleşmeden hızla kaleye in ve bitir.', en: 'Break before the defence is set and finish the move.' }, attr: 'pace', tip: { tr: 'Depar Hız’ını kullanır; boş alana koş, rakibin içine değil.', en: 'Sprinting uses your Pace: run into space, not into a defender.' } },
  one_on_one: { goal: { tr: 'Kaleciyle karşı karşıyasın: gol at.', en: 'You are through on the keeper: score.' }, attr: 'finishing', tip: { tr: 'Kaleci çıkınca köşeye plase ya da aşırt; Bitiricilik isabeti belirler.', en: 'When the keeper comes out, place it in a corner or chip him; Finishing sets the accuracy.' } },
  cross: { goal: { tr: 'Kanattan ortayı koşan arkadaşına indir ya da kendin bitir.', en: 'Deliver the cross to a runner, or finish it yourself.' }, attr: 'crossing', tip: { tr: 'Koşucu ceza sahasına varırken ORTA düğmesine bas; Orta topun yerini belirler.', en: 'Press CROSS as the runner arrives in the box; Crossing decides where the ball lands.' } },
  edge_of_box: { goal: { tr: 'Ceza sahası dışından kaleyi bul.', en: 'Hit the target from outside the box.' }, attr: 'shooting', tip: { tr: 'Uzun basış güç verir ama isabeti düşürür; Şut Gücü yüksekse sert vur.', en: 'A long press adds power but costs accuracy; hit it hard if your Shooting is high.' } },
  freekick: { goal: { tr: 'Barajı aş, topu iki direğin arasına gönder.', en: 'Beat the wall and put it between the posts.' }, attr: 'curve', tip: { tr: 'Kavisli kaydır: Falso topu barajın etrafından döndürür.', en: 'Swipe in an arc: Curve bends the ball around the wall.' } },
  penalty: { goal: { tr: 'Penaltıyı gole çevir.', en: 'Score the penalty.' }, attr: 'composure', tip: { tr: 'Köşeyi seç ve kararlı vur; Soğukkanlılık nişanı sabit tutar.', en: 'Pick a corner and commit; Composure keeps the aim steady.' } },
  corner: { goal: { tr: 'Korner ortasına yüksel ve kafayla kaleyi bul.', en: 'Attack the corner and head it on target.' }, attr: 'heading', tip: { tr: 'Top inerken vur; Kafa isabeti, Zıplama yüksekliği belirler.', en: 'Hit it as the ball drops; Heading sets accuracy, Jumping the height.' } },
  defend: { goal: { tr: 'Rakibi durdur, topu kap ya da pas yolunu kes.', en: 'Stop the attacker: win the ball or cut the pass.' }, attr: 'tackling', tip: { tr: 'BASKI ile üstüne git, top ayağından açılınca MÜDAHALE; Top Kapma temiz müdahale şansıdır.', en: 'PRESS him, then TACKLE when the ball leaves his foot; Tackling is your clean-tackle chance.' } },
  gk_save: { goal: { tr: 'Şutu kurtar.', en: 'Save the shot.' }, attr: 'reflexes', tip: { tr: 'Şutçunun son adımını izle; Refleks tepkini hızlandırır.', en: 'Watch the shooter’s last step; Reflexes speed up your reaction.' } },
  gk_penalty: { goal: { tr: 'Penaltıyı kurtar.', en: 'Save the penalty.' }, attr: 'diving', tip: { tr: 'Erken atlama: Plonjon köşelere uzanma mesafeni artırır.', en: 'Don’t go too early; Diving widens how far you reach the corners.' } },
  counter_2v1: { goal: { tr: 'İkiye bir: doğru anda pas ver ya da kendin bitir.', en: 'Two-on-one: pass at the right time or finish it yourself.' }, attr: 'vision', tip: { tr: 'Savunmacı sana gelirse pas, arkadaşına giderse şut; Vizyon doğru seçeneği gösterir.', en: 'If the defender comes to you, pass; if he goes to your mate, shoot. Vision shows the right option.' } },
  long_ball_control: { goal: { tr: 'Uzun topu kontrol et ve hücuma devam et.', en: 'Control the long ball and keep the attack going.' }, attr: 'firstTouch', tip: { tr: 'Topun düşeceği yere erken geç; İlk Dokunuş topu ayağında tutar.', en: 'Get under the ball early; First Touch keeps it at your feet.' } },
  rebound: { goal: { tr: 'Dönen topu ilk sen al ve bitir.', en: 'React first to the rebound and finish.' }, attr: 'anticipation', tip: { tr: 'Hemen vur, düşünme; Önsezi topa ilk gitmeni sağlar.', en: 'Strike first time; Anticipation gets you to the ball first.' } },
  interception: { goal: { tr: 'Pası oku ve araya gir.', en: 'Read the pass and step in to intercept.' }, attr: 'anticipation', tip: { tr: 'Pasörün baktığı yere koş; Önsezi pası erken gösterir.', en: 'Run where the passer is looking; Anticipation shows the pass early.' } },
  hold_up: { goal: { tr: 'Topu sırtın dönük sakla, arkadaşların gelince bağla.', en: 'Shield the ball with your back to goal, then lay it off.' }, attr: 'strength', tip: { tr: 'Gövdeni rakiple top arasına koy; Güç topu korur.', en: 'Keep your body between man and ball; Strength protects it.' } },
  defend_1v1: { goal: { tr: 'Bire birde rakibi geçirme.', en: 'Don’t get beaten one-on-one.' }, attr: 'positioning', tip: { tr: 'Önünde kal, acele girme; Pozisyon Alma doğru açıyı tutar.', en: 'Stay in front and don’t dive in; Positioning holds the right angle.' } },
  block: { goal: { tr: 'Şutun önüne geç ve blokla.', en: 'Get in front of the shot and block it.' }, attr: 'positioning', tip: { tr: 'Top ile kale arasına gir, dik dur; BLOK’a erken basıp üstüne atılırsan çalımla geçer. Pozisyon Alma seni yola koyar.', en: 'Step between ball and goal and stay on your feet; dive in early with BLOCK and he shifts it past you. Positioning puts you in the lane.' } },
  corner_kick: { goal: { tr: 'Korneri kullan: bölgeyi, yüksekliği ve kavisi seç.', en: 'Take the corner: choose the zone, height and curl.' }, attr: 'setPieces', tip: { tr: 'En iyi kafacının olduğu bölgeyi seç; Duran Top isabeti belirler.', en: 'Aim where your best header is; Set Pieces sets the accuracy.' } },
  fk_wall: { goal: { tr: 'Barajı kur ve frikiği kurtar.', en: 'Set the wall and save the free kick.' }, attr: 'leadership', tip: { tr: 'Barajı yakın direğe koy, uzak köşeyi sen kapat; Liderlik barajı düzenler.', en: 'Cover the near post with the wall, the far corner is yours; Leadership organises the wall.' } },
  dribble: { goal: { tr: 'Rakibi çalımla geç ve atağı sürdür.', en: 'Beat your man with a dribble and keep going.' }, attr: 'dribbling', tip: { tr: 'Rakibe 1,5–2,5 m kala ÇALIM düğmesine bas, sonra DEPAR ile yanından geç; pas, adamını geçtikten sonra sayılır.', en: 'Press SKILL 1.5–2.5 m before the defender, then SPRINT past him; a pass counts only after you beat him.' } },
  header: { goal: { tr: 'Havadaki topa yüksel ve kafayla kaleyi bul.', en: 'Rise for the ball and head it on target.' }, attr: 'heading', tip: { tr: 'Top inerken vur; Kafa isabeti belirler.', en: 'Hit it as it drops; Heading sets the accuracy.' } },
  gk_1v1: { goal: { tr: 'Karşı karşıya pozisyonda açıyı kapat ve kurtar.', en: 'Close the angle in a one-on-one and save.' }, attr: 'gkPositioning', tip: { tr: 'Erken çık, erken yatma; Pozisyon (Kaleci) açıyı daraltır.', en: 'Come out early, stay up late; GK Positioning narrows the angle.' } },
  gk_sweep: { goal: { tr: 'Arkaya atılan topa rakipten önce çık.', en: 'Rush out and reach the ball over the top first.' }, attr: 'acceleration', tip: { tr: 'Tereddüt etme; Hızlanma ilk adımlarını belirler.', en: 'Don’t hesitate; Acceleration decides your first steps.' } },
  back_post: { goal: { tr: 'Arka direğe koş ve topu bitir ya da uzaklaştır.', en: 'Attack the back post: finish or clear it.' }, attr: 'jumping', tip: { tr: 'Zamanla zıpla; Zıplama topa ilk dokunmanı sağlar.', en: 'Time your jump; Jumping wins the first touch.' } },
  long_shot: { goal: { tr: 'Uzaktan kaleyi bul.', en: 'Score from distance.' }, attr: 'shooting', tip: { tr: 'Önce nişan, sonra güç; Şut Gücü uzaktan isabeti belirler.', en: 'Aim first, then power; Shooting decides long-range accuracy.' } },
  switch_play: { goal: { tr: 'Oyunu karşı kanada çevir.', en: 'Switch play to the far wing.' }, attr: 'longPassing', tip: { tr: 'Kanatçı koşarken önüne at; Uzun Pas isabeti belirler.', en: 'Lead the running winger; Long Passing sets the accuracy.' } },
  recovery_run: { goal: { tr: 'Geri koş ve rakibi yakala.', en: 'Sprint back and catch the attacker.' }, attr: 'workRate', tip: { tr: 'DEPAR’la kaleye dönük çizgiden yetiş, yanına gelince MÜDAHALE’ye bas; topa sen dokunmazsan başarı sayılmaz.', en: 'SPRINT back on the goal-side line and press TACKLE when you are on him; it only counts if you win it.' } },
  shoulder_duel: { goal: { tr: 'Omuz omuza mücadeleyi kazan ve topla devam et.', en: 'Win the shoulder-to-shoulder duel and keep the ball.' }, attr: 'balance', tip: { tr: 'DEPAR’la topa koş: daha hızlı gelen omuz düellosunu kazanır. Top sende olunca KALKAN çıkar, basılı tut. Güç düelloyu, Denge ayakta kalmayı belirler.', en: 'Sprint onto the ball: the man arriving faster wins the shoulder duel. With the ball, SHIELD appears: hold it. Strength wins the duel, Balance keeps you on your feet.' } },
  timed_run: { goal: { tr: 'Ofsayta düşmeden arkaya sark.', en: 'Time your run in behind without going offside.' }, attr: 'positioning', tip: { tr: 'Pas çıkana kadar çizgide bekle; Pozisyon Alma zamanlamayı kolaylaştırır.', en: 'Hold the line until the pass is played; Positioning helps the timing.' } },
  press_trap: { goal: { tr: 'Önde bas ve topu rakip yarı sahada kazan.', en: 'Press high and win the ball in their half.' }, attr: 'aggression', tip: { tr: 'Topu alana bas, pas yolunu kapat; Agresiflik baskıyı sertleştirir.', en: 'Close the receiver and the passing lane; Aggression makes the press bite.' } },
  gk_claim: { goal: { tr: 'Ortayı havada yakala.', en: 'Claim the cross in the air.' }, attr: 'handling', tip: { tr: 'Top en tepedeyken çık; Top Tutma topu bırakmamanı sağlar.', en: 'Go when the ball peaks; Handling makes sure you hold it.' } },
  gk_distribution: { goal: { tr: 'Topu koşan arkadaşına at ya da vur.', en: 'Throw or kick it to a running teammate.' }, attr: 'gkDistribution', tip: { tr: 'Arkadaşın önüne at; Oyun Kurma (Kaleci) isabeti belirler.', en: 'Lead your teammate; GK Distribution sets the accuracy.' } },
}

type DrillCopy = { groups: HintGroup[]; controls: string; attr: AttributeKey; tip: LText }

/** Drill key → controls source (training.drill.*Controls.<controls>) + tip. Goal/title are training.drill.* keys. */
const DRILL: Record<string, DrillCopy> = {
  finishing: { groups: ['shoot'], controls: 'finishing', attr: 'finishing', tip: { tr: 'Önce yanan bölgeye nişan al, sonra güç; Bitiricilik isabeti belirler.', en: 'Aim at the lit zone first, then power; Finishing sets the accuracy.' } },
  setPiece: { groups: ['setPiece'], controls: 'finishing', attr: 'curve', tip: { tr: 'Rüzgâra karşı kavis ver; Falso barajın etrafından döndürür.', en: 'Curl against the wind; Curve bends it around the wall.' } },
  passing: { groups: ['pass'], controls: 'passing', attr: 'passing', tip: { tr: 'Kapı açıksa yerden, manken varsa havadan; Pas isabeti belirler.', en: 'Ground pass through open gates, lofted over mannequins; Passing sets the accuracy.' } },
  rondo: { groups: ['pass'], controls: 'passing', attr: 'vision', tip: { tr: 'Tek dokunuş 1,5 puan; Vizyon 60+ ortadan 3. seçeneği görür.', en: 'One touch scores 1.5; Vision 60+ sees the third option through the middle.' } },
  dribbling: { groups: ['move'], controls: 'dribbling', attr: 'dribbling', tip: { tr: 'Koniye 1,5–2,5 m kala çalım; Dribbling temas cezasını azaltır.', en: 'Skill 1.5–2.5 m before a cone; Dribbling cuts the touch penalty.' } },
  fitness: { groups: ['fitness'], controls: 'fitness', attr: 'stamina', tip: { tr: 'Gereksiz depar atma; Dayanıklılık depoyu büyütür.', en: 'Don’t over-sprint; Stamina is your tank.' } },
  goalkeeping: { groups: ['keeper'], controls: 'goalkeeping', attr: 'reflexes', tip: { tr: 'Şutçunun son adımını oku; Refleks ipucunu erken gösterir.', en: 'Read the shooter’s last steps; Reflexes reveal the cue earlier.' } },
  diving: { groups: ['keeper'], controls: 'goalkeeping', attr: 'diving', tip: { tr: 'Her şut köşeye: tam uzan; Plonjon menzilini artırır.', en: 'Every shot goes to a corner: full stretch; Diving extends your reach.' } },
  crossing: { groups: ['cross'], controls: 'crossing', attr: 'crossing', tip: { tr: 'Koşucu bölgeye varırken bırak; Orta topu bölgeye indirir.', en: 'Release as the runner arrives; Crossing lands it in the zone.' } },
  switch: { groups: ['cross'], controls: 'crossing', attr: 'longPassing', tip: { tr: 'Kanatçının önüne at; Uzun Pas isabeti, Vizyon zamanlamayı kolaylaştırır.', en: 'Lead the winger; Long Passing sets accuracy, Vision eases timing.' } },
  heading: { groups: ['headMachine'], controls: 'heading', attr: 'heading', tip: { tr: 'Top inerken zıpla; Kafa isabeti, Zıplama yüksekliği belirler.', en: 'Jump as it drops; Heading sets accuracy, Jumping the height.' } },
  tackling: { groups: ['tackleDuel'], controls: 'tackling', attr: 'tackling', tip: { tr: 'Halka yeşilken gir; Top Kapma faulsuz kazanma şansıdır.', en: 'Go in when the ring is green; Tackling is your foul-free chance.' } },
  distribution: { groups: ['distribute'], controls: 'distribution', attr: 'gkDistribution', tip: { tr: 'Önce yakala, sonra 6 sn içinde at; Oyun Kurma (Kaleci) isabeti belirler.', en: 'Catch first, release within 6 s; GK Distribution sets the accuracy.' } },
  sprint: { groups: ['fitness'], controls: 'sprint', attr: 'acceleration', tip: { tr: 'Yeşilde çık; Hızlanma ilk adımları, Hız son sürati belirler.', en: 'Go on green; Acceleration sets the first steps, Pace the top speed.' } },
  contact: { groups: ['fitness'], controls: 'sprint', attr: 'balance', tip: { tr: 'Halka yeşilken sabitlen; Denge pencereyi genişletir.', en: 'Brace on green; Balance widens the window.' } },
  interception: { groups: ['defend'], controls: 'interception', attr: 'anticipation', tip: { tr: 'Pasörün döndüğü yere gir; Önsezi ipucunu erken gösterir.', en: 'Step where the passer turns; Anticipation shows the cue earlier.' } },
  press: { groups: ['defend'], controls: 'interception', attr: 'workRate', tip: { tr: 'Depar yorar; Çalışkanlık koşuyu ucuzlatır.', en: 'Sprinting tires you; Work Rate makes the run cheaper.' } },
}

const SCOUT: HowTo = {
  title: 'training.scout.kicker',
  goal: { tr: 'Rakibin videosunu izle, her klipte alışkanlığını seç. Doğru cevaplar maçta bonus verir.', en: 'Watch the opponent’s clips and pick their habit in each one. Right answers give a match bonus.' },
  groups: [],
  controls: { touch: 'training.scout.touch', pc: 'training.scout.pc' },
  attr: 'vision',
  tip: { tr: 'Alışkanlık görünür görünmez cevap ver; Önsezi, Vizyon ve Pozisyon alma klipleri yavaşlatır ve bonusu büyütür.', en: 'Answer as soon as the habit shows; Anticipation, Vision and Positioning slow the clips down and grow the bonus.' },
}

const DOPING: HowTo = {
  title: 'bench.doping.title',
  goal: 'bench.doping.goal',
  groups: [],
  controls: { touch: 'bench.doping.touch', pc: 'bench.doping.pc' },
  attr: 'composure',
  tip: { tr: 'İğneyi yeşil bantta tut; Soğukkanlılık bandı genişletir ve elini sabitler, sakin nefes Soğukkanlılık XP’si verir.', en: 'Keep the needle in the green band; Composure widens the band and steadies your hand, calm breathing earns Composure XP.' },
}

const DIALOGUE: HowTo = {
  title: { tr: 'Konuşma sahnesi', en: 'Conversation' },
  goal: { tr: 'Her repliğe bir cevap seç. Seçimlerin ilişkiyi, güveni ve morali değiştirir.', en: 'Pick a reply to each line. Your choices move relations, trust and morale.' },
  groups: [],
  controls: { touch: { tr: 'Bir cevaba dokun. Hızlı çözüm: tek dokunuşla eski sonuç.', en: 'Tap a reply. Quick resolve: the one-tap outcome.' }, pc: { tr: '1/2/3 ya da tıkla: cevap. Esc: kapat.', en: '1/2/3 or click: reply. Esc: close.' } },
  attr: 'leadership',
  tip: { tr: 'Portrenin altındaki ipucuna uyan cevabı seç; Soğukkanlılık ve Liderlik sözlerinin karşılık bulma şansını artırır.', en: 'Pick the answers the hint under the portrait asks for; Composure and Leadership make your words land.' },
}

/** Keys (the variant wins when it has its own rules, as in DrillOverlay). */
const DRILL_VARIANTS = new Set(['setPiece', 'rondo', 'switch', 'diving', 'contact', 'press'])
export const drillTutorialKey = (drill: string, variant?: string): string => `drill:${variant && DRILL_VARIANTS.has(variant) ? variant : drill}`
export const matchTutorialKey = (kind: string): string => `match:${kind}`

/** The card for a tutorial key (null when the kind has no mini-game card). */
export function howToFor(key: string): HowTo | null {
  if (key === 'scout') return SCOUT
  if (key === 'doping') return DOPING
  if (key === 'dialogue') return DIALOGUE
  const [ctx, kind = ''] = key.split(':') as [string, string?]
  if (ctx === 'match') {
    const m = MATCH[kind]
    if (!m) return null
    return { title: `match.kind.${kind}`, goal: m.goal, groups: MATCH_GROUPS[kind] ?? ['shoot'], attr: m.attr, tip: m.tip }
  }
  if (ctx === 'drill') {
    const d = DRILL[kind]
    if (!d) return null
    return {
      title: `training.drill.${kind}`,
      goal: `training.drill.goal.${kind}`,
      groups: d.groups,
      controls: { touch: `training.drill.touchControls.${d.controls}`, pc: `training.drill.pcControls.${d.controls}` },
      attr: d.attr,
      tip: d.tip,
    }
  }
  return null
}

/** Every key with a card (tests + settings count). */
export const TUTORIAL_KEYS: readonly string[] = [
  ...Object.keys(MATCH).map(matchTutorialKey),
  ...Object.keys(DRILL).map((k) => `drill:${k}`),
  'scout',
  'doping',
  'dialogue',
]

/** Show the card for `key`? Every time, unless switched off globally or hidden for that kind. */
export function shouldShowTutorial(key: string, prefs: { gameTips: boolean; hiddenTutorials: readonly string[] }): boolean {
  return prefs.gameTips && !prefs.hiddenTutorials.includes(key) && howToFor(key) !== null
}
