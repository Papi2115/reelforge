/**
 * The Grim Ink direction step in the prompts (PLAN.md#14.16): the `c-cam-direction` prompt (Sonnet,
 * JSON reply, the storyboard's permissions) with its playbook (≤ 3 KB) and rules; the plan's
 * sections of the storyboard, scene-build and critic prompts (fixture: only those sections, so the
 * rest of the Grim Ink wording keeps its own fixtures), and no section without a plan.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { loadPrompt, promptVariables, renderPrompt, type PromptId } from './catalog.js';
import { permissionStageFor } from './stages.js';
import type { TemplateVars } from './template.js';
import { goodPlan, goodShots, PLAN_SCRIPT } from './validators/direction-fixture.js';
import {
  C_CAM_DIRECTION_PLAYBOOK,
  cCamDirectionPromptVars,
  DIRECTION_PLAYBOOK_BUDGET,
} from './worlds/c-cam-direction.js';
import {
  criticWorldVars,
  sceneWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';
import {
  criticDirectionVars,
  sceneDirectionVars,
  storyboardDirectionVars,
} from './worlds/c-cam-direction-vars.js';

const TAG = /\{\{[#^/]?\w+\}\}/;

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const WORDS = {
  version: 1 as const,
  words: PLAN_SCRIPT.split(' ').map((text, index) => ({
    text,
    t: index * 0.8,
    tEnd: index * 0.8 + 0.7,
  })),
};

function shotAt(index: number): StoryboardShot {
  const shot = goodShots()[index];
  if (shot === undefined) throw new Error(`no shot ${String(index)}`);
  return shot;
}

/** The text of a prompt from `start` to the next blank line or the end. */
function section(text: string, start: string): string {
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`no "${start}"`);
  const end = text.indexOf('\n\n', from);
  return text.slice(from, end < 0 ? undefined : end);
}

const text = worldPromptText('c-cam');
if (text === undefined) throw new Error('no c-cam prompt text');
const GRIM: PromptWorld = { label: 'Grim Ink', text };
const STORYBOARD_BASE = {
  styleId: 'c-cam',
  looks: '- `ink-poster` (Ink poster): the poster. Rolls: C.',
  multiLook: true,
  ...storyboardWorldVars(GRIM, 'ink-poster', [], { durationS: 30 }),
};
const SCENE_BASE = {
  shotId: 's05_door',
  shotScene: 'scenes/s05_door.js',
  shotJson: { id: 's05_door' },
  shotWords: [],
  neighbours: [],
  styleId: 'c-cam',
  ...sceneWorldVars(GRIM),
};
const CRITIC_BASE = {
  styleId: 'c-cam',
  imagePaths: '.reelforge/qa/s05_door/build-1.png',
  intent: 'cast: warden',
  ...criticWorldVars(GRIM),
};

describe('the c-cam-direction prompt', () => {
  const prompt = rendered(
    'c-cam-direction',
    cCamDirectionPromptVars({
      script: PLAN_SCRIPT,
      words: WORDS,
      style: 'One uneven ink line over muddy flat colour.',
      gagKinds: ['gum', 'sweat', 'yawn'],
      genre: 'True crime (dry, deadpan)',
    }),
  );

  it('is a Sonnet planning turn with a JSON reply and no open tags', async () => {
    const definition = loadPrompt('c-cam-direction');
    expect(definition).toMatchObject({ version: 1, model: 'sonnet', tools: ['Read'] });
    expect(definition.output).toEqual({ kind: 'json-reply' });
    expect(permissionStageFor('c-cam-direction')).toBe('storyboard');
    expect(promptVariables('c-cam-direction').optional).toEqual(['genre']);
    expect(prompt).not.toMatch(TAG);
    expect(prompt).toContain('Do not create or edit any file and do not use tools');
    expect(prompt).toContain(
      'Gag kinds the kit can play (`signatureGag.kind` is one of them): gum, sweat, yawn',
    );
    expect(prompt).toContain('- 0.00–3.10 s: "Nobody had the key."');
    expect(prompt).toContain('Channel genre: True crime (dry, deadpan)');
    expect(prompt).toContain('in the last 30 % of the film');
    expect(prompt).toContain("every beat's `camera.progression` has 2–5 framings");
    expect(prompt).toContain('a `title` of at most 6 words');
    await expect(prompt).toMatchFileSnapshot('fixtures/c-cam-direction.txt');
  });

  it('carries a topic-neutral playbook within its budget', () => {
    expect(C_CAM_DIRECTION_PLAYBOOK.length).toBeLessThanOrEqual(DIRECTION_PLAYBOOK_BUDGET);
    expect(C_CAM_DIRECTION_PLAYBOOK).not.toMatch(
      /apollo|samurai|pope|conclave|commander|merchant/i,
    );
    for (const device of [
      'Running gag',
      'Accident',
      'Climax ECU',
      'Reaction hold',
      'Title frame',
    ]) {
      expect(C_CAM_DIRECTION_PLAYBOOK).toContain(device);
    }
  });
});

