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
import { DEFENSIVE_KINDS, GOAL_HEIGHT, GOAL_WIDTH, PITCH_LENGTH, PITCH_WIDTH } from '../sim/match/types'
import {
  adBoardTexture,
  ballRimTexture,
  ballTexture,
  colorNum,
  crowdTexture,
  drawGoal,
  drawPitch,
  drawWeatherGround,
  grassGrainTexture,
  luminance,
  keeperKit,
  utilTextures,
  NET_BACK_TOP,
  type NetRipple,
  fillGradient,
} from './art'
import { Sfx } from './audio'
import { autopilotStep, createAutopilot, type AutopilotState } from './autopilot'
import { InputController, type FrameIntent, type ContextButtonUi } from './input'
import { ACTION_DEFS, assignKeys, contextActions } from './actionSet'
import { drawActionIcon } from './actionIcons'
import { getBindings, keyLabel } from '../input/bindings'
import { effectiveAimAssist, getControlPrefs, TIMING_ASSIST_MULT } from '../input/prefs'
import { KIT_MIN_DISTANCE, cvdDistance, distinctOpponentKit } from '../core/colorVision'
import { pickBallStyle, type BallStyle } from '../core/kitContrast'
import { PITCH_COLORS } from '../core/pitchColors'
import { audio } from '../audio'
import { secondLastOpponentDepth } from './offside'
import { compactFrames, recordMoment, type MomentRecording } from './moments'
import { CONTACT_KINDS, GOAL_KINDS } from '../sim/match/tier'
import {
  CELEBRATION_BY_ID, celebrationJoiners, celebrationPose, celebrationSeconds, dominantAngle, replayAngleWeights, replayRate, resolveCelebration,
  stadiumLook, upper, windReadout, type CelebrationChoice, type CelebrationId, type CelebrationPose, type ReplayAngle, type ReplayAngleChoice, type StadiumLook,
  pitchGrip,
} from './presentation'
import type { AimAssist } from './kick'
import { shotSpeed } from './kick'
import { clampN, dist, type Agent, type Vec2 } from './model'
import { momentMatchup, type Matchup } from './matchup'
import { t as tr } from '../i18n'
import { GOAL_CENTER_Y, predictTrajectory } from './physics'
import { HighlightRuntime, STATE_CODES, type ReplayFrame, type RuntimeEvent } from './runtime'
import { applyInput, InputRecorder, type InputRecording } from './inputReplay'
import type { AimState } from './runtime'
import { queueGoalReplay } from '../sim/game/saveHistory'
import { recordError, setReportAttachment } from '../telemetry/errorLog'
import { PickerDom, PickerState, keyToPickerInput, padToPickerInputs } from './setPiecePicker'
import { wallGeometry } from './setup'
import type { HeroAction } from './runtime'
import { ASSIST_REWARD } from '../sim/match/rating'
import { ParticleBudget, QUALITY, profileOfSettings, renderScale, type QualityProfile, type QualitySpec } from './quality'
import { IDLE_FRAMES, WALK_FRAMES, kickStyleFor, type KickStyle } from './figureAnim'
import { FIG_RES, FIG_SCALE, FigureRig, figureHeadTexture, figureKitSheet, figureNumberTexture, figureSelfCheck, figureSkinSheet, figureTextureIssues, groundDir, skinTone, type FigPose } from './figures'
import { BAND_COLOR, BAND_PATTERN, LANDING_KINDS, firstLanding, landingErrorRadius, powerBand, previewFraction, previewVisible, speedLabel, techniqueOf } from './aimView'
import { clothSettled, createCloth, hitCloth, stepCloth, type NetCloth } from './netCloth'
import { bulletDesaturation, bulletVignette, composureRingRadius } from './bulletTime'
import { pauseGate, wireAppPause } from './pauseGate'
import { MOMENT_FRAME_TIME, clampCamera, easeOut, lookAheadOffset, momentFrame, nearestPoints, newSpring, springStep, type Spring2 } from './camera'
import { ObjectPool } from './pool'
import { probeKick } from './touchProbe'
import { canvasSafeInsets } from '../platform/viewport'
import { isSoftwareMode, isWebglBroken, markWebglBroken, type RendererChoice } from './renderGuard'
import { guardPhaser, type GuardHandle } from './phaserGuard'
import { PPM, TILT, ZS, resolveCameraDistance, type CameraDistanceChoice, crossCamFit, depthFor, fitZoom, pitchDirToScreen, project, screenDirToPitch, unproject } from './view'
import { crumb } from '../telemetry/breadcrumbs'

// ───────────────────────── Public types ─────────────────────────

export interface HighlightSettings {
  aimAssist: AimAssist
  slowMoAim: boolean
  vibration: boolean
  /** 0..1 */
  sound: number
  /** Accessibility: no shake / zoom punches / flashes / vignette; shorter celebrations. */
  reducedMotion?: boolean
  /** Legacy low effects flag (= quality 'low' when `quality` is not given). */
  lowFx?: boolean
  /** Graphics quality profile (WP-16): particle budget, crowd density, glow. */
  quality?: QualityProfile
  /** Camera distance (Far / Normal / Close / Auto). */
  cameraDistance?: CameraDistanceChoice
  /**
   * The player explicitly chose Low graphics: render with Canvas (the safest path on GPUs whose
   * WebGL driver misbehaves). An Auto profile that measured Low keeps WebGL.
   */
  canvasRenderer?: boolean
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
  /**
   * Goal reel: drives the hero from a stored input recording (its runtime options and seed win over
   * the live settings) so the moment replays exactly. Nothing is recorded or queued again.
   */
  inputReplay?: InputRecording
  /**
   * Neither WebGL nor Canvas could show the moment and the player pressed Exit on the failure
   * panel: resolve the moment without the interactive scene (the live match auto-resolves it).
   */
  onRenderFail?: () => void
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
/** HUD band height (hud units; 2.2#92: 36 × 1.25 = 45 px ≤ 6 % of 800). */
const HUD_ROW = 36
/** Longest the moment-start frame holds before following play (s, 2.2#4). */
const OPEN_CAM_HOLD = 1.4
/** Below this speed (m/s) players walk rather than run (2.2#24). */
const WALK_MAX_SPEED = 2.4

/** Pitch-space box (meters) a static Graphics fits in; `z` = tallest point drawn. */
interface BakeBox {
  x0: number
  x1: number
  y0: number
  y1: number
  z?: number
}
let bakeSeq = 0
/** Extra layers baked into the same texture: a tiled grain, then a Graphics drawn on top (pitch lines). */
interface BakeExtra {
  grain?: { key: string; alpha: number; tileM: number }
  post?: Phaser.GameObjects.Graphics
}

// ───────────────────────── Strings ─────────────────────────

const T = {
  en: {
    goal: 'GOAL!', assist: 'ASSIST!', saved: 'SAVED', missed: 'MISSED', blocked: 'BLOCKED', woodwork: 'OFF THE WOODWORK!',
    pass_complete: 'GOOD PLAY', lost_ball: 'LOST IT', defended: 'DEFENDED!', conceded: 'CONCEDED', shot_conceded: 'CHANCE CONCEDED', foul_won: 'FOUL WON', cleared: 'CLEARED',
    foul_committed: 'FOUL', timeout: "TIME'S UP", replay: 'REPLAY', skip: 'tap to skip', paused: 'PAUSED', focus: 'FOCUS', sprint: 'SPRINT',
    skill: 'SKILL', you: 'YOU', yellow: 'YELLOW CARD', red: 'RED CARD', skillOk: 'SKILL!', skillBad: 'TACKLED', call: 'PASS!',
    holdHint: 'IN HANDS - swipe to throw or kick', header: 'NOW!', shootHint: 'Swipe / hold & release to shoot', woodHit: 'POST!', save: 'SAVE!',
    offside: 'OFFSIDE', offsideFlag: 'FLAG UP!', oneTwo: 'ONE-TWO!',
    advantage: 'ADVANTAGE!', advantagePlayed: 'PLAY ON', advantageBack: 'BACK FOR THE FOUL',
    punch: 'PUNCHED!', keeperRead: 'HE KNOWS YOUR SPOT', keeperReadMid: 'HE EXPECTS THE MIDDLE',
    refuseRelation: "WON'T PASS", refuseLane: 'NO LANE',
    aim_full: 'FULL AIM', aim_half: 'HALF AIM', aim_manual: 'MANUAL AIM',
    angle_broadcast: 'BROADCAST', angle_goalcam: 'GOAL CAM', angle_tactical: 'TACTICAL CAM',
    grip_slick: 'SLICK', grip_heavy: 'HEAVY',
    tierSaved: 'ON TARGET!', tierChance: 'CHANCE!', tierPartial: 'PARTIAL SUCCESS', tierMissed: 'MISSED IT',
    tierSavedSub: 'Keeper saved · partial success', tierChanceSub: 'Clear chance created · partial success', noSwitch: 'NOT SWITCHED', noSwitchSub: 'Your pass did not reach the far wing · no credit', chanceLost: 'CHANCE MADE', chanceLostSub: 'You made the chance, then the ball was lost · partial success', beatMan: 'MAN BEATEN', beatManSub: 'You got past him, then lost it · partial success', tierWoodSub: 'Off the woodwork · partial success',
    tierDuty: 'JOB DONE', tierDutySub: 'Kept out while you did your job · partial success', keeperDutySub: 'Team-mates won it before a shot · you held your spot · partial',
    tierPass: 'GOOD PASS!', tierPassSub: 'Your pass found its man · partial success',
    headReady: 'READY TO HEAD', wallHit: 'INTO THE WALL', wallHitSub: 'Curl it round the wall or over it', notBeaten: 'MAN NOT BEATEN', notBeatenSub: 'The job was to take him on · no credit', teamDefended: 'TEAM SAVED IT', teamDefendedSub: 'You did not touch the ball · no credit',
    tierForced: 'SHOT FORCED', tierForcedSub: 'The shot got away but you were on him · partial success',
    tierContact: 'FIRST BALL!', tierContactSub: 'Won the first contact · partial success', tierSwitchSub: 'The switch found its man · partial success',
  },
  tr: {
    goal: 'GOL!', assist: 'ASİST!', saved: 'KURTARDI', missed: 'AUT', blocked: 'BLOKE', woodwork: 'DİREKTEN DÖNDÜ!',
    pass_complete: 'İYİ OYUN', lost_ball: 'TOP KAYBI', defended: 'SAVUNDUN!', conceded: 'GOL YEDİK', shot_conceded: 'RAKİP ŞUT BULDU', foul_won: 'FAUL ALDIN', cleared: 'UZAKLAŞTIRILDI',
    foul_committed: 'FAUL', timeout: 'SÜRE BİTTİ', replay: 'TEKRAR', skip: 'geçmek için dokun', paused: 'DURAKLATILDI', focus: 'ODAK', sprint: 'DEPAR',
    skill: 'ÇALIM', you: 'SEN', yellow: 'SARI KART', red: 'KIRMIZI KART', skillOk: 'ÇALIM!', skillBad: 'KAPTIRDIN', call: 'PAS!',
    holdHint: 'ELİNDE - atmak ya da vurmak için kaydır', header: 'ŞİMDİ!', shootHint: 'Şut için kaydır / basılı tutup bırak', woodHit: 'DİREK!', save: 'KURTARIŞ!',
    offside: 'OFSAYT', offsideFlag: 'BAYRAK HAVADA!', oneTwo: 'VER-KAÇ!',
    advantage: 'AVANTAJ!', advantagePlayed: 'DEVAM', advantageBack: 'FAUL ÇALINDI',
    punch: 'YUMRUKLADI!', keeperRead: 'KÖŞENİ BİLİYOR', keeperReadMid: 'ORTAYI BEKLİYOR',
    refuseRelation: 'PAS VERMİYOR', refuseLane: 'PAS YOLU KAPALI',
    aim_full: 'TAM NİŞAN', aim_half: 'YARI NİŞAN', aim_manual: 'MANUEL NİŞAN',
    angle_broadcast: 'YAYIN KAMERASI', angle_goalcam: 'KALE ARKASI', angle_tactical: 'TAKTİK KAMERA',
    grip_slick: 'KAYGAN', grip_heavy: 'AĞIR',
    tierSaved: 'İSABETLİ!', tierChance: 'FIRSAT!', tierPartial: 'KISMİ BAŞARI', tierMissed: 'KAÇTI',
    tierSavedSub: 'Kaleci kurtardı · kısmi başarı', tierChanceSub: 'Net fırsat yarattın · kısmi başarı', noSwitch: 'KANAT DEĞİŞMEDİ', noSwitchSub: 'Pasın öbür kanada gitmedi · başarı sayılmadı', chanceLost: 'FIRSAT YARATTIN', chanceLostSub: 'Fırsatı yarattın, sonra top gitti · kısmi başarı', beatMan: 'ADAMINI GEÇTİN', beatManSub: 'Rakibini geçtin, sonra top gitti · kısmi başarı', tierWoodSub: 'Direkten döndü · kısmi başarı',
    tierDuty: 'GÖREV TAMAM', tierDutySub: 'Görevini yaptın, tehlike önlendi · kısmi başarı', keeperDutySub: 'Şut gelmeden arkadaşların kaptı · yerini korudun · kısmi',
    tierPass: 'İYİ PAS!', tierPassSub: 'Pasın adamını buldu · kısmi başarı',
    headReady: 'KAFAYA HAZIR', wallHit: 'BARAJA TAKILDI', wallHitSub: 'Kavis ver: barajın yanından ya da üstünden', notBeaten: 'ADAMINI GEÇEMEDİN', notBeatenSub: 'Görev çalımla geçmekti · başarı sayılmadı', teamDefended: 'TAKIM KURTARDI', teamDefendedSub: 'Topa sen dokunmadın · başarı sayılmadı',
    tierForced: 'ŞUTU ZORLADIN', tierForcedSub: 'Şut çıktı ama adamının üstündeydin · kısmi başarı',
    tierContact: 'İLK TOP!', tierContactSub: 'İlk teması kazandın · kısmi başarı', tierSwitchSub: 'Kanat değişti, adamını buldu · kısmi başarı',
  },
} as const
type Strings = { [K in keyof (typeof T)['en']]: string }

/** HUD type stacks, matching the UI tokens (--font-display / --font-score in styles/tokens.css). */
const HUD_FONTS = {
  display: "'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif",
  score: "'Teko', 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif",
} as const

const GOOD: ReadonlySet<HighlightOutcome> = new Set<HighlightOutcome>(['goal', 'assist', 'defended', 'pass_complete', 'foul_won'])

// ───────────────────────── Player view ─────────────────────────

interface PlayerView {
  agent: Agent
  c: Phaser.GameObjects.Container
  /** Contact blob + cast shadows (sun / floodlights), on the ground below every figure. */
  shadow: Phaser.GameObjects.Image
  casts: Phaser.GameObjects.Image[]
  /** Facing chevron on the grass. */
  chev: Phaser.GameObjects.Image
  rig: FigureRig
  ring: Phaser.GameObjects.Image | null
  /** Celebration-only custom arms (drawn over a bare-armed frame). */
  arms: Phaser.GameObjects.Graphics | null
  /** Outline disc colour for kit clashes is baked into the kit sheet. */
  phase: number
  lastX: number
  lastY: number
  /** Seconds since this player's last kick / header / held save (animation clocks). */
  kickT: number
  /** Strike style of the last kick (2.2#26). */
  kickStyle: KickStyle
  headT: number
  catchT: number
}

interface Floater {
  text: Phaser.GameObjects.Text
  wx: number
  wy: number
  t: number
  life: number
}

const BALL_D = 0.22 * PPM * 2.1
/** Figure heights (m, with the stylised figure scale): shoulders and head centre. */
const SHOULDER_Z = 1.49 * FIG_SCALE
const HEAD_Z = 1.76 * FIG_SCALE
const zpx = (z: number) => z * PPM * ZS

/**
 * The interactive highlight scene. Create through {@link startHighlight}.
 */
/** Within this distance (m) of goal the live camera leans toward the goal so the goal mouth stays on a phone screen. */
const GOAL_FRAME_RANGE = 36
/** On the ball this close to goal the view frames the goal mouth, zooming in up to {@link SHOT_FRAME_MAX_ZOOM}. */
const SHOT_FRAME_RANGE = 34
const SHOT_FRAME_MAX_ZOOM = 1.35
/** Share of a portrait phone screen kept clear of the action at the bottom (thumbs, context buttons). */
const THUMB_RESERVE = 0.17
/** The on-the-ball frame may pull back this far (a switch to the far wing has to fit on a portrait phone). */
const ON_BALL_MIN_ZOOM = 0.48

export class MatchScene extends Phaser.Scene {
  private data0!: SceneData
  private rt!: HighlightRuntime
  private input0!: InputController
  private sfx!: Sfx
  private s!: Strings
  private ui = 1
  /** HUD scale: the device-pixel ratio, a little larger on wide desktop windows. */
  private hudU = 1

  private worldLayer!: Phaser.GameObjects.Layer
  private hudLayer!: Phaser.GameObjects.Layer
  private uiCam!: Phaser.Cameras.Scene2D.Camera

  private views: PlayerView[] = []
  private ballImg!: Phaser.GameObjects.Image
  private ballShadow!: Phaser.GameObjects.Image
  private ballShade!: Phaser.GameObjects.Image
  /** Kit-contrast outline ring (only when the ball had to change colour) and its halo. */
  private ballRim: Phaser.GameObjects.Image | null = null
  private ballHalo: Phaser.GameObjects.Image | null = null
  /** Ball colours picked against both kits and the turf (core/kitContrast). */
  ballStyle!: BallStyle
  private ballGhosts: Phaser.GameObjects.Image[] = []
  /** The last kick came from the hero's team-mate set (gold trail on hero strikes). */
  private lastKickHero = false
  private trailG!: Phaser.GameObjects.Graphics
  private aimG!: Phaser.GameObjects.Graphics
  private dropG!: Phaser.GameObjects.Graphics
  private netG: Record<'east' | 'west', Phaser.GameObjects.Graphics> = {} as Record<'east' | 'west', Phaser.GameObjects.Graphics>
  private ripple: Record<'east' | 'west', NetRipple | null> = { east: null, west: null }
  private grassFx!: Phaser.GameObjects.Particles.ParticleEmitter
  /** Soft turf / spray puff for slides, dives and wet bounces. */
  private puffFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter

