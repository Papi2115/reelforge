import type { StageState } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { HOME_STEPS, type HomeStep, type HomeStepState } from '../../shared/home-contract.js';
import { homeSteps, NO_FILES, stepState, type StepFiles } from './home-steps.js';

const AT = '2026-10-09T10:00:00.000Z';
const state = (status: StageState['status'], extra: Partial<StageState> = {}): StageState => ({
  status,
  updatedAt: AT,
  ...extra,
});

function strip(
  stages: Record<string, StageState>,
  files: Partial<StepFiles> = {},
): Readonly<Record<HomeStep, HomeStepState>> {
  const states = homeSteps(stages, { ...NO_FILES, ...files });
  const of = (step: HomeStep): HomeStepState =>
    states.find((entry) => entry.step === step)?.state ?? 'todo';
  return {
    script: of('script'),
    voice: of('voice'),
    clean: of('clean'),
    words: of('words'),
    storyboard: of('storyboard'),
    scenes: of('scenes'),
    sound: of('sound'),
    export: of('export'),
  };
}

describe('stepState', () => {
  it('reads pipeline states, with the files as a fallback', () => {
    expect(stepState(undefined, false)).toBe('todo');
    expect(stepState(undefined, true)).toBe('done');
    expect(stepState(state('idle'), true)).toBe('done');
    expect(stepState(state('running'), false)).toBe('busy');
    expect(stepState(state('paused'), false)).toBe('busy');
    expect(stepState(state('failed'), true)).toBe('problem');
    expect(stepState(state('failed', { interrupted: true }), false)).toBe('needs-you');
    expect(stepState(state('blocked'), false)).toBe('needs-you');
    expect(stepState(state('done'), false)).toBe('done');
    expect(stepState(state('done', { stale: true }), true)).toBe('needs-you');
  });
});

describe('homeSteps', () => {
  it('lists the eight steps in film order', () => {
    expect(homeSteps({}, NO_FILES).map((entry) => entry.step)).toEqual([...HOME_STEPS]);
  });

  it('asks for the brief first, then for the approval of a written script', () => {
    expect(strip({}).script).toBe('needs-you');
    expect(strip({}, { brief: true }).script).toBe('todo');
    expect(strip({ script: state('done') }, { brief: true, script: true }).script).toBe(
      'needs-you',
    );
    const approved = strip({ script: state('done', { approvedAt: AT }) }, { brief: true });
    expect(approved.script).toBe('done');
    // After the approval only the user can add the voice.
    expect(approved.voice).toBe('needs-you');
  });

  it('counts a project made before pipeline states from its files', () => {
    const all: StepFiles = {
      brief: true,
      script: true,
      voiceover: true,
      cleaned: true,
      words: true,
      storyboard: true,
      scenes: true,
      mix: true,
      video: true,
    };
    expect(Object.values(strip({}, all))).toEqual(HOME_STEPS.map(() => 'done'));
  });

  it('joins sound design and the mix into one step', () => {
    expect(strip({ 'sound-cues': state('running') }).sound).toBe('busy');
    expect(strip({ 'sound-cues': state('done'), mix: state('failed') }).sound).toBe('problem');
    expect(strip({ 'sound-cues': state('done'), mix: state('done') }).sound).toBe('done');
    expect(strip({ 'sound-cues': state('done') }).sound).toBe('todo');
  });
});
