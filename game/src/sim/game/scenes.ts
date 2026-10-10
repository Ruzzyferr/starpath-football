/**
 * Short dialogue scenes (owner: "one tap and it's gone" felt empty): the
 * national camp check-in, a word with the club manager and the team dinner
 * are now two or three lines of conversation with real choices. Each scene is
 * built deterministically from the save (career seed + absolute day, its own
 * RNG fork: the career stream is untouched) and every outcome feeds an
 * existing system — the national coach's relation (call-up meter), the
 * manager's trust and relation (selection chance), teammate bonds (passing
 * network / chemistry), morale, happiness, money and attribute XP.
 *
 * The other speaker has a readable style (shown in the UI): answers that fit
 * it land better. The quick resolve paths (agenda quick, talkToManager, the
 * plain team_dinner activity) are unchanged, so the autopilot and the balance
 * harness never see a scene.
 */
import type { Appearance, AttributeKey, GameState, LText, NpcPlayer, Personality } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { absWeek, clamp, fill, lt, meter } from '../career/common'
import { developmentAreas } from '../career/attributeLife'
import { applyXpBundle } from '../career/progression'
import { MANAGER_REL, changeTrust } from '../career/squadRole'
import { changeRelation, teammateId } from '../life/relationships'
import { nameStyleOf, randomAppearance } from '../world/players'
import { playerDisplayName, squadPlayers } from '../world/queries'
import { absDayOf, heroClub } from './internal'
import { reserveMatchBlock } from './match'
import { NT_COACH_REL, heroCallup } from './national'
import { TALK_FLAG, TALK_TRUST, selectionOutlook, talkBlock } from './selection'

export type SceneId = 'nationalCamp' | 'managerTalk' | 'teamDinner'
export type SpeakerRole = 'ntCoach' | 'manager' | 'teammate'
/** The other speaker's style: answers that fit it land better. */
export type SceneStyle = 'demanding' | 'fatherly' | 'tactician'

export interface SceneOption {
  id: string
  label: LText
  /** Tone tag shown under the answer (not the numbers: reading the speaker is the game). */
  tone: LText
  /** What the other speaker says back. */
  reply: LText
}

export interface SceneStep {
  speaker: string
  role: SpeakerRole
  /** Index into {@link Scene.cast} (portrait). */
  who: number
  line: LText
  options: SceneOption[]
}

export interface SceneCast {
  name: string
  role: SpeakerRole
  appearance: Appearance
  /** Style (staff) or personality (teammates), for the chip under the portrait. */
  style?: SceneStyle
  personality?: Personality
}

export interface Scene {
  id: SceneId
  title: LText
  kicker: LText
  /** What the quick resolve does instead. */
  quick: LText
  cast: SceneCast[]
  steps: SceneStep[]
}

export type SceneEffectKey = 'coach' | 'manager' | 'trust' | 'teammates' | 'mate' | 'morale' | 'happiness' | 'money' | 'xp' | 'fatigue'
export interface SceneEffect {
  key: SceneEffectKey
  label: LText
  value: number
  /** XP effects: the attribute (the UI names it). */
  attr?: AttributeKey
}

export interface SceneOutcome {
  ok: boolean
  lines: LText[]
  effects: SceneEffect[]
  /** The meter the scene moves (call-up meter / start chance), before and after. */
  meter?: { label: LText; before: number; after: number }
}

// ───────────────────────── Helpers ─────────────────────────

