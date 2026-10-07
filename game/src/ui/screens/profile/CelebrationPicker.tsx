/** Profile card: pick the goal celebration (unlocked by fame, perks, achievements or the cosmetic pack). */
import '../../../styles/screens/moments.css'
import { lt } from '../../../i18n'
import { Card, CardHeader } from '../../components'
import { gameState, navigate } from '../../store'
import { celebrationChoice, celebrationRows, chooseCelebration } from '../../backend/celebration'

const L = {
  title: { tr: 'Gol Sevinci', en: 'Goal Celebration' },
  auto: { tr: 'Rastgele', en: 'Random' },
  store: { tr: 'Mağaza', en: 'Store' },
  hint: { tr: 'Gol attığında oynanır. Arası iyi olan takım arkadaşların sevince katılır.', en: 'Plays after your goals. Team-mates you get on with join in.' },
}

export function CelebrationPicker() {
  const s = gameState.value
  if (!s) return null
  const rows = celebrationRows(s)
  const choice = celebrationChoice(s)
  return (
    <Card pad="md" class="cel-card" data-testid="celebration-picker">
      <CardHeader title={lt(L.title)} icon="star" />
      <p class="t-xs t-lo cel-hint">{lt(L.hint)}</p>
      <div class="cel-grid" role="radiogroup" aria-label={lt(L.title)}>
        <button type="button" role="radio" aria-checked={choice === 'auto'} class={`cel-opt${choice === 'auto' ? ' is-on' : ''}`} onClick={() => chooseCelebration('auto')}>
          <span class="cel-ico" aria-hidden="true">🎲</span>
          <span class="cel-name">{lt(L.auto)}</span>
        </button>
        {rows.map((r) => (
          <button
            key={r.def.id}
            type="button"
            role="radio"
            aria-checked={choice === r.def.id}
            aria-disabled={!r.unlocked}
            class={`cel-opt${choice === r.def.id ? ' is-on' : ''}${r.unlocked ? '' : ' is-locked'}`}
            title={r.unlocked ? lt(r.def.name) : lt(r.def.unlock)}
            onClick={() => (r.unlocked ? chooseCelebration(r.def.id) : r.inStorePack ? navigate('store') : undefined)}
          >
            <span class="cel-ico" aria-hidden="true">{r.unlocked ? r.def.icon : '🔒'}</span>
            <span class="cel-name">{lt(r.def.name)}</span>
            {!r.unlocked && <span class="cel-lock t-xs t-lo">{lt(r.def.unlock)}</span>}
            {r.inStorePack && <span class="cel-store t-xs">{lt(L.store)} ›</span>}
          </button>
        ))}
      </div>
    </Card>
  )
}
