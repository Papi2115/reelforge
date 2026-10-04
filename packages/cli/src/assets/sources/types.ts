/** Contract of an asset source adapter (Wikimedia Commons, Openverse, Internet Archive, ...). */
import type { AssetCandidate, AssetKind, AssetSourceId } from '@reelforge/shared';

export interface SearchFilters {
  /** Only this kind; undefined = every kind the source has. */
  readonly kind: AssetKind | undefined;
  readonly limit: number;
}

/** JSON GET through the guarded transport (mode, hosts, SSRF, size and time limits). */
export interface SourceHttp {
  json(url: string): Promise<unknown>;
}

/** Where a source lives; tests point every base at a local server. */
export interface SourceEndpoints {
  /** Base URL of the API (no trailing slash). */
  readonly api: string;
  /** Extra bases some sources build URLs from (downloads, thumbnails). */
  readonly files?: string | undefined;
  /** Domains (suffix match) the API, thumbnails and downloads may use. */
  readonly hosts: readonly string[];
}

export interface SourceAdapter {
  readonly id: AssetSourceId;
  readonly label: string;
  readonly kinds: readonly AssetKind[];
  readonly hosts: readonly string[];
  /**
   * Aggregators (Openverse) index files hosted by their providers: the download host is the one
   * the API names for that item (exact host), in addition to `hosts`.
   */
  readonly aggregator: boolean;
  search(query: string, filters: SearchFilters, http: SourceHttp): Promise<AssetCandidate[]>;
  /**
   * Fresh metadata of one item and the file to download, straight from the source (never from
   * what the caller claims). Undefined when the source does not know the id.
   */
  lookup(id: string, http: SourceHttp): Promise<SourceItem | undefined>;
}

export interface SourceItem {
  readonly candidate: AssetCandidate;
  /** Undefined when the item has no file in an allowed format within the size caps. */
  readonly downloadUrl: string | undefined;
}

/** Item ids are echoed into URLs and file names: a conservative character set. */
export function isSafeItemId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(id) && !id.includes('..');
}

/** `base` + path segments + query, with every value encoded. */
export function buildUrl(
  base: string,
  pathSuffix: string,
  query: Readonly<Record<string, string | number>> = {},
): string {
  const url = new URL(`${base}${pathSuffix}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  return url.toString();
}

/** A source answered with something unusable (bad JSON shape, no downloadable file). */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}
