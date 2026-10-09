/**
 * The line's "Tags and timestamps" step through the default executor on fake-claude: Claude's
 * answer written and committed, the fallback (and a ⚠) when Claude fails, is missing or hits the
 * usage limit, shorts skipped, a stop; and on the line: a limit hit in this step pauses the line
 * before the publish kit by the existing rules, which goes on after the resume.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fallbackPublishSeo } from '@reelforge/pipeline';
import {
  publishSeoFileSchema,
  storyboardFileSchema,
  wordsFileSchema,
  type QueueItem,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_DIR } from '../testing/example-film.js';
import { FakeClaudeHarness, writes, type Step } from '../testing/fake-claude.js';
import { LineHarness, ManualLimitSignal, lineState } from '../testing/queue.js';
import { SEO_PROGRESS, SEO_SHORT_SKIPPED } from './seo-step.js';
import { StageQueueExecutor } from './stage-executor.js';
import type { QueueStepContext } from './types.js';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const AT = NOW.toISOString();
const STRETCH = 10;
const read = (file: string): string => readFileSync(path.join(EXAMPLE_DIR, file), 'utf8');
/** The example film stretched to about 5 minutes (enough for 5–8 chapters). */
const SHOTS = storyboardFileSchema
  .parse(JSON.parse(read('storyboard.json')))
  .shots.map((shot) => ({ ...shot, t0: shot.t0 * STRETCH, t1: shot.t1 * STRETCH }));
const WORDS_FILE = wordsFileSchema.parse(JSON.parse(read(path.join('timing', 'words.json'))));
const WORDS = WORDS_FILE.words.map((word) => ({
  ...word,
  t: word.t * STRETCH,
  tEnd: word.tEnd * STRETCH,
}));
const GOOD = {
  ...fallbackPublishSeo({
    title: 'Doom on a calculator',
    script: read('script.txt'),
    channel: { genre: 'tech-explainer' },
    shots: SHOTS,
    durationS: SHOTS.at(-1)?.t1 ?? 0,
    words: WORDS,
  }),
  title: 'How Doom Runs on a Graphing Calculator',
};

let dir: string;
let harness: FakeClaudeHarness | undefined;
let commits: { message: string; paths: readonly string[] }[];
let progress: string[];

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'rf line seo żółw '));
  mkdirSync(path.join(dir, 'timing'));
  for (const file of ['project.json', 'script.txt']) {
    copyFileSync(path.join(EXAMPLE_DIR, file), path.join(dir, file));
  }
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 1, shots: SHOTS }));
  writeFileSync(
    path.join(dir, 'timing', 'words.json'),
    JSON.stringify({ ...WORDS_FILE, words: WORDS }),
  );
  commits = [];
  progress = [];
});

afterEach(async () => {
  await harness?.dispose();
  harness = undefined;
  rmSync(dir, { recursive: true, force: true });
});

function executor(steps: readonly Step[] | null): StageQueueExecutor {
  harness = steps === null ? undefined : new FakeClaudeHarness(steps);
  return new StageQueueExecutor({
    runnerFor: () => {
      throw new Error('the tags and timestamps step runs no stage');
    },
    claude: harness?.runner,
    publishSeo: {
      model: () => 'sonnet',
      channel: (_dir, channelId) => Promise.resolve({ name: channelId, tags: ['retro games'] }),
      commit: (_dir, message, paths) => {
        commits.push({ message, paths });
        return Promise.resolve(true);
      },
    },
    now: () => NOW,
  });
}

function ctx(signal = new AbortController().signal): QueueStepContext {
  const item: QueueItem = {
    id: 'a1',
    topic: 'Doom on a calculator',
    language: 'en',
    status: 'exporting',
    projectPath: dir,
    stageProgress: {},
    warnings: [],
    createdAt: AT,
    updatedAt: AT,
    history: [],
  };
  return {
    channelId: 'voxplain',
    item,
    projectDir: dir,
    autoApproveScript: false,
    targetMinutes: 5,
    signal,
    stageEvent: () => undefined,
    progress: (label) => progress.push(label),
  };
}

function seoFile() {
  return publishSeoFileSchema.parse(
    JSON.parse(readFileSync(path.join(dir, 'publish', 'seo.json'), 'utf8')),
  );
}

