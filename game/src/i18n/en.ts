/** English dictionary. Shape<> forces it to mirror tr.ts exactly. */
import type { Shape } from './shape'
import type { tr } from './tr'
import { en as common } from './sections/common'
import { en as nav } from './sections/nav'
import { en as data } from './sections/data'
import { en as ui } from './sections/ui'
import { en as title } from './sections/title'
import { en as wizard } from './sections/wizard'
import { en as home } from './sections/home'
import { en as objectives } from './sections/objectives'
import { en as planner } from './sections/planner'
import { en as event } from './sections/event'
import { en as training } from './sections/training'
import { en as profile } from './sections/profile'
import { en as club } from './sections/club'
import { en as world } from './sections/world'
import { en as contract } from './sections/contract'
import { en as life } from './sections/life'
import { en as casino } from './sections/casino'
import { en as match } from './sections/match'
import { en as season } from './sections/season'
import { en as inbox } from './sections/inbox'
import { en as settings } from './sections/settings'
import { en as saves } from './sections/saves'
import { en as help } from './sections/help'
import { en as meta } from './sections/meta'
import { en as board } from './sections/board'
import { en as iap } from './sections/iap'
import { en as postmatch } from './sections/postmatch'
import { en as intl } from './sections/intl'
import { en as career4 } from './sections/career4'

export const en: Shape<typeof tr> = {
  common,
  nav,
  data,
  ui,
  title,
  wizard,
  home,
  objectives,
  planner,
  event,
  training,
  profile,
  club,
  world,
  contract,
  life,
  casino,
  match,
  season,
  inbox,
  settings,
  saves,
  help,
  meta,
  board,
  iap,
  postmatch,
  intl,
  career4,
}
