/**
 * Grim Ink (c-cam) wording in the prompts (PLAN.md#14.10): its own film, brief with the cast and
 * place tags, rolls, the craft brief (<= 1.5 KB), the per-shot design process over the film's own
 * people and places, the cut-table camera grammar, the critic checklist and the moment catalog
 * (`reverse` and `poster` as breakthroughs, `insert` and `over-shoulder` as moments), no voxel
 * text. The world is not wired yet; the other worlds' renderings stay byte-identical (their own
 * fixture tests).
 */
import type { StoryboardShot, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import { checkWorldVariety } from './validators/world-variety.js';
import {
  C_CAM_API,
  C_CAM_SNIPPETS,
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';
import { storyboardMomentVars } from './worlds/moment-vars.js';

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('c-cam');
if (text === undefined) throw new Error('no c-cam prompt text');
const GRIM: PromptWorld = { label: 'Grim Ink', text };
const LOOKS = [
  '- `ink-scene` (Ink scene): the scene. Rolls: A. Treatments: character-scene, metaphor-object.',
  '- `ink-insert` (Ink insert): the insert. Rolls: B. Treatments: metaphor-object, counter/odometer.',
  '- `ink-poster` (Ink poster): the poster. Rolls: C. Treatments: title-card, montage/transition.',
].join('\n');
const TAG = /\{\{[#^/]?\w+\}\}/;

const prompts = {
  storyboard: rendered('storyboard', {
    styleId: 'c-cam',
    looks: LOOKS,
    multiLook: true,
    maxTransitions: '3',
    interrupts: true,
    interruptRules: 'Plan 1–2 interrupts.',
    continuityLinks: true,
    continuityBudget: 2,
    ...storyboardWorldVars(GRIM, 'ink-scene', [], { durationS: 155 }),
  }),
  'scene-build': rendered('scene-build', {
    shotId: 's05_locked',
    shotScene: 'scenes/s05_locked.js',
    shotJson: { id: 's05_locked', t0: 20, t1: 26, treatment: 'character-scene' },
    shotWords: [{ text: 'locked', t: 20.4, tEnd: 20.9 }],
    neighbours: [],
    styleId: 'c-cam',
    lookId: 'ink-scene',
    lookDocs: 'Look `ink-scene` (world Grim Ink, A roll): the scene.',
    annotationPlan: '- "locked" (word): a label on the door',
    ...sceneWorldVars(GRIM, 'reverse'),
  }),
  'scene-fix': rendered('scene-fix', {
    scope: 'Shot',
    shotIds: 's11_rule',
    request: 'QA fix 1/2 for shot s11_rule.',
    critic: 'error critic: poster: the emblem is generic',
    ...fixWorldVars(GRIM, 'ink-poster', 'poster'),
  }),
  critic: rendered('critic', {
    styleId: 'c-cam',
    imagePaths: '.reelforge/qa/s05_locked/build-1.png',
    intent: 'cast: porter | place: boiler-room. The door was locked from the inside.',
    lookId: 'ink-scene',
    roll: 'A',
    lookRules: 'Ink scene: people in a grimy place.',
    ...criticWorldVars(GRIM, 'reverse'),
  }),
};

describe('Grim Ink prompts', () => {
  it.each(Object.keys(prompts) as (keyof typeof prompts)[])(
    '%s has no voxel text and no open tags',
    async (id) => {
      expect(prompts[id]).not.toMatch(/voxel/i);
      expect(prompts[id]).not.toMatch(TAG);
      await expect(prompts[id]).toMatchFileSnapshot(`fixtures/c-cam-${id}.txt`);
    },
  );

  it('give the storyboard the world, the cast and place tags, the rolls and the catalog', () => {
    const storyboard = prompts.storyboard;
    expect(storyboard).toContain('storyboard artist for a hand-inked grim cartoon video');
    expect(storyboard).toContain('World brief (Grim Ink): the whole film is one hand-inked');
    expect(storyboard).toContain('Cast: 2-5 roles');
    expect(storyboard).toContain('`cast: nightPorter (the hotel');
    expect(storyboard).toContain('`place: boilerRoom`');
    expect(storyboard).toContain('- `A` = the scene (`ink-scene`');
    expect(storyboard).toContain('- `B` = the insert (`ink-insert`');
    expect(storyboard).toContain('- `C` = the poster (`ink-poster`');
    expect(storyboard).toContain(
      '- `reverse` (breakthrough; look `ink-scene`; a shot of at least 3.5 s)',
    );
    expect(storyboard).toContain(
      '- `poster` (breakthrough; look `ink-poster`; a shot of at least 2.5 s)',
    );
    expect(storyboard).toContain(
      '- `insert` (moment; look `ink-insert`; a shot of at least 1.5 s)',
    );
    expect(storyboard).toContain(
      '- `over-shoulder` (moment; look `ink-scene`; a shot of at least 3 s)',
    );
    expect(storyboard).toContain('Breakthroughs (`reverse`, `poster`)');
    expect(storyboard).toContain('about one per 50 s of film');
    expect(storyboard).toContain('needs at least 2 and at most 5, of at least 2 different kinds');
    expect(storyboard).toContain('Dutch tilt of 2–7° only on tense beats');
    // Hard cuts between shots: no page-transition styles asked for.
    expect(storyboard).not.toContain('different page transitions');
    expect(storyboard).not.toContain('Transition styles of this world');
    expect(storyboard).toContain('`zoom-through` into an object in the place');
    expect(storyboard).not.toMatch(/sketch|comic/i);
  });

  it('give scene-build and scene-fix the craft brief, the design process and the exact calls', () => {
    const brief = text.craftBrief;
    expect(Buffer.byteLength(brief, 'utf8')).toBeLessThanOrEqual(1536);
    for (const part of [
      'The world gives the GRAMMAR, the narration gives the content',
      '`// focal: <the one thing read first> | cast: <ids> | place: <id> | traces: <three>`',
      'only the ink line (width swells 0.4-1.9x)',
      'one warm light pool BEHIND the people; ONE accent object per shot',
      'never gradients, textures, noise, blur, paper or watercolour',
      'Hands ON things (solve the palm first), never across a face',
      'Dutch tilt 2-7 deg only on tense beats',
      'acting on twos, expressions snap',
      'Traces (>= 3)',
      'never `ctx.text` or `ctx.annotate`',
    ]) {
      expect(brief).toContain(part);
    }
    const build = prompts['scene-build'];
    expect(build).toContain(`${brief}\n`);
    for (const part of [
      '(i) list the people, places, things and actions',
      '(ii) Cast and place',
      '(iii) The cut table from the beats',
      '(iv) Contacts first, in world space, before the camera',
      '(v) Draw order in the painter: the camera first',
      '(vi) Check every framing',
      'reelforge kit-docs people` and `places`',
      'reelforge kit-docs ink-camera',
      'Pitfalls seen in real films:',
    ]) {
      expect(build).toContain(part);
    }
    for (const name of ['stage', 'paint', 'person', 'place', 'cuts', 'camera', 'reach'] as const) {
      expect(build).toContain(`\`${C_CAM_SNIPPETS[name]}\``);
    }
    expect(build).toContain('Page moment planned for this shot (`reverse`;');
    expect(build).toContain('// moment: <id> | intent:');
    expect(build).toContain('Never reverse the same place twice in a film');
    expect(build).toContain('draw each into the place, never with `ctx.annotate`');
    expect(build).not.toContain('MISSING: <prop names>');
    const fix = prompts['scene-fix'];
    expect(fix).toContain('this shot is in look `ink-poster`');
    expect(fix).toContain('Keep the planned page moment (`poster`) in the shot: The line the film');
    expect(fix).toContain(`\`${C_CAM_SNIPPETS.poster}\``);
    expect(fix).toContain('Never the same emblem and layout twice in a film');
  });

  it('ask the critic for the checklist and the planned breakthrough', () => {
    const critic = prompts.critic;
    expect(critic).toContain('QA reviewer for hand-inked grim cartoon video frames');
    expect(critic).toContain('Craft check (Grim Ink): one focal point per framing, off-centre');
    expect(critic).toContain(
      'Planned page moment (`reverse`): the same place seen from the opposite',
    );
    expect(critic).toContain('a note starting `reverse:`');
    expect(critic).toContain("the ink line's swell, the mottle and hatching of every fill");
    expect(critic).toContain('a hand floating near a prop');
  });

  it('give the script grim-ink surprises', () => {
    expect(scriptWorldVars(GRIM)['worldSurprise']).toContain('a sudden shot moment');
    expect(scriptWorldVars(GRIM)).not.toHaveProperty('worldScript');
  });

  it('keep every quoted call on the one API namespace list', () => {
    const all = JSON.stringify(text);
    expect(all).toContain(C_CAM_API.people);
    expect(all).toContain(C_CAM_API.places);
    for (const snippet of Object.values(C_CAM_SNIPPETS)) {
      expect(snippet).not.toMatch(/\bctx\.(?:text|annotate)\b|Math\.random|Date\b/);
    }
    // The transitions sentence stays for the worlds that have page transitions.
    const comic = worldPromptText('comic');
    if (comic === undefined) throw new Error('no comic prompt text');
    expect(storyboardMomentVars(comic, 155)['worldMomentRules']).toContain(
      'different page transitions',
    );
    expect(storyboardMomentVars(text, 155)['worldMomentRules']).not.toContain('transitions');
  });
});

const LOOK = { A: 'ink-scene', B: 'ink-insert', C: 'ink-poster' } as const;
const TREATMENT: Record<'A' | 'B' | 'C', Treatment> = {
  A: 'character-scene',
  B: 'metaphor-object',
  C: 'title-card',
};
type Plan = readonly ['A' | 'B' | 'C', (string | undefined)?];

function film(plans: readonly Plan[], lengthS = 6): StoryboardShot[] {
  return plans.map(([roll, moment], index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: index * lengthS,
      t1: (index + 1) * lengthS,
      treatment: TREATMENT[roll],
      intent: `shot ${id}`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      transitionIn: { type: 'cut' },
      ...(moment === undefined ? {} : { worldMoment: moment }),
    };
  });
}

/** 20 shots (120 s): a reverse, a poster, inserts and over-the-shoulders, hard cuts only. */
const VARIED: readonly Plan[] = [
  ['C'],
  ['A'],
  ['B', 'insert'],
  ['A', 'over-shoulder'],
  ['A', 'reverse'],
  ['B'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C', 'poster'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['B', 'insert'],
];
const OPTIONS = { moments: text.moments, transitions: [] };
const codes = (plans: readonly Plan[]): string[] =>
  checkWorldVariety(film(plans), OPTIONS).map((entry) => entry.code);
const replaced = (index: number, plan: Plan): Plan[] =>
  VARIED.map((entry, at) => (at === index ? plan : entry));

describe('Grim Ink variety', () => {
  it('passes a varied film with hard cuts only', () => {
    expect(codes(VARIED)).toEqual([]);
  });

  it.each([
    ['a reverse on a poster', replaced(4, ['C', 'reverse']), ['moment-look']],
    ['a poster next to the reverse', replaced(5, ['C', 'poster']), ['moment-spacing']],
    ['one breakthrough kind only', replaced(11, ['A', 'reverse']), ['moment-variety']],
    ['a comic moment', replaced(9, ['B', 'cutaway']), ['moment-unknown']],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(plans)).toEqual(expect.arrayContaining(expected));
  });

  it('names the cues in the quota repair message', () => {
    const plain = VARIED.map(([roll]): Plan => [roll]);
    const [quota] = checkWorldVariety(film(plain), OPTIONS);
    expect(quota?.code).toBe('moment-quota');
    expect(quota?.message).toContain(
      'a reveal from the other side → reverse, the line the film turns on → poster',
    );
  });

  it('flags a reverse in a shot too short to cut to the other side', () => {
    const short = film(VARIED).map((shot) =>
      shot.worldMoment === 'reverse' ? { ...shot, t1: shot.t0 + 2 } : shot,
    );
    expect(checkWorldVariety(short, OPTIONS).map((entry) => entry.code)).toContain('moment-length');
  });
});
