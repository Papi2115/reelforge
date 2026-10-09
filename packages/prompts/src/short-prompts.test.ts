/**
 * Shorts (PLAN.md#13.18): the `short-script` prompt and the short section of the storyboard
 * prompt render as captured in the `short-*` fixtures; without the short variables the storyboard
 * prompt is byte for byte as before (the existing fixtures cover every other section).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { promptVariables, renderPrompt, type PromptId } from './catalog.js';
import {
  capText,
  sceneBuildShortVars,
  shortScriptPromptVars,
  storyboardShortVars,
} from './short-vars.js';
import type { TemplateVars } from './template.js';

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const SHORT_SCRIPT_VARS = shortScriptPromptVars({
  parentTitle: 'Why bridges sing in the wind',
  parentScript: '<the film script>',
  parentBeats: '<the beat sheet>',
  research: '<research notes>',
  channelName: 'Voxplain',
  lengthS: 30,
  language: 'en',
  notes: 'The other short of this film (60 s) takes the angle: the central question.',
});

const SHORT_STORYBOARD_VARS = {
  styleId: 'voxel-pixel-crisp640',
  ...storyboardShortVars({
    lengthS: 30,
    parentTitle: 'Why bridges sing in the wind',
    endCardText: 'Full video on YT: Voxplain',
  }),
};

describe('short-script prompt', () => {
  it('renders as captured (30 s, with beats, research and notes)', () => {
    expect(rendered('short-script', SHORT_SCRIPT_VARS)).toBe(fixture('short-script-30.txt'));
  });

  it('names its variables; the 60 s short goes one step deeper', () => {
    expect(promptVariables('short-script').required).toEqual([
      'lengthS',
      'parentTitle',
      'channelName',
      'language',
      'narrationS',
      'endCardS',
      'targetWords',
      'angle',
      'parentScript',
      'maxFirstWords',
    ]);
    const sixty = rendered(
      'short-script',
      shortScriptPromptVars({
        parentTitle: 'A film',
        parentScript: 'Text.',
        channelName: 'Voxplain',
        lengthS: 60,
        language: 'en',
      }),
    );
    expect(sixty).toContain('about 151 spoken words');
    expect(sixty).toContain('This is the longer short');
    expect(sixty).toContain("Angle of this short: the film's central question");
    expect(sixty).not.toContain('<beats>');
    expect(sixty).not.toContain('Notes:');
  });

  it('caps long parent texts at a line end', () => {
    const long = Array.from({ length: 50 }, (_, index) => `line ${String(index)}`).join('\n');
    const capped = capText(long, 100);
    expect(capped.length).toBeLessThan(140);
    expect(capped.endsWith('[… cut to 100 characters]')).toBe(true);
    expect(capText('short', 100)).toBe('short');
  });
});

describe('storyboard prompt of a short', () => {
  it('renders the short rules as captured', () => {
    expect(rendered('storyboard', SHORT_STORYBOARD_VARS)).toBe(fixture('short-storyboard-30.txt'));
  });

  it('without the short variables keeps the film wording', () => {
    const film = rendered('storyboard', { styleId: 'voxel-pixel-crisp640' });
    expect(film).toContain('Typical shot length 3–8 s');
    expect(film).not.toContain('SHORT');
    expect(storyboardShortVars(undefined)).toEqual({});
  });
});

const SHORT_SHOT = {
  id: 's01_hook',
  t0: 0,
  t1: 2.2,
  treatment: 'metaphor-object',
  intent: 'A bridge twists in the wind.',
  scene: 'scenes/s01_hook.js',
  hook: true,
};
const SCENE_VARS = {
  shotId: SHORT_SHOT.id,
  shotScene: SHORT_SHOT.scene,
  shotJson: SHORT_SHOT,
  shotWords: [{ text: 'bridge', t: 0.4, tEnd: 0.8 }],
  neighbours: [{ id: 's02_wind', treatment: 'kinetic-text', intent: 'Wind' }],
  styleId: 'voxel-pixel-crisp640',
};

describe('scene-build prompt of a short', () => {
  it('renders the retention and portrait rules as captured (captions on)', () => {
    const vars = sceneBuildShortVars({
      lengthS: 30,
      parentTitle: 'Why bridges sing in the wind',
      captions: true,
    });
    expect(rendered('scene-build', { ...SCENE_VARS, ...vars })).toBe(
      fixture('short-scene-build-30.txt'),
    );
  });

  it('leaves the captions line out without captions and adds nothing for a film', () => {
    const vars = sceneBuildShortVars({ lengthS: 60, parentTitle: 'A film', captions: false });
    const text = rendered('scene-build', { ...SCENE_VARS, ...vars });
    expect(text).toContain('vertical YouTube SHORT (9:16 portrait, about 60 s)');
    expect(text).not.toContain('word-by-word captions');
    expect(sceneBuildShortVars(undefined)).toEqual({});
    const film = rendered('scene-build', SCENE_VARS);
    expect(film).not.toContain('SHORT');
  });
});
