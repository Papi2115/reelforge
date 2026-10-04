/**
 * Taste profile in the prompts (PLAN.md#12.13): without a profile (learning off, too little
 * evidence, after a reset) the storyboard and scene-build prompts are byte for byte the fixtures;
 * with one they carry a single "Taste profile" section.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPrompt } from './catalog.js';
import type { TemplateVars } from './template.js';

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function rendered(id: 'storyboard' | 'scene-build', vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const STYLE = { styleId: 'voxel-pixel-crisp640' };
const SHOT = {
  id: 's02_glass',
  t0: 3.1,
  t1: 7.4,
  treatment: 'metaphor-object',
  intent: 'A glass of water.',
  scene: 'scenes/s02_glass.js',
};
const SCENE_VARS = {
  shotId: SHOT.id,
  shotScene: SHOT.scene,
  shotJson: SHOT,
  shotWords: [{ text: 'glass', t: 3.2, tEnd: 3.6 }],
  neighbours: [{ id: 's01_hook', treatment: 'title-card', intent: 'Hook' }],
  ...STYLE,
  annotationPlan: '- "glass of water" (name): pin on glass, text "WATER"',
};
const PROFILE = 'Prefers: orbit camera moves. Avoids: violet backgrounds.';

describe('taste profile section', () => {
  it('leaves both prompts byte-identical without a profile', () => {
    expect(rendered('storyboard', STYLE)).toBe(fixture('storyboard-voxel-only.txt'));
    expect(rendered('storyboard', { ...STYLE, tasteProfile: undefined })).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
    expect(rendered('scene-build', { ...SCENE_VARS, tasteProfile: '' })).toBe(
      fixture('scene-build-voxel-only.txt'),
    );
  });

  it('adds one section with the profile', () => {
    const storyboard = rendered('storyboard', { ...STYLE, tasteProfile: PROFILE });
    expect(storyboard).toContain(`never repeat one choice everywhere): ${PROFILE}\n\nThen run`);
    expect(storyboard.split('Taste profile of this user')).toHaveLength(2);
    const scene = rendered('scene-build', { ...SCENE_VARS, tasteProfile: PROFILE });
    expect(scene).toContain(`style rules come first): ${PROFILE}\n\nSteps:`);
    expect(scene.replace(/\nTaste profile of this user[^\n]*/, '')).toBe(
      fixture('scene-build-voxel-only.txt'),
    );
  });
});
