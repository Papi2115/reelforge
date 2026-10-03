/**
 * What the preview shows (PLAN.md#6.3): the demo video on the start screen; the open project's
 * video once its storyboard can be built, otherwise the demo with a note saying why.
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

export interface ResolvedPreview {
  readonly manifest: RenderManifest;
  /** Shown over the preview when it is not the project's own video. */
  readonly note: string | undefined;
}

export const NO_STORYBOARD_NOTE = 'No shots yet · the demo scene plays until Storyboard has run';

export function previewNote(result: ProjectManifestResult): string | undefined {
  if (result.status === 'ready') return undefined;
  if (result.status === 'no-storyboard') return NO_STORYBOARD_NOTE;
  return `Project preview unavailable (${result.reason}) · showing the demo scene`;
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
  if (source.kind === 'demo') return { manifest: await api.getDemoManifest(), note: undefined };
  if (source.kind === 'variant') {
    const variant = await api.getVariantManifest(source.shotId, source.key);
    if (variant.status === 'ready') {
      return { manifest: variant.manifest, note: variantNote(source.shotId, source.key) };
    }
  }
  const result = await api.getProjectManifest();
  if (result.status === 'ready') return { manifest: result.manifest, note: undefined };
  return { manifest: await api.getDemoManifest(), note: previewNote(result) };
}

/** Project props (kit-ext/props) count: every shot may call them (a change reloads the video). */
const PREVIEW_INPUTS =
  /^(project\.json|storyboard\.json|timing\/words\.json|scenes\/.+|kit-ext\/props\/.+)$/i;

/** True when a change can alter the project's video (or the change list is incomplete). */
export function affectsPreview(event: ProjectChangedEvent): boolean {
  return event.truncated || event.paths.some((file) => PREVIEW_INPUTS.test(file));
}
