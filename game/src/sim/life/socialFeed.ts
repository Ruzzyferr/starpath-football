/**
 * Generated social feed (pure, deterministic per week): fan comments with
 * replies that react to the last match and recent storylines, trending
 * hashtags, and an audience breakdown ("follower graph").
 *
 * Reads only state (flags written by match/relationship/event code):
 * `last_match_rating`, `last_match_goals`, `last_match_shone`,
 * `transfer_buzz`, `foundation`, `casino_seen_week`, businesses, fans value.
 */
import type { GameState, LText } from '../../core/types'
import { Rng, hashString } from '../../core/rng'
import { absWeek, clamp, fill, lt } from '../career/common'

export type FeedMood = 'love' | 'praise' | 'neutral' | 'critic' | 'hater' | 'joke'

export interface FeedReply {
  handle: string
  text: LText
  mood: FeedMood
  likes: number
}

export interface FeedComment {
  id: string
  handle: string
  text: LText
  mood: FeedMood
  likes: number
  replies: FeedReply[]
  /** What the comment reacts to. */
  topic: FeedTopic
}

export type FeedTopic = 'carried' | 'great' | 'poor' | 'normal' | 'rumour' | 'business' | 'casino' | 'charity' | 'quiet'

export interface Hashtag {
  tag: string
  /** Posts using it this week. */
  count: number
  mood: FeedMood
}

export interface AudienceSlice {
  key: 'local' | 'national' | 'global' | 'critics'
  share: number
}

export interface FanFeed {
  comments: FeedComment[]
  hashtags: Hashtag[]
  audience: AudienceSlice[]
}

const HANDLE_A = ['tribun', 'kalealti', 'golcu', 'forvet', 'ultra', 'cimen', 'ofsayt', 'sahakenari', 'kornerci', 'mahalle'] as const
const HANDLE_B = ['_aslan', '_kartal', '_1907', '34', '_fan', 'reis', '_teyze', '_amca', '_10', '_mavi'] as const

const C: Record<FeedTopic, { mood: FeedMood; text: LText }[]> = {
  carried: [
    { mood: 'love', text: lt('{h} {g} gol attı, gerisi seyirciydi. Bu çocuğa yazık ediyoruz.', '{h} scored {g} and the rest just watched. We\'re wasting this player.') },
    { mood: 'praise', text: lt('Kaybettik ama {h} tek başına savaştı. Saygı. 👏', 'We lost but {h} fought alone. Respect. 👏') },
    { mood: 'critic', text: lt('{h} harika ama savunma bu haldeyken kimse kurtaramaz.', '{h} was great, but nobody can save this defence.') },
  ],
  great: [
    { mood: 'love', text: lt('{h} bugün başka gezegendeydi 🪐', '{h} was on another planet today 🪐') },
    { mood: 'praise', text: lt('Puan {r}. Daha ne diyelim? {h} sezonun adamı.', 'Rated {r}. What else is there to say? {h} is the player of the season.') },
    { mood: 'joke', text: lt('{h} topu bırakmadı, top da {h}\'yi bırakmadı. Aşk bu.', '{h} wouldn\'t let go of the ball, and the ball wouldn\'t let go of {h}. That\'s love.') },
  ],
  poor: [
    { mood: 'critic', text: lt('{h} bugün yoktu. Kötü günler olur, ama bu kadar mı?', '{h} was missing today. Bad days happen, but this bad?') },
    { mood: 'hater', text: lt('Puan {r}. Kulübede otursa daha faydalı olurdu.', 'Rated {r}. Would\'ve helped more from the bench.') },
    { mood: 'neutral', text: lt('Herkesin kötü günü olur. Gelecek hafta göster {h}.', 'Everyone has an off day. Show us next week, {h}.') },
  ],
  normal: [
    { mood: 'neutral', text: lt('{h} fena değildi. Takımca daha çok koşmalıyız.', '{h} was decent. We need more running as a team.') },
    { mood: 'praise', text: lt('{h} her maç biraz daha iyi. Sabır.', '{h} gets a little better every game. Patience.') },
    { mood: 'joke', text: lt('{h}\'nin saçı yine maçın en iyisiydi.', '{h}\'s hair was man of the match again.') },
  ],
  rumour: [
    { mood: 'critic', text: lt('{h} gidecekse söylesin, bu belirsizlik bitsin.', 'If {h} is leaving, just say so. End the uncertainty.') },
    { mood: 'love', text: lt('#{h}Kal 🙏 Bu forma sana yakışıyor.', '#Stay{h} 🙏 This shirt suits you.') },
    { mood: 'hater', text: lt('Paraya giden gitsin. Arma kalıcı, oyuncu geçici.', 'Let the money-chasers go. The badge stays, players come and go.') },
  ],
  business: [
    { mood: 'praise', text: lt('{b}\'ya gittim, servis çok iyiydi. Patron sahada da iyi olsa keşke 😅', 'Went to {b}, great service. Wish the boss was this good on the pitch 😅') },
    { mood: 'joke', text: lt('{b} indirimi için gol başına %10 istiyoruz.', 'We want 10% off at {b} for every goal.') },
  ],
  casino: [
    { mood: 'critic', text: lt('Kumarhane fotoğrafları doğruysa yazık. Odaklan {h}.', 'If the casino photos are true, shame. Focus, {h}.') },
    { mood: 'hater', text: lt('Maç önü rulet mi? Profesyonellik bu mu?', 'Roulette before a match? Is that professional?') },
  ],
  charity: [
    { mood: 'love', text: lt('{h}\'nin vakfı mahallemize saha yaptı. Ömür boyu taraftarım. ❤️', '{h}\'s foundation built a pitch in our neighbourhood. Fan for life. ❤️') },
    { mood: 'praise', text: lt('Sahada da saha dışında da örnek. Helal.', 'A role model on and off the pitch. Proper.') },
  ],
  quiet: [
    { mood: 'neutral', text: lt('Maç ne zaman? Bu hafta çok sakin.', 'When\'s the next match? Quiet week.') },
    { mood: 'joke', text: lt('{h} antrenman videosu paylaşmadı, sakat mı acaba? 🤔', '{h} hasn\'t posted a training video. Injured? 🤔') },
  ],
}

