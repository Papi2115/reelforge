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
  /** Storyboard shot id; the scene file is read from disk as it is now. */
  readonly shotId: string;
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
}

export type ShotRender = ShotRenderOk | ShotRenderFailed;

/**
 * Renders one shot through the same engine as preview and export (CLAUDE.md §3.3). A broken scene
 * resolves `{ ok: false }`; a rejection means the renderer itself is unavailable.
 */
export interface FrameRenderer {
  renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender>;
}

/**
 * A shot needs props the kit lacks. `added`: the kit was extended (a repo-level change made by a
 * developer/Coder, never inside a user project), so the shot is built again; `skipped`: the shot
 * is kept as built with what exists and marked ⚠ "missing prop: …".
 */
export type MissingPropsHandler = (
  names: readonly string[],
  shot: StoryboardShot,
) => Promise<'added' | 'skipped'>;

export const skipMissingProps: MissingPropsHandler = () => Promise.resolve('skipped');

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
  /** Default: `skipMissingProps`. */
  readonly onMissingProps?: MissingPropsHandler | undefined;
  /** Default: the installed kit (`kitNamesFromCatalog()`). */
  readonly kitNames?: KitNames | undefined;
}