  private hudG!: Phaser.GameObjects.Graphics
  /** Score bug parts (minute, home abbreviation, score, away abbreviation) and their laid-out x positions. */
  private sb!: {
    min: Phaser.GameObjects.Text
    home: Phaser.GameObjects.Text
    score: Phaser.GameObjects.Text
    away: Phaser.GameObjects.Text
    x: { min: number; minW: number; home: number; score: number; scoreW: number; away: number; end: number }
  }
  private sbColors: [number, number] = [0xffffff, 0xffffff]
  private hudTexts: Phaser.GameObjects.Text[] = []
  private promptText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private bannerSub!: Phaser.GameObjects.Text
  private focusText!: Phaser.GameObjects.Text
  private tagText!: Phaser.GameObjects.Text
  private sprintText!: Phaser.GameObjects.Text
  private skillText!: Phaser.GameObjects.Text
  /** Context buttons (game/actionSet): label and key-cap texts, one per slot. */
  private readonly ctxLabels: Phaser.GameObjects.Text[] = []
  private readonly ctxKeyTexts: Phaser.GameObjects.Text[] = []
  private ctxLayoutKey = ''
  private replayText!: Phaser.GameObjects.Text
  private vignette!: Phaser.GameObjects.Image
  private flash!: Phaser.GameObjects.Rectangle
  private floaters: Floater[] = []
  private floatPool: ObjectPool<Phaser.GameObjects.Text> | null = null

  private cam = { x: 0, y: 0, zoom: 1, base: 1, punch: 0 }
  /** Cross camera: a still frame (world px) fitted at delivery, its zoom multiplier, and when it ends (sim time). */
  private crossCam: { fx: number; fy: number; zoomMult: number; until: number } | null = null
  /** Moment-start framing (2.2#4). */
  private openCam: { x: number; y: number; zoomMult: number; t0: number; fromX: number; fromY: number; fromZoom: number } | null = null
  /** Live follow spring (2.2#2). */
  private camSpring: Spring2 | null = null
  /** Height (game px) of the HUD band at the top; the play camera renders below it so the HUD never covers play. */
  private hudTop = 0
  /** Dev only: recent runtime events for the playtest recorder (debugInfo().events). */
  private evTrail: Record<string, unknown>[] = []
  /** Zoom multiplier of the on-the-ball framing (pass options + goal), 1 when not framing. */
  private attnZoom = 1
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
  /** Graphics quality profile and the scene's shared particle budget. */
  private q: QualitySpec = QUALITY.high
  private fxBudget = new ParticleBudget(QUALITY.high)
  private look!: StadiumLook
  /** Floodlight positions (world px, on the ground plane) that cast the night shadows. */
  private lightSrc: { x: number; y: number }[] = []
  private night = false
  /** Stand images (crowd bounce on goals). */
  private stands: Phaser.GameObjects.Image[] = []
  /** Player name labels (created lazily; toggled with N, always on in replays/celebrations). */
  private labels: Phaser.GameObjects.Text[] | null = null
  private labelsOn = false
  /** Key-opponent tag (name · OVR), tap to expand with the two attributes that decide the moment. */
  private oppTag: { text: Phaser.GameObjects.Text; view: PlayerView; compact: string; expanded: string; open: boolean; box: { x0: number; y0: number; x1: number; y1: number } | null } | null = null
  private oppTagHandler: ((e: PointerEvent) => void) | null = null
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
  /** Set-piece picker (corner delivery / wall) while the runtime waits for the hero. */
  private picker: { st: PickerState; dom: PickerDom; padPrev: boolean[]; onKey: (e: KeyboardEvent) => void } | null = null
  private pickerOut: HeroAction[] = []
  /**
   * Static Graphics cached into textures (perf): Phaser re-tessellates every
   * Graphics command each frame, so the pitch, stands background, floodlights,
   * goals and flags are drawn once into a DynamicTexture and shown as Images.
   * The Graphics are kept (hidden) to re-bake on a big zoom change.
   */
  private baked: { g: Phaser.GameObjects.Graphics; key: string; box: BakeBox; img: Phaser.GameObjects.Image | null; scale: number; extra?: BakeExtra }[] = []
  /** Swallows the taps/keys that closed the picker (real seconds left). */
  private pickerCooldown = 0
  /** Deterministic input log of this moment (debugging / bug reports, WP-13). */
  private inputRec = new InputRecorder()
  /** Stored-input playback cursor (goal reel); null when a human / the autopilot plays. */
  private reel: { frames: InputRecording['frames']; i: number; acc: number; move: Vec2; sprint: boolean; aim: AimState | null } | null = null
  private assistText: Phaser.GameObjects.Text | null = null
  /** Bullet-time desaturation filter (lazily created). */
  private desat: { f: Phaser.Filters.ColorMatrix; amt: number } | null = null
  /** Launch speed read-out at the power ring (2.1#21). */
  private speedText: Phaser.GameObjects.Text | null = null
  private paused = false
  /** Big centred "3 / 2 / 1" / PAUSED read-out while the pause gate holds the moment. */
  private gateText: Phaser.GameObjects.Text | null = null
  private auto: AutopilotState | null = null
  private kits!: { hero: KitColors; opp: KitColors; heroGk: KitColors; oppGk: KitColors }

  constructor() {
    super({ key: SCENE_KEY })
  }

  init(data: SceneData): void {
    this.data0 = data
    this.views = []
    this.hudTexts = []
    this.floaters = []
    this.floatPool = null
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
    this.openCam = null
    this.camSpring = null
    this.passLineX = null
    this.lastKeyT = -1
    this.windText = null
    this.assistText = null
    this.speedText = null
    this.desat = null
    this.inputRec = new InputRecorder()
    this.ring2 = null
    this.baked = []
    this.paused = false
    this.gateText = null
  }

  create(): void {
    // Breadcrumbs (telemetry/breadcrumbs): a hang inside create leaves the last stage behind.
    crumb('scene-create', 'match')
    this.events.once(Phaser.Scenes.Events.CREATE, () => crumb('scene-ready', 'match'))
    const { highlight, opts } = this.data0
    this.ui = (this.registry.get('dpr') as number | undefined) ?? 1
    this.hudU = this.ui * (this.scale.width / this.ui >= 1100 ? 1.25 : 1)
    this.s = T[opts.lang] ?? T.en
    const names = { ...(opts.names ?? {}) }
    const heroP = highlight.scenario.players.find((p) => p.isHero)
    if (heroP) names[heroP.id] = opts.heroName ?? this.s.you
    this.reel = opts.inputReplay && !this.data0.replayOnly ? { frames: opts.inputReplay.frames, i: 0, acc: 0, move: { x: 0, y: 0 }, sprint: false, aim: null } : null
    this.rt = new HighlightRuntime(highlight, opts.inputReplay && this.reel
      ? { ...opts.inputReplay.opts, names }
      : {
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
    const profile: QualityProfile = opts.settings.quality ?? (opts.settings.lowFx ? 'low' : 'high')
    this.q = QUALITY[profile]
    this.fxBudget = new ParticleBudget(this.q)
    this.lowFx = profile === 'low'
    this.replayAngle = opts.replayAngle ?? 'auto'
    const capacity = opts.stadium?.capacity ?? 18_000
    this.look = stadiumLook(capacity, profile)
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
    // Self-check (iOS playtest: invisible players): every figure must have a drawable texture.
    this.figureFixes = figureSelfCheck(this, this.views.map((v) => v.rig))
    this.buildBall()
    this.buildFx()
    this.buildHud()

    const canvas = this.game.canvas
    this.input0 = new InputController(canvas, {
      toWorld: (gx, gy) => this.edgeMateAt(gx, gy) ?? this.screenToPitch(gx, gy),
      screenDirToWorld: (dx, dy) => screenDirToPitch(dx, dy),
      size: () => ({ w: this.scale.width, h: this.scale.height }),
      ui: () => this.ui,
      insets: canvasSafeInsets(canvas, () => this.ui),
    })

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    const b = project(this.rt.ball.x, this.rt.ball.y)
    this.cam.x = b.x
    this.cam.y = b.y
    this.cam.zoom = this.cam.base * 0.82
    this.camSpring = null
    this.startOpenCam()
    // Player name labels on demand (N).
    this.onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyN' && !e.repeat && !(e.target instanceof HTMLInputElement)) this.labelsOn = !this.labelsOn
    }
    window.addEventListener('keydown', this.onKey)
    this.buildOppTag(names)
    if (replayOnly) this.startReplay(replayOnly.frames, replayOnly.keyTime, false)
    // One shared pause source (game/pauseGate): a control hint, the app in the background / a system
    // sheet or the pause key freezes the whole moment; it resumes after a 3-2-1 beat.
    wireAppPause()
    const gateTok = pauseGate.attach()
    const offGate = () => pauseGate.detach(gateTok)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offGate)
    this.events.once(Phaser.Scenes.Events.DESTROY, offGate)
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

  /** Rigs that failed the figure self-check and fell back to simple figures. */
  private figureFixes = 0

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
      figures: { players: this.views.length, fixes: this.figureFixes, issues: figureTextureIssues.length },
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
      quality: this.q.profile,
      crowdDensity: this.look.density,
      particlesAlive: this.fxBudget.alive(this.time.now),
      particleBudget: this.q.particleBudget,
      night: this.night,
      celebration: this.celeb?.id ?? null,
      replayAngle: this.replay ? this.currentAngle() : null,
      heroCallAt: rt.heroCallAt,
      pendingChoice: rt.pendingChoice,
      cornerChoice: rt.cornerChoice,
      wallChoice: rt.wallChoice,
      wall: rt.setPiece?.wall.length ?? 0,
      /** Pause gate (hint / background / pause key / resume beat) is freezing the moment. */
      paused: this.paused,
      clock: rt.time,
      ballWorld: { x: rt.ball.x, y: rt.ball.y, z: rt.ball.z },
      heroWorld: { x: rt.hero.pos.x, y: rt.hero.pos.y },
      heroState: rt.hero.state,
      stamina: rt.hero.stamina,
      /** Who has the ball (team, pitch and CSS position): the press e2e steers the stick at him. */
      carrier: rt.owner ? { team: rt.owner.team, keeper: rt.owner.isKeeper, world: { x: rt.owner.pos.x, y: rt.owner.pos.y }, screen: css(project(rt.owner.pos.x, rt.owner.pos.y)) } : null,
      /** Context buttons on screen (CSS px), see game/actionSet. */
      buttons: this.input0.touchUi().buttons.map((b) => ({ id: b.id, hold: b.hold, key: b.key, down: b.down, x: r.left + b.x * kx, y: r.top + b.y * ky, r: b.r * kx })),
      /** Playtest recorder: every player on screen (CSS px), feet and head, so a touch bot can tap a man. */
      agents: rt.agents.map((a) => ({
        id: a.id, team: a.team, keeper: a.isKeeper, hero: a.isHero, owner: rt.owner === a,
        world: { x: a.pos.x, y: a.pos.y }, feet: css(project(a.pos.x, a.pos.y)), head: css(project(a.pos.x, a.pos.y, 1.85)),
      })),
      passTarget: rt.passTargetId,
      events: this.evTrail.slice(),
      /** Off-screen team-mate badges on the screen edge (CSS px), tappable to pass. */
      ballSpeed: Math.hypot(this.rt.ball.vx, this.rt.ball.vy),
      intercept: (() => { const q = this.rt.interceptPoint(); if (!q) return null; const sp = this.worldToScreen(project(q.x, q.y).x, project(q.x, q.y).y); return { x: r.left + sp.x * kx, y: r.top + sp.y * ky } })(),
      dropWorld: (() => { const d = this.rt.dropZone(); return d ? { x: d.x, y: d.y } : null })(),
      ballZ: this.rt.ball.z,
      ballVz: this.rt.ball.vz,
      edgeMates: this.edgeMarks.map((e) => ({ x: r.left + e.x * kx, y: r.top + e.y * ky, world: e.world })),
      /** Drop-zone marker shown for a ball in the air (CSS px), as the player sees it. */
      drop: this.drop ? { ...css(project(this.drop.x, this.drop.y)), t: this.drop.t } : null,
      /** Attacked goal on screen: posts at the ground and the bar, to judge its size against the keeper. */
      goalFrame: {
        postL: css(project(PITCH_LENGTH, GOAL_CENTER_Y - GOAL_WIDTH / 2)), postR: css(project(PITCH_LENGTH, GOAL_CENTER_Y + GOAL_WIDTH / 2)),
        barL: css(project(PITCH_LENGTH, GOAL_CENTER_Y - GOAL_WIDTH / 2, GOAL_HEIGHT)), barR: css(project(PITCH_LENGTH, GOAL_CENTER_Y + GOAL_WIDTH / 2, GOAL_HEIGHT)),
      },
    }
  }

  private cleanup(): void {
    this.closePicker()
    for (const e of this.baked) if (this.textures.exists(e.key)) this.textures.remove(e.key)
    this.baked = []
    if (this.onKey) window.removeEventListener('keydown', this.onKey)
    if (this.oppTagHandler) this.game.canvas?.removeEventListener('pointerdown', this.oppTagHandler)
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
    this.bakeLater(bg, { x0: -14, x1: PITCH_LENGTH + 30, y0: -17.5, y1: PITCH_WIDTH + 17.5 })
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
    const crowdKey = crowdTexture(this, 'crowd_end', endLen, look.endDepth, cols, 7, { ...crowdOpts, squash: (VIS_END * TILT * 1.05) / look.endDepth })
    const top = project(PITCH_LENGTH + 6.2, endY0)
    const endImg = this.addW(this.add.image(top.x, top.y, crowdKey).setOrigin(0, 1).setDepth(-50))
    endImg.setDisplaySize(endLen * PPM, VIS_END * PPM * TILT * 1.05)
    this.stands.push(endImg)
    endImg.setData('y0', endImg.y)
    // Side stands along both touchlines (rows run up the screen).
    const sideLenM = look.tier === 'local' ? 60 : PITCH_LENGTH + 30
    const sideKey = crowdTexture(this, 'crowd_side', sideLenM, look.sideDepth, cols, 11, { ...crowdOpts, squash: VIS_SIDE / look.sideDepth })
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
    const lines = this.addW(this.add.graphics().setDepth(-40).setVisible(false))
    const standShadow = { local: 0, mid: 5, large: 11, mega: 14 }[look.tier]
    drawPitch(pitch, opts.weather, { night, lines, standShadow, seed: this.data0.highlight.id.length * 13 + 5 })
    this.bakeLater(pitch, { x0: -16.5, x1: PITCH_LENGTH + 9.5, y0: -6.5, y1: PITCH_WIDTH + 6.5 }, { grain: { key: grassGrainTexture(this), alpha: opts.weather === 'snow' ? 0.5 : 1, tileM: 2.6 }, post: lines })
    if (opts.weather === 'rain' || opts.weather === 'snow') {
      const wg = this.addW(this.add.graphics().setDepth(-39.6))
      drawWeatherGround(wg, opts.weather, this.data0.highlight.id.length * 31 + 7, this.lowFx)
      this.bakeLater(wg, { x0: -12, x1: PITCH_LENGTH + 12, y0: -12, y1: PITCH_WIDTH + 12 })
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
    if (look.ads === 'led-glow' && this.q.glow) {
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
      const goalBox = { x0: gx - 4, x1: gx + 4, y0: GOAL_CENTER_Y - 6.5, y1: GOAL_CENTER_Y + 6.5, z: 3.5 }
      this.bakeLater(fg, goalBox)
      // The net is re-drawn only while it ripples (Graphics shown, baked image hidden).
      this.bakeLater(this.netG[end], goalBox)
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
      this.bakeLater(fgx, { x0: cx - 1.5, x1: cx + 1.5, y0: cy - 1.5, y1: cy + 1.5, z: 2.2 })
    }
  }

  /** Floodlights by stadium tier; lit (glow + light pools + darker surroundings) for evening fixtures. */
  private buildLights(): void {
    const look = this.look
    const night = this.night
    const g = this.addW(this.add.graphics().setDepth(-45))
    this.bakeLater(g, { x0: -8, x1: PITCH_LENGTH + 9, y0: -11, y1: PITCH_WIDTH + 11, z: 24 })
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
      const roofY = project(PITCH_LENGTH + 6.2 + ({ large: 6.6, mega: 7.2 } as Record<string, number>)[look.tier]! * 0.96, 0).y
      for (let y = -14; y <= PITCH_WIDTH + 14; y += look.lights === 'ring' ? 9 : 12) lamps.push({ x: project(0, y).x, y: roofY, r: 6 * PPM })
      if (look.lights === 'ring') {
        for (const left of [true, false]) {
          const ex = project(0, left ? -5.5 - 7.3 : PITCH_WIDTH + 5.5 + 7.3).x
          for (let x = 0; x <= PITCH_LENGTH; x += 15) lamps.push({ x: ex, y: project(x, 0).y, r: 6 * PPM })
        }
      }
    }
    this.lightSrc = [project(PITCH_LENGTH + 8, -10), project(PITCH_LENGTH + 8, PITCH_WIDTH + 10), project(-8, -10), project(-8, PITCH_WIDTH + 10)]
    if (!night) return
    // Darken the surroundings (stands, sky) — the pitch itself carries a night palette with baked light pools.
    const dark = { local: 0.5, mid: 0.42, large: 0.34, mega: 0.28 }[look.tier]
    const a = project(PITCH_LENGTH + 40, -40)
    const b = project(-20, PITCH_WIDTH + 40)
    this.addW(this.add.rectangle(a.x, a.y, b.x - a.x, b.y - a.y, 0x02040a, dark).setOrigin(0, 0).setDepth(-41))
    // Floodlight beams: soft additive cones from the lamp banks down onto the turf (baked into one image).
    if (this.q.profile !== 'low') {
      const cones = this.addW(this.add.graphics().setDepth(-38.2).setBlendMode(Phaser.BlendModes.ADD))
      const centre = project(PITCH_LENGTH / 2, PITCH_WIDTH / 2)
      const every = look.lights === 'poles' || look.lights === 'pylons' ? 1 : this.q.profile === 'high' ? 2 : 4
      for (let i = 0; i < lamps.length; i += every) {
        const l = lamps[i]!
        const tx = l.x + (centre.x - l.x) * 0.45
        const dyc = centre.y - l.y
        const ty = l.y + (dyc > 0 ? Math.max(14 * PPM, dyc * 0.45) : dyc * 0.45)
        const dx = tx - l.x
        const dy = ty - l.y
        const len = Math.hypot(dx, dy) || 1
        const half = (look.lights === 'poles' || look.lights === 'pylons' ? 11 : 6) * PPM
        const nx = (-dy / len) * half
        const ny = (dx / len) * half
        fillGradient(cones, 0xfff4d6, 0xfff4d6, 0xfff4d6, 0xfff4d6, 0.13, 0, 0, 0)
        cones.fillTriangle(l.x, l.y, tx + nx, ty + ny, tx - nx, ty - ny)
      }
      this.bakeLater(cones, { x0: -12, x1: PITCH_LENGTH + 12, y0: -14, y1: PITCH_WIDTH + 14, z: 26 })
    }
    const step = this.q.lampStep
    for (let i = 0; i < lamps.length; i += step) {
      const l = lamps[i]!
      this.addW(this.add.image(l.x, l.y, 'fx_dot')).setDisplaySize(l.r * 2, l.r * 2).setTint(0xfff1c8).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(-38)
      this.addW(this.add.image(l.x, l.y, 'fx_dot')).setDisplaySize(l.r * 0.5, l.r * 0.5).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(-38)
    }
  }

