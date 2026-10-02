/**
 * IPC payloads of the main layout (PLAN.md#6.3): a read-only snapshot of the open project (file
 * listing + parsed storyboard / words / cues), the preview manifest built from it, and the
 * `projectChanged` push event. Every file is reported on its own (missing / ok / typed error), so
 * one broken file never hides the others. Main validates with the full schemas; the renderer gets
 * the shapes below (cues as a display view: the mix settings stay in main).
 */
import { renderManifestSchema, storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import { z } from 'zod';
import { projectErrorSchema } from './project-contract.js';

/** Project-relative locations the layout reads (forward slashes). */
export const SNAPSHOT_FILES = {
  project: 'project.json',
  storyboard: 'storyboard.json',
  words: 'timing/words.json',
  cues: 'cues.json',
} as const;

export const FILE_ERROR_KINDS = [
  'invalid-json',
  'invalid',
  'unreadable',
  'outside-project',
  'too-large',
] as const;

export const fileErrorSchema = z.object({
  kind: z.enum(FILE_ERROR_KINDS),
  message: z.string(),
});
export type FileErrorInfo = z.infer<typeof fileErrorSchema>;

export type FileState<T> =
  | { readonly status: 'missing' }
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'error'; readonly error: FileErrorInfo };

function fileStateSchema<Data extends z.ZodType>(data: Data) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('missing') }),
    z.object({ status: z.literal('ok'), data }),
    z.object({ status: z.literal('error'), error: fileErrorSchema }),
  ]);
}

const rangeCueSchema = z.object({ from: z.number(), to: z.number(), label: z.string() });

/** `cues.json` reduced to what the timeline shows. */
export const cuesViewSchema = z.object({
  sfx: z.array(z.object({ t: z.number(), label: z.string() })),
  ambience: z.array(rangeCueSchema),
  music: z.array(rangeCueSchema),
});
export type CuesView = z.infer<typeof cuesViewSchema>;

export const projectSnapshotSchema = z.object({
  dir: z.string(),
  /** Files of the project root and its pipeline folders (audio, timing, scenes, out), sorted. */
  files: z.array(z.string()),
  /** True when the listing hit its size cap. */
  filesTruncated: z.boolean(),
  storyboard: fileStateSchema(storyboardFileSchema),
  words: fileStateSchema(wordsFileSchema),
  cues: fileStateSchema(cuesViewSchema),
});
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

export const projectSnapshotResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), snapshot: projectSnapshotSchema }),
  z.object({ status: z.literal('error'), error: projectErrorSchema }),
]);
export type ProjectSnapshotResult = z.infer<typeof projectSnapshotResultSchema>;

export const projectManifestResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), manifest: renderManifestSchema }),
  /** The Storyboard stage has not run yet. */
  z.object({ status: z.literal('no-storyboard') }),
  /** Files exist but cannot become a video (invalid file, missing scene, …). */
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type ProjectManifestResult = z.infer<typeof projectManifestResultSchema>;

export const MAX_CHANGED_PATHS = 50;

export const projectChangedSchema = z.object({
  dir: z.string(),
  /** Changed project-relative paths (forward slashes), at most MAX_CHANGED_PATHS. */
  paths: z.array(z.string()).max(MAX_CHANGED_PATHS),
  /** True when some changes are not listed (too many, or the OS did not name the file). */
  truncated: z.boolean(),
});
export type ProjectChangedEvent = z.infer<typeof projectChangedSchema>;
