/**
 * Scene autocommits with shots building in parallel (real test film 3): each "Scene sNN built"
 * commit holds ONLY that shot's scene file, even when the other shot's scene is already written
 * but not finished, so reverting one shot never touches the other. fake-claude + a scripted
 * renderer whose first renders wait until BOTH shots have written their scenes.
 */
import { LimitGuard } from '@reelforge/claude-bridge';
import { autocommit, revertTo } from '@reelforge/project';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from './runner.js';
import type { FrameRenderer, ShotRender, ShotRenderRequest } from './scenes/tools.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from './settings.js';
import { FakeClaudeHarness } from './testing/fake-claude.js';
import { CRITIC_OK, buildRule, filmShots, sceneSource, writeFilm } from './testing/film.js';
import { TestProjects, readProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

/** Holds every render until each of `shotIds` has asked for one (= all their scenes exist). */
class BarrierRenderer implements FrameRenderer {
  private readonly arrived = new Set<string>();
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly inner: FrameRenderer,
    private readonly shotIds: readonly string[],
  ) {}

  async renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender> {
    this.arrived.add(request.shotId);
    if (this.shotIds.every((id) => this.arrived.has(id))) {
      for (const release of this.waiting.splice(0)) release();
    } else {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    return this.inner.renderShot(request, signal);
  }
}

describe('scene autocommits with parallel shots', { timeout: 120_000 }, () => {
  it("commits each shot's own scene only; reverting one shot leaves the other alone", async () => {
    const shots = filmShots(2);
    const dir = await projects.create('parallel commits');
    writeFilm(dir, shots);
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );
    const guard = new LimitGuard({ maxConcurrency: 2 });
    const harness = new FakeClaudeHarness(
      {
        version: 1,
        rules: shots.map((shot) => buildRule(shot, sceneSource(shot))),
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      },
      { concurrency: 2, guard },
    );
    harnesses.push(harness);
    const renderer = new BarrierRenderer(
      new ScriptedFrameRenderer(),
      shots.map((shot) => shot.id),
    );
    const runner = new StageRunner({
      projectDir: dir,
      claude: harness.runner,
      guard: harness.guard,
      git: projects.git,
      scenes: { frames: renderer, onMissingProps: undefined },
      settings: {
        ...DEFAULT_STAGE_SETTINGS,
        scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 2 },
      },
    });
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok && result.value.message).toBe('2 shots: 2 ✓');

    const sceneCommits = (await projects.history(dir)).filter((entry) =>
      /^Scene s0\d built/.test(entry.subject),
    );
    expect(sceneCommits).toHaveLength(2);
    for (const entry of sceneCommits) {
      const id = /^Scene (s0\d)/.exec(entry.subject)?.[1];
      expect(entry.files.map((file) => file.path)).toEqual([`scenes/${String(id)}.js`]);
    }

    // Undo the later shot: back to the state right after the earlier shot's commit.
    const [later, earlier] = sceneCommits;
    if (later === undefined || earlier === undefined) throw new Error('two scene commits');
    const laterShot = shots.find((shot) => later.subject.startsWith(`Scene ${shot.id} `));
    const earlierShot = shots.find((shot) => earlier.subject.startsWith(`Scene ${shot.id} `));
    if (laterShot === undefined || earlierShot === undefined) throw new Error('unknown shots');
    const reverted = await revertTo(dir, earlier.hash, projects.git);
    expect(reverted.ok && reverted.value.status).toBe('reverted');
    const revertCommit = (await projects.history(dir))[0];
    expect(revertCommit?.files.map((file) => file.path)).toEqual([laterShot.scene]);
    expect(readProject(dir, earlierShot.scene)).toBe(sceneSource(earlierShot));
    expect(readProject(dir, laterShot.scene)).not.toBe(sceneSource(laterShot));
  });
});
