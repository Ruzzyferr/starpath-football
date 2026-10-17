/**
 * TrainingScene — renders a headless {@link Drill} on the training pitch and
 * feeds it input. It owns no rules: it projects the drill's {@link DrillView}
 * with the same 2.5D view as the match player, draws cones/gates/targets,
 * plays sounds/haptics for {@link DrillEvent}s (respecting the sound and
 * vibration settings) and shows a compact HUD (score, clock, streak, meters,
 * countdown, touch buttons, final grade).
 *
 * Public API: {@link startDrill}.
 */
import Phaser from 'phaser'
import type { KitColors, Lang } from '../../core/types'
import { PITCH_LENGTH, PITCH_WIDTH } from '../../sim/match/types'
import { ballTexture, drawGoal, drawPitch, grassGrainTexture, keeperKit, utilTextures, type NetRipple } from '../art'
import { FIG_RES, FIG_SCALE, FigureRig, figureHeadTexture, figureKitSheet, figureNumberTexture, figureSelfCheck, figureSkinSheet, groundDir, skinTone, type FigPose } from '../figures'
import { Sfx } from '../audio'
import { InputController, type FrameIntent } from '../input'
import { probeKick } from '../touchProbe'
import type { AimAssist } from '../kick'
import { clampN } from '../model'
import { createMatchGame } from '../MatchScene'
import { guardPhaser, type GuardHandle } from '../phaserGuard'
import type { QualityProfile } from '../quality'
import { canvasSafeInsets } from '../../platform/viewport'
import { pauseGate, wireAppPause } from '../pauseGate'
import { PPM, TILT, ZS, depthFor, pitchDirToScreen, project, screenDirToPitch, unproject } from '../view'
import type { ActorView, Drill, DrillEvent, DrillKind, DrillLabel, DrillPrompt, DrillResult, DrillView, Grade, Tone } from './types'
import { crumb } from '../../telemetry/breadcrumbs'

// ───────────────────────── Public types ─────────────────────────

export interface DrillSceneOptions {
  lang: Lang
  heroKit: KitColors
  settings: { sound: number; vibration: boolean; aimAssist: AimAssist; reducedMotion?: boolean }
  /** Short title shown in the HUD (e.g. "Şut Antrenmanı"). */
  title?: string
  /** Players' gender (female heads get ponytails/buns; dummies stay plain). */
  gender?: 'male' | 'female'
  /** Graphics quality profile (render scale cap). */
  quality?: QualityProfile
  /** The player chose Low graphics: Canvas renderer from the start. */
  canvasRenderer?: boolean
  /** Exit pressed on the render-failure panel (nothing could draw the drill). */
  onExit?: () => void
}

export interface DrillHandle {
  game: Phaser.Game
  /** Abort without calling onDone. */
  stop(): void
}

interface SceneData {
  drill: Drill
  opts: DrillSceneOptions
  onDone: (r: DrillResult) => void
}

const SCENE_KEY = 'starpath-training'

// ───────────────────────── Strings ─────────────────────────

type Strings = {
  prompt: Record<DrillPrompt, string>
  label: Record<DrillLabel, string>
  hud: { combo: string; level: string; stamina: string; beat: string; power: string; timing: string; go: string; grade: string; points: string; wind: string }
  buttons: { sprint: string; skill: string; loft: string; go: string; dive: string; throw: string; cross: string; head: string; tackle: string }
}

