/** Factory for the headless drills. */
import type { Drill, DrillConfig, DrillKind } from '../types'
import type { DrillBase } from '../base'
import { CrossingDrill } from './crossing'
import { DribblingDrill } from './dribbling'
import { FinishingDrill } from './finishing'
import { FitnessDrill } from './fitness'
import { GoalkeepingDrill } from './goalkeeping'
import { HeadingDrill } from './heading'
import { PassingDrill } from './passing'
import { TacklingDrill } from './tackling'

export { CrossingDrill, DribblingDrill, FinishingDrill, FitnessDrill, GoalkeepingDrill, HeadingDrill, PassingDrill, TacklingDrill }

/** Creates a drill of `kind` (config: hero attributes, seed, assist, difficulty, variant). */
export function createDrill(kind: DrillKind, cfg: DrillConfig): Drill & DrillBase {
  switch (kind) {
    case 'finishing':
      return new FinishingDrill(cfg)
    case 'passing':
      return new PassingDrill(cfg)
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
  }
}
