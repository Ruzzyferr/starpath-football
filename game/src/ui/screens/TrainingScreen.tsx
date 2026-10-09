import { useState } from 'preact/hooks'
import type { AttributeGroup } from '../../core/types'
import { lt, t, tx } from '../../i18n'
import {
  Button, Card, Chip, EmptyState, Modal, Page, RiskBadge, SectionTitle, StatBar, Tabs, TabPanel, toast, MeterRing,
} from '../components'
import { formatMoney } from '../format'
import { Icon, type IconName } from '../icons'
import { ROLE_PERK } from '../../core/roles'
import { actions, data, gameState, screen, type PerkView, type TrainingOutcomeView, type TrainingSessionView } from '../store'
import { decayWarning } from '../backend/meta'
import '../../styles/screens/legacy.css'
import { DrillOverlay } from './training/DrillOverlay'
import { GROUPS, groupAvg, keysOf } from './career/attrs'
import { deltaText, pickTab } from './career/util'
import '../../styles/screens/training.css'
import { InfoTip } from '../tutorial/InfoTip'

type TabId = 'sessions' | 'growth' | 'perks' | 'trainer'
const TAB_IDS: TabId[] = ['sessions', 'growth', 'perks', 'trainer']

const GROUP_ICON: Record<TrainingSessionView['group'], IconName> = {
  physical: 'run', technical: 'ball', mental: 'brain', goalkeeping: 'shield', recovery: 'heartbeat', tactical: 'tactics',
}

/** Toast for a finished session: "+38 XP · +1 Shooting, −20 Energy". */
function announce(o: TrainingOutcomeView): void {
  const rest = o.deltas.filter((d) => d.key !== 'xp')
  const xp = t('training.result.xp', { n: o.xp })
  toast(rest.length ? `${xp} · ${deltaText(rest)}` : xp, o.injured ? 'warning' : 'success', 'barbell')
}

