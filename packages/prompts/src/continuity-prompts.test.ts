/**
 * Continuity links in the prompts (PLAN.md#13.2): with the project switch off the storyboard and
 * scene-build prompts are byte for byte the fixtures; on, each carries one continuity section.
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
const DIRECTIVE =
  'This shot continues s01_hook through a zoom-through link: open framed on "glass".';

describe('continuity link sections', () => {
  it('leave both prompts byte-identical with the switch off', () => {
    expect(rendered('storyboard', { ...STYLE, continuityLinks: undefined })).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
    expect(rendered('storyboard', { ...STYLE, continuityLinks: false })).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
    expect(rendered('scene-build', { ...SCENE_VARS, continuityDirective: undefined })).toBe(
      fixture('scene-build-voxel-only.txt'),
    );
  });

  it('add one storyboard section with the film budget', () => {
    const text = rendered('storyboard', { ...STYLE, continuityLinks: true, continuityBudget: 3 });
    expect(text.split('Continuity links (on for this project')).toHaveLength(2);
    expect(text).toContain('at most 3 links in this film');
    expect(text).toContain('"kind": "zoom-through"');
    expect(text.replace(/Continuity links \(on for this project[^\n]*\n/, '')).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
  });

  it('add one scene-build line with the directive', () => {
    const text = rendered('scene-build', { ...SCENE_VARS, continuityDirective: DIRECTIVE });
    expect(text).toContain(`from the left and top): ${DIRECTIVE}\n`);
    expect(text.replace(/Continuity link \(the app draws[^\n]*\n/, '')).toBe(
      fixture('scene-build-voxel-only.txt'),
    );
  });
});
