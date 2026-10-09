/**
 * World wording in the prompts (PLAN.md#13.6): without the world variables the storyboard,
 * scene-build, scene-fix and critic prompts are byte for byte what they were before worlds (every
 * other section switched on: `legacy-all-*.txt`, captured from storyboard v15 / scene-build v14 /
 * scene-fix v2 / critic v6); a Sketchbook project gets its own film, rolls, transitions, craft
 * brief and critic checklist, and no voxel text.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, promptVariables, renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
  type WorldTransitionOption,
} from './worlds/index.js';

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

/** World variables, and the genre preset's (ADR-035; genre-prompts.test.ts), stay unset. */
// ...and the research and no-questions sections (real runs Comic 1, Game B2 1): unset for legacy.
const WORLD_VARS = /^(world|craftBrief|genre|research|noQuestions|short)/;
const WORLD_PROMPT_IDS = ['storyboard', 'scene-build', 'scene-fix', 'critic'] as const;
const TAG = /\{\{[#^/]?\w+\}\}/;

/** Every variable of the prompt except the world's, as `<name>` (every section renders). */
function legacyVars(id: PromptId): Record<string, string> {
  const { required, optional } = promptVariables(id);
  return Object.fromEntries(
    [...required, ...optional]
      .filter((name) => !WORLD_VARS.test(name))
      .map((name) => [name, `<${name}>`]),
  );
}

const text = worldPromptText('sketchbook');
if (text === undefined) throw new Error('no sketchbook prompt text');
const SKETCHBOOK: PromptWorld = { label: 'Sketchbook', text };
const TRANSITIONS: readonly WorldTransitionOption[] = [
  {
    id: 'sketchbook-page-flip',
    type: 'wipe',
    duration: 0.62,
    description: 'the page turns over the spiral',
  },
  { id: 'sketchbook-riffle', type: 'wipe', duration: 0.8, description: 'three quick flips' },
  { id: 'sketchbook-crumple-toss', type: 'wipe', duration: 0.95, description: 'balled up' },
  { id: 'sketchbook-tape-peel', type: 'wipe', duration: 0.7, description: 'peeled off' },
  { id: 'sketchbook-torn-strip', type: 'wipe', duration: 0.8, description: 'torn out' },
];
const LOOKS = [
  '- `sketch-story` (Sketch story): felt-tip story pages. Rolls: A. Treatments: metaphor-object.',
  '- `sketch-graph` (Sketch graph): ballpoint proofs. Rolls: B. Treatments: data-chart-3d.',
  '- `sketch-loud` (Sketch loud): loud notebook moments. Rolls: C. Treatments: kinetic-text.',
].join('\n');
const STORYBOARD_VARS = {
  styleId: 'sketchbook',
  looks: LOOKS,
  multiLook: true,
  maxTransitions: '3',
  tension: '- 0:00–0:20 calm',
  interrupts: true,
  interruptRules: 'Plan 1–2 interrupts.',
  continuityLinks: true,
  continuityBudget: 2,
  ...storyboardWorldVars(SKETCHBOOK, 'sketch-story', TRANSITIONS, { durationS: 155 }),
};
const SHOT = { id: 's02_oak', t0: 3, t1: 7, treatment: 'metaphor-object', look: 'sketch-story' };
const SCENE_VARS = {
  shotId: SHOT.id,
  shotScene: 'scenes/s02_oak.js',
  shotJson: SHOT,
  shotWords: [{ text: 'oak', t: 3.2, tEnd: 3.6 }],
  neighbours: [],
  styleId: 'sketchbook',
  lookId: 'sketch-story',
  lookDocs: 'Look `sketch-story` (world Sketchbook, A roll): one notebook page per shot.',
  annotationPlan: '- "the old oak" (name): pin on oak, text "OAK"',
  ...sceneWorldVars(SKETCHBOOK, 'sticky-slap'),
};
const FIX_VARS = {
  scope: 'Shot',
  shotIds: SHOT.id,
  request: 'QA fix 1/2 for shot s02_oak.',
  critic: 'error critic: craft: no focal point',
  ...fixWorldVars(SKETCHBOOK, 'sketch-story', 'sticky-slap'),
};
const CRITIC_VARS = {
  styleId: 'sketchbook',
  imagePaths: '.reelforge/qa/s02_oak/build-1.png',
  intent: 'The ranger points at the old oak.',
  lookId: 'sketch-story',
  roll: 'A',
  lookRules: 'Sketch story: a felt-tip notebook page.',
  ...criticWorldVars(SKETCHBOOK, 'sticky-slap'),
};

describe('world sections off', () => {
  it.each(WORLD_PROMPT_IDS)('%s renders byte-identically to its pre-world text', (id) => {
    expect(rendered(id, legacyVars(id))).toBe(fixture(`legacy-all-${id}.txt`));
  });

  it('bumps the versions of the prompts with world wording', () => {
    expect(WORLD_PROMPT_IDS.map((id) => loadPrompt(id).version)).toEqual([20, 19, 7, 11]);
  });
});

describe('sketchbook prompts', () => {
  const prompts = {
    storyboard: rendered('storyboard', STORYBOARD_VARS),
    'scene-build': rendered('scene-build', SCENE_VARS),
    'scene-fix': rendered('scene-fix', FIX_VARS),
    critic: rendered('critic', CRITIC_VARS),
  };

  it.each(WORLD_PROMPT_IDS)('%s has no voxel text and no open tags', async (id) => {
    expect(prompts[id]).not.toMatch(/voxel/i);
    expect(prompts[id]).not.toMatch(TAG);
    await expect(prompts[id]).toMatchFileSnapshot(`fixtures/sketchbook-${id}.txt`);
  });

  it('give the storyboard the world, its rolls, transitions and continuity', () => {
    const storyboard = prompts.storyboard;
    expect(storyboard).toContain('for a hand-drawn sketchbook video');
    expect(storyboard).toContain('World brief (Sketchbook): the whole film is one spiral notebook');
    expect(storyboard).toContain('- `A` = the story page (`sketch-story`');
    expect(storyboard).toContain('- `B` = the proof on paper (`sketch-graph`');
    expect(storyboard).toContain('- `C` = the loud page (`sketch-loud`');
    expect(storyboard).toContain('"roll": "B", "look": "sketch-graph" }');
    for (const option of TRANSITIONS) expect(storyboard).toContain(`- \`${option.id}\` (wipe`);
    expect(storyboard).toContain(
      'e.g. `{ "type": "wipe", "duration": 0.62, "style": "sketchbook-page-flip" }`',
    );
    expect(storyboard).toContain('Continuity links (on for this project');
    expect(storyboard).toContain('Kind in this world: only `look-switch`');
    expect(storyboard).not.toContain('crt-zoom');
    expect(storyboard).not.toContain('Wow transitions');
  });

  it('give scene-build and scene-fix the craft brief (≤ 1.5 KB) and the hand-drawn marks', () => {
    const brief = text.craftBrief;
    expect(Buffer.byteLength(brief, 'utf8')).toBeLessThanOrEqual(1536);
    for (const part of [
      'The notebook is the style; THIS narration is the content.',
      'as a comment: `// nouns: <what it names> | drawn as:',
      '| focal: <read first> | traces: <three>`',
      'ONE focal point, off-centre',
      'Inks: felt-tip = story, ballpoint = proof and numbers',
      'red = only the correction on the point',
      "Don't: centred or symmetric layouts, decoration without meaning",
      'only words of the narration or research notes',
    ]) {
      expect(brief).toContain(part);
    }
    expect(prompts['scene-build']).toContain(`${brief}\n`);
    expect(prompts['scene-build']).toContain('draw each by hand on the page (`page.write`');
    expect(prompts['scene-build']).toContain('Design the page before the code');
    // Real film 4: C and B pages built without scene.add rendered blank frames.
    expect(prompts['scene-build']).toContain(
      'Build ONE page per shot: `scene.add(page)` in build() and `page.update(t)` in update(t)',
    );
    expect(prompts['scene-build']).toContain("layout: 'landscape', library: ctx.worldAssets })");
    expect(prompts['scene-build']).toContain("`page.use('fire-tower', { x: 120");
    expect(prompts['scene-build']).toContain('never end your reply with a `MISSING:` line');
    expect(prompts['scene-build']).not.toContain('Camera always moving');
    expect(prompts['scene-build']).not.toContain('MISSING: <prop names>');
    expect(prompts['scene-fix']).toContain('this shot is in look `sketch-story`');
    expect(prompts['scene-fix']).toContain(brief);
  });

  it('ask the critic for the craft checklist, the focal point and the traces', () => {
    const critic = prompts.critic;
    expect(critic).toContain('QA reviewer for hand-drawn sketchbook video frames');
    expect(critic).toContain('Craft check (Sketchbook): one focal point');
    expect(critic).toContain('`focal: <the one thing read first>; traces: <trace>, <trace>');
    expect(critic).toContain('a note starting `craft:`');
    expect(critic).toContain('not against the other looks of this world');
    expect(critic).toContain('"note":"≤25 words"');
  });
});
