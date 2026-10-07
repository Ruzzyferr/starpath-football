import { useState } from 'preact/hooks'
import { hashString } from '../../../core/rng'
import { lt, t } from '../../../i18n'
import { Avatar, Button, Card, EmptyState, Sparkline, toast } from '../../components'
import { formatCompact } from '../../format'
import { Icon, type IconName } from '../../icons'
import { actions, data, gameState, heroClub, type PostKind, type SocialPostView } from '../../store'

const KINDS: PostKind[] = ['training', 'family', 'fans', 'charity', 'luxury', 'provocative']
const KIND_ICON: Record<PostKind, IconName> = {
  training: 'barbell', family: 'house', fans: 'megaphone', charity: 'hand-heart', luxury: 'watch', provocative: 'fire',
}
const KIND_RISK: Record<PostKind, 'safe' | 'low' | 'medium' | 'high'> = {
  training: 'safe', family: 'safe', fans: 'safe', charity: 'low', luxury: 'medium', provocative: 'high',
}

function Post({ p }: { p: SocialPostView }) {
  const s = gameState.value
  const club = heroClub.value
  const h = hashString(p.handle)
  const app = p.isHero && s
    ? s.hero.appearance
    : { skin: h % 10, hairStyle: (h >>> 3) % 15, hairColor: (h >>> 7) % 10, beard: (h >>> 11) % 8, eyeColor: (h >>> 14) % 6, face: (h >>> 17) % 6, accessory: 0 }
  return (
    <article class={`soc-post soc-${p.kind}${p.isHero ? ' is-hero' : ''}`}>
      <Avatar appearance={app} size={42} background={p.isHero ? (club?.colors.primary ?? '#24345a') : '#1b2740'} />
      <div class="grow soc-post-main">
        <div class="soc-post-head">
          <span class="soc-author truncate">{p.author}</span>
          {p.verified && <Icon name="verified" size={15} class="soc-verified" />}
          <span class="soc-handle truncate">@{p.handle}</span>
          <span class="soc-time">· {p.weekAgo === 0 ? t('life.social.now') : t('life.social.weeksAgo', { n: p.weekAgo })}</span>
        </div>
        <p class="soc-text">{lt(p.text)}</p>
        <div class="soc-meta">
          <span><Icon name="heart" size={15} /> <span class="num">{formatCompact(p.likes, undefined, 1000)}</span><span class="sr-only">{t('life.social.likes', { n: p.likes })}</span></span>
          <span><Icon name="chat" size={15} /> <span class="num">{formatCompact(p.comments, undefined, 1000)}</span><span class="sr-only">{t('life.social.comments', { n: p.comments })}</span></span>
        </div>
      </div>
    </article>
  )
}

export function Social() {
  const s = gameState.value
  const [kind, setKind] = useState<PostKind>('training')
  const [mine, setMine] = useState<SocialPostView[]>([])
  if (!s) return null
  const club = heroClub.value
  const feed = data.socialFeed()
  const ids = new Set(feed.map((p) => p.id))
  const all = [...mine.filter((p) => !ids.has(p.id)), ...feed]
  const hist = data.followerHistory()
  const growth = hist.length > 1 ? hist[hist.length - 1] - hist[0] : 0
  const handle = (s.hero.nickname || `${s.hero.firstName}${s.hero.lastName}`).toLowerCase().replace(/\s+/g, '')

  const publish = () => {
    const p = actions.post(kind)
    setMine((m) => [p, ...m])
    toast(t('life.social.posted'), 'success', 'instagram')
  }

  return (
    <div class="soc-layout">
      <Card variant="raised" class="soc-profile">
        <div class="soc-profile-head">
          <Avatar appearance={s.hero.appearance} size={72} background={club?.colors.primary ?? '#24345a'} shirt={club?.colors.primary} shirtTrim={club?.colors.secondary} ring="var(--accent-violet)" />
          <div class="grow">
            <div class="row">
              <h3 class="h3 truncate">{s.hero.firstName} {s.hero.lastName}</h3>
              {s.hero.reputation >= 40 && <Icon name="verified" size={18} class="soc-verified" />}
            </div>
            <div class="t-sm t-lo">@{handle}</div>
            <div class="soc-followers"><span class="score-font">{formatCompact(s.life.followers, undefined, 1000)}</span> <span class="t-mid">{t('life.social.followers')}</span></div>
          </div>
        </div>
        <div class="soc-growth">
          <div class="row-between">
            <span class="micro t-mid">{t('life.social.growth')}</span>
            <span class={`num ${growth >= 0 ? 't-pos' : 't-neg'}`}>{growth >= 0 ? '+' : '−'}{formatCompact(Math.abs(growth), undefined, 1000)}</span>
          </div>
          <Sparkline values={hist} width={280} height={48} color="var(--accent-violet)" label={t('life.social.growth')} />
        </div>
      </Card>

      <div class="stack soc-col">
        <Card class="soc-compose">
          <label class="label t-mid">{t('life.social.compose')}</label>
          <div class="soc-kinds" role="radiogroup" aria-label={t('life.social.composeLabel')}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === kind}
                class={`soc-kind risk-${KIND_RISK[k]}${k === kind ? ' is-active' : ''}`}
                onClick={() => setKind(k)}
              >
                <Icon name={KIND_ICON[k]} size={18} />
                <span>{t(`data.post.${k}`)}</span>
              </button>
            ))}
          </div>
          <p class={`soc-risk t-xs risk-${KIND_RISK[kind]}`}><Icon name={KIND_RISK[kind] === 'high' ? 'warning' : 'info'} size={14} /> {t(`life.social.risk.${kind}`)}</p>
          <Button variant="primary" icon="camera" onClick={publish} block>{t('life.social.post')}</Button>
        </Card>

        <section class="soc-feed" aria-label={t('life.social.feed')}>
          {all.length === 0 ? <EmptyState icon="instagram" text={t('life.social.empty')} /> : all.map((p) => <Post key={p.id} p={p} />)}
        </section>
      </div>
    </div>
  )
}
