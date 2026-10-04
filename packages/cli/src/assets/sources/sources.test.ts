/** Every adapter parses the recorded responses (no network: a fake SourceHttp serves fixtures). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assetCandidateSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { ASSET_FIXTURES } from '../testing/server.js';
import { internetArchiveSource, pickArchiveFile } from './internet-archive.js';
import {
  creativeCommonsLicence,
  isOpenLicence,
  licenceFrom,
  publicDomainLicenceFromUrl,
} from './licences.js';
import { locSource } from './loc.js';
import { nasaSource } from './nasa.js';
import { openverseSource } from './openverse.js';
import type { SourceHttp } from './types.js';
import { wikimediaSource } from './wikimedia.js';

function fixtureHttp(pick: (url: URL) => string): SourceHttp & { urls: URL[] } {
  const urls: URL[] = [];
  return {
    urls,
    json(url) {
      const parsed = new URL(url);
      urls.push(parsed);
      return Promise.resolve(
        JSON.parse(readFileSync(path.join(ASSET_FIXTURES, pick(parsed)), 'utf8')) as unknown,
      );
    },
  };
}

const filters = { kind: undefined, limit: 8 } as const;

describe('Wikimedia Commons', () => {
  const http = fixtureHttp((url) =>
    url.searchParams.has('pageids') ? 'wikimedia-lookup.json' : 'wikimedia-search.json',
  );

  it('searches the File namespace and reads licence/author from extmetadata', async () => {
    const found = await wikimediaSource().search('nokia 3310', { kind: 'image', limit: 5 }, http);
    expect(http.urls[0]?.searchParams.get('gsrsearch')).toBe('nokia 3310 filetype:bitmap');
    expect(http.urls[0]?.host).toBe('commons.wikimedia.org');
    expect(
      found.map((candidate) => [candidate.id, candidate.licence.id, candidate.licence.verified]),
    ).toEqual([
      ['47962045', 'CC BY-SA 4.0', true],
      ['105654713', 'FAL', true],
    ]);
    expect(found[0]).toMatchObject({
      author: 'Multicherry',
      kind: 'image',
      width: 2704,
      height: 4056,
    });
    // Artist markup 'smial (talk)': the signature link is dropped.
    expect(found[1]?.author).toBe('smial');
    for (const candidate of found) expect(assetCandidateSchema.parse(candidate)).toEqual(candidate);
  });

  it('looks up a page id with its download URL', async () => {
    const item = await wikimediaSource().lookup('105654713', http);
    expect(item?.downloadUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\/.*\.png\?/);
    expect(item?.candidate.sourceUrl).toBe(
      'https://commons.wikimedia.org/wiki/File:Nokia_3310_Blue_R7309170_(retouch).png',
    );
    expect(await wikimediaSource().lookup('../etc', http)).toBeUndefined();
  });
});

describe('Openverse', () => {
  const http = fixtureHttp((url) =>
    url.pathname === '/v1/images/' ? 'openverse-search.json' : 'openverse-lookup.json',
  );

  it('asks only for commercial + modification licences', async () => {
    const found = await openverseSource().search('nokia phone', filters, http);
    expect(http.urls[0]?.searchParams.get('license_type')).toBe('commercial,modification');
    expect(found).toHaveLength(2);
    expect(found[0]?.licence).toEqual({
      id: 'CC BY 2.0',
      url: 'https://creativecommons.org/licenses/by/2.0/',
      verified: true,
    });
    expect(found[0]?.thumbnailUrl).toMatch(
      /^https:\/\/api\.openverse\.org\/v1\/images\/.*\/thumb\/$/,
    );
    expect(await openverseSource().search('x', { kind: 'video', limit: 3 }, http)).toEqual([]);
  });

  it('looks up a uuid; the file lives on the provider host', async () => {
    const item = await openverseSource().lookup('cd8f24fd-9972-4c78-9b0d-abc90207e761', http);
    expect(item?.downloadUrl).toMatch(/^https:\/\/live\.staticflickr\.com\//);
    expect(await openverseSource().lookup('not-a-uuid', http)).toBeUndefined();
  });
});

describe('NASA', () => {
  const http = fixtureHttp((url) =>
    url.pathname.startsWith('/asset/')
      ? 'nasa-asset.json'
      : url.searchParams.has('nasa_id')
        ? 'nasa-lookup.json'
        : 'nasa-search.json',
  );

  it('searches images and videos with the NASA licence', async () => {
    const found = await nasaSource().search('apollo 11', filters, http);
    expect(http.urls[0]?.searchParams.get('media_type')).toBe('image,video');
    expect(found.map((candidate) => candidate.id)).toEqual(['jsc2007e034221', 'NHQ201907190151']);
    expect(found[1]?.author).toBe('NASA/Aubrey Gemignani');
    expect(found[0]?.licence.verified).toBe(true);
  });

  it('picks the large rendition over https', async () => {
    const item = await nasaSource().lookup('jsc2007e034221', http);
    expect(item?.downloadUrl).toBe(
      'https://images-assets.nasa.gov/image/jsc2007e034221/jsc2007e034221~large.jpg',
    );
  });
});

describe('Internet Archive', () => {
  const http = fixtureHttp((url) =>
    url.pathname.endsWith('advancedsearch.php')
      ? 'internet-archive-search.json'
      : 'internet-archive-metadata.json',
  );

  it('searches public-domain items only', async () => {
    const found = await internetArchiveSource().search('computer (old)', filters, http);
    const query = http.urls[0]?.searchParams.get('q') ?? '';
    expect(query).toContain('(computer old) AND mediatype:(movies OR image) AND licenseurl:(');
    expect(query).toContain('publicdomain/zero/1.0');
    expect(http.urls[0]?.searchParams.getAll('fl[]')).toEqual([
      'identifier',
      'title',
      'creator',
      'licenseurl',
      'mediatype',
    ]);
    expect(found.map((candidate) => [candidate.id, candidate.kind, candidate.licence.id])).toEqual([
      ['kabalrv42069', 'video', 'Public domain mark 1.0'],
      ['hs2-route-nov-2013', 'video', 'Public domain mark 1.0'],
      [
        'httpsnoodol-cafe.comgadgetbingung-pilih-laptop-atau-pc-ketahui-kelebihan-keduanya',
        'image',
        'Public domain mark 1.0',
      ],
    ]);
  });

  it('looks up an identifier and picks the smallest MP4', async () => {
    const item = await internetArchiveSource().lookup('Magpie3Explanation', http);
    expect(item?.downloadUrl).toBe(
      'https://archive.org/download/Magpie3Explanation/Magpie3Explanation.mp4',
    );
    expect(item?.candidate).toMatchObject({
      kind: 'video',
      author: 'Chris Thiel',
      bytes: 53147138,
    });
    const files = [
      { name: 'a.mp4', size: '900' },
      { name: 'b.mp4', size: '300' },
      { name: 'huge.mp4', size: String(500 * 1024 * 1024) },
      { name: 'x.thumbs/t.jpg', size: '10' },
      { name: 'p.png', size: '50' },
      { name: 'q.jpg', size: '70' },
    ];
    expect(pickArchiveFile(files, 'video')?.name).toBe('b.mp4');
    expect(pickArchiveFile(files, 'image')?.name).toBe('q.jpg');
  });
});

describe('Library of Congress', () => {
  const http = fixtureHttp((url) =>
    url.pathname === '/photos/' ? 'loc-search.json' : 'loc-item.json',
  );

  it('verifies only "no known restrictions" items', async () => {
    const found = await locSource().search('telephone', filters, http);
    expect(found.map((candidate) => [candidate.id, candidate.licence.verified])).toEqual([
      ['2017762891', true],
      ['2016800000', false],
    ]);
    expect(found[1]?.thumbnailUrl).toBe(
      'https://tile.loc.gov/storage-services/service/pnp/ds/00000/00001_150px.jpg',
    );
    const item = await locSource().lookup('2017762891', http);
    expect(item?.downloadUrl).toBe(
      'https://tile.loc.gov/storage-services/service/pnp/cph/3c00000/3c00000/3c00001r.jpg',
    );
  });
});

describe('licences', () => {
  it('verifies open licences only', () => {
    expect(isOpenLicence('CC BY-SA 3.0 de')).toBe(true);
    expect(isOpenLicence('CC BY-NC 2.0')).toBe(false);
    expect(isOpenLicence('CC BY-ND 4.0')).toBe(false);
    expect(isOpenLicence('GFDL')).toBe(false);
    expect(licenceFrom('', null)).toEqual({ id: 'unverified', url: null, verified: false });
    expect(
      creativeCommonsLicence(
        'by-nc-nd',
        '2.0',
        'https://creativecommons.org/licenses/by-nc-nd/2.0/',
      ).verified,
    ).toBe(false);
    expect(creativeCommonsLicence('cc0', '1.0', null)).toEqual({
      id: 'CC0 1.0',
      url: null,
      verified: true,
    });
    expect(publicDomainLicenceFromUrl('http://creativecommons.org/publicdomain/zero/1.0/').id).toBe(
      'CC0 1.0',
    );
    expect(publicDomainLicenceFromUrl('https://example.org/licence').verified).toBe(false);
  });
});