const T: Record<Lang, Strings> = {
  tr: {
    prompt: {
      finishing: 'Kaydır / basılı tutup bırak: şut. Yanan bölgeyi vur!',
      setPiece: 'Falso kapısı: barajı aş, iki direğin arasına gönder!',
      passGround: 'YERDEN: arkadaşına dokun / tıkla — topu kapıdan geçir',
      passLoft: 'HAVADAN: kaydır / basılı tutup bırak — mankenlerin üstünden aşırt',
      dribble: 'Kapılardan sırayla geç, kon\'lara çarpma',
      skillNow: 'ŞİMDİ! Çalım (SKILL / Boşluk / çift dokunuş)',
      fitnessRun: 'DEPAR basılı: hızlan — ama dayanıklılığına dikkat',
      fitnessWait: 'Bip sesini bekle…',
      fitnessGo: 'Bip\'te çık: dokun / Boşluk!',
      keeper: 'Kaydır / tıkla: o yöne uzan. Joystick: adım at',
      crossing: 'Koşucu bölgeye varırken top da orada olsun: bölgeye dokun / kaydır',
      crossNow: 'ŞİMDİ! Ortayı aç (ORTA / Boşluk / bölgeye dokun)',
      heading: 'İşarete geç. Top gelince zıpla: kaleye dokun / kaydır',
      headNow: 'ZIPLA! (KAFA / Boşluk / kaleye dokun)',
      tackling: 'Önünde kal, top açılınca kap. Kaydır: kayarak müdahale',
      tackleNow: 'ŞİMDİ! Topu kap (KAP / Boşluk / dokun)',
      claim: 'Halkanın altına geç: orta gelince eller topu alır',
      distribute: 'Topu elinde: koşan arkadaşına dokun / kaydır. 6 sn içinde at!',
      switch: 'Oyunu değiştir: kanattaki koşucuya uzun top — bölgeye dokun / kaydır',
      diving: 'Köşelere plonjon: kaydır / tıkla, tam uzanış kurtarışı +4',
      sprintSet: 'Yerine geç… ışığı bekle (erken çıkma!)',
      sprintGo: 'YEŞİL! Çık: dokun / Boşluk!',
      sprintRun: 'DEPAR basılı: patla! Çizgide dokun: göğüs at',
      braceNow: 'OMUZ GELİYOR! Şimdi dokun: gövdeni sabitle',
      reading: 'Pasörün bakışını oku: pas yoluna gir (joystick / dokun)',
      interceptNow: 'Yolda kal: top menziline girince keser',
      pressing: 'Topu alan oyuncuya bas! DEPAR hızlı ama yorar',
      pressNow: 'BAS! Pas vermeden 2 m içine gir',
      ready: 'Hazır ol…',
      done: 'Antrenman bitti',
    },
    label: {
      goal: 'GOL', target: 'HEDEF!', saved: 'KURTARDI', miss: 'AUT', post: 'DİREK', blocked: 'BARAJ',
      pass: 'PAS', gate: 'KAPI', gateMissed: 'KAPI KAÇTI', wrongType: 'YANLIŞ PAS', overhit: 'ÇOK SERT', quick: 'HIZLI!',
      cone: 'KON!', perfect: 'MÜKEMMEL!', good: 'İYİ', early: 'ERKEN', late: 'GEÇ', tackled: 'KAPTIRDIN', lap: 'TUR!',
      shuttle: 'TAMAM', perfectStart: 'TAM ZAMANINDA!', goodStart: 'İYİ ÇIKIŞ', lateArrival: 'GEÇ KALDIN', gassed: 'NEFESSİZ!', out: 'AUT',
      save: 'KURTARIŞ!', held: 'YAKALADI!', conceded: 'GOL YEDİN', wide: 'DIŞARI',
      delivery: 'İYİ ORTA', won: 'KAPTIN!', foul: 'FAUL', beaten: 'GEÇİLDİN', whiff: 'BOŞA',
      falseStart: 'ERKEN ÇIKIŞ', dip: 'GÖĞÜS ATTI!', braced: 'SAĞLAM!', stumble: 'SENDELEDİN', intercept: 'KESTİN!', read: 'OKUDUN!', pressed: 'BASTIN!', escaped: 'KAÇIRDIN',
    },
    hud: { combo: 'SERİ', level: 'SEVİYE', stamina: 'DAYANIKLILIK', beat: 'BİP', power: 'GÜÇ', timing: 'ZAMANLAMA', go: 'BAŞLA!', grade: 'NOT', points: 'PUAN', wind: 'RÜZGÂR {n} KM/SA' },
    buttons: { sprint: 'DEPAR', skill: 'ÇALIM', loft: 'HAVA', go: 'ÇIK', dive: 'UZAN', throw: 'AT', cross: 'ORTA', head: 'KAFA', tackle: 'KAP' },
  },
  en: {
    prompt: {
      finishing: 'Swipe / hold & release to shoot. Hit the lit zone!',
      setPiece: 'Curl gate: over the wall and between the posts!',
      passGround: 'GROUND: tap / click your team-mate — through the gate',
      passLoft: 'LOFT: swipe / hold & release — over the mannequins',
      dribble: 'Take the gates in order, don\'t clip the cones',
      skillNow: 'NOW! Skill move (SKILL / Space / double tap)',
      fitnessRun: 'Hold SPRINT to speed up — mind your stamina',
      fitnessWait: 'Wait for the beep…',
      fitnessGo: 'Go on the beep: tap / Space!',
      keeper: 'Swipe / click to dive that way. Stick: step across',
      crossing: 'Land it in the zone as the runner arrives: tap / swipe at the zone',
      crossNow: 'NOW! Whip it in (CROSS / Space / tap the zone)',
      heading: 'Get on the mark. Jump as it comes: tap / swipe at the goal',
      headNow: 'JUMP! (HEAD / Space / tap the goal)',
      tackling: 'Stay goal-side, nick it when it is exposed. Swipe: slide tackle',
      tackleNow: 'NOW! Win the ball (TACKLE / Space / tap)',
      claim: 'Get under the ring: the hands take the cross',
      distribute: 'Ball in hand: tap / swipe at a runner. Release within 6 s!',
      switch: 'Switch play: long ball to the winger on the far flank — tap / swipe at the zone',
      diving: 'Corner shots: swipe / click to dive, full-stretch saves +4',
      sprintSet: 'On your mark… wait for the light (no false starts!)',
      sprintGo: 'GREEN! Go: tap / Space!',
      sprintRun: 'Hold SPRINT: explode! Tap at the line to dip',
      braceNow: 'SHOULDER COMING! Tap now to brace',
      reading: 'Read the passer’s eyes: step into the lane (stick / tap)',
      interceptNow: 'Hold the lane: the ball is yours once it is in reach',
      pressing: 'Close down whoever gets the ball! SPRINT is faster but tiring',
      pressNow: 'PRESS! Get within 2 m before he passes',
      ready: 'Get ready…',
      done: 'Session over',
    },
    label: {
      goal: 'GOAL', target: 'TARGET!', saved: 'SAVED', miss: 'WIDE', post: 'POST', blocked: 'WALL',
      pass: 'PASS', gate: 'GATE', gateMissed: 'MISSED GATE', wrongType: 'WRONG PASS', overhit: 'TOO HARD', quick: 'QUICK!',
      cone: 'CONE!', perfect: 'PERFECT!', good: 'GOOD', early: 'EARLY', late: 'LATE', tackled: 'TACKLED', lap: 'LAP!',
      shuttle: 'MADE IT', perfectStart: 'ON THE BEEP!', goodStart: 'GOOD START', lateArrival: 'TOO LATE', gassed: 'GASSED!', out: 'OUT',
      save: 'SAVE!', held: 'HELD!', conceded: 'CONCEDED', wide: 'WIDE',
      delivery: 'GOOD BALL', won: 'WON IT!', foul: 'FOUL', beaten: 'BEATEN', whiff: 'MISSED',
      falseStart: 'FALSE START', dip: 'DIP!', braced: 'BRACED!', stumble: 'STUMBLED', intercept: 'CUT OUT!', read: 'READ IT!', pressed: 'PRESSED!', escaped: 'GOT AWAY',
    },
    hud: { combo: 'STREAK', level: 'LEVEL', stamina: 'STAMINA', beat: 'BEEP', power: 'POWER', timing: 'TIMING', go: 'GO!', grade: 'GRADE', points: 'PTS', wind: 'WIND {n} KM/H' },
    buttons: { sprint: 'SPRINT', skill: 'SKILL', loft: 'LOFT', go: 'GO', dive: 'DIVE', throw: 'THROW', cross: 'CROSS', head: 'HEAD', tackle: 'TACKLE' },
  },
}

/** Per-drill touch controls: action-button label, sprint button, joystick, level badge in the title. */
const CONTROLS: Record<DrillKind, { button: keyof Strings['buttons'] | null; sprint: boolean; stick: boolean; level: boolean }> = {
  finishing: { button: null, sprint: false, stick: false, level: false },
  passing: { button: 'loft', sprint: false, stick: false, level: false },
  dribbling: { button: 'skill', sprint: true, stick: true, level: true },
  fitness: { button: 'go', sprint: true, stick: false, level: true },
  // The keeper drill has no sprint (it never read the button): DIVE + the stick only.
  goalkeeping: { button: 'dive', sprint: false, stick: true, level: false },
  crossing: { button: 'cross', sprint: false, stick: false, level: false },
  heading: { button: 'head', sprint: false, stick: true, level: false },
  tackling: { button: 'tackle', sprint: true, stick: true, level: false },
  distribution: { button: 'throw', sprint: false, stick: true, level: false },
  sprint: { button: 'go', sprint: true, stick: false, level: true },
  interception: { button: null, sprint: true, stick: true, level: false },
}

const TONE: Record<Tone, number> = {
  gold: 0xffd23f, white: 0xffffff, green: 0x5dff8a, red: 0xff4f5e, blue: 0x6ec8ff, orange: 0xff8a1f, dim: 0x9aa4b2,
}
const GRADE_COLOR: Record<Grade, string> = { S: '#ffd23f', A: '#5dff8a', B: '#6ec8ff', C: '#ffffff', D: '#ff8a8a' }

const OPP_KIT: KitColors = { primary: '#eef1f5', secondary: '#c0392b', pattern: 'plain' }
const DUMMY_KIT: KitColors = { primary: '#f5c400', secondary: '#1b1b1b', pattern: 'hoops' }

const BALL_D = 0.22 * PPM * 2.1
const zpx = (z: number) => z * PPM * ZS

