import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PipelineStateStore, ok } from '@reelforge/claude-bridge';
import { emptyProductionQueue, type ProductionQueue, type QueueItem } from '@reelforge/shared';
import type {
  ExecutorStep,
  QueueStepContext,
  QueueStepExecutor,
  VoiceProvider,
} from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportOutcome } from '../../shared/export-contract.js';
import type { VoiceGenerateResult } from '../../shared/voice-contract.js';
import { createLogger } from '../logger.js';
import { LineExecutor } from './line-executor.js';
import { lineEndNotice, lineNotice } from './line-notices.js';
import { lineExportStep } from './line-steps.js';
import { GeneratedVoices, lineVoiceProvider } from './line-voice.js';
import { filmWaitsIn, itemView, runUntilView, stageLive } from './queue-views.js';

const AT = '2026-10-07T10:00:00.000Z';

function item(patch: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'a1',
    topic: 'Why is the sky blue',
    language: 'en',
    status: 'queued',
    stageProgress: {},
    warnings: [],
    createdAt: AT,
    updatedAt: AT,
    history: [],
    ...patch,
  };
}

function context(step: ExecutorStep, labels: string[]): QueueStepContext {
  return {
    channelId: 'voxplain',
    item: item(),
    projectDir: path.join('films', 'a1'),
    autoApproveScript: false,
    targetMinutes: 8,
    signal: new AbortController().signal,
    stageEvent: () => undefined,
    progress: (label) => {
      labels.push(`${step}: ${label}`);
    },
  };
}

describe('queue views', () => {
  it('shows the current step, its waiting message and the progress of a film', () => {
    const waiting = item({
      status: 'needs-approval',
      targetMinutes: 6,
      projectPath: path.join('films', 'a1'),
      stageProgress: {
        project: { state: 'done', at: AT },
        brief: { state: 'done', at: AT },
        script: { state: 'done', at: AT },
        approval: { state: 'waiting', at: AT, message: 'Approve the script.' },
      },
    });
    expect(itemView({ defaultTargetMinutes: 8 }, waiting, undefined)).toMatchObject({
      step: 'approval',
      stepState: 'waiting',
      message: 'Approve the script.',
      targetMinutes: 6,
      stepsDone: 3,
      stepsTotal: 15,
      live: null,
    });
    const failed = item({
      status: 'failed',
      stageProgress: { project: { state: 'failed', at: AT, message: 'disk full' } },
      error: { step: 'project', message: 'disk full' },
    });
    expect(itemView({ defaultTargetMinutes: 8 }, failed, undefined)).toMatchObject({
      step: 'project',
      message: 'disk full',
      targetMinutes: 8,
    });
  });

  it('finds the films waiting in a project folder', () => {
    const queue: ProductionQueue = {
      ...emptyProductionQueue('voxplain'),
      items: [item({ status: 'needs-voice', projectPath: 'C:/Films/A' })],
    };
    const key = (dir: string): string => dir.toLowerCase();
    expect(filmWaitsIn(queue, new Set(['c:/films/a']), key)).toBe(true);
    expect(filmWaitsIn(queue, new Set(['c:/films/b']), key)).toBe(false);
  });

  it('turns "run until 06:30" into the next 06:30', () => {
    const now = Date.UTC(2026, 9, 7, 22, 15, 30);
    const minuteOf = (epoch: number): number =>
      new Date(epoch).getUTCHours() * 60 + new Date(epoch).getUTCMinutes();
    expect(runUntilView({ kind: 'time', at: '06:30' }, now, minuteOf)).toEqual({
      kind: 'time',
      at: Date.UTC(2026, 9, 8, 6, 30),
      text: '06:30',
    });
    expect(runUntilView({ kind: 'time', at: '23:00' }, now, minuteOf)).toMatchObject({
      at: Date.UTC(2026, 9, 7, 23, 0),
    });
    expect(runUntilView({ kind: 'idle' }, now, minuteOf)).toEqual({ kind: 'idle' });
  });

  it('reads a running stage as a live line', () => {
    expect(
      stageLive({ type: 'step', stage: 'scenes', label: 'Building 3 of 7', percent: 40 }),
    ).toEqual({ label: 'Building 3 of 7', percent: 40 });
    expect(
      stageLive({
        type: 'shot',
        stage: 'scenes',
        shotId: 's02',
        state: 'started',
        status: undefined,
      }),
    ).toEqual({ label: 'Building shot s02', percent: null });
    expect(stageLive({ type: 'started', stage: 'scenes' })).toBeNull();
  });
});

describe('line notices', () => {
  it('names the film and leaves the bookkeeping out', () => {
    expect(
      lineNotice({
        kind: 'needs-approval',
        message: 'x',
        channelId: 'voxplain',
        itemId: 'a1',
        topic: 'Sky',
      }),
    ).toEqual({
      title: 'Script to approve',
      body: 'Sky: the script is written.',
      ref: { channelId: 'voxplain', itemId: 'a1' },
    });
    expect(lineNotice({ kind: 'failed', message: 'lock not released' })).toBeUndefined();
    expect(lineNotice({ kind: 'line-idle', message: 'idle' })).toBeUndefined();
    expect(lineEndNotice({ end: 'idle', didWork: false, waiting: 2 })).toBeUndefined();
    expect(lineEndNotice({ end: 'idle', didWork: true, waiting: 1 })?.body).toBe(
      'Nothing more it can do alone: 1 film waits for you.',
    );
    expect(lineEndNotice({ end: 'time', didWork: false, waiting: 0, until: '06:30' })?.body).toBe(
      'Stopped at 06:30 as planned.',
    );
  });
});

