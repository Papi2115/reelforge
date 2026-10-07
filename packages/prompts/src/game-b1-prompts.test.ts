/**
 * Game B1 wording in the prompts (PLAN.md#13.5 part c, #13.15 phase 2): a Game B1 project gets its
 * own film, rolls, game-native transitions (the continuity ones name their link), the style
 * grammar and a design process per shot (the narration's nouns → sprites, playfields, the room),
 * craft brief, critic checklist and moment catalog (the high-score table and the manual page as
 * breakthroughs, each with a required intent; the calendar zoom and the console swap as in-shot
 * seams), no voxel text; the variety validator runs on the game catalog with the generic rules and
 * asks for the `continuity` of a link transition. The showcase's nouns: game-b1-bias.test.ts.
 */
import type { ContinuityKind, StoryboardShot, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import { checkWorldVariety } from './validators/world-variety.js';
import {
  criticWorldVars,
  fixWorldVars,
  GAME_B1_SNIPPETS,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  worldTransitionLine,
  type PromptWorld,
  type WorldTransitionOption,
} from './worlds/index.js';

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('game-b1');
if (text === undefined) throw new Error('no game-b1 prompt text');
const GAME: PromptWorld = { label: 'Game B1: Atari boss montage', text };
const LINKS: Readonly<Record<string, ContinuityKind>> = {
  'calendar-zoom': 'zoom-through',
  'cartridge-in': 'carry-environment',
  'cartridge-out': 'carry-environment',
};
const TRANSITIONS: readonly WorldTransitionOption[] = [
  ['calendar-zoom', 1.2],
  ['cartridge-in', 0.8],
  ['cartridge-out', 0.9],
  ['attract-cycle', 1],
  ['scanline-wipe', 0.62],
  ['page-slide', 0.8],
  ['page-turn', 0.5],
  ['room-shake', 0.5],
].map(([name, duration]) => ({
  id: `game-b1-${String(name)}`,
  type: 'wipe',
  duration: Number(duration),
  description: String(name),
  ...(LINKS[String(name)] === undefined ? {} : { link: LINKS[String(name)] }),
}));
const LOOKS = [
  '- `atari-story` (Atari story): the story in the TV or the room. Rolls: A. Treatments: character-scene.',
  "- `atari-menu` (Atari menu): the console's screens. Rolls: B. Treatments: ui-mockup.",
  '- `atari-boss` (Atari boss): the pressure. Rolls: C. Treatments: kinetic-text.',
].join('\n');
const TAG = /\{\{[#^/]?\w+\}\}/;

const prompts = {
  storyboard: rendered('storyboard', {
    styleId: 'game-b1',
    looks: LOOKS,
    multiLook: true,
    maxTransitions: '4',
    interrupts: true,
    interruptRules: 'Plan 1–2 interrupts.',
    continuityLinks: true,
    continuityBudget: 2,
    ...storyboardWorldVars(GAME, 'atari-story', TRANSITIONS, { durationS: 150 }),
  }),
  'scene-build': rendered('scene-build', {
    shotId: 's04_scores',
    shotScene: 'scenes/s04_scores.js',
    shotJson: { id: 's04_scores', t0: 24, t1: 31.5, treatment: 'counter/odometer' },
    shotWords: [{ text: 'first', t: 26.7, tEnd: 27.1 }],
    neighbours: [],
    styleId: 'game-b1',
    lookId: 'atari-menu',
    lookDocs: "Look `atari-menu` (world Game B1, B roll): the console's screens.",
    annotationPlan: '- "1953" (number): counter 1953',
    ...sceneWorldVars(GAME, 'score-table'),
  }),
  'scene-fix': rendered('scene-fix', {
    scope: 'Shot',
    shotIds: 's08_manual',
    request: 'QA fix 1/2 for shot s08_manual.',
    critic: 'error critic: manual: the red correction is not on the point',
    ...fixWorldVars(GAME, 'atari-menu', 'manual'),
  }),
  critic: rendered('critic', {
    styleId: 'game-b1',
    imagePaths: '.reelforge/qa/s06_flood/build-1.png',
    intent: 'The storm rises over the point; its weak point is the old pier.',
    lookId: 'atari-boss',
    roll: 'C',
    lookRules: 'Atari boss: the pressure moments.',
    ...criticWorldVars(GAME, 'boss-card'),
  }),
};

describe('game-b1 prompts', () => {
  it.each(Object.keys(prompts) as (keyof typeof prompts)[])(
    '%s has no voxel text and no open tags',
    async (id) => {
      expect(prompts[id]).not.toMatch(/voxel/i);
      expect(prompts[id]).not.toMatch(TAG);
      await expect(prompts[id]).toMatchFileSnapshot(`fixtures/game-b1-${id}.txt`);
    },
  );

  it('give the storyboard the world, its rolls, transitions with their links, catalog and quota', () => {
    const storyboard = prompts.storyboard;
    expect(storyboard).toContain('storyboard artist for an Atari 2600 game video');
    expect(storyboard).toContain(
      "World brief (Game B1: Atari boss montage): the whole film is one Atari 2600 game about THIS film's subject",
    );
    expect(storyboard).toContain('list its nouns, places and actions');
    expect(storyboard).toContain('ONE boss card in the film, for the central problem');
    expect(storyboard).toContain('- `A` = the story (`atari-story`');
    expect(storyboard).toContain("- `B` = the console's screens (`atari-menu`");
    expect(storyboard).toContain('- `C` = the boss (`atari-boss`');
    for (const option of TRANSITIONS) expect(storyboard).toContain(`- \`${option.id}\` (wipe`);
    expect(storyboard).toContain(
      '- `game-b1-calendar-zoom` (wipe, about 1.2 s; the `zoom-through` link): calendar-zoom.',
    );
    expect(storyboard).toContain(
      '- `game-b1-cartridge-in` (wipe, about 0.8 s; the `carry-environment` link)',
    );
    expect(storyboard).toContain('- `game-b1-page-turn` (wipe, about 0.5 s): page-turn.');
    expect(storyboard).toContain('- `score-table` (breakthrough; look `atari-menu`): use when');
    expect(storyboard).toContain('- `manual` (breakthrough; look `atari-menu`): use when');
    for (const id of ['calendar-zoom', 'cartridge', 'level-select', 'boss-card', 'game-over']) {
      expect(storyboard).toContain(`- \`${id}\` (moment; look`);
    }
    expect(storyboard).toContain('Breakthroughs (`score-table`, `manual`)');
    expect(storyboard).toContain('needs at least 2 and at most 5, of at least 2 different kinds');
    expect(storyboard).toContain('"worldMoment": "score-table" }');
    expect(storyboard).toContain('Write the link as `"continuity"` AND name its transition');
    expect(storyboard).not.toMatch(/sketch|comic|rpg-/i);
  });

  it('give scene-build and scene-fix the craft brief and the toolkit', () => {
    const brief = text.craftBrief;
    expect(Buffer.byteLength(brief, 'utf8')).toBeLessThanOrEqual(1536);
    for (const part of [
      'write a comment: `// focal:',
      'inside the TV 2600 rules (wide pixels, 8-bit sprites with ONE ink per row',
      'big enough to read at 64 px wide',
      'every HUD element MEANS something: year = the story',
      'ONE boss in the film, for the central problem',
      'a sticky note with real words',
      "Don't: a big number alone on black",
      'centred symmetric HUD spam, icon rows',
      '> 6 competing elements',
      'only words of the narration or research notes',
      'no `$` or `=`',
      'slick polished art: keep the sprites simple, slightly crude',
    ]) {
      expect(brief).toContain(part);
    }
    const build = prompts['scene-build'];
    expect(build).toContain(`${brief}\n`);
    expect(build).toContain('Page moment planned for this shot (`score-table`;');
    expect(build).toContain(`\`${GAME_B1_SNIPPETS.scoreTable}\``);
    expect(build).toContain('Every table is original');
    expect(build).toContain('a REAL number or year of the narration or research notes');
    expect(build).toContain('Never the same entrance and initials twice in one film');
    expect(build).toContain(`\`${GAME_B1_SNIPPETS.screen}\``);
    expect(build).toContain(`\`${GAME_B1_SNIPPETS.camera}\``);
    expect(build).toContain(`\`${GAME_B1_SNIPPETS.defineSprite}\``);
    expect(build).toContain(`\`${GAME_B1_SNIPPETS.interior}\``);
    expect(build).toContain("`'#'` = a lit bit and `'.'` = empty (nothing else draws)");
    expect(build).toContain('Design first, in a comment under the focal line (`// nouns: …`)');
    expect(build).toContain('screen.assets(ctx.worldAssets)');
    expect(build).toContain('never end your reply with a `MISSING:` line');
    expect(build).not.toContain('MISSING: <prop names>');
    const fix = prompts['scene-fix'];
    expect(fix).toContain('this shot is in look `atari-menu`');
    expect(fix).toContain('Keep the planned page moment (`manual`) in the shot: `screen.manual(');
    expect(fix).toContain('ONE red `correction: { step, strike, write, at }`');
  });

  it('ask the critic for the game checklist and the planned boss card', () => {
    const critic = prompts.critic;
    expect(critic).toContain('QA reviewer for Atari 2600 game video frames');
    expect(critic).toContain(
      'Craft check (Game B1: Atari boss montage): one focal thing, off-centre',
    );
    expect(critic).toContain(
      'Planned page moment (`boss-card`): a boss card naming the central problem',
    );
    expect(critic).toContain("the CRT, the scanlines and the room's wallpaper or floor never do");
    expect(critic).toContain('never a number alone on black');
  });

  it('give the script game surprises', () => {
    expect(scriptWorldVars(GAME)['worldSurprise']).toContain('the console drops into attract mode');
  });

  it('names no link on a transition without one (the other worlds render as before)', () => {
    const plain = { id: 'game-b2-melt', type: 'wipe', duration: 0.7, description: 'melt' };
    expect(worldTransitionLine(plain)).toBe('- `game-b2-melt` (wipe, about 0.7 s): melt.');
  });
});

const LOOK = { A: 'atari-story', B: 'atari-menu', C: 'atari-boss' } as const;
const TREATMENT: Record<'A' | 'B' | 'C', Treatment> = {
  A: 'character-scene',
  B: 'ui-mockup',
  C: 'kinetic-text',
};
type Plan = readonly [
  'A' | 'B' | 'C',
  (string | undefined)?,
  (string | undefined)?,
  (ContinuityKind | undefined)?,
];

function film(plans: readonly Plan[], lengthS = 6): StoryboardShot[] {
  return plans.map(([roll, moment, style, link], index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: index * lengthS,
      t1: (index + 1) * lengthS,
      treatment: TREATMENT[roll],
      intent: `shot ${id} with the lighthouse`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      transitionIn:
        style === undefined || index === 0
          ? { type: 'cut' }
          : { type: 'wipe', duration: 0.8, style: `game-b1-${style}` },
      ...(moment === undefined || moment === '-' ? {} : { worldMoment: moment }),
      ...(link === undefined ? {} : { continuity: { kind: link, object: 'lighthouse' } }),
    };
  });
}

/** 20 shots (120 s): a score table, a manual page, eight smaller moments, three links. */
const VARIED: readonly Plan[] = [
  ['A'],
  ['B', 'level-select'],
  ['A', 'calendar-zoom'],
  ['C', 'boss-card', 'room-shake'],
  ['B', 'score-table', 'attract-cycle'],
  ['A', 'cartridge', 'cartridge-in', 'carry-environment'],
  ['C', 'glass-note'],
  ['A', 'dialogue'],
  ['B'],
  ['A', 'tv-push'],
  ['C'],
  ['A'],
  ['B', 'manual', 'page-slide'],
  ['A', undefined, 'page-turn'],
  ['C', 'game-over'],
  ['A', undefined, 'calendar-zoom', 'zoom-through'],
  ['B'],
  ['A'],
  ['C'],
  ['A', undefined, undefined, 'shared-object'],
];
const OPTIONS = { moments: text.moments, transitions: TRANSITIONS };
const codes = (plans: readonly Plan[], continuityLinks = false): string[] =>
  checkWorldVariety(film(plans), { ...OPTIONS, continuityLinks }).map((entry) => entry.code);
const replaced = (index: number, plan: Plan): Plan[] =>
  VARIED.map((entry, at) => (at === index ? plan : entry));

describe('game-b1 variety', () => {
  it('passes a varied game film, links on or off', () => {
    expect(codes(VARIED)).toEqual([]);
    expect(codes(VARIED, true)).toEqual([]);
  });

  it.each([
    [
      'a score table in the story',
      replaced(4, ['A', 'score-table', 'attract-cycle']),
      ['moment-look'],
    ],
    ['a manual next to the score table', replaced(5, ['B', 'manual']), ['moment-spacing']],
    [
      'one breakthrough kind only',
      replaced(12, ['B', 'score-table', 'page-slide']),
      ['moment-variety'],
    ],
    ['a game-b2 moment', replaced(10, ['C', 'automap']), ['moment-unknown']],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(plans)).toEqual(expect.arrayContaining(expected));
  });

  it('asks for the continuity of a link transition only with links on', () => {
    const unlinked = replaced(5, ['A', 'cartridge', 'cartridge-in']);
    expect(codes(unlinked)).toEqual([]);
    const issues = checkWorldVariety(film(unlinked), { ...OPTIONS, continuityLinks: true });
    expect(issues.map((entry) => entry.code)).toEqual(['continuity-link']);
    expect(issues[0]?.message).toBe(
      's06: game-b1-cartridge-in is a carry-environment link: add "continuity": { "kind": "carry-environment", "object": "<the thing both shots show>" } and name the object in both intents, or use another transition',
    );
  });

  it('names the game cues in the quota repair message', () => {
    const plain = VARIED.map(([roll, moment, style, link]): Plan => [
      roll,
      moment === 'score-table' || moment === 'manual' ? '-' : moment,
      style,
      link,
    ]);
    const [quota] = checkWorldVariety(film(plain), OPTIONS);
    expect(quota?.code).toBe('moment-quota');
    expect(quota?.message).toContain(
      'plan them where the narration calls for them (facts or records ranked in the order they happened → score-table, how something works, step by step → manual)',
    );
  });
});