describe('line step: tags and timestamps', () => {
  it("writes Claude's tags and chapters and commits publish/seo.json", async () => {
    const outcome = await executor([writes({}, JSON.stringify(GOOD))]).run('seo', ctx());
    const file = seoFile();
    expect(outcome).toEqual({
      kind: 'done',
      message: `Tags and timestamps written (15 tags, ${String(file.chapters.length)} chapters)`,
      warnings: [],
    });
    expect(file).toMatchObject({ source: 'claude', model: 'sonnet', title: GOOD.title });
    expect(commits).toEqual([
      { message: 'Write the tags and timestamps', paths: ['publish/seo.json'] },
    ]);
    expect(progress).toEqual([SEO_PROGRESS]);
    expect(harness?.specs[0]).toMatchObject({ stage: 'critic', model: 'sonnet' });
    expect(harness?.specs[0]?.prompt).toContain('- name: voxplain');
  });

  it('writes the fallback with a ⚠ when Claude fails or is not connected', async () => {
    const failed = await executor(['crash']).run('seo', ctx());
    if (failed.kind !== 'done') throw new Error(`not done: ${failed.kind}`);
    expect(failed.message).toMatch(/^Tags and timestamps written without Claude \(15 tags/);
    expect(failed.warnings).toHaveLength(1);
    expect(failed.warnings?.[0]).toMatch(/^Tags and timestamps made without Claude \(Claude: /);
    expect(seoFile().source).toBe('fallback');
    const none = await executor(null).run('seo', ctx());
    expect(none.kind === 'done' && none.warnings).toEqual([
      'Tags and timestamps made without Claude (Claude is not available.). Regenerate them in the export dialog (YouTube texts).',
    ]);
    expect(commits).toHaveLength(2);
  });

  it('never blocks the film on a usage limit: fallback now, the guard pauses the line', async () => {
    const outcome = await executor(['rate-limit']).run('seo', ctx());
    expect(outcome.kind).toBe('done');
    expect(seoFile().source).toBe('fallback');
    expect(harness?.specs).toHaveLength(1);
    expect(harness?.guard.pause).toBeDefined();
  });

  it('skips shorts (no tags or timestamps) without a turn or a file', async () => {
    const project = JSON.parse(read('project.json')) as Record<string, unknown>;
    writeFileSync(
      path.join(dir, 'project.json'),
      JSON.stringify({
        ...project,
        kind: 'short',
        short: { lengthS: 30, captions: false, endCardText: 'Full video on YT: Voxplain' },
      }),
    );
    const outcome = await executor([writes({}, JSON.stringify(GOOD))]).run('seo', ctx());
    expect(outcome).toEqual({ kind: 'skipped', message: SEO_SHORT_SKIPPED });
    expect(harness?.specs).toHaveLength(0);
    expect(existsSync(path.join(dir, 'publish', 'seo.json'))).toBe(false);
    expect(commits).toEqual([]);
  });

  it('a stopped line leaves the step to run again', async () => {
    const stop = new AbortController();
    stop.abort();
    expect(await executor(null).run('seo', ctx(stop.signal))).toEqual({ kind: 'cancelled' });
    expect(existsSync(path.join(dir, 'publish', 'seo.json'))).toBe(false);
  });

  it('a limit hit during the step pauses the line before the publish kit, then it goes on', async () => {
    const line = new LineHarness();
    try {
      await line.store.setOptions('voxplain', { autoApproveScript: true });
      const [id = ''] = await line.add('voxplain', 'Limit at the tags');
      const limits = new ManualLimitSignal();
      line.executor.behaviour = (step) => {
        if (step !== 'seo') return undefined;
        limits.set({ until: line.clock.now() + 60_000, message: 'limit (guard)' });
        return { kind: 'done', message: 'without Claude', warnings: ['made without Claude'] };
      };
      const runner = line.runner({ lock: false, limits });
      const paused = lineState(runner, 'limit');
      const run = runner.start();
      await paused;
      await vi.waitFor(async () => {
        expect((await line.item('voxplain', id)).stageProgress.seo?.state).toBe('done');
      });
      expect((await line.item('voxplain', id)).stageProgress.publish).toBeUndefined();
      expect(line.executor.stepsOf(id)).not.toContain('publish');
      limits.set(undefined);
      expect(await run).toEqual({ ok: true, value: 'idle' });
      const done = await line.item('voxplain', id);
      expect(done.status).toBe('done');
      expect(done.warnings).toContain('made without Claude');
      expect(line.executor.stepsOf(id).slice(-3)).toEqual(['export', 'seo', 'publish']);
    } finally {
      line.dispose();
    }
  });
});
