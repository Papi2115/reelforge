import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from '../catalog.js';
import { validateWorldAssetCriticReply } from './world-asset-critic.js';

const entry = (tile: string, sees: string) => ({
  tile,
  sees,
  legible: true,
  style: 'ok',
  note: 'reads',
});

describe('world-assets critic', () => {
  it('is a Haiku JSON prompt that never tells the critic the names', () => {
    const prompt = loadPrompt('world-asset-critic');
    expect(prompt).toMatchObject({ model: 'haiku', output: { kind: 'json-reply' } });
    const text = renderPrompt('world-asset-critic', {
      worldLabel: 'Game B2',
      imagePaths: 'crops-A.png',
      tiles: 'crops-A.png: A1, A2',
    });
    expect(text.ok && text.value).toContain('labelled with codes only: crops-A.png: A1, A2');
  });

  it('accepts one entry per tile and reports missing and unknown tiles', () => {
    const reply = JSON.stringify({ assets: [entry('A1', 'a blue bird'), entry('B1', 'a tree')] });
    const checked = validateWorldAssetCriticReply(reply, { expectedTiles: ['A1', 'A2'] });
    expect(checked.value?.assets[0]?.sees).toBe('a blue bird');
    expect(checked.issues.map((item) => [item.severity, item.code])).toEqual([
      ['error', 'missing-tile'],
      ['warning', 'unexpected-tile'],
    ]);
  });

  it('rejects a reply in the frame critic format', () => {
    const reply = JSON.stringify({ frames: [{ path: 'a.png', verdict: 'ok', note: 'x' }] });
    expect(validateWorldAssetCriticReply(reply).value).toBeUndefined();
  });
});
