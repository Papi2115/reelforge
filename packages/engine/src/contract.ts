/**
 * Scene contract (PLAN.md §3.2). A scene is an ES module exporting `meta`, `build(ctx)` and
 * `update(t, state, ctx)`. `update` must be a pure function of the local time `t` (seconds):
 * set every time-dependent property absolutely from `t`, never incrementally.
 */
import type { AmbientVariation, AssetCrop, AssetImage, KitApi } from '@reelforge/kit';
import type { AnnotateApi } from './annotations/types.js';
import type { Treatment } from '@reelforge/shared';
import type * as THREE from 'three';
import type { EaseFunction, EaseName } from './camera/easing.js';
import type {
  CameraMove,
  DollyZoomOptions,
  OrbitMoveOptions,
  ParallaxOptions,
  RackFocusOptions,
} from './camera/moves.js';
import type {
  CameraRig,
  CraneOptions,
  DollyOptions,
  LookAtOptions,
  OrbitOptions,
  PushInOptions,
  ShakeOptions,
} from './camera/rigs.js';
import type { Rng } from './rng.js';
import type { ScenePalette } from './style.js';
import type { TextApi } from './text/types.js';

export type {
  CameraMove,
  DollyZoomOptions,
  MoveSubject,
  MoveTime,
  OrbitAxis,
  OrbitMoveOptions,
  ParallaxLayer,
  ParallaxOptions,
  RackFocusOptions,
} from './camera/moves.js';

export interface SceneMeta {
  readonly id: string;
  readonly title?: string | undefined;
  readonly treatment?: Treatment | undefined;
}

/** Local spoken time range of an anchor, relative to the shot start (may be < 0 or > duration). */
export interface AnchorHit {
  readonly t: number;
  readonly tEnd: number;
}

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3;
  /** Point the camera looks at; defaults to the origin. */
  readonly target?: Vec3;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
}

/** A rig bound to the shot camera: applies the pose for local time t and returns it. */
export type AppliedRig = (t: number) => CameraPose;

/**
 * Camera of the shot. Rigs are pure functions of t: create and call them in `update`, e.g.
 * `ctx.camera.pushIn({ from: 0, to: hit.t, dist: [6, 3.5] })(t)`. `to` defaults to the shot
 * length, `ease` to 'easeInOutCubic'; angles are degrees.
 *
 * Cinematic moves (`rackFocus`, `dollyZoom`, `orbit` with `t0`, `parallax`; PLAN.md#12.28) are
 * immediate mode like ctx.text: call them in `update` every frame; they modify the pose the scene
 * set (rig, `set` or the build pose) for that frame only. `t0`/`t1` are local seconds or anchors.
 */
export interface CameraApi {
  readonly object: THREE.PerspectiveCamera;
  set(pose: CameraPose): void;
  dolly(options: DollyOptions): AppliedRig;
  orbit(options: OrbitOptions): AppliedRig;
  /** Orbit move: turns the scene's pose around its target by `degrees` over [t0, t1]. */
  orbit(options: OrbitMoveOptions): CameraMove;
  pushIn(options: PushInOptions): AppliedRig;
  crane(options: CraneOptions): AppliedRig;
  lookAt(options: LookAtOptions): AppliedRig;
  /** Seeded handheld/impact shake on top of a rig (e.g. `ctx.camera.orbit(...)`) or a fixed pose. */
  shake(base: CameraRig | CameraPose, options: ShakeOptions): AppliedRig;
  /** Moves the focus from `from` to `to` (distance, point or object); the rest blurs (dither bokeh). */
  rackFocus(options: RackFocusOptions): CameraMove;
  /** Vertigo: camera distance to the subject goes `from` -> `to`, the fov keeps the subject's size. */
  dollyZoom(options: DollyZoomOptions): CameraMove;
  /** Lateral camera travel by `amount`; `layers` move at their own parallax ratio. */
  parallax(options: ParallaxOptions): CameraMove;
}

/** A sound-effect cue, in global video time (seconds). */
export interface SfxCue {
  readonly t: number;
  readonly name: string;
  readonly shotId: string;
}

/**
 * An anchor a scene resolved in `build`, in global video time (seconds). Reported by `load()` so
 * tools can check that visuals land on their spoken words (PLAN.md §3.3).
 */
export interface ResolvedAnchor {
  readonly shotId: string;
  readonly phrase: string;
  readonly nth: number;
  readonly t: number;
  readonly tEnd: number;
}

export interface SfxApi {
  /** Schedules `name` at local time `t`. Only allowed in `build` (cues are collected once). */
  at(t: number, name: string): void;
}

/** Voxel kit (ctx.kit): voxel toolbox, environments, props and effects (packages/kit). */
export type { KitApi };

