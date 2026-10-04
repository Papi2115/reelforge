/** Safety limits of asset research (ADR-012). */
import type { AssetKind } from '@reelforge/shared';

const MB = 1024 * 1024;

export const ASSET_LIMITS = {
  /** Largest image file accepted (bytes, enforced while streaming). */
  imageBytes: 25 * MB,
  /** Largest video file accepted. */
  videoBytes: 120 * MB,
  /** Largest thumbnail of a proposal. */
  thumbnailBytes: 2 * MB,
  /** Largest API (JSON) response. */
  jsonBytes: 4 * MB,
  /** Redirect hops per request (each one re-checked). */
  maxRedirects: 5,
  /** No byte for this long = abort. */
  idleTimeoutMs: 20_000,
  /** Whole request (headers + body) deadline for API calls and thumbnails. */
  apiDeadlineMs: 45_000,
  /** Whole download deadline per kind. */
  imageDeadlineMs: 120_000,
  videoDeadlineMs: 600_000,
  /** Results per search and source. */
  maxSearchResults: 20,
  /** Items per proposal package. */
  maxProposalItems: 12,
} as const;

export function maxBytesFor(kind: AssetKind): number {
  return kind === 'image' ? ASSET_LIMITS.imageBytes : ASSET_LIMITS.videoBytes;
}

export function deadlineFor(kind: AssetKind): number {
  return kind === 'image' ? ASSET_LIMITS.imageDeadlineMs : ASSET_LIMITS.videoDeadlineMs;
}