const STYLES: readonly SceneStyle[] = ['demanding', 'fatherly', 'tactician']
const styleOf = (seed: number, key: string): SceneStyle => STYLES[hashString(`${seed}:style:${key}`) % STYLES.length]!
/** Staff portraits: a manager's haircut (buzz, crop, side part, bald, slick back), seeded per person. */
const STAFF_HAIR = [0, 1, 2, 9, 11] as const
function staffLook(seed: number, key: string, nation: string): Appearance {
  const h = hashString(`${seed}:look:${key}`)
  return { ...randomAppearance(new Rng(h), nameStyleOf(nation), 52), hairStyle: STAFF_HAIR[h % STAFF_HAIR.length]! }
}
const sceneRng = (s: GameState, id: SceneId): Rng => new Rng(s.meta.seed).fork(`scene:${id}:${absDayOf(s)}`)
const opt = (id: string, label: LText, tone: LText, reply: LText): SceneOption => ({ id, label, tone, reply })
/** The chosen option of each step (unknown / missing picks fall back to the first). */
const picked = (sc: Scene, picks: readonly string[]): string[] => sc.steps.map((st, i) => (st.options.some((o) => o.id === picks[i]) ? picks[i]! : st.options[0]!.id))

function teammateFx(s: GameState, d: number, why: LText): number {
  let n = 0
  let sum = 0
  for (const r of Object.values(s.life.relationships)) {
    if (r.kind !== 'teammate') continue
    sum += changeRelation(s.life, r.id, d, { hero: s.hero, cause: 'social', week: absWeek(s.calendar), why })
    n++
  }
  return n ? Math.round((sum / n) * 10) / 10 : 0
}

const E = (key: SceneEffectKey, label: LText, value: number): SceneEffect => ({ key, label, value: Math.round(value * 10) / 10 })

// ───────────────────────── National camp check-in ─────────────────────────

function coachOf(s: GameState): { name: string; style: SceneStyle; appearance: Appearance } {
  const nation = s.hero.nationality
  const name = s.world.national?.coaches[nation] ?? 'Coach'
  return { name, style: styleOf(s.meta.seed, `nt:${nation}`), appearance: staffLook(s.meta.seed, `nt:${nation}`, nation) }
}

export function nationalCampScene(s: GameState): Scene {
  const c = coachOf(s)
  const say = (line: LText, options: SceneOption[]): SceneStep => ({ speaker: c.name, role: 'ntCoach', who: 0, line, options })
  return {
    id: 'nationalCamp',
    title: lt('Milli takım kampı', 'National team camp'),
    kicker: lt('Kampa katılım · hocayla ilk konuşma', 'Camp check-in · first word with the coach'),
    quick: lt('Kayıt tamam, moral +2', 'Checked in, morale +2'),
    cast: [{ name: c.name, role: 'ntCoach', appearance: c.appearance, style: c.style }],
    steps: [
      say(lt('Hoş geldin. Kulüpte yoğun haftalar geçirdin; kendini nasıl hissediyorsun?', 'Welcome. You have had busy weeks at your club. How are you feeling?'), [
        opt('ready', lt('"Her şeye hazırım hocam."', '"Ready for anything, coach."'), lt('İstekli', 'Eager'), lt('"Güzel. Bu kampta tempo yüksek olacak."', '"Good. The tempo will be high this camp."')),
        opt('honest', lt('"Biraz yorgunum ama toparlanırım."', '"A bit tired, but I will recover."'), lt('Dürüst', 'Honest'), lt('"Söylediğin iyi oldu. Sağlık ekibi yükünü ayarlayacak."', '"Glad you told me. The medical staff will manage your load."')),
        opt('proud', lt('"Bu formayı giymek bir onur."', '"Wearing this shirt is an honour."'), lt('Gururlu', 'Proud'), lt('"Bunu sahada da göster."', '"Show me that on the pitch too."')),
      ]),
      say(lt('Bu kadroda kendini nerede görüyorsun?', 'Where do you see yourself in this squad?'), [
        opt('starter', lt('"İlk 11\'de."', '"In the starting XI."'), lt('Hırslı', 'Ambitious'), lt('"Hırsını severim. Ama yeri antrenman belirler."', '"I like the hunger. Training decides the places, though."')),
        opt('team', lt('"Takım nerede isterse."', '"Wherever the team needs me."'), lt('Takım oyuncusu', 'Team player'), lt('"Böyle oyuncuları severim."', '"That is the kind of player I want."')),
        opt('earn', lt('"Yerimi antrenmanda kazanacağım."', '"I will earn my place in training."'), lt('Mütevazı', 'Humble'), lt('"Kapı açık. Göreceğiz."', '"The door is open. We will see."')),
      ]),
      say(lt('Bu kampta önde baskı çalışıyoruz. Bizim oyunumuza hazır mısın?', 'This camp we work on a high press. Are you ready for our game?'), [
        opt('yes', lt('"Kulüpte de böyle oynuyoruz."', '"We play like that at my club too."'), lt('Kendinden emin', 'Confident'), lt('"O zaman ilk gün göster."', '"Then show me on day one."')),
        opt('learn', lt('"Detayları anlatın, öğrenirim."', '"Show me the details, I will learn."'), lt('Öğrenmeye açık', 'Eager to learn'), lt('"Video odasında görüşürüz."', '"See you in the video room."')),
        opt('own', lt('"Ben kendi oyunumu oynarım."', '"I would rather play my own game."'), lt('Bağımsız', 'Independent'), lt('"…Bunu konuşuruz."', '"…We will talk about that."')),
      ]),
    ],
  }
}