  private kitFor(a: Agent): KitColors {
    if (a.isKeeper) return a.team === 'hero' ? this.kits.heroGk : this.kits.oppGk
    return a.team === 'hero' ? this.kits.hero : this.kits.opp
  }

  private buildPlayers(): void {
    const S = FIG_RES[this.q.profile]
    const skinKey = figureSkinSheet(this, S)
    const female = this.data0.opts.gender === 'female'
    const night = this.night
    const casts = night ? { low: 1, medium: 2, high: 4 }[this.q.profile] : 1
    for (const a of this.rt.agents) {
      const kit = this.kitFor(a)
      const outline = a.isKeeper ? null : this.outline[a.team === 'hero' ? 'hero' : 'opp']
      const kitKey = figureKitSheet(this, kit, S, { keeper: a.isKeeper, outline })
      let h = 0
      for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0
      const rig = new FigureRig(this, { kitKey, skinKey, headKey: figureHeadTexture(this, h, female), numKey: figureNumberTexture(this, kit, a.number), skin: skinTone(h), S })
      const c = this.add.container(0, 0)
      const shadow = this.addW(this.add.image(0, 0, 'fx_shadow').setDepth(-37.5))
      const castImgs: Phaser.GameObjects.Image[] = []
      for (let i = 0; i < casts; i++) castImgs.push(this.addW(this.add.image(0, 0, 'fx_cast').setOrigin(0.08, 0.5).setDepth(-37.6)))
      const chev = this.add.image(0, 0, 'fx_chev').setTint(a.isHero ? 0xffd23f : a.team === 'hero' ? 0xffffff : 0x111111).setAlpha(a.isHero ? 0.95 : 0.5)
      chev.setScale((0.42 * PPM) / 32)
      let ring: Phaser.GameObjects.Image | null = null
      if (a.isHero) {
        ring = this.add.image(0, 0, 'fx_glow').setTint(0xffd23f).setBlendMode(Phaser.BlendModes.ADD)
        ring.setScale((2.0 * PPM) / 128, ((2.0 * PPM) / 128) * TILT)
      }
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
      parts.push(chev, ...rig.parts())
      if (arms) parts.push(arms)
      c.add(parts)
      this.addW(c)
      const p = project(a.pos.x, a.pos.y)
      this.views.push({ agent: a, c, shadow, casts: castImgs, chev, rig, ring, arms, phase: (h % 97) / 97, lastX: p.x, lastY: p.y, kickT: 9, kickStyle: 'side', headT: 9, catchT: 9 })
    }
  }

  private buildBall(): void {
    const weather = this.data0.opts.weather
    // Tester report: a white ball vanished against white/yellow kits. Pick a ball that reads against
    // both outfield kits and the turf (white when it can, else hi-vis orange / black / magenta);
    // the keepers' kits steer which hi-vis ball.
    const turf = PITCH_COLORS[this.night && weather !== 'snow' ? 'night' : weather] ?? PITCH_COLORS.clear
    this.ballStyle = pickBallStyle([this.kits.hero.primary, this.kits.opp.primary, turf[0], turf[1]], {
      snow: weather === 'snow',
      soft: [this.kits.heroGk.primary, this.kits.oppGk.primary],
    })
    const paint = this.ballStyle.switched || this.ballStyle.halo ? this.ballStyle : undefined
    this.ballShadow = this.addW(this.add.image(0, 0, 'fx_shadow').setScale((0.5 * PPM) / 64, ((0.5 * PPM) / 32) * TILT * 0.5))
    this.trailG = this.addW(this.add.graphics())
    const flat = ballTexture(this, weather, 64, false, paint)
    if (this.ballStyle.halo) this.ballHalo = this.addW(this.add.image(0, 0, 'fx_glow').setTint(0xffffff).setAlpha(0.45))
    this.ballGhosts = [0, 1, 2].map(() => this.addW(this.add.image(0, 0, flat).setVisible(false)))
    this.ballImg = this.addW(this.add.image(0, 0, flat).setScale(BALL_D / 64))
    this.ballShade = this.addW(this.add.image(0, 0, 'fx_ballshade').setScale(BALL_D / 64))
    if (paint) this.ballRim = this.addW(this.add.image(0, 0, ballRimTexture(this, paint.rim)).setScale(BALL_D / 64))
    this.aimG = this.addW(this.add.graphics().setDepth(5_000_000))
    this.dropG = this.addW(this.add.graphics().setDepth(-4))
  }

