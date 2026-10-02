/**
 * What the preview shows (PLAN.md#6.3): the demo video on the start screen; the open project's
 * video once its storyboard can be built, otherwise the demo with a note saying why.
 */
import type { RenderManifest } from '@reelforge/shared';
import type { ProjectChangedEvent, ProjectManifestResult } from '../../shared/snapshot-contract.js';

export type PreviewSource =
  | { readonly kind: 'demo' }
  /** `revision` changes whenever the project's video inputs changed on disk. */
  | { readonly kind: 'project'; readonly revision: number };

export interface ResolvedPreview {
  readonly manifest: RenderManifest;
  /** Shown over the preview when it is not the project's own video. */
  readonly note: string | undefined;
}

export const NO_STORYBOARD_NOTE = 'No storyboard yet · showing the demo scene';

export function previewNote(result: ProjectManifestResult): string | undefined {
  if (result.status === 'ready') return undefined;
  if (result.status === 'no-storyboard') return NO_STORYBOARD_NOTE;
  return `Project preview unavailable (${result.reason}) · showing the demo scene`;
}

export interface PreviewApi {
  getDemoManifest(): Promise<RenderManifest>;
  getProjectManifest(): Promise<ProjectManifestResult>;
}

export async function resolvePreview(
  source: PreviewSource,
  api: PreviewApi,
): Promise<ResolvedPreview> {
  if (source.kind === 'demo') return { manifest: await api.getDemoManifest(), note: undefined };
  const result = await api.getProjectManifest();
  if (result.status === 'ready') return { manifest: result.manifest, note: undefined };
  return { manifest: await api.getDemoManifest(), note: previewNote(result) };
}

const PREVIEW_INPUTS = /^(project\.json|storyboard\.json|timing\/words\.json|scenes\/.+)$/i;

/** True when a change can alter the project's video (or the change list is incomplete). */
export function affectsPreview(event: ProjectChangedEvent): boolean {
  return event.truncated || event.paths.some((file) => PREVIEW_INPUTS.test(file));
}
