/**
 * A Game B2 film on fake-claude (PLAN.md#13.4 part c) with experimental worlds on: a project
 * created in the world's style (continuity links and anti-slop guards on), the storyboard turn
 * with the game prompt and validators (its looks, game-native transitions, a continuity link),
 * the scene builds with the game craft brief, the level format and the critic check, no slop
 * finding on clean game shots (built in the open vocabulary: the shot's own textures and person);
 * then a long game storyboard without breakthroughs gets the quota repair turn and passes once it
 * plans an automap and a tally. No real Claude call.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WordsFile } from '@reelforge/pipeline';
import { autocommit } from '@reelforge/project';
import { scenesReportSchema, storyboardFileSchema, type Roll } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS, type StageSettings } from './settings.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { buildRule, filmShots, filmWords, writeFilm, type FilmShot } from './testing/film.js';
import { readProject, TestProjects } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const SETTINGS: StageSettings = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
const LOOK: Readonly<Record<Roll, string>> = { A: 'rpg-explore', B: 'rpg-menu', C: 'rpg-boss' };
const TREATMENT: Readonly<Record<Roll, string>> = {
  A: 'character-scene',
  B: 'map',
  C: 'kinetic-text',
};

/** A shot plan: roll, then optional moment, game transition and continuity link. */
type Plan = readonly [Roll, (string | undefined)?, (string | undefined)?, (string | undefined)?];

const SHORT: readonly Plan[] = [
  ['A'],
  ['B'],
  ['C', undefined, 'melt'],
  ['A', undefined, 'door'],
  ['B', undefined, undefined, 'shared-object'],
  ['A'],
];

/** A storyboard of `plans`; `t0`/`t1` of shot i from `edges(i)`. */
function storyboard(plans: readonly Plan[], edges: (index: number) => [number, number]): string {
  const shots = plans.map(([roll, moment, style, link], index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const [t0, t1] = edges(index);
    return {
      id,
      t0,
      t1,
      treatment: TREATMENT[roll],
      intent: `Shot ${id} walks to what the narration names; the lantern stays in the hand.`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      ...(style === undefined || index === 0
        ? {}
        : { transitionIn: { type: 'wipe', duration: 0.8, style: `game-b2-${style}` } }),
      ...(moment === undefined ? {} : { worldMoment: moment }),
      ...(link === undefined ? {} : { continuity: { kind: link, object: 'lantern' } }),
    };
  });
  return JSON.stringify({ version: 1, shots }, null, 2);
}

/**
 * A clean game shot in the open vocabulary: the shot's own textures and person, a walk to the lamp,
 * the phrase in the narration box, three traces (the stuttering bulb, a worn wall, a shake).
 */
function walkScene(shot: FilmShot): string {
  return `// focal: the keeper under the lamp | traces: the stuttering bulb, a worn wall, a shake
export const meta = { id: '${shot.id}', title: '${shot.phrase}', treatment: '${shot.treatment}' };

const ASSETS = {
  textures: { flagstone: { gen: 'texture', kind: 'stone', seed: 2, wear: 0.5 } },
  sprites: { keeper: { gen: 'person', seed: 3, hat: 'cap', tool: 'lantern' } },
};
const LEVEL = {
  name: 'hall', mood: 'tungsten', floor: 'flagstone',
  grid: ['#######', '#.....#', '#.....#', '#######'],
  legend: { '#': { wall: 'flagstone' } },
  lights: [{ id: 'lamp', pos: [3.5, 1.5], flicker: 'bulb', bulb: true }],
  sprites: [{ id: 'keeper', sprite: 'keeper', pos: [5.2, 1.6] }],
};

export function build(ctx) {
  const { kit, scene, anchor, sfx } = ctx;
  const size = [ctx.shot.width, ctx.shot.height];
  const view = kit.fx.b2View({
    size,
    level: LEVEL,
    assets: ASSETS,
    duration: ctx.shot.duration,
    anchor,
    seed: ${String(shot.index + 11)},
    path: [{ at: 0, x: 1.5, y: 2.5, yaw: 2, ease: 'lin' }, { at: 1.2, x: 3.2, y: 2.4, yaw: -6, ease: 'out' }],
  });
  scene.add(view);
  const hud = kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, anchor });
  const hit = anchor('${shot.phrase}');
  hud.narrate('${shot.phrase}', { at: hit.t });
  view.shake({ at: hit.t, amp: 1.2 });
  scene.add(hud);
  sfx.at(hit.t, 'hit');
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
`;
}

const CRAFT_OK = JSON.stringify({
  frames: [
    {
      path: 'sheet.png',
      verdict: 'ok',
      note: 'focal: the keeper under the lamp; traces: the stuttering bulb, a worn wall, a shake',
    },
  ],
});

function runner(dir: string, harness: FakeClaudeHarness): StageRunner {
  return new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings: SETTINGS,
    scenes: { frames: new ScriptedFrameRenderer() },
  });
}

