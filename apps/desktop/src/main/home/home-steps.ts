/**
 * The eight-step progress strip of a Home card (PLAN.md#13.16): what pipeline.json says about each
 * step, with the files as a fallback for projects made before it (or copied from elsewhere). Cheap
 * on purpose: no gating rules, no reports; the workspace shows the full status. Pure.
 */
import type { StageState } from '@reelforge/shared';
import {
  HOME_STEPS,
  type HomeStep,
  type HomeStepState,
  type HomeStepStatus,
} from '../../shared/home-contract.js';

/** Which outputs exist (cheap file checks). */
export interface StepFiles {
  readonly brief: boolean;
  readonly script: boolean;
  readonly voiceover: boolean;
  readonly cleaned: boolean;
  readonly words: boolean;
  readonly storyboard: boolean;
  readonly scenes: boolean;
  readonly mix: boolean;
  readonly video: boolean;
}

export const NO_FILES: StepFiles = {
  brief: false,
  script: false,
  voiceover: false,
  cleaned: false,
  words: false,
  storyboard: false,
  scenes: false,
  mix: false,
  video: false,
};

type Stages = Readonly<Record<string, StageState>>;

/** One runner step: its state in pipeline.json, else whether its output exists. */
export function stepState(state: StageState | undefined, hasOutput: boolean): HomeStepState {
  if (state === undefined || state.status === 'idle') return hasOutput ? 'done' : 'todo';
  switch (state.status) {
    case 'running':
    case 'paused':
      return 'busy';
    case 'failed':
      // Stopped by an app restart: nothing went wrong, it waits to be resumed.
      return state.interrupted === true ? 'needs-you' : 'problem';
    case 'blocked':
      return 'needs-you';
    case 'done':
      return state.stale === true ? 'needs-you' : 'done';
  }
}

/** The worst of two states (busy first: something is happening). */
function combined(first: HomeStepState, second: HomeStepState): HomeStepState {
  const order: readonly HomeStepState[] = ['busy', 'problem', 'needs-you', 'todo', 'done'];
  return order.indexOf(first) <= order.indexOf(second) ? first : second;
}

function scriptStep(stages: Stages, files: StepFiles): HomeStepState {
  const state = stages['script'];
  const base = stepState(state, files.script);
  if (base === 'todo' && !files.brief) return 'needs-you';
  // A written script waits for the user's approval (the gate of every later step).
  if (base === 'done' && state !== undefined && state.approvedAt === undefined) return 'needs-you';
  return base;
}

function scriptApproved(stages: Stages, files: StepFiles): boolean {
  const state = stages['script'];
  return state === undefined ? files.script : state.approvedAt !== undefined;
}

function voiceStep(stages: Stages, files: StepFiles): HomeStepState {
  const base = stepState(stages['voiceover'], files.voiceover);
  // After the approval only the user can add the voice (record, import or generate it).
  return base === 'todo' && scriptApproved(stages, files) ? 'needs-you' : base;
}

function soundStep(stages: Stages, files: StepFiles): HomeStepState {
  const cues = stepState(stages['sound-cues'], files.mix);
  const mix = stepState(stages['mix'], files.mix);
  if (mix === 'done' && cues === 'done') return 'done';
  return combined(cues, mix);
}

/** The strip, in HOME_STEPS order. */
export function homeSteps(stages: Stages, files: StepFiles): HomeStepStatus[] {
  const states: Readonly<Record<HomeStep, HomeStepState>> = {
    script: scriptStep(stages, files),
    voice: voiceStep(stages, files),
    clean: stepState(stages['clean'], files.cleaned),
    words: stepState(stages['words'], files.words),
    storyboard: stepState(stages['storyboard'], files.storyboard),
    scenes: stepState(stages['scenes'], files.scenes),
    sound: soundStep(stages, files),
    export: stepState(stages['export'], files.video),
  };
  return HOME_STEPS.map((step) => ({ step, state: states[step] }));
}