  private buildFx(): void {
    // Grass blades and clods kicked up by strikes and tackles.
    this.grassFx = this.addW(
      this.add.particles(0, 0, 'fx_blade', {
        emitting: false,
        speed: { min: 40, max: 140 },
        angle: { min: 200, max: 340 },
        gravityY: 300,
        lifespan: { min: 320, max: 700 },
        scale: { start: 0.9, end: 0.35 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 0.95, end: 0 },
        tint: this.data0.opts.weather === 'snow' ? [0xffffff, 0xe8f0ff, 0x9fbfa6] : [0x3c8a3a, 0x58a84b, 0x7cc35e, 0x6e5a32, 0x2f6d2c],
      }),
    ).setDepth(4_000_000)
    const wet = this.data0.opts.weather === 'rain'
    this.puffFx = this.addW(
      this.add.particles(0, 0, 'fx_dot', {
        emitting: false,
        speed: { min: 12, max: 55 },
        angle: { min: 180, max: 360 },
        lifespan: { min: 380, max: 760 },
        scale: { start: 0.5, end: 1.6 },
        alpha: { start: wet ? 0.5 : 0.35, end: 0 },
        tint: wet ? [0xdfeaff, 0xbcd0e8] : this.data0.opts.weather === 'snow' ? [0xffffff] : [0x9d8a5a, 0x7f9a5a, 0xb9a77a],
      }),
    ).setDepth(3_999_000)
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

  /**
   * HUD / overlay text in the UI type tokens: `display` = Barlow Condensed
   * (--font-display), `score` = Teko (--font-score). `stroke` adds a dark
   * outline for text drawn over the pitch; text on HUD panels has none.
   */
  private text(size: number, color = '#ffffff', weight = '800', family: 'display' | 'score' = 'display', stroke = true): Phaser.GameObjects.Text {
    const t = this.addH(
      this.add
        .text(0, 0, '', {
          fontFamily: HUD_FONTS[family],
          fontSize: `${Math.round(size * this.hudU)}px`,
          fontStyle: weight === '900' || weight === '800' || weight === '700' ? 'bold' : 'normal',
          color,
          stroke: '#04070d',
          strokeThickness: stroke ? Math.max(2, Math.round(size * this.hudU * 0.14)) : 0,
        })
        .setOrigin(0.5),
    )
    if (stroke) t.setShadow(0, Math.round(1.5 * this.hudU), 'rgba(0,0,0,0.45)', Math.round(3 * this.hudU), true, true)
    this.hudTexts.push(t)
    return t
  }

  private buildHud(): void {
    const { opts } = this.data0
    this.vignette = this.addH(this.add.image(0, 0, 'fx_vignette').setOrigin(0, 0).setAlpha(0))
    this.flash = this.addH(this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0, 0).setAlpha(0))
    this.hudG = this.addH(this.add.graphics())
    this.sb = {
      min: this.text(19, '#03120a', '700', 'score', false).setOrigin(0.5, 0.42),
      home: this.text(16, '#f2f5fa', '700', 'display', false).setOrigin(0, 0.5),
      score: this.text(21, '#0b1220', '700', 'score', false).setOrigin(0.5, 0.42),
      away: this.text(16, '#f2f5fa', '700', 'display', false).setOrigin(0, 0.5),
      x: { min: 0, minW: 0, home: 0, score: 0, scoreW: 0, away: 0, end: 0 },
    }
    this.promptText = this.text(17, '#f2f5fa', '700', 'display', false)
    this.bannerText = this.text(70, '#ffc83d', '700', 'score').setAlpha(0)
    this.bannerSub = this.text(19, '#f2f5fa', '700').setAlpha(0)
    this.focusText = this.text(12, '#9fe8ff', '700', 'display', false).setAlpha(0)
    this.tagText = this.text(13, '#1a1405', '700', 'display', false)
    this.speedText = this.text(11, '#ffffff', '700', 'display', false).setOrigin(0, 1).setStroke('#000000', 3).setAlpha(0)
    this.sprintText = this.text(14, '#ffffff', '700')
    this.skillText = this.text(13, '#ffffff', '700')
    this.replayText = this.text(17, '#ffffff', '700').setAlpha(0)
    this.tagText.setText(`${this.rt.hero.number}  ${this.rt.hero.name}`)
    this.sprintText.setText(this.s.sprint)
    this.skillText.setText(this.s.skill)
    for (let i = 0; i < 4; i++) {
      this.ctxLabels.push(this.text(11, '#ffffff', '800').setAlpha(0))
      this.ctxKeyTexts.push(this.text(9, '#0b1220', '800', 'display', false).setAlpha(0))
    }
    this.focusText.setText(this.s.focus)
    this.replayText.setText(`● ${this.s.replay}`)
    this.angleText = this.text(12, '#ffffff', '700').setAlpha(0)
    this.overlayG = this.addW(this.add.graphics().setDepth(-30))
    // Weather read-out (wind arrow + km/h, rain / snow icon) at the right of the HUD band.
    const wind = windReadout(this.rt.env.wind)
    if (wind || opts.weather === 'rain' || opts.weather === 'snow') {
      this.windText = this.text(13, '#dfe9ff', '700', 'display', false).setOrigin(1, 0.5)
      const icon = opts.weather === 'rain' ? '☂' : opts.weather === 'snow' ? '❄' : ''
      // The weather icon also says what it does to the ball (2.2#73): wet = skids on, snow = dies.
      const grip = pitchGrip(this.rt.env)
      const gripTag = grip === 'slick' ? ` ${this.s.grip_slick}` : grip === 'heavy' ? ` ${this.s.grip_heavy}` : ''
      this.windText.setText(`${icon}${gripTag}${(icon || gripTag) && wind ? '  ' : ''}${wind ? `${wind.kmh} km/h` : ''}`)
    }
    this.promptText.setText(this.data0.highlight.scenario.prompt)
    this.promptT = 0
    // Aim-assist level and its rating/XP multiplier (less assist, more reward).
    this.assistText = this.text(11, '#8494b3', '700', 'display', false).setOrigin(1, 0.5)
    this.assistText.setText(`${this.s[`aim_${this.rt.assist}`]} · ×${ASSIST_REWARD[this.rt.assist].toFixed(2)} XP`)

    const h = this.data0.highlight
    const heroName = opts.teamNames?.hero ?? (h.side === 'home' ? 'HOME' : 'AWAY')
    const oppName = opts.teamNames?.opp ?? (h.side === 'home' ? 'AWAY' : 'HOME')
    const home = h.side === 'home' ? heroName : oppName
    const away = h.side === 'home' ? oppName : heroName
    this.sb.min.setText(`${h.minute}'`)
    this.sb.home.setText(upper(home.slice(0, 3), opts.lang))
    this.sb.score.setText(`${h.score[0]}-${h.score[1]}`)
    this.sb.away.setText(upper(away.slice(0, 3), opts.lang))
    this.sbColors = h.side === 'home' ? [colorNum(this.kits.hero.primary), colorNum(this.kits.opp.primary)] : [colorNum(this.kits.opp.primary), colorNum(this.kits.hero.primary)]
    // Web fonts may finish loading after the scene starts: re-measure and re-lay out then.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        if (!this.sys?.isActive()) return
        for (const t of this.hudTexts) if (t.active) t.updateText()
        this.layout()
      })
    }

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
          frequency: (rain ? 8 : 40) / this.q.weatherRate,
          quantity: rain ? (this.lowFx ? 2 : 3) : 2,
        }),
      )
      // Second, background rain layer (2.2#73): fine, faint, slower streaks behind the main sheet. Not on Low.
      if (rain && this.q.profile !== 'low' && !this.lowFx) {
        this.addH(
          this.add.particles(0, 0, 'fx_streak', {
            x: { min: -50, max: 4000 },
            y: -20,
            lifespan: 1100,
            speedY: { min: 800, max: 1000 },
            speedX: { min: -150, max: -110 },
            scale: { min: 0.25 * this.ui, max: 0.42 * this.ui },
            alpha: { min: 0.1, max: 0.2 },
            rotate: 8,
            frequency: 10 / this.q.weatherRate,
            quantity: 2,
          }).setDepth(-1),
        )
      }
    }
  }

  /** Recomputes camera sizes and HUD layout after a resize. */
  private layout(): void {
    const w = this.scale.width
    const h = this.scale.height
    const u = this.hudU
    const landscape = w >= h
    this.safeTop = safeAreaTop(this.game.canvas) * u
    // HUD band (2.2#92): one slim row = score bug + stamina, moment timer, weather; ≤ 6 % of a 1280×800 screen.
    // The prompt / focus label floats over the top of the pitch and fades out.
    this.promptText.setFontSize(Math.round((landscape ? 16 : 14) * u))
    this.promptText.setWordWrapWidth(landscape ? Math.min(w * 0.7, 900 * u) : w - 28 * u)
    const row1 = HUD_ROW * u
    this.hudTop = Math.round(this.safeTop + row1)
    const vh = Math.max(1, h - this.hudTop)
    this.cameras.main.setViewport(0, this.hudTop, w, vh)
    this.uiCam.setSize(w, h)
    // FIT design area (view.ts): portrait frames tighter, always enough pitch ahead of the play.
    const z = fitZoom(w, vh, landscape, resolveCameraDistance(this.data0.opts.settings.cameraDistance, w / this.ui, h / this.ui))
    this.cam.base = z
    this.bakeStatics()
    this.vignette.setDisplaySize(w, h)
    this.flash.setSize(w, h)
    const top = this.safeTop
    // Score bug: [minute | ▌HOME  2-1  AWAY▐]
    const cyB = top + 17 * u
    const sx = this.sb.x
    sx.min = 12 * u
    sx.minW = this.sb.min.width + 14 * u
    sx.home = sx.min + sx.minW + 10 * u
    sx.score = sx.home + this.sb.home.width + 8 * u
    sx.scoreW = this.sb.score.width + 16 * u
    sx.away = sx.score + sx.scoreW + 8 * u
    sx.end = sx.away + this.sb.away.width + 10 * u
    this.sb.min.setPosition(sx.min + sx.minW / 2, cyB)
    this.sb.home.setPosition(sx.home, cyB)
    this.sb.score.setPosition(sx.score + sx.scoreW / 2, cyB)
    this.sb.away.setPosition(sx.away, cyB)
    const sbRight = sx.end
    const bw0 = Math.min(w * 0.42, 380 * u)
    const bx = Math.max(w / 2 - bw0 / 2, sbRight + 14 * u)
    const reserve = this.windText ? this.windText.width + 34 * u : 0
    const bwMax = w - 16 * u - bx - reserve
    this.bar = { x: bx, y: top + 11 * u, w: Math.max(40 * u, Math.min(bw0, bwMax)) }
    this.windText?.setPosition(w - 12 * u, top + 18 * u)
    // Aim-assist read-out sits under the right end of the timer (never on the prompt's row).
    this.assistText?.setPosition(this.bar.x + this.bar.w, top + 27 * u)
    const promptY = this.hudTop + 8 * u + this.promptText.height / 2
    this.promptText.setPosition(w / 2, promptY)
    this.focusText.setPosition(w / 2, promptY)
    this.bannerText.setPosition(w / 2, this.hudTop + vh * 0.3)
    this.bannerSub.setPosition(w / 2, this.hudTop + vh * 0.3 + 52 * u)
    this.replayText.setPosition(w - 70 * u, 26 * u)
  }

  // ───────────────────────── Coordinate helpers ─────────────────────────

  /** Screen y of the camera centre: the middle of the band between the score bar and the thumb strip (see centerOn). */
  private camScreenY(): number {
    return (this.scale.height + this.hudTop + this.promptReserve() - this.thumbReserve()) / 2
  }

  /** Strip under the score bar taken by the moment's prompt pill while it shows (playtest: the goal sat under it). */
  private promptReserve(): number {
    const p = this.promptText
    if (!p || this.mode !== 'play' || p.alpha < 0.3 || p.y > this.scale.height / 2) return 0
    return p.height + 16 * this.ui
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const w = this.scale.width
    return { x: (wx - this.cam.x) * this.cam.zoom + w / 2, y: (wy - this.cam.y) * this.cam.zoom + this.camScreenY() }
  }

  private screenToPitch(gx: number, gy: number): { x: number; y: number } {
    const w = this.scale.width
    const wx = (gx - w / 2) / this.cam.zoom + this.cam.x
    const wy = (gy - this.camScreenY()) / this.cam.zoom + this.cam.y
    return unproject(wx, wy)
  }

  // ───────────────────────── Main loop ─────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1000))
    const rt = this.rt
    this.syncButtons()
    const intent = this.input0.poll({
      heroPos: rt.hero.pos,
      ballPos: { x: rt.ball.x, y: rt.ball.y },
      heroOnBall: rt.heroOnBall,
      heroIsKeeper: rt.heroIsKeeper,
      mates: this.matePositions(),
    })
    this.lastIntent = intent
    if (intent.any) this.sfx.unlock()

    if (intent.pause && this.mode === 'play') pauseGate.toggle('user')
    // Frozen while anything holds the gate (hint card, background, pause key) and during the
    // resume countdown: no physics, AI, bullet time, time limit or sound cues; input is dropped.
    this.paused = this.mode === 'play' && !pauseGate.tick(Math.min(0.25, Math.max(0, deltaMs / 1000)))
    if (!this.paused) this.elapsed += dt
    this.drawGate()
    if (this.paused) {
      this.renderLive(0)
      this.drawOverlay(0)
      this.updateHud(0, intent)
      return
    }
    if (this.mode === 'play') {
      if (!this.reel) this.updatePicker(dt, intent)
      if (this.reel) {
        this.stepReel(dt)
      } else if (this.auto) {
        autopilotStep(rt, this.auto)
        rt.update(dt)
      } else {
        // Single entry point shared with the replayer: the recording reproduces the moment exactly.
        applyInput(rt, intent, dt, this.inputRec)
      }
      const evs = rt.drainEvents()
      // Dev/e2e playtest recorder: a short event trail (who did what) for the review.
      if (import.meta.env.DEV && evs.length) for (const e of evs) { this.evTrail.push({ t: Math.round(rt.time * 100) / 100, ...e } as Record<string, unknown>); if (this.evTrail.length > 120) this.evTrail.shift() }
      this.handleEvents(evs)
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

  /**
   * Context buttons for what the hero is doing now (game/actionSet): none while a set-piece choice is
   * pending, the autopilot plays, a reel runs or the moment is over.
   */
  private syncButtons(): void {
    const rt = this.rt
    const live = this.mode === 'play' && !this.auto && !this.reel && !rt.pendingChoice && (rt.phase === 'live' || rt.phase === 'intro')
    if (!live) {
      this.input0.setButtons([])
      return
    }
    const ids = contextActions(rt.actionContext())
    const keys = assignKeys(ids)
    const bd = getBindings()
    this.input0.setButtons(
      ids.map((id) => {
        const k = keys.get(id)
        return { id, hold: ACTION_DEFS[id].hold, key: k ? bd[k] : null }
      }),
    )
  }

  /** Draws the context buttons: dark glass disc, tone ring, vector icon, label; key caps with a keyboard. */
  private drawContextButtons(g: Phaser.GameObjects.Graphics, btns: readonly ContextButtonUi[], touch: boolean, stamina: number): void {
    const u = this.hudU
    const show = this.mode === 'play'
    const lang = this.data0.opts.lang === 'tr' ? 'tr' : 'en'
    const layoutKey = btns.map((b) => `${b.id}:${Math.round(b.r)}:${b.key ?? ''}`).join('|') + (touch ? 't' : 'k')
    const relayout = layoutKey !== this.ctxLayoutKey
    this.ctxLayoutKey = layoutKey
    for (let i = 0; i < this.ctxLabels.length; i++) {
      const b = btns[i]
      const label = this.ctxLabels[i]!
      const keyT = this.ctxKeyTexts[i]!
      if (!b || !show) {
        label.setAlpha(0)
        keyT.setAlpha(0)
        continue
      }
      const def = ACTION_DEFS[b.id]
      // PUNCH only bites on a cross: dimmed until one is dropping into the box.
      let a = b.id !== 'punch' || this.rt.crossIncoming ? 1 : 0.45
      // Never hide the play: a button over the hero or the ball (keeper moments put our goal there) turns see-through.
      const hs = this.worldToScreen(this.rt.hero.pos.x, this.rt.hero.pos.y)
      const bs = this.worldToScreen(this.rt.ball.x, this.rt.ball.y)
      if (Math.hypot(hs.x - b.x, hs.y - b.y) < b.r * 1.35 || Math.hypot(bs.x - b.x, bs.y - b.y) < b.r * 1.2) a *= 0.42
      const main = i === 0
      // Glass disc with a soft drop shadow.
      g.fillStyle(0x000000, 0.28 * a)
      g.fillCircle(b.x, b.y + 2.5 * u, b.r)
      g.fillStyle(0x0b1220, (b.down ? 0.86 : 0.62) * a)
      g.fillCircle(b.x, b.y, b.r)
      g.fillStyle(def.tone, (b.down ? 0.3 : 0.1) * a)
      g.fillCircle(b.x, b.y, b.r * 0.94)
      g.lineStyle((main ? 3 : 2.2) * u, def.tone, (b.down ? 1 : 0.85) * a)
      g.strokeCircle(b.x, b.y, b.r)
      g.lineStyle(1 * u, 0xffffff, 0.16 * a)
      g.strokeCircle(b.x, b.y, b.r * 0.82)
      drawActionIcon(g, def.icon, b.x, b.y - b.r * 0.2, b.r * (main ? 0.3 : 0.32), b.down ? 0xffffff : def.tone, 0.96 * a, Math.max(1.6, b.r * 0.075))
      if (b.id === 'sprint') {
        // Stamina arc around SPRINT (Stamina / Work Rate set how fast it drains and refills).
        g.lineStyle(3 * u, stamina > 0.25 ? 0x5dff8a : 0xff8a3d, 0.9)
        g.beginPath()
        g.arc(b.x, b.y, b.r + 4 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampN(stamina, 0, 1))
        g.strokePath()
      }
      if (relayout) {
        label.setScale(1).setText(def.label[lang]).setFontSize(Math.round(Math.max(9 * u, b.r * (main ? 0.25 : 0.27))))
        // Long labels shrink to fit the disc.
        const maxW = b.r * 1.7
        if (label.width > maxW) label.setScale(maxW / label.width)
        keyT.setText(b.key ? keyLabel(b.key) : '').setFontSize(Math.round(Math.max(8 * u, b.r * 0.2)))
      }
      label.setPosition(b.x, b.y + b.r * 0.42).setAlpha(a)
      if (!touch && b.key) {
        // Key cap at the disc's shoulder.
        const kw = Math.max(keyT.width + 8 * u, 16 * u)
        const kh = keyT.height + 2 * u
        const kx = b.x + b.r * 0.62
        const ky = b.y - b.r * 0.78
        g.fillStyle(0x000000, 0.3 * a)
        g.fillRoundedRect(kx - kw / 2, ky - kh / 2 + 1.5 * u, kw, kh, 4 * u)
        g.fillStyle(0xf2f5ff, 0.95 * a)
        g.fillRoundedRect(kx - kw / 2, ky - kh / 2, kw, kh, 4 * u)
        keyT.setPosition(kx, ky).setAlpha(a)
      } else keyT.setAlpha(0)
    }
  }

  /** Pause-gate read-out: the resume beat ("3", "2", "1") or PAUSED for the pause key / background. */
  private drawGate(): void {
    const beat = this.mode === 'play' ? pauseGate.beat() : null
    const label = beat ?? (this.paused && (pauseGate.has('user') || pauseGate.has('app')) ? this.s.paused : null)
    if (!label) {
      this.gateText?.setVisible(false)
      return
    }
    if (!this.gateText) this.gateText = this.text(beat ? 64 : 28, '#ffffff', '800', 'score').setDepth(9_000_000)
    this.gateText
      .setFontSize(Math.round((beat ? 64 : 28) * this.hudU))
      .setText(label)
      .setVisible(true)
      .setPosition(this.scale.width / 2, this.hudTop + (this.scale.height - this.hudTop) / 2)
  }

  /** Feeds stored input frames (each at its recorded dt) so a goal reel reproduces the moment exactly. */
  private stepReel(dt: number): void {
    const r = this.reel
    if (!r) return
    const rt = this.rt
    r.acc += dt
    for (let n = 0; n < 8 && !rt.finished; n++) {
      const f = r.frames[r.i]
      if (!f) {
        // Recording ran out before the moment ended: let it play out with no input.
        applyInput(rt, { move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null }, r.acc)
        r.acc = 0
        break
      }
      if (r.acc + 1e-9 < f.dt) break
      if (f.move) r.move = f.move
      if (f.sprint !== undefined) r.sprint = f.sprint
      if (f.aim !== undefined) r.aim = f.aim
      applyInput(rt, { move: r.move, sprint: r.sprint, actions: f.actions ?? [], aim: r.aim }, f.dt)
      r.acc -= f.dt
      r.i++
    }
  }

  // ───────────────────────── Set-piece picker ─────────────────────────

  /** Opens / feeds / closes the corner or wall picker and merges its choice into this frame's input. */
  private updatePicker(dt: number, intent: FrameIntent): void {
    const rt = this.rt
    this.pickerCooldown = Math.max(0, this.pickerCooldown - dt)
    if (rt.pendingChoice && !this.auto && !this.picker && rt.phase === 'live') this.openPicker(rt.pendingChoice)
    if (this.picker) {
      this.pollPickerPad()
      this.framePicker()
      // The choice (if any) is the only input the stopped clock takes.
      intent.actions = this.pickerOut.splice(0, this.pickerOut.length)
      if (!rt.pendingChoice) {
        this.closePicker()
        this.pickerCooldown = 0.35
      }
    } else if (this.pickerCooldown > 0) {
      intent.actions = []
    }
  }

  private openPicker(mode: 'corner' | 'wall'): void {
    const host = this.game.canvas.parentElement
    if (!host) return
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    const st = new PickerState(mode, this.wallRightIsPlus())
    const pad = typeof navigator !== 'undefined' && !!navigator.getGamepads && Array.from(navigator.getGamepads()).some((p) => p && p.connected)
    const dom = new PickerDom(host, st, this.data0.opts.lang, pad, (a) => this.pickerOut.push(a), () => {
      if (st.mode === 'wall') this.rt.previewWall(st.wall)
    })
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT')) return
      // Buttons handle their own Enter/Space when focused.
      if (tgt && tgt.tagName === 'BUTTON' && dom.root.contains(tgt) && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) return
      if (e.repeat) return
      const input = keyToPickerInput(e.code, st.mode)
      if (!input) return
      e.preventDefault()
      dom.feed(input)
    }
    window.addEventListener('keydown', onKey)
    this.picker = { st, dom, padPrev: [], onKey }
  }

  private closePicker(): void {
    const p = this.picker
    if (!p) return
    window.removeEventListener('keydown', p.onKey)
    p.dom.dispose()
    this.picker = null
  }

  private pollPickerPad(): void {
    const p = this.picker
    if (!p || typeof navigator === 'undefined' || !navigator.getGamepads) return
    const gp = Array.from(navigator.getGamepads()).find((x) => x && x.connected)
    if (!gp) return
    const now = gp.buttons.map((b) => b.pressed || b.value > 0.4)
    for (const input of padToPickerInputs(p.padPrev, now, p.st.mode)) p.dom.feed(input)
    p.padPrev = now
  }

  /**
   * Camera while choosing: ball, target (corner zone / wall) and goal in one
   * frame, kept clear of the picker (bottom for corners, top for the wall,
   * since our goal is at the bottom of the screen).
   */
  private framePicker(): void {
    const p = this.picker
    const rt = this.rt
    const sp = rt.setPiece
    if (!p || !sp) return
    const fk = p.st.mode === 'wall'
    const canvas = this.game.canvas
    const rect = canvas.getBoundingClientRect()
    const k = this.scale.height / Math.max(1, rect.height)
    p.dom.place(fk ? (this.hudTop / k) + 8 : null)
    const ph = (p.dom.root.offsetHeight + 16) * k
    const land = fk ? wallGeometry(sp.spot).anchor : rt.cornerTarget(p.st.corner.zone) ?? sp.spot
    const goal = { x: fk ? 0 : PITCH_LENGTH, y: GOAL_CENTER_Y, halfWidth: 3.66, height: 2.44 }
    const vh = this.scale.height - this.hudTop
    const f = crossCamFit(sp.spot, land, goal, { w: this.scale.width, h: Math.max(120, vh - ph) }, this.cam.base)
    const zoom = this.cam.base * f.zoomMult
    this.crossCam = { fx: f.x, fy: f.y + ((fk ? -1 : 1) * ph) / (2 * zoom), zoomMult: f.zoomMult, until: rt.time + 1 }
  }

  /** True when "→" on screen moves the wall toward the middle of the goal (+ nudge). */
  private wallRightIsPlus(): boolean {
    const sp = this.rt.setPiece
    if (!sp) return true
    const { anchor, across } = wallGeometry(sp.spot)
    const a = project(anchor.x, anchor.y)
    const b = project(anchor.x + across.x, anchor.y + across.y)
    return Math.abs(b.x - a.x) > 1e-3 ? b.x > a.x : b.y > a.y
  }

  /** Picker preview on the pitch: the corner's target zone. */
  private drawPickerPreview(g: Phaser.GameObjects.Graphics): void {
    const p = this.picker
    if (!p || p.st.mode !== 'corner') return
    const t = this.rt.cornerTarget(p.st.corner.zone)
    const sp = this.rt.setPiece
    if (!t || !sp) return
    const pulse = this.rm ? 0.8 : 0.6 + 0.4 * Math.abs(Math.sin(this.elapsed * 4))
    const c = project(t.x, t.y)
    const from = project(sp.spot.x, sp.spot.y)
    g.lineStyle(0.1 * PPM, 0xffd23f, 0.55)
    g.lineBetween(from.x, from.y, c.x, c.y)
    g.fillStyle(0xffd23f, 0.18 * pulse)
    g.fillEllipse(c.x, c.y, 3.2 * PPM, 3.2 * PPM * TILT)
    g.lineStyle(0.12 * PPM, 0xffd23f, pulse)
    g.strokeEllipse(c.x, c.y, 3.2 * PPM, 3.2 * PPM * TILT)
  }

  /** Team-mate positions (meter scheme: tapping a team-mate stays a pass). */
  private matePositions(): { x: number; y: number }[] {
    const out = this.matesBuf
    out.length = 0
    for (const a of this.rt.agents) if (a.team === 'hero' && !a.isHero) out.push(a.pos)
    return out
  }
  private readonly matesBuf: { x: number; y: number }[] = []

  private afterPlay(): void {
    const rt = this.rt
    if (!this.reel) this.recordThisMoment()
    // Bug reports (plan 2.1#34): the kicks of the moment just played as {t, dx, dy, curve, lift}.
    const kicks = this.inputRec.kicks()
    const hl = this.data0.highlight
    setReportAttachment('last moment kicks', () => JSON.stringify({ highlight: hl.id, kind: hl.kind, minute: hl.minute, kicks }))
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
    if (r?.outcome === 'goal' && !this.data0.replayOnly && !this.reel && (!r.scorerId || r.scorerId === rt.hero.id)) {
      queueGoalReplay(hl.minute, this.inputRec.toRecording(hl.id, { aimAssist: rt.assist, slowMoAim: rt.slowMoAim, difficulty: this.data0.opts.difficulty, weather: this.data0.opts.weather, importance: this.data0.opts.importance, timingMult: rt.timingMult }), hl)
    }
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
    const t0 = frames[0]!.t
    const t1 = frames[frames.length - 1]!.t
    const kT = keyT > 0 ? keyT : t1 - 1.2
    const ro = this.data0.replayOnly
    const goal = ro ? ro.outcome === 'goal' || ro.outcome === 'conceded' || ro.outcome === 'assist' : this.rt.goalTime > 0
    // Which goal the action heads for: where the ball is at the key moment.
    const kf = frames.reduce((a, f) => (Math.abs(f.t - kT) < Math.abs(a!.t - kT) ? f : a), frames[0])!
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
        tier: rt.result?.tier,
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
    this.drawDropZone()
    this.updateNets(dt)
    this.updateCamera(dt, bx, by, bz, false)
  }

  /**
   * Team-mates the on-the-ball frame keeps in view: the game's two best pass options plus the freest man ahead (the
   * switch / the runner the moment is built around — playtest: they were off screen, nobody to tap).
   */
  private frameMates(mates: readonly Agent[]): Vec2[] {
    const rt = this.rt
    // Forward options only when there are some (playtest: the counter 2v1 framed the back pass, the runner off screen).
    const all = rt.passOptions().map((id) => mates.find((m) => m.id === id)).filter((m): m is Agent => !!m)
    const fwd = all.filter((m) => m.pos.x > rt.hero.pos.x - 4)
    const opts = (fwd.length ? fwd : all).slice(0, 2)
    const opp = rt.agents.filter((a) => a.team === 'opp')
    const free = (m: Agent) => Math.min(...opp.map((o) => dist(o.pos, m.pos)))
    const ahead = mates
      .filter((m) => !opts.includes(m) && m.pos.x > rt.hero.pos.x - 3 && dist(m.pos, rt.hero.pos) < 45)
      .sort((p, q) => free(q) + (q.pos.x - rt.hero.pos.x) * 0.15 - (free(p) + (p.pos.x - rt.hero.pos.x) * 0.15))[0]
    return [...opts, ...(ahead ? [ahead] : [])].map((m) => m.pos)
  }

  /** Last landing read of a ball in the air (refreshed ~10× a second). */
  private drop: { x: number; y: number; t: number; at: number } | null = null

  /**
   * Drop zone: where a ball in the air near the hero comes down, a pulsing ring that tightens as it lands (NSS / FIFA
   * show it; playtest: long balls and crosses could not be read). Only for balls he can get to (≤ 26 m).
   */
  private drawDropZone(): void {
    const rt = this.rt
    const g = this.dropG
    g.clear()
    if (this.mode !== 'play' || rt.phase !== 'live' || rt.heroIsKeeper) {
      this.drop = null
      return
    }
    if (!this.drop || this.elapsed - this.drop.at > 0.1) {
      const l = rt.dropZone()
      this.drop = l ? { ...l, at: this.elapsed } : null
    }
    const d = this.drop
    if (!d) return
    const left = d.t - (this.elapsed - d.at)
    if (left < -0.2 || Math.hypot(d.x - rt.hero.pos.x, d.y - rt.hero.pos.y) > 26) return
    const p = project(d.x, d.y)
    const r = (0.9 + Math.max(0, Math.min(1.5, left)) * 0.9) * PPM
    const pulse = this.rm ? 1 : 0.75 + 0.25 * Math.sin(this.elapsed * 10)
    g.lineStyle(Math.max(2, 0.14 * PPM), 0xffd23f, 0.9 * pulse)
    g.strokeEllipse(p.x, p.y, r * 2, r * 2 * TILT)
    g.fillStyle(0xffd23f, 0.22 * pulse)
    g.fillEllipse(p.x, p.y, 0.7 * PPM * 2, 0.7 * PPM * 2 * TILT)
  }

  private drawPlayer(v: PlayerView, x: number, y: number, z: number, facing: number, state: string, stateT: number, dt: number, pose?: CelebrationPose): void {
    const p = project(x, y)
    v.c.setPosition(p.x, p.y)
    v.c.setDepth(depthFor(x, v.agent.isHero ? 0.2 : 0))
    const moved = Math.hypot(p.x - v.lastX, p.y - v.lastY)
    v.lastX = p.x
    v.lastY = p.y
    // Teleports (replay cuts) never animate a sprint.
    const step = moved > 3 * PPM ? 0 : moved
    const speedM = dt > 0 ? step / PPM / dt : 0
    // One stride cycle per ~2.3 m.
    v.phase = (v.phase + step / PPM / 2.3) % 1
    v.kickT += dt
    v.headT += dt
    v.catchT += dt
    const fd = pitchDirToScreen(Math.cos(facing), Math.sin(facing))
    const [gx, gy] = groundDir(fd.x, fd.y)
    const moving = speedM > 0.7
    // Walk (4 frames) below jogging pace, run (8) above; idle breathes over 3 frames (2.2#24).
    const runFrame = (speedM < WALK_MAX_SPEED ? `walk${Math.floor(v.phase * 2 * WALK_FRAMES) % WALK_FRAMES}` : `run${Math.floor(v.phase * 8) % 8}`) as FigPose
    const idleFrame = `idle${Math.floor(this.elapsed * 1.6 + v.phase * IDLE_FRAMES) % IDLE_FRAMES}` as FigPose
    let frame: FigPose = moving ? runFrame : v.agent.isKeeper ? 'ready' : this.rm ? 'idle' : idleFrame
    let lift = z
    let rot = 0
    let shadowLen = 1
    if (state === 'slide') {
      frame = 'slide'
      shadowLen = 1.4
    } else if (state === 'dive') frame = 'dive'
    else if (state === 'down') {
      frame = 'down'
      lift = 0
      shadowLen = 1.4
    } else if (state === 'jump') frame = 'jump'
    else if (state === 'wall') frame = 'wall'
    else if (state === 'celebrate') {
      frame = 'up'
      lift += this.rm ? 0 : Math.abs(Math.sin(stateT * 9)) * 0.3
    } else if (state === 'skill') rot = this.rm ? 0 : Math.sin(stateT * 18) * 0.1
    else if (v.headT < 0.32) frame = 'jump'
    else if (v.kickT < 0.3) frame = v.kickT < 0.07 ? `kick_${v.kickStyle}0` : `kick_${v.kickStyle}1`
    else if (v.agent.isKeeper && v.catchT < 0.7) frame = 'catch'
    // Pass-to-me: the hero's arm goes up for a moment after calling (WP-14).
    if (v.agent.isHero && this.mode === 'play' && state === 'run' && this.rt.heroCallAt >= 0 && this.rt.time - this.rt.heroCallAt < 0.9) frame = 'call'
    let customArms: CelebrationPose['arms'] = 'none'
    if (pose) {
      rot = pose.rot
      lift = pose.lift
      if (!pose.legs) frame = pose.torsoZ !== null ? 'kneel' : 'tuck'
      else if (pose.arms === 'out' || pose.arms === 'up' || pose.arms === 'point') frame = pose.arms
      else if (pose.arms === 'kick') frame = 'kick2'
      else if (pose.arms !== 'none') {
        frame = 'bare'
        customArms = pose.arms
      }
    }
    v.rig.set(frame, gx, gy, zpx(lift), rot)

    // Shadows on the grass: contact blob + cast shadows (sun or floodlights).
    const air = clampN(1 - z * 0.45, 0.25, 1)
    const flat = frame === 'dive' || frame === 'down' || frame === 'slide'
    const blobW = (flat ? 1.9 : 1.0) * PPM
    v.shadow.setPosition(p.x, p.y).setScale(blobW / 64, ((0.62 * PPM) / 32) * TILT).setAlpha(0.85 * air)
    for (let i = 0; i < v.casts.length; i++) {
      const c = v.casts[i]!
      let ang = 0.62
      let al = 0.3
      if (this.night && this.lightSrc.length) {
        // Away from the floodlight towers.
        const L = this.lightSrc[i % this.lightSrc.length]!
        ang = Math.atan2(p.y - L.y, p.x - L.x)
        al = 0.2
      }
      const len = (1.55 * shadowLen + z * 0.4) * FIG_SCALE * PPM
      c.setPosition(p.x, p.y).setRotation(ang).setScale(len / 64, (0.5 * PPM) / 16).setAlpha(al * air)
    }

    // Facing chevron on the grass.
    const tipD = 0.82 * PPM
    v.chev.setPosition(fd.x * tipD, fd.y * tipD).setRotation(Math.atan2(fd.y, fd.x)).setVisible(frame !== 'down' && this.mode !== 'replay')
    if (v.ring) {
      const pulse = this.rm ? 1 : 1 + Math.sin(this.elapsed * 5) * 0.08
      v.ring.setScale(((2.0 * PPM) / 128) * pulse, ((2.0 * PPM) / 128) * TILT * pulse)
      v.ring.setAlpha(this.mode === 'play' ? (this.rt.heroOnBall ? 0.95 : 0.65) : 0.35)
      if (this.ring2) this.ring2.setScale(((2.7 * PPM) / 128) * pulse, ((2.7 * PPM) / 128) * TILT * pulse).setAlpha(this.mode === 'play' ? 0.75 : 0.3)
    }

    // Custom celebration arms over a bare-armed frame.
    if (!v.arms) return
    const ag = v.arms
    if (customArms === 'none') {
      if (ag.getData('on')) ag.clear().setData('on', false)
      return
    }
    ag.clear().setData('on', true)
    const torsoZ = SHOULDER_Z - 0.12 + lift
    const headZ = HEAD_Z + lift
    const arms = customArms
    const kitA = this.kitFor(v.agent)
    const sy = -zpx(torsoZ + 0.12)
    const sw = 0.24 * PPM
    const hand = colorNum(v.rig.skinHex)
    ag.lineStyle(0.13 * PPM, colorNum(kitA.primary), 1)
    const arm = (x0: number, y0: number, x1: number, y1: number) => {
      ag.lineBetween(x0, y0, x1, y1)
      ag.fillStyle(hand, 1)
      ag.fillCircle(x1, y1, 0.07 * PPM)
    }
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const R = (px: number, py: number) => ({ x: px * c - py * s, y: px * s + py * c })
    if (arms === 'mouth') {
      arm(sw, sy, 0.02 * PPM, -zpx(headZ - 0.12))
      ag.lineStyle(0.05 * PPM, 0xffffff, 0.9)
      ag.lineBetween(0, -zpx(headZ + 0.05), 0, -zpx(headZ - 0.2))
    } else if (arms === 'chest') {
      arm(sw, sy, 0.02 * PPM, -zpx(torsoZ - 0.25))
      arm(-sw, sy, -0.04 * PPM, -zpx(torsoZ - 0.28))
    } else if (arms === 'robotL' || arms === 'robotR') {
      // Stiff L-shaped arms: one elbow up, one elbow down, swapping on the beat.
      const up = arms === 'robotL' ? -1 : 1
      const elbowL = { x: -0.5 * PPM, y: sy }
      const elbowR = { x: 0.5 * PPM, y: sy }
      ag.lineBetween(-sw, sy, elbowL.x, elbowL.y)
      ag.lineBetween(sw, sy, elbowR.x, elbowR.y)
      arm(elbowL.x, elbowL.y, elbowL.x, sy - zpx(0.4) * up)
      arm(elbowR.x, elbowR.y, elbowR.x, sy + zpx(0.4) * up)
    } else if (arms === 'heart') {
      // Elbows out, hands meeting above the head: the arms frame a heart.
      const top = -zpx(headZ + 0.42)
      const elbowY = -zpx(headZ + 0.05)
      ag.lineBetween(-sw, sy, -0.5 * PPM, elbowY)
      ag.lineBetween(sw, sy, 0.5 * PPM, elbowY)
      arm(-0.5 * PPM, elbowY, -0.1 * PPM, top)
      arm(0.5 * PPM, elbowY, 0.1 * PPM, top)
      const hy = top - 0.32 * PPM
      ag.fillStyle(0xff3b5c, 1)
      ag.fillCircle(-0.11 * PPM, hy, 0.13 * PPM)
      ag.fillCircle(0.11 * PPM, hy, 0.13 * PPM)
      ag.fillTriangle(-0.235 * PPM, hy + 0.04 * PPM, 0.235 * PPM, hy + 0.04 * PPM, 0, hy + 0.3 * PPM)
    } else if (arms === 'hug') {
      // Arms crossed tight over the chest.
      const L = R(-sw, 0)
      const Rr = R(sw, 0)
      const lh = R(0.2 * PPM, -zpx(0.05))
      const rh = R(-0.2 * PPM, -zpx(0.12))
      const ty = -zpx(torsoZ - 0.2)
      // Dark under-stroke so the folded arms read against the shirt.
      ag.lineStyle(0.2 * PPM, 0x10131a, 0.55)
      ag.lineBetween(L.x, sy + L.y, lh.x, ty + lh.y)
      ag.lineBetween(Rr.x, sy + Rr.y, rh.x, ty + rh.y)
      ag.lineStyle(0.13 * PPM, colorNum(kitA.primary), 1)
      arm(L.x, sy + L.y, lh.x, ty + lh.y)
      arm(Rr.x, sy + Rr.y, rh.x, ty + rh.y)
      ag.lineStyle(0.04 * PPM, 0xbfe6ff, 0.85)
      ag.lineBetween(-0.4 * PPM, -zpx(headZ + 0.2), -0.48 * PPM, -zpx(headZ + 0.35))
      ag.lineBetween(0.4 * PPM, -zpx(headZ + 0.2), 0.48 * PPM, -zpx(headZ + 0.35))
    }
  }

  private drawBall(x: number, y: number, z: number, speed: number, dt: number): void {
    const g = project(x, y, 0)
    const b = project(x, y, z)
    this.ballShadow.setPosition(g.x, g.y).setAlpha(clampN(0.85 - z * 0.12, 0.2, 0.85))
    const sh = 1 + z * 0.12
    this.ballShadow.setScale(((0.5 * PPM) / 64) * sh, ((0.5 * PPM) / 32) * TILT * 0.5 * sh)
    this.ballShadow.setDepth(depthFor(x, -0.4))
    const scale = (BALL_D / 64) * (1 + z * 0.06)
    // Spin: the pattern rolls with the ball's ground speed; the lighting overlay stays put.
    const prev = this.trail.length ? this.trail[this.trail.length - 1] : null
    const sdx = prev ? b.x - prev.x : 0
    this.ballImg.rotation += ((speed * dt) / 0.11) * 0.15 * (Math.abs(sdx) > 0.01 ? Math.sign(sdx) : Math.sign(this.rt.ball.vx || 1))
    // At the feet the ball draws over the player just behind it, so a dribble never hides it.
    const depth = z > 2.1 ? 3_000_000 : depthFor(z < 0.6 ? x - 1.1 : x, 0.5)
    this.ballImg.setPosition(b.x, b.y).setScale(scale).setDepth(depth)
    this.ballShade.setPosition(b.x, b.y).setScale(scale).setDepth(depth + 0.001)
    this.ballRim?.setPosition(b.x, b.y).setScale(scale).setDepth(depth + 0.002)
    this.ballHalo?.setPosition(b.x, b.y).setScale((scale * 64 * 2.2) / 128).setDepth(depth - 0.003)
    // Motion blur: fading ghosts along the recent path of a fast ball.
    const blur = clampN((speed - 9) / 14, 0, 1)
    this.trail.push({ x: b.x, y: b.y })
    if (this.trail.length > 14) this.trail.shift()
    const n = this.trail.length
    for (let i = 0; i < this.ballGhosts.length; i++) {
      const gh = this.ballGhosts[i]!
      const k = n - 2 - i
      if (blur <= 0 || k < 0) {
        gh.setVisible(false)
        continue
      }
      const q = this.trail[k]!
      gh.setVisible(true).setPosition(q.x, q.y).setScale(scale * (1 - i * 0.08)).setAlpha(blur * (0.42 - i * 0.12)).setDepth(depth - 0.002 - i * 0.001)
    }
    // Trail ribbon for real shots (gold tint on the hero's hard strikes).
    this.trailG.clear()
    this.trailG.setDepth(depth - 0.01)
    if (speed > 15 && n > 2) {
      const col = this.lastKickHero && speed > 24 ? 0xffe38a : 0xffffff
      for (let i = 1; i < n; i++) {
        const t = i / n
        this.trailG.lineStyle(BALL_D * 0.8 * t, col, 0.3 * t * Math.min(1, (speed - 15) / 10))
        this.trailG.lineBetween(this.trail[i - 1]!.x, this.trail[i - 1]!.y, this.trail[i]!.x, this.trail[i]!.y)
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
    // Composure ring (2.2#15): the bullet-time window closes as a ring shrinking around the ball.
    if (this.mode === 'play' && rt.bulletFrac > 0) {
      const bp = project(rt.ball.x, rt.ball.y)
      const rr = composureRingRadius(rt.bulletFrac) * PPM
      const warn = rt.bulletFrac < 0.25
      g.lineStyle(0.16 * PPM, 0x000000, 0.3)
      g.strokeEllipse(bp.x, bp.y, rr * 2, rr * 2 * TILT, 32)
      g.lineStyle(0.09 * PPM, warn ? 0xffb02e : 0x9fe8ff, 0.9)
      g.strokeEllipse(bp.x, bp.y, rr * 2, rr * 2 * TILT, 32)
    }
    // Aim preview: dotted predicted path.
    const pv = rt.preview()
    const showPath = previewVisible(rt.difficulty, rt.assist)
    this.speedText?.setAlpha(0)
    if (pv) {
      const shot = pv.kind === 'shot' || pv.kind === 'chip' || pv.kind === 'penalty' || pv.kind === 'freekick'
      const col = shot ? 0xffd23f : 0xffffff
      // Vision (and technique) decide how much of the path the hero "sees" (2.1#20, 2.2#16); Hard/manual hide it.
      const tech = techniqueOf(hero.attrs)
      const n = showPath ? Math.max(2, Math.ceil(pv.points.length * previewFraction(hero.attrs.vision ?? 50, tech))) : 0
      // Continuous path under the dots (dark halo first so it reads on any grass/weather).
      if (n > 2) {
        for (const [w, c, al] of [[0.13, 0x000000, 0.3], [0.05, col, 0.55]] as const) {
          g.lineStyle(w * PPM, c, al)
          g.beginPath()
          const p0 = project(pv.points[0]!.x, pv.points[0]!.y, pv.points[0]!.z)
          g.moveTo(p0.x, p0.y)
          for (let i = 1; i < n; i++) {
            const q = project(pv.points[i]!.x, pv.points[i]!.y, pv.points[i]!.z)
            g.lineTo(q.x, q.y)
          }
          g.strokePath()
        }
      }
      // Pass target: the team-mate the ball is heading for (clearer the better the hero's vision).
      if (!shot) {
        const end = pv.points[pv.points.length - 1]!
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
        const pt = pv.points[i]!
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
      const land = showPath && LANDING_KINDS.has(pv.kind) ? firstLanding(pv.points) : -1
      if (land >= 0) {
        // Lofted balls: X at the first bounce inside a Technique error ellipse (2.2#18).
        const q = project(pv.points[land]!.x, pv.points[land]!.y)
        const er = landingErrorRadius(tech) * PPM
        g.fillStyle(0xffffff, 0.08)
        g.fillEllipse(q.x, q.y, er * 2, er * 2 * TILT)
        g.lineStyle(0.05 * PPM, 0xffffff, 0.55)
        g.strokeEllipse(q.x, q.y, er * 2, er * 2 * TILT)
        const xr = 0.45 * PPM
        for (const [w, c, al] of [[0.17, 0x000000, 0.45], [0.09, 0xffffff, 0.95]] as const) {
          g.lineStyle(w * PPM, c, al)
          g.lineBetween(q.x - xr, q.y - xr * TILT, q.x + xr, q.y + xr * TILT)
          g.lineBetween(q.x - xr, q.y + xr * TILT, q.x + xr, q.y - xr * TILT)
        }
      } else if (n > 0) {
        const last = pv.points[n - 1]!
        const lp = project(last.x, last.y, last.z)
        g.lineStyle(0.07 * PPM, col, 0.9)
        g.strokeEllipse(lp.x, lp.y, 0.9 * PPM, 0.9 * PPM * (shot ? 1 : TILT))
      }
      // Power ring around the hero (4 bands, 2.1#19 / 2.2#17).
      const pw = this.lastIntent?.power ?? pv.power
      this.drawPowerRing(g, hp.x, hp.y, pw, this.lastIntent?.oscillating ?? false)
      // Absolute launch speed at the ring (2.1#21): same power, same speed.
      if (shot && this.speedText) {
        const ms = shotSpeed(Math.min(1.15, pw), hero.attrs, pv.kind)
        const sp = this.worldToScreen(hp.x + 1.25 * PPM, hp.y - 1.25 * PPM * TILT)
        this.speedText.setText(speedLabel(ms)).setPosition(sp.x, sp.y).setAlpha(0.95)
      }
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
    // Released swipe: the ring holds the struck power for a moment (touch power feedback on release).
    const flash = !pv ? this.input0.releaseFlash() : null
    if (flash) this.drawPowerRing(g, hp.x, hp.y, flash.power, false, flash.alpha)
    // Vision: the best pass options the hero sees (count/range grow with Vision), when not aiming.
    if (!pv && getControlPrefs().visionHints) {
      const ids = rt.passOptions()
      const offs = ids.length ? rt.offsideMates() : null
      for (let i = 0; i < ids.length; i++) {
        const a = this.agentById(ids[i]!)
        if (!a) continue
        const bp = project(a.pos.x, a.pos.y)
        const r = Math.max(0.55, 0.95 - i * 0.12) * PPM
        // Offside target: red frame (2.1#60).
        g.lineStyle(0.08 * PPM, offs?.has(ids[i]!) ? 0xff3b3b : 0x5dff8a, Math.max(0.3, 0.75 - i * 0.12))
        g.strokeEllipse(bp.x, bp.y, r * 2, r * 2 * TILT, 20)
      }
    }
    // PASS target preview: the man the PASS button will find with the stick as it is now (intent, before the press).
    if (!pv && rt.heroOnBall && this.mode === 'play' && contextActions(rt.actionContext()).includes('pass')) {
      const id = rt.passButtonTarget(this.lastIntent?.move)
      const a = id ? this.agentById(id) : null
      if (a) {
        const bp = project(a.pos.x, a.pos.y)
        const bb = project(rt.ball.x, rt.ball.y)
        const pr = (1.05 + (this.rm ? 0 : Math.sin(this.elapsed * 6) * 0.08)) * PPM
        g.lineStyle(0.07 * PPM, 0xffd23f, 0.45)
        const n = 9
        for (let i = 0; i < n; i += 2) {
          const t0 = i / n
          const t1 = (i + 1) / n
          g.lineBetween(bb.x + (bp.x - bb.x) * t0, bb.y + (bp.y - bb.y) * t0, bb.x + (bp.x - bb.x) * t1, bb.y + (bp.y - bb.y) * t1)
        }
        g.lineStyle(0.12 * PPM, 0xffd23f, 0.95)
        g.strokeEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT, 24)
        g.fillStyle(0xffd23f, 0.16)
        g.fillEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT, 24)
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
        g.strokeEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT, 20)
        if (ot.armed) {
          g.fillStyle(0x9fe8ff, 0.18)
          g.fillEllipse(bp.x, bp.y, pr * 2, pr * 2 * TILT, 20)
        }
      }
    }

    // Keeper holds the ball: six-second rule countdown, swipe to distribute.
    if (rt.keeperHoldLeft > 0) {
      const tick = Math.ceil(rt.keeperHoldLeft)
      if (tick !== this.holdTick) {
        this.holdTick = tick
        this.floatText(`${this.s.holdHint} ${tick}`, hero.pos.x, hero.pos.y, '#ffd166', 0.9, 2.8)
      }
    } else this.holdTick = -1
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

  private drawPowerRing(g: Phaser.GameObjects.Graphics, x: number, y: number, power: number, oscillating = false, alpha = 1): void {
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
    const cb = getControlPrefs().cbMode !== 'off'
    g.lineStyle(0.18 * PPM, 0x000000, 0.35 * alpha)
    g.strokeEllipse(x, y, r * 2, r * 2 * TILT)
    for (let i = 0; i < steps * frac; i++) {
      const a0 = -Math.PI / 2 + (i / steps) * Math.PI * 2
      const a1 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2
      const pf = ((i + 1) / steps) * 1.15
      const band = powerBand(pf)
      g.lineStyle(0.16 * PPM, BAND_COLOR[band], 0.95 * alpha)
      g.lineBetween(x + Math.cos(a0) * r, y + Math.sin(a0) * r * TILT, x + Math.cos(a1) * r, y + Math.sin(a1) * r * TILT)
      // Colour-blind mode: a pattern per band so it reads without hue (2.2#17).
      if (cb && BAND_PATTERN[band] !== 'solid') {
        const pat = BAND_PATTERN[band]
        const am = (a0 + a1) / 2
        const cx = x + Math.cos(am) * r
        const cy = y + Math.sin(am) * r * TILT
        const nx = Math.cos(am) * 0.2 * PPM
        const ny = Math.sin(am) * 0.2 * PPM * TILT
        g.lineStyle(0.05 * PPM, 0x000000, 0.85)
        if (pat === 'ticks' && i % 3 === 0) g.lineBetween(cx - nx, cy - ny, cx + nx, cy + ny)
        else if (pat === 'dashes' && i % 2 === 0) g.lineBetween(x + Math.cos(a0) * r, y + Math.sin(a0) * r * TILT, cx, cy)
        else if (pat === 'hatch') {
          g.lineBetween(cx - nx - ny * 0.5, cy - ny + nx * 0.5, cx + nx + ny * 0.5, cy + ny - nx * 0.5)
          g.lineBetween(cx - nx + ny * 0.5, cy - ny - nx * 0.5, cx + nx - ny * 0.5, cy + ny + nx * 0.5)
        }
      }
    }
  }

  /** Slow-motion desaturation through a camera colour-matrix filter, active only while slowed; off on Low (2.2#14). */
  private applyDesaturation(slow: number): void {
    const amt = bulletDesaturation(slow)
    if (amt <= 0.002 && !this.desat) return
    if (!this.desat) {
      if (!this.q.desaturate || this.game.renderer.type !== Phaser.WEBGL) return
      const f = this.cameras.main.filters?.internal.addColorMatrix()
      if (!f) return
      this.desat = { f, amt: -1 }
    }
    const d = this.desat
    if (Math.abs(d.amt - amt) < 0.01) return
    d.amt = amt
    d.f.active = amt > 0.002
    d.f.colorMatrix.saturate(-amt)
  }

  private updateNets(dt: number): void {
    for (const end of ['east', 'west'] as const) {
      const r = this.ripple[end]
      if (!r) continue
      r.t += dt
      if (r.cloth) stepCloth(r.cloth, dt)
      const over = r.cloth ? clothSettled(r.cloth) : r.t > 2
      this.netG[end].clear()
      drawGoal(this.netG[end], end, 'net', over ? null : r)
      const b = this.baked.find((e) => e.g === this.netG[end])
      if (over) this.ripple[end] = null
      // Live Graphics while rippling; back to the cached image once it settles.
      this.netG[end].setVisible(!!this.ripple[end] || !b?.img)
      if (b?.img) b.img.setVisible(!this.ripple[end])
    }
  }

  // ───────────────────────── Static Graphics cache ─────────────────────────

  private bakeLater(g: Phaser.GameObjects.Graphics, box: BakeBox, extra?: BakeExtra): void {
    this.baked.push({ g, key: `bake_${bakeSeq++}`, box, img: null, scale: 0, extra })
  }

  /**
   * (Re)draws every static Graphics into its own texture at a resolution that
   * matches the current zoom (with headroom for zoom punches / replays), then
   * shows the texture instead of the Graphics. Runs at start and when the
   * zoom changes a lot (resize / orientation).
   */
  private bakeStatics(): void {
    const renderer = this.game.renderer as { getMaxTextureSize?: () => number }
    const maxTex = Math.min(4096, renderer.getMaxTextureSize?.() ?? 4096)
    const want = clampN(this.cam.base * 1.35, 0.3, 1)
    for (const e of this.baked) {
      if (e.img && Math.abs(e.scale - want) / Math.max(want, 1e-3) < 0.2) continue
      const a = project(e.box.x1, e.box.y0, e.box.z ?? 0)
      const b = project(e.box.x0, e.box.y1, 0)
      const x0 = Math.floor(Math.min(a.x, b.x))
      const y0 = Math.floor(Math.min(a.y, b.y))
      const w = Math.ceil(Math.max(a.x, b.x)) - x0
      const h = Math.ceil(Math.max(a.y, b.y)) - y0
      const s = Math.min(want, maxTex / Math.max(w, h))
      const tw = Math.max(2, Math.ceil(w * s))
      const th = Math.max(2, Math.ceil(h * s))
      if (e.img) {
        e.img.destroy()
        e.img = null
      }
      if (this.textures.exists(e.key)) this.textures.remove(e.key)
      const tex = this.textures.addDynamicTexture(e.key, tw, th)
      if (!tex) continue
      const { g } = e
      const alpha = g.alpha
      g.setVisible(true).setAlpha(1).setScale(s)
      tex.draw(g, -x0 * s, -y0 * s)
      const ex = e.extra
      if (ex?.grain) {
        const ts = (ex.grain.tileM * PPM * s) / 128
        tex.repeat(ex.grain.key, undefined, 0, 0, tw, th, { alpha: ex.grain.alpha, tileScaleX: ts, tileScaleY: ts * TILT } as unknown as Phaser.Types.GameObjects.TileSprite.TileSpriteConfig)
      }
      if (ex?.post) {
        ex.post.setVisible(true).setScale(s)
        tex.draw(ex.post, -x0 * s, -y0 * s)
        ex.post.setScale(1).setVisible(false)
      }
      tex.render()
      g.setPosition(0, 0).setScale(1).setAlpha(alpha).setVisible(false)
      const img = this.add.image(x0, y0, e.key).setOrigin(0, 0).setScale(w / tw, h / th).setDepth(g.depth).setAlpha(alpha).setBlendMode(g.blendMode)
      this.addW(img)
      e.img = img
      e.scale = s
    }
    // A net mid-ripple keeps its live Graphics.
    for (const end of ['east', 'west'] as const) {
      const b = this.baked.find((e) => e.g === this.netG[end])
      if (b?.img && this.ripple[end]) {
        b.img.setVisible(false)
        this.netG[end].setVisible(true)
      }
    }
  }

  private updateCamera(dt: number, bx: number, by: number, bz: number, replay: boolean, target?: { x: number; y: number; zoom: number }): void {
    const rt = this.rt
    let tx: number
    let ty: number
    if (this.debugCam) target = this.debugCam
    const w = this.scale.width
    const h = this.scale.height - this.hudTop - this.promptReserve() - this.thumbReserve()
    // Moment-start framing (2.2#4): ease in 350 ms to ball + hero + 3 pass options, hold until play starts.
    const open = !target && !replay && this.mode === 'play' ? this.openCamStep() : null
    if (open) {
      this.cam.x = open.x
      this.cam.y = open.y
      this.cam.zoom = open.zoom
      this.camSpring = newSpring(open.x, open.y)
    } else if (target) {
      tx = target.x
      ty = target.y
    } else {
      // Target in pitch space: ball + lean toward the action.
      let px = bx
      const py = by
      const cc = !replay && this.crossCam && !rt.owner && rt.time < this.crossCam.until ? this.crossCam : null
      if (!cc) this.crossCam = null
      let lead = { x: 0, y: 0 }
      if (!cc && !replay) {
        if (rt.heroIsKeeper && (rt.kind === 'gk_claim' || rt.kind === 'gk_distribution')) {
          // Keeper with the ball in hands, or a cross dropping into his box: keep him on screen above the
          // touch buttons, framing the ball (and the runners upfield) with him.
          px = rt.kind === 'gk_distribution' ? rt.hero.pos.x + 11 : Math.min(Math.max(bx, rt.hero.pos.x), rt.hero.pos.x + 14) * 0.5 + rt.hero.pos.x * 0.5 + 6
        } else {
          // On the ball in range: frame the goal mouth too (playtester: a corner you cannot see cannot be aimed at).
          const toGoal = PITCH_LENGTH - bx
          if (rt.heroOnBall) px += rt.heroIsKeeper || toGoal > GOAL_FRAME_RANGE ? 5 : clampN(toGoal * 0.3, 5, 7.5)
          if (rt.heroIsKeeper) px += 7
        }
        // Look-ahead (2.2#3): 18 % of the screen along the carrier's run (the ball's flight when loose).
        const carrier = rt.owner
        lead = lookAheadOffset(carrier ? carrier.vel : { x: rt.ball.vx, y: rt.ball.vy }, { w, h }, this.cam.zoom)
      }
      const b = cc ? { x: cc.fx, y: cc.fy } : project(px, py, bz * 0.5)
      tx = b.x + lead.x
      ty = b.y + lead.y
      // On the ball (playtest: a team-mate to tap or the goal to aim at was off screen): frame the two best
      // pass options and, in range, the goal mouth with the ball. Pulls back as far as the moment framing does.
      this.attnZoom = 1
      // (The taker standing over a set piece counts: on a free kick the goal was under the score bar.)
      const taking = !!rt.setPiece && rt.setPiece.takerId === rt.hero.id && !rt.owner
      if (!cc && !replay && (rt.heroOnBall || taking) && !rt.heroIsKeeper) {
        const mates = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
        const toGoal = PITCH_LENGTH - bx
        // In shooting range the goal is what he looks at: ball and both posts, closer in (NSS: the goal fills the
        // view when you shoot). Further out: the two best pass options (and the goal if in range).
        const shooting = toGoal < SHOT_FRAME_RANGE
        const pts = shooting
          ? [{ x: PITCH_LENGTH + 1.2, y: GOAL_CENTER_Y - GOAL_WIDTH / 2 - 1 }, { x: PITCH_LENGTH + 1.2, y: GOAL_CENTER_Y + GOAL_WIDTH / 2 + 1 }]
          : this.frameMates(mates)
        if (!shooting && toGoal < GOAL_FRAME_RANGE) pts.push({ x: PITCH_LENGTH + 1.5, y: GOAL_CENTER_Y })
        if (pts.length) {
          const f = momentFrame(rt.ball, rt.hero.pos, pts, { w, h }, this.cam.base, shooting ? SHOT_FRAME_MAX_ZOOM : 1, ON_BALL_MIN_ZOOM)
          tx = f.x
          ty = f.y
          this.attnZoom = f.zoomMult
        }
      } else if (!cc && !replay && !rt.heroOnBall && dist(rt.hero.pos, rt.ball) > 8 && !(rt.heroIsKeeper && (rt.kind === 'gk_claim' || rt.kind === 'gk_distribution'))) {
        // Off the ball: he stays in the frame with the ball (playtest: after his pass the camera followed the
        // ball and he ran off the bottom of the screen, out of control).
        const f = momentFrame(rt.ball, rt.hero.pos, [], { w, h }, this.cam.base)
        tx = f.x
        ty = f.y
        this.attnZoom = f.zoomMult
      }
    }
    if (!open) {
      if (target || replay) {
        const k = 1 - Math.exp(-dt * (target ? 3 : 2.2))
        this.cam.x += (tx! - this.cam.x) * k
        this.cam.y += (ty! - this.cam.y) * k
        this.camSpring = newSpring(this.cam.x, this.cam.y)
      } else {
        // Live follow (2.2#2): critically damped spring, fixed 60 Hz, ≤ 1200 px/s on screen.
        const sp = this.camSpring ?? newSpring(this.cam.x, this.cam.y)
        sp.x = this.cam.x
        sp.y = this.cam.y
        springStep(sp, tx!, ty!, dt, this.cam.zoom)
        this.camSpring = sp
        this.cam.x = sp.x
        this.cam.y = sp.y
      }
      this.cam.punch *= Math.exp(-dt * 5)
      if (this.rm) this.cam.punch = 0
      const bulletZoom = !this.rm && this.mode === 'play' && rt.timeScale < 0.95 ? (1 - rt.timeScale) * 0.12 : 0
      // Keeper distribution / claiming: pull back so the options upfield (or the runners in the box) are in view.
      const keeperZoom = !target && !replay && rt.heroIsKeeper ? (rt.kind === 'gk_distribution' ? 0.7 : rt.kind === 'gk_claim' ? 0.85 : 1) : 1
      const crossZoom = (this.crossCam && !target && !replay ? this.crossCam.zoomMult : 1) * keeperZoom * (!target && !replay ? this.attnZoom : 1)
      const targetZoom = target ? target.zoom : this.cam.base * crossZoom * (1 + this.cam.punch + bulletZoom + (replay && !this.rm ? 0.18 : 0))
      this.cam.zoom += (targetZoom - this.cam.zoom) * (1 - Math.exp(-dt * (target ? 2.6 : 4)))
    }
    // Clamp to the stadium: at most 6 m past the lines (2.2#7); wider views centre and show the stands.
    // (The view is not centred on cam.y: it shows `up` above and `down` below it — the thumb strip at the bottom is
    // pitch too. Playtest: a black band below the goal line in keeper moments.)
    const cs = this.camScreenY()
    const up = (cs - this.hudTop - this.promptReserve()) / this.cam.zoom
    const down = (this.scale.height - cs) / this.cam.zoom
    const c0 = clampCamera(this.cam.x, this.cam.y + (down - up) / 2, w / (2 * this.cam.zoom), (up + down) / 2)
    const c = { x: c0.x, y: c0.y - (down - up) / 2 }
    if (this.camSpring && (c.x !== this.cam.x || c.y !== this.cam.y)) {
      if (c.x !== this.cam.x) this.camSpring.vx = 0
      if (c.y !== this.cam.y) this.camSpring.vy = 0
      this.camSpring.x = c.x
      this.camSpring.y = c.y
    }
    this.cam.x = c.x
    this.cam.y = c.y
    const cam = this.cameras.main
    cam.setZoom(this.cam.zoom)
    // The score bar covers the top of the canvas: centre the frame in the part below it (playtest: on a free kick
    // the goal sat under the bar).
    cam.centerOn(this.cam.x, this.cam.y - (this.hudTop + this.promptReserve() - this.thumbReserve()) / (2 * this.cam.zoom))
  }

  /**
   * Screen strip at the bottom taken by the thumbs and the touch buttons (playtest: the hero sank under the
   * buttons). Phones in portrait only; 0 elsewhere.
   */
  private thumbReserve(): number {
    const ui = this.input0?.touchUi()
    if (!ui?.enabled || this.scale.width >= this.scale.height) return 0
    return Math.round(this.scale.height * THUMB_RESERVE)
  }

  /**
   * Moment-start framing state (2.2#4). Returns the camera pose while the
   * opening frame is active, null once play has started (ball moving, hero
   * acted) or after {@link OPEN_CAM_HOLD} s.
   */
  private openCamStep(): { x: number; y: number; zoom: number } | null {
    const o = this.openCam
    if (!o) return null
    const rt = this.rt
    const t = this.elapsed - o.t0
    const started = Math.hypot(rt.ball.vx, rt.ball.vy) > 4 || Math.hypot(rt.hero.vel.x, rt.hero.vel.y) > 1.5 || !!rt.aim || (this.lastIntent?.power ?? 0) > 0
    if (t > OPEN_CAM_HOLD || rt.setPiece || (t > MOMENT_FRAME_TIME && started)) {
      this.openCam = null
      return null
    }
    const e = easeOut(t / MOMENT_FRAME_TIME)
    const zoom = o.fromZoom + (this.cam.base * o.zoomMult - o.fromZoom) * e
    return { x: o.fromX + (o.x - o.fromX) * e, y: o.fromY + (o.y - o.fromY) * e, zoom }
  }

  /** Builds the opening frame from the current runtime state. */
  private startOpenCam(): void {
    const rt = this.rt
    if (rt.setPiece || this.data0.replayOnly) return
    const hero = rt.hero
    const ids = rt.passOptions()
    const mates = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
    const picked = ids.map((id) => mates.find((m) => m.id === id)).filter((m): m is Agent => !!m).slice(0, 3)
    const rest = nearestPoints(rt.ball, mates.filter((m) => !picked.includes(m)).map((m) => m.pos), 3 - picked.length)
    let opts = [...picked.map((m) => m.pos), ...rest]
    // On the ball within range of goal: the goal mouth is in the opening frame too (you aim at what you see).
    if (rt.heroOnBall && !rt.heroIsKeeper && PITCH_LENGTH - rt.ball.x < GOAL_FRAME_RANGE) opts.push({ x: PITCH_LENGTH, y: GOAL_CENTER_Y })
    // In shooting range the opening frame is the goal itself (playtest: a long shot struck in the first second went
    // at a goal still off screen).
    if (rt.heroOnBall && !rt.heroIsKeeper && PITCH_LENGTH - rt.ball.x < SHOT_FRAME_RANGE) {
      opts = [{ x: PITCH_LENGTH + 1.2, y: GOAL_CENTER_Y - GOAL_WIDTH / 2 - 1 }, { x: PITCH_LENGTH + 1.2, y: GOAL_CENTER_Y + GOAL_WIDTH / 2 + 1 }]
    }
    const h = this.scale.height - this.hudTop - this.promptReserve() - this.thumbReserve()
    const f = momentFrame(rt.ball, hero.pos, opts, { w: this.scale.width, h }, this.cam.base, 1, rt.heroOnBall ? ON_BALL_MIN_ZOOM : undefined)
    this.openCam = { x: f.x, y: f.y, zoomMult: f.zoomMult, t0: this.elapsed, fromX: this.cam.x, fromY: this.cam.y, fromZoom: this.cam.zoom }
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
    while (i < fr.length - 2 && fr[i + 1]!.t < rp.t) i++
    const f0 = fr[i]!
    const f1 = fr[Math.min(fr.length - 1, i + 1)]!
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
      const x = L(f0.agents[o]!, f1.agents[o]!)
      const y = L(f0.agents[o + 1]!, f1.agents[o + 1]!)
      const z = L(f0.agents[o + 2]!, f1.agents[o + 2]!)
      const facing = LA(f0.agents[o + 3]!, f1.agents[o + 3]!)
      const st = STATE_CODES[f1.agents[o + 4]!] ?? 'run'
      this.drawPlayer(this.views[k]!, x, y, z, facing, st, rp.t, dt * rate)
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
    const def = CELEBRATION_BY_ID[id]!
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
    if (this.q.glow) {
      const gp = project(target.x, target.y, 1)
      this.time.delayedCall(400, () => {
        const n = this.fxN(50, 2600)
        if (n > 0) this.confetti.explode(n, gp.x, gp.y)
      })
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
    this.drawPickerPreview(g)
    this.drawLabels()
    this.drawOppTag()
    this.drawEdgeMates()
  }

  /** Off-screen team-mates as tappable badges on the screen edge (screen px + where he is on the pitch). */
  private edgeMarks: { x: number; y: number; r: number; world: Vec2 }[] = []
  private edgeG: Phaser.GameObjects.Graphics | null = null
  private edgeTexts: Phaser.GameObjects.Text[] = []

  /** A tap on an edge badge is a tap on that team-mate (the pass goes to him). */
  private edgeMateAt(gx: number, gy: number): Vec2 | null {
    const m = this.edgeMarks.find((e) => Math.hypot(gx - e.x, gy - e.y) < e.r * 1.6)
    return m ? { ...m.world } : null
  }

  /**
   * Team-mates off the screen while he is on the ball: a badge with the shirt number on the edge, pointing at him
   * (playtest: a portrait phone shows ~30 m of the pitch's width; the winger to switch to, the runner in a 2v1 were
   * off screen with nothing to tap). Tapping it passes to him. At most four, nearest first.
   */
  private drawEdgeMates(): void {
    const rt = this.rt
    if (!this.edgeG) this.edgeG = this.addH(this.add.graphics().setDepth(40))
    const g = this.edgeG
    g.clear()
    this.edgeMarks = []
    for (const t of this.edgeTexts) t.setVisible(false)
    if (this.mode !== 'play' || rt.phase !== 'live' || !rt.heroOnBall || this.data0.replayOnly) return
    const u = this.ui
    const w = this.scale.width
    const left = 20 * u
    const right = w - 20 * u
    const top = this.hudTop + this.promptReserve() + 22 * u
    // Above the thumb buttons (playtest: a badge sat on DEPAR).
    const btnTop = Math.min(...this.input0.touchUi().buttons.map((b) => b.y - b.r), this.scale.height - this.thumbReserve())
    const bottom = btnTop - 22 * u
    const cx = w / 2
    const cy = this.camScreenY()
    const mates = rt.agents
      .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, rt.hero.pos) < 50)
      .sort((p, q) => dist(p.pos, rt.hero.pos) - dist(q.pos, rt.hero.pos))
    let n = 0
    for (const m of mates) {
      if (n >= 3) break
      const p = project(m.pos.x, m.pos.y)
      const s = this.worldToScreen(p.x, p.y)
      if (s.x > left && s.x < right && s.y > top && s.y < bottom) continue
      // Where the line from the centre to him leaves the play area.
      const dx = s.x - cx
      const dy = s.y - cy
      const k = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity)
      if (!Number.isFinite(k) || k <= 0) continue
      const x = cx + dx * k
      const y = cy + dy * k
      if (this.edgeMarks.some((e) => Math.hypot(e.x - x, e.y - y) < 30 * u)) continue
      const r = 15 * u
      const ang = Math.atan2(dy, dx)
      g.fillStyle(0x000000, 0.35)
      g.fillCircle(x + 1.5 * u, y + 2 * u, r)
      g.fillStyle(Phaser.Display.Color.HexStringToColor(this.data0.opts.heroTeamColors.primary).color, 0.95)
      g.fillCircle(x, y, r)
      g.lineStyle(2 * u, 0xffffff, 0.95)
      g.strokeCircle(x, y, r)
      // Arrow pointing off screen, toward him.
      const tip = { x: x + Math.cos(ang) * (r + 8 * u), y: y + Math.sin(ang) * (r + 8 * u) }
      const b1 = { x: x + Math.cos(ang + 0.5) * (r + 1 * u), y: y + Math.sin(ang + 0.5) * (r + 1 * u) }
      const b2 = { x: x + Math.cos(ang - 0.5) * (r + 1 * u), y: y + Math.sin(ang - 0.5) * (r + 1 * u) }
      g.fillStyle(0xffffff, 0.95)
      g.fillTriangle(tip.x, tip.y, b1.x, b1.y, b2.x, b2.y)
      let t = this.edgeTexts[n]
      if (!t) {
        t = this.addH(this.add.text(0, 0, '', { fontFamily: HUD_FONTS.score, fontSize: `${Math.round(15 * u)}px`, color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(41))
        this.edgeTexts[n] = t
      }
      t.setText(String(m.number)).setPosition(x, y).setVisible(true)
      this.edgeMarks.push({ x, y, r, world: { x: m.pos.x, y: m.pos.y } })
      n++
    }
  }

  /** The key opponent's tag, from the same matchup the moment card showed. */
  private buildOppTag(names: Record<string, string>): void {
    let mu: Matchup | null = null
    try { mu = momentMatchup(this.data0.highlight, names) } catch { mu = null }
    if (!mu || this.data0.replayOnly) return
    const view = this.views.find((v) => v.agent.id === mu!.opp.id)
    if (!view) return
    const attrs = mu.rows.slice(0, 2).map((r) => `${tr(`data.attrShort.${r.opp}`)} ${r.oppV}`).join('  ')
    const text = this.text(11, '#ffe9e9', '800').setDepth(8_000_000)
    const compact = `${mu.opp.name} · ${mu.opp.ovr}`
    this.oppTag = { text, view, compact, expanded: `${compact}
${attrs}`, open: false, box: null }
    text.setText(compact).setVisible(false)
    const canvas = this.game.canvas
    this.oppTagHandler = (e: PointerEvent) => {
      const tag = this.oppTag
      if (!tag?.box || !tag.text.visible) return
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) * (this.scale.width / Math.max(1, r.width))
      const y = (e.clientY - r.top) * (this.scale.height / Math.max(1, r.height))
      const pad = 10 * this.ui
      const b = tag.box
      if (x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad) {
        tag.open = !tag.open
        tag.text.setText(tag.open ? tag.expanded : tag.compact)
      }
    }
    canvas.addEventListener('pointerdown', this.oppTagHandler)
  }

  private drawOppTag(): void {
    const tag = this.oppTag
    if (!tag) return
    if (this.mode !== 'play' || this.labelsOn) {
      tag.text.setVisible(false)
      tag.box = null
      return
    }
    const v = tag.view
    const sp = this.worldToScreen(v.c.x, v.c.y - zpx(HEAD_Z + 0.9))
    const tt = tag.text
    const on = sp.y > this.hudTop + this.promptReserve() + 14 && sp.y < this.scale.height - 40
    tt.setVisible(on).setPosition(sp.x, sp.y).setAlpha(tag.open ? 1 : 0.88)
    tag.box = on ? { x0: sp.x - tt.width / 2, y0: sp.y - tt.height / 2, x1: sp.x + tt.width / 2, y1: sp.y + tt.height / 2 } : null
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
      const v = this.views[i]!
      const l = this.labels[i]!
      // Hero has the gold tag during play.
      if (v.agent.isHero && this.mode === 'play') {
        l.setVisible(false)
        continue
      }
      const wp = { x: v.c.x, y: v.c.y - zpx(HEAD_Z + 0.65) }
      const sp = this.worldToScreen(wp.x, wp.y)
      const lb = this.mode === 'replay' ? this.scale.height * 0.08 : this.hudTop
      l.setVisible(sp.y > lb + 6 && sp.y < this.scale.height - (this.mode === 'replay' ? lb : 0) - 4).setPosition(sp.x, sp.y).setAlpha(0.92)
    }
  }

  // ───────────────────────── Events & juice ─────────────────────────

  /** Camera shake (never under reduced motion). */
  private shake(ms: number, intensity: number): void {
    if (!this.rm) this.cameras.main.shake(ms, intensity)
  }

  /** Particle count for one burst: scaled by the quality profile and clamped to the scene's particle budget. */
  private fxN(n: number, lifeMs = 650): number {
    return this.fxBudget.take(n, lifeMs, this.time.now)
  }

  /** Explode only when the budget granted particles (explode(0) would emit the emitter default). */
  private burst(em: Phaser.GameObjects.Particles.ParticleEmitter, n: number, x: number, y: number): void {
    if (n > 0) em.explode(n, x, y)
  }

  private vibrate(ms: number, s = 0.6): void {
    if (this.data0.opts.settings.vibration) this.input0.rumble(ms, s)
  }

  private startRipple(end: 'east' | 'west', y: number, z: number, strength: number): void {
    const zz = clampN(z, 0.2, 2.2)
    // Verlet net (2.2#66) on Medium/High; Low keeps the analytic ripple.
    let cloth: NetCloth | undefined
    if (this.q.profile !== 'low' && !this.rm) {
      cloth = createCloth(PITCH_WIDTH / 2 - GOAL_WIDTH / 2, PITCH_WIDTH / 2 + GOAL_WIDTH / 2, NET_BACK_TOP)
      hitCloth(cloth, y, Math.min(zz, NET_BACK_TOP), strength * 1.6)
    }
    this.ripple[end] = { t: 0, y, z: zz, strength, cloth }
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
      // Animation clocks (render only): kick swing, header, held save.
      if (e.type === 'kick' || e.type === 'header' || (e.type === 'save' && e.held)) {
        const v = this.views.find((w) => w.agent.id === e.by)
        if (v) {
          if (e.type === 'kick') {
            v.kickT = 0
            v.kickStyle = kickStyleFor(e.kick, e.power, Math.abs(rt.ball.spin.side) / 40)
            this.lastKickHero = e.hero
          }
          else if (e.type === 'header') v.headT = 0
          else v.catchT = 0
        }
      }
      switch (e.type) {
        case 'kick': {
          this.sfx.kick(e.power, e.kick)
          if (e.hero) probeKick({ power: e.power, kick: e.kick })
          const p = project(e.x, e.y)
          this.burst(this.grassFx, this.fxN(e.hero ? 10 : 5), p.x, p.y)
          // Water kicks up off a wet pitch on contact (2.2#73).
          if (this.data0.opts.weather === 'rain') this.burst(this.puffFx, this.fxN(e.hero ? 5 : 3, 760), p.x, p.y)
          const shot = e.kick === 'shot' || e.kick === 'chip' || e.kick === 'penalty' || e.kick === 'freekick' || e.kick === 'header'
          if (e.hero) {
            this.cam.punch = this.rm ? 0 : shot ? 0.14 : 0.05
            if (shot) this.shake(90, 0.003)
            this.vibrate(shot ? 35 : 18)
            this.lastKeyT = rt.time
          }
          // Cross camera: a delivery into the box swings the camera toward where it drops.
          this.crossCam = null
          if ((e.kick === 'cross' || e.kick === 'lofted') && e.x > PITCH_LENGTH * 0.55 && rt.agents.find((a) => a.id === e.by)?.team === 'hero') {
            const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 4 })
            const drop = pts.find((q, i) => i > 0 && q.z < 2.2 && q.z < pts[i - 1]!.z) ?? pts[pts.length - 1]
            if (drop && drop.x > PITCH_LENGTH - 22) {
              const vp = this.cameras.main
              const f = crossCamFit({ x: e.x, y: e.y }, drop, { x: PITCH_LENGTH, y: GOAL_CENTER_Y, halfWidth: 3.66, height: 2.44 }, { w: vp.width, h: vp.height }, this.cam.base)
              this.crossCam = { fx: f.x, fy: f.y, zoomMult: f.zoomMult, until: rt.time + Math.min(2.5, drop.t + 0.4) }
            }
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
          // Spray off a wet pitch.
          if (this.data0.opts.weather === 'rain' && e.speed > 4) {
            const p = project(e.x, e.y)
            this.burst(this.puffFx, this.fxN(4, 760), p.x, p.y)
          }
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
            this.burst(this.confetti, this.fxN(90, 2600), gp.x, gp.y)
            this.time.delayedCall(250, () => this.burst(this.confetti, this.fxN(70, 2600), gp.x, gp.y - 2 * PPM))
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
          if (e.punch) this.floatText(this.s.punch, e.x, e.y, '#ffffff', 0.9, 3.4)
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
          if (e.slide) {
            this.burst(this.grassFx, this.fxN(14), p.x, p.y)
            this.burst(this.puffFx, this.fxN(6, 760), p.x, p.y)
          }
          if (e.won && e.by === rt.hero.id) this.vibrate(60)
          break
        }
        case 'shoulder': {
          // Shoulder-to-shoulder contact: a thud, dust when someone goes down, a buzz when the hero comes through it.
          this.sfx.scuff()
          const p = project(e.x, e.y)
          if (e.down) this.burst(this.puffFx, this.fxN(5, 760), p.x, p.y)
          if (e.by === rt.hero.id) this.vibrate(40)
          break
        }
        case 'foul': {
          // The card goes to the fouler (the hero, or the opponent who chopped our man down).
          const by = this.agentById(e.by) ?? rt.hero
          if (e.card) this.floatText(e.card === 'red' ? this.s.red : this.s.yellow, by.pos.x, by.pos.y, e.card === 'red' ? '#ff4040' : '#ffd23f', 1.6, 3.2)
          break
        }
        case 'keeperRead':
          // Tell-tale: the keeper studied your penalties; the hint sits on the side he is cheating to.
          this.floatText(e.zone === 1 ? this.s.keeperReadMid : this.s.keeperRead, e.x - 1.2, e.y + (e.zone === 0 ? -1.8 : e.zone === 2 ? 1.8 : 0), '#ffb86b', 2.2, 3.4)
          break
        case 'advantage':
          // Referee's arms out: play on; called back = whistle for the free kick.
          if (e.state === 'on') {
            this.floatText(`⇢ ${this.s.advantage}`, e.x, e.y, '#7dffb0', 1.5, 3.6)
            this.sfx.roar(0.3)
          } else if (e.state === 'played') this.floatText(this.s.advantagePlayed, e.x, e.y, '#7dffb0', 0.9, 3.2)
          else this.floatText(this.s.advantageBack, e.x, e.y, '#ffd23f', 1.3, 3.4)
          break
        case 'whistle':
          this.sfx.whistle(e.long)
          break
        case 'skill': {
          this.sfx.whoosh(false)
          // Only his own skill is labelled over him (playtest: an opponent's failed trick showed "KAPTIRDIN" over the
          // hero who had just won the ball).
          if (e.by !== rt.hero.id) break
          this.floatText(e.success ? this.s.skillOk : this.s.skillBad, rt.hero.pos.x, rt.hero.pos.y, e.success ? '#5dff8a' : '#ff7a7a', 0.9, 2.8)
          if (e.success) this.vibrate(30)
          break
        }
        case 'dive': {
          this.sfx.scuff()
          const dv = this.views.find((w) => w.agent.id === e.by)
          if (dv) {
            const p = project(dv.agent.pos.x, dv.agent.pos.y)
            this.burst(this.puffFx, this.fxN(5, 760), p.x, p.y)
          }
          break
        }
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
        case 'callRefused': {
          // Pass-to-me ignored: over the team-mate who kept it.
          const a = this.agentById(e.by)
          if (a) this.floatText(e.reason === 'lane' ? this.s.refuseLane : this.s.refuseRelation, a.pos.x, a.pos.y, '#ff9f6b', 1.1, 2.9)
          break
        }
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
        case 'headReady':
          this.floatText(this.s.headReady, rt.hero.pos.x, rt.hero.pos.y, '#9fe8ff', 1.1, 2.8)
          break
        case 'jump':
        case 'out':
          break
      }
    }
  }

  private showBanner(r: HighlightResult): void {
    const s = this.s
    // Graded success (build 9): a partial success says what it was and that it counted (half the reward).
    const partial = r.tier === 'partial'
    const goalKind = GOAL_KINDS.has(this.rt.kind)
    let txt = r.offside ? s.offside : (s[r.outcome as keyof Strings] ?? r.outcome)
    // (Defending / keeping: kept out while he did his job; long ball / switch: the first contact won.)
    const dutyKind = DEFENSIVE_KINDS.has(this.rt.kind)
    const contactKind = CONTACT_KINDS.has(this.rt.kind)
    const forced = partial && r.outcome === 'shot_conceded'
    if (partial && !r.offside) txt = forced ? s.tierForced : dutyKind ? s.tierDuty : contactKind ? s.tierContact : r.outcome === 'pass_complete' ? s.tierPass : r.outcome === 'saved' ? s.tierSaved : r.outcome === 'woodwork' ? s.woodHit : s.tierChance
    // (A save says the keeper saved it, a block that it was blocked — playtest: "KAÇTI" on a held save read as a miss.)
    else if (goalKind && r.tier === 'fail' && r.outcome === 'missed') txt = s.tierMissed
    // Kept out by the others while he did nothing (playtest: "SAVUNDUN!" with no input taught nothing).
    // Keeper moments: kept out, then the loose ball went the other way — the job (the save) is what the banner says
    // (playtest: "TOP KAYBI" after a save).
    if (this.rt.heroIsKeeper && r.tier === 'full' && r.outcome !== 'defended' && r.outcome !== 'pass_complete' && !r.offside) txt = s.defended
    // Dribble: a pass (or anything) without beating his man first is not the job (playtest: "İYİ OYUN" on a 2 m pass).
    const notBeaten = this.rt.kind === 'dribble' && r.tier === 'fail' && r.beat === false && !r.offside && !r.card
    if (notBeaten) txt = s.notBeaten
    // A partial success that ended with the ball gone: say what he did, then that it was lost (playtest: "FIRSAT!" on a
    // lost ball read as a contradiction).
    const lostAfter = partial && !forced && !dutyKind && !contactKind && (r.outcome === 'lost_ball' || r.outcome === 'foul_committed' || r.outcome === 'timeout')
    if (lostAfter) txt = this.rt.kind === 'dribble' ? s.beatMan : s.chanceLost
    // Switch of play: a pass that found a man on the same side, then lost — the switch was not made (not his "lost ball").
    const noSwitch = this.rt.kind === 'switch_play' && r.tier === 'fail' && (r.passesCompleted ?? 0) > 0 && !r.offside
    if (noSwitch) txt = s.noSwitch
    const wallHit = this.rt.kind === 'freekick' && r.outcome === 'blocked'
    if (wallHit) txt = s.wallHit
    const teamOnly = dutyKind && r.tier === 'fail' && (r.outcome === 'defended' || r.outcome === 'cleared')
    if (teamOnly && !r.offside) txt = s.teamDefended
    const good = (GOOD.has(r.outcome) || (this.rt.heroIsKeeper && r.tier === 'full')) && !teamOnly && !notBeaten
    this.bannerText.setText(txt).setColor(good ? '#ffc83d' : partial ? '#7fd8ff' : '#ffffff').setAlpha(1).setScale(1)
    // Fits the screen (playtest: "RAKİP ŞUT BULDU" was cut off at both edges on a phone).
    const fit = Math.min(1, (this.scale.width * 0.92) / Math.max(1, this.bannerText.width))
    this.bannerText.setScale(0.3 * fit)
    this.tweens.add({ targets: this.bannerText, scale: fit, duration: 420, ease: 'Back.Out' })
    let sub = ''
    if (r.card) sub = r.card === 'red' ? s.red : s.yellow
    else if (r.offside) sub = `${s.offsideFlag} ${this.rt.agents.find((a) => a.id === r.offside?.playerId)?.name ?? ''}`.trim()
    else if (r.outcome === 'assist' && r.scorerId) sub = `→ ${this.rt.agents.find((a) => a.id === r.scorerId)?.name ?? ''}`
    else if (teamOnly) sub = s.teamDefendedSub
    else if (notBeaten) sub = s.notBeatenSub
    else if (noSwitch) sub = s.noSwitchSub
    else if (lostAfter) sub = this.rt.kind === 'dribble' ? s.beatManSub : s.chanceLostSub
    else if (wallHit) sub = s.wallHitSub
    else if (forced) sub = s.tierForcedSub
    else if (partial && dutyKind && this.rt.heroIsKeeper && r.outcome === 'defended' && !r.heroStop) sub = s.keeperDutySub
    else if (partial) sub = dutyKind ? s.tierDutySub : contactKind ? (this.rt.kind === 'switch_play' ? s.tierSwitchSub : s.tierContactSub) : r.outcome === 'pass_complete' ? s.tierPassSub : r.outcome === 'woodwork' ? s.tierWoodSub : r.outcome === 'saved' ? s.tierSavedSub : s.tierChanceSub
    this.bannerSub.setText(sub).setAlpha(sub ? 1 : 0)
    if (!good && !partial && r.outcome !== 'woodwork') this.shake(100, 0.002)
  }

  private holdTick = -1

  private floatText(text: string, x: number, y: number, color: string, life: number, zOff: number): void {
    // Avoid stacking the same message.
    if (this.floaters.some((f) => f.text.text === text && f.t < 0.2)) return
    // Pooled (WP-P, 2.9#16): recycled Text objects, no per-event create/destroy.
    this.floatPool ??= new ObjectPool<Phaser.GameObjects.Text>(
      () => this.text(16, '#ffffff', '900'),
      () => {},
      (o) => o.setVisible(false).setAlpha(0),
      12,
      (o) => {
        if (o.active) o.destroy()
      },
    )
    const t = this.floatPool.acquire()
    t.setColor(color).setText(text).setVisible(true)
    const p = project(x, y, zOff)
    this.floaters.push({ text: t, wx: p.x, wy: p.y, t: 0, life })
  }

  // ───────────────────────── HUD ─────────────────────────

  private updateHud(dt: number, intent: FrameIntent): void {
    const rt = this.rt
    const g = this.hudG
    const w = this.scale.width
    const h = this.scale.height
    const u = this.hudU
    g.clear()

    // HUD band (the play camera starts below it): deep navy glass with a pitch-green hairline.
    const top = this.safeTop
    fillGradient(g, 0x070b14, 0x070b14, 0x0b1220, 0x0b1220, 0.97, 0.97, 0.94, 0.94)
    g.fillRect(0, 0, w, this.hudTop)
    g.fillStyle(0x1fd47a, 0.35)
    g.fillRect(0, this.hudTop - 1 * u, w, 1 * u)

    // Score bug: pitch-green minute block (same as the live hub bug), team colour ticks, white score block (hidden under the replay letterbox).
    const showBug = this.mode !== 'replay'
    for (const t of [this.sb.min, this.sb.home, this.sb.score, this.sb.away]) t.setVisible(showBug)
    this.assistText?.setVisible(showBug)
    const sx = this.sb.x
    const bugY = top + 4 * u
    const bugH = 26 * u
    if (showBug) {
      // Slanted TV strip (2.2#92): a parallelogram bug with the minute block, team ticks and score.
      const sk = 7 * u
      const para = (x0: number, x1: number, y0: number, hh: number, col: number, al: number) => {
        g.fillStyle(col, al)
        g.beginPath()
        g.moveTo(x0 + sk, y0)
        g.lineTo(x1 + sk, y0)
        g.lineTo(x1 - sk * 0, y0 + hh)
        g.lineTo(x0, y0 + hh)
        g.closePath()
        g.fillPath()
      }
      para(sx.min + 2 * u, sx.end + 2 * u, bugY + 2 * u, bugH, 0x000000, 0.35)
      para(sx.min, sx.end, bugY, bugH, 0x131c2e, 1)
      para(sx.min, sx.min + sx.minW, bugY, bugH, 0x1fd47a, 1)
      para(sx.min + sx.minW, sx.min + sx.minW + 4 * u, bugY, bugH, this.sbColors[0], 1)
      g.fillStyle(0xf2f5fa, 1)
      g.fillRect(sx.score, bugY + 3 * u, sx.scoreW, bugH - 6 * u)
      para(sx.end - 4 * u, sx.end, bugY, bugH, this.sbColors[1], 1)
      // Stamina (condition) bar under the bug: the hero's sprint stamina.
      const st = clampN(rt.hero.stamina, 0, 1)
      const sw = sx.end - sx.min
      g.fillStyle(0x000000, 0.55)
      g.fillRect(sx.min, bugY + bugH + 1 * u, sw, 3 * u)
      g.fillStyle(st > 0.3 ? 0x5dff8a : 0xffb02e, 0.95)
      g.fillRect(sx.min, bugY + bugH + 1 * u, sw * st, 3 * u)
    }
    // Floating prompt / focus label over the pitch: a soft pill while visible.
    const pa0 = Math.max(this.promptText.alpha, this.focusText.alpha)
    if (pa0 > 0.02) {
      const t = this.promptText.alpha >= this.focusText.alpha ? this.promptText : this.focusText
      const pw = t.width + 28 * u
      const ph = t.height + 8 * u
      g.fillStyle(0x070b14, 0.55 * pa0)
      g.fillRoundedRect(w / 2 - pw / 2, t.y - ph / 2, pw, ph, ph / 2)
    }

    // Moment timer bar.
    const frac = clampN(rt.timeLeft / rt.timeLimit, 0, 1)
    const bw = this.bar.w
    const bx = this.bar.x
    const by = this.bar.y
    g.fillStyle(0x000000, 0.5)
    g.fillRoundedRect(bx - 2 * u, by - 2 * u, bw + 4 * u, 10 * u, 5 * u)
    g.fillStyle(0xffffff, 0.06)
    g.fillRoundedRect(bx, by, bw, 6 * u, 3 * u)
    const col = frac > 0.5 ? 0x1fd47a : frac > 0.25 ? 0xffc83d : 0xff4d4d
    const pulse = frac < 0.25 ? 0.6 + Math.sin(this.elapsed * 14) * 0.4 : 1
    if (this.mode === 'play' && frac > 0) {
      const fw = Math.max(6 * u, bw * frac)
      g.fillStyle(col, 0.25 * pulse)
      g.fillRoundedRect(bx - 1 * u, by - 1 * u, fw + 2 * u, 8 * u, 4 * u)
      g.fillStyle(col, pulse)
      g.fillRoundedRect(bx, by, fw, 6 * u, 3 * u)
      g.fillStyle(0xffffff, 0.35 * pulse)
      g.fillRect(bx + 3 * u, by + 1 * u, Math.max(0, fw - 6 * u), 1.2 * u)
    }

    // Result banner: a broadcast sweep band behind the big word.
    const ba = this.bannerText.alpha
    if (ba > 0.01) {
      const by0 = this.bannerText.y
      const bh = this.bannerText.height * 0.92 * this.bannerText.scaleY + (this.bannerSub.alpha > 0 ? 26 * u : 0)
      const bwid = w * Math.min(1, this.bannerText.scaleX)
      const skew = 18 * u
      const good = this.bannerText.style.color === '#ffc83d'
      const yTop = by0 - this.bannerText.height * 0.46 * this.bannerText.scaleY
      g.fillStyle(0x070b14, 0.78 * ba)
      g.beginPath()
      g.moveTo(w / 2 - bwid / 2 + skew, yTop)
      g.lineTo(w / 2 + bwid / 2 + skew, yTop)
      g.lineTo(w / 2 + bwid / 2 - skew, yTop + bh)
      g.lineTo(w / 2 - bwid / 2 - skew, yTop + bh)
      g.closePath()
      g.fillPath()
      g.fillStyle(good ? 0xffc83d : 0xff4d4d, 0.95 * ba)
      g.fillRect(w / 2 - bwid / 2, yTop - 2 * u, bwid, 3 * u)
      g.fillRect(w / 2 - bwid / 2, yTop + bh - 1 * u, bwid, 3 * u)
    }

    // Bullet-time focus bar + vignette.
    const focus = this.mode === 'play' ? rt.bulletFrac : 0
    const slow = this.mode === 'play' ? 1 - rt.timeScale : 0
    // A soft broadcast vignette always frames the play (deeper at night); bullet time and replays push it further.
    const vBase = this.night ? 0.42 : 0.26
    // Bullet time adds at most 15 % vignette and a slight desaturation (2.2#14).
    this.vignette.setAlpha(this.rm ? vBase : Math.min(0.85, vBase + bulletVignette(slow) + (this.mode === 'replay' ? 0.2 : 0)))
    this.applyDesaturation(this.rm ? 0 : slow)

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
      const tw = this.tagText.width + 14 * u
      const th = this.tagText.height + 3 * u
      g.fillStyle(0x000000, 0.3)
      g.fillRoundedRect(sp.x - tw / 2 + 1 * u, sp.y - th / 2 + 2 * u, tw, th, 5 * u)
      g.fillStyle(0xffc83d, 0.97)
      g.fillRoundedRect(sp.x - tw / 2, sp.y - th / 2, tw, th, 5 * u)
      g.fillTriangle(sp.x - 4 * u, sp.y + th / 2, sp.x + 4 * u, sp.y + th / 2, sp.x, sp.y + th / 2 + 5 * u)
      g.fillStyle(0xffffff, 0.35)
      g.fillRect(sp.x - tw / 2 + 4 * u, sp.y - th / 2 + 1 * u, tw - 8 * u, 1 * u)
    } else {
      this.tagText.setAlpha(0)
    }

    // Floating texts.
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!
      f.t += dt
      const sp = this.worldToScreen(f.wx, f.wy)
      f.text.setPosition(sp.x, sp.y - f.t * 30 * u).setAlpha(clampN((f.life - f.t) / 0.3, 0, 1)).setScale(1 + Math.max(0, 0.25 - f.t) * 1.5)
      if (f.t >= f.life) {
        this.floatPool?.release(f.text)
        this.floaters.splice(i, 1)
      }
    }

    // Touch controls: the moment's context buttons (game/actionSet) and the joystick.
    const tu = this.input0.touchUi()
    const showTouch = tu.enabled && this.mode === 'play'
    this.sprintText.setAlpha(0)
    this.skillText.setAlpha(0)
    this.drawContextButtons(g, tu.buttons, tu.enabled, hero.stamina)
    if (showTouch) {
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
  el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:var(--safe-top,env(safe-area-inset-top,0px))'
  document.body.appendChild(el)
  const inset = parseFloat(getComputedStyle(el).paddingTop) || 0
  el.remove()
  return Math.max(0, inset - Math.max(0, canvas.getBoundingClientRect().top))
}

