import { useRef, useState } from 'preact/hooks'
import '../../styles/screens/settings.css'
import { t } from '../../i18n'
import { Button, Card, Crest, EmptyState, Modal, Page, toast } from '../components'
import { Icon } from '../icons'
import { formatDuration, formatMoney, formatTimestamp, seasonLabel } from '../format'
import { thumbSvg } from '../../sim/game/saveHistory'
import { actions, data, gameState, navigate, type SaveSlotInfo } from '../store'

type Pending = { kind: 'delete' | 'overwrite'; slot: SaveSlotInfo } | null

function readSlots(): SaveSlotInfo[] {
  try {
    const s = data.saveSlots()
    if (s.length) return s
  } catch {
    /* backend not ready */
  }
  return [1, 2, 3].map((slot) => ({ slot, empty: true }))
}

export function SavesScreen() {
  const [, setTick] = useState(0)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importSlot = useRef(1)
  const state = gameState.value
  const slots = readSlots()
  const activeSlot = state?.meta.slot ?? null
  const refresh = () => setTick((n) => n + 1)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
      refresh()
    }
  }

  const save = (slot: number) =>
    run(`save${slot}`, async () => {
      try {
        await actions.save(slot)
      } catch (e) {
        // Say why (storage full, native write refused…) instead of a generic error.
        const reason = String((e as Error)?.message ?? e).slice(0, 120) || t('common.error')
        toast(t('saves.saveFailed', { reason }), 'error')
        return
      }
      toast(t('saves.saved', { n: slot }), 'success', 'floppy')
    })

  const load = (slot: number) =>
    run(`load${slot}`, async () => {
      const ok = await actions.load(slot)
      if (ok) {
        toast(t('saves.loaded'), 'success')
        navigate('home', undefined, { tab: true })
      } else toast(t('saves.loadFailed'), 'error')
    })

  const del = (slot: number) =>
    run(`del${slot}`, async () => {
      await actions.deleteSave(slot)
      toast(t('saves.deleted', { n: slot }), 'info', 'trash')
    })

  const exportSlot = (slot: number) =>
    run(`exp${slot}`, async () => {
      const json = await actions.exportSave(slot)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `starpath-slot-${slot}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(t('saves.exported'), 'success', 'download')
    })

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const slot = importSlot.current
    await run(`imp${slot}`, async () => {
      const text = await file.text()
      const ok = await actions.importSave(text, slot)
      toast(ok ? t('saves.imported', { n: slot }) : t('saves.importFailed'), ok ? 'success' : 'error', ok ? 'upload' : undefined)
    })
  }

  const confirmPending = () => {
    if (!pending) return
    const p = pending
    setPending(null)
    if (p.kind === 'delete') void del(p.slot.slot)
    else void save(p.slot.slot)
  }

  return (
    <Page title={t('saves.title')} sub={t('saves.sub')} backTo={state ? 'menu' : 'title'} showBack>
      <input ref={fileRef} type="file" accept="application/json,.json" class="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e)} />
      <div class="saves-list">
        {slots.map((s) => {
          const active = s.slot === activeSlot
          return (
            <Card key={s.slot} class={`saves-card${s.empty ? ' is-empty' : ''}${active ? ' is-active' : ''}`} pad="none">
              <div class="saves-card-top">
                {!(s.thumb && !s.empty) && <span class="saves-slot-no score-font" aria-hidden="true">{s.slot}</span>}
                <div class="grow">
                  <div class="row">
                    <span class="micro t-lo">{t('saves.slot', { n: s.slot })}</span>
                    {active && <span class="chip chip-pos chip-solid">{t('saves.current')}</span>}
                  </div>
                  {s.empty ? (
                    <h2 class="h3 t-mid">{t('saves.empty')}</h2>
                  ) : (
                    <h2 class="h3 truncate">{s.heroName}</h2>
                  )}
                </div>
                {!s.empty && s.thumb && <span class="saves-thumb" data-testid={`slot-thumb-${s.slot}`} role="img" aria-label={t('saves.thumbAlt', { name: s.heroName ?? '' })} dangerouslySetInnerHTML={{ __html: thumbSvg(s.thumb, 48) }} />}
                {!s.empty && s.crest && <Crest crest={s.crest} size={s.thumb ? 36 : 44} label={s.clubName} />}
              </div>

              {s.empty ? (
                <p class="saves-empty-text t-sm t-lo">{t('saves.emptyText')}</p>
              ) : (
                <dl class="saves-meta">
                  <div><dt>{t('common.season')}</dt><dd class="num">{s.season != null ? t('saves.seasonWeek', { season: seasonLabel(s.season), week: (s.week ?? 0) + 1 }) : '—'}</dd></div>
                  <div><dt>{t('common.ovr')}</dt><dd class="num t-gold">{s.ovr ?? '—'}</dd></div>
                  <div><dt>{t('common.money')}</dt><dd class="num">{s.money != null ? formatMoney(s.money, { compact: true }) : '—'}</dd></div>
                  <div><dt>{t('saves.lastSaved')}</dt><dd class="num">{s.updatedAt ? formatTimestamp(s.updatedAt) : '—'}</dd></div>
                  <div><dt>{t('saves.playTime')}</dt><dd class="num">{s.playTimeSec != null ? formatDuration(s.playTimeSec) : '—'}</dd></div>
                  <div><dt>{t('nav.club')}</dt><dd class="truncate">{s.clubName ?? '—'}</dd></div>
                </dl>
              )}

              <div class="saves-actions">
                {!s.empty && (
                  <Button variant={active ? 'secondary' : 'primary'} size="sm" icon="play" loading={busy === `load${s.slot}`} onClick={() => void load(s.slot)}>
                    {t('saves.load')}
                  </Button>
                )}
                {state && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="floppy"
                    loading={busy === `save${s.slot}`}
                    onClick={() => (s.empty || active ? void save(s.slot) : setPending({ kind: 'overwrite', slot: s }))}
                  >
                    {s.empty || active ? t('saves.saveHere') : t('saves.overwrite')}
                  </Button>
                )}
                {s.empty && !state && (
                  <Button variant="secondary" size="sm" icon="plus" onClick={() => navigate('newCareer')}>
                    {t('saves.newCareer')}
                  </Button>
                )}
                {!s.empty && (
                  <Button variant="ghost" size="sm" icon="download" loading={busy === `exp${s.slot}`} onClick={() => void exportSlot(s.slot)}>
                    {t('saves.export')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="upload"
                  loading={busy === `imp${s.slot}`}
                  onClick={() => {
                    importSlot.current = s.slot
                    fileRef.current?.click()
                  }}
                >
                  {t('saves.import')}
                </Button>
                {!s.empty && (
                  <button type="button" class="icon-btn icon-btn-ghost saves-del" aria-label={`${t('saves.delete')} ${t('saves.slot', { n: s.slot })}`} onClick={() => setPending({ kind: 'delete', slot: s })}>
                    <Icon name="trash" size={20} />
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      {slots.every((s) => s.empty) && !state && (
        <EmptyState icon="floppy" title={t('saves.empty')} text={t('saves.emptyText')} />
      )}
      <p class="saves-safety t-xs t-lo"><Icon name="shield-check" size={16} /> {t('saves.safety')}</p>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        size="sm"
        title={pending ? t(pending.kind === 'delete' ? 'saves.deleteTitle' : 'saves.overwriteTitle', { n: pending.slot.slot }) : ''}
        footer={
          <div class="row-between set-modal-foot">
            <Button variant="ghost" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={pending?.kind === 'delete' ? 'trash' : 'floppy'} onClick={confirmPending} haptic="heavy">
              {pending?.kind === 'delete' ? t('saves.delete') : t('saves.overwrite')}
            </Button>
          </div>
        }
      >
        {pending && (
          <p class="t-mid">{t(pending.kind === 'delete' ? 'saves.deleteText' : 'saves.overwriteText', { name: pending.slot.heroName ?? '' })}</p>
        )}
      </Modal>
    </Page>
  )
}
