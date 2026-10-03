/**
 * The Words timed blocking notice of the pipeline sidebar: when Words timed is about to run (or
 * failed) without whisper.cpp / its model, the sidebar offers "Download and continue" instead of
 * a failure; the install's progress shows there and the stages run once it is done. Pure state
 * machine over main's readiness, the install progress and what the user asked to run.
 */
import type { PipelineStageKey, StageErrorInfo } from '../../shared/stages-contract.js';
import type { WhisperProgress, WhisperReadiness } from '../../shared/whisper-contract.js';
import { formatBytes, progressView, type ProgressView } from '../settings/whisper-setup-state.js';

export interface WordsSetupInput {
  readonly readiness: WhisperReadiness | undefined;
  readonly progress: WhisperProgress | undefined;
  /** Stages held back until the install is done (a Run / Redo that includes Words timed). */
  readonly held: readonly PipelineStageKey[] | null;
  /** Last error of the Words timed stage in this session. */
  readonly wordsError: StageErrorInfo | null;
}

export type WordsSetupView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'needed'; readonly text: string; readonly buttonLabel: string }
  | { readonly kind: 'installing'; readonly progress: ProgressView }
  | { readonly kind: 'failed'; readonly message: string; readonly detail: string | null };

/** `596286527` -> `≈ 600 MB` (two significant digits). */
export function approxSize(bytes: number): string {
  return `≈ ${formatBytes(Number(bytes.toPrecision(2)))}`;
}

/** The stage failed because whisper.cpp or its model is missing (stages' `missing-tool`). */
export const wordsNeedWhisper = (error: StageErrorInfo | null): boolean =>
  error?.kind === 'missing-tool';

export function wordsSetupView(input: WordsSetupInput): WordsSetupView {
  const { readiness } = input;
  const setup = input.progress?.job.kind === 'setup' ? input.progress : undefined;
  if (setup?.phase === 'running') {
    return { kind: 'installing', progress: progressView(setup) };
  }
  const blocked = input.held !== null || wordsNeedWhisper(input.wordsError);
  if (!blocked || readiness === undefined || readiness.ready) return { kind: 'hidden' };
  if (setup?.phase === 'failed') {
    return {
      kind: 'failed',
      message: setup.message ?? 'The download failed.',
      detail: setup.detail,
    };
  }
  const size = approxSize(readiness.bytes);
  return {
    kind: 'needed',
    text: `Words timed needs the transcription engine (${size}, one-time)`,
    buttonLabel: 'Download and continue',
  };
}

/** The stages of a Run / Redo click that need whisper.cpp. */
export const needsWhisper = (stages: readonly PipelineStageKey[]): boolean =>
  stages.includes('words');