// ───────────────────────── Factory & API ─────────────────────────

/**
 * Builds the game. With an explicit `renderer` (every guarded host, see phaserGuard.ts) exactly
 * that one is used and a failure throws to the guard. Without it (demo page), Phaser.AUTO is tried
 * and the Canvas renderer used when WebGL fails: AUTO only probes for *a* WebGL context; the real
 * one (with our antialias / powerPreference attributes) can still fail on blocklisted or exhausted
 * GPUs (some Adreno/Mali drivers), and Phaser then throws "WebGL unsupported" from the constructor.
 */
function newGameWithFallback(config: (type: number) => Phaser.Types.Core.GameConfig, renderer?: RendererChoice): Phaser.Game {
  if (renderer) return new Phaser.Game(config(renderer === 'canvas' ? Phaser.CANVAS : Phaser.WEBGL))
  if (!isWebglBroken()) {
    try {
      return new Phaser.Game(config(Phaser.AUTO))
    } catch (e) {
      markWebglBroken(`WebGL init failed: ${String((e as Error)?.message ?? e).slice(0, 120)}`)
      console.warn('[StarPath] WebGL renderer failed, falling back to Canvas', e)
      recordError(`WebGL init failed: ${String((e as Error)?.message ?? e).slice(0, 120)}`, 'render')
    }
  }
  return new Phaser.Game(config(Phaser.CANVAS))
}

