/**
 * A Sketchbook film on fake-claude (PLAN.md#13.6) with experimental worlds on: a project created
 * in the world's style (continuity links on by default), the storyboard turn with the world's
 * prompt and validators (its looks, page-native transitions, a continuity link), then the scene
 * builds with the world's craft brief, kit names and critic craft check. No real Claude call.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import { scenesReportSchema, storyboardFileSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import { DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { buildRule, filmShots, writeFilm, type FilmShot } from './testing/film.js';
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

const SETTINGS = { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true };
const LOOK = { A: 'sketch-story', B: 'sketch-graph', C: 'sketch-loud' } as const;
const PLAN = [
  { roll: 'A', treatment: 'title-card' },
  { roll: 'B', treatment: 'data-chart-3d' },
  { roll: 'C', treatment: 'kinetic-text', transitionIn: { type: 'wipe', duration: 0.6 } },
  {
    roll: 'A',
    treatment: 'metaphor-object',
    transitionIn: { type: 'wipe', duration: 0.8, style: 'sketchbook-riffle' },
  },
  {
    roll: 'B',
    treatment: 'counter/odometer',
    continuity: { kind: 'shared-object', object: 'calendar' },
  },
  { roll: 'A', treatment: 'character-scene' },
] as const;

/** A cut on the first word of the shot (the film's words start 0.2 s into each shot). */
const cutAt = (shot: FilmShot): number => (shot.index === 0 ? 0 : shot.t0 + 0.2);

/** The six-shot film as a Sketchbook storyboard (s04 and s05 share the taped calendar). */
function sketchbookStoryboard(shots: readonly FilmShot[]): string {
  return JSON.stringify(
    {
      version: 1,
      shots: shots.map((shot, index) => {
        const plan = PLAN[index] ?? PLAN[0];
        const calendar = index === 3 || index === 4 ? ' The taped calendar holds its place.' : '';
        return {
          id: shot.id,
          t0: cutAt(shot),
          t1: index + 1 < shots.length ? shot.t1 + 0.2 : shot.t1,
          treatment: plan.treatment,
          intent: `${shot.intent}${calendar}`,
          scene: shot.scene,
          roll: plan.roll,
          look: LOOK[plan.roll],
          ...('transitionIn' in plan ? { transitionIn: plan.transitionIn } : {}),
          ...('continuity' in plan ? { continuity: plan.continuity } : {}),
        };
      }),
    },
    null,
    2,
  );
}

/** A Sketchbook scene: one page, the focal point and traces named first, words on cue. */
function pageScene(shot: FilmShot): string {
  return `// focal: the number on the page | traces: crossed-out guess, two-stroke arrow, tape
export const meta = { id: '${shot.id}', title: '${shot.phrase}', treatment: '${shot.treatment}' };

export function build(ctx) {
  const { kit, scene, anchor, sfx } = ctx;
  const page = kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], stock: 'cartridge', page: ${String(shot.index + 1)}, anchor });
  scene.add(page);
  const hit = anchor('${shot.phrase}');
  page.write('${shot.phrase}', { x: 330, y: 210, size: 30, hand: 'scrawl', at: hit.t });
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
      note: 'focal: the number; traces: crossed-out guess, two-stroke arrow, tape',
    },
  ],
});

describe('a sketchbook film on fake-claude', { timeout: 180_000 }, () => {
  it('passes the storyboard and scene validators with the world wiring', async () => {
    const dir = await projects.create('sketchbook film', [], { style: 'sketchbook' });
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    expect(project).toMatchObject({ style: 'sketchbook', continuityLinks: true });
    const shots = filmShots(6);
    writeFilm(dir, shots);
    writeFileSync(path.join(dir, 'script.txt'), shots.map((shot) => shot.phrase).join('. '));
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({ 'storyboard.json': sketchbookStoryboard(shots) }),
          promptIncludes: 'storyboard artist',
        },
        ...shots.map((shot) => buildRule(shot, pageScene(shot))),
      ],
      default: { scenario: 'tools-write', reply: CRAFT_OK },
    });
    harnesses.push(harness);
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      settings: SETTINGS,
      scenes: { frames: new ScriptedFrameRenderer() },
    });

    const storyboard = await runner.run({ stage: 'storyboard' });
    if (!storyboard.ok) throw new Error(JSON.stringify(storyboard.error));
    expect(storyboard.value.warnings.join('\n')).not.toMatch(/transition-(style|duration)/);
    expect(harness.specs.filter((spec) => spec.stage === 'storyboard')).toHaveLength(1);
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('storyboard artist for a hand-drawn sketchbook video');
    expect(prompt).toContain('- `sketch-graph` (Sketch graph)');
    expect(prompt).toContain('- `sketchbook-page-flip` (wipe');
    expect(prompt).toContain('Continuity links (on for this project');
    expect(prompt).not.toMatch(/voxel/i);
    const written = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const transitions = written.shots.map((shot) =>
      shot.transitionIn?.type === 'cut' ? undefined : shot.transitionIn?.style,
    );
    expect(transitions[2]).toMatch(/^sketchbook-(?!riffle)/);
    expect(transitions[3]).toBe('sketchbook-riffle');
    expect(transitions[4]).toBe('continuity-shared-object');
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );

    const scenes = await runner.run({ stage: 'scenes' });
    expect(scenes.ok).toBe(true);
    const builds = harness.specs.filter((spec) => spec.stage === 'scene-build');
    expect(builds).toHaveLength(6);
    for (const build of builds) {
      expect(build.prompt).toContain('Craft brief (Sketchbook; binding');
      expect(build.prompt).not.toMatch(/voxel/i);
    }
    const critics = harness.specs.filter((spec) => spec.stage === 'critic');
    expect(critics.length).toBeGreaterThan(0);
    expect(critics[0]?.prompt).toContain('Craft check (Sketchbook)');
    expect(harness.specs.filter((spec) => spec.stage === 'scene-fix')).toHaveLength(0);
    const report = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(report.shots.map((entry) => [entry.status, entry.findings])).toEqual(
      shots.map(() => ['ok', []]),
    );
  });
});
