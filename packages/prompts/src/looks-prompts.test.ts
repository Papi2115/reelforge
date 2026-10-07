/**
 * Look mode in the prompts (ADR-009): `voxel-only` renders the storyboard and scene-build prompts
 * byte for byte as before ReelForge 2.0 (fixtures captured from storyboard v2 / scene-build v5 /
 * critic v2); `mixed` adds the roll/look sections.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from './catalog.js';
import type { TemplateVars } from './template.js';

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function rendered(id: 'storyboard' | 'scene-build' | 'critic', vars: TemplateVars): string {
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
const CRITIC_VARS = {
  ...STYLE,
  imagePaths: '.reelforge/qa/s02/smoke-1.png',
  intent: 'Counter lands on "4 MB"',
};
const VOXEL_LINE = '- `voxel` (Voxel 3D): chunky voxel 3D worlds';
const TAG = /\{\{[#/]?\w+\}\}/;

describe('voxel-only prompts', () => {
  it('render the storyboard prompt exactly as before looks', () => {
    expect(rendered('storyboard', STYLE)).toBe(fixture('storyboard-voxel-only.txt'));
  });

  it('render the scene-build prompt exactly as before looks', () => {
    expect(rendered('scene-build', SCENE_VARS)).toBe(fixture('scene-build-voxel-only.txt'));
  });

  it('render the critic prompt exactly as critic v2 (fixture captured before v3)', () => {
    expect(rendered('critic', CRITIC_VARS)).toBe(fixture('critic-voxel-only.txt'));
  });
});

describe('mixed prompts', () => {
  it('define the rolls and list the looks; with voxel alone, every shot is voxel', () => {
    const text = rendered('storyboard', { ...STYLE, looks: VOXEL_LINE, singleLook: true });
    expect(text).toContain('- `A` = the main visual story');
    expect(text).toContain('- `B` = proof and illustration');
    expect(text).toContain('- `C` = atmosphere and rhythm');
    expect(text).toContain(`Available looks (use only these ids):\n${VOXEL_LINE}\nOnly \`voxel\``);
    expect(text).not.toContain('Rhythm: never more than 3 shots');
    expect(text).toContain('in a scene): show what the narration claims.');
    expect(text).toContain('every 6 shots.\n\nAnnotations (`annotations`');
    expect(text).not.toMatch(TAG);
  });

  it('add the rhythm rules once a second look is available', () => {
    const looks = `${VOXEL_LINE}\n- \`retro-ui\` (Retro UI / CRT): retro-OS windows`;
    const text = rendered('storyboard', { ...STYLE, looks, multiLook: true });
    expect(text).toContain(`${looks}\nRhythm: never more than 3 shots in a row in one look`);
    expect(text).toContain('dithering.\n\nAnnotations (`annotations`');
    expect(text).not.toContain('Only `voxel` is available');
    expect(text).not.toMatch(TAG);
  });

  it('list the transition styles with the rhythm rules (PLAN.md#12.15)', () => {
    const looks = `${VOXEL_LINE}\n- \`retro-ui\` (Retro UI / CRT): retro-OS windows`;
    const transitions = '- `iris` (wipe, 0.3–0.7 s): a pixel circle opens.';
    const text = rendered('storyboard', { ...STYLE, looks, multiLook: true, transitions });
    expect(text).toContain('dithering.\nTransition styles: a non-cut `transitionIn`');
    expect(text).toContain(`Styles:\n${transitions}\n\nAnnotations (\`annotations\``);
    expect(text).not.toMatch(TAG);
  });

  it("give the scene build the shot's look and its docs", () => {
    const text = rendered('scene-build', {
      ...SCENE_VARS,
      lookId: 'voxel',
      lookDocs: 'Look `voxel`: chunky voxel 3D.',
    });
    expect(text).toContain('Look of this shot: `voxel`. Every look renders through the same style');
    expect(text).toContain(
      'How to build in it:\nLook `voxel`: chunky voxel 3D.\n\nAnnotation plan',
    );
    expect(text).not.toMatch(TAG);
  });

  it('ask the critic for a vibe check', () => {
    const text = rendered('critic', { ...STYLE, imagePaths: 'a.png', intent: 'x' });
    expect(text).toContain('Vibe check');
    expect(text).toContain('a note starting `vibe:`');
  });

  it("give the critic the shot's look, roll and rules and ask for look checks", () => {
    const rules = 'Retro UI: flat pixel-art windows.';
    const text = rendered('critic', {
      ...CRITIC_VARS,
      lookId: 'retro-ui',
      roll: 'B',
      lookRules: rules,
    });
    expect(text).toContain(
      `\`vibe:\`.\n\nLook of this shot: \`retro-ui\` (roll B). The film mixes looks: judge the frame against this look, not against voxel. ${rules}\nLook checks: `,
    );
    for (const part of [
      'by a camera push-in → `clipped`',
      '→ `overlap`',
      'a note starting `look:`',
    ]) {
      expect(text).toContain(part);
    }
    expect(text).toContain('`look:`.\n\nReturn ONLY JSON');
    const noRoll = rendered('critic', { ...CRITIC_VARS, lookId: 'voxel', lookRules: rules });
    expect(noRoll).toContain('Look of this shot: `voxel`. The film mixes looks');
    expect(noRoll).not.toMatch(TAG);
    expect(loadPrompt('critic').version).toBe(10);
  });

  it('resolve the list-badge rule and the look camera rules for mixed storyboards', () => {
    const looks = `${VOXEL_LINE}\n- \`retro-ui\` (Retro UI / CRT): retro-OS windows`;
    const text = rendered('storyboard', { ...STYLE, looks, multiLook: true });
    expect(text).toContain(
      'cover the main subject for long.\nLists of 3 or more items: the run rule wins over "one badge per item"',
    );
    expect(text).toContain(
      "Camera moves in intents must respect the look's camera rules (retro-ui and blueprint boards: no push-ins that crop text; diorama: iso camera presets only).\n\nThen run",
    );
    expect(rendered('storyboard', { ...STYLE, looks: VOXEL_LINE, singleLook: true })).not.toContain(
      'Lists of 3 or more items',
    );
  });
});