/**
 * Canvas on a device whose GPU path already failed (WebGL broken, or compatibility mode): the game's
 * 2D context is created with willReadFrequently, which keeps it in CPU memory (software raster), so
 * a driver that loses / resets GPU canvases cannot take the game view down with it.
 */
function softwareCanvas(): { canvas?: HTMLCanvasElement; context?: CanvasRenderingContext2D } {
  if (typeof document === 'undefined' || !(isSoftwareMode() || isWebglBroken())) return {}
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
    return context ? { canvas, context } : {}
  } catch {
    return {}
  }
}

/**
 * Creates a Phaser.Game sized to `parent`, crisp on high-DPI screens.
 *
 * On DPR > 1 the canvas backing store is rendered at device pixels (Scale.NONE
 * with zoom = 1/DPR, resized by a ResizeObserver) because Phaser's RESIZE mode
 * maps 1 CSS px to 1 canvas px (blurry on retina). On DPR = 1 it uses
 * Phaser.Scale.RESIZE directly. Handles orientation changes via the observer.
 * `profile` is the active graphics quality profile: Low caps the render scale at 1.25x.
 * `renderer` forces WebGL or Canvas (guarded hosts); omitted, WebGL is tried with a Canvas fallback.
 * Destroy with `game.destroy(true)`; observers are disconnected automatically.
 */
