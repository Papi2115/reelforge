import { describe, expect, it } from 'vitest';
import {
  ALLOWLIST_SOURCES,
  assetProposalSchema,
  assetsFileSchema,
  candidateKey,
  DEFAULT_RESEARCH_MODE,
  TEMPLATE_RESEARCH_MODE,
} from './index.js';

const record = {
  id: 'nasa-jsc2007e034221',
  kind: 'image',
  source: 'nasa',
  sourceItemId: 'jsc2007e034221',
  sourceUrl: 'https://images.nasa.gov/details/jsc2007e034221',
  downloadUrl: 'https://images-assets.nasa.gov/image/jsc2007e034221/jsc2007e034221~large.jpg',
  title: 'Apollo 11 spacecraft pre-launch',
  author: 'NASA JSC',
  licence: { id: 'NASA media usage guidelines', url: null, verified: true },
  file: '.reelforge/assets/nasa-jsc2007e034221.jpg',
  sha256: 'f'.repeat(64),
  bytes: 331554,
  mime: 'image/jpeg',
  width: 1463,
  height: 1920,
  mode: 'allowlist',
  approved: false,
  fetchedAt: '2026-10-04T12:00:00.000Z',
};

describe('asset schemas', () => {
  it('defaults: legacy projects off, new projects ask; five allowlisted sources', () => {
    expect(DEFAULT_RESEARCH_MODE).toBe('off');
    expect(TEMPLATE_RESEARCH_MODE).toBe('ask');
    expect(ALLOWLIST_SOURCES).toEqual([
      'wikimedia',
      'openverse',
      'internet-archive',
      'nasa',
      'loc',
    ]);
  });

  it('validates assets.json records (ids are file names, MIME from the allowlist)', () => {
    expect(assetsFileSchema.safeParse({ version: 1, assets: [record] }).success).toBe(true);
    for (const bad of [
      { id: '../evil' },
      { id: 'Upper' },
      { mime: 'image/svg+xml' },
      { mime: 'text/html' },
      { source: 'youtube' },
      { sha256: 'xyz' },
    ]) {
      expect(
        assetsFileSchema.safeParse({ version: 1, assets: [{ ...record, ...bad }] }).success,
      ).toBe(false);
    }
    expect(
      assetsFileSchema.safeParse({
        version: 1,
        assets: [{ ...record, source: 'web', sourceItemId: null }],
      }).success,
    ).toBe(true);
  });

  it('validates proposals and builds candidate keys', () => {
    const candidate = {
      source: 'nasa',
      id: 'jsc2007e034221',
      kind: 'image',
      title: 't',
      author: 'a',
      licence: { id: 'NASA media usage guidelines', url: null, verified: true },
      sourceUrl: 'https://images.nasa.gov/details/jsc2007e034221',
      thumbnailUrl: null,
      width: null,
      height: null,
      bytes: null,
    } as const;
    const proposal = {
      version: 1,
      number: 1,
      createdAt: '2026-10-04T12:00:00.000Z',
      items: [{ candidate, thumbnail: null, approved: false }],
    };
    expect(assetProposalSchema.safeParse(proposal).success).toBe(true);
    expect(assetProposalSchema.safeParse({ ...proposal, items: [] }).success).toBe(false);
    expect(candidateKey(candidate)).toBe('nasa:jsc2007e034221');
  });
});
