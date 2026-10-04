import type { AssetCandidate, ResearchMode } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  allowedSources,
  assertActionAllowed,
  assertLicenceAllowed,
  GuardRefusal,
  urlPolicy,
  type AssetAction,
  type ResearchSettings,
} from './guard.js';
import { createSourceRegistry } from './sources/index.js';

const registry = createSourceRegistry();
const { adapters } = registry;
const settings = (
  mode: ResearchMode,
  sources: ResearchSettings['sources'] = [],
): ResearchSettings => ({
  mode,
  sources,
});

function allowed(mode: ResearchMode, action: AssetAction): boolean {
  try {
    assertActionAllowed(settings(mode, ['nasa']), action);
    return true;
  } catch (error) {
    if (error instanceof GuardRefusal) return false;
    throw error;
  }
}

describe('the guard matrix', () => {
  it('allows exactly these actions per mode', () => {
    const actions: AssetAction[] = ['search', 'propose', 'fetch-source', 'fetch-url'];
    const matrix = Object.fromEntries(
      (['off', 'ask', 'allowlist', 'full-auto'] as const).map((mode) => [
        mode,
        actions.filter((action) => allowed(mode, action)),
      ]),
    );
    expect(matrix).toEqual({
      off: [],
      ask: ['search', 'propose', 'fetch-source'],
      allowlist: ['search', 'fetch-source'],
      'full-auto': ['search', 'fetch-source', 'fetch-url'],
    });
  });

  it('limits sources: allowlist = researchSources, others = the global allowlist', () => {
    const ids = (
      mode: ResearchMode,
      requested: string,
      sources?: ResearchSettings['sources'],
    ): string[] =>
      allowedSources(settings(mode, sources), registry, requested).map((adapter) => adapter.id);
    expect(ids('ask', 'all')).toEqual([
      'wikimedia',
      'openverse',
      'internet-archive',
      'nasa',
      'loc',
    ]);
    expect(ids('allowlist', 'all', ['nasa', 'wikimedia'])).toEqual(['wikimedia', 'nasa']);
    expect(() => ids('allowlist', 'loc', ['nasa'])).toThrow(/not allowed here/);
    expect(() => ids('allowlist', 'all', [])).toThrow(/no sources selected/);
    expect(() => ids('full-auto', 'youtube')).toThrow(/not allowed here/);
    expect(() => ids('full-auto', 'pexels')).toThrow(
      /needs a free API key set in the app settings/,
    );
    const keyed = createSourceRegistry({
      apiKey: (source) => (source === 'pixabay' ? 'k' : undefined),
    });
    expect(() => allowedSources(settings('full-auto'), keyed, 'pixabay')).toThrow(
      'not supported yet (planned',
    );
  });

  it('allowlist fetches verified licences only', () => {
    const candidate = (verified: boolean): AssetCandidate => ({
      source: 'loc',
      id: '1',
      kind: 'image',
      title: 't',
      author: 'a',
      licence: { id: verified ? 'CC0 1.0' : 'unverified', url: null, verified },
      sourceUrl: 'https://www.loc.gov/item/1/',
      thumbnailUrl: null,
      width: null,
      height: null,
      bytes: null,
    });
    expect(() => {
      assertLicenceAllowed(settings('allowlist', ['loc']), candidate(false));
    }).toThrow(/not a verified open licence/);
    expect(() => {
      assertLicenceAllowed(settings('allowlist', ['loc']), candidate(true));
    }).not.toThrow();
    expect(() => {
      assertLicenceAllowed(settings('ask'), candidate(false));
    }).not.toThrow();
    expect(() => {
      assertLicenceAllowed(settings('full-auto'), candidate(false));
    }).not.toThrow();
  });

  it('URL policy: source hosts, the aggregator file host, any host only for full-auto URLs', () => {
    const nasa = adapters.find((adapter) => adapter.id === 'nasa');
    const openverse = adapters.find((adapter) => adapter.id === 'openverse');
    if (nasa === undefined || openverse === undefined) throw new Error('missing adapters');
    const check = (policy: ReturnType<typeof urlPolicy>, url: string): string | undefined =>
      policy(new URL(url), 0);
    expect(
      check(urlPolicy(settings('ask'), nasa), 'https://images-assets.nasa.gov/x.jpg'),
    ).toBeUndefined();
    expect(check(urlPolicy(settings('ask'), nasa), 'https://nasa.gov.evil.example/x.jpg')).toMatch(
      /not a host/,
    );
    const ov = urlPolicy(settings('allowlist', ['openverse']), openverse, 'live.staticflickr.com');
    expect(check(ov, 'https://live.staticflickr.com/1/x.jpg')).toBeUndefined();
    expect(check(ov, 'https://farm1.staticflickr.com/1/x.jpg')).toMatch(/not a host/);
    expect(
      check(urlPolicy(settings('full-auto'), undefined), 'https://example.org/x.png'),
    ).toBeUndefined();
    expect(
      check(urlPolicy(settings('allowlist', ['nasa']), undefined), 'https://example.org/x.png'),
    ).toMatch(/full-auto/);
    expect(check(urlPolicy(settings('off'), nasa), 'https://images-assets.nasa.gov/x.jpg')).toMatch(
      /off/,
    );
  });
});
