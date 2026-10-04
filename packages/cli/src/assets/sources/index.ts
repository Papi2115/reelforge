/**
 * The source registry: one adapter per allowlisted catalogue. Endpoints are injectable (tests
 * point them at a local server). Keyed sources (Pexels, Pixabay) are only a hook for now: they
 * need a free API key from the app settings, which is never stored in a project.
 */
import { ALLOWLIST_SOURCES, KEYED_SOURCES } from '@reelforge/shared';
import { internetArchiveSource } from './internet-archive.js';
import { locSource } from './loc.js';
import { nasaSource } from './nasa.js';
import { openverseSource } from './openverse.js';
import type { SourceAdapter, SourceEndpoints } from './types.js';
import { wikimediaSource } from './wikimedia.js';

export type AllowlistSourceId = (typeof ALLOWLIST_SOURCES)[number];
export type KeyedSourceId = (typeof KEYED_SOURCES)[number];

export interface SourceRegistryOptions {
  readonly endpoints?: Partial<Record<AllowlistSourceId, SourceEndpoints>> | undefined;
  /**
   * API key of a keyed source, provided by the app (environment of the CLI process, set from the
   * app settings). Hook only: no keyed adapter exists yet.
   */
  readonly apiKey?: ((source: KeyedSourceId) => string | undefined) | undefined;
}

export interface SourceRegistry {
  /** Adapters in allowlist order. */
  readonly adapters: readonly SourceAdapter[];
  /** Why a keyed source (Pexels, Pixabay) cannot be used, or undefined for any other id. */
  unavailableReason(id: string): string | undefined;
}

export function createSourceRegistry(options: SourceRegistryOptions = {}): SourceRegistry {
  const endpoints = options.endpoints ?? {};
  const factories: Readonly<Record<AllowlistSourceId, (e?: SourceEndpoints) => SourceAdapter>> = {
    wikimedia: wikimediaSource,
    openverse: openverseSource,
    'internet-archive': internetArchiveSource,
    nasa: nasaSource,
    loc: locSource,
  };
  const adapters = ALLOWLIST_SOURCES.map((id) => factories[id](endpoints[id]));
  return {
    adapters,
    unavailableReason(id) {
      const keyed = KEYED_SOURCES.find((source) => source === id);
      if (keyed === undefined) return undefined;
      const configured = options.apiKey?.(keyed) !== undefined;
      return configured
        ? `${id} is not supported yet (planned; its API key is configured)`
        : `${id} needs a free API key set in the app settings, and is not supported yet`;
    },
  };
}

export type { SourceAdapter, SourceEndpoints, SourceHttp, SourceItem } from './types.js';
