/** Stage runner contracts: requests, results, events, the context a stage runs with. */
import type { PipelineStateStore, Result, StreamEvent } from '@reelforge/claude-bridge';
import type { PromptId } from '@reelforge/prompts';
import type { SessionPurpose, ShotBuildStatus, UsageTotals } from '@reelforge/shared';
import type { AudioTools } from './audio-tools.js';
import type { ClaudeTurnResult } from './claude.js';
import type { PipelineStage, StageId } from './ids.js';
import type { SceneTools } from './scenes/tools.js';
import type { StageSettings } from './settings.js';
import type { ProjectSnapshot } from './snapshot.js';

export type StageRequest =
  | { readonly stage: 'script' }
  | {
      readonly stage: 'voiceover';
      /** Recording to import (wav, mp3, m4a, ogg, flac). */
      readonly source: string;
      /** Override of `StageSettings.archivePreviousVoiceover`. */
      readonly archivePrevious?: boolean;
    }
  | { readonly stage: 'clean' }
  | { readonly stage: 'words' }
  | { readonly stage: 'storyboard' }
  | {
      readonly stage: 'scenes';
      /** Default `build`; the review modes are the "Whole video" chat chips (PLAN.md#7.6). */
      readonly action?: SceneAction;
      /** Only these storyboard shots (default: all). */
      readonly shots?: readonly string[];
    }
  | { readonly stage: 'sound-cues' }
  | { readonly stage: 'mix' };

/**
 * "Review the whole video and fix what looks wrong" · "Make all on-screen text easier to read on
 * a phone" · "Check every visual lands on its spoken word".
 */
export const REVIEW_MODES = ['fix-what-looks-wrong', 'phone-legibility', 'sync-check'] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];
export type SceneAction = 'build' | ReviewMode;

export type RequestOf<S extends StageId> = Extract<StageRequest, { readonly stage: S }>;

export type StageErrorKind =
  /** Inputs missing / upstream stale (see `canRun`). */
  | 'not-ready'
  /** Another stage is running in this runner. */
  | 'busy'
  /** Bad request (e.g. unsupported voice-over format). */
  | 'invalid-input'
  /** No ClaudeRunner / AudioTools configured. */
  | 'missing-tool'
  /** Claude cannot run at all (not logged in, CLI missing, billing guard). */
  | 'blocked'
  /** Usage limit hit and no LimitGuard to wait for the reset. */
  | 'limit'
  /** A Claude turn failed (crash, timeout, API error). */
  | 'claude'
  /** Output still invalid after the repair turn. */
  | 'validation'
  /** ffmpeg / whisper failed. */
  | 'tool'
  /** The result missed a hard quality bar (e.g. mix loudness). */
  | 'quality'
  | 'io'
  | 'cancelled';

export interface StageError {
  readonly kind: StageErrorKind;
  readonly message: string;
  /** Validation issues / gating reasons, one line each. */
  readonly issues?: readonly string[];
}

export type Metric = string | number | boolean | null;

/** What a stage returns on success. */
export interface StageSummary {
  /** One line for the UI and the commit subject. */
  readonly message: string;
  /** Project-relative files written. */
  readonly outputs: readonly string[];
  /** False when nothing changed (e.g. the same voice-over imported again): no invalidation. */
  readonly changed: boolean;
  readonly warnings: readonly string[];
  /** Small typed numbers for the UI (word count, coverage, LUFS, …). */
  readonly metrics: Readonly<Record<string, Metric>>;
}

export interface StageSuccess extends StageSummary {
  readonly stage: StageId;
  /** Claude usage of this run (all turns), undefined when no turn ran. */
  readonly usage: UsageTotals | undefined;
  /** Stages marked stale because this one changed its output. */
  readonly invalidated: readonly PipelineStage[];
  /** Commit of the finished step, when one was made. */
  readonly commit: string | undefined;
}

