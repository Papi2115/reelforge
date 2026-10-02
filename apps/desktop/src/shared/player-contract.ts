/**
 * Player contracts (PLAN.md#6.4): the project-media protocol the `<audio>` master clock streams
 * from, and the frame-snapshot IPC payloads. Main validates snapshots again (PNG header, size) and
 * picks the file name; the renderer never names a path.
 */
import { z } from 'zod';

/** Privileged scheme serving audio of the open project (range requests, project folder only). */
export const MEDIA_SCHEME = 'reelforge-media';
export const MEDIA_HOST = 'project';

/**
 * URL of a project-relative media file (forward slashes). `revision` busts the media cache when
 * the file is rewritten under the same name; main ignores the query.
 */
export function projectMediaUrl(relative: string, revision: number): string {
  const encoded = relative.split('/').map(encodeURIComponent).join('/');
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encoded}?v=${String(revision)}`;
}

/** Project-relative folder snapshots are written to. */
export const SNAPSHOT_DIR = 'out/snapshots';
/** Upper bound of an encoded snapshot (a 1920x1080 RGBA PNG is far below this). */
export const MAX_SNAPSHOT_BYTES = 24 * 1024 * 1024;
/** Largest accepted snapshot size in pixels (4K). */
export const MAX_SNAPSHOT_SIDE = 3840;

const pngBytesSchema = z
  .custom<Uint8Array>((value) => value instanceof Uint8Array, { message: 'expected PNG bytes' })
  .refine((bytes) => bytes.byteLength > 0 && bytes.byteLength <= MAX_SNAPSHOT_BYTES, {
    message: `PNG must be 1..${String(MAX_SNAPSHOT_BYTES)} bytes`,
  });

export const snapshotSaveRequestSchema = z.strictObject({
  png: pngBytesSchema,
  /** Global video time of the frame (seconds). */
  t: z.number().min(0).max(86_400),
  /** Shot on screen, used in the file name. */
  shotId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,32}$/)
    .optional(),
});
export type SnapshotSaveRequest = z.infer<typeof snapshotSaveRequestSchema>;

export const snapshotSaveResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('saved'),
    /** Absolute path of the written PNG. */
    path: z.string(),
    /** Project-relative path (forward slashes), e.g. `out/snapshots/s02_t002.200_640x360.png`. */
    relative: z.string(),
    width: z.int(),
    height: z.int(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type SnapshotSaveResult = z.infer<typeof snapshotSaveResultSchema>;

export const snapshotCopyRequestSchema = z.strictObject({ png: pngBytesSchema });
export type SnapshotCopyRequest = z.infer<typeof snapshotCopyRequestSchema>;

export const snapshotCopyResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('copied') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type SnapshotCopyResult = z.infer<typeof snapshotCopyResultSchema>;
