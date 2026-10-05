/**
 * Characters and mascot in the prompts (PLAN.md#12.20, ADR-025): the classic hero without a mascot
 * (every project made before 2.3.5) renders the storyboard, scene-build and critic prompts byte
 * for byte as the fixtures (the same as in looks-prompts.test.ts); the pack adds the cast rules, a
 * chosen mascot its screen-time rules, its directive and the critic's mascot check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt } from './catalog.js';
import {
  criticCharacterVars,
  sceneCharacterVars,
  storyboardCharacterVars,
  type CharacterSettings,
} from './characters.js';
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
const SHOT: StoryboardShot = {
  id: 's02_glass',
  t0: 3.1,
  t1: 7.4,
  treatment: 'metaphor-object',
  intent: 'A glass of water.',
  scene: 'scenes/s02_glass.js',
};
const MASCOT_SHOT: StoryboardShot = {
  ...SHOT,
  mascot: { role: 'pointer', action: 'points at the water line' },
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
const CLASSIC: CharacterSettings = { characters: 'classic', mascot: 'none' };
const PACK: CharacterSettings = { characters: 'pack', mascot: 'none' };
const FOX: CharacterSettings = { characters: 'pack', mascot: 'fox', builtRoles: ['firefighter'] };
const TAG = /\{\{[#/]?\w+\}\}/;

describe('classic characters without a mascot', () => {
  it('render the storyboard, scene-build and critic prompts exactly as before 2.3.5', () => {
    expect(storyboardCharacterVars(CLASSIC)).toEqual({});
    expect(sceneCharacterVars(CLASSIC, SHOT)).toEqual({});
    expect(criticCharacterVars(CLASSIC, SHOT)).toEqual({});
    expect(rendered('storyboard', { ...STYLE, ...storyboardCharacterVars(CLASSIC) })).toBe(
      fixture('storyboard-voxel-only.txt'),
    );
    expect(rendered('scene-build', { ...SCENE_VARS, ...sceneCharacterVars(CLASSIC, SHOT) })).toBe(
      fixture('scene-build-voxel-only.txt'),
    );
    expect(rendered('critic', { ...CRITIC_VARS, ...criticCharacterVars(CLASSIC, SHOT) })).toBe(
      fixture('critic-voxel-only.txt'),
    );
  });

  it('ignore a mascot stored in a classic project (in effect only with the pack)', () => {
    // projectMascot() gives `none` for classic; even a stray `shot.mascot` adds nothing.
    expect(sceneCharacterVars(CLASSIC, MASCOT_SHOT)).toEqual({});
    expect(criticCharacterVars(CLASSIC, MASCOT_SHOT)).toEqual({});
  });
});

describe('the character pack', () => {
  it('lists the cast and asks for newRoles in the storyboard', () => {
    const text = rendered('storyboard', { ...STYLE, ...storyboardCharacterVars(PACK) });
    expect(text).toContain('Characters (this project uses the character pack)');
    expect(text).toContain("`kit.cast.person('<id>')` with id one of `scientist`, `doctor`,");
    expect(text).toContain('`astronaut`; an anonymous person');
    expect(text).toContain('"newRoles": [{ "id": "firefighter"');
    expect(text).toContain('Never list a cast member or a built role there.\n\nThen run');
    expect(text).not.toContain('Mascot (');
    expect(text).not.toMatch(TAG);
  });

  it('names the built roles and forbids the classic hero in the scene build', () => {
    const text = rendered('scene-build', { ...SCENE_VARS, ...sceneCharacterVars(FOX, SHOT) });
    expect(text).toContain('or a role built for this project: `firefighter` (same call)');
    expect(text).toContain('Never use `kit.props.character` (the classic hero)');
    expect(text).toContain('`ctx.kit.cast.mannequin()`');
    expect(text).toContain(
      '(`noir` turns skin and outfits violet: keep a dark mood in the set, not on the faces)',
    );
    expect(text).toContain(
      'The channel mascot (`fox`) is not planned in this shot: do not add it.',
    );
    expect(text).not.toContain('Mascot in this shot');
    expect(text).not.toMatch(TAG);
  });
});

describe('a chosen mascot', () => {
  it('gives the storyboard its screen-time and impersonal-role rules', () => {
    const text = rendered('storyboard', { ...STYLE, ...storyboardCharacterVars(FOX) });
    expect(text).toContain('Mascot (Fox, `fox`, chosen by the user for this channel; playful');
    expect(text).toContain('about one appearance every 40–70 s');
    expect(text).toContain('never two mascot shots less than 12 s apart');
    expect(text).toContain('never in more than 30% of the shots');
    expect(text).toContain('not in the first 3 s unless that shot is the title/hook card');
    expect(text).toContain('Impersonal roles only: `pointer`');
    expect(text).toContain('NEVER a person whose identity matters: not a doctor');
    expect(text).toContain('Those are people from the cast (or `newRoles`)');
    expect(text).toContain('"mascot": { "role": "pointer", "action":');
    expect(text).toContain('Shots without the field never show the mascot.\n\nThen run');
    expect(text).toContain(
      '`intent` by that id ("the `doctor` checks the chart"). When the story needs a person',
    );
    expect(text).not.toMatch(TAG);
  });

  it('directs the scene build of a mascot shot to exactly the chosen mascot', () => {
    const text = rendered('scene-build', {
      ...SCENE_VARS,
      shotJson: MASCOT_SHOT,
      ...sceneCharacterVars(FOX, MASCOT_SHOT),
    });
    expect(text).toContain(
      "Mascot in this shot (the user's channel mascot; the storyboard planned it as the `pointer`): points at the water line.",
    );
    expect(text).toContain("exactly `ctx.kit.cast.mascot('fox')` (no other mascot), Fox: playful");
    expect(text).toContain('poses: calm, wave, think, point, shrug, joy, walk, eureka');
    expect(text).toContain('expressions: auto, neutral, joy, curious, surprised');
    expect(text).toContain('never in a costume or playing a profession');
    expect(text).toContain('to point at a thing, turn it toward that thing (`rotation.y`)');
    expect(text).not.toContain('is not planned in this shot');
    expect(text).not.toMatch(TAG);
  });

  it('plans wow-moment reactions in the storyboard (mascot projects only)', () => {
    const text = rendered('storyboard', { ...STYLE, ...storyboardCharacterVars(FOX) });
    expect(text).toContain('- Wow moments: where the narration lands a surprising fact');
    expect(text).toContain('a short shot of its own (1.2–2.5 s, cut on word starts');
    expect(text).toContain(
      'one of `surprise`, `double-take`, `glance-camera`, `brow-raise`, `jaw-drop`, `facepalm-lite`, `shrug-grin`, `nod-told-you`',
    );
    const pack = rendered('storyboard', { ...STYLE, ...storyboardCharacterVars(PACK) });
    expect(pack).not.toContain('Wow moments');
  });

  it('times a reactor shot to the key word in the scene build and checks it in the critic', () => {
    const reactorShot: StoryboardShot = {
      ...SHOT,
      mascot: { role: 'reactor', action: 'jaw-drop at the 4 MB number' },
    };
    const vars = sceneCharacterVars(FOX, reactorShot);
    expect(vars).toMatchObject({ mascotReactor: true });
    const text = rendered('scene-build', { ...SCENE_VARS, shotJson: reactorShot, ...vars });
    expect(text).toContain('Reaction beat (the mascot is the reactor)');
    expect(text).toContain("`mascot.reaction('jaw-drop', { at: ctx.anchor('4 MB').t - 0.15 })`");
    expect(text).toContain('never `noir` or darkness');
    expect(text).toContain(
      'expressions: auto, neutral, joy, curious, surprised, thinking, sceptical, alarm, brow-raise, jaw-drop, wink, smug',
    );
    expect(text).not.toMatch(TAG);
    const pointer = rendered('scene-build', {
      ...SCENE_VARS,
      shotJson: MASCOT_SHOT,
      ...sceneCharacterVars(FOX, MASCOT_SHOT),
    });
    expect(pointer).not.toContain('Reaction beat');
    const critic = rendered('critic', { ...CRITIC_VARS, ...criticCharacterVars(FOX, reactorShot) });
    expect(critic).toContain(
      'Reaction check: the mascot reacts here (jaw-drop at the 4 MB number)',
    );
    expect(critic).toContain('`mascot:`.\n\nReturn ONLY JSON');
    expect(critic).not.toMatch(TAG);
  });

  it('asks the critic to check the mascot of a mascot shot only', () => {
    expect(criticCharacterVars(FOX, SHOT)).toEqual({});
    const text = rendered('critic', { ...CRITIC_VARS, ...criticCharacterVars(FOX, MASCOT_SHOT) });
    expect(text).toContain(
      'Mascot check: this shot shows the channel mascot (Fox, as the pointer)',
    );
    expect(text).toContain('→ `off-intent` with a note starting `mascot:`');
    expect(text).toContain('too small to recognise at 640x360 → `clipped`');
    expect(text).toContain('`mascot:`.\n\nReturn ONLY JSON');
    expect(text).not.toContain('Reaction check');
    expect(text).not.toMatch(TAG);
  });
});
