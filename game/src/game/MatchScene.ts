/**
 * MatchScene — renders a {@link HighlightRuntime} and feeds it input.
 *
 * The scene owns no game rules: it projects the runtime's pitch-space state
 * into a stylised, slightly angled 2.5D view, plays juice (camera follow with
 * look-ahead, zoom punches, shakes, particles, net ripples, slow-motion goal
 * replay) and a minimal HUD (score bug, moment timer, prompt, bullet-time
 * focus bar, touch controls, result banner).
 *
 * Public API: {@link createMatchGame} and {@link startHighlight}.
 */
import Phaser from 'phaser'
import type { Difficulty, KitColors, Lang } from '../core/types'
import type { Highlight, HighlightOutcome, HighlightResult, Weather } from '../sim/match/types'
import { PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import {
  adBoardTexture,
  ballTexture,
  colorNum,
  crowdTexture,
  drawGoal,
  drawPitch,
  drawWeatherGround,
  luminance,
  headTexture,
  keeperKit,
  kitTexture,
  utilTextures,
  type NetRipple,
} from './art'
import { Sfx } from './audio'
import { autopilotStep, createAutopilot, type AutopilotState } from './autopilot'
import { InputController, type FrameIntent } from './input'
import { effectiveAimAssist, getControlPrefs, TIMING_ASSIST_MULT } from '../input/prefs'
import { KIT_MIN_DISTANCE, cvdDistance, distinctOpponentKit } from '../core/colorVision'
import { audio } from '../audio'
import { secondLastOpponentDepth } from './offside'
import { compactFrames, recordMoment, type MomentRecording } from './moments'
import {
  CELEBRATION_BY_ID, celebrationJoiners, celebrationPose, celebrationSeconds, dominantAngle, replayAngleWeights, replayRate, resolveCelebration,
  stadiumLook, upper, windReadout, type CelebrationChoice, type CelebrationId, type CelebrationPose, type ReplayAngle, type ReplayAngleChoice, type StadiumLook,
} from './presentation'
import type { AimAssist } from './kick'
import { clampN, dist, type Agent } from './model'
import { GOAL_CENTER_Y } from './physics'
import { HighlightRuntime, STATE_CODES, type ReplayFrame, type RuntimeEvent } from './runtime'
import { applyInput, InputRecorder } from './inputReplay'
import { ASSIST_REWARD } from '../sim/match/rating'
import { PPM, TILT, ZS, depthFor, pitchDirToScreen, project, screenDirToPitch, unproject } from './view'

// ───────────────────────── Public types ─────────────────────────

export interface HighlightSettings {
  aimAssist: AimAssist
  slowMoAim: boolean
  vibration: boolean
  /** 0..1 */
  sound: number
  /** Accessibility: no shake / zoom punches / flashes / vignette; shorter celebrations. */
  reducedMotion?: boolean
  /** Low effects tier: fewer particles and crowd sprites. */
  lowFx?: boolean
}

export interface StartHighlightOptions {
  heroTeamColors: KitColors
  oppColors: KitColors
  settings: HighlightSettings
  lang: Lang
  difficulty: Difficulty | number
  weather: Weather
  /** Hero display name for the name tag (defaults to "YOU"/"SEN"). */
  heroName?: string
  /** Display names by player id. */
  names?: Record<string, string>
  /** Team short names for the score bug. */
  teamNames?: { hero?: string; opp?: string }
  /** 0..1 match importance (crowd + penalty panic). */
  importance?: number
  /** Play the slow-motion goal replay (default true). */
  replay?: boolean
  /** Let the built-in autopilot play the hero (attract mode / dev). */
  autopilot?: boolean
  /** Players' gender (the world follows the hero): female heads get ponytails/buns. */
  gender?: 'male' | 'female'
  /** Observer for runtime events (UI control hints). Never affects play. */
  onEvent?: (e: RuntimeEvent) => void
  /** Home ground (stadium tier by capacity) and whether it is an evening fixture under floodlights. */
  stadium?: { capacity: number; night?: boolean }
  /** Goal celebration choice and the hero's unlocked set. */
  celebration?: { choice?: CelebrationChoice; unlocked?: readonly CelebrationId[] }
  /** Groups recorded moments per match (fixture id). Default 'demo'. */
  matchKey?: string
  /** Replay camera ('auto' = director cuts). */
  replayAngle?: ReplayAngleChoice
}

/** Handle returned by {@link startHighlight}. */
export interface HighlightHandle {
  game: Phaser.Game
  /** Aborts the moment without calling onDone. */
  stop(): void
}

interface SceneData {
  highlight: Highlight
  opts: StartHighlightOptions
  onDone: (r: HighlightResult) => void
  /** Rewatch a recorded moment instead of playing it. */
  replayOnly?: MomentRecording
}

const SCENE_KEY = 'starpath-match'

// ───────────────────────── Strings ─────────────────────────

const T = {
  en: {
    goal: 'GOAL!', assist: 'ASSIST!', saved: 'SAVED', missed: 'MISSED', blocked: 'BLOCKED', woodwork: 'OFF THE WOODWORK!',
    pass_complete: 'GOOD PLAY', lost_ball: 'LOST IT', defended: 'DEFENDED!', conceded: 'CONCEDED', shot_conceded: 'CHANCE CONCEDED', foul_won: 'FOUL WON',
    foul_committed: 'FOUL', timeout: "TIME'S UP", replay: 'REPLAY', skip: 'tap to skip', paused: 'PAUSED', focus: 'FOCUS', sprint: 'SPRINT',
    skill: 'SKILL', you: 'YOU', yellow: 'YELLOW CARD', red: 'RED CARD', skillOk: 'SKILL!', skillBad: 'TACKLED', call: 'PASS!',
    header: 'NOW!', shootHint: 'Swipe / hold & release to shoot', woodHit: 'POST!', save: 'SAVE!',
    offside: 'OFFSIDE', offsideFlag: 'FLAG UP!', oneTwo: 'ONE-TWO!',
    aim_full: 'FULL AIM', aim_half: 'HALF AIM', aim_manual: 'MANUAL AIM',
    angle_broadcast: 'BROADCAST', angle_goalcam: 'GOAL CAM', angle_tactical: 'TACTICAL CAM',
  },
  tr: {
    goal: 'GOL!', assist: 'ASİST!', saved: 'KURTARDI', missed: 'AUT', blocked: 'BLOKE', woodwork: 'DİREKTEN DÖNDÜ!',
    pass_complete: 'İYİ OYUN', lost_ball: 'TOP KAYBI', defended: 'SAVUNDUN!', conceded: 'GOL YEDİK', shot_conceded: 'RAKİP ŞUT BULDU', foul_won: 'FAUL ALDIN',
    foul_committed: 'FAUL', timeout: 'SÜRE BİTTİ', replay: 'TEKRAR', skip: 'geçmek için dokun', paused: 'DURAKLATILDI', focus: 'ODAK', sprint: 'DEPAR',
    skill: 'ÇALIM', you: 'SEN', yellow: 'SARI KART', red: 'KIRMIZI KART', skillOk: 'ÇALIM!', skillBad: 'KAPTIRDIN', call: 'PAS!',
    header: 'ŞİMDİ!', shootHint: 'Şut için kaydır / basılı tutup bırak', woodHit: 'DİREK!', save: 'KURTARIŞ!',
    offside: 'OFSAYT', offsideFlag: 'BAYRAK HAVADA!', oneTwo: 'VER-KAÇ!',
    aim_full: 'TAM NİŞAN', aim_half: 'YARI NİŞAN', aim_manual: 'MANUEL NİŞAN',
    angle_broadcast: 'YAYIN KAMERASI', angle_goalcam: 'KALE ARKASI', angle_tactical: 'TAKTİK KAMERA',
  },
} as const
type Strings = { [K in keyof (typeof T)['en']]: string }

const GOOD: ReadonlySet<HighlightOutcome> = new Set<HighlightOutcome>(['goal', 'assist', 'defended', 'pass_complete', 'foul_won'])

// ───────────────────────── Player view ─────────────────────────

interface PlayerView {
  agent: Agent
  c: Phaser.GameObjects.Container
  shadow: Phaser.GameObjects.Image
  legs: Phaser.GameObjects.Graphics
  body: Phaser.GameObjects.Image
  head: Phaser.GameObjects.Image
  ring: Phaser.GameObjects.Image | null
  arms: Phaser.GameObjects.Graphics | null
  phase: number
  lastX: number
  lastY: number
}

interface Floater {
  text: Phaser.GameObjects.Text
  wx: number
  wy: number
  t: number
  life: number
}

const BODY_D = 0.95 * PPM
const HEAD_D = 0.46 * PPM
const BALL_D = 0.22 * PPM * 2.1
const TORSO_Z = 1.0
const HEAD_Z = 1.62
const HIP_Z = 0.6
const zpx = (z: number) => z * PPM * ZS

/**
 * The interactive highlight scene. Create through {@link startHighlight}.
 */
export class MatchScene extends Phaser.Scene {
  private data0!: SceneData
  private rt!: HighlightRuntime
  private input0!: InputController
  private sfx!: Sfx
  private s!: Strings
  private ui = 1

  private worldLayer!: Phaser.GameObjects.Layer
  private hudLayer!: Phaser.GameObjects.Layer
  private uiCam!: Phaser.Cameras.Scene2D.Camera

  private views: PlayerView[] = []
  private ballImg!: Phaser.GameObjects.Image
  private ballShadow!: Phaser.GameObjects.Image
  private trailG!: Phaser.GameObjects.Graphics
  private aimG!: Phaser.GameObjects.Graphics
  private netG: Record<'east' | 'west', Phaser.GameObjects.Graphics> = {} as Record<'east' | 'west', Phaser.GameObjects.Graphics>
  private ripple: Record<'east' | 'west', NetRipple | null> = { east: null, west: null }
  private grassFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter

  private hudG!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private bannerSub!: Phaser.GameObjects.Text
  private focusText!: Phaser.GameObjects.Text
  private tagText!: Phaser.GameObjects.Text
  private sprintText!: Phaser.GameObjects.Text
  private skillText!: Phaser.GameObjects.Text
  private replayText!: Phaser.GameObjects.Text
  private vignette!: Phaser.GameObjects.Image
  private flash!: Phaser.GameObjects.Rectangle
  private floaters: Floater[] = []

  private cam = { x: 0, y: 0, zoom: 1, base: 1, punch: 0 }
  /** Height (game px) of the HUD band at the top; the play camera renders below it so the HUD never covers play. */
  private hudTop = 0
  /** Safe-area inset (notch) at the top of the canvas, game px. */
  private safeTop = 0
  /** Timer bar geometry inside the HUD band (game px). */
  private bar = { x: 0, y: 0, w: 0 }
  private trail: { x: number; y: number }[] = []
  private mode: 'play' | 'celebrate' | 'replay' | 'done' = 'play'
  /** Reduced motion / low effects (scene-local copies of the settings). */
  private rm = false
  /** No screen flashes (Disable flashes setting / reduced motion). */
  private noFlash = false
  private lowFx = false
  private look!: StadiumLook
  private night = false
  /** Stand images (crowd bounce on goals). */
  private stands: Phaser.GameObjects.Image[] = []
  /** Player name labels (created lazily; toggled with N, always on in replays/celebrations). */
  private labels: Phaser.GameObjects.Text[] | null = null
  private labelsOn = false
  private onKey: ((e: KeyboardEvent) => void) | null = null
  /** Offside line flash: pitch x of the line, and the flagged player's x. */
  private offsideFx: { lineX: number; playerX: number; t: number } | null = null
  /** Offside line (second-last defender) when the last hero-team pass was played. */
  private passLineX: number | null = null
  private lastKeyT = -1
  private overlayG!: Phaser.GameObjects.Graphics
  private windText: Phaser.GameObjects.Text | null = null
  private angleText!: Phaser.GameObjects.Text
  private ring2: Phaser.GameObjects.Image | null = null
  /** Outline colours per team when kits are hard to tell apart (colour-blind modes / clashes). */
  private outline: Record<'hero' | 'opp', number | null> = { hero: null, opp: null }
  private celeb: {
    id: CelebrationId
    t: number
    dur: number
    target: { x: number; y: number }
    hero: { x: number; y: number; facing: number }
    joiners: { v: PlayerView; x: number; y: number; ang: number }[]
    others: { v: PlayerView; x: number; y: number; facing: number }[]
  } | null = null
  private replayAngle: ReplayAngleChoice = 'auto'
  private elapsed = 0
  private promptT = 0
  private replay: { frames: ReplayFrame[]; t: number; t0: number; t1: number; keyT: number; goal: boolean; endX: number } | null = null
  private finished = false
  private lastIntent: FrameIntent | null = null
  /** Deterministic input log of this moment (debugging / bug reports, WP-13). */
  private inputRec = new InputRecorder()
  private assistText: Phaser.GameObjects.Text | null = null
  private paused = false
  private auto: AutopilotState | null = null
  private kits!: { hero: KitColors; opp: KitColors; heroGk: KitColors; oppGk: KitColors }

  constructor() {
    super({ key: SCENE_KEY })
  }

  init(data: SceneData): void {
    this.data0 = data
    this.views = []
    this.floaters = []
    this.trail = []
    this.mode = 'play'
    this.finished = false
    this.elapsed = 0
    this.replay = null
    this.celeb = null
    this.stands = []
    this.labels = null
    this.labelsOn = false
    this.offsideFx = null
    this.passLineX = null
    this.lastKeyT = -1
    this.windText = null
    this.assistText = null
    this.inputRec = new InputRecorder()
    this.ring2 = null
    this.paused = false
  }

  create(): void {
    const { highlight, opts } = this.data0
    this.ui = (this.registry.get('dpr') as number | undefined) ?? 1
    this.s = T[opts.lang] ?? T.en
    const names = { ...(opts.names ?? {}) }
    const heroP = highlight.scenario.players.find((p) => p.isHero)
    if (heroP) names[heroP.id] = opts.heroName ?? this.s.you
    this.rt = new HighlightRuntime(highlight, {
      aimAssist: effectiveAimAssist(opts.settings.aimAssist),
      slowMoAim: opts.settings.slowMoAim,
      difficulty: opts.difficulty,
      weather: opts.weather,
      names,
      importance: opts.importance,
      timingMult: getControlPrefs().timingAssist ? TIMING_ASSIST_MULT : 1,
    })
    this.sfx = new Sfx(opts.settings.sound)
    const replayOnly = this.data0.replayOnly
    this.auto = opts.autopilot && !replayOnly ? createAutopilot(highlight.id.length) : null
    this.rm = !!opts.settings.reducedMotion
    this.noFlash = this.rm || getControlPrefs().noFlash
    this.lowFx = !!opts.settings.lowFx
    this.replayAngle = opts.replayAngle ?? 'auto'
    const capacity = opts.stadium?.capacity ?? 18_000
    this.look = stadiumLook(capacity, this.lowFx)
    this.night = !!opts.stadium?.night
    if (opts.stadium && !replayOnly) {
      try {
        audio.setCrowdSize(capacity, opts.importance)
      } catch {
        /* audio is optional */
      }
    }
    const cb = getControlPrefs().cbMode
    const oppKit = distinctOpponentKit(opts.heroTeamColors, opts.oppColors, cb)
    const heroGk = keeperKit([opts.heroTeamColors, oppKit], 0)
    const oppGk = keeperKit([opts.heroTeamColors, oppKit, heroGk], 2)
    this.kits = { hero: opts.heroTeamColors, opp: oppKit, heroGk, oppGk }
    // Kit clash fallback: still close after the alternate kit (or a colour-blind palette is on) → outline the bodies.
    const close = cvdDistance(this.kits.hero.primary, oppKit.primary, cb) < KIT_MIN_DISTANCE[cb] * 1.25
    if (cb !== 'off' || close) {
      const edge = (hex: string) => (luminance(hex) > 0.45 ? 0x111111 : 0xffffff)
      this.outline = { hero: edge(this.kits.hero.primary), opp: edge(oppKit.primary) }
      // Make the two outlines differ so the teams read apart even in greyscale.
      if (this.outline.hero === this.outline.opp) this.outline.opp = this.outline.hero === 0xffffff ? 0x111111 : 0xffffff
    } else this.outline = { hero: null, opp: null }

    this.cameras.main.setBackgroundColor(this.night ? '#03060b' : '#0b1410')
    this.worldLayer = this.add.layer()
    this.hudLayer = this.add.layer()
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.cameras.main.ignore(this.hudLayer)
    this.uiCam.ignore(this.worldLayer)

    utilTextures(this)
    this.buildStadium()
    this.buildPlayers()
    this.buildBall()
    this.buildFx()
    this.buildHud()

    const canvas = this.game.canvas
    this.input0 = new InputController(canvas, {
      toWorld: (gx, gy) => this.screenToPitch(gx, gy),
      screenDirToWorld: (dx, dy) => screenDirToPitch(dx, dy),
      size: () => ({ w: this.scale.width, h: this.scale.height }),
      ui: () => this.ui,
    })

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    const b = project(this.rt.ball.x, this.rt.ball.y)
    this.cam.x = b.x
    this.cam.y = b.y
    this.cam.zoom = this.cam.base * 0.82
    // Player name labels on demand (N).
    this.onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN' && !e.repeat && !(e.target instanceof HTMLInputElement)) this.labelsOn = !this.labelsOn
    }
    window.addEventListener('keydown', this.onKey)
    if (replayOnly) this.startReplay(replayOnly.frames, replayOnly.keyTime, false)
    // App backgrounded (platform/lifecycle): hold the highlight paused; the player resumes with the pause key / tap.
    const onAppPause = () => {
      if (this.mode === 'play' && !this.paused) {
        this.paused = true
        this.promptText.setText(this.s.paused)
      }
    }
    window.addEventListener('sp:app-pause', onAppPause)
    const offAppPause = () => window.removeEventListener('sp:app-pause', onAppPause)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offAppPause)
    this.events.once(Phaser.Scenes.Events.DESTROY, offAppPause)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup())
    // Dev/e2e: expose the live scene (debugInfo / FPS probes). Stripped from production builds.
    if (import.meta.env.DEV) (globalThis as { __spScene?: MatchScene }).__spScene = this
  }

  /**
   * Dev/e2e probe: key positions in CSS pixels relative to the canvas, plus
   * the runtime state, so automated tests can aim real input at the goal.
   */
  /** Dev/e2e probe: hold a wide view of the far end (stadium screenshots). `null` releases it. */
  debugOverview(on: boolean | null): void {
    this.debugCam = on ? { x: project(PITCH_LENGTH - 6, PITCH_WIDTH / 2).x, y: project(PITCH_LENGTH - 6, PITCH_WIDTH / 2).y, zoom: this.cam.base * 0.62 } : null
  }

  private debugCam: { x: number; y: number; zoom: number } | null = null

  debugInfo() {
    const canvas = this.game.canvas
    const r = canvas.getBoundingClientRect()
    const kx = r.width / Math.max(1, this.scale.width)
    const ky = r.height / Math.max(1, this.scale.height)
    const css = (p: { x: number; y: number }) => {
      const s = this.worldToScreen(p.x, p.y)
      return { x: r.left + s.x * kx, y: r.top + s.y * ky }
    }
    const rt = this.rt
    return {
      phase: rt.phase,
      finished: rt.finished,
      mode: this.mode,
      kind: this.data0.highlight.kind,
      heroOnBall: rt.heroOnBall,
      heroIsKeeper: rt.heroIsKeeper,
      timeLeft: rt.timeLeft,
      goal: css(project(PITCH_LENGTH, GOAL_CENTER_Y, 1)),
      ownGoal: css(project(0, GOAL_CENTER_Y, 1)),
      hero: css(project(rt.hero.pos.x, rt.hero.pos.y)),
      ball: css(project(rt.ball.x, rt.ball.y, rt.ball.z)),
      canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
      fps: this.game.loop.actualFps,
      result: rt.result?.outcome ?? null,
      tier: this.look.tier,
      night: this.night,
      celebration: this.celeb?.id ?? null,
      replayAngle: this.replay ? this.currentAngle() : null,
    }
  }

  private cleanup(): void {
    if (this.onKey) window.removeEventListener('keydown', this.onKey)
    this.onKey = null
    this.input0?.dispose()
    this.sfx?.dispose()
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
  }

  // ───────────────────────── Building ─────────────────────────

  private addW<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.worldLayer.add(o)
    return o
  }

  private addH<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.hudLayer.add(o)
    return o
  }

  private buildStadium(): void {
    const { opts } = this.data0
    const look = this.look
    const night = this.night
    const snow = opts.weather === 'snow'
    const cols = [opts.heroTeamColors.primary, opts.heroTeamColors.secondary, opts.oppColors.primary]
    const spanY0 = -22
    const spanY1 = PITCH_WIDTH + 22
    // How much of the stand shows on screen (the camera stops 13 m past the goal line / 13 m outside the touchlines).
    const VIS_END = { local: 3.6, mid: 5.4, large: 6.6, mega: 7.2 }[look.tier]
    const VIS_SIDE = { local: 3.2, mid: 5, large: 6.4, mega: 7.6 }[look.tier]
    const crowdOpts = { density: look.density, upperTier: look.upperTier, roof: look.roof, tifo: look.tifo, roofLights: look.lights === 'roofline' || look.lights === 'ring', night, snow }

    // Beyond the stands: tree line (small grounds) or city glow (big ones).
    const bg = this.addW(this.add.graphics().setDepth(-60))
    const far = project(PITCH_LENGTH + 6.2 + VIS_END * 0.9, spanY0)
    const topY = project(PITCH_LENGTH + 30, 0).y
    bg.fillStyle(night ? 0x03060b : look.tier === 'local' || look.tier === 'mid' ? 0x10241a : 0x0b1018, 1)
    bg.fillRect(far.x - 40 * PPM, topY, (spanY1 - spanY0 + 80) * PPM, far.y - topY + 2)
    if (look.tier === 'local' || look.tier === 'mid') {
      let s = 17
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
      bg.fillStyle(night ? 0x08130d : 0x1d3b26, 1)
      for (let y = spanY0 - 30; y < spanY1 + 30; y += 2.2) {
        const p = project(PITCH_LENGTH + 6.2 + VIS_END, y)
        bg.fillCircle(p.x, p.y - rnd() * 1.2 * PPM, (1.6 + rnd() * 1.6) * PPM)
      }
      for (const left of [true, false]) {
        const ex = project(0, left ? -5.5 - VIS_SIDE : PITCH_WIDTH + 5.5 + VIS_SIDE).x
        for (let x = -12; x < PITCH_LENGTH + 14; x += 2.4) {
          const p = project(x, 0)
          bg.fillCircle(ex + (left ? -1 : 1) * (1.4 + rnd()) * PPM, p.y, (1.5 + rnd() * 1.4) * PPM)
        }
      }
    }

    // Main stand behind the goal we attack (top of the screen). Local grounds: a short stand behind the goal only.
    const endLen = look.tier === 'local' ? 58 : spanY1 - spanY0
    const endY0 = look.tier === 'local' ? PITCH_WIDTH / 2 - endLen / 2 : spanY0
    const crowdKey = crowdTexture(this, 'crowd_end', endLen, look.endDepth, cols, 7, crowdOpts)
    const top = project(PITCH_LENGTH + 6.2, endY0)
    const endImg = this.addW(this.add.image(top.x, top.y, crowdKey).setOrigin(0, 1).setDepth(-50))
    endImg.setDisplaySize(endLen * PPM, VIS_END * PPM * TILT * 1.05)
    this.stands.push(endImg)
    endImg.setData('y0', endImg.y)
    // Side stands along both touchlines (rows run up the screen).
    const sideLenM = look.tier === 'local' ? 60 : PITCH_LENGTH + 30
    const sideKey = crowdTexture(this, 'crowd_side', sideLenM, look.sideDepth, cols, 11, crowdOpts)
    const sideLen = sideLenM * PPM * TILT
    const sideMidX = look.tier === 'local' ? PITCH_LENGTH / 2 : PITCH_LENGTH / 2 - 0
    const sideCy = look.tier === 'local' ? project(sideMidX, 0).y : project(PITCH_LENGTH + 15, 0).y + sideLen / 2
    for (const left of [true, false]) {
      // Local grounds have a single main stand (left); the other side is open.
      if (look.tier === 'local' && !left) continue
      const edge = project(0, left ? -5.5 : PITCH_WIDTH + 5.5).x
      const wPx = VIS_SIDE * PPM
      const img = this.add.image(left ? edge - wPx / 2 : edge + wPx / 2, sideCy, sideKey)
      img.setDisplaySize(sideLen, wPx).setRotation(left ? -Math.PI / 2 : Math.PI / 2).setDepth(-50)
      this.addW(img)
      this.stands.push(img)
      img.setData('y0', img.y)
    }
    // Dark band behind our own goal (camera side).
    const nb = project(-6, spanY0)
    this.addW(this.add.rectangle(nb.x, nb.y, (spanY1 - spanY0) * PPM, 16 * PPM, 0x070b10).setOrigin(0, 0).setDepth(depthFor(-6)))

    const pitch = this.addW(this.add.graphics().setDepth(-40))
    drawPitch(pitch, opts.weather)
    if (opts.weather === 'rain' || opts.weather === 'snow') {
      const wg = this.addW(this.add.graphics().setDepth(-39.6))
      drawWeatherGround(wg, opts.weather, this.data0.highlight.id.length * 31 + 7, this.lowFx)
    }

    // Ad boards: painted boards at small grounds, LED strips at big ones.
    const lenM = look.tier === 'local' ? 48 : PITCH_WIDTH + 30
    const y0 = look.tier === 'local' ? PITCH_WIDTH / 2 - lenM / 2 : -15
    const farAd = adBoardTexture(this, 'ads_far', lenM, 0, look.ads)
    const fp = project(PITCH_LENGTH + 4, y0)
    const sx = (lenM * PPM) / this.textures.get(farAd).getSourceImage().width
    this.addW(this.add.image(fp.x, fp.y, farAd).setOrigin(0, 1).setScale(sx).setDepth(depthFor(PITCH_LENGTH + 4)))
    if (look.adRows >= 2) {
      const nearAd = adBoardTexture(this, 'ads_near', lenM, 3, look.ads)
      const np = project(-4, y0)
      this.addW(this.add.image(np.x, np.y, nearAd).setOrigin(0, 1).setScale(sx).setDepth(depthFor(-4)).setAlpha(0.92))
    }
    if (look.ads === 'led-glow' && !this.lowFx) {
      // Soft LED spill on the grass in front of the far boards.
      const glow = this.addW(this.add.image(project(PITCH_LENGTH + 3, PITCH_WIDTH / 2).x, fp.y + 0.4 * PPM, 'fx_dot'))
      glow.setDisplaySize(lenM * PPM, 2.6 * PPM).setTint(0x7fb8ff).setAlpha(night ? 0.22 : 0.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(-39.4)
    }

    this.buildLights()

    // Goals: the attacked (top) goal sits behind players; the near goal is drawn in front.
    for (const end of ['east', 'west'] as const) {
      const gx = end === 'east' ? PITCH_LENGTH : 0
      const back = end === 'east' ? gx + 2 : gx - 2
      this.netG[end] = this.addW(this.add.graphics().setDepth(depthFor(back, end === 'east' ? 0 : 5)))
      if (end === 'west') this.netG[end].setAlpha(0.7)
      drawGoal(this.netG[end], end, 'net', null)
      const fg = this.addW(this.add.graphics().setDepth(depthFor(gx, end === 'east' ? 0.5 : 4)))
      drawGoal(fg, end, 'frame', null)
    }

    // Corner flags (they stream with the wind when there is any).
    const wind = windReadout(this.rt.env.wind)
    const wdir = wind ? pitchDirToScreen(wind.dir.x, wind.dir.y) : null
    for (const [cx, cy] of [[0, 0], [0, PITCH_WIDTH], [PITCH_LENGTH, 0], [PITCH_LENGTH, PITCH_WIDTH]] as const) {
      const fgx = this.addW(this.add.graphics().setDepth(depthFor(cx, 0.3)))
      const b = project(cx, cy, 0)
      const t = project(cx, cy, 1.5)
      fgx.lineStyle(0.07 * PPM, 0xf2f2f2, 1)
      fgx.lineBetween(b.x, b.y, t.x, t.y)
      fgx.fillStyle(0xffd23f, 1)
      const dx = wdir ? wdir.x * 0.6 * PPM : (cy === 0 ? 1 : -1) * 0.55 * PPM
      const dy = wdir ? wdir.y * 0.3 * PPM : 0.18 * PPM
      fgx.fillTriangle(t.x, t.y, t.x + dx, t.y + dy + 0.18 * PPM, t.x, t.y + 0.4 * PPM)
    }
  }

  /** Floodlights by stadium tier; lit (glow + light pools + darker surroundings) for evening fixtures. */
  private buildLights(): void {
    const look = this.look
    const night = this.night
    const g = this.addW(this.add.graphics().setDepth(-45))
    const lamps: { x: number; y: number; r: number }[] = []
    const lampCol = night ? 0xfff6d8 : 0xb9c3d3
    if (look.lights === 'poles' || look.lights === 'pylons') {
      const tall = look.lights === 'pylons' ? 22 : 13
      const corners: [number, number][] = [[PITCH_LENGTH + 6.5, -7.5], [PITCH_LENGTH + 6.5, PITCH_WIDTH + 7.5], [-5, -7.5], [-5, PITCH_WIDTH + 7.5]]
      for (const [x, y] of corners) {
        const b = project(x, y, 0)
        const t = project(x, y, tall)
        if (look.lights === 'pylons') {
          // Lattice mast.
          g.lineStyle(0.12 * PPM, 0x8b95a5, 1)
          g.lineBetween(b.x - 0.5 * PPM, b.y, t.x - 0.2 * PPM, t.y)
          g.lineBetween(b.x + 0.5 * PPM, b.y, t.x + 0.2 * PPM, t.y)
          g.lineStyle(0.05 * PPM, 0x8b95a5, 0.8)
          for (let k = 0; k < 10; k++) {
            const a = project(x, y, (tall * k) / 10)
            const c = project(x, y, (tall * (k + 1)) / 10)
            const wA = 0.5 - 0.3 * (k / 10)
            const wC = 0.5 - 0.3 * ((k + 1) / 10)
            g.lineBetween(a.x - wA * PPM, a.y, c.x + wC * PPM, c.y)
          }
          // Lamp bank.
          g.fillStyle(0x2a3140, 1)
          g.fillRect(t.x - 1.6 * PPM, t.y - 1.4 * PPM, 3.2 * PPM, 1.6 * PPM)
          g.fillStyle(lampCol, 1)
          for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(t.x - 1.4 * PPM + i * 0.75 * PPM, t.y - 1.2 * PPM + j * 0.7 * PPM, 0.55 * PPM, 0.5 * PPM)
          lamps.push({ x: t.x, y: t.y - 0.6 * PPM, r: 7 * PPM })
        } else {
          g.lineStyle(0.1 * PPM, 0x9aa3b0, 1)
          g.lineBetween(b.x, b.y, t.x, t.y)
          g.fillStyle(0x2a3140, 1)
          g.fillRect(t.x - 0.7 * PPM, t.y - 0.5 * PPM, 1.4 * PPM, 0.6 * PPM)
          g.fillStyle(lampCol, 1)
          g.fillRect(t.x - 0.6 * PPM, t.y - 0.4 * PPM, 0.5 * PPM, 0.4 * PPM)
          g.fillRect(t.x + 0.1 * PPM, t.y - 0.4 * PPM, 0.5 * PPM, 0.4 * PPM)
          lamps.push({ x: t.x, y: t.y - 0.2 * PPM, r: 4 * PPM })
        }
      }
    } else {
      // Roof-mounted banks: along the far roof edge (and the side roofs for the ring).
      const roofY = project(PITCH_LENGTH + 6.2 + ({ large: 6.6, mega: 7.2 } as Record<string, number>)[look.tier] * 0.96, 0).y
      for (let y = -14; y <= PITCH_WIDTH + 14; y += look.lights === 'ring' ? 9 : 12) lamps.push({ x: project(0, y).x, y: roofY, r: 6 * PPM })
      if (look.lights === 'ring') {
        for (const left of [true, false]) {
          const ex = project(0, left ? -5.5 - 7.3 : PITCH_WIDTH + 5.5 + 7.3).x
          for (let x = 0; x <= PITCH_LENGTH; x += 15) lamps.push({ x: ex, y: project(x, 0).y, r: 6 * PPM })
        }
      }
    }
    if (!night) return
    // Darken the surroundings; the floodlights pool light onto the pitch.
    const dark = { local: 0.5, mid: 0.4, large: 0.32, mega: 0.26 }[look.tier]
    const a = project(PITCH_LENGTH + 40, -40)
    const b = project(-20, PITCH_WIDTH + 40)
    this.addW(this.add.rectangle(a.x, a.y, b.x - a.x, b.y - a.y, 0x02040a, dark).setOrigin(0, 0).setDepth(-39))
    const pools: [number, number][] = [[PITCH_LENGTH * 0.78, PITCH_WIDTH * 0.25], [PITCH_LENGTH * 0.78, PITCH_WIDTH * 0.75], [PITCH_LENGTH * 0.25, PITCH_WIDTH * 0.25], [PITCH_LENGTH * 0.25, PITCH_WIDTH * 0.75], [PITCH_LENGTH / 2, PITCH_WIDTH / 2]]
    for (const [x, y] of pools) {
      const p = project(x, y)
      this.addW(this.add.image(p.x, p.y, 'fx_dot')).setDisplaySize(60 * PPM, 60 * PPM * TILT).setTint(0xfff3d6).setAlpha(0.09 + (1 - dark) * 0.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(-38.5)
    }
    const step = this.lowFx ? 2 : 1
    for (let i = 0; i < lamps.length; i += step) {
      const l = lamps[i]
      this.addW(this.add.image(l.x, l.y, 'fx_dot')).setDisplaySize(l.r * 2, l.r * 2).setTint(0xfff1c8).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(-38)
      this.addW(this.add.image(l.x, l.y, 'fx_dot')).setDisplaySize(l.r * 0.5, l.r * 0.5).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(-38)
    }
  }

  private kitFor(a: Agent): KitColors {
    if (a.isKeeper) return a.team === 'hero' ? this.kits.heroGk : this.kits.oppGk
    return a.team === 'hero' ? this.kits.hero : this.kits.opp
  }

  private buildPlayers(): void {
    for (const a of this.rt.agents) {
      const kit = this.kitFor(a)
      const key = kitTexture(this, `kit_${a.team}_${a.isKeeper ? 'gk' : 'of'}_${a.number}_${a.id}`, kit, a.number)
      let h = 0
      for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0
      const head = headTexture(this, h, 56, this.data0.opts.gender === 'female')
      const c = this.add.container(0, 0)
      const shadow = this.add.image(0, 0, 'fx_shadow').setScale((0.9 * PPM) / 64, (0.9 * PPM * TILT) / 32 * 0.5)
      let ring: Phaser.GameObjects.Image | null = null
      if (a.isHero) {
        ring = this.add.image(0, 0, 'fx_glow').setTint(0xffd23f).setBlendMode(Phaser.BlendModes.ADD)
        ring.setScale((2.0 * PPM) / 128, ((2.0 * PPM) / 128) * TILT)
      }
      const legs = this.add.graphics()
      const body = this.add.image(0, -zpx(TORSO_Z), key).setScale(BODY_D / 112)
      const hd = this.add.image(0, -zpx(HEAD_Z), head).setScale(HEAD_D / 56)
      // Arms only matter for celebrations (scorer + team-mates).
      const arms = a.team === 'hero' && !a.isKeeper ? this.add.graphics() : null
      const parts: Phaser.GameObjects.GameObject[] = []
      if (ring) {
        // Colour-blind modes: a second (white) ring so the hero never relies on the gold hue alone.
        if (getControlPrefs().cbMode !== 'off') {
          this.ring2 = this.add.image(0, 0, 'fx_glow').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD)
          parts.push(this.ring2)
        }
        parts.push(ring)
      }
      parts.push(shadow, legs, body)
      if (arms) parts.push(arms)
      parts.push(hd)
      c.add(parts)
      this.addW(c)
      const p = project(a.pos.x, a.pos.y)
      this.views.push({ agent: a, c, shadow, legs, body, head: hd, ring, arms, phase: 0, lastX: p.x, lastY: p.y })
    }
  }

  private buildBall(): void {
    const key = ballTexture(this, this.data0.opts.weather)
    this.ballShadow = this.addW(this.add.image(0, 0, 'fx_shadow').setScale((0.5 * PPM) / 64, ((0.5 * PPM) / 32) * TILT * 0.5))
    this.trailG = this.addW(this.add.graphics())
    this.ballImg = this.addW(this.add.image(0, 0, key).setScale(BALL_D / 64))
    this.aimG = this.addW(this.add.graphics().setDepth(5_000_000))
  }

  private buildFx(): void {
    this.grassFx = this.addW(
      this.add.particles(0, 0, 'fx_sq', {
        emitting: false,
        speed: { min: 30, max: 120 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        lifespan: { min: 300, max: 650 },
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x3c8a3a, 0x58a84b, 0x6e5a32, 0x2f6d2c],
      }),
    ).setDepth(4_000_000)
    this.confetti = this.addW(
      this.add.particles(0, 0, 'fx_sq', {
        emitting: false,
        speed: { min: 120, max: 420 },
        angle: { min: 220, max: 320 },
        gravityY: 220,
        lifespan: { min: 1400, max: 2600 },
        scale: { start: 0.9, end: 0.5 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0.2 },
        tint: [0xffd23f, 0xffffff, colorNum(this.kits.hero.primary), colorNum(this.kits.hero.secondary), 0xff4f6d, 0x3fd2ff],
      }),
    ).setDepth(4_500_000)
  }

  private text(size: number, color = '#ffffff', weight = '800'): Phaser.GameObjects.Text {
    return this.addH(
      this.add
        .text(0, 0, '', {
          fontFamily: "system-ui, 'Segoe UI', Roboto, Arial, sans-serif",
          fontSize: `${Math.round(size * this.ui)}px`,
          fontStyle: weight === '900' ? 'bold' : weight === '800' ? 'bold' : 'normal',
          color,
          stroke: '#000000',
          strokeThickness: Math.max(2, Math.round(size * this.ui * 0.12)),
        })
        .setOrigin(0.5),
    )
  }

  private buildHud(): void {
    const { opts } = this.data0
    this.vignette = this.addH(this.add.image(0, 0, 'fx_vignette').setOrigin(0, 0).setAlpha(0))
    this.flash = this.addH(this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0, 0).setAlpha(0))
    this.hudG = this.addH(this.add.graphics())
    this.scoreText = this.text(15, '#ffffff', '800').setOrigin(0, 0.5)
    this.promptText = this.text(17, '#ffffff', '700')
    this.bannerText = this.text(54, '#ffd23f', '900').setAlpha(0)
    this.bannerSub = this.text(18, '#ffffff', '700').setAlpha(0)
    this.focusText = this.text(11, '#9fe8ff', '800').setAlpha(0)
    this.tagText = this.text(12, '#111111', '800')
    this.tagText.setStroke('#ffd23f', 0)
    this.sprintText = this.text(12, '#ffffff', '800')
    this.skillText = this.text(11, '#ffffff', '800')
    this.replayText = this.text(16, '#ffffff', '900').setAlpha(0)
    this.tagText.setText(`${this.rt.hero.number}  ${this.rt.hero.name}`)
    this.sprintText.setText(this.s.sprint)
    this.skillText.setText(this.s.skill)
    this.focusText.setText(this.s.focus)
    this.replayText.setText(`● ${this.s.replay}`)
    this.angleText = this.text(11, '#ffffff', '800').setAlpha(0)
    this.overlayG = this.addW(this.add.graphics().setDepth(-30))
    // Weather read-out (wind arrow + km/h, rain / snow icon) at the right of the HUD band.
    const wind = windReadout(this.rt.env.wind)
    if (wind || opts.weather === 'rain' || opts.weather === 'snow') {
      this.windText = this.text(11, '#dfe9ff', '800').setOrigin(1, 0.5)
      const icon = opts.weather === 'rain' ? '☂' : opts.weather === 'snow' ? '❄' : ''
      this.windText.setText(`${icon}${icon && wind ? '  ' : ''}${wind ? `${wind.kmh} km/h` : ''}`)
    }
    this.promptText.setText(this.data0.highlight.scenario.prompt)
    this.promptT = 0
    // Aim-assist level and its rating/XP multiplier (less assist, more reward).
    this.assistText = this.text(10, '#c9d6e8', '800').setOrigin(1, 0.5)
    this.assistText.setText(`${this.s[`aim_${this.rt.assist}`]} · ×${ASSIST_REWARD[this.rt.assist].toFixed(2)} XP`)

    const h = this.data0.highlight
    const heroName = opts.teamNames?.hero ?? (h.side === 'home' ? 'HOME' : 'AWAY')
    const oppName = opts.teamNames?.opp ?? (h.side === 'home' ? 'AWAY' : 'HOME')
    const home = h.side === 'home' ? heroName : oppName
    const away = h.side === 'home' ? oppName : heroName
    this.scoreText.setText(`${h.minute}'   ${upper(home.slice(0, 3), opts.lang)}  ${h.score[0]} - ${h.score[1]}  ${upper(away.slice(0, 3), opts.lang)}`)

    // Weather particles over the screen.
    if (opts.weather === 'rain' || opts.weather === 'snow') {
      const rain = opts.weather === 'rain'
      this.addH(
        this.add.particles(0, 0, rain ? 'fx_streak' : 'fx_dot', {
          x: { min: -50, max: 4000 },
          y: -20,
          lifespan: rain ? 700 : 5000,
          speedY: rain ? { min: 1300, max: 1700 } : { min: 50, max: 110 },
          speedX: rain ? { min: -260, max: -180 } : { min: -40, max: 40 },
          scale: rain ? { min: 0.6 * this.ui, max: 1.1 * this.ui } : { min: 0.25 * this.ui, max: 0.6 * this.ui },
          alpha: rain ? { min: 0.25, max: 0.5 } : { min: 0.6, max: 0.95 },
          rotate: rain ? 8 : 0,
          frequency: (rain ? 8 : 40) * (this.lowFx ? 2 : 1),
          quantity: rain ? (this.lowFx ? 2 : 3) : 2,
        }),
      )
    }
  }

  /** Recomputes camera sizes and HUD layout after a resize. */
  private layout(): void {
    const w = this.scale.width
    const h = this.scale.height
    const u = this.ui
    const landscape = w >= h
    this.safeTop = safeAreaTop(this.game.canvas) * u
    // HUD band: row 1 = score bug + moment timer, row 2 = prompt / focus label.
    this.promptText.setFontSize(Math.round((landscape ? 16 : 14) * u))
    this.promptText.setWordWrapWidth(landscape ? Math.min(w * 0.7, 900 * u) : w - 28 * u)
    const row1 = 40 * u
    const row2 = Math.max(24 * u, this.promptText.height + 8 * u)
    this.hudTop = Math.round(this.safeTop + row1 + row2)
    const vh = Math.max(1, h - this.hudTop)
    this.cameras.main.setViewport(0, this.hudTop, w, vh)
    this.uiCam.setSize(w, h)
    const metersAcross = landscape ? 40 : 24
    let z = w / (metersAcross * PPM)
    // Always show enough pitch ahead of the play.
    z = Math.min(z, vh / (24 * PPM * TILT))
    this.cam.base = z
    this.vignette.setDisplaySize(w, h)
    this.flash.setSize(w, h)
    const top = this.safeTop
    this.scoreText.setPosition(24 * u, top + 20 * u)
    const sbRight = 14 * u + this.scoreText.width + 22 * u
    const bw0 = Math.min(w * 0.42, 380 * u)
    const bx = Math.max(w / 2 - bw0 / 2, sbRight + 14 * u)
    const reserve = this.windText ? this.windText.width + 34 * u : 0
    const bwMax = w - 16 * u - bx - reserve
    this.bar = { x: bx, y: top + 17 * u, w: Math.max(40 * u, Math.min(bw0, bwMax)) }
    this.windText?.setPosition(w - 12 * u, top + 20 * u)
    this.assistText?.setPosition(w - 12 * u, top + row1 + row2 / 2)
    this.promptText.setPosition(w / 2, top + row1 + row2 / 2 - 2 * u)
    this.focusText.setPosition(w / 2, top + row1 + row2 / 2)
    this.bannerText.setPosition(w / 2, this.hudTop + vh * 0.3)
    this.bannerSub.setPosition(w / 2, this.hudTop + vh * 0.3 + 46 * u)
    this.replayText.setPosition(w - 70 * u, 26 * u)
  }

  // ───────────────────────── Coordinate helpers ─────────────────────────

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const w = this.scale.width
    const vh = this.scale.height - this.hudTop
    return { x: (wx - this.cam.x) * this.cam.zoom + w / 2, y: (wy - this.cam.y) * this.cam.zoom + this.hudTop + vh / 2 }
  }

  private screenToPitch(gx: number, gy: number): { x: number; y: number } {
    const w = this.scale.width
    const vh = this.scale.height - this.hudTop
    const wx = (gx - w / 2) / this.cam.zoom + this.cam.x
    const wy = (gy - this.hudTop - vh / 2) / this.cam.zoom + this.cam.y
    return unproject(wx, wy)
  }

  // ───────────────────────── Main loop ─────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1000))
    this.elapsed += dt
    const rt = this.rt
    const intent = this.input0.poll({
      heroPos: rt.hero.pos,
      ballPos: { x: rt.ball.x, y: rt.ball.y },
      heroOnBall: rt.heroOnBall,
      heroIsKeeper: rt.heroIsKeeper,
      mates: this.matePositions(),
    })
    this.lastIntent = intent
    if (intent.any) this.sfx.unlock()

    if (intent.pause && this.mode === 'play') {
      this.paused = !this.paused
      this.promptText.setText(this.paused ? this.s.paused : this.data0.highlight.scenario.prompt)
    }
    if (this.mode === 'play' && this.paused) {
      this.renderLive(0)
    } else if (this.mode === 'play') {
      if (this.auto) {
        autopilotStep(rt, this.auto)
        rt.update(dt)
      } else {
        // Single entry point shared with the replayer: the recording reproduces the moment exactly.
        applyInput(rt, intent, dt, this.inputRec)
      }
      this.handleEvents(rt.drainEvents())
      this.renderLive(dt)
      if (rt.finished) this.afterPlay()
    } else if (this.mode === 'celebrate') {
      this.renderCelebration(dt, intent.skip)
    } else if (this.mode === 'replay') {
      this.renderReplay(dt, intent.skip)
    }
    this.drawOverlay(dt)
    this.updateHud(dt, intent)
  }

  /** Team-mate positions (meter scheme: tapping a team-mate stays a pass). */
  private matePositions(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = []
    for (const a of this.rt.agents) if (a.team === 'hero' && !a.isHero) out.push(a.pos)
    return out
  }

  private afterPlay(): void {
    const rt = this.rt
    this.recordThisMoment()
    // Dev / bug reports: the deterministic input log of the moment just played.
    if (import.meta.env.DEV) {
      ;(globalThis as { __spInputLog?: unknown }).__spInputLog = this.inputRec.toRecording(this.data0.highlight.id, {
        aimAssist: rt.assist,
        slowMoAim: rt.slowMoAim,
        difficulty: this.data0.opts.difficulty,
        weather: this.data0.opts.weather,
        importance: this.data0.opts.importance,
        timingMult: rt.timingMult,
      })
    }
    const r = rt.result
    if (r?.outcome === 'goal' && (!r.scorerId || r.scorerId === rt.hero.id) && !this.data0.replayOnly) {
      this.startCelebration()
      return
    }
    this.afterCelebration()
  }

  /** Goal replay (when enabled) after the celebration, else done. */
  private afterCelebration(): void {
    const rt = this.rt
    const wantReplay = (this.data0.opts.replay ?? true) && rt.goalTime > 0
    if (wantReplay) {
      const frames = rt.replayFrames().filter((f) => f.t >= rt.goalTime - 3.4 && f.t <= rt.goalTime + 0.9)
      if (frames.length > 20 && this.startReplay([...frames], rt.goalTime, true)) return
    }
    this.complete()
  }

  /** Enters replay mode over `frames` (slow-motion around `keyT`). */
  private startReplay(frames: ReplayFrame[], keyT: number, flash: boolean): boolean {
    if (frames.length < 8) return false
    this.mode = 'replay'
    const t0 = frames[0].t
    const t1 = frames[frames.length - 1].t
    const kT = keyT > 0 ? keyT : t1 - 1.2
    const ro = this.data0.replayOnly
    const goal = ro ? ro.outcome === 'goal' || ro.outcome === 'conceded' || ro.outcome === 'assist' : this.rt.goalTime > 0
    // Which goal the action heads for: where the ball is at the key moment.
    const kf = frames.reduce((a, f) => (Math.abs(f.t - kT) < Math.abs(a.t - kT) ? f : a), frames[0])
    this.replay = { frames, t: t0, t0, t1, keyT: kT, goal, endX: kf.bx > PITCH_LENGTH / 2 ? PITCH_LENGTH : 0 }
    this.bannerText.setAlpha(0)
    this.bannerSub.setAlpha(0)
    this.trail.length = 0
    this.ripple.east = null
    this.ripple.west = null
    if (flash && !this.noFlash) this.cameras.main.flash(200, 255, 255, 255)
    return true
  }

  /** Stores a compact recording of this moment for the Moments list (session memory only). */
  private recordThisMoment(): void {
    if (this.data0.replayOnly) return
    const rt = this.rt
    const { opts, highlight } = this.data0
    try {
      recordMoment({
        matchKey: opts.matchKey ?? 'demo',
        minute: highlight.minute,
        kind: highlight.kind,
        outcome: rt.result?.outcome ?? 'timeout',
        highlight,
        frames: compactFrames(rt.replayFrames()),
        keyTime: rt.goalTime > 0 ? rt.goalTime : this.lastKeyT,
        view: {
          heroTeamColors: opts.heroTeamColors, oppColors: opts.oppColors, weather: opts.weather, lang: opts.lang, names: opts.names,
          heroName: opts.heroName, teamNames: opts.teamNames, stadium: opts.stadium, gender: opts.gender,
        },
      })
    } catch {
      /* recording is best effort */
    }
  }

  private complete(): void {
    if (this.finished) return
    this.finished = true
    this.mode = 'done'
    const r = this.rt.result ?? this.rt.buildResult('timeout')
    // Defer so the callback can safely tear down the game.
    setTimeout(() => this.data0.onDone(r), 0)
  }

  // ───────────────────────── Rendering ─────────────────────────

  private renderLive(dt: number): void {
    const rt = this.rt
    const a = rt.alpha
    const lerp = (p: number, c: number) => p + (c - p) * a
    for (const v of this.views) {
      const ag = v.agent
      const x = lerp(ag.prev.x, ag.pos.x)
      const y = lerp(ag.prev.y, ag.pos.y)
      const z = lerp(ag.prev.z, ag.z)
      this.drawPlayer(v, x, y, z, ag.facing, ag.state, ag.stateT, dt)
    }
    const bx = lerp(rt.prevBall.x, rt.ball.x)
    const by = lerp(rt.prevBall.y, rt.ball.y)
    const bz = lerp(rt.prevBall.z, rt.ball.z)
    const speed = Math.hypot(rt.ball.vx, rt.ball.vy, rt.ball.vz)
    this.drawBall(bx, by, bz, speed, dt)
    this.drawAim()
    this.updateNets(dt)
    this.updateCamera(dt, bx, by, bz, false)
  }

  private drawPlayer(v: PlayerView, x: number, y: number, z: number, facing: number, state: string, stateT: number, dt: number, pose?: CelebrationPose): void {
    const p = project(x, y)
    v.c.setPosition(p.x, p.y)
    v.c.setDepth(depthFor(x, v.agent.isHero ? 0.2 : 0))
    const moved = Math.hypot(p.x - v.lastX, p.y - v.lastY)
    v.lastX = p.x
    v.lastY = p.y
    const speedPx = dt > 0 ? moved / dt : 0
    v.phase += moved * 0.32
    const fd = pitchDirToScreen(Math.cos(facing), Math.sin(facing))

    // Body pose by state.
    let rot = 0
    let torsoZ = TORSO_Z + z
    let headZ = HEAD_Z + z
    let legsOn = true
    const side = fd.x >= 0 ? 1 : -1
    if (state === 'slide') {
      rot = side * 1.15
      torsoZ = 0.45
      headZ = 0.65
      legsOn = false
    } else if (state === 'dive') {
      rot = side * 1.35
      torsoZ = 0.55 + z
      headZ = 0.62 + z
      legsOn = false
    } else if (state === 'down') {
      rot = side * 1.45
      torsoZ = 0.32
      headZ = 0.36
      legsOn = false
    } else if (state === 'celebrate') {
      const bounce = this.rm ? 0 : Math.abs(Math.sin(stateT * 9)) * 0.35
      torsoZ += bounce
      headZ += bounce
    }
    if (pose) {
      rot = pose.rot
      if (pose.torsoZ !== null) {
        torsoZ = pose.torsoZ + pose.lift
        headZ = pose.torsoZ + 0.55 + pose.lift
      } else {
        torsoZ = TORSO_Z + z + pose.lift
        headZ = HEAD_Z + z + pose.lift
      }
      legsOn = pose.legs
    }
    v.body.setPosition(0, -zpx(torsoZ)).setRotation(rot)
    // Head sits on top of the torso along the body axis.
    const hx = Math.sin(rot) * zpx(headZ - torsoZ + 0.1)
    const hy = -zpx(torsoZ) - Math.cos(rot) * zpx(headZ - torsoZ)
    v.head.setPosition(state === 'dive' || state === 'slide' || state === 'down' || (pose && rot !== 0) ? hx : 0, hy)
    v.shadow.setAlpha(clampN(1 - z * 0.6, 0.35, 1))
    if (v.ring) {
      const pulse = this.rm ? 1 : 1 + Math.sin(this.elapsed * 5) * 0.08
      v.ring.setScale(((2.0 * PPM) / 128) * pulse, ((2.0 * PPM) / 128) * TILT * pulse)
      v.ring.setAlpha(this.mode === 'play' ? (this.rt.heroOnBall ? 0.95 : 0.65) : 0.35)
      if (this.ring2) this.ring2.setScale(((2.7 * PPM) / 128) * pulse, ((2.7 * PPM) / 128) * TILT * pulse).setAlpha(this.mode === 'play' ? 0.75 : 0.3)
    }

    // Arms (celebrations only).
    if (v.arms) {
      const ag = v.arms
      ag.clear()
      const arms = pose?.arms ?? 'none'
      if (arms !== 'none') {
        const kitA = this.kitFor(v.agent)
        const sy = -zpx(torsoZ + 0.12)
        const sw = 0.24 * PPM
        const hand = 0xe0ac7e
        ag.lineStyle(0.13 * PPM, colorNum(kitA.primary), 1)
        const arm = (x0: number, y0: number, x1: number, y1: number) => {
          ag.lineBetween(x0, y0, x1, y1)
          ag.fillStyle(hand, 1)
          ag.fillCircle(x1, y1, 0.07 * PPM)
        }
        const c = Math.cos(rot)
        const s = Math.sin(rot)
        const R = (px: number, py: number) => ({ x: px * c - py * s, y: px * s + py * c })
        const L0 = R(-sw, 0)
        const R0 = R(sw, 0)
        if (arms === 'out') {
          const l1 = R(-0.95 * PPM, -0.05 * PPM)
          const r1 = R(0.95 * PPM, -0.05 * PPM)
          arm(L0.x, sy + L0.y, l1.x, sy + l1.y)
          arm(R0.x, sy + R0.y, r1.x, sy + r1.y)
        } else if (arms === 'up') {
          arm(-sw, sy, -0.38 * PPM, sy - zpx(0.95))
          arm(sw, sy, 0.38 * PPM, sy - zpx(0.95))
        } else if (arms === 'point') {
          arm(sw, sy, 0.3 * PPM, sy - zpx(1.0))
        } else if (arms === 'mouth') {
          arm(sw, sy, 0.02 * PPM, -zpx(headZ - 0.12))
          ag.lineStyle(0.05 * PPM, 0xffffff, 0.9)
          ag.lineBetween(0, -zpx(headZ + 0.05), 0, -zpx(headZ - 0.2))
        } else if (arms === 'chest') {
          arm(sw, sy, 0.02 * PPM, -zpx(torsoZ + 0.05))
          arm(-sw, sy, -0.04 * PPM, -zpx(torsoZ + 0.02))
        } else if (arms === 'kick') {
          arm(-sw, sy, -0.7 * PPM, sy - zpx(0.3))
          arm(sw, sy, 0.7 * PPM, sy - zpx(0.3))
        }
      }
    }

    // Legs + facing chevron.
    const g = v.legs
    g.clear()
    const kit = this.kitFor(v.agent)
    // Kit clash / colour-blind outline around the body disc.
    const oc = v.agent.isKeeper ? null : this.outline[v.agent.team === 'hero' ? 'hero' : 'opp']
    if (oc !== null) {
      g.fillStyle(oc, 0.95)
      g.fillCircle(0, -zpx(torsoZ), BODY_D / 2 + 0.07 * PPM)
    }
    // Direction indicator on the ground.
    const tipD = 0.95 * PPM
    g.fillStyle(v.agent.isHero ? 0xffd23f : v.agent.team === 'hero' ? 0xffffff : 0x111111, v.agent.isHero ? 0.95 : 0.45)
    const tx = fd.x * tipD
    const ty = fd.y * tipD
    const px = -fd.y * 0.22 * PPM
    const py = fd.x * 0.22 * PPM
    g.fillTriangle(tx, ty, fd.x * tipD * 0.62 + px, fd.y * tipD * 0.62 + py, fd.x * tipD * 0.62 - px, fd.y * tipD * 0.62 - py)
    if (legsOn) {
      const stride = Math.min(1, speedPx / (6 * PPM)) * 0.32 * PPM
      const s = Math.sin(v.phase)
      const hip = -zpx(HIP_Z + z)
      const lift = z > 0.05 ? -zpx(z) : 0
      const lx = -0.13 * PPM
      const rx = 0.13 * PPM
      const footL = { x: lx + fd.x * stride * s, y: lift + fd.y * stride * s * 0.6 - Math.max(0, -s) * 2 }
      const footR = { x: rx - fd.x * stride * s, y: lift - fd.y * stride * s * 0.6 - Math.max(0, s) * 2 }
      g.lineStyle(0.17 * PPM, colorNum(kit.secondary), 1)
      g.lineBetween(lx * 0.7, hip, footL.x, footL.y - 2)
      g.lineBetween(rx * 0.7, hip, footR.x, footR.y - 2)
      g.fillStyle(0x161616, 1)
      g.fillCircle(footL.x, footL.y - 1, 0.1 * PPM)
      g.fillCircle(footR.x, footR.y - 1, 0.1 * PPM)
    }
  }

  private drawBall(x: number, y: number, z: number, speed: number, dt: number): void {
    const g = project(x, y, 0)
    const b = project(x, y, z)
    this.ballShadow.setPosition(g.x, g.y).setAlpha(clampN(0.85 - z * 0.12, 0.2, 0.85))
    const sh = 1 + z * 0.12
    this.ballShadow.setScale(((0.5 * PPM) / 64) * sh, ((0.5 * PPM) / 32) * TILT * 0.5 * sh)
    this.ballShadow.setDepth(depthFor(x, -0.4))
    this.ballImg.setPosition(b.x, b.y)
    this.ballImg.setScale((BALL_D / 64) * (1 + z * 0.06))
    this.ballImg.rotation += (speed * dt) / 0.11 * 0.15 * Math.sign(this.rt.ball.vx || 1)
    this.ballImg.setDepth(z > 2.1 ? 3_000_000 : depthFor(x, 0.5))
    // Trail for fast shots.
    this.trail.push({ x: b.x, y: b.y })
    if (this.trail.length > 14) this.trail.shift()
    this.trailG.clear()
    this.trailG.setDepth(this.ballImg.depth - 0.01)
    if (speed > 15 && this.trail.length > 2) {
      const n = this.trail.length
      for (let i = 1; i < n; i++) {
        const t = i / n
        this.trailG.lineStyle(BALL_D * 0.9 * t, 0xffffff, 0.35 * t * Math.min(1, (speed - 15) / 10))
        this.trailG.lineBetween(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i].x, this.trail[i].y)
      }
    }
  }

  private drawAim(): void {
    const g = this.aimG
    g.clear()
    const rt = this.rt
    if (rt.phase !== 'live') return
    const hero = rt.hero
    const hp = project(hero.pos.x, hero.pos.y)
    // Aim preview: dotted predicted path.
    const pv = rt.preview()
    if (pv) {
      const shot = pv.kind === 'shot' || pv.kind === 'chip' || pv.kind === 'penalty' || pv.kind === 'freekick'
      const col = shot ? 0xffd23f : 0xffffff
      const n = pv.points.length
      // Continuous path under the dots (dark halo first so it reads on any grass/weather).
      if (n > 2) {
        for (const [w, c, al] of [[0.13, 0x000000, 0.3], [0.05, col, 0.55]] as const) {
          g.lineStyle(w * PPM, c, al)
          g.beginPath()
          const p0 = project(pv.points[0].x, pv.points[0].y, pv.points[0].z)
          g.moveTo(p0.x, p0.y)
          for (let i = 1; i < n; i++) {
            const q = project(pv.points[i].x, pv.points[i].y, pv.points[i].z)
            g.lineTo(q.x, q.y)
          }
          g.strokePath()
        }
      }
      // Pass target: the team-mate the ball is heading for (clearer the better the hero's vision).
      if (!shot) {
        const end = pv.points[n - 1]
        let best: Agent | null = null
        let bd = 7
        for (const a of rt.agents) {
          if (a.team !== 'hero' || a.isHero) continue
          const d = Math.hypot(a.pos.x - end.x, a.pos.y - end.y)
          if (d < bd) {
            bd = d
            best = a
          }
        }
        if (best) {
          const vis = clampN((hero.attrs.vision ?? 50) / 100, 0.3, 1)
          const bp = project(best.pos.x, best.pos.y)
          const pr = (1.05 + Math.sin(this.elapsed * 6) * (this.rm ? 0 : 0.08)) * PPM
          g.lineStyle(0.1 * PPM, 0x5dff8a, 0.45 + vis * 0.5)
          g.strokeEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT)
          g.fillStyle(0x5dff8a, 0.1 + vis * 0.15)
          g.fillEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT)
        }
      }
      for (let i = 1; i < n; i++) {
        const pt = pv.points[i]
        const q = project(pt.x, pt.y, pt.z)
        const t = i / n
        g.fillStyle(col, 0.95 - t * 0.55)
        g.fillCircle(q.x, q.y, (0.16 - t * 0.07) * PPM)
        // Ground shadow dots for aerial balls.
        if (pt.z > 0.4 && i % 2 === 0) {
          const s = project(pt.x, pt.y, 0)
          g.fillStyle(0x000000, 0.18)
          g.fillCircle(s.x, s.y, 0.09 * PPM)
        }
      }
      const last = pv.points[n - 1]
      const lp = project(last.x, last.y, last.z)
      g.lineStyle(0.07 * PPM, col, 0.9)
      g.strokeEllipse(lp.x, lp.y, 0.9 * PPM, 0.9 * PPM * (shot ? 1 : TILT))
      // Power ring around the hero (red beyond 100%).
      const pw = this.lastIntent?.power ?? pv.power
      this.drawPowerRing(g, hp.x, hp.y, pw, this.lastIntent?.oscillating ?? false)
    } else if (rt.heroOnBall && rt.setPiece) {
      // Set piece idle: pulsing reticle in the goal + panic tremble.
      const pan = rt.panicOffset()
      const gp = project(PITCH_LENGTH, GOAL_CENTER_Y + pan.y, 1.1 + pan.z)
      const r = (0.6 + Math.sin(this.elapsed * 4) * 0.08) * PPM
      g.lineStyle(0.08 * PPM, 0xffd23f, 0.8)
      g.strokeCircle(gp.x, gp.y, r)
      g.lineBetween(gp.x - r * 1.4, gp.y, gp.x + r * 1.4, gp.y)
      g.lineBetween(gp.x, gp.y - r * 1.4, gp.x, gp.y + r * 1.4)
    }
    if (!pv && (this.lastIntent?.power ?? 0) > 0 && !rt.heroOnBall) this.drawPowerRing(g, hp.x, hp.y, this.lastIntent!.power)
    // Vision: the best pass options the hero sees (count/range grow with Vision), when not aiming.
    if (!pv && getControlPrefs().visionHints) {
      const ids = rt.passOptions()
      for (let i = 0; i < ids.length; i++) {
        const a = this.agentById(ids[i])
        if (!a) continue
        const bp = project(a.pos.x, a.pos.y)
        const r = (0.95 - i * 0.12) * PPM
        g.lineStyle(0.08 * PPM, 0x5dff8a, 0.75 - i * 0.18)
        g.strokeEllipse(bp.x, bp.y, r * 2, r * 2 * TILT)
      }
    }
    // One-two: the receiver who will return the ball (tap again); solid once requested.
    const ot = rt.oneTwoHint()
    if (ot) {
      const a = this.agentById(ot.id)
      if (a) {
        const bp = project(a.pos.x, a.pos.y)
        const pr = (1.15 + (ot.armed || this.rm ? 0 : Math.sin(this.elapsed * 9) * 0.12)) * PPM
        g.lineStyle(0.11 * PPM, 0x9fe8ff, ot.armed ? 0.95 : 0.7)
        g.strokeEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT)
        if (ot.armed) {
          g.fillStyle(0x9fe8ff, 0.18)
          g.fillEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT)
        }
      }
    }

    // Header timing ring.
    if (rt.headerChance && hero.state !== 'jump') {
      const eta = dist(rt.ball, hero.pos) / Math.max(4, Math.hypot(rt.ball.vx, rt.ball.vy))
      const ready = eta < 0.35
      const r = (0.55 + Math.min(2.5, eta * 3)) * PPM
      const head = project(hero.pos.x, hero.pos.y, HEAD_Z)
      g.lineStyle(0.1 * PPM, ready ? 0x5dff8a : 0xffffff, ready ? 1 : 0.6)
      g.strokeEllipse(head.x, head.y, r * 2, r * 2 * TILT)
      if (ready) this.floatText(this.s.header, hero.pos.x, hero.pos.y, '#5dff8a', 0.25, 2.6)
    }
    // Full assist keeper hint: predicted crossing.
    if (rt.heroIsKeeper && this.data0.opts.settings.aimAssist === 'full' && !rt.owner && Math.hypot(rt.ball.vx, rt.ball.vy) > 9) {
      const tgt = rt.ball.vx < 0 ? 0.3 : null
      if (tgt !== null) {
        const t = (hero.pos.x - rt.ball.x) / (rt.ball.vx || -1)
        if (t > 0 && t < 2) {
          const yy = rt.ball.y + rt.ball.vy * t
          const q = project(hero.pos.x, yy, 0.9)
          g.lineStyle(0.08 * PPM, 0x9fe8ff, 0.7)
          g.strokeCircle(q.x, q.y, 0.45 * PPM)
        }
      }
    }
  }

  private agentById(id: string): Agent | undefined {
    for (const a of this.rt.agents) if (a.id === id) return a
    return undefined
  }

  private drawPowerRing(g: Phaser.GameObjects.Graphics, x: number, y: number, power: number, oscillating = false): void {
    if (power <= 0.01) return
    const r = 1.25 * PPM
    if (oscillating) {
      // Oscillating meter: mark the sweet spot (85–100%) so the timing target is readable.
      g.lineStyle(0.3 * PPM, 0xffffff, 0.22)
      for (let i = 0; i < 6; i++) {
        const a0 = -Math.PI / 2 + ((0.85 + i * 0.025) / 1.15) * Math.PI * 2
        const a1 = -Math.PI / 2 + ((0.875 + i * 0.025) / 1.15) * Math.PI * 2
        g.lineBetween(x + Math.cos(a0) * r, y + Math.sin(a0) * r * TILT, x + Math.cos(a1) * r, y + Math.sin(a1) * r * TILT)
      }
    }
    const steps = 48
    const frac = Math.min(1.15, power) / 1.15
    g.lineStyle(0.18 * PPM, 0x000000, 0.35)
    g.strokeEllipse(x, y, r * 2, r * 2 * TILT)
    for (let i = 0; i < steps * frac; i++) {
      const a0 = -Math.PI / 2 + (i / steps) * Math.PI * 2
      const a1 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2
      const pf = ((i + 1) / steps) * 1.15
      const col = pf > 1 ? 0xff3b3b : pf > 0.85 ? 0xffb02e : 0x5dff8a
      g.lineStyle(0.16 * PPM, col, 0.95)
      g.lineBetween(x + Math.cos(a0) * r, y + Math.sin(a0) * r * TILT, x + Math.cos(a1) * r, y + Math.sin(a1) * r * TILT)
    }
  }

  private updateNets(dt: number): void {
    for (const end of ['east', 'west'] as const) {
      const r = this.ripple[end]
      if (!r) continue
      r.t += dt
      this.netG[end].clear()
      drawGoal(this.netG[end], end, 'net', r.t > 2 ? null : r)
      if (r.t > 2) this.ripple[end] = null
    }
  }

  private updateCamera(dt: number, bx: number, by: number, bz: number, replay: boolean, target?: { x: number; y: number; zoom: number }): void {
    const rt = this.rt
    let tx: number
    let ty: number
    if (this.debugCam) target = this.debugCam
    if (target) {
      tx = target.x
      ty = target.y
    } else {
      // Target in pitch space: ball + velocity look-ahead + lean toward the action.
      let px = bx
      let py = by
      if (!replay) {
        const look = 0.38
        px += clampN(rt.ball.vx * look, -9, 9)
        py += clampN(rt.ball.vy * look, -6, 6)
        if (rt.heroOnBall) px += 5
        if (rt.heroIsKeeper) px += 7
      }
      const b = project(px, py, bz * 0.5)
      tx = b.x
      ty = b.y
    }
    const k = 1 - Math.exp(-dt * (target ? 3 : replay ? 2.2 : 3.4))
    this.cam.x += (tx - this.cam.x) * k
    this.cam.y += (ty - this.cam.y) * k
    this.cam.punch *= Math.exp(-dt * 5)
    if (this.rm) this.cam.punch = 0
    const bulletZoom = !this.rm && this.mode === 'play' && rt.timeScale < 0.95 ? (1 - rt.timeScale) * 0.12 : 0
    const targetZoom = target ? target.zoom : this.cam.base * (1 + this.cam.punch + bulletZoom + (replay && !this.rm ? 0.18 : 0))
    this.cam.zoom += (targetZoom - this.cam.zoom) * (1 - Math.exp(-dt * (target ? 2.6 : 4)))
    // Clamp to the stadium.
    const w = this.scale.width
    const h = this.scale.height - this.hudTop
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

  // ───────────────────────── Replay ─────────────────────────

  private renderReplay(dt: number, skip: boolean): void {
    const rp = this.replay
    if (!rp) return this.complete()
    const rate = replayRate(rp.t, rp.keyT, this.rm)
    const prevT = rp.t
    rp.t += dt * rate
    if (skip || rp.t >= rp.t1) {
      this.replay = null
      this.replayText.setAlpha(0)
      this.angleText.setAlpha(0)
      this.complete()
      return
    }
    // Find frames around t.
    const fr = rp.frames
    let i = 0
    while (i < fr.length - 2 && fr[i + 1].t < rp.t) i++
    const f0 = fr[i]
    const f1 = fr[Math.min(fr.length - 1, i + 1)]
    const a = f1.t > f0.t ? clampN((rp.t - f0.t) / (f1.t - f0.t), 0, 1) : 0
    const L = (u: number, v: number) => u + (v - u) * a
    // Facing: shortest-arc interpolation.
    const LA = (u: number, v: number) => {
      let d = v - u
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      return u + d * a
    }
    for (let k = 0; k < this.views.length; k++) {
      const o = k * 5
      if (o + 4 >= f0.agents.length) continue
      const x = L(f0.agents[o], f1.agents[o])
      const y = L(f0.agents[o + 1], f1.agents[o + 1])
      const z = L(f0.agents[o + 2], f1.agents[o + 2])
      const facing = LA(f0.agents[o + 3], f1.agents[o + 3])
      const st = STATE_CODES[f1.agents[o + 4]] ?? 'run'
      this.drawPlayer(this.views[k], x, y, z, facing, st, rp.t, dt * rate)
    }
    const bx = L(f0.bx, f1.bx)
    const by = L(f0.by, f1.by)
    const bz = L(f0.bz, f1.bz)
    const sp = Math.hypot(f1.bx - f0.bx, f1.by - f0.by) / Math.max(1e-3, f1.t - f0.t)
    this.drawBall(bx, by, bz, sp, dt * rate)
    this.aimG.clear()
    this.updateNets(dt * rate)
    this.updateCamera(dt, bx, by, bz, true, this.replayCamera(bx, by, bz))
    // Net ripple again on the replayed goal.
    if (rp.goal && prevT < rp.keyT && rp.t >= rp.keyT) this.startRipple(rp.endX > PITCH_LENGTH / 2 ? 'east' : 'west', by, bz, 0.5)
  }

  /** Normalised replay progress 0..1. */
  private replayU(): number {
    const rp = this.replay
    return rp ? clampN((rp.t - rp.t0) / Math.max(1e-3, rp.t1 - rp.t0), 0, 1) : 0
  }

  private currentAngle(): ReplayAngle {
    if (this.rm) return 'broadcast'
    return dominantAngle(replayAngleWeights(this.replayAngle, this.replayU()))
  }

  /**
   * Replay director: blends three cameras — broadcast follow, a tight
   * goal-cam on the goal mouth, and a wide high tactical view — with smooth
   * cross-fades (auto) or a fixed angle chosen in the Moments viewer.
   */
  private replayCamera(bx: number, by: number, bz: number): { x: number; y: number; zoom: number } {
    const rp = this.replay!
    const base = this.cam.base
    const bc = project(bx + (rp.endX > 0 ? 3 : -3), by, bz * 0.5)
    if (this.rm) return { x: bc.x, y: bc.y, zoom: base }
    const w = replayAngleWeights(this.replayAngle, this.replayU())
    const east = rp.endX > 0
    const gc = project(east ? PITCH_LENGTH - 4.5 : 4.5, GOAL_CENTER_Y * 0.65 + by * 0.35, 1.1)
    const tc = project((bx + (east ? PITCH_LENGTH - 14 : 14)) / 2, PITCH_WIDTH * 0.5 * 0.6 + by * 0.4, 0)
    const cams = { broadcast: { ...bc, zoom: base * 1.18 }, goalcam: { ...gc, zoom: base * 1.8 }, tactical: { ...tc, zoom: base * 0.64 } }
    let x = 0
    let y = 0
    let zoom = 0
    for (const k of ['broadcast', 'goalcam', 'tactical'] as const) {
      x += cams[k].x * w[k]
      y += cams[k].y * w[k]
      zoom += cams[k].zoom * w[k]
    }
    return { x, y, zoom }
  }

  // ───────────────────────── Celebration ─────────────────────────

  private startCelebration(): void {
    const { opts } = this.data0
    const rt = this.rt
    const unlocked = (opts.celebration?.unlocked ?? ['knee_slide', 'airplane', 'point_sky']) as CelebrationId[]
    const id = resolveCelebration(opts.celebration?.choice, unlocked, ((this.data0.highlight.minute * 7919 + this.data0.highlight.id.length * 31) % 1000) / 1000)
    const def = CELEBRATION_BY_ID[id]
    const heroV = this.views.find((v) => v.agent.isHero)
    if (!heroV) return this.afterCelebration()
    const h = rt.hero
    // Where the scorer heads: the corner by the fans, the nearest team-mate, or toward the camera.
    const nearMate = rt.agents
      .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
      .sort((p, q) => dist(p.pos, h.pos) - dist(q.pos, h.pos))[0]
    let target = { x: PITCH_LENGTH - 3, y: h.pos.y < GOAL_CENTER_Y ? 3 : PITCH_WIDTH - 3 }
    if (def.toward === 'teammates' && nearMate) target = { x: (h.pos.x + nearMate.pos.x) / 2, y: (h.pos.y + nearMate.pos.y) / 2 }
    else if (def.toward === 'camera') target = { x: Math.max(h.pos.x - 9, PITCH_LENGTH - 30), y: clampN(h.pos.y, 12, PITCH_WIDTH - 12) }
    if (id === 'corner_flag') target = { x: PITCH_LENGTH - 0.8, y: h.pos.y < GOAL_CENTER_Y ? 0.8 : PITCH_WIDTH - 0.8 }
    const mates = this.views
      .filter((v) => v.agent.team === 'hero' && !v.agent.isHero)
      .map((v) => ({ id: v.agent.id, v, relationToHero: this.relationOf(v.agent.id), isKeeper: v.agent.isKeeper, distToHero: dist(v.agent.pos, h.pos) }))
    const joiners = celebrationJoiners(mates, id === 'team_huddle' ? 8 : 5)
    const joinSet = new Set(joiners.map((j) => j.id))
    this.celeb = {
      id,
      t: 0,
      dur: celebrationSeconds(this.rm),
      target,
      hero: { x: h.pos.x, y: h.pos.y, facing: h.facing },
      joiners: joiners.map((j, i) => ({ v: j.v, x: j.v.agent.pos.x, y: j.v.agent.pos.y, ang: (i / Math.max(1, joiners.length)) * Math.PI * 2 + 0.4 })),
      others: this.views.filter((v) => !v.agent.isHero && !joinSet.has(v.agent.id)).map((v) => ({ v, x: v.agent.pos.x, y: v.agent.pos.y, facing: v.agent.facing })),
    }
    this.mode = 'celebrate'
    this.floatText(`${def.icon} ${def.name[this.data0.opts.lang] ?? def.name.en}`, target.x, target.y, '#ffd23f', Math.min(2.6, this.celeb.dur), 3.4)
    try {
      audio.crowdEvent('chant', this.data0.highlight.side, 0.9)
    } catch {
      /* audio optional */
    }
    if (!this.lowFx) {
      const gp = project(target.x, target.y, 1)
      this.time.delayedCall(400, () => this.confetti.explode(50, gp.x, gp.y))
    }
    // Crowd on its feet.
    for (const s of this.stands) {
      this.tweens.killTweensOf(s)
      s.y = (s.getData('y0') as number | undefined) ?? s.y
      if (!this.rm) this.tweens.add({ targets: s, y: s.y - 5, duration: 180, yoyo: true, repeat: 8, ease: 'Sine.InOut' })
    }
  }

  private relationOf(id: string): number {
    return this.data0.highlight.scenario.players.find((p) => p.id === id)?.relationToHero ?? 0
  }

  private renderCelebration(dt: number, skip: boolean): void {
    const c = this.celeb
    if (!c) return this.afterCelebration()
    c.t += dt
    if (skip || c.t >= c.dur) {
      this.celeb = null
      for (const v of this.views) v.arms?.clear()
      this.afterCelebration()
      return
    }
    const u = c.t / c.dur
    const pose = celebrationPose(c.id, u, this.rm)
    // Scorer: run toward the spot, then perform.
    const h = c.hero
    const dx = c.target.x - h.x
    const dy = c.target.y - h.y
    const d = Math.hypot(dx, dy)
    const speed = 7.5 * pose.run * (c.id === 'knee_slide' && u > 0.3 ? 1.4 : 1)
    if (d > 0.3 && speed > 0) {
      const step = Math.min(d, speed * dt)
      h.x += (dx / d) * step
      h.y += (dy / d) * step
      h.facing = Math.atan2(dy, dx)
    }
    const heroV = this.views.find((v) => v.agent.isHero)!
    this.drawPlayer(heroV, h.x, h.y, 0, h.facing, pose.legs ? 'run' : 'slide', c.t, speed > 0 ? dt : 0, pose)
    // Team-mates with good relations run in and surround him; huddles get tight.
    const ringR = c.id === 'team_huddle' ? 1.15 : 1.9
    const mPose = { rot: 0, lift: 0, torsoZ: null, legs: true, arms: u > 0.55 ? ('up' as const) : ('none' as const), run: 1 }
    const dd0 = (j: { x: number; y: number }) => Math.hypot(j.x - h.x, j.y - h.y)
    for (const j of c.joiners) {
      const tx = (dd0(j) > 6 ? c.target.x : h.x) + Math.cos(j.ang + c.t * 0.3) * ringR
      const ty = (dd0(j) > 6 ? c.target.y : h.y) + Math.sin(j.ang + c.t * 0.3) * ringR
      const ddx = tx - j.x
      const ddy = ty - j.y
      const dd = Math.hypot(ddx, ddy)
      const st = Math.min(dd, 9.5 * dt)
      if (dd > 0.05) {
        j.x += (ddx / dd) * st
        j.y += (ddy / dd) * st
      }
      const facing = Math.atan2(h.y - j.y, h.x - j.x)
      const arrived = dd < 1.2
      this.drawPlayer(j.v, j.x, j.y, 0, facing, arrived ? 'celebrate' : 'run', c.t, st > 0.001 ? dt : 0, arrived ? { ...mPose, lift: this.rm ? 0 : Math.abs(Math.sin(c.t * 9 + j.ang)) * 0.25 } : undefined)
    }
    // Everyone else: slow walk back (opponents) or stand (cold team-mates).
    for (const o of c.others) {
      if (o.v.agent.team === 'opp' && !o.v.agent.isKeeper) {
        o.x -= 1.2 * dt
        o.facing = Math.PI
      }
      this.drawPlayer(o.v, o.x, o.y, 0, o.facing, 'run', c.t, o.v.agent.team === 'opp' ? dt * 0.4 : 0)
    }
    this.aimG.clear()
    this.updateNets(dt)
    // Camera: close on the scorer (no zoom change under reduced motion).
    const hp = project(h.x, h.y, 1)
    this.updateCamera(dt, h.x, h.y, 0, true, { x: hp.x, y: hp.y, zoom: this.cam.base * (this.rm ? 1 : 1.35) })
  }

  // ───────────────────────── Overlays: offside line, name labels ─────────────────────────

  private drawOverlay(dt: number): void {
    const g = this.overlayG
    g.clear()
    const ofs = this.offsideFx
    if (ofs) {
      ofs.t += dt
      const life = 2.2
      if (ofs.t > life) this.offsideFx = null
      else {
        const al = clampN((life - ofs.t) / 0.5, 0, 1) * (this.rm ? 0.85 : 0.6 + 0.4 * Math.abs(Math.sin(ofs.t * 8)))
        const a = project(ofs.lineX, -1)
        const b = project(ofs.lineX, PITCH_WIDTH + 1)
        g.lineStyle(0.22 * PPM, 0x000000, al * 0.4)
        g.lineBetween(a.x, a.y, b.x, b.y)
        g.lineStyle(0.12 * PPM, 0xffd23f, al)
        g.lineBetween(a.x, a.y, b.x, b.y)
        // The flagged player's position (red), with the gap shaded.
        const c = project(ofs.playerX, -1)
        const d = project(ofs.playerX, PITCH_WIDTH + 1)
        g.fillStyle(0xff4040, al * 0.12)
        g.fillRect(Math.min(a.x, c.x), Math.min(c.y, a.y), Math.abs(b.x - a.x), Math.abs(a.y - c.y))
        g.lineStyle(0.08 * PPM, 0xff4040, al)
        g.lineBetween(c.x, c.y, d.x, d.y)
      }
    }
    this.drawLabels()
  }

  /** Name labels above every player: on demand (N) during play, always in replays and celebrations. */
  private drawLabels(): void {
    const show = this.labelsOn || this.mode === 'replay' || this.mode === 'celebrate'
    if (!show) {
      if (this.labels) for (const l of this.labels) l.setVisible(false)
      return
    }
    if (!this.labels) {
      this.labels = this.views.map((v) => {
        const t = this.text(10, v.agent.team === 'hero' ? '#ffffff' : '#ffd9d9', '800')
        const nm = v.agent.name || ''
        t.setText(!nm || nm === `#${v.agent.number}` ? `${v.agent.number}` : `${v.agent.number} ${nm}`)
        return t
      })
    }
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i]
      const l = this.labels[i]
      // Hero has the gold tag during play.
      if (v.agent.isHero && this.mode === 'play') {
        l.setVisible(false)
        continue
      }
      const wp = { x: v.c.x, y: v.c.y - zpx(HEAD_Z + 0.65) }
      const sp = this.worldToScreen(wp.x, wp.y)
      l.setVisible(true).setPosition(sp.x, sp.y).setAlpha(0.92)
    }
  }

  // ───────────────────────── Events & juice ─────────────────────────

  /** Camera shake (never under reduced motion). */
  private shake(ms: number, intensity: number): void {
    if (!this.rm) this.cameras.main.shake(ms, intensity)
  }

  /** Particle count for the effects tier. */
  private fxN(n: number): number {
    return this.lowFx ? Math.max(1, Math.round(n * 0.4)) : n
  }

  private vibrate(ms: number, s = 0.6): void {
    if (this.data0.opts.settings.vibration) this.input0.rumble(ms, s)
  }

  private startRipple(end: 'east' | 'west', y: number, z: number, strength: number): void {
    this.ripple[end] = { t: 0, y, z: clampN(z, 0.2, 2.2), strength }
  }

  private handleEvents(evs: RuntimeEvent[]): void {
    const rt = this.rt
    const observe = this.data0.opts.onEvent
    for (const e of evs) {
      if (observe) {
        try {
          observe(e)
        } catch {
          /* UI observer errors never break play */
        }
      }
      switch (e.type) {
        case 'kick': {
          this.sfx.kick(e.power, e.kick)
          const p = project(e.x, e.y)
          this.grassFx.explode(this.fxN(e.hero ? 10 : 5), p.x, p.y)
          const shot = e.kick === 'shot' || e.kick === 'chip' || e.kick === 'penalty' || e.kick === 'freekick' || e.kick === 'header'
          if (e.hero) {
            this.cam.punch = this.rm ? 0 : shot ? 0.14 : 0.05
            if (shot) this.shake(90, 0.003)
            this.vibrate(shot ? 35 : 18)
            this.lastKeyT = rt.time
          }
          // Remember the offside line when a delivery is played (drawn if the flag goes up).
          if (!shot) {
            const team = rt.agents.find((a) => a.id === e.by)?.team ?? 'hero'
            const dir = team === 'hero' ? 1 : -1
            const opp = rt.agents.filter((a) => a.team !== team).map((a) => a.pos.x)
            const d = secondLastOpponentDepth(opp, dir)
            const lineX = d === null ? null : dir === 1 ? d : PITCH_LENGTH - d
            // Never behind the ball (you cannot be offside behind the ball).
            this.passLineX = lineX === null ? null : dir === 1 ? Math.max(lineX, e.x) : Math.min(lineX, e.x)
          }
          break
        }
        case 'touch':
          this.sfx.tap(0.5)
          break
        case 'dribble':
          this.sfx.tap(0.18)
          break
        case 'bounce':
          this.sfx.tap(Math.min(1, e.speed / 9))
          break
        case 'post':
        case 'bar':
          this.sfx.clang(e.speed)
          this.sfx.roar(0.35)
          this.shake(220, 0.008)
          this.cam.punch = this.rm ? 0 : 0.1
          this.vibrate(120, 0.9)
          this.floatText(this.s.woodHit, e.x, e.y, '#ffffff', 0.9, 3)
          break
        case 'net':
          this.sfx.net(e.speed)
          this.startRipple(e.end, rt.ball.y, rt.ball.z, Math.min(0.9, 0.25 + e.speed * 0.025))
          break
        case 'goal': {
          const ours = e.team === 'hero'
          if (ours) {
            this.sfx.roar(1)
            const gp = project(e.end === 'east' ? PITCH_LENGTH : 0, GOAL_CENTER_Y, 1.5)
            this.confetti.explode(this.fxN(90), gp.x, gp.y)
            this.time.delayedCall(250, () => this.confetti.explode(this.fxN(70), gp.x, gp.y - 2 * PPM))
            if (!this.noFlash) this.flash.setAlpha(0.55)
            this.tweens.add({ targets: this.flash, alpha: 0, duration: 450, ease: 'Quad.Out' })
            if (!this.rm) for (const s of this.stands) this.tweens.add({ targets: s, y: s.y - 6, duration: 160, yoyo: true, repeat: 6, ease: 'Sine.InOut' })
          } else {
            this.sfx.groan()
          }
          this.shake(380, ours ? 0.012 : 0.006)
          this.cam.punch = this.rm ? 0 : 0.2
          this.vibrate(ours ? 320 : 160, 1)
          break
        }
        case 'save':
          this.sfx.glove()
          this.sfx.roar(0.3)
          this.shake(120, 0.004)
          if (rt.heroIsKeeper && e.by === rt.hero.id) {
            this.floatText(this.s.save, e.x, e.y, '#9fe8ff', 1.1, 3)
            this.vibrate(80)
          }
          break
        case 'block':
          this.sfx.tap(1)
          this.sfx.scuff()
          break
        case 'tackle': {
          if (e.slide || e.won) this.sfx.scuff()
          const p = project(e.x, e.y)
          if (e.slide) this.grassFx.explode(this.fxN(14), p.x, p.y)
          if (e.won && e.by === rt.hero.id) this.vibrate(60)
          break
        }
        case 'foul':
          if (e.card) this.floatText(e.card === 'red' ? this.s.red : this.s.yellow, rt.hero.pos.x, rt.hero.pos.y, e.card === 'red' ? '#ff4040' : '#ffd23f', 1.6, 3.2)
          break
        case 'whistle':
          this.sfx.whistle(e.long)
          break
        case 'skill':
          this.sfx.whoosh(false)
          this.floatText(e.success ? this.s.skillOk : this.s.skillBad, rt.hero.pos.x, rt.hero.pos.y, e.success ? '#5dff8a' : '#ff7a7a', 0.9, 2.8)
          if (e.success) this.vibrate(30)
          break
        case 'dive':
          this.sfx.scuff()
          break
        case 'header':
          this.sfx.tap(0.8)
          break
        case 'bullet':
          if (e.on) this.sfx.whoosh(true)
          this.sfx.crowdTension(e.on ? 0.85 : 0.35)
          break
        case 'callForBall':
          this.floatText(this.s.call, rt.hero.pos.x, rt.hero.pos.y, '#ffffff', 0.8, 2.8)
          break
        case 'oneTwo': {
          const a = this.agentById(e.by)
          if (a) this.floatText(this.s.oneTwo, a.pos.x, a.pos.y, '#9fe8ff', 0.9, 2.8)
          this.sfx.tap(0.6)
          break
        }
        case 'offside': {
          const ours = e.team === 'hero'
          if (ours) this.sfx.groan()
          else this.sfx.roar(0.4)
          this.floatText(`⚑ ${this.s.offside}`, e.x, e.y, '#ffd23f', 1.4, 3)
          // Offside line: where the second-last defender was when the ball was played, and where the runner was.
          const dir = e.team === 'hero' ? 1 : -1
          const fallback = secondLastOpponentDepth(rt.agents.filter((a) => a.team !== e.team).map((a) => a.pos.x), dir)
          const lineX = this.passLineX ?? (fallback === null ? null : dir === 1 ? fallback : PITCH_LENGTH - fallback)
          if (lineX !== null) this.offsideFx = { lineX, playerX: e.x, t: 0 }
          if (!this.noFlash) {
            this.flash.setFillStyle(0xffd23f, 1).setAlpha(0.28)
            this.tweens.add({ targets: this.flash, alpha: 0, duration: 380, ease: 'Quad.Out', onComplete: () => this.flash.setFillStyle(0xffffff, 1) })
          }
          this.vibrate(ours ? 90 : 50, 0.5)
          break
        }
        case 'end':
          this.showBanner(e.result)
          break
        case 'jump':
        case 'out':
          break
      }
    }
  }

  private showBanner(r: HighlightResult): void {
    const s = this.s
    const txt = r.offside ? s.offside : (s[r.outcome as keyof Strings] ?? r.outcome)
    const good = GOOD.has(r.outcome)
    this.bannerText.setText(txt).setColor(good ? '#ffd23f' : '#ffffff').setAlpha(1).setScale(0.3)
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 420, ease: 'Back.Out' })
    let sub = ''
    if (r.card) sub = r.card === 'red' ? s.red : s.yellow
    else if (r.offside) sub = `${s.offsideFlag} ${this.rt.agents.find((a) => a.id === r.offside?.playerId)?.name ?? ''}`.trim()
    else if (r.outcome === 'assist' && r.scorerId) sub = `→ ${this.rt.agents.find((a) => a.id === r.scorerId)?.name ?? ''}`
    this.bannerSub.setText(sub).setAlpha(sub ? 1 : 0)
    if (!good && r.outcome !== 'woodwork') this.shake(100, 0.002)
  }

  private floatText(text: string, x: number, y: number, color: string, life: number, zOff: number): void {
    // Avoid stacking the same message.
    if (this.floaters.some((f) => f.text.text === text && f.t < 0.2)) return
    const t = this.text(16, color, '900')
    t.setText(text)
    this.floaters.push({ text: t, wx: x, wy: y - 0.01 * zOff, t: 0, life })
    const p = project(x, y, zOff)
    this.floaters[this.floaters.length - 1].wx = p.x
    this.floaters[this.floaters.length - 1].wy = p.y
  }

  // ───────────────────────── HUD ─────────────────────────

  private updateHud(dt: number, intent: FrameIntent): void {
    const rt = this.rt
    const g = this.hudG
    const w = this.scale.width
    const h = this.scale.height
    const u = this.ui
    g.clear()

    // HUD band (the play camera starts below it).
    const top = this.safeTop
    g.fillStyle(0x070b10, 0.92)
    g.fillRect(0, 0, w, this.hudTop)
    g.fillStyle(0xffffff, 0.08)
    g.fillRect(0, this.hudTop - 1 * u, w, 1 * u)

    // Score bug.
    const sbW = this.scoreText.width + 22 * u
    g.fillStyle(0x0b0f16, 0.82)
    g.fillRoundedRect(14 * u, top + 7 * u, sbW, 26 * u, 6 * u)
    g.fillStyle(colorNum(this.kits.hero.primary), 1)
    g.fillRect(14 * u, top + 7 * u, 5 * u, 26 * u)

    // Moment timer bar.
    const frac = clampN(rt.timeLeft / rt.timeLimit, 0, 1)
    const bw = this.bar.w
    const bx = this.bar.x
    const by = this.bar.y
    g.fillStyle(0x000000, 0.45)
    g.fillRoundedRect(bx - 2 * u, by - 2 * u, bw + 4 * u, 10 * u, 5 * u)
    const col = frac > 0.5 ? 0x5dff8a : frac > 0.25 ? 0xffb02e : 0xff4040
    const pulse = frac < 0.25 ? 0.6 + Math.sin(this.elapsed * 14) * 0.4 : 1
    g.fillStyle(col, pulse)
    if (this.mode === 'play') g.fillRoundedRect(bx, by, Math.max(0, bw * frac), 6 * u, 3 * u)

    // Bullet-time focus bar + vignette.
    const focus = this.mode === 'play' ? rt.bulletFrac : 0
    const slow = this.mode === 'play' ? 1 - rt.timeScale : 0
    this.vignette.setAlpha(this.rm ? 0 : clampN(slow * 0.75, 0, 0.6) + (this.mode === 'replay' ? 0.35 : 0))
    if (focus > 0) {
      g.fillStyle(0x9fe8ff, 0.9)
      g.fillRoundedRect(bx + bw / 2 - (bw * 0.5 * focus) / 2, by + 9 * u, bw * 0.5 * focus, 3 * u, 1.5 * u)
    }

    // Prompt: visible for the first seconds.
    this.promptT += dt
    const pa = this.mode === 'play' ? clampN(4.2 - this.promptT, 0, 1) : 0
    this.promptText.setAlpha(pa)
    // The focus label takes the prompt's place once the prompt has faded.
    this.focusText.setAlpha(focus > 0 ? 0.9 * (1 - pa) : 0)

    // Hero tag (screen space, follows the hero).
    const hero = rt.hero
    if (this.mode === 'play') {
      const hp = project(hero.pos.x, hero.pos.y, HEAD_Z + 0.75 + hero.z)
      const sp = this.worldToScreen(hp.x, hp.y)
      this.tagText.setPosition(sp.x, sp.y).setAlpha(1)
      const tw = this.tagText.width + 10 * u
      const th = this.tagText.height + 2 * u
      g.fillStyle(0xffd23f, 0.95)
      g.fillRoundedRect(sp.x - tw / 2, sp.y - th / 2, tw, th, 4 * u)
      g.fillTriangle(sp.x - 4 * u, sp.y + th / 2, sp.x + 4 * u, sp.y + th / 2, sp.x, sp.y + th / 2 + 5 * u)
    } else {
      this.tagText.setAlpha(0)
    }

    // Floating texts.
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.t += dt
      const sp = this.worldToScreen(f.wx, f.wy)
      f.text.setPosition(sp.x, sp.y - f.t * 30 * u).setAlpha(clampN((f.life - f.t) / 0.3, 0, 1)).setScale(1 + Math.max(0, 0.25 - f.t) * 1.5)
      if (f.t >= f.life) {
        f.text.destroy()
        this.floaters.splice(i, 1)
      }
    }

    // Touch controls.
    const tu = this.input0.touchUi()
    const showTouch = tu.enabled && this.mode === 'play'
    this.sprintText.setAlpha(showTouch ? 0.9 : 0).setPosition(tu.sprint.x, tu.sprint.y)
    this.skillText.setAlpha(showTouch ? 0.9 : 0).setPosition(tu.skill.x, tu.skill.y)
    if (showTouch) {
      g.fillStyle(0x000000, tu.sprint.down ? 0.55 : 0.3)
      g.fillCircle(tu.sprint.x, tu.sprint.y, tu.sprint.r)
      g.lineStyle(2 * u, 0xffffff, tu.sprint.down ? 0.9 : 0.45)
      g.strokeCircle(tu.sprint.x, tu.sprint.y, tu.sprint.r)
      // Stamina arc on the sprint button.
      g.lineStyle(3 * u, 0x5dff8a, 0.85)
      g.beginPath()
      g.arc(tu.sprint.x, tu.sprint.y, tu.sprint.r + 4 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hero.stamina)
      g.strokePath()
      g.fillStyle(0x000000, tu.skill.down ? 0.55 : 0.3)
      g.fillCircle(tu.skill.x, tu.skill.y, tu.skill.r)
      g.lineStyle(2 * u, 0xffd23f, tu.skill.down ? 0.95 : 0.5)
      g.strokeCircle(tu.skill.x, tu.skill.y, tu.skill.r)
      if (tu.joystick) {
        const j = tu.joystick
        g.fillStyle(0xffffff, 0.08)
        g.fillCircle(j.baseX, j.baseY, j.r)
        g.lineStyle(2 * u, 0xffffff, 0.35)
        g.strokeCircle(j.baseX, j.baseY, j.r)
        const dx = j.knobX - j.baseX
        const dy = j.knobY - j.baseY
        const l = Math.hypot(dx, dy)
        const k = l > j.r ? j.r / l : 1
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(j.baseX + dx * k, j.baseY + dy * k, j.r * 0.42)
      } else if (this.elapsed < 5) {
        g.fillStyle(0xffffff, 0.05 * (1 + Math.sin(this.elapsed * 3)))
        g.fillCircle(w * 0.16, h * 0.74, Math.min(w, h) * 0.1)
      }
    }

    // Replay letterbox.
    if (this.mode === 'replay') {
      const lb = h * 0.08
      g.fillStyle(0x000000, 1)
      g.fillRect(0, 0, w, lb)
      g.fillRect(0, h - lb, w, lb)
      this.replayText.setAlpha(this.rm ? 1 : 0.6 + Math.sin(this.elapsed * 6) * 0.4).setPosition(w - 80 * u, lb / 2)
      const ang = this.currentAngle()
      this.angleText.setText(`◉ ${this.s[`angle_${ang}` as keyof Strings]}`).setAlpha(0.85).setPosition(90 * u, h - lb / 2)
      this.promptText.setText(this.s.skip).setAlpha(0.6).setY(h - lb / 2)
    } else if (this.mode === 'celebrate') {
      this.angleText.setAlpha(0)
      this.promptText.setText(this.s.skip).setAlpha(0.6).setY(h - 24 * u)
    } else {
      this.angleText.setAlpha(0)
    }

    // Wind arrow (screen direction) beside the km/h read-out.
    const wind = this.windText ? windReadout(rt.env.wind) : null
    if (wind && this.windText) {
      const d = pitchDirToScreen(wind.dir.x, wind.dir.y)
      const cx = this.windText.x - this.windText.width - 14 * u
      const cy = this.windText.y
      const len = (6 + wind.strength * 2) * u
      g.lineStyle(2.2 * u, 0xdfe9ff, 0.95)
      g.lineBetween(cx - d.x * len, cy - d.y * len, cx + d.x * len, cy + d.y * len)
      const hx = cx + d.x * len
      const hy = cy + d.y * len
      g.fillStyle(0xdfe9ff, 0.95)
      g.fillTriangle(hx + d.x * 4 * u, hy + d.y * 4 * u, hx - d.y * 4 * u, hy + d.x * 4 * u, hx + d.y * 4 * u, hy - d.x * 4 * u)
    }
    void intent
  }
}