describe('the line voice', () => {
  it('hands the generated file back instead of importing it', async () => {
    const voices = new GeneratedVoices();
    const dir = path.join('films', 'a1');
    let cancelled = 0;
    let answer: VoiceGenerateResult = {
      status: 'ok',
      generatedParagraphs: 2,
      reusedParagraphs: 0,
      characters: 300,
      message: 'Generated 2 paragraphs.',
    };
    const provider = lineVoiceProvider({
      voices,
      service: {
        generate: async (projectDir) => {
          if (projectDir === undefined) throw new Error('no dir');
          if (answer.status === 'ok') {
            const queued = await voices.importVoiceover(projectDir, 'C:/take.wav');
            expect(queued.status).toBe('queued');
          }
          return answer;
        },
        cancel: () => {
          cancelled += 1;
          return true;
        },
      },
    });
    const signal = new AbortController().signal;
    const request = { projectDir: dir, channelId: 'voxplain', signal };
    expect(await provider.generate(request)).toEqual(ok({ file: 'C:/take.wav' }));
    expect(voices.take(dir)).toBeUndefined();
    answer = { status: 'error', kind: 'no-key', message: 'No ElevenLabs key is saved.' };
    expect(await provider.generate(request)).toMatchObject({
      ok: false,
      error: { kind: 'failed', message: 'No ElevenLabs key is saved.' },
    });
    const stopped = new AbortController();
    stopped.abort();
    expect(await provider.generate({ ...request, signal: stopped.signal })).toMatchObject({
      ok: false,
      error: { kind: 'cancelled' },
    });
    expect(cancelled).toBe(0);
  });
});

describe('the line executor', () => {
  it('reads the channel voice before the voiceover and follows the film to render', async () => {
    const followed: string[] = [];
    const labels: string[] = [];
    let ready = false;
    let voiceFor: ((channelId: string) => VoiceProvider | undefined) | undefined;
    const provider: VoiceProvider = { generate: () => Promise.reject(new Error('unused')) };
    const inner: QueueStepExecutor = {
      run: (step) =>
        Promise.resolve(
          step === 'voiceover' && voiceFor?.('voxplain') === undefined
            ? { kind: 'waiting', message: 'Record the voiceover.' }
            : { kind: 'done', message: step },
        ),
      approveScript: () => Promise.resolve(ok(undefined)),
    };
    const executor = new LineExecutor(
      {
        follow: (dir) => {
          followed.push(dir);
          return Promise.resolve();
        },
        voiceReady: () => Promise.resolve(ready),
      },
      provider,
      (given) => {
        voiceFor = given;
        return inner;
      },
    );
    expect((await executor.run('voiceover', context('voiceover', labels))).kind).toBe('waiting');
    ready = true;
    expect((await executor.run('voiceover', context('voiceover', labels))).kind).toBe('done');
    await executor.run('script', context('script', labels));
    await executor.run('scenes', context('scenes', labels));
    await executor.run('export', context('export', labels));
    expect(followed).toEqual([path.join('films', 'a1'), path.join('films', 'a1')]);
  });
});

describe('the line export', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge line export ł-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });

  it('runs the app export of the film and maps a missing ffmpeg to the whole line', async () => {
    const followed: string[] = [];
    const labels: string[] = [];
    let outcome: ExportOutcome = {
      status: 'done',
      output: path.join(root, 'out', 'Sky.mp4'),
      thumbnail: null,
      renderedShots: ['s01'],
      cachedShots: [],
      totalFrames: 360,
      durationS: 12,
      width: 1920,
      height: 1080,
      encoder: 'libx264',
      gpu: null,
      resumed: false,
      wallMs: 1000,
      warnings: [],
    };
    const step = lineExportStep({
      service: {
        runForStage: (listener) => {
          listener({ type: 'mux' });
          return Promise.resolve(outcome);
        },
        cancelStage: () => undefined,
      },
      follow: (dir) => {
        followed.push(dir);
        return Promise.resolve();
      },
      store: new PipelineStateStore(),
      log: createLogger(() => undefined),
    });
    const request = {
      projectDir: root,
      channelId: 'voxplain',
      signal: new AbortController().signal,
      progress: (label: string) => {
        labels.push(label);
      },
    };
    const done = await step(request);
    expect(done.ok && done.value.message).toContain('out/Sky.mp4');
    expect(followed).toEqual([root]);
    expect(labels).toEqual(['Encoding and adding the audio']);
    outcome = { status: 'failed', kind: 'no-ffmpeg', message: 'ffmpeg not found' };
    expect(await step(request)).toMatchObject({
      ok: false,
      error: { kind: 'missing-tool', message: 'ffmpeg not found' },
    });
  });
});
