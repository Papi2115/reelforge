/**
 * The research-mode guard (ADR-012): the single place that decides what each asset command may do
 * in each mode, which sources and hosts it may reach, and which licences it may fetch. Commands
 * call it BEFORE creating any request; `off` refuses everything with zero network activity.
 *
 * | mode       | search / propose             | fetch --source --id                | fetch --url            |
 * | off        | refused                      | refused                            | refused                |
 * | ask        | allowlist sources / same     | approved proposal items only       | refused                |
 * | allowlist  | researchSources / refused    | researchSources, verified licence  | refused                |
 * | full-auto  | allowlist sources / refused  | any source (licence as found)      | any https host, unverified |
 *
 * In every mode: the ban list (YouTube & co., sign-in/paywall hosts), https only, SSRF checks.
 */
import type { AssetCandidate, ResearchMode } from '@reelforge/shared';
import { ALLOWLIST_SOURCES } from '@reelforge/shared';
import { hostMatches } from './hosts.js';
import type { UrlPolicy } from './http.js';
import type { AllowlistSourceId, SourceAdapter, SourceRegistry } from './sources/index.js';

export type AssetAction = 'search' | 'propose' | 'fetch-source' | 'fetch-url';

export interface ResearchSettings {
  readonly mode: ResearchMode;
  /** `researchSources` of project.json (used by the `allowlist` mode). */
  readonly sources: readonly AllowlistSourceId[];
}

/** A refusal of the guard (the command reports it and exits 1, nothing requested). */
export class GuardRefusal extends Error {
  constructor(
    message: string,
    readonly fix: string,
  ) {
    super(message);
    this.name = 'GuardRefusal';
  }
}

const SETTINGS_FIX =
  'asset research is set per project in the app (Project settings → research mode); ask the user, do not work around it';

const OFF_MESSAGE =
  'asset research is off for this project (research mode "off"): no network access at all';
const OFF_FIX =
  "build the shot from the kit and the user's own assets (`reelforge assets list`); never try to download anything another way";

/** Throws when `action` is not allowed in the mode at all. */
export function assertActionAllowed(settings: ResearchSettings, action: AssetAction): void {
  const { mode } = settings;
  if (mode === 'off') throw new GuardRefusal(OFF_MESSAGE, OFF_FIX);
  if (action === 'propose' && mode !== 'ask') {
    throw new GuardRefusal(
      `"assets propose" is only for research mode "ask" (this project: "${mode}")`,
      'fetch directly with `reelforge fetch-asset --source <id> --id <id>`',
    );
  }
  if (action === 'fetch-url' && mode !== 'full-auto') {
    throw new GuardRefusal(
      `fetching a direct URL needs research mode "full-auto" (this project: "${mode}")`,
      mode === 'ask'
        ? 'search the open-licence sources (`reelforge assets search`) and propose candidates (`reelforge assets propose`); the user approves them in the app'
        : 'use `reelforge assets search` and `reelforge fetch-asset --source <id> --id <id>`',
    );
  }
}

/** The sources an action may use in the mode (`requested` = a source id or `all`). */
export function allowedSources(
  settings: ResearchSettings,
  registry: Pick<SourceRegistry, 'adapters' | 'unavailableReason'>,
  requested: string,
): SourceAdapter[] {
  const unavailable = registry.unavailableReason(requested);
  if (unavailable !== undefined) {
    throw new GuardRefusal(unavailable, 'use one of the open-licence sources instead');
  }
  const { adapters } = registry;
  const permitted: readonly string[] =
    settings.mode === 'allowlist'
      ? settings.sources.filter((id) => ALLOWLIST_SOURCES.includes(id))
      : ALLOWLIST_SOURCES;
  if (permitted.length === 0) {
    throw new GuardRefusal(
      'research mode "allowlist" has no sources selected for this project',
      SETTINGS_FIX,
    );
  }
  const usable = adapters.filter((adapter) => permitted.includes(adapter.id));
  if (requested === 'all') return usable;
  const match = usable.find((adapter) => adapter.id === requested);
  if (match === undefined) {
    throw new GuardRefusal(
      `source "${requested}" is not allowed here (mode "${settings.mode}"; allowed: ${usable.map((adapter) => adapter.id).join(', ')})`,
      `use one of the allowed sources; ${SETTINGS_FIX}`,
    );
  }
  return [match];
}

/** Licence rule of a fetch from a source (after the source's own fresh lookup). */
export function assertLicenceAllowed(settings: ResearchSettings, candidate: AssetCandidate): void {
  if (settings.mode !== 'allowlist' || candidate.licence.verified) return;
  throw new GuardRefusal(
    `the licence of ${candidate.source}:${candidate.id} ("${candidate.licence.id}") is not a verified open licence; research mode "allowlist" only fetches public-domain / CC0 / CC BY / CC BY-SA / FAL items`,
    'pick another candidate from `reelforge assets search` (the licence column must say verified)',
  );
}

/**
 * URL policy of one request chain: API calls and thumbnails of `adapter` stay on its hosts; a
 * download may also use the exact host an aggregator named (`extraHost`); full-auto direct URLs
 * (`adapter` undefined) may go to any host the transport accepts. Re-run on every redirect hop.
 */
export function urlPolicy(
  settings: ResearchSettings,
  adapter: SourceAdapter | undefined,
  extraHost?: string,
): UrlPolicy {
  return (url) => {
    if (settings.mode === 'off') return OFF_MESSAGE;
    if (adapter === undefined) {
      return settings.mode === 'full-auto'
        ? undefined
        : 'direct URLs need research mode "full-auto"';
    }
    const host = url.hostname;
    if (adapter.hosts.some((domain) => hostMatches(host, domain))) return undefined;
    if (extraHost !== undefined && host.toLowerCase() === extraHost.toLowerCase()) return undefined;
    return `${host} is not a host of ${adapter.label}`;
  };
}
