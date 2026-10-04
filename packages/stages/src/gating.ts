/**
 * Dependency rules: can a stage run on this project right now? Pure over a `ProjectSnapshot`, so the
 * UI can grey out buttons and show the human-readable reasons.
 */
import { assetsReasons, assetsStageReasons } from './assets-gate.js';
import { STAGE_TITLES, STAGE_UPSTREAM, type StageId } from './ids.js';
import { FILES } from './paths.js';
import type { ProjectSnapshot } from './snapshot.js';

export interface Readiness {
  readonly ready: boolean;
  /** Why not, one sentence each (empty when ready). */
  readonly reasons: readonly string[];
}

/** Below this the cleaned audio counts as "pauses shortened" (timeline changed). */
const SILENCE_EPSILON_S = 0.01;

/** Words are timed on the cleaned audio only when the clean stage shortened pauses. */
export function wordsUseCleanAudio(snapshot: ProjectSnapshot): boolean {
  return snapshot.silenceRemovedS > SILENCE_EPSILON_S && snapshot.files.has(FILES.voClean);
}

function need(snapshot: ProjectSnapshot, file: string, hint: string): string[] {
  return snapshot.files.has(file) ? [] : [`${file} is missing: ${hint}.`];
}

function upstreamReasons(stage: StageId, snapshot: ProjectSnapshot): string[] {
  const reasons: string[] = [];
  for (const upstream of STAGE_UPSTREAM[stage]) {
    const state = snapshot.stages[upstream];
    const title = STAGE_TITLES[upstream];
    if (state?.status === 'running') reasons.push(`${title} is still running.`);
    else if (state?.stale === true) {
      const why = state.staleReason === undefined ? '' : ` (${state.staleReason})`;
      reasons.push(`${title} is out of date${why}: run it again first.`);
    }
  }
  return reasons;
}

function fileReasons(stage: StageId, snapshot: ProjectSnapshot): string[] {
  const noVoiceover =
    snapshot.voiceover === undefined ? ['No voice-over imported yet: run Voiceover first.'] : [];
  switch (stage) {
    case 'script': {
      if (snapshot.brief.status === 'missing') return ['brief.json is missing: fill in the brief.'];
      if (snapshot.brief.status === 'invalid') {
        return [`brief.json is invalid (${snapshot.brief.message}).`];
      }
      return snapshot.brief.value.targetMinutes === undefined
        ? ['The brief has no target length (targetMinutes).']
        : [];
    }
    case 'voiceover':
      return [];
    case 'clean':
      return noVoiceover;
    case 'words':
      return [...noVoiceover, ...need(snapshot, FILES.script, 'run Script first')];
    case 'storyboard':
      return [
        ...need(snapshot, FILES.script, 'run Script first'),
        ...need(snapshot, FILES.words, 'run Words timed first'),
      ];
    case 'assets':
      return [
        ...need(snapshot, FILES.storyboard, 'run Storyboard first'),
        ...assetsStageReasons(snapshot),
      ];
    case 'scenes':
      return [
        ...need(snapshot, FILES.storyboard, 'run Storyboard first'),
        ...assetsReasons(snapshot),
      ];
    case 'sound-cues':
      return [
        ...need(snapshot, FILES.storyboard, 'run Storyboard first'),
        ...need(snapshot, FILES.words, 'run Words timed first'),
      ];
    case 'mix':
      return [
        ...need(snapshot, FILES.voClean, 'run Audio cleaned first'),
        ...need(snapshot, FILES.cues, 'run Sound cues first'),
      ];
  }
}

export function canRun(stage: StageId, snapshot: ProjectSnapshot): Readiness {
  const reasons: string[] = [];
  if (snapshot.project.status !== 'ok') {
    reasons.push(
      snapshot.project.status === 'missing'
        ? 'project.json is missing: this folder is not a ReelForge project.'
        : `project.json is invalid (${snapshot.project.message}).`,
    );
  }
  if (snapshot.stages[stage]?.status === 'running') {
    reasons.push(`${STAGE_TITLES[stage]} is already running.`);
  }
  reasons.push(...fileReasons(stage, snapshot), ...upstreamReasons(stage, snapshot));
  if (stage === 'words' && wordsUseCleanAudio(snapshot) && snapshot.stages['clean']?.stale) {
    reasons.push('Audio cleaned is out of date and words are timed on it: run it again first.');
  }
  return { ready: reasons.length === 0, reasons };
}
