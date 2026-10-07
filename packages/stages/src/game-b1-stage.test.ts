/**
 * A Game B1 film on fake-claude (PLAN.md#13.5 part c) with experimental worlds on: a project
 * created in the world's style (continuity links and anti-slop guards on), the storyboard turn
 * with the game prompt and validators (its looks, game-native transitions, continuity links drawn
 * by the world's own link transitions), the scene builds with the game craft brief and the critic
 * check, no slop finding on clean game shots; then a long game storyboard without breakthroughs
 * gets the quota repair turn and passes once it plans a high-score table and a manual page. No
 * real Claude call.
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
const LOOK: Readonly<Record<Roll, string>> = { A: 'atari-story', B: 'atari-menu', C: 'atari-boss' };
const TREATMENT: Readonly<Record<Roll, string>> = {
  A: 'character-scene',
  B: 'ui-mockup',
  C: 'kinetic-text',
};

/** The game transitions' own lengths (the validator warns outside 0.75-1.5x). */
const DURATION: Readonly<Record<string, number>> = {
  'room-shake': 0.5,
  'page-turn': 0.5,
  'attract-cycle': 1,
  'cartridge-out': 0.9,
};

/** A shot plan: roll, then optional moment, game transition and continuity link. */
type Plan = readonly [Roll, (string | undefined)?, (string | undefined)?, (string | undefined)?];

const SHORT: readonly Plan[] = [
  ['A'],
  ['B'],
  ['C', undefined, 'room-shake'],
  ['A', undefined, undefined, 'zoom-through'],
  ['B', undefined, 'cartridge-out', 'carry-environment'],
  ['A', undefined, 'page-turn'],
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
      intent: `Shot ${id} plays what the narration names; the cartridge stays in the console.`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      ...(style === undefined || index === 0
        ? {}
        : {
            transitionIn: {
              type: 'wipe',
              duration: DURATION[style] ?? 0.8,
              style: `game-b1-${style}`,
            },
          }),
      ...(moment === undefined ? {} : { worldMoment: moment }),
      ...(link === undefined ? {} : { continuity: { kind: link, object: 'cartridge' } }),
    };
  });
  return JSON.stringify({ version: 1, shots }, null, 2);
}

/** A clean game shot: a cartridge in the TV, the phrase in the narration box, three traces. */
function tvScene(shot: FilmShot): string {
  return `// focal: the lit cartridge | traces: a decaying shake, Dad's note on the glass, its tick
export const meta = { id: '${shot.id}', title: '${shot.phrase}', treatment: '${shot.treatment}' };

export function build(ctx) {
  const { kit, scene, anchor, sfx } = ctx;
  const screen = kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    anchor,
    seed: ${String(shot.index + 11)},
  });
  const hit = anchor('${shot.phrase}');
  screen.tv((g, t) => {
    const sh = g.util.shake(t, hit.t, 3, 8, ${String(shot.index + 5)});
    g.offset(sh.x * 2, sh.y * 2);
    g.bands(0, 160, [[0, 'void'], [14, 'tube'], [66, 'dusk'], [80, 'teak']]);
    g.cart(112, 111, 'orange', { scale: 2, body: 'grey', flicker: false });
    g.offset(0, 0);
  });
  screen.narrate('${shot.phrase}', { at: hit.t });
  screen.note(['${shot.phrase.toUpperCase()}'], { at: hit.t, x: 470, y: 120, tick: hit.t + 0.4 });
  scene.add(screen);
  sfx.at(hit.t, 'hit');
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
`;
}

const CRAFT_OK = JSON.stringify({
  frames: [
    {
      path: 'sheet.png',
      verdict: 'ok',
      note: "focal: the lit cartridge; traces: a decaying shake, Dad's note, its tick",
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

describe('a game-b1 film on fake-claude', { timeout: 180_000 }, () => {
  it('passes the storyboard and scene validators with the game wiring', async () => {
    const dir = await projects.create('atari film', [], { style: 'game-b1' });
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    expect(project).toMatchObject({
      style: 'game-b1',
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
        ...shots.map((shot) => buildRule(shot, tvScene(shot))),
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const stages = runner(dir, harness);

    const storyboarded = await stages.run({ stage: 'storyboard' });
    if (!storyboarded.ok) throw new Error(JSON.stringify(storyboarded.error));
    expect(storyboarded.value.warnings.join('\n')).not.toMatch(/transition-(style|duration)/);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('storyboard artist for an Atari-era boss-fight montage video');
    expect(prompt).toContain('- `atari-menu` (Atari menu)');
    expect(prompt).toContain(
      '- `game-b1-calendar-zoom` (wipe, about 1.2 s; the `zoom-through` link)',
    );
    expect(prompt).not.toMatch(/voxel|sketch|comic|rpg-/i);
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const styles = written.shots.map((shot) =>
      shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style,
    );
    expect(styles).toEqual([
      undefined,
      undefined,
      'game-b1-room-shake',
      'game-b1-calendar-zoom',
      'game-b1-cartridge-out',
      'game-b1-page-turn',
    ]);
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );

    const scenes = await stages.run({ stage: 'scenes' });
    expect(scenes.ok).toBe(true);
    const builds = harness.specs.filter((spec) => spec.stage === 'scene-build');
    expect(builds).toHaveLength(shots.length);
    for (const build of builds) {
      expect(build.prompt).toContain('Craft brief (Game B1; binding');
      expect(build.prompt).toContain('never end your reply with a `MISSING:` line');
      expect(build.prompt).not.toMatch(/voxel/i);
    }
    expect(builds[2]?.prompt).toContain('This shot hands over to s04 through a zoom-through link');
    const critics = harness.specs.filter((spec) => spec.stage === 'critic');
    expect(critics[0]?.prompt).toContain('Craft check (Game B1: Atari boss montage)');
    expect(harness.specs.filter((spec) => spec.stage === 'scene-fix')).toHaveLength(0);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.map((entry) => [entry.status, entry.findings])).toEqual(
      shots.map(() => ['ok', []]),
    );
  });

  it('repairs a game storyboard without breakthroughs into a score table and a manual', async () => {
    const plans: readonly Plan[] = [
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
      ['A', undefined, undefined, 'zoom-through'],
      ['B'],
      ['A'],
      ['C'],
      ['A'],
    ];
    const plain = plans.map(([roll, moment, style, link]): Plan => [
      roll,
      moment === 'score-table' || moment === 'manual' ? undefined : moment,
      style,
      link,
    ]);
    const dir = await projects.create('atari variety', [], { style: 'game-b1' });
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
    expect(first?.prompt).toContain('- `score-table` (breakthrough; look `atari-menu`)');
    expect(first?.prompt).toContain('needs at least 1 and at most 4; never in adjacent shots');
    expect(repair?.prompt).toContain('moment-quota');
    expect(repair?.prompt).toContain('how something works, step by step → manual');
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    expect(written.shots.flatMap((shot) => shot.worldMoment ?? [])).toEqual([
      'level-select',
      'calendar-zoom',
      'boss-card',
      'score-table',
      'cartridge',
      'glass-note',
      'dialogue',
      'tv-push',
      'manual',
      'game-over',
    ]);
    const linked = written.shots.flatMap((shot) =>
      shot.continuity === undefined || shot.transitionIn?.type === 'cut'
        ? []
        : [shot.transitionIn?.style],
    );
    expect(linked).toEqual(['game-b1-cartridge-in', 'game-b1-calendar-zoom']);
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