interface PlayerView {
  id: string
  c: Phaser.GameObjects.Container
  shadow: Phaser.GameObjects.Image
  cast: Phaser.GameObjects.Image
  /** Facing chevron + drill highlight ring (redrawn only while highlighted). */
  legs: Phaser.GameObjects.Graphics
  chev: Phaser.GameObjects.Image
  rig: FigureRig
  ring: Phaser.GameObjects.Image | null
  phase: number
  kickT: number
  x: number
  y: number
  lastX: number
  lastY: number
  seen: boolean
}

interface Floater {
  text: Phaser.GameObjects.Text
  wx: number
  wy: number
  t: number
  life: number
}

/** The training pitch scene. Create through {@link startDrill}. */
/** Training keeper figure size (the reach is the keeper's attributes; this is how big he looks). */
export const TRAINING_KEEPER_SCALE = 0.86

export class TrainingScene extends Phaser.Scene {
  private data0!: SceneData
  private drill!: Drill
  private input0!: InputController
  private sfx!: Sfx
  private s!: Strings
  private ui = 1

  private worldLayer!: Phaser.GameObjects.Layer
  private hudLayer!: Phaser.GameObjects.Layer
  private uiCam!: Phaser.Cameras.Scene2D.Camera

  private views = new Map<string, PlayerView>()
  private ballImg!: Phaser.GameObjects.Image
  private ballShadow!: Phaser.GameObjects.Image
  private fieldG!: Phaser.GameObjects.Graphics
  private overG!: Phaser.GameObjects.Graphics
  private netG: Partial<Record<'east' | 'west', Phaser.GameObjects.Graphics>> = {}
  private ripple: Record<'east' | 'west', NetRipple | null> = { east: null, west: null }
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter

  private hudG!: Phaser.GameObjects.Graphics
  private titleText!: Phaser.GameObjects.Text
  private pointsText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private clockText!: Phaser.GameObjects.Text
  private windText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private countText!: Phaser.GameObjects.Text
  private gradeText!: Phaser.GameObjects.Text
  private gradeSub!: Phaser.GameObjects.Text
  private meterTexts: Phaser.GameObjects.Text[] = []
  private sprintText!: Phaser.GameObjects.Text
  private skillText!: Phaser.GameObjects.Text
  private flash!: Phaser.GameObjects.Rectangle
  private floaters: Floater[] = []

  private cam = { x: 0, y: 0, zoom: 1, punch: 0 }
  private elapsed = 0
  private lastIntent: FrameIntent | null = null
  private endT = -1
  private doneCalled = false
  private ambienceSet = false
  private lastPoints = 0

  constructor() {
    super({ key: SCENE_KEY })
  }

  init(data: SceneData): void {
    this.data0 = data
    this.drill = data.drill
    this.views = new Map()
    this.floaters = []
    this.meterTexts = []
    this.elapsed = 0
    this.endT = -1
    this.doneCalled = false
    this.ambienceSet = false
    this.netG = {}
    this.ripple = { east: null, west: null }
  }

  create(): void {
    // Breadcrumbs (telemetry/breadcrumbs): a hang inside create leaves the last stage behind.
    crumb('scene-create', 'drill')
    this.events.once(Phaser.Scenes.Events.CREATE, () => crumb('scene-ready', 'drill'))
    const { opts } = this.data0
    this.ui = (this.registry.get('dpr') as number | undefined) ?? 1
    this.s = T[opts.lang] ?? T.en
    this.sfx = new Sfx(opts.settings.sound)
    // Dev/e2e: expose the drill scene (touch shooting probes). Stripped from production builds.
    if (import.meta.env.DEV) (globalThis as { __spTraining?: TrainingScene }).__spTraining = this
    this.cameras.main.setBackgroundColor('#0b1410')
    this.worldLayer = this.add.layer()
    this.hudLayer = this.add.layer()
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.cameras.main.ignore(this.hudLayer)
    this.uiCam.ignore(this.worldLayer)
    utilTextures(this)
    crumb('scene-textures')

    const view = this.drill.view()
    this.bakePitch()
    crumb('scene-pitch')
    for (const end of view.goals) {
      const gx = end === 'east' ? PITCH_LENGTH : 0
      const back = end === 'east' ? gx + 2 : gx - 2
      const net = this.addW(this.add.graphics().setDepth(depthFor(back, end === 'east' ? 0 : 5)))
      if (end === 'west') net.setAlpha(0.75)
      drawGoal(net, end, 'net', null)
      this.netG[end] = net
      const fg = this.addW(this.add.graphics().setDepth(depthFor(gx, end === 'east' ? 0.5 : 4)))
      drawGoal(fg, end, 'frame', null)
    }
    this.fieldG = this.addW(this.add.graphics().setDepth(depthFor(PITCH_LENGTH + 1)))
    this.overG = this.addW(this.add.graphics().setDepth(5_000_000))
    this.ballShadow = this.addW(this.add.image(0, 0, 'fx_shadow').setScale((0.5 * PPM) / 64, ((0.5 * PPM) / 32) * TILT * 0.5))
    this.ballImg = this.addW(this.add.image(0, 0, ballTexture(this, 'clear')).setScale(BALL_D / 64))
    this.sparks = this.addW(
      this.add.particles(0, 0, 'fx_sq', {
        emitting: false, speed: { min: 60, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 240,
        lifespan: { min: 400, max: 900 }, scale: { start: 0.7, end: 0.1 }, alpha: { start: 1, end: 0 },
        tint: [0xffd23f, 0xffffff, 0x5dff8a],
      }),
    ).setDepth(4_000_000)
    this.buildHud()
    crumb('scene-hud')

    this.input0 = new InputController(this.game.canvas, {
      toWorld: (gx, gy) => this.screenToPitch(gx, gy),
      screenDirToWorld: (dx, dy) => screenDirToPitch(dx, dy),
      size: () => ({ w: this.scale.width, h: this.scale.height }),
      ui: () => this.ui,
      insets: canvasSafeInsets(this.game.canvas, () => this.ui),
    })
    // Hidden buttons must not swallow taps either (the keeper drill has no SPRINT, finishing no button).
    const ctl = CONTROLS[this.drill.kind]
    this.input0.setLegacyButtons(ctl.sprint, ctl.button !== null)
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    const f = project(view.focus.x, view.focus.y)
    this.cam.x = f.x
    this.cam.y = f.y
    this.cam.zoom = this.baseZoom(view.span) * 0.85
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup())
    // Shared pause source (game/pauseGate): the drill hint card / background freezes the drill.
    wireAppPause()
    this.gateTok = pauseGate.attach()
    this.gateText = null
  }

  private gateTok = 0

  /** "3 / 2 / 1" resume beat over the pitch while the pause gate holds the drill. */
  private gateText: Phaser.GameObjects.Text | null = null

  private drawGate(): void {
    const beat = pauseGate.beat()
    if (!beat) {
      this.gateText?.setVisible(false)
      return
    }
    if (!this.gateText) this.gateText = this.text(56).setDepth(9_000_000)
    this.gateText.setText(beat).setVisible(true).setPosition(this.scale.width / 2, this.scale.height / 2)
  }

  private cleanup(): void {
    pauseGate.detach(this.gateTok)
    this.input0?.dispose()
    this.sfx?.dispose()
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
  }

