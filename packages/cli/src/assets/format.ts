/** Text formatting of candidates and catalogue entries (external text always inside the block). */
import type { AssetCandidate, AssetLicence, AssetRecord } from '@reelforge/shared';
import { candidateKey } from '@reelforge/shared';
import { FetchFailed, FetchRefused } from './http.js';
import { GuardRefusal } from './guard.js';
import { SourceError } from './sources/types.js';
import { ProjectError } from '../errors.js';
import { quoted, sanitizeText, TEXT_LIMITS, untrustedBlock } from './untrusted.js';

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'size ?';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

export function formatSize(width: number | null, height: number | null): string {
  return width === null || height === null ? '?x?' : `${String(width)}x${String(height)}`;
}

export function licenceLabel(licence: AssetLicence): string {
  return `${sanitizeText(licence.id, TEXT_LIMITS.licence)} (${licence.verified ? 'verified' : 'UNVERIFIED'})`;
}

/** One numbered candidate: the key and facts first, the untrusted title/author indented. */
export function candidateLines(candidate: AssetCandidate, index: number): string[] {
  return [
    `${String(index + 1)}. ${candidateKey(candidate)}  ${candidate.kind} ${formatSize(candidate.width, candidate.height)} ${formatBytes(candidate.bytes)}  licence ${licenceLabel(candidate.licence)}`,
    `   title: ${quoted(sanitizeText(candidate.title, TEXT_LIMITS.title))}`,
    `   author: ${quoted(sanitizeText(candidate.author, TEXT_LIMITS.author))}`,
  ];
}

export function candidateBlock(candidates: readonly AssetCandidate[]): string[] {
  return untrustedBlock(candidates.flatMap((candidate, index) => candidateLines(candidate, index)));
}

/** A catalogue entry (assets.json may have been edited, so its text is cleaned again). */
export function recordLines(record: AssetRecord): string[] {
  return [
    `- ${record.id}  ${record.kind} ${record.mime} ${formatSize(record.width, record.height)} ${formatBytes(record.bytes)}  from ${record.source}  licence ${licenceLabel(record.licence)}${record.approved ? '  approved by the user' : ''}`,
    `   title: ${quoted(sanitizeText(record.title, TEXT_LIMITS.title))}`,
    `   author: ${quoted(sanitizeText(record.author, TEXT_LIMITS.author))}`,
  ];
}

/** Guard refusals and network/source failures as a project error (exit 1, message + fix). */
export function asProjectError(error: unknown): unknown {
  if (error instanceof GuardRefusal)
    return new ProjectError(`refused: ${error.message}`, error.fix);
  if (error instanceof FetchRefused) {
    return new ProjectError(
      `refused: ${error.message}`,
      'nothing was downloaded; pick another candidate or source (never try another way to download it)',
    );
  }
  if (error instanceof FetchFailed || error instanceof SourceError) {
    return new ProjectError(
      `download failed: ${error.message}`,
      'nothing was kept; try another candidate or try again later',
    );
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new ProjectError(
      'download aborted (time limit)',
      'try a smaller file or try again later',
    );
  }
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return new ProjectError(
      `network error: ${error.message}`,
      'nothing was kept; check that the computer is online or try again later',
    );
  }
  return error;
}