/** Top safe-area inset (CSS px) that overlaps the canvas, e.g. a phone notch in full-screen. */
function safeAreaTop(canvas: HTMLCanvasElement): number {
  if (typeof document === 'undefined' || !document.body) return 0
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)'
  document.body.appendChild(el)
  const inset = parseFloat(getComputedStyle(el).paddingTop) || 0
  el.remove()
  return Math.max(0, inset - Math.max(0, canvas.getBoundingClientRect().top))
}

// ───────────────────────── Factory & API ─────────────────────────

/**
 * Creates a Phaser.Game sized to `parent`, crisp on high-DPI screens.
 *
 * On DPR > 1 the canvas backing store is rendered at device pixels (Scale.NONE
 * with zoom = 1/DPR, resized by a ResizeObserver) because Phaser's RESIZE mode
 * maps 1 CSS px to 1 canvas px (blurry on retina). On DPR = 1 it uses
 * Phaser.Scale.RESIZE directly. Handles orientation changes via the observer.
 * Destroy with `game.destroy(true)`; observers are disconnected automatically.
 */
export function createMatchGame(parent: HTMLElement): Phaser.Game {
  // Capped at 2: a 3x backing store costs ~2.25x the fill rate for no visible gain on phones.
  const dpr = Math.min(2, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
  const rect = parent.getBoundingClientRect()
  const cssW = Math.max(1, Math.floor(rect.width || parent.clientWidth || 800))
  const cssH = Math.max(1, Math.floor(rect.height || parent.clientHeight || 450))
  const hiDpi = dpr > 1.01
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b1410',
    banner: false,
    disableContextMenu: true,
    // All audio goes through the shared engine (src/audio); no second AudioContext.
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    scale: hiDpi
      ? { mode: Phaser.Scale.NONE, width: Math.round(cssW * dpr), height: Math.round(cssH * dpr), zoom: 1 / dpr }
      : { mode: Phaser.Scale.RESIZE, width: cssW, height: cssH },
  })
  game.registry.set('dpr', hiDpi ? dpr : 1)
  if (hiDpi && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      const r = parent.getBoundingClientRect()
      const w = Math.max(1, Math.floor(r.width))
      const h = Math.max(1, Math.floor(r.height))
      const tw = Math.round(w * dpr)
      const th = Math.round(h * dpr)
      if (tw !== game.scale.width || th !== game.scale.height) game.scale.resize(tw, th)
    })
    ro.observe(parent)
    game.events.once(Phaser.Core.Events.DESTROY, () => ro.disconnect())
  }
  return game
}