/** Coach relation per answer: [fits his style, does not]. */
const NT_FIT: Record<string, { fit: SceneStyle[]; yes: number; no: number }> = {
  ready: { fit: ['demanding'], yes: 4, no: 2 },
  honest: { fit: ['fatherly', 'tactician'], yes: 4, no: 1 },
  proud: { fit: ['fatherly'], yes: 4, no: 2 },
  starter: { fit: ['demanding'], yes: 4, no: -2 },
  team: { fit: ['fatherly', 'tactician'], yes: 4, no: 2 },
  earn: { fit: ['demanding', 'tactician'], yes: 3, no: 2 },
  yes: { fit: ['demanding'], yes: 3, no: 1 },
  learn: { fit: ['tactician', 'fatherly'], yes: 4, no: 2 },
  own: { fit: [], yes: 0, no: -4 },
}

/**
 * Apply the camp check-in played as a scene (agenda resolveTask 'played').
 * Coach relation (the call-up meter's coach part), morale, a little load
 * management and tactical XP.
 */
export function applyNationalCamp(s: GameState, picks: readonly string[]): SceneOutcome {
  const sc = nationalCampScene(s)
  const c = coachOf(s)
  const ids = picked(sc, picks)
  const rng = sceneRng(s, 'nationalCamp')
  const before = heroCallup(s)?.meter ?? 0
  let rel = 0
  let morale = 2
  for (const id of ids) {
    const f = NT_FIT[id]!
    rel += f.fit.includes(c.style) ? f.yes : f.no
  }
  // A good day for the coach: one extra point now and then (seeded).
  if (rel > 0 && rng.chance(0.25)) rel += 1
  if (ids[1] === 'starter') morale += 2
  if (ids[2] === 'own') morale += 1
  const week = absWeek(s.calendar)
  const applied = changeRelation(s.life, NT_COACH_REL, rel, { hero: s.hero, cause: 'social', week, contact: true, why: lt('Kampa katılım görüşmesi', 'Camp check-in talk') })
  const h = s.hero
  h.morale = meter(h.morale + morale)
  const effects: SceneEffect[] = [E('coach', fill(lt('{n} ile ilişki', 'Relation with {n}'), { n: c.name }), applied), E('morale', lt('Moral', 'Morale'), morale)]
  if (ids[0] === 'honest') {
    h.fatigue = meter(h.fatigue - 4)
    effects.push(E('fatigue', lt('Yorgunluk', 'Fatigue'), -4))
  }
  if (ids[2] === 'learn') {
    applyXpBundle(h, { positioning: 3, anticipation: 2 }, s.calendar.season)
    effects.push({ ...E('xp', lt('Özellik XP', 'Attribute XP'), 3), attr: 'positioning' })
  }
  const after = heroCallup(s)?.meter ?? before
  const good = applied >= 6
  return {
    ok: true, effects,
    meter: { label: lt('Milli takım şansı', 'Call-up meter'), before, after },
    lines: [good
      ? fill(lt('{n} seni kampın ilk gününde not etti.', '{n} took note of you on day one of the camp.'), { n: c.name })
      : applied < 0
        ? fill(lt('{n} cevaplarından pek hoşlanmadı.', '{n} did not much like your answers.'), { n: c.name })
        : lt('Milli takım kampına katılımını bildirdin.', 'You checked in for the national camp.')],
  }
}

