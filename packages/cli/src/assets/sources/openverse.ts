/**
 * Openverse (openly licensed images indexed from many providers): `/v1/images/` search filtered
 * to licences that allow commercial use and modification, `/v1/images/<id>/` lookup. The file
 * lives on the provider's host (aggregator). Format recorded 2026-10-04 (test fixtures).
 */
import type { AssetCandidate } from '@reelforge/shared';
import { z } from 'zod';
import { ASSET_LIMITS } from '../limits.js';
import { cleanAuthor, sanitizeText, sanitizeUrl, TEXT_LIMITS } from '../untrusted.js';
import { creativeCommonsLicence } from './licences.js';
import {
  buildUrl,
  SourceError,
  type SourceAdapter,
  type SourceEndpoints,
  type SourceItem,
} from './types.js';

export const OPENVERSE_ENDPOINTS: SourceEndpoints = {
  api: 'https://api.openverse.org',
  hosts: ['openverse.org'],
};

const imageSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  foreign_landing_url: z.string().nullish(),
  url: z.string().nullish(),
  creator: z.string().nullish(),
  license: z.string().nullish(),
  license_version: z.string().nullish(),
  license_url: z.string().nullish(),
  thumbnail: z.string().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  filesize: z.number().nullish(),
  mature: z.boolean().nullish(),
});
const searchSchema = z.object({ results: z.array(z.unknown()) });
type Image = z.infer<typeof imageSchema>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toItem(image: Image): SourceItem | undefined {
  if (!UUID.test(image.id) || image.mature === true) return undefined;
  const bytes = positive(image.filesize);
  const candidate: AssetCandidate = {
    source: 'openverse',
    id: image.id,
    kind: 'image',
    title: sanitizeText(image.title, TEXT_LIMITS.title) || 'untitled',
    author: cleanAuthor(image.creator),
    licence: creativeCommonsLicence(image.license, image.license_version, image.license_url),
    sourceUrl: sanitizeUrl(image.foreign_landing_url) ?? `https://openverse.org/image/${image.id}`,
    thumbnailUrl: sanitizeUrl(image.thumbnail),
    width: positive(image.width),
    height: positive(image.height),
    bytes,
  };
  const fits = bytes === null || bytes <= ASSET_LIMITS.imageBytes;
  return { candidate, downloadUrl: fits ? (sanitizeUrl(image.url) ?? undefined) : undefined };
}

export function openverseSource(endpoints: SourceEndpoints = OPENVERSE_ENDPOINTS): SourceAdapter {
  return {
    id: 'openverse',
    label: 'Openverse',
    kinds: ['image'],
    hosts: endpoints.hosts,
    aggregator: true,
    async search(query, filters, http) {
      if (filters.kind === 'video') return [];
      const url = buildUrl(endpoints.api, '/v1/images/', {
        q: query,
        page_size: Math.min(filters.limit, ASSET_LIMITS.maxSearchResults),
        license_type: 'commercial,modification',
        mature: 'false',
      });
      const parsed = searchSchema.safeParse(await http.json(url));
      if (!parsed.success) throw new SourceError('Openverse answered in an unexpected format');
      return parsed.data.results
        .flatMap((raw) => {
          const image = imageSchema.safeParse(raw);
          return image.success ? (toItem(image.data)?.candidate ?? []) : [];
        })
        .slice(0, filters.limit);
    },
    async lookup(id, http) {
      if (!UUID.test(id)) return undefined;
      const image = imageSchema.safeParse(
        await http.json(buildUrl(endpoints.api, `/v1/images/${id}/`)),
      );
      if (!image.success) throw new SourceError('Openverse answered in an unexpected format');
      return image.data.id === id ? toItem(image.data) : undefined;
    },
  };
}
