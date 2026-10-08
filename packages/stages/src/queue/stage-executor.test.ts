/**
 * The default executor on a real project (template + git, made by the queue's project factory)
 * with a StageRunner over fake stage definitions and a fake Claude runner: brief turn (+ repair,
 * limit, the user's own brief), script + "already done" skip, the approval gate (the app's
 * pipeline.json field), voice-over waiting / generated, asset and review steps, export/publish.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore, err, ok } from '@reelforge/claude-bridge';
import { briefFileSchema, type QueueItem } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import type { ClaudeRunner, ClaudeTurnResult, ClaudeTurnSpec } from '../claude.js';
import { writeProjectText } from '../files.js';
import { StageRunner } from '../runner.js';
import { BUILT_IN_STAGES, type StageRegistry } from '../stages/registry.js';
import { TestProjects } from '../testing/project.js';
import { stageError, type StageRequest, type StageSummary } from '../types.js';
import { createQueueProjectFactory, projectFolderName, topicSlug } from './project-factory.js';
import {
  StageQueueExecutor,
  stageOutcome,
  type StageQueueExecutorOptions,
} from './stage-executor.js';
import type { QueueStepContext, VoiceProvider } from './types.js';

const projects = new TestProjects();
afterAll(() => {
  projects.dispose();
});

const AT = '2026-10-07T20:00:00.000Z';
const BRIEF_REPLY = JSON.stringify({
  topic:
    'How a glass of water splits white light into a rainbow, and why the colours keep their order.',
  hook: 'A plain glass of water can paint a rainbow on your wall.',
  keyFacts: ['Confirm the refraction angles per colour', 'When did Newton publish on dispersion?'],
  tone: 'friendly, hands-on',
  audience: 'Curious kids and parents.',
});

function item(id: string, extra: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    topic: 'Rainbow in a glass — świetlny eksperyment',
    language: 'en',
    status: 'queued',
    stageProgress: {},
    warnings: [],
    createdAt: AT,
    updatedAt: AT,
    history: [],
    ...extra,
  };
}

class ScriptedClaude implements ClaudeRunner {
  readonly specs: ClaudeTurnSpec[] = [];
  constructor(private readonly replies: Partial<ClaudeTurnResult>[]) {}
  run(spec: ClaudeTurnSpec): Promise<ClaudeTurnResult> {
    this.specs.push(spec);
    const next = this.replies.shift() ?? {};
    return Promise.resolve({
      status: 'completed',
      reply: '',
      sessionId: 's',
      message: 'ok',
      usage: undefined,
      limit: undefined,
      ...next,
    });
  }
}

const summary = (message: string): StageSummary => ({
  message,
  outputs: [],
  changed: true,
  warnings: [],
  metrics: {},
});

function fakeStages(requests: StageRequest[]): StageRegistry {
  return {
    ...BUILT_IN_STAGES,
    script: {
      ...BUILT_IN_STAGES.script,
      run: async (ctx, request) => {
        requests.push(request);
        const written = await writeProjectText(ctx.projectDir, 'script.txt', 'Light bends.\n');
        return written.ok ? ok(summary('script written')) : written;
      },
    },
    voiceover: {
      ...BUILT_IN_STAGES.voiceover,
      run: (_ctx, request) => {
        requests.push(request);
        return Promise.resolve(ok({ ...summary('voice imported'), warnings: ['quiet start'] }));
      },
    },
  };
}

async function setup(
  name: string,
  queueItem: QueueItem,
  options: Partial<StageQueueExecutorOptions> = {},
) {
  const requests: StageRequest[] = [];
  const factory = createQueueProjectFactory({
    channel: (channelId) =>
      Promise.resolve(
        channelId === 'missing'
          ? err('there is no channel "missing"')
          : ok({ projectsDir: path.join(projects.root, name), defaultStyle: null }),
      ),
    create: { git: projects.git, seed: 7 },
  });
  const controller = new AbortController();
  const made = await factory.create({
    channelId: 'voxplain',
    item: queueItem,
    targetMinutes: 6,
    signal: controller.signal,
  });
  if (!made.ok) throw new Error(made.error);
  const projectDir = made.value.projectPath;
  const runners = new Map<string, StageRunner>();
  const executor = new StageQueueExecutor({
    runnerFor: (dir) => {
      const existing = runners.get(dir);
      if (existing !== undefined) return existing;
      const runner = new StageRunner({
        projectDir: dir,
        stages: fakeStages(requests),
        autocommit: false,
      });
      runners.set(dir, runner);
      return runner;
    },
    ...options,
  });
  const ctx = (autoApproveScript = false): QueueStepContext => ({
    channelId: 'voxplain',
    item: queueItem,
    projectDir,
    autoApproveScript,
    targetMinutes: 6,
    signal: controller.signal,
    stageEvent: () => undefined,
    progress: () => undefined,
  });
  return { executor, projectDir, requests, ctx, factory };
}

describe('queue project factory', () => {
  it('makes one stable folder per film with the channel and an initial brief', async () => {
    expect(topicSlug('Łódź: 10 faktów — ŚWIAT!')).toBe('lodz-10-faktow-swiat');
    expect(topicSlug('???')).toBe('film');
    const film = item('q1');
    const { projectDir, factory } = await setup('factory', film);
    expect(path.basename(projectDir)).toBe(projectFolderName(film));
    const project = JSON.parse(readFileSync(path.join(projectDir, 'project.json'), 'utf8')) as {
      channelId?: string;
      language: string;
    };
    expect(project).toMatchObject({ channelId: 'voxplain', language: 'en' });
    const brief = briefFileSchema.parse(
      JSON.parse(readFileSync(path.join(projectDir, 'brief.json'), 'utf8')),
    );
    expect(brief).toMatchObject({ topic: film.topic, targetMinutes: 6 });
    // An interrupted run finds the folder it made instead of failing on a non-empty folder.
    const again = await factory.create({
      channelId: 'voxplain',
      item: film,
      targetMinutes: 6,
      signal: new AbortController().signal,
    });
    expect(again).toEqual({ ok: true, value: { projectPath: projectDir } });
    const missing = await factory.create({
      channelId: 'missing',
      item: film,
      targetMinutes: 6,
      signal: new AbortController().signal,
    });
    expect(missing.ok).toBe(false);
  });
});

describe('default queue executor', () => {
  it('writes the brief with one Sonnet turn under read-only permissions, repairing a bad reply', async () => {
    const claude = new ScriptedClaude([
      { reply: 'Sure! {"topic":"short"}' },
      { reply: BRIEF_REPLY },
    ]);
    const { executor, projectDir, ctx } = await setup('brief', item('b1'), { claude });
    expect(await executor.run('brief', ctx())).toEqual({ kind: 'done', message: 'brief written' });
    expect(claude.specs.map((spec) => [spec.stage, spec.model])).toEqual([
      ['critic', 'sonnet'],
      ['critic', 'sonnet'],
    ]);
    expect(claude.specs[1]?.prompt).toContain("did not pass the app's checks");
    const brief = briefFileSchema.parse(
      JSON.parse(readFileSync(path.join(projectDir, 'brief.json'), 'utf8')),
    );
    expect(brief).toMatchObject({ language: 'en', targetMinutes: 6, tone: 'friendly, hands-on' });
    expect(brief.notes).toContain('Hook idea: A plain glass');
  });

  it('maps a limited, blocked or missing Claude; a user brief needs no turn', async () => {
    const resetsAt = 1_800_000_000;
    const limited = new ScriptedClaude([
      {
        status: 'limit',
        message: 'limit',
        limit: {
          source: 'rate-limit-event',
          rateLimitType: 'five_hour',
          resetsAt,
          message: 'limit',
        },
      },
    ]);
    const first = await setup('brief-limit', item('b2'), { claude: limited });
    expect(await first.executor.run('brief', first.ctx())).toEqual({
      kind: 'limit',
      message: 'limit',
      until: resetsAt * 1000,
    });
    const blocked = new ScriptedClaude([{ status: 'blocked', message: 'not logged in' }]);
    const second = await setup('brief-blocked', item('b3'), { claude: blocked });
    expect((await second.executor.run('brief', second.ctx())).kind).toBe('blocked');
    const own = await setup('brief-own', item('b4', { brief: 'Focus on Newton.' }));
    expect(await own.executor.run('brief', own.ctx())).toMatchObject({ kind: 'done' });
    expect(readFileSync(path.join(own.projectDir, 'brief.json'), 'utf8')).toContain(
      'Focus on Newton.',
    );
  });

  it('runs the script stage once, then gates on the approval the app records', async () => {
    const { executor, projectDir, requests, ctx } = await setup('script', item('s1'));
    expect(await executor.run('script', ctx())).toMatchObject({
      kind: 'done',
      message: 'script written',
    });
    expect(await executor.run('script', ctx())).toEqual({ kind: 'done', message: 'already done' });
    expect(requests).toEqual([{ stage: 'script' }]);
    expect((await executor.run('approval', ctx())).kind).toBe('waiting');
    expect(await executor.approveScript(projectDir)).toEqual({ ok: true, value: undefined });
    const state = await new PipelineStateStore().read(projectDir);
    expect(state.ok && state.value.stages['script']?.approvedAt).toBeTypeOf('string');
    expect(await executor.run('approval', ctx())).toEqual({
      kind: 'done',
      message: 'script approved',
    });
  });

  it('auto-approves when the queue says so and refuses to approve an empty script', async () => {
    const { executor, projectDir, ctx } = await setup('auto', item('a1'));
    expect(await executor.approveScript(projectDir)).toEqual({
      ok: false,
      error: 'there is no script yet',
    });
    await executor.run('script', ctx());
    expect(await executor.run('approval', ctx(true))).toMatchObject({ kind: 'done' });
  });

  it('waits for a recording without a voice provider and imports a generated one', async () => {
    const generated: string[] = [];
    const voice: { provider?: VoiceProvider } = {};
    const { executor, requests, ctx } = await setup('voice', item('v1'), {
      voiceFor: () => voice.provider,
    });
    expect((await executor.run('voiceover', ctx())).kind).toBe('waiting');
    voice.provider = {
      generate: ({ projectDir }) => {
        generated.push(projectDir);
        return Promise.resolve(
          ok({ file: path.join(projectDir, 'vo.wav'), warnings: ['long pause'] }),
        );
      },
    };
    expect(await executor.run('voiceover', ctx())).toEqual({
      kind: 'done',
      message: 'voice imported',
      warnings: ['long pause', 'quiet start'],
    });
    expect(requests).toEqual([
      { stage: 'voiceover', source: path.join(generated[0] ?? '', 'vo.wav') },
    ]);
    expect(await executor.run('voiceover', ctx())).toEqual({
      kind: 'done',
      message: 'voice-over is in',
    });
  });

  it('assets, final review, export and publish kit', async () => {
    let exports = 0;
    const { executor, ctx } = await setup('tail', item('t1'), {
      finalReview: () => true,
      exportFilm: () => {
        exports += 1;
        return Promise.resolve(
          exports === 1
            ? err(stageError('limit', 'usage limit'))
            : ok({ message: 'exported', warnings: ['nvenc fallback'] }),
        );
      },
    });
    expect((await executor.run('assets', ctx())).kind).toBe('skipped');
    // A review that cannot run never fails the film: it is a ⚠ in the report.
    const review = await executor.run('final-review', ctx());
    expect(review).toMatchObject({ kind: 'done', message: 'final review incomplete' });
    expect((await executor.run('export', ctx())).kind).toBe('limit');
    expect(await executor.run('export', ctx())).toEqual({
      kind: 'done',
      message: 'exported',
      warnings: ['nvenc fallback'],
    });
    expect((await executor.run('publish', ctx())).kind).toBe('skipped');
    const bare = await setup('bare', item('t2'), { finalReview: false });
    expect((await bare.executor.run('final-review', bare.ctx())).kind).toBe('skipped');
    expect((await bare.executor.run('export', bare.ctx())).kind).toBe('failed');
  });

  it('maps stage errors: limits and a broken Claude go to the line, the rest to the film', () => {
    expect(stageOutcome(stageError('limit', 'l')).kind).toBe('limit');
    expect(stageOutcome(stageError('cancelled', 'c')).kind).toBe('cancelled');
    expect(stageOutcome(stageError('blocked', 'b')).kind).toBe('blocked');
    expect(stageOutcome(stageError('missing-tool', 'm')).kind).toBe('blocked');
    expect(stageOutcome(stageError('validation', 'bad', ['x', 'y']))).toEqual({
      kind: 'failed',
      message: 'bad (x; y)',
    });
  });
});
