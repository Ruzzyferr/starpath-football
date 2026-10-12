/**
 * Phone input path for the balance bots (playtester build 9: the bot harness passed the pressing moments while a
 * person on a phone ran straight through the carrier — the bot pressed the desktop ACTION key, which a touch screen
 * never sends).
 *
 * {@link phoneRuntime} wraps a runtime so every input a bot feeds it is one a thumb on the phone can produce through
 * the live input layer (game/input): the on-screen context buttons (game/actionSet, with the stick direction attached
 * like InputController.pressButton does), the stick, the SPRINT / JOCKEY / SHIELD holds only while those buttons are
 * on screen, and swipes / taps / meter shots on the pitch. Shapes only a keyboard or pad sends become what a phone
 * player presses for them: ACTION → the moment's own button (TACKLE, PRESS, BLOCK, … / HEAD / CLAIM, DIVE), or a tap
 * on the ball when the moment has no such button; a TACKLE / SLIDE that is not on screen is a tap on the man (the
 * phone's own challenge), another missing button is pressed as the one that is there, or not at all.
 */
import { contextActions, type ActionId } from './actionSet'
import { len, norm, sub, type Vec2 } from './model'
import type { HeroControl, HeroAction, HighlightRuntime } from './runtime'

/** Defensive buttons in the order a phone player reaches for them to challenge the man on the ball. */
const DEF_PRIMARY: readonly ActionId[] = ['tackle', 'press', 'block', 'intercept', 'slide', 'jump', 'head']
/** Off the ball, attacking: the button that meets a ball dropping to him. */
const OFF_PRIMARY: readonly ActionId[] = ['shoot', 'head', 'jump']
/** Keeper. */
const GK_PRIMARY: readonly ActionId[] = ['claim', 'dive', 'rush']

/** The visible context buttons right now. */
export const phoneButtons = (rt: HighlightRuntime): readonly ActionId[] => contextActions(rt.actionContext())

/** One bot action as the phone sends it (null = a phone cannot send it now). */
export function phoneAction(rt: HighlightRuntime, a: HeroAction): HeroAction | null {
  const ids = phoneButtons(rt)
  const ctx = rt.actionContext()
  const o = rt.owner
  const toMan: Vec2 | undefined = o && o !== rt.hero ? norm(sub(o.pos, rt.hero.pos)) : undefined
  const ballAt = { x: rt.ball.x, y: rt.ball.y }
  const btn = (pool: readonly ActionId[]): HeroAction | null => {
    const id = pool.find((p) => ids.includes(p))
    return id ? { kind: 'btn', id, ...(toMan && len(toMan) > 0.2 ? { dir: toMan } : {}) } : null
  }
  if (a.kind === 'action') {
    if (ctx.heroIsKeeper) return btn(GK_PRIMARY) ?? { kind: 'tapAt', at: ballAt }
    if (ctx.heroOnBall) return { kind: 'tapAt', at: ballAt }
    if (ctx.oppInPossession && o && o.team === 'opp') return btn(DEF_PRIMARY) ?? { kind: 'tapAt', at: o.pos }
    return btn(OFF_PRIMARY) ?? { kind: 'tapAt', at: ballAt }
  }
  if (a.kind === 'btn' && !ids.includes(a.id)) {
    // A challenge with no such button on screen: the phone's way is a tap on the man (a standing tackle in reach,
    // a slide from further). A keeper's button: the keeper button that is there. Anything else cannot be sent.
    if (['tackle', 'slide'].includes(a.id) && o && o.team === 'opp' && !ctx.heroIsKeeper) return { kind: 'tapAt', at: { x: o.pos.x, y: o.pos.y } }
    if (['press', 'block', 'intercept'].includes(a.id) && o && o.team === 'opp' && !ctx.heroIsKeeper) return btn(DEF_PRIMARY)
    if (['dive', 'rush', 'claim', 'punch', 'stay'].includes(a.id) && ctx.heroIsKeeper) return btn(GK_PRIMARY)
    return null
  }
  return a
}

/** The stick and holds as the phone sends them (a hold only while its button is on screen). */
export function phoneControl(rt: HighlightRuntime, c: HeroControl): HeroControl {
  const ids = phoneButtons(rt)
  // No context buttons at all (a set-piece taker): the legacy SPRINT button is there.
  const sprint = c.sprint && (ids.length === 0 || ids.includes('sprint'))
  const hold = c.hold && ids.includes(c.hold) ? c.hold : null
  return { move: c.move, sprint, hold }
}

/**
 * The runtime as a phone player drives it: same object, but queueAction / setControl only pass what a touch
 * screen can send (see the module comment). Everything else reads through unchanged.
 */
export function phoneRuntime(rt: HighlightRuntime): HighlightRuntime {
  return new Proxy(rt, {
    get(target, prop) {
      if (prop === 'queueAction') {
        return (a: HeroAction) => {
          const p = phoneAction(target, a)
          if (p) target.queueAction(p)
        }
      }
      if (prop === 'setControl') return (c: HeroControl) => target.setControl(phoneControl(target, c))
      const v = Reflect.get(target, prop, target) as unknown
      return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(target) : v
    },
  })
}