// ───────────────────────── Talk to the manager ─────────────────────────

function managerOf(s: GameState): { name: string; style: SceneStyle; appearance: Appearance; rel: number } {
  const club = heroClub(s)
  const key = `club:${club?.id ?? ''}:${club?.managerName ?? ''}`
  return {
    name: club?.managerName ?? 'Manager',
    style: styleOf(s.meta.seed, key),
    appearance: staffLook(s.meta.seed, key, club?.countryId ?? s.hero.nationality),
    rel: s.life.relationships[MANAGER_REL]?.value ?? 0,
  }
}

/** The manager's honest advice (same reading as talkToManager). */
function managerTip(s: GameState): LText {
  const h = s.hero
  return h.fatigue > 60
    ? lt('"Yorgunsun. Dinlen, sonra konuşalım."', '"You look tired. Rest, then we talk."')
    : h.sharpness < 40
      ? lt('"Maç temposu lazım. U21 maçında oyna, kendini göster."', '"You need match sharpness. Play for the U21s and show me."')
      : h.form < 45
        ? lt('"Formun düştü. Antrenmanda A notu görmek istiyorum."', '"Your form has dipped. I want to see A grades in training."')
        : lt('"Kapım açık. Antrenmanda göz doldur, şansın gelecek."', '"My door is open. Shine in training and your chance will come."')
}

export function managerTalkScene(s: GameState): Scene | null {
  if (talkBlock(s)) return null
  const m = managerOf(s)
  const say = (line: LText, options: SceneOption[]): SceneStep => ({ speaker: m.name, role: 'manager', who: 0, line, options })
  const open = m.rel >= 20
    ? lt('"Gel, otur. Seni dinliyorum."', '"Come in, sit down. I am listening."')
    : m.rel <= -10
      ? lt('"Kısa tut. Ne istiyorsun?"', '"Keep it short. What do you want?"')
      : lt('"Kapı açıktı, buyur. Ne konuşmak istiyorsun?"', '"The door was open, come in. What is on your mind?"')
  return {
    id: 'managerTalk',
    title: lt('Teknik direktörün odası', 'The manager’s office'),
    kicker: lt('Forma için konuş', 'Talk about your place'),
    quick: fill(lt('Kısa konuşma: güven +{t}, hoca +2', 'A short word: trust +{t}, manager +2'), { t: TALK_TRUST }),
    cast: [{ name: m.name, role: 'manager', appearance: m.appearance, style: m.style }],
    steps: [
      say(open, [
        opt('ask', lt('"Oynamak için ne yapmalıyım?"', '"What do I need to do to play?"'), lt('Dürüst', 'Honest'), lt('"İyi soru. Sana açık konuşacağım."', '"Good question. I will be straight with you."')),
        opt('demand', lt('"İlk 11\'i hak ediyorum."', '"I deserve to start."'), lt('İddialı', 'Bold'), s.hero.form >= 60
          ? lt('"Formun iyi, kabul. Ama bunu sahada kanıtla."', '"Your form is good, fair. Prove it on the pitch."')
          : lt('"Hak etmek mi? Önce formunu görelim."', '"Deserve it? Let me see your form first."')),
        opt('offer', lt('"Hangi rolü verirseniz oynarım."', '"I will play any role you need."'), lt('Takım oyuncusu', 'Team player'), lt('"Bunu duymak güzel. Not ediyorum."', '"Good to hear. I am noting that."')),
      ]),
      say(managerTip(s), [
        opt('promise', lt('"Bu hafta antrenmanda göreceksiniz."', '"You will see it in training this week."'), lt('Söz ver', 'Promise'), lt('"Sözünü tut."', '"Keep your word."')),
        opt('detail', lt('"Tam olarak neyi eksik yapıyorum?"', '"What exactly am I missing?"'), lt('Analitik', 'Analytical'), lt('"Gel, videoda göstereyim."', '"Come, I will show you on video."')),
        opt('thanks', lt('"Teşekkürler hocam."', '"Thanks, boss."'), lt('Kısa', 'Brief'), lt('"Kapım açık."', '"My door is open."')),
      ]),
    ],
  }
}

