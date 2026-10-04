/**
 * Deciding in the hook lab (PLAN.md#12.16, ADR-021). Pick: the chosen opening replaces the
 * script's opening paragraph (the rest stays byte for byte), every later stage that already ran
 * is marked stale exactly as after a hand edit of the script, the set records the decision and
 * the caller's autocommit gets a clear message. Scenes, shot locks and the voice-over are never
 * touched: locked shots keep their scenes (the outcome lists those that cover the opening) and a
 * recorded voice-over must be re-recorded by the user. Discard: the set records it, nothing else.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  HOOK_STYLE_LABELS,
  replaceScriptOpening,
  scriptOpening,
  type HookSet,
  type PipelineState,
} from '@reelforge/shared';
import { readProjectText, writeProjectText } from '../files.js';
import type { PipelineStage } from '../ids.js';
import { markStale, stagesToInvalidate } from '../invalidate.js';
import { FILES } from '../paths.js';
import { readProjectSnapshot } from '../snapshot.js';
import { stageError, type StageError } from '../types.js';
import { latestHookSet, lockedShotsInOpening, readHookSet, writeHookSet } from './store.js';

export interface HookDecisionOptions {
  readonly projectDir: string;
  /** The set (`.reelforge/hooks/<number>.json`). */
  readonly number: number;
  readonly store: PipelineStateStore;
  readonly now: () => Date;
}

export interface HookPickOutcome {
  readonly set: HookSet;
  /** Stages marked stale (voiceover, words, storyboard, … that already ran). */
  readonly invalidated: readonly PipelineStage[];
  /** A voice-over was recorded: the user has to re-record (at least) the opening. */
  readonly voiceover: boolean;
  /** Locked shots that start inside the replaced opening: kept as they are, never rebuilt. */
  readonly lockedShots: readonly string[];
  readonly warnings: readonly string[];
  /** Subject of the autocommit of script.txt. */
  readonly commitMessage: string;
}

export const RERECORD_WARNING =
  'You will need to re-record the opening: the voice-over no longer matches the script.';

export function lockedShotsWarning(shots: readonly string[]): string {
  return `Locked shots stay exactly as they are and are never rebuilt automatically: ${shots.join(', ')} (they cover the opening; unlock them to rebuild).`;
}

async function undecided(projectDir: string, number: number): Promise<Result<HookSet, StageError>> {
  const set = await readHookSet(projectDir, number);
  if (!set.ok) return set;
  if (set.value.decision !== undefined) {
    return err(stageError('invalid-input', `Hook set ${String(number)} was already decided.`));
  }
  return set;
}

/** The script stage after the opening changed (like a hand edit: the approval stays). */
function scriptChanged(state: PipelineState, stamp: string): PipelineState {
  const current = state.stages['script'];
  if (current?.status === 'done') return state;
  return {
    ...state,
    stages: {
      ...state.stages,
      script: { status: 'done', updatedAt: stamp, message: 'opening from the hook lab' },
    },
  };
}

export async function pickHook(
  options: HookDecisionOptions & { readonly index: number },
): Promise<Result<HookPickOutcome, StageError>> {
  const { projectDir } = options;
  const set = await undecided(projectDir, options.number);
  if (!set.ok) return set;
  const variant = set.value.variants.find((entry) => entry.index === options.index);
  if (variant === undefined) {
    return err(stageError('invalid-input', `There is no opening ${String(options.index)}.`));
  }
  const script = await readProjectText(projectDir, FILES.script);
  if (!script.ok) return script;
  if (scriptOpening(script.value ?? '')?.text !== set.value.opening) {
    return err(
      stageError(
        'not-ready',
        "The script's opening changed since these openings were written: generate new ones.",
      ),
    );
  }
  const written = await writeProjectText(
    projectDir,
    FILES.script,
    replaceScriptOpening(script.value ?? '', variant.text),
  );
  if (!written.ok) return written;
  const stamp = options.now().toISOString();
  const snapshot = await readProjectSnapshot(projectDir, options.store);
  const invalidated = stagesToInvalidate('script', snapshot);
  const state = await options.store.update(projectDir, (current) =>
    markStale(scriptChanged(current, stamp), invalidated, 'script changed', stamp),
  );
  const warnings: string[] = state.ok ? [] : [`pipeline.json: ${state.error.message}`];
  const decided = await writeHookSet(projectDir, {
    ...set.value,
    decision: { kind: 'pick', index: variant.index, at: stamp },
  });
  if (!decided.ok) return decided;
  // The shots built for the replaced narration (its time range in the current timing).
  const locked = await lockedShotsInOpening(projectDir, set.value.opening);
  if (!locked.ok) warnings.push(locked.error.message);
  const lockedShots = locked.ok ? locked.value : [];
  const voiceover = snapshot.voiceover !== undefined;
  if (voiceover) warnings.push(RERECORD_WARNING);
  if (lockedShots.length > 0) warnings.push(lockedShotsWarning(lockedShots));
  return ok({
    set: decided.value,
    invalidated,
    voiceover,
    lockedShots,
    warnings,
    commitMessage: `Hook lab: opening ${String(variant.index)} (${HOOK_STYLE_LABELS[variant.style]})`,
  });
}

export async function discardHooks(
  options: HookDecisionOptions,
): Promise<Result<HookSet, StageError>> {
  const set = await undecided(options.projectDir, options.number);
  if (!set.ok) return set;
  return writeHookSet(options.projectDir, {
    ...set.value,
    decision: { kind: 'discard', at: options.now().toISOString() },
  });
}

/** What the hook lab shows: the newest set, the current opening and what a pick would affect. */
export interface HookLabState {
  readonly opening: string | null;
  readonly set: HookSet | null;
  /** Sets stored so far (the history). */
  readonly history: number;
  /** The newest set was written for another opening (the script changed since). */
  readonly stale: boolean;
  readonly voiceover: boolean;
  /** Locked shots covering the current opening. */
  readonly lockedShots: readonly string[];
}

export async function readHookLabState(
  projectDir: string,
  store: PipelineStateStore,
): Promise<Result<HookLabState, StageError>> {
  const [script, latest, snapshot] = await Promise.all([
    readProjectText(projectDir, FILES.script),
    latestHookSet(projectDir),
    readProjectSnapshot(projectDir, store),
  ]);
  if (!script.ok) return script;
  if (!latest.ok) return latest;
  const opening = scriptOpening(script.value ?? '')?.text ?? null;
  const locked = opening === null ? ok([]) : await lockedShotsInOpening(projectDir, opening);
  if (!locked.ok) return locked;
  const set = latest.value ?? null;
  return ok({
    opening,
    set,
    history: set?.number ?? 0,
    stale: set !== null && set.decision === undefined && set.opening !== opening,
    voiceover: snapshot.voiceover !== undefined,
    lockedShots: locked.value,
  });
}
