/** Factory for the headless drills. */
import type { Drill, DrillConfig, DrillKind } from '../types'
import type { DrillBase } from '../base'
import { CrossingDrill } from './crossing'
import { DistributionDrill } from './distribution'
import { DribblingDrill } from './dribbling'
import { FinishingDrill } from './finishing'
import { FitnessDrill } from './fitness'
import { GoalkeepingDrill } from './goalkeeping'
import { HeadingDrill } from './heading'
import { InterceptionDrill } from './interception'
import { PassingDrill } from './passing'
import { RondoDrill } from './rondo'
import { SprintDrill } from './sprint'
import { TacklingDrill } from './tackling'

export { CrossingDrill, DistributionDrill, DribblingDrill, FinishingDrill, FitnessDrill, GoalkeepingDrill, HeadingDrill, InterceptionDrill, PassingDrill, RondoDrill, SprintDrill, TacklingDrill }

/** Creates a drill of `kind` (config: hero attributes, seed, assist, difficulty, variant). */
export function createDrill(kind: DrillKind, cfg: DrillConfig): Drill & DrillBase {
  switch (kind) {
    case 'finishing':
      return new FinishingDrill(cfg)
    case 'passing':
      return cfg.variant === 'rondo' ? new RondoDrill(cfg) : new PassingDrill(cfg)
    case 'dribbling':
      return new DribblingDrill(cfg)
    case 'fitness':
      return new FitnessDrill(cfg)
    case 'goalkeeping':
      return new GoalkeepingDrill(cfg)
    case 'crossing':
      return new CrossingDrill(cfg)
    case 'heading':
      return new HeadingDrill(cfg)
    case 'tackling':
      return new TacklingDrill(cfg)
    case 'distribution':
      return new DistributionDrill(cfg)
    case 'sprint':
      return new SprintDrill(cfg)
    case 'interception':
      return new InterceptionDrill(cfg)
  }
}
