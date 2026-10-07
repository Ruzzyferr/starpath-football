/** Factory for the headless drills. */
import type { Drill, DrillConfig, DrillKind } from '../types'
import type { DrillBase } from '../base'
import { DribblingDrill } from './dribbling'
import { FinishingDrill } from './finishing'
import { FitnessDrill } from './fitness'
import { GoalkeepingDrill } from './goalkeeping'
import { PassingDrill } from './passing'

export { DribblingDrill, FinishingDrill, FitnessDrill, GoalkeepingDrill, PassingDrill }

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
  }
}
