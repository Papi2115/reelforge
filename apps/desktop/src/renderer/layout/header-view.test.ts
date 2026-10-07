import { describe, expect, it } from 'vitest';
import { modelsText, projectMeta, styleDisplayName } from './header-view.js';

describe('header view', () => {
  it('names the style by its display name, an unknown id as is', () => {
    expect(styleDisplayName('voxel-pixel-crisp640')).toBe('Voxel Pixel · Crisp 640');
    expect(styleDisplayName('my-own-style')).toBe('my-own-style');
    expect(projectMeta({ language: 'en', style: 'voxel-pixel-crisp640', fps: 30 })).toBe(
      'EN · Voxel Pixel · Crisp 640 · 30 fps',
    );
    // A world shows its own name (PLAN.md#13.6), experimental or not.
    expect(projectMeta({ language: 'pl', style: 'sketchbook', fps: 30 })).toBe(
      'PL · Sketchbook · 30 fps',
    );
  });

  it('says the model mode in plain words, nothing until the settings load', () => {
    expect(modelsText(undefined)).toBeNull();
    expect(modelsText(true)).toBe('Economy mode: Sonnet only');
    expect(modelsText(false)).toBe('Sonnet / Opus per step');
  });
});
