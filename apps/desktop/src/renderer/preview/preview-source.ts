/**
 * What the preview shows (PLAN.md#6.3): the demo video on the start screen; the open project's
 * video once its storyboard can be built (shots without a scene yet as placeholder cards, with a
 * note), otherwise the empty stage, never the demo inside a project (docs/ux/redesign-2.4.md §5).
 */
import type { RenderManifest } from '@reelforge/shared';
import type { ProjectChangedEvent, ProjectManifestResult } from '../../shared/snapshot-contract.js';
import type { VariantKey } from '../../shared/variants-contract.js';

export type PreviewSource =
  | { readonly kind: 'demo' }
  /** `revision` changes whenever the project's video inputs changed on disk. */
  | { readonly kind: 'project'; readonly revision: number }
  /** The project's video with a shot variant in place of the shot's scene (PLAN.md#11.3). */
  | {
      readonly kind: 'variant';
      readonly revision: number;
      readonly shotId: string;
      readonly key: VariantKey;
    };

export type ResolvedPreview =
  | {
      readonly kind: 'video';
      readonly manifest: RenderManifest;
      /** Shown over the preview when it is not (all of) the project's own video. */
      readonly note: string | undefined;
    }
  /** A project without a video to show yet: the empty-stage card instead of a frame. */
  | { readonly kind: 'empty'; readonly problem: string | undefined };

/** Note of a project video in which some shots are placeholders (scenes not built yet). */
export function placeholderNote(placeholders: number, total: number): string {
  return `${String(total - placeholders)} of ${String(total)} shots built — the rest show placeholders`;
}

export function previewNote(result: ProjectManifestResult): string | undefined {
  if (result.status !== 'ready') return undefined;
  const placeholders = result.placeholderShots?.length ?? 0;
  return placeholders > 0 ? placeholderNote(placeholders, result.manifest.shots.length) : undefined;
}

/** What the empty stage of a project shows and plays. */
export interface EmptyStageInfo {
  /** The next action ("Record or import your voiceover."). */
  readonly hint: string | undefined;
  /** Length of the project's audio (s; 0 = none yet). */
  readonly audioS: number;
}

/**
 * Player length while the empty stage shows: the voiceover's, so an imported recording plays
 * before the storyboard exists (0 without audio). Null when the player already has it.
 */
export function emptyStagePlayback(
  audioS: number,
  player: { readonly duration: number },
): { readonly duration: number } | null {
  const duration = Number.isFinite(audioS) && audioS > 0 ? audioS : 0;
  return player.duration === duration ? null : { duration };
}

/** The empty stage's title line: "Nothing to show yet — <next action>". */
export function emptyStageTitle(hint: string | undefined): string {
  const next = hint ?? 'Your video plays here once its shots are planned.';
  return `Nothing to show yet — ${next}`;
}

export interface PreviewApi {
  getDemoManifest(): Promise<RenderManifest>;
  getProjectManifest(): Promise<ProjectManifestResult>;
  getVariantManifest(shotId: string, key: VariantKey): Promise<ProjectManifestResult>;
}

export function variantNote(shotId: string, key: VariantKey): string {
  return `Previewing variant ${key.slice(1)} of ${shotId} · not saved until you pick it`;
}

export async function resolvePreview(
  source: PreviewSource,
  api: PreviewApi,
): Promise<ResolvedPreview> {
  if (source.kind === 'demo') {
    return { kind: 'video', manifest: await api.getDemoManifest(), note: undefined };
  }
  if (source.kind === 'variant') {
    const variant = await api.getVariantManifest(source.shotId, source.key);
    if (variant.status === 'ready') {
      return {
        kind: 'video',
        manifest: variant.manifest,
        note: variantNote(source.shotId, source.key),
      };
    }
  }
  const result = await api.getProjectManifest();
  if (result.status === 'ready') {
    return { kind: 'video', manifest: result.manifest, note: previewNote(result) };
  }
  if (result.status === 'no-storyboard') return { kind: 'empty', problem: undefined };
  return { kind: 'empty', problem: `The preview cannot be built: ${result.reason}` };
}

/**
 * Project props (kit-ext/props) and roles (characters/, PLAN.md#12.20) count: every shot may call
 * them (a change reloads the video); so does the tension curve (per-shot background tone and
 * ambient budget, PLAN.md#12.22). Live directions (directions.json, PLAN.md#12.14) are swapped in
 * without a rebuild.
 */
const PREVIEW_INPUTS =
  /^(project\.json|storyboard\.json|tension\.json|directions\.json|timing\/words\.json|scenes\/.+|kit-ext\/props\/.+|characters\/(?:roles|accessories)\/.+)$/i;

/** True when a change can alter the project's video (or the change list is incomplete). */
export function affectsPreview(event: ProjectChangedEvent): boolean {
  return event.truncated || event.paths.some((file) => PREVIEW_INPUTS.test(file));
}
