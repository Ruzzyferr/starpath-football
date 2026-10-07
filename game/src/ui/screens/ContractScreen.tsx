import { useState } from 'preact/hooks'
import type { SquadRole } from '../../core/types'
import { lt, t } from '../../i18n'
import {
  Avatar, Button, Card, CardHeader, Chip, Crest, EmptyState, MeterRing, Modal, Page, Segmented, Slider, Switch,
} from '../components'
import { formatMoney, seasonLabel } from '../format'
import { Icon } from '../icons'
import { actions, gameState, heroClub, navigate, negotiation, type NegotiationView, type OfferTerms } from '../store'
import { faceFor } from './career/attrs'
import '../../styles/screens/contract.css'

const ROLES: SquadRole[] = ['reserve', 'rotation', 'starter', 'star', 'captain']
const ROLE_RANK: Record<SquadRole, number> = { youth: 0, reserve: 1, rotation: 2, starter: 3, star: 4, captain: 5 }

function patienceColor(p: number): string {
  return p > 60 ? 'var(--brand-pitch)' : p > 30 ? 'var(--accent-gold)' : 'var(--state-danger)'
}

function moneyStep(max: number): number {
  if (max >= 5_000_000) return 100_000
  if (max >= 500_000) return 10_000
  if (max >= 50_000) return 1_000
  if (max >= 5_000) return 100
  return 10
}

function CurrentContract() {
  const s = gameState.value!
  const c = s.hero.contract
  const club = heroClub.value
  return (
    <Page title={t('contract.title')}>
      {c && club ? (
        <Card pad="lg" class="ctr-current" style={{ ['--c1' as string]: club.colors.primary }}>
          <div class="row ctr-current-head">
            <Crest crest={club.crest} size={64} />
            <div class="grow">
              <div class="micro t-mid">{t('contract.current')}</div>
              <h2 class="h2">{club.name}</h2>
              <Chip tone="gold" icon="star">{t(`data.role.${c.role}`)}</Chip>
            </div>
          </div>
          <dl class="ctr-dl">
            <div><dt>{t('contract.terms.wage')}</dt><dd class="num">{formatMoney(c.wage)}{t('common.perWeek')}</dd></div>
            <div><dt>{t('profile.contract.until')}</dt><dd>{t('profile.contract.untilSeason', { s: seasonLabel(c.untilSeason) })}</dd></div>
            <div><dt>{t('contract.terms.goalBonus')}</dt><dd class="num">{formatMoney(c.goalBonus)}</dd></div>
            <div><dt>{t('profile.contract.assistBonus')}</dt><dd class="num">{formatMoney(c.assistBonus)}</dd></div>
            <div><dt>{t('contract.terms.releaseClause')}</dt><dd class="num">{c.releaseClause ? formatMoney(c.releaseClause, { compact: true }) : t('contract.terms.none')}</dd></div>
          </dl>
          <div class="ctr-current-actions">
            <Button variant="primary" icon="handshake" onClick={() => actions.openNegotiation(club.id)}>{t('contract.renew')}</Button>
            <Button variant="secondary" icon="eye" onClick={() => navigate('world', { tab: 'interest' })}>{t('contract.explore')}</Button>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon="handshake"
          title={t('contract.none')}
          action={<Button variant="primary" icon="eye" onClick={() => navigate('world', { tab: 'interest' })}>{t('contract.explore')}</Button>}
        />
      )}
    </Page>
  )
}

