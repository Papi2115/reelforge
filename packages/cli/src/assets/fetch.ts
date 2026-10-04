/**
 * `fetch-asset`: one file into `.reelforge/assets/` plus its record in `assets.json`. From a
 * source (`--source/--id`: fresh metadata from the source's API) or, in full-auto only, from a
 * direct URL (licence `unverified`).
 */
import { createHash } from 'node:crypto';
import {
  assetIdSchema,
  candidateKey,
  type AssetKind,
  type AssetRecord,
  type AssetSourceId,
} from '@reelforge/shared';
import { ProjectError, UsageError } from '../errors.js';
import { downloadVerified, type StoredFile } from './acquire.js';
import {
  allowedSources,
  assertActionAllowed,
  assertLicenceAllowed,
  GuardRefusal,
  urlPolicy,
  type ResearchSettings,
} from './guard.js';
import { deadlineFor, maxBytesFor } from './limits.js';
import { readResearchSettings, sourceHttp, type AssetRuntime } from './runtime.js';
import { unverifiedLicence } from './sources/licences.js';
import { addToCatalogue, ASSET_PATHS, isApproved, readCatalogue } from './store.js';
import { sanitizeText, sanitizeUrl, TEXT_LIMITS, UNKNOWN_AUTHOR } from './untrusted.js';

const ID_PREFIX: Readonly<Record<AssetSourceId | 'web', string>> = {
  wikimedia: 'wm',
  openverse: 'ov',
  'internet-archive': 'ia',
  nasa: 'nasa',
  loc: 'loc',
  pexels: 'px',
  pixabay: 'pb',
  web: 'web',
};

function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 10);
}

/** `nasa` + `Apollo 11 Overview` -> `nasa-apollo-11-overview` (hash-suffixed when lossy). */
export function defaultAssetId(source: AssetSourceId | 'web', itemId: string): string {
  const prefix = ID_PREFIX[source];
  const slug = itemId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const plain = `${prefix}-${slug}`;
  if (slug !== '' && slug === itemId && plain.length <= 64) return plain;
  return `${`${prefix}-${slug}`.slice(0, 52).replace(/-+$/, '')}-${shortHash(itemId)}`;
}

export interface FetchRequest {
  readonly source: string | undefined;
  readonly id: string | undefined;
  readonly url: string | undefined;
  readonly as: string | undefined;
  readonly kind: AssetKind | undefined;
}

export interface FetchOutcome {
  readonly record: AssetRecord;
  /** True when the asset was already in the catalogue (nothing downloaded). */
  readonly existing: boolean;
}

function chosenId(requested: string | undefined, fallback: string): string {
  if (requested === undefined) return fallback;
  if (!assetIdSchema.safeParse(requested).success) {
    throw new UsageError(
      `--as "${requested}": use 1–64 lower-case letters, digits and dashes, e.g. --as moon-landing`,
    );
  }
  return requested;
}

async function assertIdFree(
  root: string,
  id: string,
  sameItem: (r: AssetRecord) => boolean,
): Promise<AssetRecord | undefined> {
  const catalogue = await readCatalogue(root);
  const taken = catalogue.assets.find((record) => record.id === id);
  if (taken !== undefined && !sameItem(taken)) {
    throw new UsageError(
      `asset id "${id}" is already used by another asset; pick another with --as <name>`,
    );
  }
  return catalogue.assets.find(sameItem);
}

function recordFrom(
  base: Omit<AssetRecord, 'file' | 'sha256' | 'bytes' | 'mime' | 'width' | 'height'>,
  stored: StoredFile,
): AssetRecord {
  const { file, sha256, bytes, mime, width, height } = stored;
  return { ...base, file, sha256, bytes, mime, width, height };
}