/**
 * Plays one interactive highlight.
 *
 * @param target an existing Phaser.Game (e.g. from {@link createMatchGame}) or
 *   a container element (a game is created and destroyed automatically)
 * @param highlight the moment produced by the match sim
 * @param opts kit colours, settings, language, difficulty, weather
 * @param onDone receives the {@link HighlightResult} once the moment (and any goal replay) has finished
 */
export function startHighlight(
  target: Phaser.Game | HTMLElement,
  highlight: Highlight,
  opts: StartHighlightOptions,
  onDone: (r: HighlightResult) => void,
  replayOnly?: MomentRecording,
): HighlightHandle {
  const owned = !(target instanceof Phaser.Game)
  const game = target instanceof Phaser.Game ? target : createMatchGame(target)
  let stopped = false
  const finish = (r: HighlightResult) => {
    if (stopped) return
    stopped = true
    if (owned) game.destroy(true)
    else game.scene.remove(SCENE_KEY)
    onDone(r)
  }
  const launch = () => {
    if (stopped) return
    if (game.scene.getScene(SCENE_KEY)) game.scene.remove(SCENE_KEY)
    game.scene.add(SCENE_KEY, MatchScene, true, { highlight, opts, onDone: finish, replayOnly } satisfies SceneData)
  }
  if (game.isBooted) launch()
  else game.events.once(Phaser.Core.Events.READY, launch)
  return {
    game,
    stop() {
      if (stopped) return
      stopped = true
      if (owned) game.destroy(true)
      else if (game.scene.getScene(SCENE_KEY)) game.scene.remove(SCENE_KEY)
    },
  }
}

/**
 * Rewatches a recorded moment (see `moments.ts`) in the replay player: the
 * same players and stadium, slow motion, with the chosen camera angle.
 * Tap / Enter skips. `onDone` fires when the replay ends or is skipped.
 */
export function replayMoment(
  target: Phaser.Game | HTMLElement,
  moment: MomentRecording,
  o: { settings: HighlightSettings; angle?: ReplayAngleChoice; lang?: Lang },
  onDone: () => void,
): HighlightHandle {
  const v = moment.view
  return startHighlight(
    target,
    moment.highlight,
    {
      heroTeamColors: v.heroTeamColors,
      oppColors: v.oppColors,
      settings: o.settings,
      lang: o.lang ?? v.lang,
      difficulty: 'normal',
      weather: v.weather,
      heroName: v.heroName,
      names: v.names,
      teamNames: v.teamNames,
      stadium: v.stadium,
      gender: v.gender,
      replay: true,
      replayAngle: o.angle ?? 'auto',
    },
    () => onDone(),
    moment,
  )
}