function Outcome({ n }: { n: NegotiationView }) {
  const ok = n.status === 'accepted'
  const key = n.status === 'accepted' ? 'accepted' : n.status === 'rejected' ? 'rejected' : 'walkedAway'
  return (
    <Page title={t('contract.title')}>
      <Card pad="lg" variant={ok ? 'gold' : 'default'} class={`ctr-outcome${ok ? ' is-win' : ''}`}>
        {ok && <div class="ctr-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}</div>}
        <Crest crest={n.club.crest} size={96} label={n.club.name} />
        <h2 class="h1">{t(`contract.outcome.${key}`)}</h2>
        <p class="t-mid">{t(`contract.outcome.${key}Text`, { club: n.club.name })}</p>
        {n.lastResponse && <p class="t-sm t-lo ctr-quote">“{lt(n.lastResponse)}”</p>}
        <Button
          variant={ok ? 'gold' : 'secondary'}
          icon="check"
          onClick={() => {
            negotiation.value = null
            navigate(ok ? 'profile' : 'world', ok ? undefined : { tab: 'interest' }, { replace: true })
          }}
        >
          {t('contract.outcome.done')}
        </Button>
      </Card>
    </Page>
  )
}

function Negotiation({ n }: { n: NegotiationView }) {
  const s = gameState.value!
  const [terms, setTerms] = useState<OfferTerms>(() => ({
    ...n.clubOffer,
    releaseClause: n.clubOffer.releaseClause,
  }))
  const [walk, setWalk] = useState(false)
  const set = (patch: Partial<OfferTerms>) => setTerms((x) => ({ ...x, ...patch }))
  const r = n.ranges
  const agent = s.life.agent
  const fm = (v: number) => formatMoney(v, { compact: v >= 100_000 })

  const rows: { label: string; club: string; you: string; diff: number }[] = [
    { label: t('contract.terms.wage'), club: fm(n.clubOffer.wage), you: fm(terms.wage), diff: terms.wage - n.clubOffer.wage },
    { label: t('contract.terms.years'), club: t('common.years', { n: n.clubOffer.years }), you: t('common.years', { n: terms.years }), diff: terms.years - n.clubOffer.years },
    { label: t('contract.terms.signingBonus'), club: fm(n.clubOffer.signingBonus), you: fm(terms.signingBonus), diff: terms.signingBonus - n.clubOffer.signingBonus },
    { label: t('contract.terms.goalBonus'), club: fm(n.clubOffer.goalBonus), you: fm(terms.goalBonus), diff: terms.goalBonus - n.clubOffer.goalBonus },
    {
      label: t('contract.terms.releaseClause'),
      club: n.clubOffer.releaseClause ? fm(n.clubOffer.releaseClause) : t('contract.terms.none'),
      you: terms.releaseClause ? fm(terms.releaseClause) : t('contract.terms.none'),
      diff: (terms.releaseClause ? 1 : 0) - (n.clubOffer.releaseClause ? 1 : 0),
    },
    { label: t('contract.terms.role'), club: t(`data.role.${n.clubOffer.role}`), you: t(`data.role.${terms.role}`), diff: ROLE_RANK[terms.role] - ROLE_RANK[n.clubOffer.role] },
  ]

  return (
    <Page title={t('contract.title')} wide>
      <div class="ctr-head" style={{ ['--c1' as string]: n.club.kit.primary }}>
        <Crest crest={n.club.crest} size={72} label={n.club.name} />
        <div class="grow">
          <Chip tone={n.kind === 'renewal' ? 'info' : n.kind === 'loan' ? 'violet' : 'gold'} icon="handshake">{t(`contract.kind.${n.kind}`)}</Chip>
          <h2 class="h1 ctr-club">{n.club.name}</h2>
          <div class="t-sm t-mid num">{t('contract.round', { n: n.round, max: n.maxRounds })}</div>
        </div>
        <MeterRing value={n.patience} size={84} color={patienceColor(n.patience)} label={t('contract.patience')} icon="hourglass" />
      </div>

      <div class="ctr-grid">
        <div class="stack">
          <Card pad="md" class="ctr-agent">
            <Avatar appearance={faceFor(agent?.name ?? 'agent')} size={52} background="#24345a" age={44} mood={0.4} />
            <div class="ctr-bubble">
              <div class="micro t-mid">{agent ? `${t('contract.agent.title')} · ${agent.name}` : t('contract.agent.title')}</div>
              <p>{agent ? lt(n.agentLine) : t('contract.agent.none')}</p>
              {agent && n.agentEstimate !== null && (
                <p class="t-sm ctr-estimate"><Icon name="info" size={14} /> {t('contract.agent.estimate', { amount: formatMoney(n.agentEstimate) })}</p>
              )}
            </div>
          </Card>

          {n.lastResponse && (
            <Card pad="md" variant="inset" class="ctr-response">
              <div class="micro t-mid">{t('contract.response')}</div>
              <p>“{lt(n.lastResponse)}”</p>
            </Card>
          )}

          <Card pad="md">
            <CardHeader title={t('contract.compare.you')} icon="sliders" />
            <div class="stack ctr-sliders">
              <Slider id="ctr-wage" label={t('contract.terms.wage')} value={terms.wage} min={r.wage[0]} max={r.wage[1]} step={moneyStep(r.wage[1])} format={formatMoney} marker={n.clubOffer.wage} markerLabel={t('contract.marker')} onChange={(v) => set({ wage: v })} />
              <Slider id="ctr-years" label={t('contract.terms.years')} value={terms.years} min={r.years[0]} max={r.years[1]} format={(v) => t('common.years', { n: v })} marker={n.clubOffer.years} markerLabel={t('contract.marker')} onChange={(v) => set({ years: v })} />
              <Slider id="ctr-sign" label={t('contract.terms.signingBonus')} value={terms.signingBonus} min={r.signingBonus[0]} max={r.signingBonus[1]} step={moneyStep(r.signingBonus[1])} format={fm} marker={n.clubOffer.signingBonus} markerLabel={t('contract.marker')} onChange={(v) => set({ signingBonus: v })} />
              <Slider id="ctr-goal" label={t('contract.terms.goalBonus')} value={terms.goalBonus} min={r.goalBonus[0]} max={r.goalBonus[1]} step={moneyStep(r.goalBonus[1])} format={fm} marker={n.clubOffer.goalBonus} markerLabel={t('contract.marker')} onChange={(v) => set({ goalBonus: v })} />
              <Switch
                label={t('contract.terms.includeRelease')}
                checked={terms.releaseClause !== null}
                onChange={(on) => set({ releaseClause: on ? (n.clubOffer.releaseClause ?? Math.round((r.releaseClause[0] + r.releaseClause[1]) / 2)) : null })}
              />
              {terms.releaseClause !== null && (
                <Slider id="ctr-release" label={t('contract.terms.releaseClause')} value={terms.releaseClause} min={r.releaseClause[0]} max={r.releaseClause[1]} step={moneyStep(r.releaseClause[1])} format={fm} marker={n.clubOffer.releaseClause ?? undefined} markerLabel={t('contract.marker')} onChange={(v) => set({ releaseClause: v })} />
              )}
              <div class="stack" style={{ ['--gap' as string]: '6px' }}>
                <span class="slider-label">{t('contract.terms.role')}</span>
                <Segmented label={t('contract.terms.role')} options={ROLES.map((x) => ({ id: x, label: t(`data.role.${x}`) }))} value={terms.role} onChange={(v) => set({ role: v })} />
              </div>
            </div>
          </Card>
        </div>

        <div class="stack">
          <Card pad="none" class="ctr-compare">
            <table class="ctr-table">
              <thead>
                <tr>
                  <th scope="col">{t('contract.compare.term')}</th>
                  <th scope="col">{t('contract.compare.club')}</th>
                  <th scope="col">{t('contract.compare.you')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.label}>
                    <th scope="row">{x.label}</th>
                    <td class="num">{x.club}</td>
                    <td class={`num ${x.diff > 0 ? 'ctr-up' : x.diff < 0 ? 'ctr-down' : ''}`}>
                      {x.you}
                      {x.diff !== 0 && <span class="sr-only"> ({x.diff > 0 ? t('contract.diffUp') : t('contract.diffDown')})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div class="ctr-actions">
            <Button variant="primary" size="lg" block icon="handshake" disabled={n.status !== 'open'} onClick={() => actions.proposeTerms(terms)}>
              {t('contract.propose')}
            </Button>
            <Button variant="gold" block icon="check" disabled={n.status !== 'open'} onClick={() => actions.acceptOffer()}>
              {t('contract.accept')}
            </Button>
            <Button variant="ghost" block icon="sign-out" onClick={() => setWalk(true)}>
              {t('contract.walk')}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={walk}
        onClose={() => setWalk(false)}
        title={t('contract.walkTitle')}
        size="sm"
        footer={
          <div class="row ctr-confirm">
            <Button variant="ghost" onClick={() => setWalk(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon="sign-out" onClick={() => { actions.walkAway(); setWalk(false) }}>{t('contract.walk')}</Button>
          </div>
        }
      >
        <p class="t-mid">{t('contract.walkText')}</p>
      </Modal>
    </Page>
  )
}

export function ContractScreen() {
  const s = gameState.value
  const n = negotiation.value
  if (!s) return <Page title={t('contract.title')}><EmptyState /></Page>
  if (!n) return <CurrentContract />
  if (n.status !== 'open') return <Outcome n={n} />
  return <Negotiation key={`${n.club.id}-${n.kind}`} n={n} />
}
