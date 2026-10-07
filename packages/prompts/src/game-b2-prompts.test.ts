/**
 * Game B2 wording in the prompts (PLAN.md#13.4 part c): a Game B2 project gets its own film, rolls,
 * game-native transitions, craft brief, level format, critic checklist and moment catalog (automap
 * and tally as breakthroughs, the throw, each with a required intent), no voxel text; the variety
 * validator runs on the game catalog with the generic rules. The legacy, Sketchbook and Comic
 * renderings stay as they were (world-prompts.test.ts, comic-prompts.test.ts).
 */
import type { StoryboardShot, Treatment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import { checkWorldVariety } from './validators/world-variety.js';
import {
  criticWorldVars,
  fixWorldVars,
  GAME_B2_SNIPPETS,
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

const text = worldPromptText('game-b2');
if (text === undefined) throw new Error('no game-b2 prompt text');
const GAME: PromptWorld = { label: 'Game B2: first-person RPG', text };
const TRANSITIONS: readonly WorldTransitionOption[] = [
  ['melt', 0.7],
  ['fog', 1.4],
  ['darkness', 1],
  ['door', 0.9],
  ['level-card', 1],
  ['map-unfold', 0.6],
  ['map-fold', 0.9],
].map(([name, duration]) => ({
  id: `game-b2-${String(name)}`,
  type: 'wipe',
  duration: Number(duration),
  description: String(name),
}));
const LOOKS = [
  '- `rpg-explore` (RPG explore): the walk. Rolls: A. Treatments: character-scene.',
  '- `rpg-menu` (RPG menu): the game screens. Rolls: B. Treatments: map.',
  '- `rpg-boss` (RPG boss): the pressure. Rolls: C. Treatments: kinetic-text.',
].join('\n');
const TAG = /\{\{[#^/]?\w+\}\}/;

const prompts = {
  storyboard: rendered('storyboard', {
    styleId: 'game-b2',
    looks: LOOKS,
    multiLook: true,
    maxTransitions: '4',
    interrupts: true,
    interruptRules: 'Plan 1–2 interrupts.',
    continuityLinks: true,
    continuityBudget: 2,
    ...storyboardWorldVars(GAME, 'rpg-explore', TRANSITIONS, { durationS: 150 }),
  }),
  'scene-build': rendered('scene-build', {
    shotId: 's04_route',
    shotScene: 'scenes/s04_route.js',
    shotJson: { id: 's04_route', t0: 24, t1: 32, treatment: 'map' },
    shotWords: [{ text: 'stores', t: 27.4, tEnd: 27.9 }],
    neighbours: [],
    styleId: 'game-b2',
    lookId: 'rpg-menu',
    lookDocs: "Look `rpg-menu` (world Game B2, B roll): the game's screens.",
    annotationPlan: '- "the stores" (place): pin "TOY STORE"',
    ...sceneWorldVars(GAME, 'automap'),
  }),
  'scene-fix': rendered('scene-fix', {
    scope: 'Shot',
    shotIds: 's08_tally',
    request: 'QA fix 1/2 for shot s08_tally.',
    critic: 'error critic: tally: the card holds 6 s after the stamp',
    ...fixWorldVars(GAME, 'rpg-menu', 'tally'),
  }),
  critic: rendered('critic', {
    styleId: 'game-b2',
    imagePaths: '.reelforge/qa/s09_pit/build-1.png',
    intent: 'The cartridge is thrown into the pit.',
    lookId: 'rpg-boss',
    roll: 'C',
    lookRules: 'RPG boss: the pressure moments.',
    ...criticWorldVars(GAME, 'throw'),
  }),
};

describe('game-b2 prompts', () => {
  it.each(Object.keys(prompts) as (keyof typeof prompts)[])(
    '%s has no voxel text and no open tags',
    async (id) => {
      expect(prompts[id]).not.toMatch(/voxel/i);
      expect(prompts[id]).not.toMatch(TAG);
      await expect(prompts[id]).toMatchFileSnapshot(`fixtures/game-b2-${id}.txt`);
    },
  );

  it('give the storyboard the world, its rolls, transitions, catalog and quota', () => {
    const storyboard = prompts.storyboard;
    expect(storyboard).toContain('storyboard artist for a first-person RPG video with a Doom vibe');
    expect(storyboard).toContain(
      'World brief (Game B2: first-person RPG): the whole film is one first-person game level',
    );
    expect(storyboard).toContain('- `A` = the walk (`rpg-explore`');
    expect(storyboard).toContain("- `B` = the game's screens (`rpg-menu`");
    expect(storyboard).toContain('- `C` = the pressure (`rpg-boss`');
    for (const option of TRANSITIONS) expect(storyboard).toContain(`- \`${option.id}\` (wipe`);
    expect(storyboard).toContain('- `automap` (breakthrough; look `rpg-menu`): use when');
    expect(storyboard).toContain('- `tally` (breakthrough; look `rpg-menu`): use when');
    for (const id of ['throw', 'quest-log', 'inventory-pick', 'dialogue', 'boss-card', 'stinger']) {
      expect(storyboard).toContain(`- \`${id}\` (moment; look`);
    }
    expect(storyboard).toContain('- `level-card` (moment; any look)');
    expect(storyboard).toContain('Breakthroughs (`automap`, `tally`)');
    expect(storyboard).toContain('needs at least 2 and at most 5, of at least 2 different kinds');
    expect(storyboard).toContain('"worldMoment": "automap" }');
    expect(storyboard).toContain('`game-b2-map-unfold`');
    expect(storyboard).not.toMatch(/sketch|comic/i);
  });

  it('give scene-build and scene-fix the craft brief, the level format and the toolkit', () => {
    const brief = text.craftBrief;
    expect(Buffer.byteLength(brief, 'utf8')).toBeLessThanOrEqual(1536);
    for (const part of [
      'write a comment: `// focal:',
      'every HUD element MEANS something: progress = film progress, a checkpoint flag = a chapter',
      'the boss bar only for the central problem',
      'written from the narration',
      'centred symmetric HUD spam, decorative HP or ammo with no real threat, icon rows',
      '> 6 competing elements, the same corridor twice in a film',
      'only words of the narration or research notes',
      'slick polished art: keep the sprites simple, slightly crude',
      'docs/worlds/game-hud-b2-rpg-v2/shots/',
    ]) {
      expect(brief).toContain(part);
    }
    const build = prompts['scene-build'];
    expect(build).toContain(`${brief}\n`);
    expect(build).toContain('Page moment planned for this shot (`automap`;');
    expect(build).toContain(`\`${GAME_B2_SNIPPETS.automap}\``);
    expect(build).toContain('Every automap is original');
    expect(build).toContain('Never the same opening and closing twice in one film');
    expect(build).toContain(`\`${GAME_B2_SNIPPETS.view}\``);
    expect(build).toContain(`const LEVEL = ${GAME_B2_SNIPPETS.level};`);
    expect(build).toContain('at most 32x32, the border all walls');
    expect(build).toContain('At most 12 `lights`');
    expect(build).toContain('and 40 `sprites`');
    expect(build).toContain("Write the level from the narration's places and objects");
    expect(build).toContain('`reelforge validate level <the scene file>`');
    expect(build).not.toContain('MISSING: <prop names>');
    const fix = prompts['scene-fix'];
    expect(fix).toContain('this shot is in look `rpg-menu`');
    expect(fix).toContain('Keep the planned page moment (`tally`) in the shot: `hud.tally(');
    expect(fix).toContain('it holds <= 4 s after its last number or stamp');
  });

  it('ask the critic for the game checklist and the planned throw', () => {
    const critic = prompts.critic;
    expect(critic).toContain('QA reviewer for first-person RPG game video frames');
    expect(critic).toContain(
      'Craft check (Game B2: first-person RPG): one focal thing, off-centre',
    );
    expect(critic).toContain('Planned page moment (`throw`): the held item leaving the hand');
    expect(critic).toContain('a note starting `throw:`');
    expect(critic).toContain('the HUD plates, the woodgrain, the dither and the head-bob');
  });

  it('give the script game surprises', () => {
    expect(scriptWorldVars(GAME)['worldSurprise']).toContain('a sudden game moment');
  });
});

const LOOK = { A: 'rpg-explore', B: 'rpg-menu', C: 'rpg-boss' } as const;
const TREATMENT: Record<'A' | 'B' | 'C', Treatment> = {
  A: 'character-scene',
  B: 'map',
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
          : { type: 'wipe', duration: 0.8, style: `game-b2-${style}` },
      ...(moment === undefined || moment === '-' ? {} : { worldMoment: moment }),
    };
  });
}

/** 20 shots (120 s): an automap, a tally, seven smaller moments, four game transitions. */
const VARIED: readonly Plan[] = [
  ['A'],
  ['B'],
  ['A', 'inventory-pick'],
  ['B', 'automap', 'map-unfold'],
  ['A', undefined, 'map-fold'],
  ['C', 'boss-card'],
  ['A', 'dialogue'],
  ['B', 'quest-log'],
  ['A', 'level-card', 'level-card'],
  ['C', 'stinger'],
  ['A'],
  ['B'],
  ['A'],
  ['B', 'tally', 'melt'],
  ['A'],
  ['C', 'throw'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
];
const OPTIONS = { moments: text.moments, transitions: TRANSITIONS };
const codes = (plans: readonly Plan[]): string[] =>
  checkWorldVariety(film(plans), OPTIONS).map((entry) => entry.code);
const replaced = (index: number, plan: Plan): Plan[] =>
  VARIED.map((entry, at) => (at === index ? plan : entry));

describe('game-b2 variety', () => {
  it('passes a varied game film', () => {
    expect(codes(VARIED)).toEqual([]);
  });

  it.each([
    ['an automap on a walk', replaced(3, ['A', 'automap', 'map-unfold']), ['moment-look']],
    ['a tally next to the automap', replaced(4, ['B', 'tally', 'map-fold']), ['moment-spacing']],
    ['one breakthrough kind only', replaced(13, ['B', 'automap', 'melt']), ['moment-variety']],
    [
      'a level card without its transition',
      replaced(8, ['A', 'level-card']),
      ['moment-transition'],
    ],
    ['a comic moment', replaced(10, ['A', 'flashback']), ['moment-unknown']],
  ])('flags %s', (_, plans, expected) => {
    expect(codes(plans)).toEqual(expect.arrayContaining(expected));
  });

  it('names the game cues in the quota repair message', () => {
    const plain = VARIED.map(([roll, moment, style]): Plan => [
      roll,
      moment === 'automap' || moment === 'tally' ? '-' : moment,
      style,
    ]);
    const [quota] = checkWorldVariety(film(plain), OPTIONS);
    expect(quota?.code).toBe('moment-quota');
    expect(quota?.message).toContain(
      'plan them where the narration calls for them (where the story has been and where it goes next → automap, a chapter summed up in numbers → tally)',
    );
  });
});
