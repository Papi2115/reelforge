/**
 * NASA Image and Video Library (images-api.nasa.gov): `/search` (images and videos), lookup by
 * `nasa_id`, then `/asset/<id>` for the file list. NASA media are generally not copyrighted; the
 * licence is recorded as NASA's media usage guidelines. Format recorded 2026-10-04.
 */
import type { AssetCandidate, AssetKind, AssetLicence } from '@reelforge/shared';
import { z } from 'zod';
import { ASSET_LIMITS } from '../limits.js';
import { cleanAuthor, sanitizeText, sanitizeUrl, TEXT_LIMITS } from '../untrusted.js';
import { licenceFrom } from './licences.js';
import {
  buildUrl,
  SourceError,
  type SourceAdapter,
  type SourceEndpoints,
  type SourceHttp,
} from './types.js';

export const NASA_ENDPOINTS: SourceEndpoints = {
  api: 'https://images-api.nasa.gov',
  hosts: ['nasa.gov'],
};

const NASA_LICENCE: AssetLicence = licenceFrom(
  'NASA media usage guidelines',
  'https://www.nasa.gov/nasa-brand-center/images-and-media/',
);

const dataSchema = z.object({
  nasa_id: z.string(),
  title: z.string().optional(),
  media_type: z.string(),
  photographer: z.string().optional(),
  secondary_creator: z.string().optional(),
  center: z.string().optional(),
});
const linkSchema = z.object({
  href: z.string(),
  rel: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});
const itemSchema = z.object({
  data: z.array(dataSchema).min(1),
  links: z.array(linkSchema).optional(),
});
const collectionSchema = z.object({
  collection: z.object({ items: z.array(z.unknown()) }),
});
const assetSchema = z.object({
  collection: z.object({ items: z.array(z.object({ href: z.string() })) }),
});

/** NASA ids are free-form (`jsc2007e034221`, `Apollo 11 Overview`). */
const NASA_ID = /^[A-Za-z0-9][A-Za-z0-9 ._,()-]{0,199}$/;

/** Preferred renditions: big enough for a 640-px pixel look, small enough to stay under caps. */
const PREFERRED: Readonly<Record<AssetKind, readonly string[]>> = {
  image: ['~large.jpg', '~medium.jpg', '~orig.jpg', '~large.png', '~orig.png'],
  video: ['~mobile.mp4', '~preview.mp4', '~small.mp4', '~medium.mp4', '~orig.mp4'],
};

function kindOf(mediaType: string): AssetKind | undefined {
  if (mediaType === 'image') return 'image';
  if (mediaType === 'video') return 'video';
  return undefined;
}

/** NASA lists its own files as http://; their hosts serve https too. */
function upgradeNasaUrl(href: string): string | null {
  const text = sanitizeUrl(href);
  if (text === null) return null;
  const url = new URL(text);
  if (url.protocol === 'http:' && /(^|\.)nasa\.gov$/.test(url.hostname)) url.protocol = 'https:';
  return url.toString();
}

function toCandidate(raw: unknown): AssetCandidate | undefined {
  const item = itemSchema.safeParse(raw);
  if (!item.success) return undefined;
  const [data] = item.data.data;
  const kind = data === undefined ? undefined : kindOf(data.media_type);
  if (data === undefined || kind === undefined || !NASA_ID.test(data.nasa_id)) return undefined;
  const preview = item.data.links?.find((link) => link.rel === 'preview') ?? item.data.links?.[0];
  const author = data.photographer ?? data.secondary_creator ?? `NASA ${data.center ?? ''}`;
  return {
    source: 'nasa',
    id: data.nasa_id,
    kind,
    title: sanitizeText(data.title, TEXT_LIMITS.title) || data.nasa_id,
    author: cleanAuthor(author, 'NASA'),
    licence: NASA_LICENCE,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`,
    thumbnailUrl: preview === undefined ? null : upgradeNasaUrl(preview.href),
    width: null,
    height: null,
    bytes: null,
  };
}

async function downloadUrlFor(
  candidate: AssetCandidate,
  api: string,
  http: SourceHttp,
): Promise<string | undefined> {
  const raw = await http.json(buildUrl(api, `/asset/${encodeURIComponent(candidate.id)}`));
  const parsed = assetSchema.safeParse(raw);
  if (!parsed.success)
    throw new SourceError('NASA answered the asset list in an unexpected format');
  const hrefs = parsed.data.collection.items.map((entry) => entry.href);
  for (const suffix of PREFERRED[candidate.kind]) {
    const match = hrefs.find((href) => href.toLowerCase().endsWith(suffix));
    if (match !== undefined) return upgradeNasaUrl(match) ?? undefined;
  }
  return undefined;
}

export function nasaSource(endpoints: SourceEndpoints = NASA_ENDPOINTS): SourceAdapter {
  const searchUrl = (query: Readonly<Record<string, string | number>>): string =>
    buildUrl(endpoints.api, '/search', query);
  const parse = (raw: unknown): unknown[] => {
    const parsed = collectionSchema.safeParse(raw);
    if (!parsed.success) throw new SourceError('NASA answered in an unexpected format');
    return parsed.data.collection.items;
  };
  return {
    id: 'nasa',
    label: 'NASA Image and Video Library',
    kinds: ['image', 'video'],
    hosts: endpoints.hosts,
    aggregator: false,
    async search(query, filters, http) {
      const items = parse(
        await http.json(
          searchUrl({
            q: query,
            media_type: filters.kind ?? 'image,video',
            page_size: Math.min(filters.limit, ASSET_LIMITS.maxSearchResults),
          }),
        ),
      );
      return items
        .flatMap((raw) => toCandidate(raw) ?? [])
        .filter((candidate) => filters.kind === undefined || candidate.kind === filters.kind)
        .slice(0, filters.limit);
    },
    async lookup(id, http) {
      if (!NASA_ID.test(id)) return undefined;
      const candidate = parse(await http.json(searchUrl({ nasa_id: id })))
        .map(toCandidate)
        .find((entry) => entry?.id === id);
      if (candidate === undefined) return undefined;
      return { candidate, downloadUrl: await downloadUrlFor(candidate, endpoints.api, http) };
    },
  };
}
