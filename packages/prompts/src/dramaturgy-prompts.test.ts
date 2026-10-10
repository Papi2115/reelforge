/**
 * Dramaturgy in the prompts (PLAN.md#12.25–12.26): with the switches off the script prompt renders
 * byte for byte as script v1 (fixture captured before v2) and the storyboard / scene-build prompts
 * as their voxel-only fixtures; on, the script asks for surprise beats and open loops in beats.md,
 * the storyboard for interrupt markers and loops.json, the scene build gets the shot's directives.
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

function rendered(id: 'script' | 'storyboard' | 'scene-build', vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const SCRIPT_VARS = {
  brief: { version: 1, topic: 'Why the sky is blue', language: 'en', targetMinutes: 3 },
  language: 'en',
  targetMinutes: 3,
  targetWords: 450,
  tone: 'curious',
  audience: 'not specified',
};
const TAG = /\{\{[#/]?\w+\}\}/;

describe('script prompt', () => {
  it('renders exactly as script v1 with the switches off', () => {
    expect(loadPrompt('script').version).toBe(4);
    expect(rendered('script', SCRIPT_VARS)).toBe(fixture('script-dramaturgy-off.txt'));
  });

  it('asks for surprise beats and open loops in beats.md when on', () => {
    const text = rendered('script', {
      ...SCRIPT_VARS,
      surpriseBeats: true,
      interruptsPerMinute: '1–2',
      openLoops: true,
      openLoopsStep: 4,
    });
    expect(text).toContain('word by word).\n3. Surprise beats');
    expect(text).toContain('`## Surprise beats` to `beats.md` — never to `script.txt`');
    expect(text).toContain('about 1–2 surprises per minute');
    expect(text).toContain('\n4. Open loops (on for this project)');
    expect(text).toContain('Never leave a loop open at the end.\n\nNever invent facts.');
    expect(text).not.toMatch(TAG);
  });
});

describe('storyboard and scene-build prompts', () => {
  it('stay as their voxel-only fixtures with the switches off', () => {
    expect(rendered('storyboard', { styleId: 'voxel-pixel-crisp640' })).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
  });

  it('ask for interrupt markers and loops.json when on', () => {
    const text = rendered('storyboard', {
      styleId: 'voxel-pixel-crisp640',
      interrupts: true,
      interruptRules: 'Plan 3–6 interrupts in this film.',
      interruptTension: '- 0:00–1:00 calm: 1.2/min',
      loops: true,
    });
    expect(text).toContain('"interrupt": { "kind": "enter-screen"');
    expect(text).toContain('Plan 3–6 interrupts in this film.\nInterrupts per minute by tension');
    expect(text).toContain('write `loops.json` next to the storyboard');
    expect(text).toContain('before the opening.\n\nThen run `reelforge validate`');
    expect(text).not.toMatch(TAG);
  });

  it('gives the scene build the interrupt and veil directives', () => {
    const shot = {
      id: 's04',
      t0: 20,
      t1: 26,
      treatment: 'metaphor-object',
      intent: 'x',
      scene: 'scenes/s04.js',
    };
    const vars = {
      shotId: shot.id,
      shotScene: shot.scene,
      shotJson: shot,
      shotWords: [],
      neighbours: [],
      styleId: 'voxel-pixel-crisp640',
    };
    const plain = rendered('scene-build', vars);
    expect(plain).not.toContain('Pattern interrupt');
    const text = rendered('scene-build', {
      ...vars,
      interruptDirective: 'scale-shift: shrink. Realise it with `ctx.camera.dollyZoom',
      veilDirective: 'reveal on "violet".',
    });
    expect(text).toContain('Pattern interrupt planned on this shot');
    expect(text).toContain('`ctx.camera.dollyZoom\nA camera interrupt must stay readable');
    expect(text).toContain('about unlabelled or stronger moves.\nOpen loop: reveal on "violet".\n');
    expect(text).not.toMatch(TAG);
    expect(loadPrompt('scene-build').version).toBe(20);
  });
});
