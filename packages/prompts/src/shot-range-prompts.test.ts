/**
 * Scenes per minute in the storyboard prompt (ADR-027): without a range the prompt renders byte
 * for byte as storyboard v12 (fixture `storyboard-standard-full.txt`, every optional section on,
 * captured from v12 before the range existed; the voxel-only fixture too); with a range the
 * `{{#shotRange}}` section states it and the rules derived from it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from './catalog.js';
import { storyboardShotRangeVars } from './shot-range-vars.js';
import type { TemplateVars } from './template.js';

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function rendered(vars: TemplateVars): string {
  const result = renderPrompt('storyboard', vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** Every optional section of storyboard v12 switched on. */
const FULL_VARS = {
  styleId: 'voxel-pixel-crisp640',
  tension: '- 0.0–30.0 s (0:00–0:30): calm, tension 0.20, target shot length ~6.6 s',
  looks: '- `voxel` (Voxel 3D): chunky voxel 3D worlds\n- `retro-ui` (Retro UI): CRT screens',
  multiLook: true,
  maxTransitions: 4,
  transitions: '- `crt-zoom` (look change): into a CRT',
  assetResearch: true,
  maxAssetNeeds: 5,
  assetCatalogue: '- `own-nokia-front` image: a Nokia 3310 from the front',
  assetLibrary: true,
  sourceChips: '- "4 KB of memory" (NASA)',
  interrupts: true,
  interruptRules: 'Plan 1–2 interrupts in this 1:00 film.',
  interruptTension: '- 0:00–1:00 calm, tension 0.20: ~1.2 per minute',
  loops: true,
  tasteProfile: 'prefers voxel close-ups',
  castPack: true,
  castList: '`doctor`, `pilot`',
  builtRoles: '`firefighter`',
  mascotId: 'fox',
  mascotName: 'Fox',
  mascotPersonality: 'curious and quick',
  mascotReactions: '`surprise`, `jaw-drop`',
} as const;
const TAG = /\{\{[#/]?\w+\}\}/;

describe('storyboard prompt without a range', () => {
  it('renders every section exactly as storyboard v12', () => {
    expect(loadPrompt('storyboard').version).toBe(18);
    expect(rendered(FULL_VARS)).toBe(fixture('storyboard-standard-full.txt'));
    expect(rendered({ ...FULL_VARS, ...storyboardShotRangeVars(undefined, 642) })).toBe(
      fixture('storyboard-standard-full.txt'),
    );
  });

  it('renders the voxel-only prompt as before', () => {
    const vars = { styleId: 'voxel-pixel-crisp640', ...storyboardShotRangeVars(undefined, 60) };
    expect(rendered(vars)).toBe(fixture('storyboard-voxel-only.txt'));
  });
});

describe('storyboard prompt with a range', () => {
  it('states the range, one idea per shot and the sentence rule', () => {
    const text = rendered({ ...FULL_VARS, ...storyboardShotRangeVars({ min: 3, max: 5 }, 642) });
    expect(text).toContain(
      'Scenes per minute (the user chose 3–5 shots per minute for this film: about 32–54 shots for its 10:42)',
    );
    expect(text).toContain('One idea = one shot.');
    expect(text).toContain('Shot length 4.8–30 s, typically 7.2–24 s.');
    expect(text).toContain('A long sentence is ONE shot that develops');
    expect(text).toContain('Only a sentence longer than 12 s may be cut inside');
    expect(text).toContain('"continues": true');
    expect(text).toContain('merge neighbours instead of splitting ideas');
    expect(text).toContain('for at most 24 s in a row');
    expect(text).toContain('about 20 s at tension 0 down to about 12 s at tension 1');
    expect(text).toContain('at tension 1 (the table above already uses them).\nThen run');
    expect(text).not.toMatch(TAG);
  });

  it('leaves out the look and tension lines when those sections are off', () => {
    const text = rendered({
      styleId: 'voxel-pixel-crisp640',
      ...storyboardShotRangeVars({ min: 8, max: 12 }, 120),
    });
    expect(text).toContain(
      'chose 8–12 shots per minute for this film: about 16–24 shots for its 2:00',
    );
    expect(text).not.toContain('One roll + look + treatment');
    expect(text).not.toContain('Tension targets for this range');
    expect(text).toContain('marked `"continues": true`. When you have too many shots');
    expect(text).not.toMatch(TAG);
  });
});