const reserveOpen = (x: GameState): boolean => !reserveMatchBlock(x, 'reserve')
const startChance = (s: GameState): number => Math.round((selectionOutlook(s, reserveOpen)?.chance ?? 0) * 100)

/**
 * The talk played as a scene: manager trust (selection chance) and relation,
 * morale, and attribute XP when the hero asks for the details. Once a week
 * (shares the flag with talkToManager).
 */
export function applyManagerTalk(s: GameState, picks: readonly string[]): SceneOutcome {
  const sc = managerTalkScene(s)
  if (!sc) return { ok: false, lines: [talkBlock(s) ?? lt('Şu an konuşamazsın.', 'You cannot talk now.')], effects: [] }
  const m = managerOf(s)
  const ids = picked(sc, picks)
  const rng = sceneRng(s, 'managerTalk')
  const h = s.hero
  const before = startChance(s)
  const cold = m.rel < -20
  let trust = 0
  let rel = 0
  let morale = 0
  switch (ids[0]) {
    case 'ask': trust += TALK_TRUST; rel += 2; break
    case 'demand':
      if (h.form >= 60 && (m.style === 'demanding' || rng.chance(0.4))) { trust += 3.5; rel += 1; morale += 3 }
      else { trust += 0.5; rel -= 3; morale -= 1 }
      break
    default: trust += m.style === 'fatherly' ? 2.5 : 2; rel += 3
  }
  switch (ids[1]) {
    case 'promise': trust += m.style === 'demanding' ? 1 : 0.5; break
    case 'detail': trust += m.style === 'tactician' ? 1 : 0.4; break
    default: rel += m.style === 'fatherly' ? 2 : 1
  }
  if (cold) trust = Math.min(trust, 0.5)
  const appliedTrust = changeTrust(h, trust)
  const week = absWeek(s.calendar)
  const appliedRel = changeRelation(s.life, MANAGER_REL, rel, { cause: 'social', week, memory: lt('Forma için ne yapman gerektiğini sordun.', 'You asked what it takes to play.') })
  if (morale) h.morale = meter(h.morale + morale)
  s.life.flags[TALK_FLAG] = week
  const effects: SceneEffect[] = [E('trust', lt('Hocanın güveni', 'Manager trust'), appliedTrust), E('manager', fill(lt('{n} ile ilişki', 'Relation with {n}'), { n: m.name }), appliedRel)]
  if (morale) effects.push(E('morale', lt('Moral', 'Morale'), morale))
  if (ids[1] === 'detail') {
    const area = developmentAreas(h)[0]
    if (area) {
      applyXpBundle(h, { [area]: 3 } as Partial<Record<AttributeKey, number>>, s.calendar.season)
      effects.push({ key: 'xp', label: lt('Özellik XP', 'Attribute XP'), value: 3, attr: area })
    }
  }
  const after = startChance(s)
  return {
    ok: true, effects,
    meter: { label: lt('İlk 11 şansı', 'Start chance'), before, after },
    lines: [appliedTrust >= 3
      ? fill(lt('{n} seni ciddiye aldı.', '{n} took you seriously.'), { n: m.name })
      : appliedRel < 0
        ? fill(lt('{n} bu konuşmadan hoşlanmadı.', '{n} did not enjoy that talk.'), { n: m.name })
        : lt('Teknik direktörle konuştun.', 'You talked to the manager.')],
  }
}

