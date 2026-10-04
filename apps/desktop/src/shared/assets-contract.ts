/**
 * IPC payloads of asset research in the app (PLAN.md#12.10): the open project's research mode,
 * downloaded assets (⚠ = unverified licence), the proposal packages waiting for the user's review
 * (ask mode) and the "Credits" text; the review itself (approve the checked items, the rest is
 * rejected). Only the app approves: no command of the runtime Claude can. Every text that came
 * from the internet is sanitised in main and shown as plain text. Merged into ipc-contract.ts.
 */
import { assetIdSchema, assetKindSchema, researchModeSchema } from '@reelforge/shared';
import { z } from 'zod';
import {
  assetActionResultSchema,
  LIBRARY_IPC,
  type AssetActionResult,
  type LibraryApi,
} from './library-contract.js';

export const assetLicenceViewSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  verified: z.boolean(),
});
export type AssetLicenceView = z.infer<typeof assetLicenceViewSchema>;

/** An asset of assets.json (downloaded, the user's own file or a library copy). */
export const assetViewSchema = z.object({
  id: z.string(),
  kind: assetKindSchema,
  title: z.string(),
  author: z.string(),
  /** Source id (`wikimedia`, `nasa`, …), `web` (a direct URL, full-auto) or `own`. */
  source: z.string(),
  sourceUrl: z.string().nullable(),
  licence: assetLicenceViewSchema,
  /** The user approved it in a package (ask mode). */
  approved: z.boolean(),
  /** Project-relative image file for a preview (`.reelforge/assets/…`); null for videos. */
  image: z.string().nullable(),
  /** The user's own file (PLAN.md#12.12). */
  own: z.boolean(),
  /** What it shows, in the user's words ('' when none). */
  description: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  /** Copied from the asset library. */
  fromLibrary: z.boolean(),
  /** Its bytes are in the global asset library (PLAN.md#12.19). */
  inLibrary: z.boolean(),
});
export type AssetView = z.infer<typeof assetViewSchema>;

/** One candidate of a package under review. */
export const proposalItemViewSchema = z.object({
  /** `<source>:<id>`: what the review approves. */
  key: z.string(),
  kind: assetKindSchema,
  title: z.string(),
  author: z.string(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
  licence: assetLicenceViewSchema,
  width: z.number().nullable(),
  height: z.number().nullable(),
  /** Project-relative thumbnail (`.reelforge/assets/thumbnails/…`), null when it failed. */
  thumbnail: z.string().nullable(),
});
export type ProposalItemView = z.infer<typeof proposalItemViewSchema>;

export const proposalViewSchema = z.object({
  number: z.number().int().positive(),
  createdAt: z.string(),
  items: z.array(proposalItemViewSchema),
});
export type ProposalView = z.infer<typeof proposalViewSchema>;

export const creditsViewSchema = z.object({
  /** The "Credits" text for the video description (same as `reelforge assets credits`). */
  markdown: z.string(),
  /** `used`: assets a scene or the storyboard names; `all`: none is used yet, every asset. */
  scope: z.enum(['used', 'all']),
  count: z.number().int().nonnegative(),
});
export type CreditsView = z.infer<typeof creditsViewSchema>;

export const assetsStateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    mode: researchModeSchema,
    /** Sources of the allowlist mode. */
    sources: z.array(z.string()),
    assets: z.array(assetViewSchema),
    /** Packages waiting for the user's review, oldest first. */
    pending: z.array(proposalViewSchema),
    credits: creditsViewSchema,
    /** A damaged assets.json / proposal file (the rest still shows), else null. */
    problem: z.string().nullable(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type AssetsState = z.infer<typeof assetsStateSchema>;

export const MAX_REVIEW_ITEMS = 50;

export const assetsReviewRequestSchema = z.strictObject({
  number: z.number().int().positive(),
  /** Keys to approve; every other item of the package is rejected (empty = reject all). */
  approve: z.array(z.string().min(1).max(300)).max(MAX_REVIEW_ITEMS),
});
export type AssetsReviewRequest = z.infer<typeof assetsReviewRequestSchema>;

export const assetsReviewResultSchema = z.object({
  status: z.enum(['ok', 'queued', 'error']),
  message: z.string().nullable(),
});
export type AssetsReviewResult = z.infer<typeof assetsReviewResultSchema>;

/** Add own files: the picked paths (drag and drop) or, without paths, main's file picker. */
export const MAX_IMPORT_FILES = 50;
export const assetsImportRequestSchema = z.strictObject({
  paths: z.array(z.string().min(1).max(2_000)).max(MAX_IMPORT_FILES).optional(),
});
export type AssetsImportRequest = z.infer<typeof assetsImportRequestSchema>;

export const assetsEditRequestSchema = z.strictObject({
  id: assetIdSchema,
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});
export type AssetsEditRequest = z.infer<typeof assetsEditRequestSchema>;

export const assetsLibraryRequestSchema = z.strictObject({ id: assetIdSchema, save: z.boolean() });
export type AssetsLibraryRequest = z.infer<typeof assetsLibraryRequestSchema>;

export const ASSETS_IPC = {
  assetsState: { name: 'assets:state', request: z.null(), response: assetsStateSchema },
  /** Approves the checked items of a package (the rest rejected); approved ones are downloaded. */
  assetsReview: {
    name: 'assets:review',
    request: assetsReviewRequestSchema,
    response: assetsReviewResultSchema,
  },
  /** Imports the user's own files into the open project (PLAN.md#12.12). */
  assetsImport: {
    name: 'assets:import',
    request: assetsImportRequestSchema,
    response: assetActionResultSchema,
  },
  assetsEdit: {
    name: 'assets:edit',
    request: assetsEditRequestSchema,
    response: assetActionResultSchema,
  },
  assetsRemove: {
    name: 'assets:remove',
    request: z.strictObject({ id: assetIdSchema }),
    response: assetActionResultSchema,
  },
  /** Saves an asset of the project to the global library, or takes it out (PLAN.md#12.19). */
  assetsLibrary: {
    name: 'assets:library',
    request: assetsLibraryRequestSchema,
    response: assetActionResultSchema,
  },
  ...LIBRARY_IPC,
} as const;

export interface AssetsApi extends LibraryApi {
  getAssetsState(): Promise<AssetsState>;
  reviewAssets(request: AssetsReviewRequest): Promise<AssetsReviewResult>;
  importAssets(request: AssetsImportRequest): Promise<AssetActionResult>;
  editAsset(request: AssetsEditRequest): Promise<AssetActionResult>;
  removeAsset(id: string): Promise<AssetActionResult>;
  setAssetInLibrary(request: AssetsLibraryRequest): Promise<AssetActionResult>;
  /** File-system paths of files dropped on the page (Electron `webUtils`; '' when none). */
  droppedFilePaths(files: readonly File[]): string[];
}