  private addW<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.worldLayer.add(o)
    return o
  }

  private addH<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.hudLayer.add(o)
    return o
  }

  private text(size: number, color = '#ffffff', bold = true): Phaser.GameObjects.Text {
    return this.addH(
      this.add
        .text(0, 0, '', {
          fontFamily: "system-ui, 'Segoe UI', Roboto, Arial, sans-serif",
          fontSize: `${Math.round(size * this.ui)}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color,
          stroke: '#000000',
          strokeThickness: Math.max(2, Math.round(size * this.ui * 0.12)),
        })
        .setOrigin(0.5),
    )
  }

  private buildHud(): void {
    this.flash = this.addH(this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0, 0).setAlpha(0))
    this.hudG = this.addH(this.add.graphics())
    this.titleText = this.text(12, '#9fe8ff').setOrigin(0, 0.5)
    this.titleText.setText((this.data0.opts.title ?? '').toLocaleUpperCase(this.data0.opts.lang === 'tr' ? 'tr-TR' : 'en-US'))
    this.pointsText = this.text(26, '#ffd23f').setOrigin(0, 0.5)
    this.comboText = this.text(13, '#5dff8a').setOrigin(0, 0.5)
    this.clockText = this.text(20, '#ffffff').setOrigin(1, 0.5)
    this.windText = this.text(12, '#9fe8ff').setOrigin(1, 0.5).setAlpha(0)
    this.promptText = this.text(15, '#ffffff', false)
    this.countText = this.text(72, '#ffd23f').setAlpha(0)
    this.gradeText = this.text(96, '#ffd23f').setAlpha(0)
    this.gradeSub = this.text(20, '#ffffff').setAlpha(0)
    for (let i = 0; i < 2; i++) this.meterTexts.push(this.text(10, '#ffffff').setOrigin(0, 0.5).setAlpha(0))
    this.sprintText = this.text(12, '#ffffff')
    this.skillText = this.text(11, '#ffffff')
    this.sprintText.setText(this.s.buttons.sprint)
  }

  private hudTop(): number {
    return 52 * this.ui
  }

  private layout(): void {
    const w = this.scale.width
    const h = this.scale.height
    const u = this.ui
    this.cameras.main.setSize(w, h)
    this.uiCam.setSize(w, h)
    this.flash.setSize(w, h)
    this.titleText.setPosition(14 * u, 13 * u)
    this.pointsText.setPosition(14 * u, 34 * u)
    // Leave room for the DOM Quit button at the top right of the band.
    this.clockText.setPosition(w - 104 * u, 26 * u)
    this.promptText.setPosition(w / 2, this.hudTop() + 22 * u)
    this.promptText.setWordWrapWidth(w * 0.9)
    this.countText.setPosition(w / 2, h * 0.42)
    this.gradeText.setPosition(w / 2, h * 0.4)
    this.gradeSub.setPosition(w / 2, h * 0.4 + 70 * u)
  }

  private baseZoom(span: number): number {
    const w = this.scale.width
    const h = this.scale.height - this.hudTop()
    // Fit `span` meters across the shorter side (portrait: the width, so the
    // whole goal mouth / course stays visible; the thumbs get open grass below).
    return Math.min(w, h / TILT) / (span * PPM)
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const w = this.scale.width
    const h = this.scale.height
    return { x: (wx - this.cam.x) * this.cam.zoom + w / 2, y: (wy - this.cam.y) * this.cam.zoom + h / 2 }
  }

  /** Dev/e2e probe: drill state and key points in CSS pixels (touch shooting spec). */
  debugInfo() {
    const r = this.game.canvas.getBoundingClientRect()
    const w = this.scale.width
    const h = this.scale.height
    const css = (x: number, y: number, z = 0) => {
      const p = project(x, y, z)
      return { x: r.left + (((p.x - this.cam.x) * this.cam.zoom + w / 2) * r.width) / Math.max(1, w), y: r.top + (((p.y - this.cam.y) * this.cam.zoom + h / 2) * r.height) / Math.max(1, h) }
    }
    const v = this.drill.view()
    return {
      live: this.drill.live,
      finished: this.drill.finished,
      paused: !pauseGate.running(),
      elapsed: this.elapsed,
      ballWorld: v.ball ? { x: v.ball.x, y: v.ball.y, z: v.ball.z } : null,
      heroWorld: { x: v.hero.x, y: v.hero.y },
      heroOnBall: v.heroOnBall,
      hero: css(v.hero.x, v.hero.y),
      ball: v.ball ? css(v.ball.x, v.ball.y, v.ball.z) : null,
      goal: css(PITCH_LENGTH, PITCH_WIDTH / 2, 1),
      canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
    }
  }

  private screenToPitch(gx: number, gy: number): { x: number; y: number } {
    const w = this.scale.width
    const h = this.scale.height
    return unproject((gx - w / 2) / this.cam.zoom + this.cam.x, (gy - h / 2) / this.cam.zoom + this.cam.y)
  }

  // ───────────────────────── Loop ─────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1000))
    const before = this.drill.view()
    const intent = this.input0.poll({
      heroPos: { x: before.hero.x, y: before.hero.y },
      ballPos: before.ball ? { x: before.ball.x, y: before.ball.y } : { x: before.hero.x, y: before.hero.y },
      heroOnBall: before.heroOnBall,
      heroIsKeeper: before.heroIsKeeper,
      noMove: this.drill.heroStatic,
    })
    this.drawGate()
    // Frozen (hint card up, app in the background, resume beat): no drill clock, AI or input.
    if (!this.drill.finished && !pauseGate.tick(Math.min(0.25, Math.max(0, deltaMs / 1000)))) {
      const v0 = this.drill.view()
      this.render(v0, 0)
      this.updateHud(v0, 0, intent)
      return
    }
    this.elapsed += dt
    this.lastIntent = intent
    if (intent.any) {
      this.sfx.unlock()
      if (!this.ambienceSet) {
        this.sfx.ambience(0.25)
        this.ambienceSet = true
      }
    }
    this.drill.update(dt, { move: intent.move, sprint: intent.sprint, actions: intent.actions, aim: intent.aim })
    this.handleEvents(this.drill.drainEvents())
    const v = this.drill.view()
    this.render(v, dt)
    this.updateHud(v, dt, intent)
    if (this.drill.finished) {
      if (this.endT < 0) this.endT = this.elapsed
      if (!this.doneCalled && (this.elapsed - this.endT > 1.6 || (intent.skip && this.elapsed - this.endT > 0.4))) {
        this.doneCalled = true
        const r = this.drill.result()
        setTimeout(() => this.data0.onDone(r), 0)
      }
    }
  }

  // ───────────────────────── Rendering ─────────────────────────

  private kitFor(a: ActorView): KitColors {
    const hero = this.data0.opts.heroKit
    switch (a.role) {
      case 'hero':
      case 'mate':
        return a.role === 'hero' && this.drill.view().heroIsKeeper ? keeperKit([hero, OPP_KIT], 0) : hero
      case 'keeper':
        return keeperKit([hero, OPP_KIT], 1)
      case 'opp':
        return OPP_KIT
      case 'dummy':
        return DUMMY_KIT
    }
  }

  private playerView(a: ActorView): PlayerView {
    const ex = this.views.get(a.id)
    if (ex) return ex
    const kit = this.kitFor(a)
    const S = FIG_RES.medium
    let h = 0
    for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0
    const dummy = a.role === 'dummy'
    const rig = new FigureRig(this, {
      kitKey: figureKitSheet(this, kit, S, { keeper: a.role === 'keeper' }),
      skinKey: figureSkinSheet(this, S),
      headKey: figureHeadTexture(this, dummy ? 3 : h, !dummy && this.data0.opts.gender === 'female'),
      numKey: figureNumberTexture(this, kit, a.number),
      skin: dummy ? '#f5c400' : skinTone(h),
      S,
      headTint: dummy ? 0xf5c400 : undefined,
      // (The keeper a touch smaller: the goal reads big and the corners open, as in NSS — owner, 2026-10-17.)
      ...(a.role === 'keeper' ? { scale: TRAINING_KEEPER_SCALE } : {}),
    })
    figureSelfCheck(this, [rig])
    const c = this.add.container(0, 0)
    const shadow = this.addW(this.add.image(0, 0, 'fx_shadow').setDepth(-37.5))
    const cast = this.addW(this.add.image(0, 0, 'fx_cast').setOrigin(0.08, 0.5).setDepth(-37.6))
    let ring: Phaser.GameObjects.Image | null = null
    if (a.role === 'hero') {
      ring = this.add.image(0, 0, 'fx_glow').setTint(0xffd23f).setBlendMode(Phaser.BlendModes.ADD)
      ring.setScale((2.0 * PPM) / 128, ((2.0 * PPM) / 128) * TILT)
    }
    const legs = this.add.graphics()
    const chev = this.add.image(0, 0, 'fx_chev').setTint(a.role === 'hero' ? 0xffd23f : a.role === 'mate' ? 0xffffff : 0x111111).setAlpha(a.role === 'hero' ? 0.95 : 0.5)
    chev.setScale((0.42 * PPM) / 32)
    c.add([...(ring ? [ring] : []), legs, chev, ...rig.parts()])
    this.addW(c)
    const p = project(a.x, a.y)
    const v: PlayerView = { id: a.id, c, shadow, cast, legs, chev, rig, ring, phase: (h % 97) / 97, kickT: 9, x: a.x, y: a.y, lastX: p.x, lastY: p.y, seen: true }
    this.views.set(a.id, v)
    return v
  }

  private render(v: DrillView, dt: number): void {
    for (const pv of this.views.values()) pv.seen = false
    for (const a of [v.hero, ...v.actors]) this.drawPlayer(this.playerView(a), a, dt)
    for (const pv of this.views.values()) {
      pv.c.setVisible(pv.seen)
      if (!pv.seen) {
        pv.shadow.setVisible(false)
        pv.cast.setVisible(false)
      }
    }
    this.drawField(v)
    this.drawBall(v, dt)
    this.drawPreview(v)
    this.updateNets(dt)
    this.updateCamera(v, dt)
  }

  /**
   * The pitch (mown grass, grain, wear, lines) drawn once into a texture: a
   * live Graphics would be re-tessellated every frame.
   */
  private bakePitch(): void {
    const g = this.add.graphics()
    const lines = this.add.graphics()
    drawPitch(g, 'clear', { lines, seed: 23 })
    const a = project(PITCH_LENGTH + 9.5, -6.5)
    const b = project(-16.5, PITCH_WIDTH + 6.5)
    const x0 = Math.floor(a.x)
    const y0 = Math.floor(a.y)
    const w = Math.ceil(b.x) - x0
    const h = Math.ceil(b.y) - y0
    const s = 0.8
    const key = 'train_pitch'
    if (this.textures.exists(key)) this.textures.remove(key)
    const tex = this.textures.addDynamicTexture(key, Math.ceil(w * s), Math.ceil(h * s))
    if (tex) {
      g.setScale(s)
      lines.setScale(s)
      tex.draw(g, -x0 * s, -y0 * s)
      const ts = (2.6 * PPM * s) / 128
      tex.repeat(grassGrainTexture(this), undefined, 0, 0, Math.ceil(w * s), Math.ceil(h * s), { tileScaleX: ts, tileScaleY: ts * TILT } as unknown as Phaser.Types.GameObjects.TileSprite.TileSpriteConfig)
      tex.draw(lines, -x0 * s, -y0 * s)
      tex.render()
      this.addW(this.add.image(x0, y0, key).setOrigin(0, 0).setScale(w / Math.ceil(w * s), h / Math.ceil(h * s)).setDepth(-40))
    }
    // Kept (hidden): the texture's command buffer may still reference them.
    g.setVisible(false)
    lines.setVisible(false)
  }

  private drawPlayer(v: PlayerView, a: ActorView, dt: number): void {
    v.seen = true
    v.x = a.x
    v.y = a.y
    const p = project(a.x, a.y)
    v.c.setPosition(p.x, p.y)
    v.c.setDepth(depthFor(a.x, a.role === 'hero' ? 0.2 : 0))
    const moved = Math.hypot(p.x - v.lastX, p.y - v.lastY)
    v.lastX = p.x
    v.lastY = p.y
    // Teleports (new rep) should not animate a sprint.
    const step = moved > 3 * PPM ? 0 : moved
    const speedM = dt > 0 ? step / PPM / dt : 0
    v.phase = (v.phase + step / PPM / 2.3) % 1
    v.kickT += dt
    const fd = pitchDirToScreen(Math.cos(a.facing), Math.sin(a.facing))
    const [gx, gy] = groundDir(fd.x, fd.y)
    let frame: FigPose = speedM > 0.7 ? (`run${Math.floor(v.phase * 8) % 8}` as FigPose) : a.role === 'keeper' ? 'ready' : 'idle'
    let lift = a.z
    let rot = 0
    if (a.state === 'dive') frame = 'dive'
    else if (a.state === 'down') {
      frame = 'down'
      lift = 0
    } else if (a.state === 'jump') frame = 'jump'
    else if (a.state === 'slide') frame = 'slide'
    else if (a.state === 'skill') rot = Math.sin(a.stateT * 18) * 0.1
    else if (v.kickT < 0.3) frame = v.kickT < 0.07 ? 'kick1' : 'kick2'
    v.rig.set(frame, gx, gy, zpx(lift), rot)
    const air = clampN(1 - a.z * 0.45, 0.25, 1)
    const flat = frame === 'dive' || frame === 'down' || frame === 'slide'
    v.shadow.setPosition(p.x, p.y).setScale(((flat ? 1.9 : 1) * PPM) / 64, ((0.62 * PPM) / 32) * TILT).setAlpha(0.85 * air).setVisible(true)
    v.cast.setPosition(p.x, p.y).setRotation(0.62).setScale(((1.55 * (flat ? 1.4 : 1) + a.z * 0.4) * FIG_SCALE * PPM) / 64, (0.5 * PPM) / 16).setAlpha(0.3 * air).setVisible(true)
    if (v.ring) {
      const pulse = 1 + Math.sin(this.elapsed * 5) * 0.08
      v.ring.setScale(((2.0 * PPM) / 128) * pulse, ((2.0 * PPM) / 128) * TILT * pulse)
    }
    const g = v.legs
    if (a.highlight) {
      g.clear()
      g.lineStyle(0.12 * PPM, 0xffd23f, 0.6 + Math.sin(this.elapsed * 8) * 0.35)
      g.strokeEllipse(0, 0, 2.4 * PPM, 2.4 * PPM * TILT)
      g.setData('on', true)
    } else if (g.getData('on')) g.clear().setData('on', false)
    const tipD = 0.82 * PPM
    v.chev.setPosition(fd.x * tipD, fd.y * tipD).setRotation(Math.atan2(fd.y, fd.x)).setVisible(frame !== 'down')
  }

  private drawField(v: DrillView): void {
    const g = this.fieldG
    g.clear()
    for (const l of v.lines) {
      const a = project(l.a.x, l.a.y)
      const b = project(l.b.x, l.b.y)
      g.lineStyle((l.width ?? 0.12) * PPM, TONE[l.tone], 0.9)
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
    for (const gt of v.gates) {
      const a = project(gt.a.x, gt.a.y)
      const b = project(gt.b.x, gt.b.y)
      g.lineStyle(0.08 * PPM, TONE[gt.tone], 0.35)
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
    for (const r of v.rings) {
      const p = project(r.x, r.y)
      const k = r.pulse ? 1 + Math.sin(this.elapsed * 6) * 0.08 : 1
      g.lineStyle(0.12 * PPM, TONE[r.tone], 0.85)
      g.strokeEllipse(p.x, p.y, r.r * 2 * PPM * k, r.r * 2 * PPM * TILT * k)
    }
    // Cones are drawn as small triangles standing up (over the field graphics).
    const o = this.overG
    o.clear()
    for (const c of v.cones) {
      const b = project(c.x, c.y)
      const t = project(c.x, c.y, 0.45)
      const w = 0.2 * PPM
      o.fillStyle(0x000000, 0.25)
      o.fillEllipse(b.x, b.y, w * 2.4, w * 1.2)
      o.fillStyle(TONE[c.tone], 1)
      o.fillTriangle(b.x - w, b.y, b.x + w, b.y, t.x, t.y)
      o.fillStyle(0xffffff, 0.8)
      o.fillRect(b.x - w * 0.55, b.y - (b.y - t.y) * 0.5, w * 1.1, 2 * this.ui)
    }
    o.setDepth(depthFor(PITCH_LENGTH - 0.5))
    // Goal-mouth targets.
    for (const gt of v.goalTargets) {
      const gx = gt.end === 'east' ? PITCH_LENGTH : 0
      const c = project(gx, gt.y, gt.z)
      const rr = gt.r * PPM
      o.fillStyle(TONE[gt.tone], gt.tone === 'dim' ? 0.12 : 0.28)
      o.fillCircle(c.x, c.y, rr)
      o.lineStyle(0.1 * PPM, TONE[gt.tone], gt.tone === 'dim' ? 0.35 : 0.95)
      o.strokeCircle(c.x, c.y, rr)
      if (gt.tone === 'gold') o.strokeCircle(c.x, c.y, rr * (0.45 + Math.sin(this.elapsed * 7) * 0.08))
    }
  }

  private drawBall(v: DrillView, dt: number): void {
    const b = v.ball
    this.ballImg.setVisible(!!b)
    this.ballShadow.setVisible(!!b)
    if (!b) return
    const gp = project(b.x, b.y, 0)
    const bp = project(b.x, b.y, b.z)
    this.ballShadow.setPosition(gp.x, gp.y).setAlpha(clampN(0.85 - b.z * 0.12, 0.2, 0.85)).setDepth(depthFor(b.x, -0.4))
    this.ballImg.setPosition(bp.x, bp.y).setScale((BALL_D / 64) * (1 + b.z * 0.06))
    this.ballImg.rotation += (b.speed * dt) / 0.11 * 0.15
    this.ballImg.setDepth(b.z > 2.1 ? 3_000_000 : depthFor(b.x, 0.5))
  }

  private drawPreview(v: DrillView): void {
    const g = this.overG
    if (v.preview) {
      const n = v.preview.points.length
      const col = v.preview.shot ? 0xffd23f : 0xffffff
      for (let i = 1; i < n; i++) {
        const pt = v.preview.points[i]!
        const q = project(pt.x, pt.y, pt.z)
        const t = i / n
        g.fillStyle(col, 0.95 - t * 0.55)
        g.fillCircle(q.x, q.y, (0.16 - t * 0.07) * PPM)
      }
    }
    // Power ring around the hero while charging.
    // Live power while dragging; after release the ring holds the struck power for a moment.
    const flash = this.input0.releaseFlash()
    const live = this.lastIntent?.power ?? 0
    const pw = live > 0.01 ? live : (flash?.power ?? 0)
    const ringAlpha = live > 0.01 ? 0.95 : 0.95 * (flash?.alpha ?? 0)
    if (pw > 0.01 && (v.heroOnBall || v.heroIsKeeper || live <= 0.01)) {
      const hp = project(v.hero.x, v.hero.y)
      const r = 1.25 * PPM
      const steps = 48
      const frac = Math.min(1.15, pw) / 1.15
      for (let i = 0; i < steps * frac; i++) {
        const a0 = -Math.PI / 2 + (i / steps) * Math.PI * 2
        const a1 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2
        const pf = ((i + 1) / steps) * 1.15
        g.lineStyle(0.16 * PPM, pf > 1 ? 0xff3b3b : pf > 0.85 ? 0xffb02e : 0x5dff8a, ringAlpha)
        g.lineBetween(hp.x + Math.cos(a0) * r, hp.y + Math.sin(a0) * r * TILT, hp.x + Math.cos(a1) * r, hp.y + Math.sin(a1) * r * TILT)
      }
    }
  }

  private updateNets(dt: number): void {
    for (const end of ['east', 'west'] as const) {
      const r = this.ripple[end]
      const g = this.netG[end]
      if (!r || !g) continue
      r.t += dt
      g.clear()
      drawGoal(g, end, 'net', r.t > 2 ? null : r)
      if (r.t > 2) this.ripple[end] = null
    }
  }

  private updateCamera(v: DrillView, dt: number): void {
    const f = project(v.focus.x, v.focus.y)
    const k = 1 - Math.exp(-dt * 2.6)
    this.cam.x += (f.x - this.cam.x) * k
    // Leave room for the HUD band at the top.
    this.cam.y += (f.y - this.hudTop() / 2 / Math.max(0.01, this.cam.zoom) - this.cam.y) * k
    this.cam.punch *= Math.exp(-dt * 5)
    const target = this.baseZoom(v.span) * (1 + this.cam.punch)
    this.cam.zoom += (target - this.cam.zoom) * (1 - Math.exp(-dt * 3))
    const w = this.scale.width
    const h = this.scale.height
    const hw = w / (2 * this.cam.zoom)
    const hh = h / (2 * this.cam.zoom)
    const minX = -13 * PPM
    const maxX = (PITCH_WIDTH + 13) * PPM
    const minY = project(PITCH_LENGTH + 13, 0).y
    const maxY = project(-9, 0).y
    this.cam.x = maxX - minX < hw * 2 ? (minX + maxX) / 2 : clampN(this.cam.x, minX + hw, maxX - hw)
    this.cam.y = maxY - minY < hh * 2 ? (minY + maxY) / 2 : clampN(this.cam.y, minY + hh, maxY - hh)
    const cam = this.cameras.main
    cam.setZoom(this.cam.zoom)
    cam.centerOn(this.cam.x, this.cam.y)
  }

  // ───────────────────────── Events & juice ─────────────────────────

  private vibrate(ms: number, s = 0.6): void {
    if (this.data0.opts.settings.vibration) this.input0.rumble(ms, s)
  }

  private get calm(): boolean {
    return !!this.data0.opts.settings.reducedMotion
  }

  private handleEvents(evs: DrillEvent[]): void {
    for (const e of evs) {
      switch (e.type) {
        case 'whistle':
          this.sfx.whistle(e.long)
          break
        case 'go':
          this.countText.setText(this.s.hud.go).setAlpha(1).setScale(1.2)
          this.tweens.add({ targets: this.countText, alpha: 0, scale: 1.6, duration: 700, delay: 250 })
          this.vibrate(25)
          break
        case 'kick': {
          // Kick swing on whoever struck it (the hero, or the nearest actor).
          let best: PlayerView | null = null
          let bd = 2.2
          for (const pv of this.views.values()) {
            const d = Math.hypot(pv.x - e.x, pv.y - e.y)
            if (pv.seen && d < bd) {
              bd = d
              best = pv
            }
          }
          if (best) best.kickT = 0
          this.sfx.kick(e.power)
          if (e.hero) {
            this.vibrate(18)
            probeKick({ power: e.power, kick: 'shot' })
          }
          break
        }
        case 'touch':
          this.sfx.tap(0.35)
          break
        case 'net': {
          this.sfx.net(e.speed)
          this.ripple[e.end] = { t: 0, y: e.y, z: clampN(e.z, 0.2, 2.2), strength: 1 }
          if (e.end === 'east') {
            this.sfx.roar(0.35)
            if (!this.calm) {
              this.flash.setAlpha(0.35)
              this.tweens.add({ targets: this.flash, alpha: 0, duration: 380 })
              this.cam.punch = 0.06
            }
            const p = project(PITCH_LENGTH, e.y, e.z)
            this.sparks.explode(18, p.x, p.y)
            this.vibrate(90, 0.8)
          } else {
            this.sfx.groan()
            this.vibrate(60, 0.5)
          }
          break
        }
        case 'post':
          this.sfx.clang(e.speed)
          this.vibrate(70, 0.8)
          if (!this.calm) this.cameras.main.shake(120, 0.003)
          break
        case 'save':
          this.sfx.glove()
          if (e.hero) {
            this.vibrate(e.held ? 60 : 90, 0.8)
            const p = project(e.x, e.y, e.z)
            this.sparks.explode(12, p.x, p.y)
          }
          break
        case 'dive':
          this.sfx.whoosh(true)
          break
        case 'cone':
          this.sfx.tap(0.8)
          this.vibrate(40, 0.5)
          break
        case 'skill':
          this.sfx.whoosh(e.ok)
          if (e.ok) this.vibrate(25)
          break
        case 'beep':
          this.sfx.beep(e.level)
          this.vibrate(15, 0.3)
          break
        case 'score':
          this.onScore(e)
          break
        case 'end':
          this.showGrade()
          break
      }
    }
  }

  private onScore(e: Extract<DrillEvent, { type: 'score' }>): void {
    const label = this.s.label[e.label]
    const txt = e.points > 0 ? `+${e.points} ${label}` : e.points < 0 ? `${e.points} ${label}` : label
    const col = e.points > 0 ? (e.label === 'target' || e.label === 'perfect' || e.label === 'perfectStart' || e.label === 'held' || e.label === 'won' || e.label === 'read' || e.label === 'dip' ? '#ffd23f' : '#5dff8a') : e.good ? '#ffffff' : '#ff8a8a'
    this.floatText(txt, e.x, e.y, col, 1.1, (e.z ?? 0) + 2.2)
    if (e.points > 0) {
      this.pointsText.setScale(1.25)
      this.tweens.add({ targets: this.pointsText, scale: 1, duration: 260, ease: 'Quad.Out' })
      if (e.points >= 150) this.sfx.roar(0.2)
    }
  }

  private floatText(text: string, x: number, y: number, color: string, life: number, zOff: number): void {
    const t = this.text(17, color)
    t.setText(text)
    const p = project(x, y, zOff)
    this.floaters.push({ text: t, wx: p.x, wy: p.y, t: 0, life })
  }

  private showGrade(): void {
    const r = this.drill.result()
    this.gradeText.setText(r.grade).setColor(GRADE_COLOR[r.grade]).setAlpha(1).setScale(0.3)
    this.tweens.add({ targets: this.gradeText, scale: 1, duration: 480, ease: 'Back.Out' })
    this.gradeSub.setText(`${r.points} ${this.s.hud.points} · ${Math.round(r.performance * 100)}%`).setAlpha(1)
    if (r.grade === 'S' || r.grade === 'A') {
      this.sfx.roar(0.6)
      this.sparks.explode(40, this.cam.x, this.cam.y)
    }
    this.vibrate(r.grade === 'S' ? 160 : 60, 0.7)
  }

  // ───────────────────────── HUD ─────────────────────────

  private updateHud(v: DrillView, dt: number, intent: FrameIntent): void {
    const g = this.hudG
    const w = this.scale.width
    const h = this.scale.height
    const u = this.ui
    const hud = v.hud
    g.clear()
    const top = this.hudTop()
    g.fillStyle(0x070b10, 0.88)
    g.fillRect(0, 0, w, top)
    g.fillStyle(0xffffff, 0.08)
    g.fillRect(0, top - u, w, u)

    if (Math.round(hud.points) !== this.lastPoints) this.lastPoints = Math.round(hud.points)
    this.pointsText.setText(`${hud.points}`)
    this.comboText.setText(hud.combo >= 2 ? `${this.s.hud.combo} ×${hud.combo}` : '').setPosition(this.pointsText.x + this.pointsText.displayWidth + 10 * u, 36 * u)
    const secs = Math.ceil(hud.timeLeft)
    this.clockText.setText(`${secs}s`).setColor(hud.timeLeft < 5 && hud.countdown === 0 ? '#ff6b6b' : '#ffffff')
    // Clock bar under the band.
    const frac = clampN(hud.timeLeft / hud.duration, 0, 1)
    g.fillStyle(0x000000, 0.4)
    g.fillRect(0, top, w, 4 * u)
    g.fillStyle(frac > 0.5 ? 0x5dff8a : frac > 0.2 ? 0xffb02e : 0xff4040, 1)
    g.fillRect(0, top, w * frac, 4 * u)

    // Level badge next to the clock.
    const ctl = CONTROLS[this.drill.kind]
    if (hud.level !== undefined && ctl.level) {
      this.titleText.setText(`${(this.data0.opts.title ?? '').toLocaleUpperCase(this.data0.opts.lang === 'tr' ? 'tr-TR' : 'en-US')} · ${this.s.hud.level} ${hud.level}`)
    }

    // Wind (curl gate, 2.3#25): km/h and an arrow in screen space, never hidden.
    if (hud.wind) {
      const wx = w - 104 * u
      const wy = top + 22 * u
      this.windText.setText(this.s.hud.wind.replace('{n}', String(hud.wind.kmh))).setPosition(wx - 30 * u, wy).setAlpha(0.95)
      const d = pitchDirToScreen(hud.wind.dir.x, hud.wind.dir.y)
      if (hud.wind.kmh > 0 && (d.x !== 0 || d.y !== 0)) {
        const cx = wx - 12 * u
        const L = 11 * u
        const tip = { x: cx + d.x * L, y: wy + d.y * L }
        g.lineStyle(3 * u, 0x9fe8ff, 1)
        g.lineBetween(cx - d.x * L, wy - d.y * L, tip.x, tip.y)
        const px = -d.y
        const py = d.x
        g.fillStyle(0x9fe8ff, 1)
        g.fillTriangle(tip.x + d.x * 5 * u, tip.y + d.y * 5 * u, tip.x + px * 5 * u, tip.y + py * 5 * u, tip.x - px * 5 * u, tip.y - py * 5 * u)
      }
    } else {
      this.windText.setAlpha(0)
    }

    this.promptText.setText(this.s.prompt[hud.prompt])
    this.promptText.setAlpha(hud.prompt === 'done' ? 0 : 0.92)

    // Countdown.
    if (hud.countdown > 0) {
      const n = Math.ceil(hud.countdown / 0.8)
      this.countText.setText(String(n)).setAlpha(1).setScale(1 + (hud.countdown % 0.8) * 0.4)
    }

    // Meters (bottom-left, above touch controls).
    const mw = Math.min(180 * u, w * 0.38)
    hud.meters.forEach((m, i) => {
      const x = 14 * u
      const y = h - (i + 1) * 30 * u - (this.input0.isTouch ? Math.min(w, h) * 0.28 : 8 * u)
      g.fillStyle(0x000000, 0.5)
      g.fillRoundedRect(x - 3 * u, y - 3 * u, mw + 6 * u, 14 * u, 6 * u)
      g.fillStyle(TONE[m.tone], m.kind === 'beat' && m.value > 0.85 ? 0.6 + Math.sin(this.elapsed * 20) * 0.4 : 0.95)
      g.fillRoundedRect(x, y, Math.max(2 * u, mw * clampN(m.value, 0, 1)), 8 * u, 4 * u)
      const t = this.meterTexts[i]
      if (t) t.setText(this.s.hud[m.kind]).setPosition(x + mw + 10 * u, y + 4 * u).setAlpha(0.85)
    })
    for (let i = hud.meters.length; i < this.meterTexts.length; i++) this.meterTexts[i]!.setAlpha(0)

    // Floaters.
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!
      f.t += dt
      const sp = this.worldToScreen(f.wx, f.wy)
      f.text.setPosition(sp.x, sp.y - f.t * 34 * u).setAlpha(clampN((f.life - f.t) / 0.3, 0, 1)).setScale(1 + Math.max(0, 0.25 - f.t) * 1.5)
      if (f.t >= f.life) {
        f.text.destroy()
        this.floaters.splice(i, 1)
      }
    }

    // Touch controls.
    const tu = this.input0.touchUi()
    const show = tu.enabled && !this.drill.finished
    const skillLabel = ctl.button ? this.s.buttons[ctl.button] : ''
    const showSkill = show && skillLabel !== ''
    const showSprint = show && ctl.sprint
    this.sprintText.setAlpha(showSprint ? 0.9 : 0).setPosition(tu.sprint.x, tu.sprint.y)
    this.skillText.setText(skillLabel).setAlpha(showSkill ? 0.9 : 0).setPosition(tu.skill.x, tu.skill.y)
    if (showSprint) {
      g.fillStyle(0x000000, tu.sprint.down ? 0.55 : 0.3)
      g.fillCircle(tu.sprint.x, tu.sprint.y, tu.sprint.r)
      g.lineStyle(2 * u, 0xffffff, tu.sprint.down ? 0.9 : 0.45)
      g.strokeCircle(tu.sprint.x, tu.sprint.y, tu.sprint.r)
    }
    if (showSkill) {
      g.fillStyle(0x000000, tu.skill.down ? 0.55 : 0.3)
      g.fillCircle(tu.skill.x, tu.skill.y, tu.skill.r)
      g.lineStyle(2 * u, 0xffd23f, tu.skill.down ? 0.95 : 0.5)
      g.strokeCircle(tu.skill.x, tu.skill.y, tu.skill.r)
    }
    if (show && tu.joystick && ctl.stick) {
      g.lineStyle(2 * u, 0xffffff, 0.35)
      g.strokeCircle(tu.joystick.baseX, tu.joystick.baseY, tu.joystick.r)
      g.fillStyle(0xffffff, 0.35)
      g.fillCircle(tu.joystick.knobX, tu.joystick.knobY, tu.joystick.r * 0.42)
    }
    void intent
  }
}

/**
 * Plays one drill in `container` (a Phaser game is created and destroyed) under the render guard:
 * a failed WebGL start restarts the drill on Canvas; if Canvas fails too, a panel with Exit
 * (= `opts.onExit`) replaces the canvas. `onDone` receives the result after the final grade.
 */
export function startDrill(container: HTMLElement, drill: Drill, opts: DrillSceneOptions, onDone: (r: DrillResult) => void, makeDrill?: () => Drill): DrillHandle {
  let stopped = false
  let current = drill
  let guard: GuardHandle | null = null
  const finish = (r: DrillResult) => {
    if (stopped) return
    stopped = true
    guard?.stop()
    onDone(r)
  }
  guard = guardPhaser({
    container,
    host: 'drill',
    lowGraphics: opts.canvasRenderer,
    build: (renderer, safe) => {
      const game = createMatchGame(container, opts.quality, renderer)
      const launch = safe(() => {
        if (stopped) return
        game.scene.add(SCENE_KEY, TrainingScene, true, { drill: current, opts, onDone: finish } satisfies SceneData)
      })
      if (game.isBooted) launch()
      else game.events.once(Phaser.Core.Events.READY, launch)
      return game
    },
    // A restart replays the drill from its first rep (a fresh copy when the caller can make one).
    onRestart: () => {
      if (makeDrill) current = makeDrill()
    },
    onExit: () => opts.onExit?.(),
  })
  const g = guard
  return {
    get game() {
      return g.game as Phaser.Game
    },
    stop() {
      if (stopped) return
      stopped = true
      g.stop()
    },
  }
}
