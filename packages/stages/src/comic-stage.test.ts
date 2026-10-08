/**
 * A Comic film on fake-claude (PLAN.md#13.3 part c) with experimental worlds on: a project created
 * in the world's style (continuity links and anti-slop guards on), the storyboard turn with the
 * comic prompt and validators (its looks, panel-native transitions, a continuity link), the scene
 * builds with the comic craft brief and critic check, no slop finding on clean comic pages; then a
 * long comic storyboard without breakthroughs gets the quota repair turn and passes once it plans
 * a flashback and a spread. No real Claude call.
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
const LOOK: Readonly<Record<Roll, string>> = {
  A: 'comic-story',
  B: 'comic-info',
  C: 'comic-loud',
};
const TREATMENT: Readonly<Record<Roll, string>> = {
  A: 'character-scene',
  B: 'node-graph/timeline',
  C: 'kinetic-text',
};

/** A shot plan: roll, then optional moment, panel transition and continuity link. */
type Plan = readonly [Roll, (string | undefined)?, (string | undefined)?, (string | undefined)?];

const SHORT: readonly Plan[] = [
  ['A'],
  ['B'],
  ['C', undefined, 'panel-slam'],
  ['A', undefined, 'gutter-wipe'],
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
      intent: `Shot ${id} letters what the narration names; the radio panel holds its place.`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      ...(style === undefined || index === 0
        ? {}
        : { transitionIn: { type: 'wipe', duration: 0.8, style: `comic-${style}` } }),
      ...(moment === undefined ? {} : { worldMoment: moment }),
      ...(link === undefined ? {} : { continuity: { kind: link, object: 'radio panel' } }),
    };
  });
  return JSON.stringify({ version: 1, shots }, null, 2);
}

/** A clean comic page from the open vocabulary: beats, a figure, the phrase lettered, three traces. */
function pageScene(shot: FilmShot): string {
  return `// focal: the figure on the big panel | nouns: ${shot.phrase} | traces: thumbprint, smudge, pencil note
export const meta = { id: '${shot.id}', title: '${shot.phrase}', treatment: '${shot.treatment}' };

export function build(ctx) {
  const { kit, scene, anchor, sfx } = ctx;
  const page = kit.fx.comicPage({ seed: ${String(shot.index + 11)}, anchor, duration: ctx.shot.duration });
  scene.add(page);
  const hit = anchor('${shot.phrase}');
  const [big, small] = page.layout([
    { at: 0, weight: 2, backdrop: 'meadow' },
    { at: hit.t, weight: 1, backdrop: 'village' },
  ]);
  big.draw((g) => page.art.person(g, { x: 160, y: 320, size: 150, pose: 'point' }));
  small.draw((g) => page.art.animal(g, { x: 500, y: 300, size: 90, species: 'dog' }));
  page.caption('${shot.phrase}', { x: 24, y: 20, at: hit.t });
  page.thumbprint(610, 340);
  page.smudge(300, 210, { length: 8 });
  page.note('${shot.phrase}', { x: 470, y: 330, at: hit.t + 0.3 });
  sfx.at(hit.t, 'hit');
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
`;
}

const CRAFT_OK = JSON.stringify({
  frames: [
    {
      path: 'sheet.png',
      verdict: 'ok',
      note: 'focal: the caption; traces: thumbprint, smudge, pencil note',
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

describe('a comic film on fake-claude', { timeout: 180_000 }, () => {
  it('passes the storyboard and scene validators with the comic wiring', async () => {
    const dir = await projects.create('comic film', [], { style: 'comic' });
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    expect(project).toMatchObject({ style: 'comic', continuityLinks: true, antiSlopGuards: true });
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
        ...shots.map((shot) => buildRule(shot, pageScene(shot))),
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const stages = runner(dir, harness);

    const storyboarded = await stages.run({ stage: 'storyboard' });
    if (!storyboarded.ok) throw new Error(JSON.stringify(storyboarded.error));
    expect(storyboarded.value.warnings.join('\n')).not.toMatch(/transition-(style|duration)/);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('storyboard artist for a printed comic-book video');
    expect(prompt).toContain('- `comic-info` (Comic info)');
    expect(prompt).toContain('- `comic-panel-zoom` (wipe');
    expect(prompt).toContain('The world is a style, not a catalogue');
    // (The shared asset-research example of storyboard.md names a launch photo: not world text.)
    expect(prompt).not.toMatch(/voxel|sketch|eagle|1202|moon/i);
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const styles = written.shots.map((shot) =>
      shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style,
    );
    expect(styles).toEqual([
      undefined,
      undefined,
      'comic-panel-slam',
      'comic-gutter-wipe',
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
      expect(build.prompt).toContain('Craft brief (Comic; binding');
      expect(build.prompt).toContain('(i) list the nouns, places and actions');
      expect(build.prompt).toContain('page.art.load(ctx.worldAssets)');
      expect(build.prompt).not.toMatch(/voxel/i);
      // The world's own wording (from the craft brief on; the kit's look docs come before it).
      const world = build.prompt.slice(build.prompt.indexOf('Craft brief (Comic'));
      expect(world).not.toMatch(/apollo|eagle|1202|moon/i);
    }
    const critics = harness.specs.filter((spec) => spec.stage === 'critic');
    expect(critics[0]?.prompt).toContain('Craft check (Comic)');
    expect(harness.specs.filter((spec) => spec.stage === 'scene-fix')).toHaveLength(0);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.map((entry) => [entry.status, entry.findings])).toEqual(
      shots.map(() => ['ok', []]),
    );
  });

  it('repairs a comic storyboard without breakthroughs into a flashback and a spread', async () => {
    const plans: readonly Plan[] = [
      ['A'],
      ['B'],
      ['A', 'squeeze', undefined, 'zoom-through'],
      ['B', 'flashback', 'page-back'],
      ['A'],
      ['C', 'pause-panel'],
      ['A', 'impact-break', 'panel-slam'],
      ['B', 'cutaway'],
      ['A'],
      ['C'],
      ['A', undefined, undefined, 'shared-object'],
      ['B', 'checklist'],
      ['A'],
      ['C', 'spread', 'page-turn'],
      ['A'],
      ['B'],
      // never 4 plain cuts in a row in a comic film (the comic pace's dry-run check)
      ['A', 'big-line', 'page-slide'],
      ['C'],
      ['A'],
      ['B'],
    ];
    const plain = plans.map(([roll, , style, link]): Plan => [roll, undefined, style, link]);
    const dir = await projects.create('comic variety', [], { style: 'comic' });
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
    expect(first?.prompt).toContain('- `flashback` (breakthrough; look `comic-info`)');
    expect(first?.prompt).toContain('needs at least 1 and at most 4; never in adjacent shots');
    expect(repair?.prompt).toContain('moment-quota');
    expect(repair?.prompt).toContain('a look back to where it came from → flashback');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.flatMap((shot) => shot.worldMoment ?? [])).toEqual([
      'squeeze',
      'flashback',
      'pause-panel',
      'impact-break',
      'cutaway',
      'checklist',
      'spread',
      'big-line',
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
