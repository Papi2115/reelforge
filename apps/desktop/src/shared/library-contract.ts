/**
 * IPC payloads of the global asset library in the app (PLAN.md#12.19, ADR-015): search with
 * filters, favourite / tag / remove an entry, and "Use in project" (a copy into the open project's
 * store, no download). Library pictures reach the renderer only as `reelforge-media://library/
 * <sha256>.<ext>` (a strict file name, served from the library's files folder). Merged into
 * ASSETS_IPC (assets-contract.ts).
 */
import { assetKindSchema, LIBRARY_LICENCE_FILTERS } from '@reelforge/shared';
import { z } from 'zod';
import { MEDIA_SCHEME } from './player-contract.js';

/** Host of library pictures on the media scheme. */
export const LIBRARY_MEDIA_HOST = 'library';

/** `reelforge-media://library/<file>?w=<width>` (a thumbnail of a library picture). */
export function libraryMediaUrl(file: string, width: number): string {
  return `${MEDIA_SCHEME}://${LIBRARY_MEDIA_HOST}/${encodeURIComponent(file)}?w=${String(width)}`;
}

export const libraryEntryViewSchema = z.object({
  sha256: z.string(),
  assetId: z.string(),
  kind: assetKindSchema,
  title: z.string(),
  description: z.string(),
  author: z.string(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  licence: z.object({ id: z.string(), url: z.string().nullable(), verified: z.boolean() }),
  /** `verified` / `unverified` (⚠) / `own` (the user's file). */
  group: z.enum(LIBRARY_LICENCE_FILTERS),
  tags: z.array(z.string()),
  favorite: z.boolean(),
  originProject: z.string(),
  addedAt: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  /** Library file name of a picture (`<sha256>.<ext>`), null for videos. */
  image: z.string().nullable(),
  /** The open project already has these bytes. */
  inProject: z.boolean(),
});
export type LibraryEntryView = z.infer<typeof libraryEntryViewSchema>;

export const libraryQuerySchema = z.strictObject({
  text: z.string().max(200).optional(),
  tag: z.string().max(40).optional(),
  kind: assetKindSchema.optional(),
  licence: z.enum(LIBRARY_LICENCE_FILTERS).optional(),
  favorites: z.boolean().optional(),
});
export type LibraryQueryRequest = z.infer<typeof libraryQuerySchema>;

export const libraryStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    entries: z.array(libraryEntryViewSchema),
    /** Entries in the whole library. */
    total: z.number().int().nonnegative(),
    /** Every tag in use (for the filter). */
    tags: z.array(z.string()),
    /** A project is open ("Use in project" possible). */
    projectOpen: z.boolean(),
    /** The index was damaged and moved aside, else null. */
    problem: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type LibraryState = z.infer<typeof libraryStateSchema>;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const libraryEditRequestSchema = z.strictObject({
  sha256: sha256Schema,
  favorite: z.boolean().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});
export type LibraryEditRequest = z.infer<typeof libraryEditRequestSchema>;

export const libraryEntryRequestSchema = z.strictObject({ sha256: sha256Schema });

/** Result of an asset or library action (import, edit, remove, save, use…). */
export const assetActionResultSchema = z.object({
  status: z.enum(['ok', 'cancelled', 'error']),
  message: z.string().nullable(),
});
export type AssetActionResult = z.infer<typeof assetActionResultSchema>;

export const LIBRARY_IPC = {
  libraryState: {
    name: 'library:state',
    request: libraryQuerySchema,
    response: libraryStateSchema,
  },
  libraryEdit: {
    name: 'library:edit',
    request: libraryEditRequestSchema,
    response: assetActionResultSchema,
  },
  libraryRemove: {
    name: 'library:remove',
    request: libraryEntryRequestSchema,
    response: assetActionResultSchema,
  },
  /** Copies the entry into the open project's assets (no download). */
  libraryUse: {
    name: 'library:use',
    request: libraryEntryRequestSchema,
    response: assetActionResultSchema,
  },
} as const;

export interface LibraryApi {
  getLibraryState(query: LibraryQueryRequest): Promise<LibraryState>;
  editLibraryEntry(request: LibraryEditRequest): Promise<AssetActionResult>;
  removeLibraryEntry(sha256: string): Promise<AssetActionResult>;
  useLibraryEntry(sha256: string): Promise<AssetActionResult>;
}
