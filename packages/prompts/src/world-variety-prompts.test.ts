/**
 * World variety in the prompts (real run Sketchbook 1): the Sketchbook storyboard gets the moment
 * catalog with "use when the narration …" lines and the film's quota; scene-build and scene-fix
 * get the exact call of the planned moment; the critic checks it shows; the script's surprise
 * beats and the sound designer's moods follow the world. Without the world variables the script
 * and sound-cues prompts render byte for byte as before (`legacy-all-script.txt` from script v2,
 * `legacy-all-sound-cues.txt` from sound-cues v4, every other section switched on).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, promptVariables, renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  breakthroughQuota,
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';

const WORLD_VARS = /^(world|craftBrief)/;

function fixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
}

function legacyVars(id: PromptId): Record<string, string> {
  const { required, optional } = promptVariables(id);
  return Object.fromEntries(
    [...required, ...optional]
      .filter((name) => !WORLD_VARS.test(name))
      .map((name) => [name, `<${name}>`]),
  );
}

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('sketchbook');
if (text === undefined) throw new Error('no sketchbook prompt text');
const SKETCHBOOK: PromptWorld = { label: 'Sketchbook', text };
const TRANSITIONS = [
  { id: 'sketchbook-page-flip', type: 'wipe', duration: 0.62, description: 'the page turns' },
  { id: 'sketchbook-torn-strip', type: 'wipe', duration: 0.8, description: 'torn out' },
];

describe('world sections off (script, sound-cues)', () => {
  it.each(['script', 'sound-cues'] as const)('%s renders byte-identically', (id) => {
    expect(rendered(id, legacyVars(id))).toBe(fixture(`legacy-all-${id}.txt`));
  });

  it('bumps the versions of the prompts with world variety wording', () => {
    const ids = ['storyboard', 'scene-build', 'scene-fix', 'critic', 'script', 'sound-cues'];
    expect(ids.map((id) => loadPrompt(id as PromptId).version)).toEqual([18, 17, 5, 9, 3, 5]);
  });
});

describe('breakthroughQuota', () => {
  it.each([
    [20, undefined, { min: 0, max: 1, kinds: 0 }],
    [30, undefined, { min: 1, max: 1, kinds: 1 }],
    [50, undefined, { min: 1, max: 2, kinds: 1 }],
    [50, { minBreakthroughs: 2 }, { min: 2, max: 2, kinds: 2 }],
    [155, undefined, { min: 2, max: 5, kinds: 2 }],
    [360, undefined, { min: 6, max: 11, kinds: 2 }],
  ])('a %s s film (override %j) needs %j', (durationS, override, quota) => {
    expect(breakthroughQuota(durationS, override)).toEqual(quota);
  });
});

describe('sketchbook moment wording', () => {
  const storyboard = rendered('storyboard', {
    styleId: 'sketchbook',
    looks: '- `sketch-story` (Sketch story)',
    multiLook: true,
    ...storyboardWorldVars(SKETCHBOOK, 'sketch-story', TRANSITIONS, { durationS: 155 }),
  });

  it('gives the storyboard the closed catalog, the quota and the variety rules', () => {
    for (const id of ['popup', 'strip', 'flipbook', 'envelope', 'sticky-slap', 'torn-page']) {
      expect(storyboard).toContain(`- \`${id}\` (`);
    }
    expect(storyboard).toContain('- `ruler-graph` (moment; look `sketch-graph`): use when');
    expect(storyboard).toContain(
      '- `popup` (breakthrough; look `sketch-loud`): use when the narration turns on a reveal',
    );
    expect(storyboard).toContain('- `strip` (breakthrough; look `sketch-graph`): use when');
    expect(storyboard).toContain('- `torn-page` (moment; any look)');
    expect(storyboard).toContain(
      'this film (about 155 s) needs at least 2 and at most 5, of at least 2 different kinds; never in adjacent shots.',
    );
    expect(storyboard).toContain('The same moment kind at most once per 90 s');
    expect(storyboard).toContain('never more than 2 shots in a row in one look');
    expect(storyboard).toContain('use at least 3 different page transitions');
    expect(storyboard).toContain('"worldMoment": "popup" }');
    expect(storyboard).toContain('Rhythm: never more than 2 shots in a row in one look');
  });

  it('asks a world film of 45 s+ for continuity links only inside the links section', () => {
    const vars = (durationS: number) =>
      storyboardWorldVars(SKETCHBOOK, 'sketch-story', TRANSITIONS, { durationS });
    expect(vars(30)['worldContinuity']).toBeUndefined();
    expect(vars(50)['worldContinuity']).toContain('this film (about 50 s) needs at least 1 link');
    expect(vars(155)['worldContinuity']).toContain('needs at least 2 links');
    expect(vars(50)['worldContinuity']).toContain('`zoom-through` into a drawn object');
    const base = { styleId: 'sketchbook', looks: '- x', multiLook: true, ...vars(50) };
    const on = rendered('storyboard', { ...base, continuityLinks: true, continuityBudget: 1 });
    expect(on).toContain(
      '"opens on the wall calendar page"). In this world the link is the signature cut',
    );
    expect(rendered('storyboard', base)).not.toContain('signature cut');
  });

  it('a short test film with an override asks for two breakthroughs of two kinds', () => {
    const vars = storyboardWorldVars(SKETCHBOOK, 'sketch-story', TRANSITIONS, {
      durationS: 50,
      override: { minBreakthroughs: 2 },
    });
    expect(vars['worldMomentRules']).toContain('needs at least 2 and at most 2, of at least 2');
  });

  it('gives scene-build and scene-fix the exact call of the planned moment', () => {
    const shot = { id: 's07', t0: 30, t1: 36, treatment: 'node-graph/timeline' };
    const build = rendered('scene-build', {
      shotId: 's07',
      shotScene: 'scenes/s07.js',
      shotJson: shot,
      shotWords: [],
      neighbours: [],
      styleId: 'sketchbook',
      ...sceneWorldVars(SKETCHBOOK, 'strip'),
    });
    expect(build).toContain('Page moment planned for this shot (`strip`;');
    expect(build).toContain("build it with `page.strip({ y: 156, events: [{ label: '2 NOV'");
    expect(build).toContain('2-8 events in order');
    const popup = rendered('scene-build', {
      shotId: 's07',
      shotScene: 'scenes/s07.js',
      shotJson: shot,
      shotWords: [],
      neighbours: [],
      styleId: 'sketchbook',
      ...sceneWorldVars(SKETCHBOOK, 'popup'),
    });
    expect(popup).toContain(
      "`page.popup({ x, y, w, depth, at, intent: '<the claim the motion shows>'",
    );
    expect(popup).toContain('Every pop-up is original: no template');
    expect(popup).toContain('Never the same mechanism twice in one film');
    expect(popup).toContain('every element that moves, is something the narration names');
    const fix = rendered('scene-fix', {
      scope: 'Shot',
      shotIds: 's07',
      request: 'QA fix',
      ...fixWorldVars(SKETCHBOOK, 'sketch-loud', 'popup'),
    });
    expect(fix).toContain('Keep the planned page moment (`popup`) in the shot: `page.popup(');
    expect(sceneWorldVars(SKETCHBOOK)).not.toHaveProperty('worldMomentDirective');
    expect(sceneWorldVars(SKETCHBOOK, 'plain')).not.toHaveProperty('worldMomentDirective');
  });

  it('asks the critic to see the moment and to count only authored marks as traces', () => {
    const critic = rendered('critic', {
      styleId: 'sketchbook',
      imagePaths: 'a.png',
      intent: 'The strip runs through November.',
      ...criticWorldVars(SKETCHBOOK, 'strip'),
    });
    expect(critic).toContain('Planned page moment (`strip`): an accordion paper strip');
    expect(critic).toContain('a note starting `moment:`');
    expect(critic).toContain('the spiral binding, the paper (lines, grid, grain), the page number');
    expect(rendered('critic', { styleId: 's', imagePaths: 'a', intent: 'i' })).not.toContain(
      'Planned page moment',
    );
  });

  it('gives the script page-native surprises and the sound designer the world moods', () => {
    const script = rendered('script', {
      ...legacyVars('script'),
      ...scriptWorldVars(SKETCHBOOK),
    });
    expect(script).toContain('the surprise — a sudden page moment');
    expect(script).not.toMatch(/diorama|CRT/);
    const cues = rendered('sound-cues', {
      ...legacyVars('sound-cues'),
      world: 'Sketchbook',
      worldMoods: 'lofi-chill, calm-tech',
    });
    expect(cues).toContain('to any of lofi-chill, calm-tech (the moods of this world; no others)');
    expect(cues).not.toContain('retro-wave');
  });

  it('keeps the craft brief within 1.5 KB with the fill-the-page and one-hand rules', () => {
    expect(Buffer.byteLength(text.craftBrief, 'utf8')).toBeLessThanOrEqual(1536);
    expect(text.craftBrief).toContain('>= 25% of the page height');
    expect(text.craftBrief).toContain('never < 3 elements on the page for > 0.6 s');
    expect(text.craftBrief).toContain('last mark done >= 0.4 s before the end');
    expect(text.craftBrief).toContain(
      'ALWAYS `kit.fx.sketchPage({ …, duration: ctx.shot.duration })`',
    );
    expect(text.craftBrief).toContain('marks > 80 px apart never overlap in time');
    expect(text.craftBrief).toContain('labels and numbers `appear` on their own');
    expect(text.craftBrief).toContain('never cut a narration word');
    expect(text.motion).toContain('`parallel: true` only on purpose');
    expect(text.motion).toContain('never cut content words from the narration');
    expect(text.motion).toContain('always create the page with `duration: ctx.shot.duration`');
  });
});
