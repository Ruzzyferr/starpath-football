import '../../../styles/screens/bench.css'
import { lt, t } from '../../../i18n'
import type { LText } from '../../../core/types'
import { whyPlaying } from '../../../sim/game/whyPlaying'
import { Button } from '../../components'
import { Icon, type IconName } from '../../icons'
import { gameState, stateVersion } from '../../store'
import { benchOutlook, type SelectionOutlook } from '../../backend/benchPath'
import { runBenchAction, type BenchAction } from './benchActions'

const LEVER_ICON: Record<string, IconName> = { impress: 'target', drill: 'barbell', talk: 'chat', rest: 'bed', reserve: 'ball' }

type Tier = 'low' | 'mid' | 'high' | 'out'
const tierOf = (o: SelectionOutlook, out: boolean): Tier => (out ? 'out' : o.chance >= 0.7 ? 'high' : o.chance >= 0.35 ? 'mid' : 'low')

/** Half-ring gauge (180°) for the start chance. */
function Gauge({ value, tier }: { value: number; tier: Tier }) {
  const r = 52
  const len = Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg class={`sel-gauge sel-gauge-${tier}`} viewBox="0 0 128 72" aria-hidden="true">
      <path class="sel-gauge-track" d="M12 66 A52 52 0 0 1 116 66" pathLength={len} />
      <path class="sel-gauge-fill" d="M12 66 A52 52 0 0 1 116 66" pathLength={len} style={{ strokeDasharray: `${len * v} ${len}` }} />
      {[0.25, 0.5, 0.75].map((k) => {
        const a = Math.PI * (1 - k)
        return <line key={k} class="sel-gauge-tick" x1={64 + Math.cos(a) * 42} y1={66 - Math.sin(a) * 42} x2={64 + Math.cos(a) * 47} y2={66 - Math.sin(a) * 47} />
      })}
    </svg>
  )
}

function Pts({ n }: { n: number }) {
  if (n === 0) return null
  return <b class={`num sel-pts ${n > 0 ? 'is-pos' : 'is-neg'}`}>{n > 0 ? '+' : '−'}{t('bench.meter.pct', { n: Math.abs(n) })}</b>
}

/**
 * "Selection chance" meter (owner feedback): the real start probability for the
 * next club match, what moves it (why panel) and concrete levers, each with the
 * model's own effect and a deep link into the action.
 */
export function SelectionMeter({ compact = false, context = 'home' }: { compact?: boolean; context?: 'home' | 'preMatch' }) {
  void stateVersion.value
  const s = gameState.value
  // Pre-match: the selection for today is made; show the road to the next one.
  const o = s ? benchOutlook(context === 'preMatch') : null
  if (!s || !o || !o.fixtureId) return null
  const out = !!s.hero.injury || s.hero.suspendedMatches > 0
  const pct = Math.round(o.chance * 100)
  const tier = tierOf(o, out)
  const why = whyPlaying(s)
  const factors = (why?.factors ?? []).filter((f) => f.points !== 0)
  const opp = (() => {
    const fx = Object.values(s.world.competitions).flatMap((c) => c.fixtures).find((f) => f.id === o.fixtureId)
    if (!fx) return null
    const oppId = fx.homeId === s.hero.contract?.clubId ? fx.awayId : fx.homeId
    return s.world.clubs[oppId]?.shortName ?? null
  })()
  const when = o.daysUntil === 0 ? t('bench.meter.today') : o.daysUntil === 1 ? t('bench.meter.tomorrow') : t('bench.meter.inDays', { n: o.daysUntil ?? 0 })
  const levers = context === 'preMatch' ? o.levers.filter((l) => l.key !== 'rest' && l.key !== 'reserve') : o.levers
  return (
    <section class={`sel-card sel-${tier}${compact ? ' is-compact' : ''}`} data-testid="selection-meter" aria-labelledby="sel-title">
      <div class="sel-head">
        <div class="sel-gauge-wrap" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('bench.meter.aria', { n: pct })}>
          <Gauge value={o.chance} tier={tier} />
          <span class="sel-pct score-font num">{t('bench.meter.pct', { n: pct })}</span>
        </div>
        <div class="sel-head-text">
          <h2 class="micro sel-eyebrow" id="sel-title">{t('bench.meter.title')}</h2>
          <div class="sel-tier">{t(`bench.meter.tier.${tier}`)}</div>
          {opp && <div class="t-xs t-mid truncate">{t('bench.meter.next', { c: opp })} · {when}</div>}
          {o.dry >= 2 && <div class="t-xs sel-dry"><Icon name="hourglass" size={13} /> {t('bench.meter.dry', { n: o.dry })}</div>}
        </div>
      </div>

      {o.cameoDue && !out && (
        <p class="sel-cameo" data-testid="sel-cameo"><Icon name="shirt" size={16} /> {t('bench.meter.cameo')}</p>
      )}

      {!compact && factors.length > 0 && (
        <div class="sel-block">
          <h3 class="micro t-lo">{t('bench.meter.why')}</h3>
          <ul class="sel-factors">
            {factors.map((f) => (
              <li key={f.key}><span class="t-sm">{lt(f.label as LText)}</span><Pts n={f.points} /></li>
            ))}
          </ul>
        </div>
      )}

      {!out && (
        <div class="sel-block">
          <h3 class="micro t-lo">{t('bench.meter.levers')}</h3>
          {levers.length === 0 ? (
            <p class="t-sm t-mid">{t('bench.meter.leversNone')}</p>
          ) : (
            <ul class="sel-levers">
              {levers.slice(0, compact ? 2 : 4).map((l) => (
                <li key={l.key}>
                  <span class="sel-lever-icon"><Icon name={LEVER_ICON[l.key] ?? 'trend-up'} size={18} /></span>
                  <span class="sel-lever-label t-sm">{lt(l.label)}</span>
                  {context === 'home' && (
                    <Button size="sm" variant="secondary" class="sel-lever-go" onClick={() => runBenchAction(l.key as BenchAction)} data-testid={`sel-go-${l.key}`}>
                      {t('bench.meter.go')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!compact && <p class="t-xs t-lo sel-model">{t('bench.meter.model')}</p>}
        </div>
      )}
    </section>
  )
}
