/**
 * Wikimedia Commons through the MediaWiki Action API: `generator=search` in the File namespace,
 * `prop=imageinfo` with `extmetadata` (LicenseShortName, LicenseUrl, Artist, ObjectName).
 * Lookup = the same query by `pageids`. Format recorded 2026-10-04 (test fixtures).
 */
import type { AssetCandidate, AssetKind } from '@reelforge/shared';
import { z } from 'zod';
import { ASSET_LIMITS, maxBytesFor } from '../limits.js';
import { cleanAuthor, sanitizeText, sanitizeUrl, TEXT_LIMITS } from '../untrusted.js';
import { licenceFrom } from './licences.js';
import {
  buildUrl,
  isSafeItemId,
  SourceError,
  type SourceAdapter,
  type SourceEndpoints,
  type SourceItem,
} from './types.js';

export const WIKIMEDIA_ENDPOINTS: SourceEndpoints = {
  api: 'https://commons.wikimedia.org/w/api.php',
  hosts: ['wikimedia.org'],
};

const metaValue = z.object({ value: z.unknown() }).optional();
const imageInfoSchema = z.object({
  url: z.string(),
  descriptionurl: z.string().optional(),
  thumburl: z.string().optional(),
  mime: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  extmetadata: z
    .object({
      ObjectName: metaValue,
      Artist: metaValue,
      LicenseShortName: metaValue,
      LicenseUrl: metaValue,
    })
    .optional(),
});
const pageSchema = z.object({
  pageid: z.number(),
  title: z.string(),
  index: z.number().optional(),
  imageinfo: z.array(imageInfoSchema).optional(),
});
const responseSchema = z.object({
  query: z.object({ pages: z.record(z.string(), pageSchema) }).optional(),
});
type Page = z.infer<typeof pageSchema>;

const MIME_KINDS: Readonly<Record<string, AssetKind>> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/webm': 'video',
};

function positive(value: number | undefined): number | null {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : null;
}

function toItem(page: Page): SourceItem | undefined {
  const info = page.imageinfo?.[0];
  const kind = info?.mime === undefined ? undefined : MIME_KINDS[info.mime];
  if (info === undefined || kind === undefined) return undefined;
  const meta = info.extmetadata;
  const fallbackTitle = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
  const title = sanitizeText(meta?.ObjectName?.value, TEXT_LIMITS.title);
  const bytes = positive(info.size);
  const candidate: AssetCandidate = {
    source: 'wikimedia',
    id: String(page.pageid),
    kind,
    title: title === '' ? sanitizeText(fallbackTitle, TEXT_LIMITS.title) : title,
    author: cleanAuthor(meta?.Artist?.value),
    licence: licenceFrom(meta?.LicenseShortName?.value, meta?.LicenseUrl?.value),
    sourceUrl:
      sanitizeUrl(info.descriptionurl) ??
      `https://commons.wikimedia.org/?curid=${String(page.pageid)}`,
    thumbnailUrl: sanitizeUrl(info.thumburl),
    width: positive(info.width),
    height: positive(info.height),
    bytes,
  };
  const fits = bytes === null || bytes <= maxBytesFor(kind);
  return { candidate, downloadUrl: fits ? (sanitizeUrl(info.url) ?? undefined) : undefined };
}

function pagesOf(raw: unknown): Page[] {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new SourceError('Wikimedia Commons answered in an unexpected format');
  const pages = Object.values(parsed.data.query?.pages ?? {});
  return pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

const IMAGE_INFO = {
  action: 'query',
  format: 'json',
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: 320,
  iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ObjectName',
} as const;

export function wikimediaSource(endpoints: SourceEndpoints = WIKIMEDIA_ENDPOINTS): SourceAdapter {
  return {
    id: 'wikimedia',
    label: 'Wikimedia Commons',
    kinds: ['image', 'video'],
    hosts: endpoints.hosts,
    aggregator: false,
    async search(query, filters, http) {
      const keyword =
        filters.kind === 'image'
          ? ' filetype:bitmap'
          : filters.kind === 'video'
            ? ' filetype:video'
            : '';
      const url = buildUrl(endpoints.api, '', {
        ...IMAGE_INFO,
        generator: 'search',
        gsrnamespace: 6,
        gsrsearch: `${query}${keyword}`,
        gsrlimit: Math.min(filters.limit * 2, ASSET_LIMITS.maxSearchResults * 2),
      });
      return pagesOf(await http.json(url))
        .flatMap((page) => toItem(page)?.candidate ?? [])
        .filter((candidate) => filters.kind === undefined || candidate.kind === filters.kind)
        .slice(0, filters.limit);
    },
    async lookup(id, http) {
      if (!/^\d{1,12}$/.test(id) || !isSafeItemId(id)) return undefined;
      const url = buildUrl(endpoints.api, '', { ...IMAGE_INFO, pageids: id });
      const page = pagesOf(await http.json(url)).find((entry) => String(entry.pageid) === id);
      return page === undefined ? undefined : toItem(page);
    },
  };
}
