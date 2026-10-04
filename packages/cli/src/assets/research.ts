/**
 * `assets search` and `assets propose`: the guard decides first (no request before it), then the
 * allowed sources are queried through the guarded transport.
 */
import {
  ASSET_PROPOSAL_VERSION,
  type AssetCandidate,
  type AssetKind,
  type AssetProposal,
  type ProposalItem,
} from '@reelforge/shared';
import { downloadVerified } from './acquire.js';
import { allowedSources, assertActionAllowed, urlPolicy, type ResearchSettings } from './guard.js';
import { ASSET_LIMITS } from './limits.js';
import { readResearchSettings, sourceHttp, type AssetRuntime } from './runtime.js';
import { ASSET_PATHS, nextProposalNumber, writeProposal } from './store.js';
import { describeUnknown } from '../errors.js';

export interface SearchRequest {
  readonly source: string;
  readonly query: string;
  readonly kind: AssetKind | undefined;
  readonly limit: number;
}

export interface SearchOutcome {
  readonly settings: ResearchSettings;
  readonly sources: readonly string[];
  readonly candidates: readonly AssetCandidate[];
  /** Sources that failed (the others still answered). */
  readonly failures: readonly { readonly source: string; readonly message: string }[];
}

export async function searchAssets(
  root: string,
  runtime: AssetRuntime,
  request: SearchRequest,
): Promise<SearchOutcome> {
  const settings = await readResearchSettings(root);
  assertActionAllowed(settings, 'search');
  const adapters = allowedSources(settings, runtime.sources, request.source).filter(
    (adapter) => request.kind === undefined || adapter.kinds.includes(request.kind),
  );
  const candidates: AssetCandidate[] = [];
  const failures: { source: string; message: string }[] = [];
  for (const adapter of adapters) {
    try {
      const found = await adapter.search(
        request.query,
        { kind: request.kind, limit: request.limit },
        sourceHttp(settings, adapter, runtime.transport),
      );
      candidates.push(...found);
    } catch (error) {
      failures.push({ source: adapter.id, message: describeUnknown(error) });
    }
  }
  return { settings, sources: adapters.map((adapter) => adapter.id), candidates, failures };
}

/** `wikimedia:123` -> source + id (the id may itself contain colons). */
export function parseCandidateKey(key: string): { source: string; id: string } | undefined {
  const separator = key.indexOf(':');
  if (separator <= 0 || separator === key.length - 1) return undefined;
  return { source: key.slice(0, separator), id: key.slice(separator + 1) };
}

export interface ProposeOutcome {
  readonly file: string;
  readonly proposal: AssetProposal;
  readonly problems: readonly string[];
}

async function proposalItem(
  root: string,
  runtime: AssetRuntime,
  settings: ResearchSettings,
  key: string,
  thumbnailName: string,
  problems: string[],
): Promise<ProposalItem | undefined> {
  const parsed = parseCandidateKey(key);
  if (parsed === undefined) {
    problems.push(`${key}: not a candidate key (<source>:<id> from \`reelforge assets search\`)`);
    return undefined;
  }
  const [adapter] = allowedSources(settings, runtime.sources, parsed.source);
  if (adapter === undefined) return undefined;
  let candidate: AssetCandidate | undefined;
  try {
    candidate = (await adapter.lookup(parsed.id, sourceHttp(settings, adapter, runtime.transport)))
      ?.candidate;
  } catch (error) {
    problems.push(`${key}: lookup failed (${describeUnknown(error)})`);
    return undefined;
  }
  if (candidate === undefined) {
    problems.push(`${key}: ${adapter.label} does not know this id`);
    return undefined;
  }
  let thumbnail: string | null = null;
  if (candidate.thumbnailUrl !== null) {
    try {
      const stored = await downloadVerified({
        root,
        folder: ASSET_PATHS.thumbnails,
        name: thumbnailName,
        url: candidate.thumbnailUrl,
        policy: urlPolicy(settings, adapter),
        transport: runtime.transport,
        kind: 'image',
        maxBytes: ASSET_LIMITS.thumbnailBytes,
        deadlineMs: ASSET_LIMITS.apiDeadlineMs,
      });
      thumbnail = stored.file;
    } catch (error) {
      problems.push(`${key}: no thumbnail (${describeUnknown(error)})`);
    }
  }
  return { candidate, thumbnail, approved: false };
}

/** Builds proposal package n+1 from fresh lookups (never from metadata the caller supplies). */
export async function proposeAssets(
  root: string,
  runtime: AssetRuntime,
  keys: readonly string[],
): Promise<ProposeOutcome> {
  const settings = await readResearchSettings(root);
  assertActionAllowed(settings, 'propose');
  const number = await nextProposalNumber(root);
  const problems: string[] = [];
  const items: ProposalItem[] = [];
  for (const [index, key] of keys.entries()) {
    const item = await proposalItem(
      root,
      runtime,
      settings,
      key,
      `p${String(number)}-${String(index + 1)}`,
      problems,
    );
    if (item !== undefined) items.push(item);
  }
  const proposal: AssetProposal = {
    version: ASSET_PROPOSAL_VERSION,
    number,
    createdAt: runtime.now().toISOString(),
    items,
  };
  if (items.length === 0) return { file: '', proposal, problems };
  return { file: await writeProposal(root, proposal), proposal, problems };
}
