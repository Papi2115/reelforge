/**
 * Library of Congress JSON API (loc.gov `fo=json`): `/photos/?q=` search, `/item/<id>/` lookup.
 * Licence = the item's rights advisory: only "No known restrictions on publication" counts as
 * verified. Shapes follow the documented API (loc.gov/apis/json-and-yaml); the live service sits
 * behind a bot challenge from some networks, so the fixtures are written from the docs.
 */
import type { AssetCandidate } from '@reelforge/shared';
import { z } from 'zod';
import { ASSET_LIMITS } from '../limits.js';
import { cleanAuthor, sanitizeText, sanitizeUrl, TEXT_LIMITS } from '../untrusted.js';
import { licenceFrom, unverifiedLicence } from './licences.js';
import {
  buildUrl,
  isSafeItemId,
  SourceError,
  type SourceAdapter,
  type SourceEndpoints,
} from './types.js';

export const LOC_ENDPOINTS: SourceEndpoints = {
  api: 'https://www.loc.gov',
  hosts: ['loc.gov'],
};

const textList = z.union([z.string(), z.array(z.string())]).optional();
const resultSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  image_url: z.array(z.string()).optional(),
  contributor: textList,
  contributor_names: textList,
  rights_advisory: textList,
});
const searchSchema = z.object({ results: z.array(z.unknown()) });
const itemSchema = z.object({ item: resultSchema });
type Result = z.infer<typeof resultSchema>;

function joined(value: string | readonly string[] | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : value.join(', ');
}

/** `http://www.loc.gov/item/2017762891/` -> `2017762891`. */
function itemId(idUrl: string): string | undefined {
  const match = /\/item\/([^/?#]+)\/?/.exec(idUrl);
  const id = match?.[1];
  return id !== undefined && isSafeItemId(id) ? id : undefined;
}

function imageUrl(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const absolute = raw.startsWith('//') ? `https:${raw}` : raw;
  return sanitizeUrl(absolute.split('#')[0]);
}

function toCandidate(result: Result): AssetCandidate | undefined {
  const id = itemId(result.id);
  const images = result.image_url ?? [];
  if (id === undefined || images.length === 0) return undefined;
  const rights = joined(result.rights_advisory);
  const sourceUrl = sanitizeUrl(result.url) ?? `https://www.loc.gov/item/${id}/`;
  return {
    source: 'loc',
    id,
    kind: 'image',
    title: sanitizeText(result.title, TEXT_LIMITS.title) || id,
    author: cleanAuthor(joined(result.contributor_names ?? result.contributor)),
    licence: /no known restrictions/i.test(rights)
      ? licenceFrom('No known restrictions on publication', 'https://www.loc.gov/legal/')
      : unverifiedLicence(sourceUrl),
    sourceUrl,
    thumbnailUrl: imageUrl(images[0]),
    width: null,
    height: null,
    bytes: null,
  };
}

export function locSource(endpoints: SourceEndpoints = LOC_ENDPOINTS): SourceAdapter {
  return {
    id: 'loc',
    label: 'Library of Congress',
    kinds: ['image'],
    hosts: endpoints.hosts,
    aggregator: false,
    async search(query, filters, http) {
      if (filters.kind === 'video') return [];
      const url = buildUrl(endpoints.api, '/photos/', {
        q: query,
        fo: 'json',
        c: Math.min(filters.limit, ASSET_LIMITS.maxSearchResults),
      });
      const parsed = searchSchema.safeParse(await http.json(url));
      if (!parsed.success)
        throw new SourceError('Library of Congress answered in an unexpected format');
      return parsed.data.results
        .flatMap((raw) => {
          const result = resultSchema.safeParse(raw);
          return result.success ? (toCandidate(result.data) ?? []) : [];
        })
        .slice(0, filters.limit);
    },
    async lookup(id, http) {
      if (!isSafeItemId(id)) return undefined;
      const parsed = itemSchema.safeParse(
        await http.json(buildUrl(endpoints.api, `/item/${id}/`, { fo: 'json' })),
      );
      if (!parsed.success) return undefined;
      const candidate = toCandidate(parsed.data.item);
      if (candidate?.id !== id) return undefined;
      const largest = imageUrl(parsed.data.item.image_url?.at(-1));
      return { candidate, downloadUrl: largest ?? undefined };
    },
  };
}
