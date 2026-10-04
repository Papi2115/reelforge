/**
 * Assigned assets (PLAN.md#12.12): the storyboard prompt lists the project's assets only when there
 * are any (or research is on) with the "kit + these assets only" rule in mode off, and the
 * validator refuses ids that are not in assets.json.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../catalog.js';
import { checkShotAssets } from './asset-needs.js';
import { checkStoryboard } from './storyboard.js';

const SHOT: StoryboardShot = {
  id: 's01',
  t0: 0,
  t1: 4,
  treatment: 'metaphor-object',
  intent: 'The phone on the desk.',
  scene: 'scenes/s01.js',
  assets: ['own-nokia', 'own-logo'],
};

function storyboard(vars: Record<string, unknown>): string {
  const rendered = renderPrompt('storyboard', { styleId: 'voxel-pixel-crisp640', ...vars });
  if (!rendered.ok) throw new Error(JSON.stringify(rendered.error));
  return rendered.value;
}

describe('storyboard prompt: asset catalogue', () => {
  it('adds the catalogue and the mode-off rule only when asked', () => {
    const plain = storyboard({});
    expect(plain).not.toContain('Assets of this project');
    const off = storyboard({ assetCatalogue: '- own-nokia  image 4x4', assetsOff: true });
    expect(off).toContain('Assets of this project (`assets.json`: the user');
    expect(off).toContain('- own-nokia  image 4x4');
    expect(off).toContain('build every B-roll ONLY from the kit and these assets');
    expect(off).not.toContain('reelforge assets library search');
    expect(off).not.toContain(', downloads');
    const library = storyboard({ assetCatalogue: '(none yet)', assetLibrary: true });
    expect(library).toContain('reelforge assets library use <key>');
    expect(library).not.toContain('ONLY from the kit');
    expect(off).not.toMatch(/\{\{[#/]?\w+\}\}/);
  });
});

describe('shot assets', () => {
  it('errors on ids missing from assets.json and warns on duplicates', () => {
    expect(checkShotAssets([SHOT], ['own-nokia', 'own-logo'])).toEqual([]);
    expect(checkShotAssets([SHOT], undefined)).toEqual([]);
    const issues = checkShotAssets(
      [{ ...SHOT, assets: ['own-nokia', 'own-nokia', 'ghost'] }],
      ['own-nokia'],
    );
    expect(issues.map((found) => [found.severity, found.code])).toEqual([
      ['warning', 'asset-twice'],
      ['error', 'asset-unknown'],
    ]);
    expect(issues[1]?.message).toContain('s01 assigns asset "ghost", which is not in assets.json');
    const viaStoryboard = checkStoryboard({ version: 1, shots: [SHOT] }, { assetIds: [] });
    expect(viaStoryboard.filter((found) => found.code === 'asset-unknown')).toHaveLength(2);
  });
});
