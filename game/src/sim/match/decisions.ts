/**
 * In-match decision window (GAP 2.4#36 / #52 / #99): pure, deterministic rules.
 *
 * Between simulated minutes the live hub may pause the match and offer a short
 * contextual choice (who takes the set piece, answer a provocation, how to
 * celebrate, the captain's word to the referee, a tactical shout). This module
 * only decides WHEN a window opens and WHAT a choice does; the match layer
 * applies the result (rating + card through the engine, the rest through the
 * career state, see sim/game/matchDecisions.ts). It never touches the engine
 * RNG, so a match without decisions is byte-identical to before.
 *
 * Limits: at most MAX_PER_MATCH windows, never before MIN_MINUTE or after
 * MAX_MINUTE, and at least COOLDOWN minutes apart.
 */
import type { LText } from '../../core/types'
import { Rng, clamp, hashString } from '../../core/rng'

export type DecisionKind = 'penaltyTaker' | 'freeKickTaker' | 'provocation' | 'celebrate' | 'refCall' | 'shout'
export const DECISION_KINDS: readonly DecisionKind[] = ['penaltyTaker', 'freeKickTaker', 'provocation', 'celebrate', 'refCall', 'shout']

export const MAX_PER_MATCH = 2
export const COOLDOWN = 20
export const MIN_MINUTE = 10
export const MAX_MINUTE = 84
/** Seconds the player has before the default option is taken. */
export const DECISION_SECONDS = 12

const lt = (tr: string, en: string): LText => ({ tr, en })

/** What a choice changes. All fields optional; numbers are signed deltas. */
export interface DecisionEffects {
  /** Hero match rating (raw). */
  rating?: number
  morale?: number
  /** Relationship change with every teammate. */
  teammates?: number
  manager?: number
  press?: number
  fans?: number
  managerTrust?: number
  discipline?: number
  /** Hero is booked (yellow) in the match. */
  book?: boolean
}

export interface DecisionOption {
  id: string
  label: LText
  hint: LText
  effects?: DecisionEffects
  /** A coin-flip choice: `win` or `lose` effects land on top of `effects`. */
  gamble?: { chance: number; win: DecisionEffects; lose: DecisionEffects }
}

export interface DecisionDef {
  kind: DecisionKind
  title: LText
  prompt: LText
  options: DecisionOption[]
  /** Option taken when the timer runs out. */
  fallback: string
}

/** What the live hub tells us about the match so far. */
export interface DecisionContext {
  seed: string
  minute: number
  /** Windows already shown this match. */
  shown: number
  /** Minute of the previous window (-99 when none). */
  lastMinute: number
  heroOnPitch: boolean
  /** Hero's team goals minus the opponent's. */
  diff: number
  /** Most recent event, from the hero's side point of view (own = hero's team). */
  last: { type: string; own: boolean | null; minute: number } | null
  isCaptain: boolean
  heroOvr: number
  heroYellow: number
}

/** The summed effects of a choice plus the outcome of any gamble: what is actually applied. */
export interface DecisionOutcome {
  kind: DecisionKind
  optionId: string
  /** null when the option has no gamble. */
  won: boolean | null
  effects: Required<Omit<DecisionEffects, 'book'>> & { book: boolean }
  line: LText
}

type Fx = DecisionOutcome['effects']
const ZERO: Fx = { rating: 0, morale: 0, teammates: 0, manager: 0, press: 0, fans: 0, managerTrust: 0, discipline: 0, book: false }

function add(a: Fx, b: DecisionEffects | undefined): Fx {
  if (!b) return a
  return {
    rating: a.rating + (b.rating ?? 0), morale: a.morale + (b.morale ?? 0), teammates: a.teammates + (b.teammates ?? 0),
    manager: a.manager + (b.manager ?? 0), press: a.press + (b.press ?? 0), fans: a.fans + (b.fans ?? 0),
    managerTrust: a.managerTrust + (b.managerTrust ?? 0), discipline: a.discipline + (b.discipline ?? 0), book: a.book || !!b.book,
  }
}

// ───────────────────────── Content ─────────────────────────

