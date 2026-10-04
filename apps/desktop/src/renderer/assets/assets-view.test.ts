import { describe, expect, it } from 'vitest';
import type { AssetsState, AssetView, ProposalView } from '../../shared/assets-contract.js';
import {
  approvedKeys,
  approveLabel,
  assetsSummary,
  droppedMedia,
  exportAssetsView,
  initialSelection,
  licenceBadge,
  ownAssetMeta,
  sourceLabel,
  splitAssets,
  toggled,
} from './assets-view.js';

const PROPOSAL: ProposalView = {
  number: 2,
  createdAt: '2026-10-04T12:00:00.000Z',
  items: ['nasa:a', 'wikimedia:b', 'loc:c'].map((key, index) => ({
    key,
    kind: 'image',
    title: `Item ${String(index)}`,
    author: 'A',
    source: key.split(':')[0] ?? '',
    sourceUrl: null,
    licence: { id: index === 2 ? 'unverified' : 'CC0 1.0', url: null, verified: index !== 2 },
    width: 640,
    height: 480,
    thumbnail: null,
  })),
};

function asset(id: string, verified: boolean): AssetView {
  return {
    id,
    kind: 'image',
    title: `Title ${id}`,
    author: 'B',
    source: verified ? 'nasa' : 'web',
    sourceUrl: null,
    licence: { id: verified ? 'NASA' : 'unverified', url: null, verified },
    approved: false,
    image: null,
    own: false,
    description: '',
    width: 640,
    height: 480,
    fromLibrary: false,
    inLibrary: false,
  };
}

function own(id: string): AssetView {
  return {
    ...asset(id, true),
    source: 'own',
    licence: { id: 'own', url: null, verified: true },
    own: true,
    description: 'my desk',
  };
}

function state(
  assets: readonly AssetView[],
  scope: 'used' | 'all' = 'all',
): Extract<AssetsState, { status: 'ok' }> {
  return {
    status: 'ok',
    mode: 'full-auto',
    sources: [],
    assets: [...assets],
    pending: [],
    credits: { markdown: 'Credits\n', scope, count: assets.length },
    problem: null,
  };
}

describe('asset package review', () => {
  it('starts with the verified candidates ticked and approves in package order', () => {
    const selection = initialSelection(PROPOSAL);
    expect([...selection]).toEqual(['nasa:a', 'wikimedia:b']);
    const next = toggled(toggled(selection, 'nasa:a'), 'loc:c');
    expect(approvedKeys(PROPOSAL, new Set([...next, 'stale:key']))).toEqual([
      'wikimedia:b',
      'loc:c',
    ]);
    expect(approveLabel(0)).toBe('Approve selected');
    expect(approveLabel(2)).toBe('Approve selected (2)');
  });

  it('marks unverified licences with ⚠ and names sources', () => {
    expect(licenceBadge({ id: 'CC BY 4.0', url: null, verified: true })).toMatchObject({
      text: 'CC BY 4.0',
      tone: 'ok',
    });
    expect(licenceBadge({ id: 'unverified', url: null, verified: false }).text).toBe(
      '⚠ unverified',
    );
    expect(licenceBadge({ id: 'CC BY-NC 2.0', url: null, verified: false }).text).toBe(
      '⚠ CC BY-NC 2.0 (unverified)',
    );
    expect(sourceLabel('loc')).toBe('Library of Congress');
    expect(sourceLabel('web')).toBe('Web (direct link)');
  });
});

describe('export dialog assets', () => {
  it('warns about unverified assets without blocking and shows the credits', () => {
    expect(exportAssetsView(undefined)).toBeNull();
    expect(exportAssetsView(state([]))).toBeNull();
    const view = exportAssetsView(state([asset('ok-1', true), asset('web-x', false)]));
    expect(view?.warning).toBe(
      '⚠ 1 asset has an unverified licence: check it before publishing (the export is not blocked).',
    );
    expect(view?.unverified.map((item) => item.id)).toEqual(['web-x']);
    expect(view?.creditsTitle).toContain('every downloaded asset');
    const clean = exportAssetsView(state([asset('ok-1', true)], 'used'));
    expect(clean?.warning).toBeNull();
    expect(clean?.creditsTitle).toBe('Credits for the video description');
  });

  it('summarises the research state for the dialog heading', () => {
    expect(assetsSummary(state([asset('web-x', false)]))).toBe(
      'Research: Full auto ⚠ · 1 downloaded · 1 ⚠ unverified',
    );
    expect(assetsSummary({ ...state([]), mode: 'allowlist', sources: ['nasa', 'wikimedia'] })).toBe(
      'Research: Automatic from selected sources · sources: NASA Image and Video Library, Wikimedia Commons · 0 downloaded',
    );
    expect(assetsSummary({ status: 'error', message: 'No project is open.' })).toBe(
      'No project is open.',
    );
  });
});

describe('own files (PLAN.md#12.12)', () => {
  it('lists them apart, never warns or credits them, and counts them in the heading', () => {
    const mixed = [own('own-desk'), asset('web-x', false), asset('nasa-1', true)];
    const split = splitAssets(mixed);
    expect(split.own.map((item) => item.id)).toEqual(['own-desk']);
    expect(split.downloaded.map((item) => item.id)).toEqual(['web-x', 'nasa-1']);
    expect(exportAssetsView(state([own('own-desk')]))).toBeNull();
    expect(exportAssetsView(state(mixed))?.unverified.map((item) => item.id)).toEqual(['web-x']);
    expect(assetsSummary({ ...state(mixed), mode: 'off' })).toBe(
      'Research: Off (no network) · 1 your file · 2 downloaded · 1 ⚠ unverified',
    );
    expect(sourceLabel('own')).toBe('Your file');
    expect(ownAssetMeta(own('own-desk'))).toBe('Image · 640×480');
    expect(
      ownAssetMeta({ ...own('own-clip'), kind: 'video', width: null, fromLibrary: true }),
    ).toBe('Video · from your library');
  });

  it('takes dropped images and videos by extension and counts the rest', () => {
    expect(
      droppedMedia(['C:/a/Logo.PNG', 'C:/b/clip.webm', 'C:/c/notes.txt', '', 'D:/x/gif']),
    ).toEqual({ accepted: ['C:/a/Logo.PNG', 'C:/b/clip.webm'], skipped: 3 });
  });
});
