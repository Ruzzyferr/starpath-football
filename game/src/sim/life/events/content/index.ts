/**
 * Event content registry. Every content file exports an array of EventDef for
 * one category; ALL_EVENTS is the pool the engine rolls from.
 */
import type { EventDef } from '../types'
import { teammatesEvents } from './teammates'
import { managerEvents } from './manager'
import { clubEvents } from './club'
import { familyEvents } from './family'
import { romanceEvents } from './romance'
import { friendsEvents } from './friends'
import { pressEvents } from './press'
import { socialEvents } from './social'
import { fansEvents } from './fans'
import { nightlifeEvents } from './nightlife'
import { moneyEvents } from './money'
import { casinoEvents } from './casino'
import { healthEvents } from './health'
import { nationalEvents } from './national'
import { awardsEvents } from './awards'
import { rivalsEvents } from './rivals'
import { communityEvents } from './community'
import { transferEvents } from './transfer'
import { milestoneEvents } from './milestone'
import { weirdEvents } from './weird'
import { legalEvents } from './legal'
import { scamEvents } from './scam'
import { rumourEvents } from './rumour'
import { businessEvents } from './business'
import { charityEvents } from './charity'
import { mentorEvents } from './mentor'
import { abroadEvents } from './abroad'
import { careerArcEvents } from './careerArc'
import { businessDecisionEvents } from './businessDecisions'
import { projectEvents } from './projects'
import { veteranEvents } from './veteran'
import { veteran2Events } from './veteran2'

export const ALL_EVENTS: readonly EventDef[] = [
  ...teammatesEvents,
  ...managerEvents,
  ...clubEvents,
  ...familyEvents,
  ...romanceEvents,
  ...friendsEvents,
  ...pressEvents,
  ...socialEvents,
  ...fansEvents,
  ...nightlifeEvents,
  ...moneyEvents,
  ...casinoEvents,
  ...healthEvents,
  ...nationalEvents,
  ...awardsEvents,
  ...rivalsEvents,
  ...communityEvents,
  ...transferEvents,
  ...milestoneEvents,
  ...weirdEvents,
  ...legalEvents,
  ...scamEvents,
  ...rumourEvents,
  ...businessEvents,
  ...charityEvents,
  ...mentorEvents,
  ...abroadEvents,
  ...careerArcEvents,
  ...businessDecisionEvents,
  ...projectEvents,
  ...veteranEvents,
  ...veteran2Events,
]