function SessionCard({ s, onPlay }: { s: TrainingSessionView; onPlay: (s: TrainingSessionView) => void }) {
  const locked = !s.available
  const reason = locked ? lt(s.lockedReason) || t('training.session.locked') : undefined
  const runAuto = () => {
    const o = actions.trainSession(s.id)
    if (o.ok) announce(o)
    else toast(lt(o.error) || t('training.result.notApplied'), 'warning')
  }
  return (
    <Card class={`trn-session trn-g-${s.group}${locked ? ' is-locked' : ''}`} pad="md">
      <div class="trn-session-head">
        <span class="trn-session-icon" aria-hidden="true"><Icon name={GROUP_ICON[s.group]} size={22} /></span>
        <div class="grow">
          <h3 class="h3">{lt(s.name)}</h3>
          <div class="t-xs t-lo">{tx(`data.group.${s.group}`)} · {s.drill ? t('training.session.drillChip') : t('training.session.autoChip')}</div>
        </div>
        <RiskBadge risk={s.injuryRisk} />
      </div>
      {s.gains?.some((g) => g.weak) && (
        <div class="trn-dev-badge" title={t('training.session.devAreaHint')}><Chip tone="gold" icon="target">{t('training.session.devArea')}</Chip></div>
      )}
      <p class="t-sm t-mid trn-session-desc">{lt(s.desc)}</p>
      {s.gains && s.gains.length > 0 ? (
        <GainList gains={s.gains} />
      ) : s.focus.length > 0 && (
        <div class="trn-focus" aria-label={t('training.session.focus')}>
          {s.focus.map((k) => <Chip key={k}>{t(`data.attr.${k}`)}</Chip>)}
        </div>
      )}
      <div class="trn-session-foot">
        <span class="trn-meta"><Icon name="energy" size={16} class="t-gold" />{t('training.session.energy', { n: s.energy })}</span>
        <span class="trn-meta trn-xp" title={t('training.session.xpAuto', { n: s.xp })}>
          <Icon name="sparkle" size={16} />
          {s.drill ? t('training.session.xpRange', { a: s.xpMin ?? s.xp, b: s.xpMax }) : t('training.session.xp', { n: s.xp })}
        </span>
      </div>
      {locked && <p class="t-xs trn-warn trn-session-lock"><Icon name="lock" size={13} /> {reason}</p>}
      <div class="trn-session-actions">
        {s.drill ? (
          <>
            <Button variant="secondary" size="sm" disabled={locked} title={reason} onClick={runAuto}>
              {t('training.session.auto')}
            </Button>
            <Button variant="secondary" size="sm" icon="play" disabled={locked} title={reason} onClick={() => onPlay(s)}>
              {t('training.session.play')}
            </Button>
          </>
        ) : (
          <Button variant="primary" size="sm" icon="barbell" disabled={locked} title={reason} onClick={runAuto}>
            {t('training.session.autoOnly')}
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Per-attribute XP an auto session gives (numbered), development areas highlighted. */
function GainList({ gains }: { gains: NonNullable<TrainingSessionView['gains']> }) {
  const top = Math.max(0.1, ...gains.map((g) => g.xp))
  return (
    <ul class="trn-gains" aria-label={t('training.session.gains')}>
      {gains.slice(0, 5).map((g) => (
        <li key={g.key} class={`trn-gain${g.weak ? ' is-weak' : ''}`} data-attr={g.key}>
          <span class="trn-gain-name">{t(`data.attr.${g.key}`)}{g.weak && <span class="trn-gain-tag">{t('training.session.devArea')}</span>}</span>
          <span class="trn-gain-bar" aria-hidden="true"><i style={{ width: `${Math.round((g.xp / top) * 100)}%` }} /></span>
          <span class="trn-gain-xp num">+{g.xp.toFixed(1)} XP</span>
        </li>
      ))}
    </ul>
  )
}

/** The hero's development areas (his role's weak stats) with their current values. */
function DevFocus() {
  const h = gameState.value!.hero
  const areas = data.devAreas()
  if (!areas.length) return null
  return (
    <Card class="trn-devfocus" pad="sm" data-testid="dev-focus">
      <div class="micro t-mid">{t('training.session.devArea')}</div>
      <div class="trn-focus">
        {areas.map((k) => <Chip key={k} tone="gold" icon="target">{t(`data.attr.${k}`)} {h.attrs[k]}</Chip>)}
      </div>
      <p class="t-xs t-lo">{t('training.session.devFocusHint')}</p>
    </Card>
  )
}

function Sessions() {
  const s = gameState.value!
  const sessions = data.trainingSessions()
  const [playing, setPlaying] = useState<TrainingSessionView | null>(null)
  if (!sessions.length) return <EmptyState icon="barbell" title={t('training.session.empty')} />
  return (
    <div class="stack">
      <div class="trn-energy">
        <StatBar label={t('training.session.energyNow')} value={s.life.energy} color="var(--accent-gold)" info={<InfoTip term="energy" />} />
      </div>
      <DevFocus />
      <div class="trn-sessions stagger">
        {sessions.map((x) => <SessionCard key={x.id} s={x} onPlay={setPlaying} />)}
      </div>
      {playing && (
        <DrillOverlay
          session={playing}
          onClose={(o) => {
            setPlaying(null)
            if (o) announce(o)
          }}
        />
      )}
    </div>
  )
}

function Growth() {
  const h = gameState.value!.hero
  const groups: AttributeGroup[] = h.position === 'GK' ? ['goalkeeping', ...GROUPS.filter((g) => g !== 'goalkeeping')] : GROUPS
  return (
    <div class="stack">
      <Card class="trn-ovr" pad="md">
        <MeterRing value={data.heroOvr()} max={99} size={84} color="var(--accent-gold)" label={t('training.growth.ovr')} info={<InfoTip term="ovr" />} />
        <div class="trn-ovr-groups">
          {groups.map((g) => (
            <div key={g} class="trn-ovr-group">
              <span class="micro t-mid">{t(`data.group.${g}`)}</span>
              <span class="score-font trn-ovr-num">{groupAvg(h.attrs, g)}</span>
            </div>
          ))}
        </div>
      </Card>
      <p class="t-xs t-lo">{t('training.growth.xpHint')}</p>
      <div class="trn-growth">
        {groups.map((g) => (
          <Card key={g} pad="md" class="trn-group">
            <div class="row-between trn-group-head">
              <h3 class="h3">{t(`data.group.${g}`)}</h3>
              <Chip tone="info">{t('training.growth.avg', { n: groupAvg(h.attrs, g) })}</Chip>
            </div>
            <div class="stack trn-bars">
              {keysOf(g).map((k) => {
                const xp = h.attrXp[k] ?? 0
                return <StatBar key={k} label={t(`data.attr.${k}`)} value={h.attrs[k]} scale progress={xp >= 1 ? xp % 1 : xp} size="sm" />
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const CELL_H = 116

function PerkTree() {
  const h = gameState.value!.hero
  const perks = data.perks()
  const [sel, setSel] = useState<PerkView | null>(null)
  if (!perks.length) return <EmptyState icon="rocket" title={t('training.perks.empty')} />
  const cols = Math.max(...perks.map((p) => p.col)) + 1
  const rows = Math.max(...perks.map((p) => p.row)) + 1
  const byId = new Map(perks.map((p) => [p.id, p]))
  const cx = (c: number) => ((c + 0.5) / cols) * cols * 100
  const cy = (r: number) => r * CELL_H + CELL_H / 2
  const state = (p: PerkView) => (p.owned ? 'owned' : p.available ? 'available' : 'locked')
  const current = sel ? (byId.get(sel.id) ?? sel) : null
  // The perk that suits the hero's role (core/roles ROLE_PERK) wears a star.
  const rolePerk = h.role ? ROLE_PERK[h.role] : null
  const roleName = h.role ? t(`data.playRole.${h.role}`) : ''
  return (
    <div class="stack">
      <Card class="trn-points" pad="sm">
        <span class="trn-points-icon" aria-hidden="true"><Icon name="rocket" size={22} /></span>
        <div class="grow">
          <div class="micro t-mid label-with-tip">{t('training.perks.points')}<InfoTip term="perkPoints" /></div>
          <div class="score-font trn-points-num">{h.perkPoints}</div>
        </div>
        <p class="t-xs t-lo trn-points-hint">{t('training.perks.hint')}</p>
      </Card>
      <div class="trn-tree-scroll">
        <div class="trn-tree" style={{ height: `${rows * CELL_H}px`, minWidth: `${cols * 92}px` }}>
          <svg class="trn-tree-lines" viewBox={`0 0 ${cols * 100} ${rows * CELL_H}`} preserveAspectRatio="none" aria-hidden="true">
            {perks.flatMap((p) =>
              p.requires.map((rid) => {
                const r = byId.get(rid)
                if (!r) return null
                const on = r.owned
                return (
                  <path
                    key={`${rid}-${p.id}`}
                    d={`M${cx(r.col)} ${cy(r.row)} C${cx(r.col)} ${cy(r.row) + CELL_H / 2} ${cx(p.col)} ${cy(p.row) - CELL_H / 2} ${cx(p.col)} ${cy(p.row)}`}
                    class={`trn-link${on ? ' is-on' : ''}`}
                    vector-effect="non-scaling-stroke"
                  />
                )
              }),
            )}
          </svg>
          {perks.map((p) => (
            <button
              key={p.id}
              type="button"
              class={`trn-node is-${state(p)}`}
              style={{ left: `${((p.col + 0.5) / cols) * 100}%`, top: `${cy(p.row)}px` }}
              onClick={() => setSel(p)}
              aria-label={`${lt(p.name)}, ${t(`training.perks.${state(p)}`)}${p.id === rolePerk ? `, ${t('wizard.rolePerkFit', { role: roleName })}` : ''}`}
            >
              {p.id === rolePerk && <span class="trn-node-role" aria-hidden="true"><Icon name="star-fill" size={11} /></span>}
              <span class="trn-node-disc">
                <Icon name={p.owned || p.available ? p.icon : 'lock'} size={22} />
              </span>
              <span class="trn-node-name">{lt(p.name)}</span>
            </button>
          ))}
        </div>
      </div>
      <Modal
        open={!!current}
        onClose={() => setSel(null)}
        title={current ? lt(current.name) : ''}
        size="sm"
        footer={
          current && !current.owned ? (
            <Button
              variant="primary"
              block
              icon="lock-open"
              disabled={!current.available || h.perkPoints < current.cost}
              onClick={() => {
                const ok = actions.unlockPerk(current.id)
                if (ok) toast(t('training.perks.unlocked', { name: lt(current.name) }), 'reward', 'rocket')
                else toast(t('training.perks.failed'), 'warning')
                setSel(null)
              }}
            >
              {t('training.perks.unlock')}
            </Button>
          ) : undefined
        }
      >
        {current && (
          <div class="stack trn-perk-detail">
            <div class={`trn-perk-badge is-${state(current)}`} aria-hidden="true"><Icon name={current.icon} size={34} /></div>
            <p class="t-mid">{lt(current.desc)}</p>
            <div class="row wrap">
              <Chip tone={current.owned ? 'pos' : current.available ? 'gold' : 'neutral'} icon={current.owned ? 'check' : current.available ? 'lock-open' : 'lock'}>
                {t(`training.perks.${state(current)}`)}
              </Chip>
              {current.id === rolePerk && <Chip tone="gold" icon="star-fill">{t('wizard.rolePerkFit', { role: roleName })}</Chip>}
              {!current.owned && <Chip tone="violet" icon="rocket">{t('training.perks.cost', { n: current.cost })}</Chip>}
              {current.branch && <Chip tone="info" data-testid="perk-branch">{t('career4.perkBranch', { b: t(`career4.branch.${current.branch}`), n: current.tier ?? 1 })}</Chip>}
            </div>
            {current.requires.length > 0 && !current.owned && (
              <p class="t-sm t-lo">
                {t('training.perks.requires', { list: current.requires.map((r) => lt(byId.get(r)?.name ?? r)).join(', ') })}
              </p>
            )}
            {current.needs && !current.owned && Object.keys(current.needs).length > 0 && (
              <div class="stack trn-perk-needs" data-testid="perk-needs">
                <div class="micro t-lo">{t('training.perks.need.title')}</div>
                <ul class="t-sm">
                  {current.needs.points ? <li>{t('training.perks.need.points', { n: current.needs.points })}</li> : null}
                  {current.needs.ovr ? <li>{t('training.perks.need.ovr', { n: current.needs.ovr })}</li> : null}
                  {current.needs.position ? <li>{t('training.perks.need.position')}</li> : null}
                  {current.needs.attrs?.map((a) => <li key={a.key}>{t('training.perks.need.attr', { attr: t(`data.attr.${a.key}` as never), need: a.need, have: a.have })}</li>)}
                  {current.needs.reputation ? <li>{t('training.perks.need.reputation', { n: current.needs.reputation })}</li> : null}
                  {current.needs.tier ? <li>{t('training.perks.need.tier', { n: current.needs.tier })}</li> : null}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span class="trn-stars" role="img" aria-label={t('common.stars', { n })}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name={i <= n ? 'star-fill' : 'star'} size={14} />)}
    </span>
  )
}

function Trainer() {
  const s = gameState.value!
  const cur = s.life.trainer
  const offers = data.trainerOffers()
  return (
    <div class="stack">
      <SectionTitle>{t('training.trainer.current')}</SectionTitle>
      {cur ? (
        <Card variant="accent" class="trn-trainer-current">
          <span class="trn-trainer-icon" aria-hidden="true"><Icon name={GROUP_ICON[cur.group]} size={26} /></span>
          <div class="grow">
            <h3 class="h3">{cur.name}</h3>
            <div class="t-sm t-mid">{t('training.trainer.focus')}: {t(`data.group.${cur.group}`)}</div>
            <div class="t-xs t-lo trn-trainer-attrs">{keysOf(cur.group).map((k) => t(`data.attr.${k}`)).join(' · ')}</div>
            <div class="t-sm t-lo num">{t('training.trainer.fee')}: {formatMoney(cur.weeklyFee)}{t('common.perWeek')}</div>
          </div>
          <Button variant="ghost" size="sm" icon="sign-out" onClick={() => { actions.fireTrainer(); toast(t('training.trainer.fired'), 'info') }}>
            {t('training.trainer.fire')}
          </Button>
        </Card>
      ) : (
        <Card variant="inset" class="trn-trainer-none">
          <Icon name="whistle" size={28} class="t-lo" />
          <div>
            <div class="h3">{t('training.trainer.none')}</div>
            <p class="t-sm t-lo">{t('training.trainer.noneHint')}</p>
          </div>
        </Card>
      )}
      <SectionTitle>{t('training.trainer.offers')}</SectionTitle>
      {cur && <p class="t-xs t-lo">{t('training.trainer.replaceNote')}</p>}
      {offers.length === 0 ? (
        <EmptyState icon="whistle" />
      ) : (
        <div class="trn-offers stagger">
          {offers.map((o) => (
            <Card key={o.id} class="trn-offer" pad="md">
              <div class="row">
                <span class="trn-trainer-icon" aria-hidden="true"><Icon name={GROUP_ICON[o.group]} size={22} /></span>
                <div class="grow">
                  <h3 class="h3 truncate">{o.name}</h3>
                  <div class="t-xs t-lo">{t(`data.group.${o.group}`)}</div>
                </div>
                <Stars n={o.quality} />
              </div>
              <div class="t-xs t-lo trn-trainer-attrs" title={t('training.trainer.attrsHint')}>{keysOf(o.group).map((k) => t(`data.attr.${k}`)).join(' · ')}</div>
              <div class="trn-offer-stats">
                <div><span class="micro t-lo">{t('training.trainer.fee')}</span><span class="num">{formatMoney(o.weeklyFee)}{t('common.perWeek')}</span></div>
                <div><span class="micro t-lo">XP</span><span class="num t-pos">{t('training.trainer.bonus', { n: Math.round(o.bonus * 100) })}</span></div>
              </div>
              {!o.available && !o.current && o.lockedReason && <p class="t-xs trn-warn">{lt(o.lockedReason)}</p>}
              <Button
                variant={o.current ? 'ghost' : 'secondary'}
                size="sm"
                block
                icon={o.current ? 'check' : 'handshake'}
                disabled={!o.available}
                title={o.lockedReason ? lt(o.lockedReason) : undefined}
                onClick={() => {
                  if (actions.hireTrainer(o.id)) toast(t('training.trainer.hired', { name: o.name }), 'success', 'whistle')
                }}
              >
                {o.current ? t('training.trainer.current') : t('training.trainer.hire')}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function TrainingScreen() {
  const s = gameState.value
  const [tab, setTab] = useState<TabId>(pickTab(screen.value.params?.tab, TAB_IDS, 'sessions'))
  if (!s) return <Page title={t('training.title')}><EmptyState /></Page>
  const decay = decayWarning()
  return (
    <Page title={t('training.title')} sub={t('training.sub')} wide>
      {decay !== null && !s.hero.retired && (
        <p class="lg-warn t-sm" role="status" data-testid="decay-warning">{decay > 0 ? t('meta.decay.warn', { n: decay }) : t('meta.decay.now')}</p>
      )}
      <Tabs
        idPrefix="trn"
        label={t('training.title')}
        value={tab}
        onChange={setTab}
        items={[
          { id: 'sessions', label: t('training.tabs.sessions'), icon: 'barbell' },
          { id: 'growth', label: t('training.tabs.growth'), icon: 'chart-bar' },
          { id: 'perks', label: t('training.tabs.perks'), icon: 'rocket', badge: s.hero.perkPoints },
          { id: 'trainer', label: t('training.tabs.trainer'), icon: 'whistle' },
        ]}
      />
      <TabPanel id={tab} idPrefix="trn">
        {tab === 'sessions' && <Sessions />}
        {tab === 'growth' && <Growth />}
        {tab === 'perks' && <PerkTree />}
        {tab === 'trainer' && <Trainer />}
      </TabPanel>
    </Page>
  )
}
