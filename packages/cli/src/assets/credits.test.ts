import type { AssetRecord } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { creditsMarkdown, usedAssetIds } from './credits.js';

function record(overrides: Partial<AssetRecord>): AssetRecord {
  return {
    id: 'wm-105654713',
    kind: 'image',
    source: 'wikimedia',
    sourceItemId: '105654713',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nokia_3310_Blue_R7309170_(retouch).png',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/78/x.png',
    title: 'Nokia 3310 Blue R7309170 (retouch)',
    author: 'smial ( talk )',
    licence: { id: 'FAL', url: 'http://artlibre.org/licence/lal/en', verified: true },
    file: '.reelforge/assets/wm-105654713.png',
    sha256: 'a'.repeat(64),
    bytes: 3_260_558,
    mime: 'image/png',
    width: 948,
    height: 2160,
    mode: 'ask',
    approved: true,
    fetchedAt: '2026-10-04T12:00:00.000Z',
    ...overrides,
  };
}

const NASA = record({
  id: 'nasa-jsc2007e034221',
  source: 'nasa',
  sourceUrl: 'https://images.nasa.gov/details/jsc2007e034221',
  title: 'Apollo 11 spacecraft pre-launch',
  author: 'NASA JSC',
  licence: {
    id: 'NASA media usage guidelines',
    url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    verified: true,
  },
});
const WEB = record({
  id: 'old-phone',
  source: 'web',
  sourceItemId: null,
  sourceUrl: 'https://example.org/photos/old%20phone.png',
  title: 'old "phone".png <b>',
  author: 'unknown',
  licence: { id: 'unverified', url: null, verified: false },
});

describe('creditsMarkdown (golden)', () => {
  it('lists title, author, licence and link; marks and counts unverified licences', () => {
    expect(creditsMarkdown([record({}), NASA, WEB])).toBe(
      [
        'Credits',
        '',
        '- "Nokia 3310 Blue R7309170 (retouch)" by smial ( talk ), FAL (http://artlibre.org/licence/lal/en), https://commons.wikimedia.org/wiki/File:Nokia_3310_Blue_R7309170_(retouch).png',
        '- "Apollo 11 spacecraft pre-launch" by NASA JSC, NASA media usage guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/), https://images.nasa.gov/details/jsc2007e034221',
        '- "old ”phone”.png" by unknown, licence UNVERIFIED, https://example.org/photos/old%20phone.png [check licence]',
        '',
        'WARNING: 1 asset has an unverified licence ([check licence]); confirm the licence or replace it before publishing.',
        '',
      ].join('\n'),
    );
    expect(creditsMarkdown([])).toBe('Credits\n\n(no external assets used)\n');
  });
});

describe('usedAssetIds / reelforge assets credits', () => {
  let project: TempProject;
  beforeEach(async () => {
    project = await copyFixtureProject();
  });
  afterEach(async () => {
    await project.remove();
  });

  it('credits only the assets a scene or the storyboard names', async () => {
    await project.write('scenes/s99_photo.js', "// uses asset 'nasa-jsc2007e034221'\n");
    expect(
      await usedAssetIds(project.root, ['nasa-jsc2007e034221', 'wm-105654713', 'nasa-jsc2007e03']),
    ).toEqual(new Set(['nasa-jsc2007e034221']));
    await project.write('assets.json', JSON.stringify({ version: 1, assets: [record({}), NASA] }));
    const used = await runCli(project.root, 'assets', 'credits');
    expect(used.code).toBe(0);
    expect(used.stdout).toContain('credits for 1 used assets:');
    expect(used.stdout).toContain('- "Apollo 11 spacecraft pre-launch" by NASA JSC');
    expect(used.stdout).not.toContain('Nokia');
    const all = await runCli(project.root, 'assets', 'credits', '--all', '--json');
    expect((JSON.parse(all.stdout) as { assets: string[] }).assets).toEqual([
      'wm-105654713',
      'nasa-jsc2007e034221',
    ]);
  });

  it('reports a hand-broken assets.json as a project problem', async () => {
    await project.write('assets.json', '{"version": 1, "assets": [{"id": "BAD"}]}');
    const run = await runCli(project.root, 'assets', 'list');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('assets.json does not match its schema');
  });
});
