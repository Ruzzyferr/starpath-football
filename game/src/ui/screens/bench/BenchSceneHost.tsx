/**
 * Mounted once (App): opens the moment set in `benchScene` — a dialogue scene
 * (national camp, manager's office, team dinner), the doping test mini-game
 * or the 1-on-1 pair drill. Closing without finishing changes nothing.
 */
import { useRef } from 'preact/hooks'
import { lt } from '../../../i18n'
import { toast } from '../../components'
import { benchScene, closeMoment, finishDoping, finishScene, oneOnOneSession, applyOneOnOne, quickScene, sceneOf, type BenchScene } from '../../backend/scenes'
import { DrillOverlay } from '../training/DrillOverlay'
import { DialogueScene } from './DialogueScene'
import { DopingTest } from './DopingTest'

const toastLines = (lines: { tr: string; en: string }[]): void => {
  if (lines.length) toast(lines.map((l) => lt(l)).join(' '), 'success', 'check', 4500)
}

export function BenchSceneHost() {
  const open = benchScene.value
  if (!open) return null
  return <Moment key={open.kind} open={open} />
}

function Moment({ open }: { open: BenchScene }) {
  const close = closeMoment
  const quick = () => {
    toastLines(quickScene(open))
    close()
  }
  // The scene is built once when the moment opens (the save moves on when it finishes).
  const scene = useRef(sceneOf(open)).current
  const session = useRef(open.kind === 'oneOnOne' ? oneOnOneSession() : null).current

  if (open.kind === 'doping') {
    return <DopingTest taskId={open.taskId} onFinish={(p) => finishDoping(open.taskId, p)} onQuick={quick} onClose={close} />
  }
  if (open.kind === 'oneOnOne') {
    if (!session) {
      queueMicrotask(close)
      return null
    }
    const apply = (p: number | undefined) => {
      const o = applyOneOnOne(p)
      // The quick session has no result card: say what happened.
      if (p === undefined && o.ok) toast(lt(session.name), 'success', 'handshake', 4500)
      return o
    }
    return <DrillOverlay session={session} apply={apply} onClose={close} />
  }
  if (!scene) {
    queueMicrotask(close)
    return null
  }
  return <DialogueScene scene={scene} onFinish={(picks) => finishScene(open, picks)} onQuick={quick} onClose={close} />
}
