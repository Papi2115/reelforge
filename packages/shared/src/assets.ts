/**
 * Asset research (PLAN.md#12.9, ADR-012): the project's research mode, the open-licence sources,
 * the tracked asset catalogue `assets.json` and the proposal packages of the `ask` mode
 * (`.reelforge/assets/proposals/<n>.json`, outside the runtime Claude's reach).
 */
import { z } from 'zod';

/**
 * `ask` = Claude proposes, the user approves each package in the app; `allowlist` = automatic,
 * only the sources picked in `researchSources`; `full-auto` = any https host except the ban list,
 * unknown licences marked `unverified` (risky); `off` = zero network.
 */
export const RESEARCH_MODES = ['ask', 'allowlist', 'full-auto', 'off'] as const;
export const researchModeSchema = z.enum(RESEARCH_MODES);
export type ResearchMode = z.infer<typeof researchModeSchema>;

/** Projects without the field (made before 2.1) never touch the network. */
export const DEFAULT_RESEARCH_MODE: ResearchMode = 'off';
/** What the project template (new projects) sets. */
export const TEMPLATE_RESEARCH_MODE: ResearchMode = 'ask';

/** The global allowlist: open-licence catalogues with structured licence metadata. */
export const ALLOWLIST_SOURCES = [
  'wikimedia',
  'openverse',
  'internet-archive',
  'nasa',
  'loc',
] as const;
/** Sources that need a free API key from the app settings (not stored in projects). */
export const KEYED_SOURCES = ['pexels', 'pixabay'] as const;
export const ASSET_SOURCES = [...ALLOWLIST_SOURCES, ...KEYED_SOURCES] as const;
export const assetSourceIdSchema = z.enum(ASSET_SOURCES);
export type AssetSourceId = z.infer<typeof assetSourceIdSchema>;
/** `web` = a direct URL fetched in full-auto mode (no catalogue behind it). */
export const assetOriginSchema = z.union([assetSourceIdSchema, z.literal('web')]);
export type AssetOrigin = z.infer<typeof assetOriginSchema>;

export const assetKindSchema = z.enum(['image', 'video']);
export type AssetKind = z.infer<typeof assetKindSchema>;

/** The MIME types an asset may have (verified by magic bytes, never by Content-Type). */
export const ASSET_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const;
export const assetMimeSchema = z.enum(ASSET_MIMES);
export type AssetMime = z.infer<typeof assetMimeSchema>;

export const assetLicenceSchema = z.object({
  /** Short id, e.g. `CC BY-SA 4.0`, `CC0 1.0`, `Public domain`, `unverified`. */
  id: z.string().min(1).max(80),
  url: z.string().max(500).nullable(),
  /** True when the licence comes from the source's structured metadata and is an open one. */
  verified: z.boolean(),
});
export type AssetLicence = z.infer<typeof assetLicenceSchema>;

/** A search result of a source (all text already sanitised: it comes from the internet). */
export const assetCandidateSchema = z.object({
  source: assetSourceIdSchema,
  /** Id inside the source (page id, nasa_id, Openverse uuid, IA identifier...). */
  id: z.string().min(1).max(200),
  kind: assetKindSchema,
  title: z.string().max(200),
  author: z.string().max(120),
  licence: assetLicenceSchema,
  /** Human page of the item (for credits). */
  sourceUrl: z.string().max(1000),
  thumbnailUrl: z.string().max(1000).nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  bytes: z.int().nonnegative().nullable(),
});
export type AssetCandidate = z.infer<typeof assetCandidateSchema>;

export const ASSETS_FILE_VERSION = 1;
/** Asset ids double as file names: lower-case, digits, dashes. */
export const assetIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);

export const assetRecordSchema = z.object({
  id: assetIdSchema,
  kind: assetKindSchema,
  source: assetOriginSchema,
  /** Id inside the source; null for `web`. */
  sourceItemId: z.string().max(200).nullable(),
  sourceUrl: z.string().max(1000),
  downloadUrl: z.string().max(1000),
  title: z.string().max(200),
  author: z.string().max(120),
  licence: assetLicenceSchema,
  /** Project-relative path of the bytes (git-ignored), e.g. `.reelforge/assets/nasa-x.jpg`. */
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.int().nonnegative(),
  mime: assetMimeSchema,
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  /** Research mode the asset was fetched under. */
  mode: researchModeSchema,
  /** The user approved it in the app (ask mode); false for automatic fetches. */
  approved: z.boolean(),
  /** ISO timestamp. */
  fetchedAt: z.string(),
});
export type AssetRecord = z.infer<typeof assetRecordSchema>;

/** `<project>/assets.json`: the tracked catalogue (metadata only; bytes stay out of git). */
export const assetsFileSchema = z.object({
  version: z.literal(ASSETS_FILE_VERSION),
  assets: z.array(assetRecordSchema),
});
export type AssetsFile = z.infer<typeof assetsFileSchema>;

export const ASSET_PROPOSAL_VERSION = 1;

export const proposalItemSchema = z.object({
  candidate: assetCandidateSchema,
  /** Project-relative thumbnail fetched for the review screen, or null when it failed. */
  thumbnail: z.string().nullable(),
  /** Set by the user in the app (never by the runtime Claude). */
  approved: z.boolean(),
});
export type ProposalItem = z.infer<typeof proposalItemSchema>;

/** `.reelforge/assets/proposals/<n>.json`: one package the user reviews (ask mode). */
export const assetProposalSchema = z.object({
  version: z.literal(ASSET_PROPOSAL_VERSION),
  number: z.int().positive(),
  createdAt: z.string(),
  items: z.array(proposalItemSchema).min(1),
});
export type AssetProposal = z.infer<typeof assetProposalSchema>;

/** `<source>:<id>`, the key the CLI prints and accepts. */
export function candidateKey(candidate: Pick<AssetCandidate, 'source' | 'id'>): string {
  return `${candidate.source}:${candidate.id}`;
}