export type {
  AnnotateApi,
  AnnotationAnimation,
  AnnotationHandle,
  AnnotationTarget,
  AnnotationType,
  ArrowOptions,
  BadgeOptions,
  BracketOptions,
  CalloutOptions,
  DimensionOptions,
  HighlightOptions,
  PinOptions,
  RingOptions,
  SpotlightOptions,
  StampOptions,
  UnderlineOptions,
} from './annotations/types.js';

export type {
  AnnotationCardInfo,
  AnnotationTargetProbe,
  KineticOptions,
  KineticWord,
  LowerThirdOptions,
  MeasureStyle,
  PixelRect,
  TextApi,
  TextCard,
  TextCardKind,
  TextMetrics,
  TitleOptions,
} from './text/types.js';

export interface ShotInfo {
  readonly id: string;
  /** Shot length in seconds (t1 - t0); the shot may still be evaluated past it during a transition. */
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
}

/**
 * `ctx.ambient` (PLAN.md#12.8): the shot's ambient variation, read-only. Kit environments apply it
 * by themselves (do not hard-code the same background in every shot); a scene that paints its own
 * background colour can follow the shot's tones with `ctx.ambient.tone(name)`.
 */
export interface AmbientApi {
  /** True when the project varies its environments and this shot's look has a budget. */
  readonly enabled: boolean;
  /** The parameter set (undefined when off). */
  readonly params: AmbientVariation | undefined;
  /** The palette name used for `name` in this shot (a member of its family, or `name`). */
  tone(name: string): string;
}

/** Stylisation of an asset picture (`ctx.assets.image(ref, options)`). */
export interface AssetImageOptions {
  /** 'cover' (default: fill the slot, centred), 'center' (whole picture, letterboxed) or { focus: [x, y], zoom }. */
  readonly crop?: AssetCrop | undefined;
  /** Stretch the picture's luma range before the palette snap (default true). */
  readonly contrast?: boolean | undefined;
  /** Bayer dither strength 0..1 (default 0.5; 0 = plain palette snap). */
  readonly dither?: number | undefined;
  /** Palette names to map onto (default: the whole style palette), e.g. ['ink', 'bone'] (duotone). */
  readonly tones?: readonly string[] | undefined;
}

/**
 * `ctx.assets` (PLAN.md#12.11): the project's pictures (assets.json) that this video carries,
 * decoded and stylised by the engine: scenes never fetch or decode anything themselves.
 */
export interface AssetsApi {
  /** Refs of the pictures this video carries: asset ids, `id@seconds` for video stills. */
  readonly refs: readonly string[];
  /** True when `ref` is available (keep a kit fallback when it is not). */
  has(ref: string): boolean;
  /**
   * Handle of a picture for kit props (`kit.props.photoFrame({ asset })`). build() only; write the
   * id as a string literal (the app ships only the assets a scene names). Unknown ref = error.
   */
  image(ref: string, options?: AssetImageOptions): AssetImage;
}

export interface SceneContext {
  /** Three.js namespace (scenes must not import modules; everything comes through ctx). */
  readonly three: typeof THREE;
  /** Root of this shot's scene graph: add objects, set background/fog. */
  readonly scene: THREE.Scene;
  readonly camera: CameraApi;
  readonly kit: KitApi;
  /** Pixel-font titles, lower thirds and kinetic text (call the drawing methods in `update`). */
  readonly text: TextApi;
  /**
   * Pixel-art annotations (callout, arrow, ring, bracket, pin, underline, highlight, badge, stamp,
   * dimension, spotlight) pointing at kit objects, world points, frame regions or text cards; call
   * them in `update` like ctx.text.
   */
  readonly annotate: AnnotateApi;
  /**
   * Colours of the active style (hex strings): semantic tokens (`sky`, `ground`, `hero`,
   * `accent1`..`accent4`, `keyLight`, `text`, ...; prefer these, they exist in every style) and the
   * style's swatches by name.
   */
  readonly palette: ScenePalette;
  /** Easing curves (0..1 -> 0..1), e.g. `ctx.ease.easeOutCubic(k)`. */
  readonly ease: Readonly<Record<EaseName, EaseFunction>>;
  /** Resolves a spoken phrase to local time; throws when the phrase is not in words.json. */
  anchor(phrase: string, nth?: number): AnchorHit;
  readonly sfx: SfxApi;
  /**
   * Seeded RNG. In `build` it is the shot's stream; in `update` it restarts from a fixed seed on
   * every call, so random values used per frame are stable for a given t.
   */
  readonly rng: Rng;
  readonly shot: ShotInfo;
  /** Ambient variation of the shot (read-only; environments already apply it). */
  readonly ambient: AmbientApi;
  /** Asset pictures (photos, video stills) for kit props; `image()` in build only. */
  readonly assets: AssetsApi;
}

export interface SceneModule {
  readonly meta: SceneMeta;
  build(ctx: SceneContext): unknown;
  update(t: number, state: unknown, ctx: SceneContext): void;
}