describe('a game-b2 film on fake-claude', { timeout: 180_000 }, () => {
  it('passes the storyboard and scene validators with the game wiring', async () => {
    const dir = await projects.create('game film', [], { style: 'game-b2' });
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    expect(project).toMatchObject({
      style: 'game-b2',
      continuityLinks: true,
      antiSlopGuards: true,
    });
    const shots = filmShots(SHORT.length);
    writeFilm(dir, shots);
    writeFileSync(path.join(dir, 'script.txt'), shots.map((shot) => shot.phrase).join('. '));
    const edges = (index: number): [number, number] => {
      const shot = shots[index];
      const t0 = shot === undefined || index === 0 ? 0 : shot.t0 + 0.2;
      return [t0, index + 1 < shots.length ? (shot?.t1 ?? 0) + 0.2 : (shot?.t1 ?? 0)];
    };
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({ 'storyboard.json': storyboard(SHORT, edges) }),
          promptIncludes: 'storyboard artist',
        },
        ...shots.map((shot) => buildRule(shot, walkScene(shot))),
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const stages = runner(dir, harness);

    const storyboarded = await stages.run({ stage: 'storyboard' });
    if (!storyboarded.ok) throw new Error(JSON.stringify(storyboarded.error));
    expect(storyboarded.value.warnings.join('\n')).not.toMatch(/transition-(style|duration)/);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('storyboard artist for a first-person RPG video with a Doom vibe');
    expect(prompt).toContain('- `rpg-menu` (RPG menu)');
    expect(prompt).toContain('- `game-b2-map-unfold` (wipe');
    expect(prompt).not.toMatch(/voxel|sketch|comic/i);
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const styles = written.shots.map((shot) =>
      shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style,
    );
    expect(styles).toEqual([
      undefined,
      undefined,
      'game-b2-melt',
      'game-b2-door',
      'continuity-shared-object',
      undefined,
    ]);
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );

    const scenes = await stages.run({ stage: 'scenes' });
    expect(scenes.ok).toBe(true);
    // The world-assets turn (PLAN.md#13.15) runs on the scene builder's permissions too.
    const builds = harness.specs.filter(
      (spec) =>
        spec.stage === 'scene-build' && !spec.prompt.startsWith('You are the production designer'),
    );
    expect(builds).toHaveLength(shots.length);
    for (const build of builds) {
      expect(build.prompt).toContain('Craft brief (Game B2; binding');
      expect(build.prompt).toContain('`reelforge validate level <the scene file>`');
      expect(build.prompt).not.toMatch(/voxel/i);
    }
    const critics = harness.specs.filter((spec) => spec.stage === 'critic');
    expect(critics[0]?.prompt).toContain('Craft check (Game B2: first-person RPG)');
    expect(harness.specs.filter((spec) => spec.stage === 'scene-fix')).toHaveLength(0);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.map((entry) => [entry.status, entry.findings])).toEqual(
      shots.map(() => ['ok', []]),
    );
  });

  it('repairs a game storyboard without breakthroughs into an automap and a tally', async () => {
    const plans: readonly Plan[] = [
      ['A'],
      ['B'],
      ['A', 'inventory-pick', undefined, 'zoom-through'],
      ['B', 'automap', 'map-unfold'],
      ['A', undefined, 'map-fold'],
      ['C', 'boss-card'],
      ['A', 'dialogue'],
      ['B', 'quest-log'],
      ['A', 'level-card', 'level-card'],
      ['C', 'stinger'],
      ['A', undefined, undefined, 'shared-object'],
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
    const plain = plans.map(([roll, moment, style, link]): Plan => [
      roll,
      moment === 'automap' || moment === 'tally' ? undefined : moment,
      style,
      link,
    ]);
    const dir = await projects.create('game variety', [], { style: 'game-b2' });
    const words = sixSecondWords(plans.length);
    mkdirSync(path.join(dir, 'timing'), { recursive: true });
    writeFileSync(path.join(dir, 'timing', 'words.json'), JSON.stringify(words, null, 2));
    writeFileSync(path.join(dir, 'script.txt'), words.words.map((word) => word.text).join(' '));
    const last = (words.words.at(-1)?.tEnd ?? 0) + 0.3;
    const edges = (index: number): [number, number] => [
      index === 0 ? 0 : index * 6 + 0.2,
      index + 1 < plans.length ? (index + 1) * 6 + 0.2 : last,
    ];
    const harness = new FakeClaudeHarness([
      writes({ 'storyboard.json': storyboard(plain, edges) }),
      writes({ 'storyboard.json': storyboard(plans, edges) }),
    ]);
    harnesses.push(harness);
    const result = await runner(dir, harness).run({ stage: 'storyboard' });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.metrics['repairs']).toBe(1);
    const [first, repair] = harness.specs.filter((spec) => spec.stage === 'storyboard');
    expect(first?.prompt).toContain('- `automap` (breakthrough; look `rpg-menu`)');
    expect(first?.prompt).toContain('needs at least 1 and at most 4; never in adjacent shots');
    expect(repair?.prompt).toContain('moment-quota');
    expect(repair?.prompt).toContain('where the story has been and where it goes next → automap');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.flatMap((shot) => shot.worldMoment ?? [])).toEqual([
      'inventory-pick',
      'automap',
      'boss-card',
      'dialogue',
      'quest-log',
      'level-card',
      'stinger',
      'tally',
      'throw',
    ]);
  });
});

/** Ten words per 6 s shot (the filmWords format over a longer film). */
function sixSecondWords(count: number): WordsFile {
  const base = filmWords(filmShots(1));
  const words = Array.from({ length: count * 10 }, (_, i) => {
    const t = Math.round((Math.floor(i / 10) * 6 + 0.2 + 0.45 * (i % 10)) * 1000) / 1000;
    return {
      i,
      text: `word${String(i)}`,
      paragraph: Math.floor(i / 10),
      t,
      tEnd: Math.round((t + 0.35) * 1000) / 1000,
      confidence: 0.95,
      status: 'exact' as const,
    };
  });
  const n = words.length;
  return {
    ...base,
    words,
    stats: { ...base.stats, scriptWords: n, asrWords: n, exact: n },
  };
}
