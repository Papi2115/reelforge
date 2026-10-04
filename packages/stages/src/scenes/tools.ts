/**
 * What the scene stage needs besides Claude (PLAN.md#7.4): a frame renderer (the engine harness;
 * the app passes its render service, tests the Playwright harness), the kit catalogue (to spot
 * calls of props that do not exist) and the decision what to do about missing props.
 */
import type { CardDiagnostic, ResolvedAnchor, SfxCue } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { kitCatalog } from '@reelforge/kit';
import type { StoryboardShot } from '@reelforge/shared';

export interface ShotRenderRequest {
  readonly projectDir: string;
  /**
   * Storyboard shot id; the scene file is read from disk as it is now. With `standalone`: the
   * standalone shot id of that scene (its file name, e.g. `turntable`).
   */
  readonly shotId: string;
  /**
   * A scene that is not in the storyboard (a prop turntable, PLAN.md#7.4), rendered from t = 0
   * for `duration` seconds; project-relative path.
   */
  readonly standalone?: { readonly scene: string; readonly duration: number } | undefined;
  /**
   * Render the storyboard shot with this scene file instead of its own (a shot variant,
   * PLAN.md#11.3): same times, anchors and seed; project-relative path.
   */
  readonly scene?: string | undefined;
  /** Local shot times (s) to render; empty = load only (anchors, cues, errors). */
  readonly times: readonly number[];
  /** Run the engine's text-card QA (overlaps, safe area). */
  readonly cards: boolean;
}

export interface RenderedFrame {
  /** Local shot time (s). */
  readonly t: number;
  readonly image: RgbaImage;
}

export interface ShotRenderOk {
  readonly ok: true;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly RenderedFrame[];
  readonly cards: readonly CardDiagnostic[];
  /** Anchors and sfx cues the scene declared in build() (global time). */
  readonly anchors: readonly ResolvedAnchor[];
  readonly cues: readonly SfxCue[];
  /** Console errors while loading and rendering. */
  readonly errors: readonly string[];
}

export interface ShotRenderFailed {
  readonly ok: false;
  /** Why the scene did not load (engine error text, written for the scene author). */
  readonly error: string;
  readonly errors: readonly string[];
  /**
   * The renderer did not answer in time, also after one retry on a fresh renderer: not the
   * scene's fault, so QA reports a warning for the shot instead of asking for a fix.
   */
  readonly timedOut?: boolean;
}

export type ShotRender = ShotRenderOk | ShotRenderFailed;

/**
 * Renders one shot through the same engine as preview and export (CLAUDE.md §3.3). A broken scene
 * resolves `{ ok: false }`; a rejection means the renderer itself is unavailable.
 */
export interface FrameRenderer {
  renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender>;
}

/** Per-name outcome of a missing-props request (names as the handler returns them). */
export interface MissingPropsOutcome {
  /** Now callable as `kit.props.<name>`: the shot is built again with them. */
  readonly built: readonly string[];
  /** Could not be provided: the shot keeps a fallback and is marked ⚠ "missing prop: …". */
  readonly failed: readonly string[];
}

/**
 * A shot needs props the kit lacks. The default handler builds each as a project prop
 * (`kit-ext/props/<name>.js`, PLAN.md#7.4). `added`: all of them exist now, so the shot is built
 * again; `skipped`: none, the shot is kept as built and marked ⚠ "missing prop: …"; an outcome
 * object says it per name.
 */
export type MissingPropsHandler = (
  names: readonly string[],
  shot: StoryboardShot,
) => Promise<'added' | 'skipped' | MissingPropsOutcome>;

export const skipMissingProps: MissingPropsHandler = () => Promise.resolve('skipped');

/** A handler's decision for `names`, per name. */
export function missingPropsOutcome(
  names: readonly string[],
  decision: Awaited<ReturnType<MissingPropsHandler>>,
): MissingPropsOutcome {
  if (decision === 'added') return { built: [...names], failed: [] };
  if (decision === 'skipped') return { built: [], failed: [...names] };
  return decision;
}

/** What `planServiceShot` renders for a request: the storyboard shot or a standalone scene. */
export function renderTarget(request: ShotRenderRequest): {
  readonly projectDir: string;
  readonly shot?: string;
  readonly scene?: string;
  readonly duration?: number;
} {
  const { projectDir, standalone, scene } = request;
  if (standalone !== undefined) {
    return { projectDir, scene: standalone.scene, duration: standalone.duration };
  }
  return scene === undefined
    ? { projectDir, shot: request.shotId }
    : { projectDir, shot: request.shotId, scene };
}

/** Names callable as `kit.env.<name>`, `kit.props.<name>`, `kit.fx.<name>`. */
export interface KitNames {
  readonly env: ReadonlySet<string>;
  readonly props: ReadonlySet<string>;
  readonly fx: ReadonlySet<string>;
}

export function kitNamesFromCatalog(): KitNames {
  const catalog = kitCatalog();
  const names = (entries: readonly { readonly name: string }[]): Set<string> =>
    new Set(entries.map((entry) => entry.name));
  return { env: names(catalog.env), props: names(catalog.props), fx: names(catalog.fx) };
}

export interface SceneTools {
  readonly frames: FrameRenderer;
  /** Default: build each missing prop as a project prop (`kit-ext/props/<name>.js`). */
  readonly onMissingProps?: MissingPropsHandler | undefined;
  /** Default: the installed kit (`kitNamesFromCatalog()`). */
  readonly kitNames?: KitNames | undefined;
}
