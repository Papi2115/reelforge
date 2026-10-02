import type { ProjectFile, StageState } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { canRun, wordsUseCleanAudio } from './gating.js';
import { downstreamOf } from './ids.js';
import { stagesToInvalidate } from './invalidate.js';
import type { ProjectSnapshot } from './snapshot.js';

const PROJECT: ProjectFile = {
  version: 1,
  title: 'Test',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 1,
};

const STAMP = '2026-10-02T10:00:00.000Z';

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    projectDir: 'C:/project',
    project: { status: 'ok', value: PROJECT },
    brief: {
      status: 'ok',
      value: { version: 1, topic: 'Doom', language: 'en', targetMinutes: 1 },
    },
    files: new Set(),
    voiceover: undefined,
    silenceRemovedS: 0,
    hasSceneFiles: false,
    stages: {},
    pause: undefined,
    ...overrides,
  };
}

const done = (extra: Partial<StageState> = {}): StageState => ({
  status: 'done',
  updatedAt: STAMP,
  ...extra,
});

describe('stage graph', () => {
  it('a new voice-over invalidates everything after it, but not the script', () => {
    expect(downstreamOf('voiceover')).toEqual([
      'clean',
      'words',
      'storyboard',
      'scenes',
      'sound-cues',
      'mix',
      'export',
    ]);
    expect(downstreamOf('mix')).toEqual(['export']);
  });

  it('invalidates only stages that ran or have output files', () => {
    const state = snapshot({
      files: new Set(['timing/words.json', 'storyboard.json']),
      hasSceneFiles: true,
      stages: { clean: done() },
    });
    expect(stagesToInvalidate('voiceover', state)).toEqual([
      'clean',
      'words',
      'storyboard',
      'scenes',
    ]);
  });
});

describe('canRun', () => {
  it('needs a brief with a target length for the script', () => {
    expect(canRun('script', snapshot()).ready).toBe(true);
    expect(canRun('script', snapshot({ brief: { status: 'missing' } })).reasons).toEqual([
      'brief.json is missing: fill in the brief.',
    ]);
    const noLength = snapshot({
      brief: { status: 'ok', value: { version: 1, topic: 'x', language: 'en' } },
    });
    expect(canRun('script', noLength).reasons).toEqual([
      'The brief has no target length (targetMinutes).',
    ]);
  });

  it('explains what the storyboard is missing', () => {
    expect(canRun('storyboard', snapshot()).reasons).toEqual([
      'script.txt is missing: run Script first.',
      'timing/words.json is missing: run Words timed first.',
    ]);
  });

  it('blocks on a stale upstream stage with the reason', () => {
    const state = snapshot({
      files: new Set(['script.txt', 'timing/words.json']),
      stages: { words: done({ stale: true, staleReason: 'voiceover changed' }) },
    });
    expect(canRun('storyboard', state)).toEqual({
      ready: false,
      reasons: ['Words timed is out of date (voiceover changed): run it again first.'],
    });
  });

  it('blocks a stage that is running and a stage whose input is being produced', () => {
    const state = snapshot({
      files: new Set(['script.txt']),
      voiceover: { file: 'audio/vo.original.wav', extension: 'wav' },
      stages: { voiceover: { status: 'running', updatedAt: STAMP } },
    });
    expect(canRun('words', state).reasons).toEqual(['Voiceover is still running.']);
    expect(canRun('voiceover', state).reasons).toEqual(['Voiceover is already running.']);
  });

  it('needs the clean voice-over and cues for the mix', () => {
    expect(canRun('mix', snapshot()).reasons).toEqual([
      'audio/vo.clean.wav is missing: run Audio cleaned first.',
      'cues.json is missing: run Sound cues first.',
    ]);
  });

  it('reports a broken project.json for every stage', () => {
    const state = snapshot({ project: { status: 'invalid', message: 'fps: too big' } });
    expect(canRun('voiceover', state).reasons).toEqual(['project.json is invalid (fps: too big).']);
  });

  it('times words on the cleaned audio only when pauses were shortened', () => {
    const cleaned = snapshot({ files: new Set(['audio/vo.clean.wav']) });
    expect(wordsUseCleanAudio(cleaned)).toBe(false);
    expect(wordsUseCleanAudio({ ...cleaned, silenceRemovedS: 1.2 })).toBe(true);
  });
});