// ───────────────────────── Team dinner ─────────────────────────

/** Teammates of a personality like this topic. */
const TOPIC_FIT: Record<string, readonly Personality[]> = {
  jokes: ['joker', 'party'],
  football: ['professional', 'leader', 'ambitious'],
  listen: ['quiet', 'loyal', 'hothead'],
}
export const DINNER_BILL = 450

/** Two seat-mates for tonight: seeded from the squad (bonds that exist). */
function dinnerMates(s: GameState): NpcPlayer[] {
  const club = heroClub(s)
  if (!club) return []
  const pool = squadPlayers(s.world, club.id).filter((p) => s.life.relationships[teammateId(p.id)]).sort((a, b) => (a.id < b.id ? -1 : 1))
  if (pool.length < 2) return pool
  const rng = sceneRng(s, 'teamDinner')
  const a = rng.int(0, pool.length - 1)
  let b = rng.int(0, pool.length - 2)
  if (b >= a) b++
  return [pool[a]!, pool[b]!]
}

export function teamDinnerScene(s: GameState): Scene | null {
  const mates = dinnerMates(s)
  if (mates.length < 2) return null
  const [a, b] = mates as [NpcPlayer, NpcPlayer]
  const na = playerDisplayName(a, 'short')
  const nb = playerDisplayName(b, 'short')
  return {
    id: 'teamDinner',
    title: lt('Takım yemeği', 'Team dinner'),
    kicker: lt('Soyunma odası masada', 'The dressing room at one table'),
    quick: lt('Akşam yemeğine katıl: takım arkadaşları +', 'Join the dinner: teammates +'),
    cast: [
      { name: na, role: 'teammate', appearance: a.appearance, personality: a.personality },
      { name: nb, role: 'teammate', appearance: b.appearance, personality: b.personality },
    ],
    steps: [
      { speaker: na, role: 'teammate', who: 0, line: fill(lt('"Buraya otur! {b} de yer tuttu ama benim masam daha eğlenceli."', '"Sit here! {b} saved you a seat too, but my end is more fun."'), { b: nb }), options: [
        opt('sitA', fill(lt('{n} yanına otur', 'Sit next to {n}'), { n: na }), lt('Birebir', 'One-on-one'), lt('"İşte bu!"', '"That\'s it!"')),
        opt('sitB', fill(lt('{n} yanına otur', 'Sit next to {n}'), { n: nb }), lt('Birebir', 'One-on-one'), fill(lt('{n} gülümsüyor: "Sağ ol, kardeşim."', '{n} smiles: "Cheers, mate."'), { n: nb })),
        opt('middle', lt('Masanın ortasına geç', 'Take the middle of the table'), lt('Herkesle', 'With everyone'), lt('Masanın iki ucu da sana dönüyor.', 'Both ends of the table turn to you.')),
      ] },
      { speaker: nb, role: 'teammate', who: 1, line: lt('"Eee, bu akşam ne konuşuyoruz?"', '"So, what are we talking about tonight?"'), options: [
        opt('jokes', lt('Soyunma odası hikâyeleri anlat', 'Tell dressing-room stories'), lt('Eğlenceli', 'Fun'), lt('Masada kahkahalar.', 'Laughter round the table.')),
        opt('football', lt('Taktiği ve sıradaki maçı konuş', 'Talk tactics and the next match'), lt('Ciddi', 'Serious'), lt('Peçeteye diziliş çiziliyor.', 'A line-up gets drawn on a napkin.')),
        opt('listen', lt('Dinle, onların derdini sor', 'Listen, ask how they are doing'), lt('Sakin', 'Calm'), lt('Biri açılıyor; masa sessizleşiyor.', 'Someone opens up; the table goes quiet.')),
      ] },
      { speaker: na, role: 'teammate', who: 0, line: lt('Garson hesabı getiriyor. Herkes birbirine bakıyor.', 'The waiter brings the bill. Everyone looks at each other.'), options: [
        opt('pay', lt('Hesabı sen öde', 'Pick up the bill'), lt('Cömert', 'Generous'), lt('"Kaptan gibi!" diye bağırıyorlar.', '"Like a captain!" they shout.')),
        opt('split', lt('Bölüşelim', 'Split it'), lt('Adil', 'Fair'), lt('Herkes payını bırakıyor.', 'Everyone leaves their share.')),
        opt('early', lt('Erken kalk, dinlenmeye git', 'Leave early to rest'), lt('Profesyonel', 'Professional'), lt('"Yine mi erken?" diye takılıyorlar.', '"Early again?" they tease.')),
      ] },
    ],
  }
}

