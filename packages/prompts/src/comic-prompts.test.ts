/**
 * Comic wording in the prompts (PLAN.md#13.3 part c): a Comic project gets its own film, rolls,
 * panel-native transitions, craft brief, critic checklist and moment catalog (flashback and spread
 * as breakthroughs with a required intent), no voxel text; the variety validator runs on the comic
 * catalog with the generic rules. The legacy and Sketchbook renderings stay as they were
 * (world-prompts.test.ts, world-variety-prompts.test.ts).
 */
import type { StoryboardShot, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import { checkWorldVariety } from './validators/world-variety.js';
import {
  COMIC_SNIPPETS,
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
  type WorldTransitionOption,
} from './worlds/index.js';

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('comic');
if (text === undefined) throw new Error('no comic prompt text');
const COMIC: PromptWorld = { label: 'Comic', text };
const TRANSITIONS: readonly WorldTransitionOption[] = [
  ['page-turn', 0.9],
  ['page-back', 0.9],
  ['gutter-wipe', 0.7],
  ['panel-zoom', 1],
  ['panel-slam', 0.55],
  ['ink-bleed', 0.9],
].map(([name, duration]) => ({
  id: `comic-${String(name)}`,
  type: 'wipe',
  duration: Number(duration),
  description: String(name),
}));
const LOOKS = [
  '- `comic-story` (Comic story): story panels. Rolls: A. Treatments: character-scene.',
  '- `comic-info` (Comic info): information pages. Rolls: B. Treatments: data-chart-3d.',
  '- `comic-loud` (Comic loud): loud moments. Rolls: C. Treatments: kinetic-text.',
].join('\n');
const TAG = /\{\{[#^/]?\w+\}\}/;

const prompts = {
  storyboard: rendered('storyboard', {
    styleId: 'comic',
    looks: LOOKS,
    multiLook: true,
    maxTransitions: '3',
    interrupts: true,
    interruptRules: 'Plan 1–2 interrupts.',
    continuityLinks: true,
    continuityBudget: 2,
    ...storyboardWorldVars(COMIC, 'comic-story', TRANSITIONS, { durationS: 155 }),
  }),
  'scene-build': rendered('scene-build', {
    shotId: 's03_why',
    shotScene: 'scenes/s03_why.js',
    shotJson: { id: 's03_why', t0: 9, t1: 17, treatment: 'node-graph/timeline' },
    shotWords: [{ text: 'earlier', t: 9.4, tEnd: 9.9 }],
    neighbours: [],
    styleId: 'comic',
    lookId: 'comic-info',
    lookDocs: 'Look `comic-info` (world Comic, B roll): the explainer is still a comic page.',
    annotationPlan: '- "1961" (date): caption "1961"',
    ...sceneWorldVars(COMIC, 'flashback'),
  }),
  'scene-fix': rendered('scene-fix', {
    scope: 'Shot',
    shotIds: 's09_spread',
    request: 'QA fix 1/2 for shot s09_spread.',
    critic: 'error critic: spread: the picture holds 6 s',
    ...fixWorldVars(COMIC, 'comic-loud', 'spread'),
  }),
  critic: rendered('critic', {
    styleId: 'comic',
    imagePaths: '.reelforge/qa/s03_why/build-1.png',
    intent: 'The deadline was set eight years earlier.',
    lookId: 'comic-info',
    roll: 'B',
    lookRules: 'Comic info: a cutaway, a chart as panel art.',
    ...criticWorldVars(COMIC, 'flashback'),
  }),
};

describe('comic prompts', () => {
  it.each(Object.keys(prompts) as (keyof typeof prompts)[])(
    '%s has no voxel text and no open tags',
    async (id) => {
      expect(prompts[id]).not.toMatch(/voxel/i);
      expect(prompts[id]).not.toMatch(TAG);
      await expect(prompts[id]).toMatchFileSnapshot(`fixtures/comic-${id}.txt`);
    },
  );

  it('give the storyboard the world, its rolls, transitions, catalog and quota', () => {
    const storyboard = prompts.storyboard;
    expect(storyboard).toContain('storyboard artist for a printed comic-book video');
    expect(storyboard).toContain('World brief (Comic): the whole film is one printed comic book');
    expect(storyboard).toContain('- `A` = the story page (`comic-story`');
    expect(storyboard).toContain('- `B` = the information page (`comic-info`');
    expect(storyboard).toContain('- `C` = the loud page (`comic-loud`');
    for (const option of TRANSITIONS) expect(storyboard).toContain(`- \`${option.id}\` (wipe`);
    expect(storyboard).toContain('- `flashback` (breakthrough; look `comic-info`): use when');
    expect(storyboard).toContain('- `spread` (breakthrough; look `comic-loud`): use when');
    for (const id of ['pause-panel', 'impact-break', 'cutaway', 'checklist', 'big-line']) {
      expect(storyboard).toContain(`- \`${id}\` (moment; look`);
    }
    expect(storyboard).toContain('Breakthroughs (`flashback`, `spread`)');
    expect(storyboard).toContain('needs at least 2 and at most 5, of at least 2 different kinds');
    expect(storyboard).toContain('"worldMoment": "flashback" }');
    expect(storyboard).toContain('`zoom-through` into a panel or a drawn object');
    expect(storyboard).not.toContain('sketch');
  });

  it('give scene-build and scene-fix the craft brief and the toolkit, never a template', () => {
    const brief = text.craftBrief;
    expect(Buffer.byteLength(brief, 'utf8')).toBeLessThanOrEqual(1536);
    for (const part of [
      'write a comment: `// focal:',
      'ONE focal point, off-centre (panel size = importance',
      'balloon tails at the speaker',
      'speed lines stop before the subject',
      'a near-empty pause panel before a twist',
      'identical panels in a grid (unless it is the joke), > 5 panels',
      'only words of the narration or research notes',
      'slick polished art: keep figures simple, slightly crude',
      'docs/worlds/comic-panels-v2/shots/',
    ]) {
      expect(brief).toContain(part);
    }
    const build = prompts['scene-build'];
    expect(build).toContain(`${brief}\n`);
    expect(build).toContain('Page moment planned for this shot (`flashback`;');
    expect(build).toContain(`\`${COMIC_SNIPPETS.flashback}\``);
    expect(build).toContain('Every flashback is original');
    expect(build).toContain('Never the same cover and arrangement twice in one film');
    expect(build).toContain('letter each on the page (`page.caption`');
    expect(build).toContain(`\`${COMIC_SNIPPETS.page}\``);
    expect(build).not.toContain('MISSING: <prop names>');
    const fix = prompts['scene-fix'];
    expect(fix).toContain('this shot is in look `comic-loud`');
    expect(fix).toContain('Keep the planned page moment (`spread`) in the shot: `page.spread(');
    expect(fix).toContain('never > 4 s without a new beat');
  });

  it('ask the critic for the comic checklist and the planned breakthrough', () => {
    const critic = prompts.critic;
    expect(critic).toContain('QA reviewer for printed comic-book video frames');
    expect(critic).toContain('Craft check (Comic): one focal point, off-centre');
    expect(critic).toContain('Planned page moment (`flashback`): the page printed as an older');
    expect(critic).toContain('a note starting `flashback:`');
    expect(critic).toContain('the paper, the panel borders, the gutters and the halftone screen');
  });

  it('give the script comic surprises', () => {
    expect(scriptWorldVars(COMIC)['worldSurprise']).toContain('a sudden page moment');
  });
});

const LOOK = { A: 'comic-story', B: 'comic-info', C: 'comic-loud' } as const;
const TREATMENT: Record<'A' | 'B' | 'C', Treatment> = {
  A: 'character-scene',
  B: 'node-graph/timeline',
  C: 'kinetic-text',
};
type Plan = readonly ['A' | 'B' | 'C', (string | undefined)?, (string | undefined)?];

function film(plans: readonly Plan[], lengthS = 6): StoryboardShot[] {
  return plans.map(([roll, moment, style], index) => {
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
      transitionIn:
        style === undefined || index === 0
          ? { type: 'cut' }
          : { type: 'wipe', duration: 0.8, style: `comic-${style}` },
      ...(moment === undefined || moment === '-' ? {} : { worldMoment: moment }),
    };
  });
}

/** 20 shots (120 s): a flashback, a spread, five smaller moments, three panel transitions. */
const VARIED: readonly Plan[] = [
  ['A'],
  ['B'],
  ['A', 'squeeze'],
  ['B', 'flashback', 'page-back'],
  ['A'],
  ['C', 'pause-panel'],
  ['A', 'impact-break', 'panel-slam'],
  ['B', 'cutaway'],
  ['A'],
  ['C'],
  ['A'],
  ['B', 'checklist'],
  ['A'],
  ['C', 'spread', 'page-turn'],
  ['A'],
  ['B'],
  ['A', 'big-line'],
  ['C'],
  ['A'],
  ['B'],
];
const OPTIONS = { moments: text.moments, transitions: TRANSITIONS };
const codes = (plans: readonly Plan[]): string[] =>
  checkWorldVariety(film(plans), OPTIONS).map((entry) => entry.code);
const replaced = (index: number, plan: Plan): Plan[] =>
  VARIED.map((entry, at) => (at === index ? plan : entry));

describe('comic variety', () => {
  it('passes a varied comic film', () => {
    expect(codes(VARIED)).toEqual([]);
  });

  it.each([
    ['a flashback on a story page', replaced(3, ['A', 'flashback', 'page-back']), ['moment-look']],
    ['a spread next to the flashback', replaced(4, ['C', 'spread']), ['moment-spacing']],
    [
      'one breakthrough kind only',
      replaced(13, ['B', 'flashback', 'page-turn']),
      ['moment-variety'],
    ],
    ['a sketchbook moment', replaced(10, ['A', 'popup']), ['moment-unknown']],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(plans)).toEqual(expect.arrayContaining(expected));
  });

  it('names the comic cues in the quota repair message', () => {
    const plain = VARIED.map(([roll, , style]): Plan => [roll, '-', style]);
    const [quota] = checkWorldVariety(film(plain), OPTIONS);
    expect(quota?.code).toBe('moment-quota');
    expect(quota?.message).toContain(
      'plan them where the narration calls for them (a look back to where it came from → flashback, the big picture → spread)',
    );
  });

  it('keeps the Sketchbook quota message as it was', () => {
    const sketchbook = worldPromptText('sketchbook');
    const shots = film([['A'], ['B'], ['A'], ['B'], ['A'], ['C']]).map((shot) => ({
      ...shot,
      look: shot.look?.replace('comic', 'sketch').replace('info', 'graph'),
      transitionIn: { type: 'cut' as const },
    }));
    const [quota] = checkWorldVariety(shots, { moments: sketchbook?.moments ?? [] });
    expect(quota?.message).toBe(
      '0 breakthrough moments (popup, strip) in 36 s; this film needs at least 1 (about one per 50 s): plan them where the narration calls for them (a reveal or twist → popup, a sequence of dates → strip)',
    );
  });
});