export function createMatchGame(parent: HTMLElement, profile?: QualityProfile, renderer?: RendererChoice): Phaser.Game {
  // Capped at 2: a 3x backing store costs ~2.25x the fill rate for no visible gain on phones.
  const rect = parent.getBoundingClientRect()
  const cssW = Math.max(1, Math.floor(rect.width || parent.clientWidth || 800))
  const cssH = Math.max(1, Math.floor(rect.height || parent.clientHeight || 450))
  // DPR profile (WP-P, 2.9#13): device ratio capped by a pixel budget, tighter on touch-first devices.
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const dpr = renderScale({ dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cssW, cssH, coarse, profile })
  const hiDpi = dpr > 1.01
  const game = newGameWithFallback((type) => ({
    type,
    parent,
    ...(type === Phaser.CANVAS ? softwareCanvas() : {}),
    backgroundColor: '#0b1410',
    banner: false,
    disableContextMenu: true,
    // All audio goes through the shared engine (src/audio); no second AudioContext.
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    // Low profile: no MSAA and the default GPU (mid-range Adreno/Mali run cooler, fill rate is the bottleneck).
    render: { antialias: profile !== 'low', roundPixels: false, powerPreference: profile === 'low' ? 'default' : 'high-performance' },
    // No fps.limit: Phaser's limiter carries the remainder, so a 60 cap on a 90 Hz screen (Galaxy A52)
    // alternates 1- and 2-refresh frames (judder) and drops jittered frames at 60 Hz.
    scale: hiDpi
      ? { mode: Phaser.Scale.NONE, width: Math.round(cssW * dpr), height: Math.round(cssH * dpr), zoom: 1 / dpr }
      : { mode: Phaser.Scale.RESIZE, width: cssW, height: cssH },
  }), renderer)
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
  let stopped = false
  const sceneData = (finish: (r: HighlightResult) => void): SceneData => ({ highlight, opts, onDone: finish, replayOnly })
  if (target instanceof Phaser.Game) {
    // Shared game (demo page): the caller owns it, no guard.
    const game = target
    const finish = (r: HighlightResult) => {
      if (stopped) return
      stopped = true
      game.scene.remove(SCENE_KEY)
      onDone(r)
    }
    const launch = () => {
      if (stopped) return
      if (game.scene.getScene(SCENE_KEY)) game.scene.remove(SCENE_KEY)
      game.scene.add(SCENE_KEY, MatchScene, true, sceneData(finish))
    }
    if (game.isBooted) launch()
    else game.events.once(Phaser.Core.Events.READY, launch)
    return {
      game,
      stop() {
        if (stopped) return
        stopped = true
        if (game.scene.getScene(SCENE_KEY)) game.scene.remove(SCENE_KEY)
      },
    }
  }
  const profile = profileOfSettings(opts.settings)
  let guard: GuardHandle | null = null
  const finish = (r: HighlightResult) => {
    if (stopped) return
    stopped = true
    guard?.stop()
    onDone(r)
  }
  guard = guardPhaser({
    container: target,
    host: opts.replay && replayOnly ? 'replay' : 'match',
    lowGraphics: !!opts.settings.canvasRenderer,
    build: (renderer, safe) => {
      const game = createMatchGame(target, profile, renderer)
      const launch = safe(() => {
        if (stopped) return
        game.scene.add(SCENE_KEY, MatchScene, true, sceneData(finish))
      })
      if (game.isBooted) launch()
      else game.events.once(Phaser.Core.Events.READY, launch)
      return game
    },
    // Exit on the failure panel: the moment is over without a result the player earned.
    onExit: () => {
      if (stopped) return
      opts.onRenderFail?.()
    },
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

/**
 * Rewatches a recorded moment (see `moments.ts`) in the replay player: the
 * same players and stadium, slow motion, with the chosen camera angle.
 * Tap / Enter skips. `onDone` fires when the replay ends or is skipped.
 */
export function replayMoment(
  target: Phaser.Game | HTMLElement,
  moment: MomentRecording,
  o: { settings: HighlightSettings; angle?: ReplayAngleChoice; lang?: Lang; onRenderFail?: () => void },
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
      onRenderFail: o.onRenderFail,
    },
    () => onDone(),
    moment,
  )
}