export type StageEvent =
  | { readonly type: 'started'; readonly stage: StageId }
  | {
      readonly type: 'step';
      readonly stage: StageId;
      readonly label: string;
      /** Whole-stage completion 0..100, when known. */
      readonly percent: number | undefined;
    }
  | { readonly type: 'claude'; readonly stage: StageId; readonly event: StreamEvent }
  | {
      readonly type: 'paused';
      readonly stage: StageId;
      /** ISO time of the automatic resume; undefined = manual resume. */
      readonly until: string | undefined;
      readonly message: string;
    }
  | { readonly type: 'resumed'; readonly stage: StageId }
  | {
      readonly type: 'shot';
      readonly stage: StageId;
      readonly shotId: string;
      /** `requeued`: interrupted (cancel, blocked Claude) and left for the next run. */
      readonly state: 'started' | 'finished' | 'requeued';
      /** ✓ / ⚠ / ✗ once finished. */
      readonly status: ShotBuildStatus | undefined;
    }
  | { readonly type: 'warning'; readonly stage: StageId; readonly message: string }
  | { readonly type: 'committed'; readonly stage: StageId; readonly hash: string }
  | { readonly type: 'done'; readonly stage: StageId; readonly result: StageSuccess }
  | { readonly type: 'failed'; readonly stage: StageId; readonly error: StageError };

/** One Claude turn as a stage asks for it; the runner picks the model and handles limits. */
export interface StageTurn {
  readonly prompt: PromptId;
  /** Rendered prompt text. */
  readonly text: string;
  readonly purpose: SessionPurpose;
  readonly newSession: boolean;
  /** Short label for progress and the commit subject, e.g. `research`. */
  readonly label: string;
  /** Autocommit after the turn (default true); scene turns commit once per shot instead. */
  readonly commit?: boolean;
  /**
   * After a usage limit, continue in the session the turn started (default true). False starts a
   * fresh session again: parallel scene jobs share the project's session slot of a purpose, so
   * "the session" may belong to another shot by then.
   */
  readonly resumeAfterLimit?: boolean;
}

/** A shot's progress as the scene stage reports it. */
export type ShotEventState = Extract<StageEvent, { readonly type: 'shot' }>['state'];

export interface StageContext {
  readonly projectDir: string;
  readonly settings: StageSettings;
  readonly snapshot: ProjectSnapshot;
  readonly signal: AbortSignal;
  readonly audio: AudioTools | undefined;
  /** Scene sfx events recorded by scene builds (for the default sound cues). */
  readonly sceneSfx: SceneSfxProvider | undefined;
  /** Is Claude configured at all (a ClaudeRunner was given)? */
  readonly hasClaude: boolean;
  now(): Date;
  step(label: string, percent?: number): void;
  warn(message: string): void;
  /** Runs a turn: model per settings, waits out usage limits, autocommits afterwards. */
  claude(turn: StageTurn): Promise<Result<ClaudeTurnResult, StageError>>;
  /** Frame renderer, kit catalogue and missing-prop handler (scene stage only). */
  readonly scenes: SceneTools | undefined;
  /** The runner's pipeline.json store (per-shot work items; one instance = serialized writes). */
  readonly store: PipelineStateStore;
  /** Claude turns allowed at once now (LimitGuard concurrency, halved after a limit). */
  claudeConcurrency(): number;
  /** `pipeline-step` autocommit with this subject (failures become warnings). */
  commit(message: string): Promise<void>;
  shot(shotId: string, state: ShotEventState, status?: ShotBuildStatus): void;
}

export interface StageDefinition<S extends StageId = StageId> {
  readonly id: S;
  /** Project-relative inputs (descriptive, for the README/UI). */
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  run(ctx: StageContext, request: RequestOf<S>): Promise<Result<StageSummary, StageError>>;
}

/** A sound a scene schedules (`ctx.sfx.at(t, name)`), in global seconds. */
export interface SceneSfxEvent {
  readonly t: number;
  readonly name: string;
  readonly shotId?: string | undefined;
}

export type SceneSfxProvider = (
  projectDir: string,
  signal: AbortSignal,
) => Promise<readonly SceneSfxEvent[]>;

export function stageError(
  kind: StageErrorKind,
  message: string,
  issues?: readonly string[],
): StageError {
  return issues === undefined ? { kind, message } : { kind, message, issues };
}