export function decisionDef(kind: DecisionKind, heroOvr = 60): DecisionDef {
  switch (kind) {
    case 'penaltyTaker':
    case 'freeKickTaker': {
      const pen = kind === 'penaltyTaker'
      const chance = clamp(0.5 + (heroOvr - 60) / 120, 0.3, 0.85)
      return {
        kind,
        title: pen ? lt('Penaltı!', 'Penalty!') : lt('Frikik fırsatı', 'Free kick chance'),
        prompt: pen
          ? lt('Takımın penaltı kazandı. Topun başında kim olacak?', 'Your team won a penalty. Who steps up?')
          : lt('Tehlikeli bölgede frikik. Topun başında kim olacak?', 'A free kick in a dangerous spot. Who takes it?'),
        options: [
          {
            id: 'take', label: lt('Ben atarım', 'I\'ll take it'), hint: lt('Risk al: gol sevinci ya da pişmanlık', 'Take the risk: glory or regret'),
            gamble: {
              chance,
              win: { rating: 0.3, morale: 3, teammates: 1, fans: 1 },
              lose: { rating: -0.25, morale: -3, teammates: -1 },
            },
          },
          { id: 'specialist', label: lt('Uzmana bırak', 'Leave it to the specialist'), hint: lt('Takım arkadaşların takdir eder', 'Teammates appreciate it'), effects: { teammates: 2, managerTrust: 1 } },
          { id: 'captain', label: lt('Kaptan karar versin', 'Let the captain decide'), hint: lt('Sakin, hoca memnun olur', 'Calm; the manager approves'), effects: { manager: 1, teammates: 1 } },
        ],
        fallback: 'specialist',
      }
    }
    case 'provocation':
      return {
        kind,
        title: lt('Kışkırtma', 'Provocation'),
        prompt: lt('Rakip seni sürekli kışkırtıyor, kulağına bir şeyler fısıldıyor. Tepkin ne olur?', 'An opponent keeps winding you up, whispering in your ear. How do you react?'),
        options: [
          { id: 'ignore', label: lt('Görmezden gel', 'Ignore it'), hint: lt('Soğukkanlılık: disiplin artar', 'Stay cool: discipline rises'), effects: { discipline: 2, managerTrust: 1, rating: 0.05, morale: -1 } },
          {
            id: 'answer', label: lt('Karşılık ver', 'Answer back'), hint: lt('Sarı kart riski var', 'Risk of a yellow card'),
            gamble: { chance: 0.55, win: { morale: 2, teammates: 1 }, lose: { rating: -0.3, discipline: -3, managerTrust: -2, book: true } },
          },
          { id: 'referee', label: lt('Hakeme göster', 'Point it out to the ref'), hint: lt('Kimse bir şey kaybetmez', 'Nobody loses much'), effects: { discipline: 1, teammates: -1 } },
        ],
        fallback: 'ignore',
      }
    case 'celebrate':
      return {
        kind,
        title: lt('Gol sevinci', 'Goal celebration'),
        prompt: lt('Takımın gol attı! Sevinci nasıl yaşarsın?', 'Your team scored! How do you celebrate?'),
        options: [
          { id: 'fans', label: lt('Tribünlere koş', 'Run to the fans'), hint: lt('Taraftar coşar', 'The crowd erupts'), effects: { fans: 2, morale: 3, discipline: -1 } },
          { id: 'team', label: lt('Takımla kutla', 'Celebrate with the team'), hint: lt('Soyunma odası kenetlenir', 'The dressing room bonds'), effects: { teammates: 2, morale: 1 } },
          { id: 'calm', label: lt('Sakin kal, devam', 'Stay calm, refocus'), hint: lt('Hoca odağını sever', 'The manager likes the focus'), effects: { manager: 1, managerTrust: 1, rating: 0.05 } },
        ],
        fallback: 'team',
      }
    case 'refCall':
      return {
        kind,
        title: lt('Kaptanın sözü', 'Captain\'s word'),
        prompt: lt('Hakem kritik bir karar verdi. Kaptan olarak yanına gidiyorsun.', 'The referee made a big call. As captain you walk over.'),
        options: [
          { id: 'polite', label: lt('Nazikçe sor', 'Ask politely'), hint: lt('Saygı kazanırsın', 'Earns respect'), effects: { discipline: 1, teammates: 1, press: 1 } },
          {
            id: 'protest', label: lt('Sert itiraz et', 'Protest hard'), hint: lt('Kart riski, ama takım arkanda', 'Card risk, but the team is behind you'),
            gamble: { chance: 0.5, win: { teammates: 2, fans: 1, morale: 1 }, lose: { discipline: -3, managerTrust: -1, rating: -0.2, book: true } },
          },
          { id: 'calm', label: lt('Takımı sakinleştir', 'Calm the team down'), hint: lt('Liderlik göstergesi', 'A show of leadership'), effects: { teammates: 2, manager: 1 } },
        ],
        fallback: 'polite',
      }
    case 'shout':
    default:
      return {
        kind: 'shout',
        title: lt('Taktik çıkış', 'Tactical shout'),
        prompt: lt('Maç kritik bir noktada. Saha içinden takıma ne seslenirsin?', 'The match is at a tipping point. What do you call out to the team?'),
        options: [
          { id: 'rally', label: lt('Hadi, bastırıyoruz!', 'Come on, push up!'), hint: lt('Moral verir', 'Lifts morale'), effects: { teammates: 2, morale: 1, rating: 0.05 } },
          {
            id: 'demand', label: lt('Daha fazlasını iste', 'Demand more'), hint: lt('Ya motive eder ya kırar', 'Fires them up or stings'),
            gamble: { chance: 0.55, win: { teammates: 1, rating: 0.1, managerTrust: 1 }, lose: { teammates: -2, morale: -1 } },
          },
          { id: 'organise', label: lt('Düzeni hatırlat', 'Reorganise the shape'), hint: lt('Hocayı memnun eder', 'Pleases the manager'), effects: { manager: 2, managerTrust: 1 } },
        ],
        fallback: 'organise',
      }
  }
}

