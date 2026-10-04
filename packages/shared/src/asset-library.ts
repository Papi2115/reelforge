/**
 * The global asset library (PLAN.md#12.19, ADR-015): approved, downloaded and own assets shared
 * between projects, in the app data folder (outside every project and outside git). One index
 * `library/library.json` plus the bytes in `library/files/<sha256>.<ext>`; an entry keeps the
 * source, author, licence and links of the asset, so an unverified licence stays flagged in every
 * project that uses it.
 */
import { z } from 'zod';
import {
  assetIdSchema,
  assetKindSchema,
  assetLicenceSchema,
  assetMimeSchema,
  assetOriginSchema,
} from './assets.js';

export const ASSET_LIBRARY_VERSION = 1;

/** A tag: lower-case words, digits and dashes (normalised by `normaliseLibraryTag`). */
export const libraryTagSchema = z.string().regex(/^[a-z0-9][a-z0-9 -]{0,31}$/);

/** File name of the bytes inside `library/files/`. */
export const libraryFileNameSchema = z
  .string()
  .regex(/^[0-9a-f]{64}\.(?:png|jpg|webp|gif|mp4|webm)$/);

export const libraryEntrySchema = z.object({
  /** Identity of the entry: the same bytes are stored once. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  file: libraryFileNameSchema,
  kind: assetKindSchema,
  mime: assetMimeSchema,
  bytes: z.int().nonnegative(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  /** Asset id in the project it came from: the id a project gets when it uses the entry. */
  assetId: assetIdSchema,
  source: assetOriginSchema,
  sourceItemId: z.string().max(200).nullable(),
  sourceUrl: z.string().max(1000),
  downloadUrl: z.string().max(1000),
  title: z.string().max(200),
  author: z.string().max(120),
  description: z.string().max(500).optional(),
  licence: assetLicenceSchema,
  tags: z.array(libraryTagSchema).max(20),
  favorite: z.boolean(),
  /** ISO timestamp. */
  addedAt: z.string(),
  /** Folder name of the project it was added from (a name only, never a path). */
  originProject: z.string().max(120),
});
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

/** `<app data>/library/library.json`. */
export const assetLibraryFileSchema = z.object({
  version: z.literal(ASSET_LIBRARY_VERSION),
  entries: z.array(libraryEntrySchema),
});
export type AssetLibraryFile = z.infer<typeof assetLibraryFileSchema>;

/** Licence filter of a library search: verified open licence, unverified (⚠) or the user's own. */
export const LIBRARY_LICENCE_FILTERS = ['verified', 'unverified', 'own'] as const;
export type LibraryLicenceFilter = (typeof LIBRARY_LICENCE_FILTERS)[number];

/** `"  Space  Race! "` -> `space race`; empty when nothing usable is left. */
export function normaliseLibraryTag(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ -]+/, '')
    .slice(0, 32)
    .trim();
}