async function fetchFromSource(
  root: string,
  runtime: AssetRuntime,
  settings: ResearchSettings,
  request: FetchRequest & { source: string; id: string },
): Promise<FetchOutcome> {
  assertActionAllowed(settings, 'fetch-source');
  const [adapter] = allowedSources(settings, runtime.sources, request.source);
  if (adapter === undefined) throw new UsageError(`unknown source ${request.source}`);
  const key = candidateKey({ source: adapter.id, id: request.id });
  if (settings.mode === 'ask' && !(await isApproved(root, key))) {
    throw new GuardRefusal(
      `${key} is not approved by the user (research mode "ask")`,
      'propose it with `reelforge assets propose --ids <keys>` and wait until the user approves the package in the app',
    );
  }
  const id = chosenId(request.as, defaultAssetId(adapter.id, request.id));
  const existing = await assertIdFree(
    root,
    id,
    (record) => record.source === adapter.id && record.sourceItemId === request.id,
  );
  if (existing !== undefined) return { record: existing, existing: true };
  const item = await adapter.lookup(request.id, sourceHttp(settings, adapter, runtime.transport));
  if (item === undefined) {
    throw new ProjectError(
      `${adapter.label} does not know the id "${request.id}"`,
      'use a key printed by `reelforge assets search`',
    );
  }
  const { candidate, downloadUrl } = item;
  assertLicenceAllowed(settings, candidate);
  if (downloadUrl === undefined) {
    throw new ProjectError(
      `${key} has no file in an allowed format within the size limits`,
      'pick another candidate',
    );
  }
  const extraHost = adapter.aggregator ? new URL(downloadUrl).hostname : undefined;
  const stored = await downloadVerified({
    root,
    folder: ASSET_PATHS.files,
    name: id,
    url: downloadUrl,
    policy: urlPolicy(settings, adapter, extraHost),
    transport: runtime.transport,
    kind: candidate.kind,
    maxBytes: maxBytesFor(candidate.kind),
    deadlineMs: deadlineFor(candidate.kind),
  });
  const record = recordFrom(
    {
      id,
      kind: candidate.kind,
      source: adapter.id,
      sourceItemId: request.id,
      sourceUrl: candidate.sourceUrl,
      downloadUrl: sanitizeUrl(stored.finalUrl) ?? downloadUrl,
      title: candidate.title,
      author: candidate.author,
      licence: candidate.licence,
      mode: settings.mode,
      approved: settings.mode === 'ask',
      fetchedAt: runtime.now().toISOString(),
    },
    stored,
  );
  await addToCatalogue(root, record);
  return { record, existing: false };
}

/** Last path segment, decoded when it is valid percent-encoding (used only as a title). */
function fileNameOf(url: URL): string {
  const segment = url.pathname.split('/').at(-1) ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

async function fetchFromUrl(
  root: string,
  runtime: AssetRuntime,
  settings: ResearchSettings,
  request: FetchRequest & { url: string },
): Promise<FetchOutcome> {
  assertActionAllowed(settings, 'fetch-url');
  const url = sanitizeUrl(request.url);
  if (url === null) throw new UsageError('--url must be an absolute https URL');
  const kind = request.kind ?? 'image';
  const id = chosenId(request.as, defaultAssetId('web', url));
  const existing = await assertIdFree(
    root,
    id,
    (record) => record.source === 'web' && record.sourceUrl === url,
  );
  if (existing !== undefined) return { record: existing, existing: true };
  const stored = await downloadVerified({
    root,
    folder: ASSET_PATHS.files,
    name: id,
    url,
    policy: urlPolicy(settings, undefined),
    transport: runtime.transport,
    kind,
    maxBytes: maxBytesFor(kind),
    deadlineMs: deadlineFor(kind),
  });
  const lastSegment = fileNameOf(new URL(url));
  const record = recordFrom(
    {
      id,
      kind,
      source: 'web',
      sourceItemId: null,
      sourceUrl: url,
      downloadUrl: sanitizeUrl(stored.finalUrl) ?? url,
      title: sanitizeText(lastSegment, TEXT_LIMITS.title) || new URL(url).hostname,
      author: UNKNOWN_AUTHOR,
      licence: unverifiedLicence(),
      mode: settings.mode,
      approved: false,
      fetchedAt: runtime.now().toISOString(),
    },
    stored,
  );
  await addToCatalogue(root, record);
  return { record, existing: false };
}

export async function fetchAsset(
  root: string,
  runtime: AssetRuntime,
  request: FetchRequest,
): Promise<FetchOutcome> {
  const settings = await readResearchSettings(root);
  const { source, id, url } = request;
  if (url !== undefined && (source !== undefined || id !== undefined)) {
    throw new UsageError('use either --url or --source with --id, not both');
  }
  if (url !== undefined) return fetchFromUrl(root, runtime, settings, { ...request, url });
  if (source === undefined || id === undefined) {
    throw new UsageError(
      'give --source <id> and --id <candidate id> (from `reelforge assets search`), or --url',
    );
  }
  return fetchFromSource(root, runtime, settings, { ...request, source, id });
}
