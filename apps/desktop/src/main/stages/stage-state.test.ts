import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import type { PipelineState } from '@reelforge/shared';
import { PIPELINE_STAGES, readProjectSnapshot } from '@reelforge/stages';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APPROVAL_REASON,
  approvalReasons,
  assetsFollowUp,
  assetsVisible,
  buildStageInfos,
  INTERRUPTED_MESSAGE,
  recoverInterrupted,
  runRequestFor,
  STAGE_RUNS,
} from './stage-state.js';
import { TempProjects } from './testing/fixtures.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

const STAMP = '2026-10-02T10:00:00.000Z';

describe('stage state', () => {
  it('starts every stage but the voice-over (Replace / Record) from the sidebar', () => {
    expect(runRequestFor('script')).toEqual({ stage: 'script' });
    expect(runRequestFor('voiceover')).toBeUndefined();
    expect(runRequestFor('scenes')).toEqual({ stage: 'scenes' });
    expect(runRequestFor('export')).toEqual({ stage: 'export' });
    expect(Object.keys(STAGE_RUNS)).toEqual([...PIPELINE_STAGES]);
  });

  it('recovers running and paused stages as interrupted, keeping the rest', () => {
    const state: PipelineState = {
      version: 1,
      updatedAt: STAMP,
      stages: {
        script: { status: 'running', updatedAt: STAMP, approvedAt: STAMP },
        words: { status: 'done', updatedAt: STAMP },
      },
      queue: [],
    };
    const recovered = recoverInterrupted(state, '2026-10-02T11:00:00.000Z');
    expect(recovered.recovered).toEqual(['script']);
    expect(recovered.state.stages['script']).toEqual({
      status: 'failed',
      interrupted: true,
      message: INTERRUPTED_MESSAGE,
      approvedAt: STAMP,
      updatedAt: '2026-10-02T11:00:00.000Z',
    });
    expect(recovered.state.stages['words']).toBe(state.stages['words']);
    expect(recoverInterrupted(recovered.state, STAMP).recovered).toEqual([]);
  });

  it('builds the infos of a project from its files and pipeline.json', async () => {
    const dir = projects.create({
      'script.txt': 'Spoken words.',
      'timing/words.json': '{}',
      'audio/vo.original.wav': 'x',
    });
    const store = new PipelineStateStore();
    await store.setStage(dir, 'words', 'done');
    const snapshot = await readProjectSnapshot(dir, store);
    expect(approvalReasons('storyboard', snapshot)).toEqual([APPROVAL_REASON]);
    expect(approvalReasons('clean', snapshot)).toEqual([]);
    const infos = buildStageInfos({
      snapshot,
      hasVideo: false,
      errors: new Map([['clean', { kind: 'tool', message: 'ffmpeg failed', issues: [] }]]),
      warnings: new Map([['words', ['low coverage']]]),
    });
    // No research mode in project.json (= off): the Assets step is not listed (PLAN.md#12.10).
    expect(infos.map((info) => info.stage)).toEqual(
      PIPELINE_STAGES.filter((stage) => stage !== 'assets'),
    );
    const byStage = new Map(infos.map((info) => [info.stage, info]));
    expect(byStage.get('script')).toMatchObject({
      status: null,
      hasOutput: true,
      ready: true,
      invalidates: ['words'],
    });
    expect(byStage.get('voiceover')).toMatchObject({ hasOutput: true, runnable: false });
    expect(byStage.get('clean')).toMatchObject({
      ready: true,
      error: { kind: 'tool', message: 'ffmpeg failed', issues: [] },
    });
    expect(byStage.get('words')).toMatchObject({ status: 'done', warnings: ['low coverage'] });
    expect(byStage.get('storyboard')?.reasons).toEqual([APPROVAL_REASON]);
    expect(byStage.get('scenes')).toMatchObject({ registered: true, ready: false });
    expect(byStage.get('scenes')?.reasons).toContain(
      'storyboard.json is missing: run Storyboard first.',
    );
    expect(byStage.get('export')).toMatchObject({ hasOutput: false, registered: true });
    expect(byStage.get('export')?.reasons).toEqual(
      expect.arrayContaining([
        'No scenes yet: run Scenes built first.',
        'audio/mix.wav is missing: run Sound design mixed first.',
        APPROVAL_REASON,
      ]),
    );
  });

  it('lists Assets when research is on and needed; storyboard queues it, a review stops the group', async () => {
    const storyboard = {
      version: 1,
      shots: [
        {
          id: 's01',
          t0: 0,
          t1: 3,
          treatment: 'title-card',
          intent: 'x',
          scene: 'scenes/s01.js',
          assetNeeds: [{ id: 'photo', kind: 'image', description: 'a photo' }],
        },
      ],
    };
    const dir = projects.create({ 'storyboard.json': JSON.stringify(storyboard) });
    const store = new PipelineStateStore();
    const off = await readProjectSnapshot(dir, store);
    expect(assetsVisible(off)).toBe(false);
    expect(assetsFollowUp('storyboard', off)).toBeUndefined();
    const project = JSON.parse(readFileSync(path.join(dir, 'project.json'), 'utf8')) as object;
    writeFileSync(
      path.join(dir, 'project.json'),
      JSON.stringify({ ...project, researchMode: 'ask' }),
    );
    const on = await readProjectSnapshot(dir, store);
    expect(assetsVisible(on)).toBe(true);
    expect(assetsFollowUp('storyboard', on)).toBe('queue-assets');
    const infos = buildStageInfos({
      snapshot: on,
      hasVideo: false,
      errors: new Map(),
      warnings: new Map(),
    });
    expect(infos.find((info) => info.stage === 'assets')).toMatchObject({ awaitingReview: false });
    await store.setStage(dir, 'assets', 'done');
    mkdirSync(path.join(dir, '.reelforge', 'assets', 'proposals'), { recursive: true });
    writeFileSync(
      path.join(dir, '.reelforge', 'assets', 'proposals', '1.json'),
      JSON.stringify({
        version: 1,
        number: 1,
        createdAt: STAMP,
        items: [
          {
            candidate: {
              source: 'nasa',
              id: 'a',
              kind: 'image',
              title: 't',
              author: 'a',
              licence: { id: 'NASA', url: null, verified: true },
              sourceUrl: 'https://images.nasa.gov/a',
              thumbnailUrl: null,
              width: null,
              height: null,
              bytes: null,
            },
            thumbnail: null,
            approved: false,
          },
        ],
      }),
    );
    const review = await readProjectSnapshot(dir, store);
    expect(assetsFollowUp('assets', review)).toBe('stop-group');
    const reviewInfos = buildStageInfos({
      snapshot: review,
      hasVideo: false,
      errors: new Map(),
      warnings: new Map(),
    });
    expect(reviewInfos.find((info) => info.stage === 'assets')?.awaitingReview).toBe(true);
    expect(reviewInfos.find((info) => info.stage === 'scenes')?.reasons).toContain(
      'An asset package is waiting for your review: open Assets and approve or reject it.',
    );
  });
});
