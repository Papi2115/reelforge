/**
 * Internet Archive: `advancedsearch.php` restricted to items marked public domain (CC0 / Public
 * Domain Mark), lookup through `/metadata/<identifier>` (licence + file list), files from
 * `/download/<identifier>/<file>` (redirects to `*.archive.org` storage hosts).
 * Format recorded 2026-10-04 (test fixtures).
 */
import type { AssetCandidate, AssetKind } from '@reelforge/shared';
import { z } from 'zod';
import { ASSET_LIMITS, maxBytesFor } from '../limits.js';
import { cleanAuthor, sanitizeText, TEXT_LIMITS } from '../untrusted.js';
import { publicDomainLicenceFromUrl } from './licences.js';
import {
  isSafeItemId,
  SourceError,
  type SourceAdapter,
  type SourceEndpoints,
  type SourceItem,
} from './types.js';

export const INTERNET_ARCHIVE_ENDPOINTS: SourceEndpoints = {
  api: 'https://archive.org',
  files: 'https://archive.org',
  hosts: ['archive.org'],
};

const PUBLIC_DOMAIN_URLS = [
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'https://creativecommons.org/publicdomain/mark/1.0/',
  'http://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/publicdomain/zero/1.0/',
];

const text = z.union([z.string(), z.array(z.string())]).optional();
const docSchema = z.object({
  identifier: z.string(),
  title: text,
  creator: text,
  licenseurl: text,
  mediatype: z.string().optional(),
});
const searchSchema = z.object({ response: z.object({ docs: z.array(z.unknown()) }) });
const metadataSchema = z.object({
  metadata: docSchema,
  files: z.array(
    z.object({
      name: z.string(),
      format: z.string().optional(),
      size: z.union([z.string(), z.number()]).optional(),
    }),
  ),
});
type Doc = z.infer<typeof docSchema>;
type IaFile = z.infer<typeof metadataSchema>['files'][number];

const FILE_KINDS: readonly { readonly pattern: RegExp; readonly kind: AssetKind }[] = [
  { pattern: /\.mp4$/i, kind: 'video' },
  { pattern: /\.webm$/i, kind: 'video' },
  { pattern: /\.(?:jpe?g|png|gif|webp)$/i, kind: 'image' },
];

function first(value: string | readonly string[] | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : value.join(', ');
}

function kindOf(mediatype: string | undefined): AssetKind | undefined {
  if (mediatype === 'movies') return 'video';
  if (mediatype === 'image') return 'image';
  return undefined;
}

/** Lucene special characters out of the user's words. */
function searchWords(query: string): string {
  return query
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCandidate(doc: Doc, filesBase: string): AssetCandidate | undefined {
  const kind = kindOf(doc.mediatype);
  if (kind === undefined || !isSafeItemId(doc.identifier)) return undefined;
  const id = doc.identifier;
  return {
    source: 'internet-archive',
    id,
    kind,
    title: sanitizeText(first(doc.title), TEXT_LIMITS.title) || id,
    author: cleanAuthor(first(doc.creator)),
    licence: publicDomainLicenceFromUrl(first(doc.licenseurl)),
    sourceUrl: `https://archive.org/details/${id}`,
    thumbnailUrl: `${filesBase}/services/img/${id}`,
    width: null,
    height: null,
    bytes: null,
  };
}

function sizeOf(file: IaFile): number {
  const size = Number(file.size);
  return Number.isFinite(size) && size > 0 ? size : Number.POSITIVE_INFINITY;
}

/** Video: the smallest MP4/WebM under the cap; image: the largest JPEG/PNG/GIF/WebP under it. */
export function pickArchiveFile(files: readonly IaFile[], kind: AssetKind): IaFile | undefined {
  const usable = files.filter(
    (file) =>
      !file.name.includes('.thumbs/') &&
      !file.name.startsWith('__ia_thumb') &&
      !file.name.includes('..') &&
      FILE_KINDS.some((entry) => entry.kind === kind && entry.pattern.test(file.name)) &&
      sizeOf(file) <= maxBytesFor(kind),
  );
  const sorted = [...usable].sort((a, b) => sizeOf(a) - sizeOf(b));
  return kind === 'video' ? sorted[0] : sorted.at(-1);
}

export function internetArchiveSource(
  endpoints: SourceEndpoints = INTERNET_ARCHIVE_ENDPOINTS,
): SourceAdapter {
  const filesBase = endpoints.files ?? endpoints.api;
  return {
    id: 'internet-archive',
    label: 'Internet Archive (public domain)',
    kinds: ['image', 'video'],
    hosts: endpoints.hosts,
    aggregator: false,
    async search(query, filters, http) {
      const media =
        filters.kind === 'image'
          ? 'image'
          : filters.kind === 'video'
            ? 'movies'
            : '(movies OR image)';
      const licences = PUBLIC_DOMAIN_URLS.map((url) => `"${url}"`).join(' OR ');
      const url = new URL(`${endpoints.api}/advancedsearch.php`);
      url.searchParams.set(
        'q',
        `(${searchWords(query) || '*'}) AND mediatype:${media} AND licenseurl:(${licences})`,
      );
      for (const field of ['identifier', 'title', 'creator', 'licenseurl', 'mediatype']) {
        url.searchParams.append('fl[]', field);
      }
      url.searchParams.set('rows', String(Math.min(filters.limit, ASSET_LIMITS.maxSearchResults)));
      url.searchParams.set('output', 'json');
      const parsed = searchSchema.safeParse(await http.json(url.toString()));
      if (!parsed.success)
        throw new SourceError('Internet Archive answered in an unexpected format');
      return parsed.data.response.docs
        .flatMap((raw) => {
          const doc = docSchema.safeParse(raw);
          return doc.success ? (toCandidate(doc.data, filesBase) ?? []) : [];
        })
        .slice(0, filters.limit);
    },
    async lookup(id, http): Promise<SourceItem | undefined> {
      if (!isSafeItemId(id)) return undefined;
      const parsed = metadataSchema.safeParse(await http.json(`${endpoints.api}/metadata/${id}`));
      if (!parsed.success || parsed.data.metadata.identifier !== id) return undefined;
      const candidate = toCandidate(parsed.data.metadata, filesBase);
      if (candidate === undefined) return undefined;
      const file = pickArchiveFile(parsed.data.files, candidate.kind);
      const bytes = file === undefined || !Number.isFinite(sizeOf(file)) ? null : sizeOf(file);
      const path = file?.name.split('/').map(encodeURIComponent).join('/');
      return {
        candidate: { ...candidate, bytes },
        downloadUrl: path === undefined ? undefined : `${filesBase}/download/${id}/${path}`,
      };
    },
  };
}