// ───────────────────────── Triggering ─────────────────────────

/** Deterministic roll in [0,1) for a (match, minute, kind). */
function roll(seed: string, minute: number, kind: string): number {
  return new Rng(hashString(`dec:${seed}:${minute}:${kind}`)).next()
}

/**
 * Which window (if any) opens after this minute. Pure and deterministic: the
 * same match state always gives the same answer.
 */
export function pickDecision(ctx: DecisionContext): DecisionKind | null {
  if (ctx.shown >= MAX_PER_MATCH) return null
  if (ctx.minute < MIN_MINUTE || ctx.minute > MAX_MINUTE) return null
  if (ctx.minute - ctx.lastMinute < COOLDOWN) return null
  if (!ctx.heroOnPitch) return null
  const fresh = ctx.last && ctx.minute - ctx.last.minute <= 1 ? ctx.last : null
  const cands: [DecisionKind, number][] = []
  if (fresh?.own && fresh.type === 'penalty') cands.push(['penaltyTaker', 0.9])
  if (fresh?.own && fresh.type === 'freekick') cands.push(['freeKickTaker', 0.5])
  if (fresh?.own && fresh.type === 'goal') cands.push(['celebrate', 0.45])
  if (ctx.isCaptain && fresh && fresh.own === false && (fresh.type === 'yellow' || fresh.type === 'red' || fresh.type === 'penalty')) cands.push(['refCall', 0.7])
  if (ctx.heroYellow === 0 && ctx.diff <= 0) cands.push(['provocation', 0.035])
  if (ctx.minute >= 55 && ctx.diff < 0) cands.push(['shout', 0.07])
  else if (ctx.minute >= 40 && ctx.diff === 0) cands.push(['shout', 0.03])
  for (const [kind, p] of cands) if (roll(ctx.seed, ctx.minute, kind) < p) return kind
  return null
}

// ───────────────────────── Resolving ─────────────────────────

/** Resolve a choice. An unknown `optionId` falls back to the default option. */
export function resolveDecision(def: DecisionDef, optionId: string, seed: string): DecisionOutcome {
  const opt = (def.options.find((o) => o.id === optionId) ?? def.options.find((o) => o.id === def.fallback) ?? def.options[0])!
  let fx = add(ZERO, opt.effects)
  let won: boolean | null = null
  if (opt.gamble) {
    won = new Rng(hashString(`decr:${seed}:${def.kind}:${opt.id}`)).chance(opt.gamble.chance)
    fx = add(fx, won ? opt.gamble.win : opt.gamble.lose)
  }
  fx = { ...fx, rating: Math.round(fx.rating * 1000) / 1000 }
  const line: LText = won === null
    ? lt(`${def.title.tr}: ${opt.label.tr}`, `${def.title.en}: ${opt.label.en}`)
    : won
      ? lt(`${def.title.tr}: ${opt.label.tr}, işe yaradı`, `${def.title.en}: ${opt.label.en}, it paid off`)
      : lt(`${def.title.tr}: ${opt.label.tr}, ters tepti`, `${def.title.en}: ${opt.label.en}, it backfired`)
  return { kind: def.kind, optionId: opt.id, won, effects: fx, line }
}