/**
 * The dinner played as a scene, on top of the team_dinner activity (time,
 * energy, money, the base teammate boost): the seat-mate bond (personality
 * fit with the topic), the whole dressing room, happiness and the bill.
 */
export function applyTeamDinner(s: GameState, picks: readonly string[]): SceneOutcome {
  const sc = teamDinnerScene(s)
  if (!sc) return { ok: false, lines: [], effects: [] }
  const mates = dinnerMates(s)
  const ids = picked(sc, picks)
  const week = absWeek(s.calendar)
  const why = lt('Takım yemeğinde birlikteydiniz.', 'You were together at the team dinner.')
  const effects: SceneEffect[] = []
  const seat = ids[0] === 'sitA' ? mates[0] : ids[0] === 'sitB' ? mates[1] : undefined
  const fits = (p: NpcPlayer | undefined): boolean => !!p && TOPIC_FIT[ids[1]!]!.includes(p.personality)
  let group = ids[0] === 'middle' ? 1.5 : 0.5
  if (seat) {
    const d = (fits(seat) ? 6 : 2) + 2
    const applied = changeRelation(s.life, teammateId(seat.id), d, { hero: s.hero, cause: 'social', week, contact: true, memory: why })
    effects.push(E('mate', fill(lt('{n} ile ilişki', 'Relation with {n}'), { n: playerDisplayName(seat, 'short') }), applied))
  } else {
    // The middle of the table: the topic lands with whoever it fits.
    const hits = mates.filter((p) => fits(p)).length
    group += hits * 0.5
  }
  if (ids[1] === 'jokes') group += 0.5
  let happiness = ids[1] === 'jokes' ? 3 : ids[1] === 'listen' ? 2 : 1
  if (ids[2] === 'pay') {
    s.life.money -= DINNER_BILL
    group += 1.5
    happiness += 1
    effects.push(E('money', lt('Hesap', 'The bill'), -DINNER_BILL))
  } else if (ids[2] === 'early') {
    group -= 1
    s.hero.fatigue = meter(s.hero.fatigue - 3)
    effects.push(E('fatigue', lt('Yorgunluk', 'Fatigue'), -3))
  }
  if (ids[1] === 'football') applyXpBundle(s.hero, { vision: 2, positioning: 1 }, s.calendar.season)
  const avg = teammateFx(s, clamp(group, -1, 4), why)
  effects.unshift(E('teammates', lt('Takım arkadaşları (ort.)', 'Teammates (avg)'), avg))
  s.life.happiness = meter(s.life.happiness + happiness)
  effects.push(E('happiness', lt('Mutluluk', 'Happiness'), happiness))
  if (ids[1] === 'football') effects.push({ ...E('xp', lt('Özellik XP', 'Attribute XP'), 2), attr: 'vision' })
  return {
    ok: true, effects,
    lines: [seat && fits(seat)
      ? fill(lt('{n} ile bu akşam gerçekten kaynaştınız.', 'You and {n} really clicked tonight.'), { n: playerDisplayName(seat, 'short') })
      : lt('Takım yemeği güzel geçti.', 'The team dinner went well.')],
  }
}