const REPLIES: Record<'agree' | 'disagree' | 'joke', LText[]> = {
  agree: [lt('Aynen öyle.', 'Exactly this.'), lt('Ağzına sağlık.', 'Couldn\'t have said it better.'), lt('+1, tribünden de böyle görünüyordu.', '+1, looked the same from the stands.')],
  disagree: [lt('Abartma, daha yolun başında.', 'Calm down, it\'s early days.'), lt('Maçı izledin mi gerçekten?', 'Did you actually watch the game?'), lt('Hiç katılmıyorum.', 'Completely disagree.')],
  joke: [lt('Bu yorumu çerçeveletip asacağım.', 'Framing this comment.'), lt('Yorumlar maçtan daha eğlenceli.', 'The comments are better than the match.')],
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Which storylines the feed reacts to this week, strongest first. */
export function feedTopics(state: GameState): FeedTopic[] {
  const f = state.life.flags
  const topics: FeedTopic[] = []
  const rating = num(f.last_match_rating)
  if (f.last_match_shone === true && rating !== undefined && f.last_match_result === 'L') topics.push('carried')
  else if (rating !== undefined) topics.push(rating >= 7.5 || f.last_match_shone === true ? 'great' : rating < 6 ? 'poor' : 'normal')
  if ((num(f.transfer_buzz) ?? 0) > 0 || f.rumour_active === true) topics.push('rumour')
  const seen = num(f.casino_seen_week)
  if (seen !== undefined && absWeek(state.calendar) - seen <= 3) topics.push('casino')
  if (f.foundation === true) topics.push('charity')
  if ((state.life.businesses ?? []).length > 0) topics.push('business')
  if (topics.length === 0) topics.push('quiet')
  return topics
}

/** Build this week's fan feed. Deterministic per career and week. */
export function fanFeed(state: GameState, count = 5): FanFeed {
  const wk = absWeek(state.calendar)
  const rng = new Rng(hashString(`${state.meta.id}:feed:${wk}`))
  const h = state.hero.nickname || state.hero.firstName
  const vars = {
    h,
    g: num(state.life.flags.last_match_goals) ?? 0,
    r: (num(state.life.flags.last_match_rating) ?? 6.5).toFixed(1),
    b: state.life.businesses?.[0]?.name ?? '',
  }
  const reach = Math.max(50, state.life.followers)
  const fansVal = state.life.relationships.fans?.value ?? 0
  const topics = feedTopics(state)
  const comments: FeedComment[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    // The headline topic dominates; others get a word in.
    const topic = (i < 2 ? topics[0] : rng.pick(topics))!
    const pool = C[topic].filter((c) => !used.has(c.text.en))
    if (!pool.length) continue
    // Cold fans pick the harsher lines, warm fans the kinder ones.
    const pick = rng.weighted(pool, (c) => (c!.mood === 'hater' || c!.mood === 'critic' ? 1 - fansVal / 150 : 1 + fansVal / 150))
    used.add(pick!.text.en)
    const replies: FeedReply[] = []
    const nr = rng.int(0, 2)
    for (let j = 0; j < nr; j++) {
      const kind = rng.pick(['agree', 'disagree', 'joke'] as const)
      replies.push({ handle: handleFor(rng), text: rng.pick(REPLIES[kind]), mood: kind === 'disagree' ? 'critic' : kind === 'joke' ? 'joke' : pick!.mood, likes: rng.int(1, 40) + Math.round(reach * 0.0005) })
    }
    comments.push({
      id: `fc${wk}_${i}`, handle: handleFor(rng), text: fill(pick!.text, vars), mood: pick!.mood, topic,
      likes: Math.round(reach * rng.range(0.001, 0.01)) + rng.int(3, 60), replies,
    })
  }
  return { comments, hashtags: trending(state, topics, rng), audience: audience(state) }
}

function handleFor(rng: Rng): string {
  return `${rng.pick(HANDLE_A)}${rng.pick(HANDLE_B)}`
}

const tagSafe = (s: string): string => s.replace(/[^\p{L}\p{N}]/gu, '')

function trending(state: GameState, topics: FeedTopic[], rng: Rng): Hashtag[] {
  const h = tagSafe(state.hero.nickname || state.hero.lastName)
  const club = state.hero.contract ? state.world.clubs[state.hero.contract.clubId] : undefined
  const base = Math.max(30, Math.round(state.life.followers * 0.01))
  const out: Hashtag[] = []
  const add = (tag: string, mult: number, mood: FeedMood): void => {
    if (!out.some((x) => x.tag === tag)) out.push({ tag: `#${tag}`, count: Math.round(base * mult * rng.range(0.7, 1.3)), mood })
  }
  for (const t of topics) {
    if (t === 'carried') add(`${h}YalnızKurt`, 2, 'love')
    if (t === 'great') add((num(state.life.flags.last_match_goals) ?? 0) >= 3 ? `HatTrick${h}` : `${h}Show`, 2.2, 'love')
    if (t === 'poor') add((state.life.relationships.fans?.value ?? 0) < -20 ? `${h}Out` : `Kalk${h}`, 1.2, 'critic')
    if (t === 'rumour') add(`${h}Kal`, 1.8, 'love')
    if (t === 'casino') add(`${h}Kumarhanede`, 1.1, 'hater')
    if (t === 'charity') add(`${h}Vakfı`, 1, 'praise')
    if (t === 'business') add(tagSafe(state.life.businesses?.[0]?.name ?? 'İşletme'), 0.6, 'neutral')
  }
  if (club) add(`${tagSafe(club.shortName)}Ailesi`, 0.9, 'neutral')
  add('Futbol', 0.5, 'neutral')
  return out.sort((a, b) => b.count - a.count).slice(0, 5)
}

/** Audience breakdown (shares sum to 1): fame widens it, cold fans grow the critics. */
export function audience(state: GameState): AudienceSlice[] {
  const rep = clamp(state.hero.reputation, 0, 100) / 100
  const fans = state.life.relationships.fans?.value ?? 0
  const critics = clamp(0.06 - fans / 400, 0.02, 0.35)
  const global = clamp(rep * rep * 0.6, 0.02, 0.6)
  const national = clamp(0.15 + rep * 0.35, 0.15, 0.5)
  const local = Math.max(0.05, 1 - critics - global - national)
  const sum = local + national + global + critics
  return [
    { key: 'local', share: local / sum },
    { key: 'national', share: national / sum },
    { key: 'global', share: global / sum },
    { key: 'critics', share: critics / sum },
  ]
}