describe('the plan in the storyboard, scene-build and critic prompts', () => {
  const plan = goodPlan();
  const storyboard = rendered('storyboard', {
    ...STORYBOARD_BASE,
    ...storyboardDirectionVars(plan),
  });
  const title = rendered('scene-build', { ...SCENE_BASE, ...sceneDirectionVars(plan, shotAt(0)) });
  const climax = rendered('scene-build', { ...SCENE_BASE, ...sceneDirectionVars(plan, shotAt(4)) });
  const critic = rendered('critic', { ...CRITIC_BASE, ...criticDirectionVars(plan, shotAt(4)) });

  it('give the storyboard the whole plan and how to execute it', () => {
    const text = section(storyboard, 'Direction plan (`direction.json`');
    expect(text).toContain(
      'Title frame: "Nobody had the key" — warden akimbo, smug (jingles an empty key ring)',
    );
    expect(text).toContain(
      '- warden (the night warden): gag `yawn` — yawns at every alarm; b01 → b03 → payoff b06',
    );
    expect(text).toContain('Climax: b05 — ECU of the lock on the floor');
    expect(text).toContain('The FIRST shot is the title frame');
    expect(text).toContain('"direction": { "beats": ["b03"]');
    expect(text).not.toMatch(TAG);
  });

  it('give a scene its exact plan: framings, beats in shot time, gags, the climax, the title card', () => {
    const plan5 = section(climax, 'Direction plan of this shot');
    expect(plan5).toContain('1. wide: the open door; 2. ecu: the lock on the floor');
    expect(plan5).toContain('b05 at 0.0–5.0 s of the shot');
    expect(plan5).toContain("`gag: { kind: 'sweat', t0 }` with t0 ≈ 0.0 s");
    expect(plan5).toContain('the PAYOFF');
    expect(plan5).toContain('CLIMAX of the film');
    const card = section(title, 'Direction plan of this shot');
    expect(card).toContain(
      'env.ink.titleCard(g, env, { title, subtitle?, cast: [{ person, view, pose, expr, x, y, s }], place?, accent? })',
    );
    expect(card).toContain('title "Nobody had the key"');
  });

  it('give the critic what must show', () => {
    const check = section(critic, 'Direction check');
    expect(check).toContain('an extreme close-up of the lock on the floor');
    expect(check).toContain('inmate playing `sweat` (its payoff: drawn and clear)');
    expect(check).toContain('90 px of 1080');
    expect(check).toContain('note starting `direction:`');
  });

  it('snapshot the three sections', async () => {
    const sections = [
      section(storyboard, 'Direction plan (`direction.json`'),
      section(title, 'Direction plan of this shot'),
      section(climax, 'Direction plan of this shot'),
      section(critic, 'Direction check'),
    ].join('\n\n---\n\n');
    await expect(`${sections}\n`).toMatchFileSnapshot('fixtures/c-cam-direction-sections.txt');
  });

  it('add nothing without a plan or without refs', () => {
    const plain = { ...shotAt(4) };
    delete plain.direction;
    expect(storyboardDirectionVars(undefined)).toEqual({});
    expect(sceneDirectionVars(undefined, shotAt(4))).toEqual({});
    expect(sceneDirectionVars(plan, plain)).toEqual({});
    expect(criticDirectionVars(plan, plain)).toEqual({});
    expect(
      rendered('storyboard', { ...STORYBOARD_BASE, ...storyboardDirectionVars(undefined) }),
    ).toBe(rendered('storyboard', STORYBOARD_BASE));
  });
});
